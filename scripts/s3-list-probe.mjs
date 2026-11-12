// scripts/s3-list-probe.mjs — R82 debug probe, R83 extended: signed PUTs +
// signed LIST against the conformance stub, now driving PAGINATION directly at
// the HTTP level: max-keys honored, continuation-token SIGNED and accepted,
// the union across pages covering every key, and a TAMPERED token rejected
// with 403 (the token rides inside the signed query — integrity is free).
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { startS3ConformanceStub } from './s3-conformance-stub.mjs';

const PORT = 9113;
const BUCKET = 'probe-bucket';
const PREFIX = 'vvu-anchors';
const AK = `probe-${randomUUID().slice(0, 8)}`;
const SK = `probe-secret-${randomUUID()}`;
const DIR = join(process.cwd(), '.s3-probe-stub');

function sign(method, pathAndQuery, secret, when, body) {
  const dateStamp = when.slice(0, 8);
  const payloadHash = body && body.length > 0 ? createHash('sha256').update(body).digest('hex') : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const [path, rawQuery] = pathAndQuery.split('?');
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
  const canonicalHeaders = `host:127.0.0.1:${PORT}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${when}\n`;
  const canonicalRequest = [method, path, canonicalQuery, canonicalHeaders, 'host;x-amz-content-sha256;x-amz-date', payloadHash].join('\n');
  const scope = `${dateStamp}/us-east-1/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', when, scope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
  const kDate = createHmac('sha256', `AWS4${secret}`).update(dateStamp).digest();
  const kRegion = createHmac('sha256', kDate).update('us-east-1').digest();
  const kService = createHmac('sha256', kRegion).update('s3').digest();
  const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
  return `AWS4-HMAC-SHA256 Credential=${AK}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${createHmac('sha256', kSigning).update(stringToSign).digest('hex')}`;
}

const stub = await startS3ConformanceStub({ port: PORT, dir: DIR, accessKey: AK, secretKey: SK, maxKeys: 2 });
const putted = [];
async function putProbe(name, body) {
  const when1 = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const put = await fetch(`http://127.0.0.1:${PORT}/${BUCKET}/${PREFIX}/${name}`, {
    method: 'PUT',
    headers: {
      Authorization: sign('PUT', `/${BUCKET}/${PREFIX}/${name}`, SK, when1, Buffer.from(body)),
      'x-amz-content-sha256': createHash('sha256').update(body).digest('hex'),
      'x-amz-date': when1,
      'content-length': String(body.length),
    },
    body,
  });
  putted.push(name);
  console.log(`PUT ${name}: ${put.status}`);
  return put.status;
}
async function signedList(query) {
  const when = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return fetch(`http://127.0.0.1:${PORT}/${BUCKET}?${query}`, {
    method: 'GET',
    headers: {
      Authorization: sign('GET', `/${BUCKET}?${query}`, SK, when),
      'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'x-amz-date': when,
    },
  });
}
try {
  await putProbe('probe-a.json', 'aaa');
  await putProbe('probe-b.json', 'bbb');
  await putProbe('probe-c.json', 'ccc');
  await putProbe('probe-d.json', 'ddd');
  await putProbe('probe-e.json', 'eee');

  // ── page 1: max-keys=2, must be truncated with a token ──────────────────
  const q1 = 'list-type=2&max-keys=2&prefix=' + encodeURIComponent(PREFIX + '/');
  const p1 = await signedList(q1);
  const xml1 = await p1.text();
  const keys1 = [...xml1.matchAll(/<Key>([\s\S]*?)<\/Key>/g)].map((m) => m[1]);
  const token = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml1)?.[1] ?? null;
  console.log(`page 1: ${p1.status}, keys ${keys1.length} [${keys1.join(', ')}], truncated=${/<IsTruncated>true/.test(xml1)}, token=${token ? 'present' : 'ABSENT'}`);

  // ── page 2: the continuation token is SIGNED (part of the canonical query) ──
  const q2 = 'list-type=2&max-keys=2&prefix=' + encodeURIComponent(PREFIX + '/') + '&continuation-token=' + encodeURIComponent(token ?? '');
  const p2 = await signedList(q2);
  const xml2 = await p2.text();
  const keys2 = [...xml2.matchAll(/<Key>([\s\S]*?)<\/Key>/g)].map((m) => m[1]);
  const token2 = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml2)?.[1] ?? null;
  console.log(`page 2: ${p2.status}, keys ${keys2.length} [${keys2.join(', ')}], truncated=${/<IsTruncated>true/.test(xml2)}, token=${token2 ? 'present' : 'absent (final page)'}`);

  // ── page 3: the tail ─────────────────────────────────────────────────────
  let keys3 = [];
  if (token2) {
    const q3 = 'list-type=2&max-keys=2&prefix=' + encodeURIComponent(PREFIX + '/') + '&continuation-token=' + encodeURIComponent(token2);
    const p3 = await signedList(q3);
    const xml3 = await p3.text();
    keys3 = [...xml3.matchAll(/<Key>([\s\S]*?)<\/Key>/g)].map((m) => m[1]);
    console.log(`page 3: ${p3.status}, keys ${keys3.length} [${keys3.join(', ')}], truncated=${/<IsTruncated>true/.test(xml3)}`);
  }

  // ── the token-integrity 403: sign the ORIGINAL query, SEND the tampered one.
  // A request whose query was altered after signing must be refused — the
  // stub's recanonicalizing validator recomputes the signature over the
  // RECEIVED query, and the two signatures disagree. (Signing the tampered
  // query itself would be a VALID request — that is how SigV4 works — so the
  // honest proof is sign-one/send-another, exactly what a MITM does.)
  // (R83 lesson: base64 tokens end in '=' padding — flipping the LAST chars is
  // a no-op. Flip the first char; that always changes the decoded key.)
  const tampered = (token?.[0] === 'A' ? 'B' : 'A') + (token ?? '').slice(1);
  const qSign = 'list-type=2&max-keys=2&prefix=' + encodeURIComponent(PREFIX + '/') + '&continuation-token=' + encodeURIComponent(token ?? '');
  const qSend = 'list-type=2&max-keys=2&prefix=' + encodeURIComponent(PREFIX + '/') + '&continuation-token=' + encodeURIComponent(tampered);
  const whenT = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const pT = await fetch(`http://127.0.0.1:${PORT}/${BUCKET}?${qSend}`, {
    method: 'GET',
    headers: {
      Authorization: sign('GET', `/${BUCKET}?${qSign}`, SK, whenT),
      'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'x-amz-date': whenT,
    },
  });
  const pT2 = await signedList(qSign); // the honest signed query must still pass afterwards
  console.log(`signed-one/sent-another token swap: ${pT.status} (403 = the RECEIVED query is what gets verified)`);
  console.log(`the honest signed query still answers: ${pT2.status}`);

  const union = [...keys1, ...keys2, ...keys3];
  const expected = putted.map((n) => `${PREFIX}/${n}`).sort();
  const okUnion = JSON.stringify(union) === JSON.stringify(expected);
  const okNoDupes = new Set(union).size === union.length;
  console.log(`union across pages: ${union.length}/${expected.length} keys, sorted-correct=${okUnion}, no-duplicates=${okNoDupes}, tampered-403=${pT.status === 403}, honest-still-ok=${pT2.status === 200}`);
  console.log(`PROBE VERDICT: ${okUnion && okNoDupes && pT.status === 403 && pT2.status === 200 && keys1.length === 2 ? 'ALL GREEN' : 'FAILED'}`);

  // ── the R82 request-line forms, kept as a regression ────────────────────
  for (const listUrl of [`/${BUCKET}?list-type=2&prefix=${encodeURIComponent(PREFIX + '/')}`, `/${BUCKET}/?list-type=2&prefix=${encodeURIComponent(PREFIX + '/')}`]) {
    const when = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const list = await fetch(`http://127.0.0.1:${PORT}${listUrl}`, {
      method: 'GET',
      headers: {
        Authorization: sign('GET', listUrl, SK, when),
        'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'x-amz-date': when,
      },
    }).catch((e) => null);
    if (!list) {
      console.log(`LIST ${listUrl} → FETCH FAILED (stub crashed on this request?)`);
      const ping = await fetch(`http://127.0.0.1:${PORT}/${BUCKET}/${PREFIX}/probe.json`, { method: 'HEAD' }).catch(() => null);
      console.log('stub alive after that LIST:', ping ? 'yes' : 'NO — confirmed crash');
      continue;
    }
    const body = await list.text();
    const n = (body.match(/<Contents>/g) ?? []).length;
    console.log(`LIST ${listUrl} → ${list.status}, Contents: ${n}`);
    const ping = await fetch(`http://127.0.0.1:${PORT}/${BUCKET}/${PREFIX}/probe.json`, { method: 'HEAD' }).catch(() => null);
    console.log('  stub alive after LIST:', ping ? `yes (HEAD ${ping.status})` : 'NO — stub died on this LIST');
  }
} finally {
  await stub.stop();
  rmSync(DIR, { recursive: true, force: true });
}
