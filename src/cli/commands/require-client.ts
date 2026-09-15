import type { Result } from '../../features/result/result.ts';
import type { ApiClient } from '../api/api-client.ts';
import { EXIT, failed, type Outcome } from '../outcome.ts';
import type { CommandContext } from './command.ts';

export const NOT_LOGGED_IN = 'Not logged in. Run: login';

export const requireClient = async ({
  config,
  createClient,
}: CommandContext): Promise<Result<ApiClient, Outcome>> => {
  const { serverUrl, token } = await config.read();
  return serverUrl === undefined || token === undefined
    ? { ok: false, error: failed(NOT_LOGGED_IN, EXIT.auth) }
    : { ok: true, value: createClient({ serverUrl, token }) };
};
