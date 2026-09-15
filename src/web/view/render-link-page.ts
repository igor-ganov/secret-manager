import type { LoginRequestInfoResponse } from '../../features/http-api/api-types.ts';
import type { Actions } from './actions.ts';
import { copyButton } from './copy-button.ts';
import type { H } from './h.ts';

const KIND_TEXT: Readonly<Record<LoginRequestInfoResponse['kind'], string>> = {
  cli: 'The console utility',
  telegram: 'A Telegram chat',
};

const waiting = (h: H, actions: Actions, code: string): readonly Node[] => [
  h('p', {}, 'Confirm with your passkey to approve the device that opened this link.'),
  h('button', { attrs: { type: 'button' }, on: { click: () => void actions.approveLink(code) } }, 'Continue with passkey'),
];

const APPROVED: Readonly<Record<LoginRequestInfoResponse['kind'], (h: H, actions: Actions, info: LoginRequestInfoResponse) => readonly Node[]>> = {
  cli: (h, actions, info) => [
    h('p', {}, `Approved: “${info.label}” can use your account.`),
    h('p', { attrs: { class: 'muted' } }, 'Returning to the console… If it did not continue, type this code there:'),
    h('pre', {}, info.grant),
    h('div', { attrs: { class: 'actions' } }, copyButton(h, actions, 'Copy code', info.grant)),
  ],
  telegram: (h, _actions, info) => [h('p', {}, `Approved: “${info.label}” is linked to your account. Go back to Telegram.`)],
};

const OUTCOME: Readonly<Record<LoginRequestInfoResponse['status'], (h: H, actions: Actions, info: LoginRequestInfoResponse, code: string) => readonly Node[]>> = {
  pending: (h, actions, _info, code) => waiting(h, actions, code),
  approved: (h, actions, info) => APPROVED[info.kind](h, actions, info),
  denied: (h) => [h('p', {}, 'This request was denied.')],
};

const body = (h: H, actions: Actions, code: string, info: LoginRequestInfoResponse | undefined): readonly Node[] => {
  switch (info) {
    case undefined:
      return waiting(h, actions, code);
    default:
      return OUTCOME[info.status](h, actions, info, code);
  }
};

/* Standalone page for `#link=<code>`: the ceremony starts on load; this is
   what the person sees meanwhile, afterwards, or after a dismissed prompt. */
export const renderLinkPage = (h: H, actions: Actions, code: string, info: LoginRequestInfoResponse | undefined): readonly Node[] => [
  h('header', {}, h('h1', {}, 'Secret manager')),
  h(
    'section',
    { attrs: { 'aria-labelledby': 'link-heading', class: 'highlight' } },
    h('h2', { attrs: { id: 'link-heading' } }, `${KIND_TEXT[info?.kind ?? 'cli']} asks for access`),
    ...body(h, actions, code, info),
  ),
];
