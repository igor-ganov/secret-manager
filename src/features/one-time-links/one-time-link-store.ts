export type OneTimeLinkStore = {
  /* `ttlMs` overrides the store's default lifetime for this single link, so the
     bot can honor each user's configured expiry; omitted falls back to default. */
  readonly issue: (value: string, ttlMs?: number) => Promise<string>;
  readonly peek: (token: string) => Promise<boolean>;
  readonly consume: (token: string) => Promise<string | undefined>;
};
