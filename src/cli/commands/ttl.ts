import { EXIT, failed, succeeded } from '../outcome.ts';
import type { Command } from './command.ts';
import { toOutcome } from './to-outcome.ts';
import { withClient } from './with-client.ts';

export const ttl: Command = {
  name: 'ttl',
  usage: 'ttl [minutes]',
  description: 'Show or set how long one-time links stay valid (presets only)',
  run: (context, [minutes]) =>
    withClient(context, async (client) => {
      if (minutes === undefined) {
        return toOutcome(await client.settings(), (settings) => {
          context.io.print(`Links stay valid for ${settings.linkTtlMinutes} minutes.`);
          context.io.print(`Presets: ${settings.presets.join(', ')}`);
          return succeeded;
        });
      }
      const parsed = Number(minutes);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return failed('Usage: ttl [minutes]', EXIT.usage);
      }
      return toOutcome(await client.saveSettings(parsed), () => {
        context.io.print(`Links now stay valid for ${parsed} minutes.`);
        return succeeded;
      });
    }),
};
