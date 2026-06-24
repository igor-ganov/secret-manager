import { InlineKeyboard } from 'grammy';
import { buildCallbackData } from './callback-data.ts';

/* Offered link lifetimes, in minutes; 1440 is one day. Discrete presets keep
   the choice unambiguous so a typed number is never mistaken for a secret. */
export const TTL_PRESETS_MINUTES = [1, 5, 15, 30, 60, 1440] as const;

export const buildSettingsKeyboard = (currentMinutes: number): InlineKeyboard =>
  TTL_PRESETS_MINUTES.reduce((keyboard, minutes, index) => {
    const label = `${minutes === currentMinutes ? '✓ ' : ''}${minutes} min`;
    keyboard.text(label, buildCallbackData({ kind: 'set-ttl', minutes }));
    return (index + 1) % 3 === 0 ? keyboard.row() : keyboard;
  }, new InlineKeyboard());

export const buildListKeyboard = (keys: readonly string[]): InlineKeyboard =>
  keys.reduce(
    (keyboard, key) =>
      keyboard
        .text(`🔑 ${key}`, buildCallbackData({ kind: 'noop' }))
        .text('get', buildCallbackData({ kind: 'get', key }))
        .text('set', buildCallbackData({ kind: 'set', key }))
        .text('✕', buildCallbackData({ kind: 'delete-request', key }))
        .row(),
    new InlineKeyboard(),
  );

export const buildCancelSetKeyboard = (): InlineKeyboard =>
  new InlineKeyboard().text('Cancel', buildCallbackData({ kind: 'cancel-set' }));

export const buildDeleteConfirmKeyboard = (key: string): InlineKeyboard =>
  new InlineKeyboard()
    .text('Yes, delete', buildCallbackData({ kind: 'delete-confirm', key }))
    .text('Cancel', buildCallbackData({ kind: 'cancel-delete' }));
