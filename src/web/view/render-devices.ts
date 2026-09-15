import type { DevicesResponse } from '../../features/http-api/api-types.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { onSubmit } from './on-submit.ts';
import { readFormField } from './read-form-field.ts';
import { renderPasskeyRow } from './render-passkey-row.ts';
import { renderTelegramRow } from './render-telegram-row.ts';
import { renderTokenRow } from './render-token-row.ts';

const heading = (h: H, text: string): HTMLElement => h('h3', {}, text);

export const renderDevices = (h: H, actions: Actions, devices: DevicesResponse, deviceName: string): HTMLElement =>
  h(
    'section',
    { attrs: { 'aria-labelledby': 'devices-heading' } },
    h('h2', { attrs: { id: 'devices-heading' } }, 'Devices'),
    heading(h, 'Passkeys'),
    h('ul', {}, ...devices.passkeys.map((passkey) => renderPasskeyRow(h, actions, passkey, devices.passkeys.length <= 1))),
    h(
      'form',
      { attrs: { class: 'inline' }, on: { submit: onSubmit((event) => void actions.addPasskeyHere(readFormField(event, 'label').trim() || deviceName)) } },
      h('label', { attrs: { for: 'passkey-label' } }, 'Passkey name'),
      h('input', { attrs: { id: 'passkey-label', name: 'label', type: 'text', autocomplete: 'off', placeholder: deviceName } }),
      h('button', { attrs: { type: 'submit', class: 'secondary' } }, 'Add a passkey here'),
    ),
    h('p', { attrs: { class: 'muted' } }, 'On another phone or computer: open a one-time link there or scan the QR code.'),
    h('button', { attrs: { type: 'button' }, on: { click: () => void actions.createEnrollment() } }, 'Add a device'),
    heading(h, 'Telegram'),
    h('ul', {}, renderTelegramRow(h, actions, devices.telegram.linked)),
    heading(h, 'Sessions and console logins'),
    h('ul', {}, ...devices.tokens.map((token) => renderTokenRow(h, actions, token))),
  );
