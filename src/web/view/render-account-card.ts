import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { renderRecoveryForm } from './render-recovery-form.ts';

const INTRO = 'An account adds saved keys, a lifetime setting, devices, the Telegram bot and the console utility. Your passkey is the account; the bot and the utility are devices you approve from this site.';
const HINT = 'Your device looks for a passkey of this site and signs you in. Without one, it creates a passkey and your account in the same step.';

/* Opt-in (web-quick-start AC-2.1, AC-2.2): collapsed by default, and the
   passkey ceremony starts only from the button inside. */
export const renderAccountCard = (h: H, actions: Actions): HTMLElement =>
  h(
    'details',
    { attrs: { class: 'card' } },
    h('summary', {}, 'Account (optional)'),
    h('p', {}, INTRO),
    h('p', { attrs: { class: 'muted' } }, HINT),
    h('button', { attrs: { type: 'button' }, on: { click: () => void actions.continueWithPasskey() } }, 'Continue with passkey'),
    renderRecoveryForm(h, actions),
  );
