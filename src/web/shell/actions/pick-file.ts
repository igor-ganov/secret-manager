import { isValidFileSize } from '../../../features/secret-files/file-limits.ts';
import type { AppState } from '../../state/app-state.ts';
import type { Store } from '../../state/create-store.ts';

export type PickFileDeps = { readonly store: Store<AppState> };

const REFUSALS: Readonly<Record<`${boolean}`, string>> = {
  true: 'The file is empty.',
  false: 'The file is larger than 100 MiB.',
};

type Choice = (store: Store<AppState>, file: File, draft: string) => void;

/* The size is checked before anything is sent (secret-files AC-4.2); the text
   typed so far rides along so the re-render keeps it. */
const CHOICES: Readonly<Record<`${boolean}`, Choice>> = {
  true: (store, file, draft) => store.patch({ file, quickDraft: draft, error: undefined }),
  false: (store, file, draft) => store.patch({ file: undefined, quickDraft: draft, error: REFUSALS[`${file.size === 0}`] }),
};

export const pickFile =
  ({ store }: PickFileDeps) =>
  (file: File, draft: string): void =>
    CHOICES[`${isValidFileSize(file.size)}`](store, file, draft);

export const removeFile =
  ({ store }: PickFileDeps) =>
  (): void =>
    store.patch({ file: undefined });
