import { InlineKeyboard, Keyboard } from 'grammy';
import { buildCallbackData } from './callback-data.ts';

export const LIST_BUTTON_LABEL = 'List';

export const mainKeyboard = new Keyboard().text(LIST_BUTTON_LABEL).resized().persistent();

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
