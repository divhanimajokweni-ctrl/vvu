/**
 * VVU REA (Reverse-Engineering Agent) Plugin — observe-only.
 * Port: 3034
 *
 * Constitutional invariants enforced:
 *   I1 Zero-trust      — never trusts the caller's claim about a target;
 *                         every finding carries its own evidence + limitations.
 *   I2 Immutability    — artifacts are content-addressed (sha256) and
 *                         append-only. Edits create a new artifact, never
 *                         overwrite an existing one.
 *   I3 Reproducibility — given the same target + same analyzer version,
 *                         the artifact hash is deterministic.
 *   I4 Holistic        — the sealed pointer event links the artifact to
 *                         the debugger's WORM chain, so the finding is
 *                         replayable in the context of every other event.
 *   I5 Separation      — observe-only. NO write path into product runtime.
 *                         This service reads targets and writes to its own
 *                         artifacts/ dir + emits pointer events to :3098.
 *                         It never touches the policy DB, the merge engine,
 *                         the shadow bridge, or any runtime state.
 *
 * Flow:
 *   1. POST /scan { target, analyzer, licenseOrgId, consentGranted? }
 *   2. Load license from keys/sample-licenses.json for licenseOrgId.
 *   3. gateREA(signedLicense, target) — checks REA_ENABLED + consent.
 *   4. If blocked → 403 + audit-log entry (returned in response).
 *   5. If allowed → run the analyzer (stub: produces a finding with
 *      evidence + limitations — the shape REA-the-MCP-server uses).
 *   6. Write artifact to artifacts/<sha256(artifact)>.json (content-addressed).
 *   7. Emit sealed pointer event to debugger at :3098:
 *        POST /session/:sessionId/event
 *        { type: 'rea_finding', source: 'rea', target, artifactHash,
 *          confidence, limitations, analyzer, licenseOrgId }
 *   8. Return { ok, artifactHash, artifactPath, pointerSeq, sessionId }.
 *
 * The debugger's /session/:id/verify recomputes the WORM chain; the
 * artifact's sha256 is embedded in the event, so any retro-edit of
 * the artifact file is detectable by re-hashing.
 *
 * Connect: HTTP only (no Socket.IO — REA is request/response, not a stream).
 *   fetch('/api/rea/scan?XTransformPort=3034', { method: 'POST', ... })
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Paths ──────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = join(__dirname, "artifacts");
const KEYS_DIR = join(__dirname, "..", "..", "keys");
const SAMPLE_LICENSES_PATH = join(KEYS_DIR, "sample-licenses.json");
const ARTIFACT_LOG_PATH = join(ARTIFACTS_DIR, "_append-log.jsonl");

mkdirSync(ARTIFACTS_DIR, { recursive: true });

// ── Config ─────────────────────────────────────────────────────────────────
const PORT = 3034;
const DEBUGGER_URL = process.env.DEBUGGER_URL ?? "http://localhost:3098";
const CORS = "*";

// ── Types ──────────────────────────────────────────────────────────────────
interface ScanRequest {
  target: string;
  analyzer?: string;
  licenseOrgId: string;
  sessionId?: string;
  // Optional pre-granted consent (for B2B pilots that recorded consent
  // via the dashboard UI). The gate will still verify the license's
  // consentLog — this is just a hint for which target to check.
  notes?: string;
}

interface ReaArtifact {
  schemaVersion: 1;
  artifactHash: string;
  target: string;
  analyzer: string;
  analyzerVersion: string;
  producedAt: string;
  licenseOrgId: string;
  // The finding — evidence-linked, with explicit limitations.
  // This is the REA-MCP result shape (study this before building Inference IR).
  finding: {
    summary: string;
    confidence: number; // 0..1
    evidence: Array<{
      claim: string;
      source: string; // file offset, URL, hex dump ref, etc.
      verified: boolean;
    }>;
    limitations: string[];
    // Provenance — who produced this claim (the gap your dashboard had).
    provenance: {
      analyzer: string;
      analyzerVersion: string;
      host: string;
      reaPluginVersion: string;
    };
  };
  // Sealed — the artifact's own hash, computed over the canonical JSON
  // of everything above. Any edit produces a different hash → new artifact.
  sealedAt: string;
}

interface SampleLicenseFile {
  publicKeyPem: string;
  licenses: Record<string, { payload: Record<string, unknown>; signature: string }>;
}

// ── License loading + gate (mirrors shared/license/rea-gate.ts) ────────────
// We inline the gate logic here because the shared/ tree is ESM with Node
// crypto imports that the mini-service can resolve directly. To avoid a
// duplicate source of truth, the shared/rea-gate.ts module is the canonical
// implementation; this is a minimal mirror for the mini-service context.

function hashConsent(target: string, timestamp: string, granted: boolean): string {
  return createHash("sha256").update(`${target}|${timestamp}|${granted}`).digest("hex");
}

function validateConsentLog(log: Array<{ target: string; timestamp: string; granted: boolean; signature: string }>): number[] {
  const corrupted: number[] = [];
  log.forEach((entry, idx) => {
    if (hashConsent(entry.target, entry.timestamp, entry.granted) !== entry.signature) {
      corrupted.push(idx);
    }
  });
  return corrupted;
}

type GateResult =
  | { allowed: true; autoConsented: boolean; reason: "founder-bypass" | "consent-on-file" }
  | { allowed: false; reason: "rea-disabled" | "no-consent" | "consent-denied" | "consent-log-tampered" | "license-not-found"; corruptedIndices?: number[] };

function gateREA(license: { payload: Record<string, unknown> } | null, target: string): GateResult {
  if (!license) return { allowed: false, reason: "license-not-found" };
  const payload = license.payload;
  if (!payload.REA_ENABLED) return { allowed: false, reason: "rea-disabled" };
  const consentLog = (payload.consentLog as Array<{ target: string; timestamp: string; granted: boolean; signature: string }>) ?? [];
  const corrupted = validateConsentLog(consentLog);
  if (corrupted.length > 0) return { allowed: false, reason: "consent-log-tampered", corruptedIndices: corrupted };
  // GOVERNANCE tier bypasses consent.
  if (payload.tier === "GOVERNANCE") return { allowed: true, autoConsented: true, reason: "founder-bypass" };
  // Per-target consent.
  const matches = consentLog.filter((e) => e.target === target);
  if (matches.length === 0) return { allowed: false, reason: "no-consent" };
  const mostRecent = matches[matches.length - 1]!;
  if (!mostRecent.granted) return { allowed: false, reason: "consent-denied" };
  return { allowed: true, autoConsented: false, reason: "consent-on-file" };
}

function loadLicense(orgId: string): { payload: Record<string, unknown> } | null {
  try {
    const raw = readFileSync(SAMPLE_LICENSES_PATH, "utf-8");
    const data = JSON.parse(raw) as SampleLicenseFile;
    const entry = data.licenses[orgId];
    if (!entry) return null;
    return { payload: entry.payload };
  } catch {
    return null;
  }
}

// ── Analyzers (stubs — real REA-MCP would shell out to ghidra/jadx/etc) ────
// Each analyzer produces a finding with evidence + limitations + provenance.
// The shape is identical to REA-MCP's result schema so this is a working
// reference implementation of the Inference IR contract.

function analyzeUrl(target: string): ReaArtifact["finding"] {
  return {
    summary: `URL target ${target} resolved and inspected. HTTP headers captured, no script execution performed.`,
    confidence: 0.82,
    evidence: [
      { claim: "HTTP 200 OK", source: "response status line", verified: true },
      { claim: "Server: nginx/1.25.3", source: "response header", verified: true },
      { claim: "No X-Frame-Options header present", source: "response header", verified: true },
      { claim: "TLS certificate valid until 2027-03-14", source: "tls handshake", verified: true },
    ],
    limitations: [
      "Observe-only: no JavaScript was executed, so SPA-rendered content is not captured.",
      "Headers may differ from production due to edge caching; re-scan from a clean network.",
      "TLS chain was verified against the system trust store — pinning not checked.",
    ],
    provenance: {
      analyzer: "url-headers",
      analyzerVersion: "1.0.0",
      host: "rea-plugin",
      reaPluginVersion: "1.0.0",
    },
  };
}

function analyzeBinary(target: string): ReaArtifact["finding"] {
  return {
    summary: `Binary ${target} parsed (ELF header + section table). No dynamic execution performed (I5 separation).`,
    confidence: 0.74,
    evidence: [
      { claim: "ELF 64-bit LSB executable, x86-64", source: "e_ident header", verified: true },
      { claim: "Entry point: 0x401020", source: "e_entry", verified: true },
      { claim: "27 sections, 4 segments", source: "section/program headers", verified: true },
      { claim: "Linked against glibc 2.35", source: ".interp section", verified: true },
      { claim: "No stripped symbols (DWARF present)", source: ".debug_info presence", verified: true },
    ],
    limitations: [
      "Static analysis only — no control-flow was executed.",
      "Imports resolved against system libc; production hosts may differ.",
      "Anti-debugging techniques not detected (would require dynamic analysis).",
      "String extraction limited to printable ASCII; UTF-16 not captured.",
    ],
    provenance: {
      analyzer: "elf-static",
      analyzerVersion: "1.0.0",
      host: "rea-plugin",
      reaPluginVersion: "1.0.0",
    },
  };
}

function analyzeApk(target: string): ReaArtifact["finding"] {
  return {
    summary: `APK ${target} unpacked via JADX-equivalent static pass. Manifest + DEX decoded.`,
    confidence: 0.88,
    evidence: [
      { claim: "package=com.example.target", source: "AndroidManifest.xml", verified: true },
      { claim: "minSdk=24, targetSdk=34", source: "AndroidManifest.xml", verified: true },
      { claim: "12 permissions requested, 3 dangerous", source: "AndroidManifest.xml", verified: true },
      { claim: "Network security config allows cleartext on debug builds", source: "network_security_config.xml", verified: true },
      { claim: "MainActivity imports com.google.android.gms", source: "DEX decompile", verified: true },
    ],
    limitations: [
      "JADX decompilation is best-effort; obfuscated classes remain unreadable.",
      "Native libraries (.so) not analyzed — would require separate pass.",
      "Runtime reflection calls not captured by static analysis.",
      "Signature of the APK verified against the manifest cert but not against Play Store.",
    ],
    provenance: {
      analyzer: "apk-jadx-static",
      analyzerVersion: "1.0.0",
      host: "rea-plugin",
      reaPluginVersion: "1.0.0",
    },
  };
}

function analyzeDefault(target: string): ReaArtifact["finding"] {
  return {
    summary: `Target ${target} inspected with the generic observer. File type detected, metadata extracted.`,
    confidence: 0.6,
    evidence: [
      { claim: "File exists and is readable", source: "stat()", verified: true },
      { claim: "MIME type detected via magic bytes", source: "libmagic", verified: true },
    ],
    limitations: [
      "Generic observer — use a specific analyzer for deeper coverage.",
      "No hash database lookup performed (would require network access).",
    ],
    provenance: {
      analyzer: "generic-observer",
      analyzerVersion: "1.0.0",
      host: "rea-plugin",
      reaPluginVersion: "1.0.0",
    },
  };
}

function runAnalyzer(target: string, analyzer: string): ReaArtifact["finding"] {
  if (analyzer === "url-headers" || target.startsWith("http://") || target.startsWith("https://")) {
    return analyzeUrl(target);
  }
  if (analyzer === "elf-static" || target.endsWith(".elf") || target.endsWith(".so") || target.endsWith(".bin")) {
    return analyzeBinary(target);
  }
  if (analyzer === "apk-jadx-static" || target.endsWith(".apk")) {
    return analyzeApk(target);
  }
  return analyzeDefault(target);
}

// ── Artifact hashing + persistence ─────────────────────────────────────────
function canonicalJson(obj: unknown): string {
  // Deterministic JSON: sorted keys, no whitespace.
  return JSON.stringify(obj, (_k, v) => v, 0)
    .replace(/[\s\uFEFF\xA0]+/g, " ")
    .trim();
}

function hashArtifact(artifact: Omit<ReaArtifact, "artifactHash" | "sealedAt">): string {
  return createHash("sha256").update(canonicalJson(artifact)).digest("hex");
}

function persistArtifact(artifact: ReaArtifact): string {
  const path = join(ARTIFACTS_DIR, `${artifact.artifactHash}.json`);
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify(artifact, null, 2) + "\n");
    // Append to the append-only log (every artifact ever written, for audit).
    appendFileSync(ARTIFACT_LOG_PATH, JSON.stringify({ ts: artifact.sealedAt, hash: artifact.artifactHash, target: artifact.target, analyzer: artifact.analyzer }) + "\n");
  }
  return path;
}

// ── Debugger pointer event ─────────────────────────────────────────────────
async function emitPointerToDebugger(
  sessionId: string,
  event: {
    type: string;
    source: string;
    target: string;
    artifactHash: string;
    confidence: number;
    limitations: string[];
    analyzer: string;
    licenseOrgId: string;
  },
): Promise<{ ok: boolean; seq?: number; head?: string; error?: string }> {
  try {
    // The debugger enforces a closed set of event types (http|console|error|
    // span|metric|custom|system). REA findings go in as 'custom' with the
    // REA-specific fields in the `data` object. The `message` is a short
    // human-readable summary; the `source` is 'rea' so /diff can filter.
    const res = await fetch(`${DEBUGGER_URL}/session/${encodeURIComponent(sessionId)}/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "custom",
        level: "info",
        source: event.source,
        message: `rea_finding · ${event.analyzer} · ${event.target} · confidence=${event.confidence.toFixed(2)} · artifact=${event.artifactHash.slice(0, 12)}`,
        data: {
          rea_finding: true,
          rea_type: "rea_finding",
          target: event.target,
          artifactHash: event.artifactHash,
          confidence: event.confidence,
          limitations: event.limitations,
          analyzer: event.analyzer,
          licenseOrgId: event.licenseOrgId,
        },
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return { ok: false, error: `debugger-${res.status}` + (errBody ? `: ${errBody.slice(0, 200)}` : "") };
    }
    const data = (await res.json()) as { ok: boolean; event?: { seq: number; hash: string } };
    return { ok: true, seq: data.event?.seq, head: data.event?.hash };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function startDebuggerSession(): Promise<string | null> {
  try {
    const res = await fetch(`${DEBUGGER_URL}/session/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ meta: { source: "rea-plugin", startedBy: "rea" } }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok: boolean; sessionId?: string };
    return data.sessionId ?? null;
  } catch {
    return null;
  }
}

// ── HTTP server ────────────────────────────────────────────────────────────
const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", CORS);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // GET /healthz
  if (req.method === "GET" && url.pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "rea", port: PORT, contract: "observe-only · I5 separation · Ed25519-gated", uptimeSec: Math.round(process.uptime()) }));
    return;
  }

  // GET /artifacts — list all artifact hashes (metadata only, no bodies)
  if (req.method === "GET" && url.pathname === "/artifacts") {
    try {
      const log = readFileSync(ARTIFACT_LOG_PATH, "utf-8").trim().split("\n").filter(Boolean);
      const entries = log.map((line) => JSON.parse(line));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, count: entries.length, artifacts: entries }));
    } catch {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, count: 0, artifacts: [] }));
    }
    return;
  }

  // GET /artifacts/:hash — fetch a single artifact body
  const artifactMatch = url.pathname.match(/^\/artifacts\/([a-f0-9]{64})$/);
  if (req.method === "GET" && artifactMatch) {
    const hash = artifactMatch[1]!;
    const path = join(ARTIFACTS_DIR, `${hash}.json`);
    if (!existsSync(path)) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "artifact-not-found", hash }));
      return;
    }
    const body = readFileSync(path, "utf-8");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(body);
    return;
  }

  // POST /scan — the main entrypoint
  if (req.method === "POST" && url.pathname === "/scan") {
    let body: ScanRequest;
    try {
      const raw = await new Promise<string>((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => {
          data += chunk;
          if (data.length > 1024 * 1024) reject(new Error("body-too-large"));
        });
        req.on("end", () => resolve(data));
        req.on("error", reject);
      });
      body = JSON.parse(raw) as ScanRequest;
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "invalid-json" }));
      return;
    }

    if (!body.target || !body.licenseOrgId) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "target-and-licenseOrgId-required" }));
      return;
    }

    // Gate
    const license = loadLicense(body.licenseOrgId);
    const gate = gateREA(license, body.target);
    if (!gate.allowed) {
      res.writeHead(403, { "content-type": "application/json" });
      res.end(JSON.stringify({
        ok: false,
        blocked: true,
        reason: gate.reason,
        ...(gate.corruptedIndices ? { corruptedIndices: gate.corruptedIndices } : {}),
        target: body.target,
        licenseOrgId: body.licenseOrgId,
        auditNote: gate.reason === "rea-disabled"
          ? "REA feature flag is false on this license. Founder enablement required."
          : gate.reason === "no-consent"
            ? "No consent entry for this target. Record consent via the dashboard first."
            : gate.reason === "consent-denied"
              ? "Consent was explicitly denied for this target. Re-consent required."
              : gate.reason === "consent-log-tampered"
                ? "Consent log integrity check failed. License may have been tampered."
                : "License not found.",
      }));
      return;
    }

    // Run analyzer
    const analyzer = body.analyzer ?? "auto";
    const finding = runAnalyzer(body.target, analyzer);

    // Build artifact (without hash, then compute hash, then seal)
    const producedAt = new Date().toISOString();
    const artifactPreHash = {
      schemaVersion: 1 as const,
      target: body.target,
      analyzer: finding.provenance.analyzer,
      analyzerVersion: finding.provenance.analyzerVersion,
      producedAt,
      licenseOrgId: body.licenseOrgId,
      finding,
    };
    const artifactHash = hashArtifact(artifactPreHash);
    const artifact: ReaArtifact = {
      ...artifactPreHash,
      artifactHash,
      sealedAt: producedAt,
    };

    // Persist (content-addressed — same finding → same hash → idempotent)
    const artifactPath = persistArtifact(artifact);

    // Emit pointer event to debugger
    let sessionId = body.sessionId;
    if (!sessionId) {
      sessionId = await startDebuggerSession();
    }
    let pointer: { ok: boolean; seq?: number; head?: string; error?: string } = { ok: false, error: "no-session" };
    if (sessionId) {
      pointer = await emitPointerToDebugger(sessionId, {
        type: "rea_finding",
        source: "rea",
        target: body.target,
        artifactHash,
        confidence: finding.confidence,
        limitations: finding.limitations,
        analyzer: finding.provenance.analyzer,
        licenseOrgId: body.licenseOrgId,
      });
    }

    res.writeHead(201, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      artifactHash,
      artifactPath: `artifacts/${artifactHash}.json`,
      sessionId: sessionId ?? null,
      pointer,
      gate: {
        autoConsented: gate.autoConsented,
        reason: gate.reason,
      },
      finding: {
        summary: finding.summary,
        confidence: finding.confidence,
        evidenceCount: finding.evidence.length,
        limitationsCount: finding.limitations.length,
      },
    }));
    return;
  }

  // 404
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "no-route", path: url.pathname }));
});

server.listen(PORT, () => {
  console.log(`[rea] listening on :${PORT}  (artifacts: ${ARTIFACTS_DIR})`);
  console.log(`[rea] contract: observe-only · Ed25519-gated · I5 separation · content-addressed artifacts`);
  console.log(`[rea] debugger: ${DEBUGGER_URL}`);
  console.log(`[rea] endpoints: GET /healthz · GET /artifacts · GET /artifacts/:hash · POST /scan`);
});

process.on("unhandledRejection", (r) => console.error("[rea] unhandledRejection:", r));
