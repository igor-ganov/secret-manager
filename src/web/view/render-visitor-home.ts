import type { AppState } from '../state/app-state.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { renderAccountCard } from './render-account-card.ts';
import { renderError } from './render-error.ts';
import { renderNotice } from './render-notice.ts';
import { renderQuickStart } from './render-quick-start.ts';

/* Signed-out front page: the quick start first, the account as an option. */
export const renderVisitorHome = (h: H, actions: Actions, state: AppState): readonly Node[] => [
  h('header', {}, h('h1', {}, 'Secret manager')),
  renderQuickStart(h, actions, state.quickDraft, state.quickTtlMinutes),
  renderNotice(h, actions, state.notice),
  h('p', { attrs: { class: 'toast', 'aria-live': 'polite' } }, state.toast),
  ...renderError(h, state.error),
  renderAccountCard(h, actions),
];
