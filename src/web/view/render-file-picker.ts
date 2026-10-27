import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { pickFirstFile } from './pick-first-file.ts';

export const FILE_INPUT_ID = 'file-input';
const HINT_ID = 'file-hint';
const HINT = 'Or drop a file onto this form. Up to 100 MiB; the link opens once, like a text secret.';

const isInput = (target: unknown): target is HTMLInputElement => target instanceof HTMLInputElement;

const filesOfInput = (input: HTMLInputElement): readonly File[] => [...(input.files ?? [])];

const chosenFiles = (event: Event): readonly File[] => [event.currentTarget].filter(isInput).flatMap(filesOfInput);

/* The native file input (keyboard and screen readers know it); what it picks
   goes to the state, because the next re-render empties the input. */
export const renderFilePicker = (h: H, actions: Actions): readonly Node[] => [
  h('label', { attrs: { for: FILE_INPUT_ID } }, 'Attach a file'),
  h('input', {
    attrs: { id: FILE_INPUT_ID, name: 'file', type: 'file', 'aria-describedby': HINT_ID },
    on: { change: pickFirstFile(actions, chosenFiles) },
  }),
  h('p', { attrs: { id: HINT_ID, class: 'muted' } }, HINT),
];
