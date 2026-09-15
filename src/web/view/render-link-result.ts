import type { IssuedLinkResponse } from '../../features/http-api/api-types.ts';
import type { Actions } from './actions.ts';
import { copyButton } from './copy-button.ts';
import type { H } from './h.ts';

/* Same three lines the bot sends: url, curl snippet, lifetime. */
export const renderLinkResult = (
  h: H,
  actions: Actions,
  intro: string,
  link: IssuedLinkResponse,
): readonly Node[] => [
  h('p', {}, intro),
  h('pre', {}, link.url),
  h('pre', {}, link.curl),
  h('p', { attrs: { class: 'muted' } }, `Valid for ${link.ttlMinutes} minutes, opens once.`),
  h(
    'div',
    { attrs: { class: 'actions' } },
    copyButton(h, actions, 'Copy link', link.url),
    copyButton(h, actions, 'Copy curl', link.curl),
  ),
];
