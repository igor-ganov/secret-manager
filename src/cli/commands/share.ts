import { EXIT, failed, succeeded, type Outcome } from '../outcome.ts';
import { ABORTED, EMPTY_VALUE } from './aborted.ts';
import type { Command, CommandContext } from './command.ts';
import { printIssuedLink } from './print-issued-link.ts';
import { resolveValue } from './resolve-value.ts';
import { shareFile } from './share-file.ts';
import { toOutcome } from './to-outcome.ts';
import { withClient } from './with-client.ts';

export const FILE_FLAG = '--file';

const shareText = (context: CommandContext, provided: string | undefined): Promise<Outcome> =>
  withClient(context, async (client) => {
    const value = await resolveValue(context, provided, 'Value: ');
    if (value === undefined) {
      return ABORTED;
    }
    if (value === '') {
      return EMPTY_VALUE;
    }
    return toOutcome(await client.share('', value), (link) => {
      printIssuedLink(context.io, link);
      return succeeded;
    });
  });

export const share: Command = {
  name: 'share',
  usage: 'share [value|-]',
  description: 'One-time link to a value that is not saved (prompts when omitted)',
  variants: [{ usage: 'share --file <path>', description: 'One-time link to a file of up to 100 MiB (progress on stderr)' }],
  run: (context, [first, path]) => {
    if (first !== FILE_FLAG) {
      return shareText(context, first);
    }
    return path === undefined ? Promise.resolve(failed('Usage: share --file <path>', EXIT.usage)) : shareFile(context, path);
  },
};
