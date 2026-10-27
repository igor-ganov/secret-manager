import type { Actions } from './actions.ts';

const isElement = (target: unknown): target is Element => target instanceof Element;
const isTextArea = (element: unknown): element is HTMLTextAreaElement => element instanceof HTMLTextAreaElement;

/* The quick start's typed text, so choosing a file does not lose it. */
const draftOf = (event: Event): string =>
  [event.currentTarget]
    .filter(isElement)
    .map((element) => element.closest('form')?.querySelector('[name="secret"]'))
    .filter(isTextArea)
    .map((field) => field.value)[0] ?? '';

/* Hands the first file an event carries (input change or drop) to the
   state; one file per link. */
export const pickFirstFile =
  (actions: Actions, filesOf: (event: Event) => readonly File[]): EventListener =>
  (event) =>
    filesOf(event)
      .slice(0, 1)
      .forEach((file) => actions.pickFile(file, draftOf(event)));
