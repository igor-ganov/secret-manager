import type { OneTimeLinkStore } from './one-time-link-store.ts';

export type InMemoryOneTimeLinkStore = OneTimeLinkStore & {
  readonly size: () => number;
};

export type OneTimeLinkStoreOptions = {
  readonly ttlMs: number;
  readonly now: () => number;
  readonly createToken: () => string;
};

type StoredSecret = {
  readonly value: string;
  readonly expiresAt: number;
};

export const createOneTimeLinkStore = ({
  ttlMs,
  now,
  createToken,
}: OneTimeLinkStoreOptions): InMemoryOneTimeLinkStore => {
  const secrets = new Map<string, StoredSecret>();

  const sweepExpired = (): void => {
    const current = now();
    for (const [token, secret] of secrets) {
      if (secret.expiresAt <= current) {
        secrets.delete(token);
      }
    }
  };

  const issue = async (value: string, overrideTtlMs?: number): Promise<string> => {
    sweepExpired();
    const token = createToken();
    secrets.set(token, { value, expiresAt: now() + (overrideTtlMs ?? ttlMs) });
    return token;
  };

  const peek = async (token: string): Promise<boolean> => {
    sweepExpired();
    return secrets.has(token);
  };

  const consume = async (token: string): Promise<string | undefined> => {
    sweepExpired();
    const secret = secrets.get(token);
    if (secret === undefined) {
      return undefined;
    }
    secrets.delete(token);
    return secret.value;
  };

  const size = (): number => {
    sweepExpired();
    return secrets.size;
  };

  return { issue, peek, consume, size };
};
