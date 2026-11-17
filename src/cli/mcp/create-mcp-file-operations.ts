import type { Result } from '../../features/result/result.ts';
import type { PublicClient } from '../api/api-client.ts';
import type { LinkClient } from '../api/link-client.ts';
import { failureOutcome } from '../commands/to-outcome.ts';
import { receiveLink, type ReceivedLink } from '../files/receive-link.ts';
import { uploadLocalFile, type UploadedLocalFile } from '../files/upload-local-file.ts';
import type { LocalFiles } from '../io/local-files.ts';
import type { Outcome } from '../outcome.ts';
import type { FileToolDependencies } from './file-tools.ts';

const messageOf = (outcome: Outcome): string => (outcome.kind === 'error' ? outcome.message : '');

const asText = <T>(result: Result<T, Outcome>): Result<T, string> => (result.ok ? result : { ok: false, error: messageOf(result.error) });

/* The file tools over the real disk and server (secret-files US-6): drops are
   anonymous, like create_one_time_link; a fetch never overwrites a file. */
export const createMcpFileOperations = (
  client: PublicClient,
  files: LocalFiles,
  links: LinkClient,
): Pick<FileToolDependencies, 'dropFile' | 'fetchLink'> => ({
  dropFile: async (path, ttlMinutes): Promise<Result<UploadedLocalFile, string>> =>
    asText(
      await uploadLocalFile(
        { files, begin: (file) => client.dropFile(file.name, file.size, file.contentType, ttlMinutes), parts: client, onProgress: () => undefined },
        path,
      ),
    ),
  fetchLink: async (url, outPath): Promise<Result<ReceivedLink, string>> => {
    const path = files.resolve(outPath);
    if (await files.exists(path)) {
      return { ok: false, error: `${path} already exists; choose an outPath that does not.` };
    }
    const info = await links.peek(url);
    return info.ok ? asText(await receiveLink({ files, links }, url, info.value, path)) : { ok: false, error: messageOf(failureOutcome(info.error)) };
  },
});
