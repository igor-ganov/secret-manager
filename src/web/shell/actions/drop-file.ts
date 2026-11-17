import { matchResult } from '../../../features/result/match-result.ts';
import { fileIntro, IDLE, uploadFile, type FileUploadDeps } from './upload-file.ts';

export type { FileUploadDeps } from './upload-file.ts';

/* The quick start's file: an anonymous drop with the chosen lifetime. On
   failure the upload was aborted and the file stays chosen (AC-4.4). */
export const dropFile =
  (deps: FileUploadDeps) =>
  async (file: File, ttlMinutes: number): Promise<void> =>
    matchResult(
      await uploadFile(deps, file, () => deps.api.dropFile(file.name, file.size, file.type, ttlMinutes)),
      (link) =>
        deps.store.patch({ notice: { kind: 'link', intro: fileIntro(file), link }, file: undefined, quickTtlMinutes: ttlMinutes, error: undefined }),
      (error) => deps.store.patch({ notice: IDLE, error, quickTtlMinutes: ttlMinutes }),
    );
