import type { Route } from '../state/app-state.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { renderRecoveryForm } from './render-recovery-form.ts';

const INTRO = 'Share secrets through one-time links and keep key/value pairs. Your account lives here, secured by a passkey; the Telegram bot and the console utility are devices you approve from this site.';
const HINT = 'Your browser looks for a passkey of this site and signs you in. Without one, an account is created on this device.';
const NO_PASSKEY = 'No passkey was used. If you have no account yet, create one on this device; otherwise try again on the device that holds your passkey, or use a recovery code below.';

const BANNER: Readonly<Record<Route['kind'], (h: H) => readonly Node[]>> = {
  home: () => [],
  enroll: () => [],
  link: (h) => [h('p', { attrs: { class: 'banner' } }, 'A device is asking for access. Continue to review and approve it.')],
};

/* Offered only after a passkey prompt ended without a login, so a dismissed
   prompt never silently becomes a second account. */
const FALLBACK: Readonly<Record<`${boolean}`, (h: H, actions: Actions) => readonly Node[]>> = {
  false: () => [],
  true: (h, actions) => [
    h('p', { attrs: { class: 'muted', role: 'status' } }, NO_PASSKEY),
    h('button', { attrs: { type: 'button', class: 'secondary' }, on: { click: () => void actions.signUp() } }, 'Create a new account on this device'),
  ],
};

export const renderLoginCard = (h: H, actions: Actions, route: Route, loginAttempted: boolean): readonly Node[] => [
  h('header', {}, h('h1', {}, 'Secret manager')),
  ...BANNER[route.kind](h),
  h(
    'section',
    { attrs: { 'aria-labelledby': 'continue-heading' } },
    h('h2', { attrs: { id: 'continue-heading' } }, 'Continue'),
    h('p', {}, INTRO),
    h('p', { attrs: { class: 'muted' } }, HINT),
    h('button', { attrs: { type: 'button' }, on: { click: () => void actions.continueWithPasskey() } }, 'Continue with passkey'),
    ...FALLBACK[`${loginAttempted}`](h, actions),
  ),
  renderRecoveryForm(h, actions),
];
