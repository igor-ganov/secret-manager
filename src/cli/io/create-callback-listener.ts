export type CallbackListener = {
  readonly callbackUrl: string;
  /* Resolves with the grant the browser brought back. */
  readonly grant: Promise<string>;
  readonly close: () => void;
};

const CALLBACK_PATH = '/callback';
/* Grants are short lowercase codes; anything else is not echoed into HTML. */
const GRANT_SHAPE = /^[a-z0-9-]{1,16}$/;

const page = (grant: string): string => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Secret manager</title>
<style>body{font-family:system-ui,sans-serif;background:#111;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0}main{text-align:center;max-width:32rem;padding:2rem}pre{background:#222;padding:1rem;border-radius:.5rem;font-size:1.4rem;user-select:all}p{color:#999}</style>
</head><body><main><h1>Device linked</h1><p>The console continues on its own; you can close this window.</p>
<p>If it did not, type this code there:</p><pre>${grant}</pre></main></body></html>`;

/* One-shot loopback listener the browser is redirected to after approval;
   a random port, only 127.0.0.1, and it stops as soon as the grant arrives.
   The page repeats the fallback code, so it is visible even if the console
   window was closed meanwhile. */
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
      if (url.pathname !== CALLBACK_PATH || !GRANT_SHAPE.test(received)) {
        return new Response('Not found', { status: 404 });
      }
      settle(received);
      return new Response(page(received), { headers: { 'content-type': 'text/html; charset=utf-8' } });
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
