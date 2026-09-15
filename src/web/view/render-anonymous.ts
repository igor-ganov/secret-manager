import { buildTelegramLoginUrl } from '../auth/build-telegram-login-url.ts';
import type { H } from './h.ts';

export const renderAnonymous = (h: H, botId: number, origin: string): readonly Node[] => [
  h('header', {}, h('h1', {}, 'Secret manager')),
  h(
    'section',
    {},
    h('p', {}, 'Share secrets through one-time links and keep key/value pairs, exactly like the Telegram bot — same account, same storage.'),
    h('p', { attrs: { class: 'muted' } }, 'Log in with the Telegram account you use with the bot.'),
    h('a', { attrs: { class: 'button', href: buildTelegramLoginUrl(botId, origin) } }, 'Log in with Telegram'),
  ),
];
