export type CallbackListener = {
  readonly callbackUrl: string;
  /* Resolves with the grant the browser brought back. */
  readonly grant: Promise<string>;
  readonly close: () => void;
};

const CALLBACK_PATH = '/callback';

const DONE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Secret manager</title>
<style>body{font-family:system-ui,sans-serif;background:#111;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0}main{text-align:center}</style>
</head><body><main><h1>Device linked</h1><p>You can close this window and return to the console.</p></main></body></html>`;

/* One-shot loopback listener the browser is redirected to after approval;
   a random port, only 127.0.0.1, and it stops as soon as the grant arrives. */
export const createCallbackListener = (): CallbackListener => {
  let settle: (grant: string) => void = () => undefined;
  const grant = new Promise<string>((resolve) => {
    settle = resolve;
  });

  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: (request) => {
      const url = new URL(request.url);
      const received = url.searchParams.get('grant') ?? '';
      if (url.pathname !== CALLBACK_PATH || received === '') {
        return new Response('Not found', { status: 404 });
      }
      settle(received);
      return new Response(DONE_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    },
  });

  return {
    callbackUrl: `http://127.0.0.1:${server.port}${CALLBACK_PATH}`,
    grant,
    close: () => {
      server.stop(true);
    },
  };
};
