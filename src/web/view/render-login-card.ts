import type { Route } from '../state/app-state.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { renderRecoveryForm } from './render-recovery-form.ts';

const INTRO = 'Share secrets through one-time links and keep key/value pairs. Your account lives here, secured by a passkey; the Telegram bot and the console utility are devices you approve from this site.';
const HINT = 'Your device looks for a passkey of this site and signs you in. Without one, it creates a passkey and your account in the same step.';

const BANNER: Readonly<Record<Route['kind'], (h: H) => readonly Node[]>> = {
  home: () => [],
  enroll: () => [],
  link: (h) => [h('p', { attrs: { class: 'banner' } }, 'A device is asking for access. Continue to review and approve it.')],
};

export const renderLoginCard = (h: H, actions: Actions, route: Route): readonly Node[] => [
  h('header', {}, h('h1', {}, 'Secret manager')),
  ...BANNER[route.kind](h),
  h(
    'section',
    { attrs: { 'aria-labelledby': 'continue-heading' } },
    h('h2', { attrs: { id: 'continue-heading' } }, 'Continue'),
    h('p', {}, INTRO),
    h('p', { attrs: { class: 'muted' } }, HINT),
    h('button', { attrs: { type: 'button' }, on: { click: () => void actions.continueWithPasskey() } }, 'Continue with passkey'),
  ),
  renderRecoveryForm(h, actions),
];
