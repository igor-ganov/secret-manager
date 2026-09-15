import { startApp } from './shell/start-app.ts';

void startApp({
  document: globalThis.document,
  fetchFn: (input, init) => globalThis.fetch(input, init),
  clipboard: (text) => globalThis.navigator.clipboard.writeText(text),
  location: globalThis.location,
  history: globalThis.history,
});
