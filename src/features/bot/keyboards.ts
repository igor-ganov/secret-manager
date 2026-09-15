import { InlineKeyboard } from 'grammy';
import { TTL_PRESETS_MINUTES } from '../settings/ttl-presets.ts';
import { buildCallbackData } from './callback-data.ts';

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
