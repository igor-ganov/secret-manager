import { succeeded } from '../outcome.ts';
import { ABORTED, EMPTY_VALUE } from './aborted.ts';
import type { Command } from './command.ts';
import { printIssuedLink } from './print-issued-link.ts';
import { resolveValue } from './resolve-value.ts';
import { toOutcome } from './to-outcome.ts';
import { withClient } from './with-client.ts';

export const share: Command = {
  name: 'share',
  usage: 'share [value|-]',
  description: 'One-time link to a value that is not saved (prompts when omitted)',
  run: (context, [provided]) =>
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
    }),
};
