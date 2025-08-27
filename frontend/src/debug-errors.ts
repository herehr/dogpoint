if (typeof window !== 'undefined') {
  const stamp = () =>
    new Date().toISOString() + ' | ' + location.href + ' | ' + navigator.userAgent;

  window.addEventListener('error', (e) => {
    // eslint-disable-next-line no-console
    console.error('[window.error]', stamp(), {
      message: e.message,
      file: e.filename,
      line: e.lineno,
      col: e.colno,
      stack: e.error?.stack
    });
  });

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const r: any = e.reason;
    // eslint-disable-next-line no-console
    console.error('[unhandledrejection]', stamp(), {
      message: r?.message ?? String(r),
      stack: r?.stack
    });
  });

  // quick env visibility for us
  (window as any).__APP_CHECK__ = {
    VITE_API_BASE_URL: (import.meta as any).env?.VITE_API_BASE_URL
  };
}
export {};
