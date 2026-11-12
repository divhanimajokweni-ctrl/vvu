// scripts/s3-conformance-stub.mjs — R79 · the signature-VALIDATING s3 stub.
// ─────────────────────────────────────────────────────────────────────────────
// An s3-compatible endpoint, small enough to read in one sitting, that does
// the ONE thing a dumb file server cannot: it RECOMPUTES the AWS SigV4
// signature of every request and refuses 403 when it does not match — exactly
// the check a real endpoint (AWS/MinIO) performs. That makes it a conformance
// harness, not a fake: if the estate's signer were wrong, the drill would
// fail here the same way it would against AWS.
//
// Implements, path-style only:
//   PUT  /{bucket}/{key}   store object (temp + rename), respond ETag (md5)
//   HEAD /{bucket}/{key}   200 + content-length + ETag, or 404
//   GET  /{bucket}/{key}   200 + bytes, or 404
//   GET  /{bucket}?list-type=2&prefix=…   ListObjectsV2 XML (R82 — the signed
//                                         LIST the audit's EXTRA sweep rides)
// Everything else → 400. Signature invalid / credentials unknown → 403.
// Body integrity: the signed x-amz-content-sha256 must match the received
// bytes — a corrupted PUT is refused, not stored.
// R82: the signature validator now canonicalizes the QUERY STRING too (sorted,
// URI-encoded, the SigV4 rule) — before this drill round the client signed no
// parameters; the LIST verb does, so a stub that ignored the query would
// accept a signature computed over the wrong canonical request.
//
// Run directly (standalone smoke):   bun scripts/s3-conformance-stub.mjs
// Import for the drill:              import { startS3ConformanceStub } from ...
// ─────────────────────────────────────────────────────────────────────────────

import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync, renameSync, existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import http from 'node:http';

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export function startS3ConformanceStub({ port, dir, accessKey, secretKey, region = 'us-east-1', maxKeys: maxKeysOption = 1000 }) {
  mkdirSync(dir, { recursive: true });
  const log = [];

  function objectPath(bucket, key) {
    if (!bucket || !key || key.includes('..')) return null;
    return join(dir, bucket, key);
  }

  function checkSig(req, body) {
    const auth = req.headers['authorization'] ?? '';
    const m = /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]+)\/s3\/aws4_request,\s*SignedHeaders=([^,]+),\s*Signature=([0-9a-f]{64})$/.exec(auth);
    if (!m) return { ok: false, why: 'unparsable authorization header' };
    const [, credKey, dateStamp, credRegion, signedHeaders, presented] = m;
    if (credKey !== accessKey) return { ok: false, why: `unknown access key ${credKey.slice(0, 4)}…` };
    if (credRegion !== region) return { ok: false, why: `region ${credRegion} != ${region}` };

    const amzDate = req.headers['x-amz-date'];
    if (!amzDate || !amzDate.startsWith(dateStamp)) return { ok: false, why: 'x-amz-date missing or not in the credential date' };

    // The content-sha256 the client SIGNED must be the sha256 of the bytes
    // that actually arrived — body integrity before signature.
    const signedPayload = req.headers['x-amz-content-sha256'] ?? '';
    const actualPayload = body && body.length > 0 ? createHash('sha256').update(body).digest('hex') : EMPTY_SHA256;
    if (signedPayload !== actualPayload) return { ok: false, why: 'x-amz-content-sha256 does not match the received bytes' };

    // Recompute the canonical request from the SIGNED header list only.
    const names = signedHeaders.split(';');
    const canonicalHeaders = names
      .map((h) => {
        const v = h === 'host' ? req.headers['host'] ?? '' : req.headers[h] ?? '';
        return `${h}:${String(v).trim()}\n`;
      })
      .join('');
    const [pathAndQuery, rawQuery] = (req.url ?? '/').split('?');
    // R82 — canonical query string, recomputed from the request the same way
    // the signer does it: decode, sort by key, re-encode. An empty/absent
    // query canonicalizes to '' exactly as before.
    const canonicalQuery = (rawQuery ?? '')
      .split('&')
      .filter(Boolean)
      .map((pair) => {
        const eq = pair.indexOf('=');
        const k = eq === -1 ? pair : pair.slice(0, eq);
        const v = eq === -1 ? '' : pair.slice(eq + 1);
        return `${encodeURIComponent(decodeURIComponent(k))}=${encodeURIComponent(decodeURIComponent(v))}`;
      })
      .sort()
      .join('&');
    const payloadForSig = (req.method === 'PUT' || req.method === 'POST') ? actualPayload : EMPTY_SHA256;
    const canonicalRequest = [req.method, pathAndQuery, canonicalQuery, canonicalHeaders, signedHeaders, payloadForSig].join('\n');

    const scope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    const kDate = createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest();
    const kRegion = createHmac('sha256', kDate).update(region).digest();
    const kService = createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
    const expected = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(presented, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, why: 'signature mismatch' };
    return { ok: true };
  }

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const [pathAndQuery] = (req.url ?? '/').split('?');
      const parts = pathAndQuery.split('/').filter(Boolean).map(decodeURIComponent);
      const done = (status, headers = {}, bodyOut = null) => {
        log.push({ at: new Date().toISOString(), method: req.method, url: req.url, status });
        if (status !== 403 && status !== 404 && status !== 400) {
          // keep the transcript short: refusals are the interesting lines
        }
        res.writeHead(status, headers);
        res.end(bodyOut);
      };

      const sig = checkSig(req, body);
      if (!sig.ok) {
        res.writeHead(403, { 'content-type': 'application/xml' });
        res.end(`<?xml version="1.0"?><Error><Code>SignatureDoesNotMatch</Code><Message>${sig.why}</Message></Error>`);
        log.push({ at: new Date().toISOString(), method: req.method, url: req.url, status: 403, why: sig.why });
        return;
      }

      // ── R82 · ListObjectsV2 — GET /{bucket}?list-type=2&prefix=… ──────────
      // The bucket-root LIST: every stored key under the prefix, sorted, with
      // size + md5 etag. Partial (.tmp-) objects are never listed — a real
      // endpoint cannot show an upload that has not completed.
      // R83 · the branch is now PAGINATED: max-keys is honored (the drill
      // shrinks it to 2 so every LIST is multi-page) and continuation-token
      // resumes strictly AFTER the token key — the ListObjectsV2 start-after
      // semantic. The token is opaque (base64 'key:<lastKey>') but SIGNED —
      // the recanonicalizing validator above already verified it.
      const urlParams = new URLSearchParams((req.url ?? '').split('?')[1] ?? '');
      if (req.method === 'GET' && parts.length === 1 && urlParams.get('list-type') === '2') {
        const bucket = parts[0];
        // R84 · fault injection for the drill: a marker file inside the bucket
        // root makes every LIST answer 500 (the drill plants/removes it to
        // prove the INCOMPLETE verdict — a failed sweep must never read as
        // PASS). The fault is a FILE, so a crashed drill leaves evidence, and
        // the drill's finally block removes it.
        if (existsSync(join(dir, bucket, '.list-fault'))) {
          done(500, { 'content-type': 'application/xml' }, `<?xml version="1.0"?><Error><Code>InternalError</Code><Message>list-fault marker present</Message></Error>`);
          log.push({ at: new Date().toISOString(), method: req.method, url: req.url, status: 500, why: 'list-fault' });
          return;
        }
        const prefix = urlParams.get('prefix') ?? '';
        // R86 · the KeyCount fault marker (drill 4g): every LIST answers with
        // KeyCount one HIGHER than the Contents it carries — the shape a
        // lying/broken endpoint produces. The audit's parser must catch the
        // mismatch (INCOMPLETE), never flatten it into a PASS. A FILE like
        // .list-fault, so a crashed drill leaves evidence behind.
        const keyCountFault = existsSync(join(dir, bucket, '.list-keycount-fault'));
        const all = [];
        const walk = (rel) => {
          const abs = join(dir, bucket, rel);
          let entries;
          try {
            entries = readdirSync(abs, { withFileTypes: true });
          } catch {
            return; // bucket or subpath does not exist → empty listing
          }
          for (const e of entries) {
            const child = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) walk(child);
            else if (e.isFile() && !e.name.includes('.tmp-')) {
              try {
                const buf = readFileSync(join(dir, bucket, child));
                all.push({ key: child, size: buf.length, etag: createHash('md5').update(buf).digest('hex') });
              } catch {
                /* unreadable object skipped — the listing stays honest about what it read */
              }
            }
          }
        };
        walk('');
        const matching = all
          .filter((o) => o.key.startsWith(prefix))
          .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
        const MAX = Math.max(1, Number(urlParams.get('max-keys')) || maxKeysOption);
        // R83 — resume strictly after the continuation token's key (opaque
        // base64('key:<lastKey>'); malformed tokens just start from the top —
        // a real endpoint would 400, the drill never sends one).
        let startAfter = '';
        const rawToken = urlParams.get('continuation-token');
        if (rawToken) {
          try {
            const decoded = Buffer.from(rawToken, 'base64').toString('utf8');
            if (decoded.startsWith('key:')) startAfter = decoded.slice(4);
          } catch {
            /* opaque garbage → page from the top */
          }
        }
        const eligible = startAfter ? matching.filter((o) => o.key > startAfter) : matching;
        const truncated = eligible.length > MAX;
        const page = eligible.slice(0, MAX);
        const nextToken = truncated ? Buffer.from(`key:${page[page.length - 1].key}`).toString('base64') : null;
        // R86 — real-XML escaping: the five named entities (quotes included —
        // ListObjectsV2 escapes `"` and `'` in keys exactly like this), so a
        // key carrying & < > " ' arrives as a real endpoint would send it.
        const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        const xml =
          `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>${esc(bucket)}</Name><Prefix>${esc(prefix)}</Prefix><KeyCount>${page.length + (keyCountFault ? 1 : 0)}</KeyCount><MaxKeys>${MAX}</MaxKeys><IsTruncated>${truncated}</IsTruncated>` +
          (nextToken ? `<NextContinuationToken>${nextToken}</NextContinuationToken>` : '') +
          page
            .map(
              (o) =>
                `<Contents><Key>${esc(o.key)}</Key><LastModified>2026-01-01T00:00:00.000Z</LastModified><ETag>&quot;${o.etag}&quot;</ETag><Size>${o.size}</Size><StorageClass>STANDARD</StorageClass></Contents>`,
            )
            .join('') +
          // R86 — the top-level Owner block every real endpoint emits: the
          // parser must IGNORE it (it is not a Contents row). Its presence in
          // every drill LIST is the standing proof.
          `<Owner><ID>75aa57f09aa0c8caeab4f8c24e99d10f8e7faeebf76c078efc7c6caea54ba06a</ID><DisplayName>drill-owner</DisplayName></Owner>` +
          '</ListBucketResult>';
        done(200, { 'content-type': 'application/xml' }, xml);
        return;
      }

      if (parts.length < 2) {
        done(400, { 'content-type': 'application/xml' }, '<?xml version="1.0"?><Error><Code>InvalidRequest</Code><Message>path-style /{bucket}/{key…} only — the key may itself contain slashes</Message></Error>');
        return;
      }
      // Path-style addressing: the FIRST segment is the bucket, EVERYTHING
      // after it — slashes included — is the key (first drill run caught the
      // two-segment assumption: the estate's keys are `vvu-anchors/<file>`).
      const [bucket, ...keyParts] = parts;
      const key = keyParts.join('/');
      const dest = objectPath(bucket, key);
      if (!dest) {
        done(400, { 'content-type': 'application/xml' }, '<?xml version="1.0"?><Error><Code>InvalidRequest</Code><Message>bad key</Message></Error>');
        return;
      }

      if (req.method === 'PUT') {
        mkdirSync(dirname(dest), { recursive: true });
        const tmp = `${dest}.tmp-${randomUUID()}`;
        writeFileSync(tmp, body);
        renameSync(tmp, dest);
        done(200, { etag: `"${createHash('md5').update(body).digest('hex')}"` });
        return;
      }
      if (req.method === 'HEAD') {
        if (!existsSync(dest)) {
          res.writeHead(404);
          res.end();
          log.push({ at: new Date().toISOString(), method: 'HEAD', url: req.url, status: 404 });
          return;
        }
        const buf = readFileSync(dest);
        res.writeHead(200, {
          'content-length': String(buf.length),
          etag: `"${createHash('md5').update(buf).digest('hex')}"`,
          'last-modified': new Date().toUTCString(),
        });
        res.end();
        log.push({ at: new Date().toISOString(), method: 'HEAD', url: req.url, status: 200 });
        return;
      }
      if (req.method === 'GET') {
        if (!existsSync(dest)) {
          done(404, { 'content-type': 'application/xml' }, '<?xml version="1.0"?><Error><Code>NoSuchKey</Code><Message>the key you requested does not exist</Message></Error>');
          return;
        }
        const buf = readFileSync(dest);
        done(200, { 'content-length': String(buf.length), etag: `"${createHash('md5').update(buf).digest('hex')}"` }, buf);
        return;
      }
      done(400, { 'content-type': 'application/xml' }, '<?xml version="1.0"?><Error><Code>MethodNotAllowed</Code><Message>PUT/HEAD/GET only</Message></Error>');
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({
        stop: () =>
          new Promise((done) => {
            server.close(() => done());
            setTimeout(() => done(), 1500).unref?.();
          }),
        log,
        dir,
      });
    });
  });
}

// Direct run — a five-line smoke so the stub is provably alive on its own.
if (process.argv[1] && process.argv[1].endsWith('s3-conformance-stub.mjs')) {
  const dir = join(process.cwd(), '.s3-stub-smoke');
  rmSync(dir, { recursive: true, force: true });
  const stub = await startS3ConformanceStub({
    port: 9102,
    dir,
    accessKey: 'smokeAKID',
    secretKey: 'smokeSecret',
  });
  const put = await fetch('http://127.0.0.1:9102/smoke-bucket/hello.txt', {
    method: 'PUT',
    headers: { authorization: 'garbage' },
    body: 'x',
  });
  console.log(`unsigned PUT refused: HTTP ${put.status} (want 403)`);
  const stub2 = stub;
  await stub2.stop();
  rmSync(dir, { recursive: true, force: true });
  console.log('stub smoke done');
}
