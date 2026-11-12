import { json, health, metrics, handleOptions, type Env } from '../../_shared/worker';
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return handleOptions();
    if (url.pathname === '/health' || url.pathname === '/healthz') return health('mesh-demo');
    if (url.pathname === '/metrics') return metrics('mesh-demo', { uptime: Date.now(), requests: 0, status: 'healthy' });
    if (url.pathname === '/' || url.pathname === '/status') return json({ ok: true, service: 'mesh-demo', status: 'healthy', ts: Date.now() });
    return json({ ok: false, error: 'not found' }, 404);
  },
};
