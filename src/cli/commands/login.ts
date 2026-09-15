import { EXIT, failed, succeeded } from '../outcome.ts';
import { ABORTED } from './aborted.ts';
import type { Command, CommandContext } from './command.ts';
import { toOutcome } from './to-outcome.ts';

const askServerUrl = async (context: CommandContext): Promise<string | undefined> => {
  const stored = (await context.config.read()).serverUrl ?? context.defaultServerUrl;
  const hint = stored === undefined ? '' : ` [${stored}]`;
  const typed = await context.io.ask(`Server URL${hint}: `);
  return typed === undefined ? undefined : typed.trim() || stored;
};

/* The token is entered hidden — it is a credential like a password. */
export const login: Command = {
  name: 'login',
  usage: 'login',
  description: 'Store the server URL and an API token created on the web site',
  run: async (context) => {
    const serverUrl = await askServerUrl(context);
    if (serverUrl === undefined) {
      return ABORTED;
    }
    if (serverUrl === '') {
      return failed('A server URL is required.', EXIT.usage);
    }
    const token = (await context.io.askHidden('API token: '))?.trim();
    if (token === undefined) {
      return ABORTED;
    }
    if (token === '') {
      return failed('A token is required.', EXIT.usage);
    }
    const client = context.createClient({ serverUrl, token });
    return toOutcome(await client.me(), async (me) => {
      await context.config.write({ serverUrl, token });
      context.io.print(`Logged in as ${me.name} (${me.id}). Config: ${context.config.path}`);
      return succeeded;
    });
  },
};
