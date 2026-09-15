const isForm = (target: unknown): target is HTMLFormElement => target instanceof HTMLFormElement;

/* Reads a named field from the form that dispatched a submit event. */
export const readFormField = (event: Event, name: string): string =>
  String(new FormData([event.currentTarget].find(isForm)).get(name) ?? '');
