import type { CeremonyOptionsResponse } from '../../features/http-api/api-types.ts';
import { matchResult } from '../../features/result/match-result.ts';
import type { Result } from '../../features/result/result.ts';

export type Ceremony = (options: unknown) => Promise<Result<unknown>>;

const failure = async <T>(error: string): Promise<Result<T>> => ({ ok: false, error });

/* options from the server → browser ceremony → verification on the server,
   as one pipeline where any failure short-circuits into the Result. */
export const runCeremony = async <T>(
  fetchOptions: () => Promise<Result<CeremonyOptionsResponse>>,
  ceremony: Ceremony,
  verify: (response: unknown) => Promise<Result<T>>,
): Promise<Result<T>> =>
  matchResult(
    await fetchOptions(),
    async ({ options }) => matchResult(await ceremony(options), verify, failure<T>),
    failure<T>,
  );
