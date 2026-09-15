import { succeeded } from '../outcome.ts';
import type { Command } from './command.ts';
import { toOutcome } from './to-outcome.ts';
import { withClient } from './with-client.ts';

export const whoami: Command = {
  name: 'whoami',
  usage: 'whoami',
  description: 'Show the signed-in Telegram user',
  run: (context) =>
    withClient(context, async (client) =>
      toOutcome(await client.me(), (me) => {
        context.io.print(`${me.name} (${me.id})`);
        return succeeded;
      }),
    ),
};
