/* Exit codes: 0 done, 1 the server rejected the request, 2 not logged in or
   token rejected, 64 usage error (EX_USAGE from sysexits). */
export const EXIT = { ok: 0, rejected: 1, auth: 2, usage: 64 } as const;

export type Outcome =
  | { readonly kind: 'ok' }
  | { readonly kind: 'error'; readonly message: string; readonly code: number };

export const succeeded: Outcome = { kind: 'ok' };

export const failed = (message: string, code: number): Outcome => ({ kind: 'error', message, code });
