import { matchResult } from '../../../features/result/match-result.ts';
import { fileIntro, IDLE, uploadFile, type FileUploadDeps } from './upload-file.ts';

/* The signed-in share form's file: the account's lifetime applies. */
export const shareFile =
  (deps: FileUploadDeps) =>
  async (file: File): Promise<void> =>
    matchResult(
      await uploadFile(deps, file, () => deps.api.beginFile(file.name, file.size, file.type)),
      (link) => deps.store.patch({ notice: { kind: 'link', intro: fileIntro(file), link }, file: undefined, error: undefined }),
      (error) => deps.store.patch({ notice: IDLE, error }),
    );
