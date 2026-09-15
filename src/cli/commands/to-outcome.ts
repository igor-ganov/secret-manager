import type { ApiFailure, ApiResult } from '../api/api-client.ts';
import { EXIT, failed, type Outcome } from '../outcome.ts';

export const TOKEN_REJECTED = 'The server rejected the stored token. Run: login';

const fromFailure = (failure: ApiFailure): Outcome => {
  switch (failure.kind) {
    case 'unauthorized':
      return failed(TOKEN_REJECTED, EXIT.auth);
    case 'rejected':
      return failed(failure.message, failure.message.includes('login request') ? EXIT.auth : EXIT.rejected);
    case 'unreachable':
      return failed(failure.message, EXIT.rejected);
  }
};

export const toOutcome = async <T>(
  result: ApiResult<T>,
  onOk: (value: T) => Outcome | Promise<Outcome>,
): Promise<Outcome> => (result.ok ? onOk(result.value) : fromFailure(result.error));
