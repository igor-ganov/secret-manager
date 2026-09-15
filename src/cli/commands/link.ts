import { EXIT, failed, succeeded } from '../outcome.ts';
import type { Command } from './command.ts';
import { printIssuedLink } from './print-issued-link.ts';
import { toOutcome } from './to-outcome.ts';
import { withClient } from './with-client.ts';

export const link: Command = {
  name: 'link',
  usage: 'link <key>',
  description: 'Print a fresh one-time link to a stored value',
  run: (context, [key]) =>
    withClient(context, async (client) => {
      if (key === undefined) {
        return failed('Usage: link <key>', EXIT.usage);
      }
      return toOutcome(await client.linkFor(key), (issued) => {
        printIssuedLink(context.io, issued);
        return succeeded;
      });
    }),
};
