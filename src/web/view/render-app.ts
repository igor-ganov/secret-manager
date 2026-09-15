import type { AppState } from '../state/app-state.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { renderAnonymous } from './render-anonymous.ts';
import { renderError } from './render-error.ts';
import { renderWorkspace } from './render-workspace.ts';

export const renderApp = (h: H, actions: Actions, state: AppState, origin: string): readonly Node[] => {
  const { session } = state;
  switch (session.kind) {
    case 'loading':
      return [h('h1', {}, 'Secret manager'), ...renderError(h, state.error), h('p', { attrs: { class: 'muted' } }, 'Loading…')];
    case 'anonymous':
      return [...renderAnonymous(h, session.botId, origin), ...renderError(h, state.error)];
    case 'signed-in':
      return renderWorkspace(h, actions, state, session.user, session.botId);
  }
};
