// scripts/s3-signed-list-probe.mjs — R82 · fire ONE validly-signed LIST at a
// RUNNING stub (default: the UI proof stub on :9105) and report whether the
// stub survives. Isolates the "stub dies on signed LIST" crash.
import { createHash, createHmac } from 'node:crypto';

const PORT = Number(process.argv[2] ?? 9105);
const AK = process.argv[3] ?? 'ui-proof-akid';
const SK = process.argv[4] ?? 'ui-proof-secret';
const BUCKET = process.argv[5] ?? 'vvu-ui-bucket';
const PATHQ = process.argv[6] ?? `/${BUCKET}/?list-type=2&prefix=${encodeURIComponent('vvu-anchors/')}`;

function sign(method, pathAndQuery, secret, when) {
  const dateStamp = when.slice(0, 8);
  const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
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

const when = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const res = await fetch(`http://127.0.0.1:${PORT}${PATHQ}`, {
  method: 'GET',
  headers: {
    Authorization: sign('GET', PATHQ, SK, when),
    'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'x-amz-date': when,
  },
});
console.log('signed LIST status:', res.status);
console.log('body:', (await res.text()).slice(0, 300));
const ping = await fetch(`http://127.0.0.1:${PORT}/${BUCKET}/ping-after-list`, { method: 'HEAD' }).catch((e) => null);
console.log('stub alive after LIST:', ping ? `yes (HEAD ${ping.status})` : 'NO — stub died on the signed LIST');
