export interface Env { VVU_BASE?: string }
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
export function health(service: string): Response { return json({ ok: true, service, ts: Date.now() }); }
export function metrics(service: string, data: Record<string, unknown>): Response { return json({ ok: true, service, metrics: data, ts: Date.now() }); }
export function handleOptions(): Response { return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } }); }
