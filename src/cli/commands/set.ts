import { EXIT, failed, succeeded } from '../outcome.ts';
import { ABORTED, EMPTY_VALUE } from './aborted.ts';
import type { Command } from './command.ts';
import { printIssuedLink } from './print-issued-link.ts';
import { resolveValue } from './resolve-value.ts';
import { toOutcome } from './to-outcome.ts';
import { withClient } from './with-client.ts';

export const set: Command = {
  name: 'set',
  usage: 'set <key> [value|-]',
  description: 'Save a key/value pair and print a one-time link to the value',
  run: (context, [key, provided]) =>
    withClient(context, async (client) => {
      if (key === undefined) {
        return failed('Usage: set <key> [value|-]', EXIT.usage);
      }
      const value = await resolveValue(context, provided, `Value for ${key}: `);
      if (value === undefined) {
        return ABORTED;
      }
      if (value === '') {
        return EMPTY_VALUE;
      }
      return toOutcome(await client.share(key, value), (link) => {
        context.io.print(`Saved “${key}”.`);
        printIssuedLink(context.io, link);
        return succeeded;
      });
    }),
};
