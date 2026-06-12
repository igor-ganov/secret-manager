import { escapeHtml } from './escape-html.ts';

const renderPage = (title: string, body: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #111; color: #eee; }
  main { max-width: 40rem; padding: 2rem; text-align: center; }
  pre { background: #222; padding: 1rem; border-radius: .5rem; white-space: pre-wrap; word-break: break-all; font-size: 1.1rem; user-select: all; }
  p { color: #999; }
  button { font: inherit; font-size: 1.1rem; padding: .75rem 2rem; border: 0; border-radius: .5rem; background: #2563eb; color: #fff; cursor: pointer; }
  button:hover { background: #1d4ed8; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;

export const renderSecretPage = (value: string): string =>
  renderPage(
    'One-time secret',
    `<h1>Your secret</h1><pre>${escapeHtml(value)}</pre><p>This link has just been destroyed. Reloading the page will not show the secret again.</p>`,
  );

/* Revealing via POST keeps the secret safe from link-preview crawlers and
   safe-link scanners, which only ever issue GET requests. */
export const renderConfirmPage = (): string =>
  renderPage(
    'One-time secret',
    '<h1>One-time secret</h1><p>This link works exactly once. Press the button when you are ready to read the secret.</p><form method="post"><button type="submit">Reveal secret</button></form>',
  );

export const renderGonePage = (): string =>
  renderPage(
    'Link expired',
    '<h1>Nothing here</h1><p>This link has already been used or has expired.</p>',
  );
