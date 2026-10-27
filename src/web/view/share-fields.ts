import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { readFormField } from './read-form-field.ts';
import { renderChosenFile } from './render-chosen-file.ts';

const textFields = (h: H): readonly Node[] => [
  h('label', { attrs: { for: 'share-key' } }, 'Key (optional)'),
  h('input', {
    attrs: { id: 'share-key', name: 'key', type: 'text', autocomplete: 'off', spellcheck: 'false' },
  }),
  h('label', { attrs: { for: 'share-value' } }, 'Value'),
  h('textarea', {
    attrs: { id: 'share-value', name: 'value', required: '', autocomplete: 'off', spellcheck: 'false' },
  }),
  h('p', { attrs: { class: 'muted' } }, 'With a key the pair is saved to your account; without one only the link is created.'),
];

/* Key and value, or the chosen file (never saved, only linked). */
export const shareFields = (h: H, actions: Actions, file: File | undefined): readonly Node[] => {
  switch (file) {
    case undefined:
      return textFields(h);
    default:
      return renderChosenFile(h, actions, file);
  }
};

export const shareSubmit = (actions: Actions, file: File | undefined): ((event: Event) => void) => {
  switch (file) {
    case undefined:
      return (event) => void actions.share(readFormField(event, 'key').trim(), readFormField(event, 'value'));
    default:
      return () => void actions.shareFile(file);
  }
};
