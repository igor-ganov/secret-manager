import type { AppState, Route } from '../state/app-state.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { renderEnrollPage } from './render-enroll-page.ts';
import { renderError } from './render-error.ts';
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
      return [...renderLoginCard(h, actions, state.route, state.loginAttempted), ...renderError(h, state.error)];
    case 'signed-in':
      return renderWorkspace(h, actions, state, session.user, deviceName);
  }
};

type RouteRenderer = (context: ViewContext, state: AppState, route: Route) => readonly Node[];

/* An enrollment link is for the device that opened it, whatever session it
   already has; every other route goes through the session switch. */
const BY_ROUTE: Readonly<Record<Route['kind'], RouteRenderer>> = {
  home: bySession,
  link: bySession,
  enroll: ({ h, actions }, state, route) => {
    switch (route.kind) {
      case 'enroll':
        return [...renderEnrollPage(h, actions, route.code, state.enrollmentInfo), ...renderError(h, state.error)];
      case 'home':
      case 'link':
        return bySession({ h, actions, deviceName: '' }, state);
    }
  },
};

export const renderApp = (h: H, actions: Actions, state: AppState, deviceName = 'This browser'): readonly Node[] =>
  BY_ROUTE[state.route.kind]({ h, actions, deviceName }, state, state.route);
