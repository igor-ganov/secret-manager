import type { LinkInfoResponse } from '../../features/http-api/api-types.ts';
import { formatFileSize } from '../../features/secret-files/format-file-size.ts';
import { freePath, safeFileName } from '../files/free-path.ts';
import { receiveLink } from '../files/receive-link.ts';
import { EXIT, failed, succeeded, type Outcome } from '../outcome.ts';
import type { Command, CommandContext } from './command.ts';
import { toOutcome } from './to-outcome.ts';

const USAGE = 'Usage: fetch <link> [-o <path>]';
const TEXT_ON_TERMINAL =
  'This link holds a text secret and would be shown on screen. Pipe the output (secret fetch <link> | …) or use -o <path>; the link is still valid.';

/* A text value goes to the pipe, never onto a terminal (secret-files AC-5.3);
   the refusal comes before the link is opened, so it stays valid. */
const printText = async (context: CommandContext, url: string): Promise<Outcome> => {
  if (context.stdoutIsTerminal) {
    return failed(TEXT_ON_TERMINAL, EXIT.usage);
  }
  return toOutcome(await context.links.open(url), (payload) => {
    context.io.print(payload.kind === 'text' ? payload.value : '');
    return succeeded;
  });
};

const targetOf = (context: CommandContext, info: LinkInfoResponse, out: string | undefined): Promise<string> =>
  out === undefined ? freePath(context.files, safeFileName(info.kind === 'file' ? info.name : 'secret.txt')) : Promise.resolve(context.files.resolve(out));

const save = async (context: CommandContext, url: string, info: LinkInfoResponse, out: string | undefined): Promise<Outcome> => {
  const received = await receiveLink(context, url, info, await targetOf(context, info, out));
  if (!received.ok) {
    return received.error;
  }
  const { path, name, sizeBytes } = received.value;
  context.io.print(info.kind === 'file' ? `Saved ${name} (${formatFileSize(sizeBytes)}) to ${path}` : `Saved the text secret to ${path}`);
  return succeeded;
};

/* Opens a one-time link from any server without logging in (AC-5.2–5.4):
   it asks what the link holds first, then decides where the content goes. */
export const fetchLink: Command = {
  name: 'fetch',
  usage: 'fetch <link> [-o <path>]',
  description: 'Open a one-time link: save a file (own name, never overwriting) or pipe a text value',
  run: async (context, [url, flag, out]) => {
    if (url === undefined || (flag !== undefined && (flag !== '-o' || out === undefined))) {
      return failed(USAGE, EXIT.usage);
    }
    return toOutcome(await context.links.peek(url), (info) =>
      info.kind === 'text' && out === undefined ? printText(context, url) : save(context, url, info, out),
    );
  },
};
