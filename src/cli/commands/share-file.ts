import { formatFileSize } from '../../features/secret-files/format-file-size.ts';
import { uploadLocalFile } from '../files/upload-local-file.ts';
import type { LocalFile } from '../io/local-files.ts';
import { succeeded, type Outcome } from '../outcome.ts';
import type { CommandContext } from './command.ts';
import { printIssuedLink } from './print-issued-link.ts';
import { withClient } from './with-client.ts';

const progressLine = (file: LocalFile, sent: number): string =>
  `Uploading ${file.name}: ${String(Math.floor((sent / file.size) * 100))}% of ${formatFileSize(file.size)}`;

/* `share --file <path>` (secret-files AC-5.1): the session is opened on the
   account (its link lifetime applies), the parts need only the upload id.
   Progress goes to stderr so stdout carries nothing but the link lines. */
export const shareFile = (context: CommandContext, path: string): Promise<Outcome> =>
  withClient(context, async (client) => {
    const { serverUrl = '' } = await context.config.read();
    const uploaded = await uploadLocalFile(
      {
        files: context.files,
        begin: (file) => client.beginFile(file.name, file.size, file.contentType),
        parts: context.createPublicClient(serverUrl),
        onProgress: (file, sent) => context.io.printError(progressLine(file, sent)),
      },
      path,
    );
    if (!uploaded.ok) {
      return uploaded.error;
    }
    printIssuedLink(context.io, uploaded.value.link);
    return succeeded;
  });
