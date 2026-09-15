import { EXIT, failed, succeeded } from '../outcome.ts';
import type { Command } from './command.ts';
import { toOutcome } from './to-outcome.ts';
import { withClient } from './with-client.ts';

const YES_FLAGS = new Set(['-y', '--yes']);
const CANCELLED = failed('Cancelled.', EXIT.rejected);

const confirmed = async (
  ask: (prompt: string) => Promise<string | undefined>,
  key: string,
): Promise<boolean> => /^y(es)?$/i.test((await ask(`Delete “${key}”? [y/N] `)) ?? '');

export const rm: Command = {
  name: 'rm',
  usage: 'rm <key> [-y]',
  description: 'Delete a saved key (asks for confirmation unless -y is given)',
  run: (context, [key, flag]) =>
    withClient(context, async (client) => {
      if (key === undefined) {
        return failed('Usage: rm <key> [-y]', EXIT.usage);
      }
      const skipPrompt = flag !== undefined && YES_FLAGS.has(flag);
      if (!skipPrompt && !(await confirmed(context.io.ask, key))) {
        return CANCELLED;
      }
      return toOutcome(await client.remove(key), () => {
        context.io.print(`“${key}” has been deleted.`);
        return succeeded;
      });
    }),
};
