import type { IssuedLinkResponse } from '../../features/http-api/api-types.ts';

/* Same three lines the bot and the site show. */
export const issuedLinkLines = (link: IssuedLinkResponse): readonly string[] => [
  link.url,
  link.curl,
  `Valid for ${String(link.ttlMinutes)} minutes, opens once.`,
];
