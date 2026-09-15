import type { EnrollmentInfoResponse } from '../../features/http-api/api-types.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { onSubmit } from './on-submit.ts';
import { readFormField } from './read-form-field.ts';

const GONE = 'This link has expired or was already used. Ask for a new one from a signed-in device or from the bot with /device.';

const form = (h: H, actions: Actions, code: string, info: EnrollmentInfoResponse): readonly Node[] => [
  h('p', {}, `Add a passkey on this device for the account “${info.accountName}”.`),
  h(
    'form',
    { on: { submit: onSubmit((event) => void actions.enrollHere(code, readFormField(event, 'label').trim() || 'New device')) } },
    h('label', { attrs: { for: 'device-label' } }, 'Device name'),
    h('input', { attrs: { id: 'device-label', name: 'label', type: 'text', autocomplete: 'off' } }),
    h('button', { attrs: { type: 'submit' } }, 'Add passkey on this device'),
  ),
];

const body = (h: H, actions: Actions, code: string, info: EnrollmentInfoResponse | undefined): readonly Node[] => {
  switch (info) {
    case undefined:
      return [h('p', {}, GONE)];
    default:
      return form(h, actions, code, info);
  }
};

export const renderEnrollPage = (
  h: H,
  actions: Actions,
  code: string,
  info: EnrollmentInfoResponse | undefined,
): readonly Node[] => [
  h('header', {}, h('h1', {}, 'Secret manager')),
  h(
    'section',
    { attrs: { 'aria-labelledby': 'enroll-heading' } },
    h('h2', { attrs: { id: 'enroll-heading' } }, 'Add this device'),
    ...body(h, actions, code, info),
  ),
];
