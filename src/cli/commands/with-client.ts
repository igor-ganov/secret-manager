import type { ApiClient } from '../api/api-client.ts';
import type { Outcome } from '../outcome.ts';
import type { CommandContext } from './command.ts';
import { requireClient } from './require-client.ts';

/* Runs `body` with an authenticated client, or reports why there is none. */
export const withClient = async (
  context: CommandContext,
  body: (client: ApiClient) => Promise<Outcome>,
): Promise<Outcome> => {
  const client = await requireClient(context);
  return client.ok ? body(client.value) : client.error;
};
