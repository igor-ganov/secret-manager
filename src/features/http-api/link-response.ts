import { buildCurlSnippet } from '../sharing/build-curl-snippet.ts';
import type { IssuedLink } from '../sharing/sharing-service.ts';
import type { IssuedLinkResponse } from './api-types.ts';
import { jsonResponse } from './json-response.ts';

/* Every route that hands out a one-time link answers with this one shape;
   file links pass their own snippet (`curl -OJ`). */
export const linkResponse = (link: IssuedLink, snippet: (url: string) => string = buildCurlSnippet): Response => {
  const body: IssuedLinkResponse = { ...link, curl: snippet(link.url) };
  return jsonResponse(body, 201);
};
