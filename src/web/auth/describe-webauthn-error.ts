const FALLBACK = 'The passkey operation did not complete.';

const isError = (value: unknown): value is Error => value instanceof Error;

/* A cancelled or blocked ceremony throws a DOMException; its message is what
   the person needs to see. */
export const describeWebauthnError = (error: unknown): string =>
  [error].filter(isError).map((failure) => failure.message)[0] ?? FALLBACK;
