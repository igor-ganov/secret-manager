import type { AppState, Route } from '../state/app-state.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { renderEnrollPage } from './render-enroll-page.ts';
import { renderError } from './render-error.ts';
import { renderLinkPage } from './render-link-page.ts';
import { renderLoginCard } from './render-login-card.ts';
import { renderWorkspace } from './render-workspace.ts';

export type ViewContext = {
  readonly h: H;
  readonly actions: Actions;
  readonly deviceName: string;
};

const bySession = ({ h, actions, deviceName }: ViewContext, state: AppState): readonly Node[] => {
  const { session } = state;
  switch (session.kind) {
    case 'loading':
      return [h('h1', {}, 'Secret manager'), ...renderError(h, state.error), h('p', { attrs: { class: 'muted' } }, 'Loading…')];
    case 'anonymous':
      return [...renderLoginCard(h, actions), ...renderError(h, state.error)];
    case 'signed-in':
      return renderWorkspace(h, actions, state, session.user, deviceName);
  }
};

type RouteRenderer = (context: ViewContext, state: AppState, route: Route) => readonly Node[];

const withCode =
  (render: (context: ViewContext, state: AppState, code: string) => readonly Node[]): RouteRenderer =>
  (context, state, route) => {
    switch (route.kind) {
      case 'home':
        return bySession(context, state);
      case 'enroll':
      case 'link':
        return render(context, state, route.code);
    }
  };

/* Link and enrollment pages stand on their own, whatever session exists. */
const BY_ROUTE: Readonly<Record<Route['kind'], RouteRenderer>> = {
  home: bySession,
  enroll: withCode(({ h, actions }, state, code) => [...renderEnrollPage(h, actions, code, state.enrollmentInfo), ...renderError(h, state.error)]),
  link: withCode(({ h, actions }, state, code) => [...renderLinkPage(h, actions, code, state.linkInfo), ...renderError(h, state.error)]),
};

export const renderApp = (h: H, actions: Actions, state: AppState, deviceName = 'This browser'): readonly Node[] =>
  BY_ROUTE[state.route.kind]({ h, actions, deviceName }, state, state.route);
