import { succeeded } from '../outcome.ts';
import type { Command } from './command.ts';
import { toOutcome } from './to-outcome.ts';
import { withClient } from './with-client.ts';

export const list: Command = {
  name: 'list',
  usage: 'list',
  description: 'List saved keys, one per line',
  run: (context) =>
    withClient(context, async (client) =>
      toOutcome(await client.keys(), ({ keys }) => {
        keys.forEach((key) => context.io.print(key));
        if (keys.length === 0) {
          context.io.printError('You have no saved keys yet.');
        }
        return succeeded;
      }),
    ),
};
