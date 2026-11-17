import type { IssuedLinkResponse, UploadTicketResponse } from '../../../features/http-api/api-types.ts';
import type { Result } from '../../../features/result/result.ts';
import { uploadInParts, type Bytes } from '../../../features/secret-files/upload-in-parts.ts';
import type { FileApi } from '../../api/file-api.ts';
import type { AppState, Notice } from '../../state/app-state.ts';
import type { Store } from '../../state/create-store.ts';

export type FileUploadDeps = {
  readonly api: FileApi;
  readonly store: Store<AppState>;
};

export const IDLE: Notice = { kind: 'idle' };

/* Files are never saved to the account, whoever sends them. */
export const fileIntro = (file: File): string => `One-time link to “${file.name}” (nothing was saved):`;

const readRange =
  (file: File) =>
  async (start: number, end: number): Promise<Bytes> =>
    new Uint8Array(await file.slice(start, end).arrayBuffer());

/* The shared upload algorithm with the browser's file and a progress notice
   in the status region after every part (secret-files AC-4.3). */
export const uploadFile = (
  { api, store }: FileUploadDeps,
  file: File,
  begin: () => Promise<Result<UploadTicketResponse>>,
): Promise<Result<IssuedLinkResponse>> =>
  uploadInParts({ begin, putPart: api.putPart, complete: api.completeUpload, abort: api.abortUpload }, readRange(file), file.size, (sent) =>
    store.patch({ notice: { kind: 'upload', name: file.name, sent, total: file.size }, error: undefined }),
  );
