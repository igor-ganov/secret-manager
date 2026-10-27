import type { Actions } from './actions.ts';
import { pickFirstFile } from './pick-first-file.ts';

const isDragEvent = (event: Event): event is DragEvent => event instanceof DragEvent;

const droppedFiles = (event: Event): readonly File[] =>
  [event].filter(isDragEvent).flatMap((drag) => [...(drag.dataTransfer?.files ?? [])]);

const preventDefault: EventListener = (event) => event.preventDefault();

/* A form that accepts a file dropped anywhere on it (secret-files AC-4.1);
   `dragover` must be cancelled for the browser to allow the drop. */
export const fileDropHandlers = (actions: Actions): Readonly<Record<string, EventListener>> => {
  const pick = pickFirstFile(actions, droppedFiles);
  return {
    dragover: preventDefault,
    drop: (event) => {
      event.preventDefault();
      pick(event);
    },
  };
};
