export type RateLimiterOptions = {
  readonly limit: number;
  readonly windowMs: number;
  readonly now: () => number;
};

export type RateLimiter = {
  /* True when the caller may proceed; counts the attempt either way. */
  readonly allow: (key: string) => boolean;
};

/* Fixed-window counter in memory: best effort per isolate, enough to blunt
   online guessing against endpoints whose secrets are already 256-bit. */
export const createRateLimiter = ({ limit, windowMs, now }: RateLimiterOptions): RateLimiter => {
  const windows = new Map<string, { readonly startedAt: number; count: number }>();

  const allow = (key: string): boolean => {
    const current = now();
    const window = windows.get(key);
    if (window === undefined || current - window.startedAt >= windowMs) {
      windows.set(key, { startedAt: current, count: 1 });
      return true;
    }
    window.count += 1;
    return window.count <= limit;
  };

  return { allow };
};

export const clientKeyOf = (request: Request): string =>
  request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'local';
