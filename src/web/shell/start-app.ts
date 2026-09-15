import { createApiClient } from '../api/create-api-client.ts';
import { createJsonRequester, type FetchFn } from '../api/create-json-requester.ts';
import { parseTgAuthResult } from '../auth/parse-tg-auth-result.ts';
import { createStore } from '../state/create-store.ts';
import { initialState } from '../state/initial-state.ts';
import { createH } from '../view/h.ts';
import { renderApp } from '../view/render-app.ts';
import { clearHash } from './clear-hash.ts';
import { createActions } from './create-actions.ts';

export type AppEnvironment = {
  readonly document: Document;
  readonly fetchFn: FetchFn;
  readonly clipboard: (text: string) => Promise<void>;
  readonly location: Location;
  readonly history: History;
};

const ROOT_SELECTOR = '#app';
const AUTOFOCUS_SELECTOR = '[data-autofocus]';

/* The only imperative shell: wires store → render, then runs the two
   start-up actions (session probe, Telegram callback). */
export const startApp = async ({ document, fetchFn, clipboard, location, history }: AppEnvironment): Promise<void> => {
  const root = document.querySelector(ROOT_SELECTOR) ?? document.body;
  const h = createH(document);
  const store = createStore(initialState);
  const actions = createActions({ api: createApiClient(createJsonRequester(fetchFn)), store, clipboard });

  store.subscribe((state) => {
    root.replaceChildren(...renderApp(h, actions, state, location.origin));
    root.querySelector<HTMLElement>(AUTOFOCUS_SELECTOR)?.focus();
  });

  const payload = parseTgAuthResult(location.hash);
  clearHash(history, location);
  await actions.init();
  await actions.completeLogin(payload);
};
