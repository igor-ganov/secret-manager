import type { Actions } from './actions.ts';
import type { H } from './h.ts';

type Row = (h: H, actions: Actions) => readonly Node[];

const BY_LINKED: Readonly<Record<`${boolean}`, Row>> = {
  true: (h, actions) => [
    h('span', {}, 'Telegram bot chat ', h('span', { attrs: { class: 'muted' } }, '· linked')),
    h(
      'button',
      { attrs: { type: 'button', class: 'small danger' }, on: { click: () => void actions.unlinkTelegram() } },
      'Unlink Telegram',
    ),
  ],
  false: (h) => [
    h('span', {}, 'Telegram bot chat ', h('span', { attrs: { class: 'muted' } }, '· not linked')),
    h('span', { attrs: { class: 'muted' } }, 'Send /start to the bot and approve the link it replies with.'),
  ],
};

export const renderTelegramRow = (h: H, actions: Actions, linked: boolean): HTMLElement =>
  h('li', {}, ...BY_LINKED[`${linked}`](h, actions));
