/**
 * Next.js native instrumentation.
 * The dynamic import ensures Node-only modules (process, crypto) are not
 * evaluated in the Edge runtime during build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const [capture, watchdog, reconciler] = await Promise.all([
      import('@/lib/debugger/server-capture'),
      import('@/server/proximity/watchdog'),
      import('@/server/safegrid/worker'),
    ]);
    capture.attachProcessCapture();
    const sentinel = watchdog.startProximityWatchdog();
    const safegrid = reconciler.startReconcilerWorker();
    console.info(
      `[vvu-boot] watchdog ${sentinel.killSwitch ? 'disabled by kill switch' : sentinel.started ? 'started' : 'already running'} · safegrid reconciler ${safegrid.started ? 'started' : 'already running'}`,
    );
  }
}

export async function onRequestError(
  req: Request,
  error: Error & { digest?: string },
  ctx: { routerKind: 'app' | 'pages'; routePath: string; routeType: 'render' | 'route' | 'action' },
) {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const mod = await import('@/lib/debugger/server-capture');
    await mod.captureRequestError(req, error, ctx);
  }
}
