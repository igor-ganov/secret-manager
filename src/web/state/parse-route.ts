import type { Route } from './app-state.ts';

const PATTERN = /^#(enroll|link)=([A-Za-z0-9_-]+)$/;
const HOME: Route = { kind: 'home' };

const BY_KIND: Readonly<Record<string, (code: string) => Route>> = {
  enroll: (code) => ({ kind: 'enroll', code }),
  link: (code) => ({ kind: 'link', code }),
};

/* Codes live in the fragment on purpose: it never reaches the server logs. */
export const parseRoute = (hash: string): Route => {
  const match = PATTERN.exec(hash);
  return BY_KIND[match?.[1] ?? '']?.(match?.[2] ?? '') ?? HOME;
};
