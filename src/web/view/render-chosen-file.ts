import { formatFileSize } from '../../features/secret-files/format-file-size.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';

/* A chosen file stands in for the text field until it is removed. */
export const renderChosenFile = (h: H, actions: Actions, file: File): readonly Node[] => [
  h(
    'div',
    { attrs: { class: 'file-chip' } },
    h('span', { attrs: { class: 'key' } }, `${file.name} (${formatFileSize(file.size)})`),
    h('button', { attrs: { type: 'button', class: 'secondary small', 'data-autofocus': '' }, on: { click: () => actions.removeFile() } }, 'Remove file'),
  ),
];
