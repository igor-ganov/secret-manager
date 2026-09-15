import type { ActionDeps } from '../action-deps.ts';

const COPIED = 'Copied to clipboard.';
const FAILED = 'Copying failed — select the text and copy it by hand.';

export const copy =
  ({ clipboard, store }: ActionDeps) =>
  (text: string): Promise<void> =>
    clipboard(text).then(
      () => store.patch({ toast: COPIED }),
      () => store.patch({ toast: FAILED }),
    );
