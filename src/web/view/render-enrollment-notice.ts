import type { EnrollmentResponse } from '../../features/http-api/api-types.ts';
import type { Actions } from './actions.ts';
import { copyButton } from './copy-button.ts';
import type { H } from './h.ts';

/* The QR is an <img> with a data url: nothing is injected as markup. */
export const renderEnrollmentNotice = (h: H, actions: Actions, enrollment: EnrollmentResponse): readonly Node[] => [
  h('p', {}, 'Open this link on the new device, or scan the code with it. Valid for 10 minutes, once.'),
  h('pre', {}, enrollment.url),
  h('img', { attrs: { src: enrollment.qr, alt: 'QR code of the enrollment link', class: 'qr' } }),
  h('div', { attrs: { class: 'actions' } }, copyButton(h, actions, 'Copy link', enrollment.url)),
];
