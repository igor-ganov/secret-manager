import type { ApiClient } from '../api/api-client.ts';
import { succeeded } from '../outcome.ts';
import type { Command } from './command.ts';

/* Best effort: the token is dropped locally even when the server cannot be
   reached, so a stale credential never lingers on disk. */
const revokeCurrent = async (client: ApiClient): Promise<void> => {
  const devices = await client.devices();
  if (!devices.ok) {
    return;
  }
  await Promise.all(
    devices.value.tokens.filter((token) => token.current).map((token) => client.revokeToken(token.id)),
  );
};

export const logout: Command = {
  name: 'logout',
  usage: 'logout',
  description: 'Forget the stored token and revoke it on the server',
  run: async (context) => {
    const config = await context.config.read();
    if (config.serverUrl !== undefined && config.token !== undefined) {
      await revokeCurrent(context.createClient({ serverUrl: config.serverUrl, token: config.token }));
    }
    await context.config.write({ ...(config.serverUrl === undefined ? {} : { serverUrl: config.serverUrl }) });
    context.io.print('Logged out.');
    return succeeded;
  },
};
