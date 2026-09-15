import { createApiClient } from '../api/create-api-client.ts';
import { createJsonRequester, type FetchFn } from '../api/create-json-requester.ts';
import { describeBrowser } from '../auth/describe-browser.ts';
import { createStore } from '../state/create-store.ts';
import { initialState } from '../state/initial-state.ts';
import { parseRoute } from '../state/parse-route.ts';
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
  readonly userAgent: string;
};

const ROOT_SELECTOR = '#app';
const AUTOFOCUS_SELECTOR = '[data-autofocus]';

/* The only imperative shell: wires store → render, follows the fragment
   (device approvals, enrollment links) and runs the session probe. */
export const startApp = async (env: AppEnvironment): Promise<void> => {
  const { document, fetchFn, clipboard, location, history } = env;
  const root = document.querySelector(ROOT_SELECTOR) ?? document.body;
  const h = createH(document);
  const store = createStore(initialState);
  const deviceName = describeBrowser(env.userAgent);
  const actions = createActions({
    api: createApiClient(createJsonRequester(fetchFn)),
    store,
    clipboard,
    clearHash: () => clearHash(history, location),
    deviceName,
  });

  store.subscribe((state) => {
    root.replaceChildren(...renderApp(h, actions, state, deviceName));
    root.querySelector<HTMLElement>(AUTOFOCUS_SELECTOR)?.focus();
  });

  globalThis.addEventListener('hashchange', () => void actions.loadRoute(parseRoute(location.hash)));
  await actions.init(parseRoute(location.hash));
};
