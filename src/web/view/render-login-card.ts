import type { Route } from '../state/app-state.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { onSubmit } from './on-submit.ts';
import { readFormField } from './read-form-field.ts';

const INTRO = 'Share secrets through one-time links and keep key/value pairs. Your account lives here, secured by a passkey; the Telegram bot and the console utility are devices you approve from this site.';

const BANNER: Readonly<Record<Route['kind'], (h: H) => readonly Node[]>> = {
  home: () => [],
  enroll: () => [],
  link: (h) => [h('p', { attrs: { class: 'banner' } }, 'A device is asking for access. Sign in to review and approve it.')],
};

export const renderLoginCard = (h: H, actions: Actions, route: Route): readonly Node[] => [
  h('header', {}, h('h1', {}, 'Secret manager')),
  ...BANNER[route.kind](h),
  h(
    'section',
    { attrs: { 'aria-labelledby': 'login-heading' } },
    h('h2', { attrs: { id: 'login-heading' } }, 'Sign in'),
    h('p', {}, INTRO),
    h('button', { attrs: { type: 'button' }, on: { click: () => void actions.logIn() } }, 'Log in with passkey'),
  ),
  h(
    'section',
    { attrs: { 'aria-labelledby': 'signup-heading' } },
    h('h2', { attrs: { id: 'signup-heading' } }, 'New here?'),
    h(
      'form',
      { on: { submit: onSubmit((event) => void actions.signUp(readFormField(event, 'name').trim())) } },
      h('label', { attrs: { for: 'account-name' } }, 'Account name'),
      h('input', { attrs: { id: 'account-name', name: 'name', type: 'text', required: '', autocomplete: 'off' } }),
      h('button', { attrs: { type: 'submit' } }, 'Create account'),
    ),
  ),
  h(
    'section',
    { attrs: { 'aria-labelledby': 'recovery-heading' } },
    h('h2', { attrs: { id: 'recovery-heading' } }, 'Lost every device?'),
    h(
      'form',
      { on: { submit: onSubmit((event) => void actions.recover(readFormField(event, 'code').trim())) } },
      h('label', { attrs: { for: 'recovery-code' } }, 'Recovery code'),
      h('input', { attrs: { id: 'recovery-code', name: 'code', type: 'text', required: '', autocomplete: 'off' } }),
      h('button', { attrs: { type: 'submit', class: 'secondary' } }, 'Recover with code'),
    ),
  ),
];
