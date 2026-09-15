import { EXIT, failed, succeeded } from '../outcome.ts';
import type { Command } from './command.ts';
import { toOutcome } from './to-outcome.ts';
import { withClient } from './with-client.ts';

export const get: Command = {
  name: 'get',
  usage: 'get <key>',
  description: 'Print the stored value (only the value, so it can be captured)',
  run: (context, [key]) =>
    withClient(context, async (client) => {
      if (key === undefined) {
        return failed('Usage: get <key>', EXIT.usage);
      }
      return toOutcome(await client.read(key), ({ value }) => {
        context.io.print(value);
        return succeeded;
      });
    }),
};
