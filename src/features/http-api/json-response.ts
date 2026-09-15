const BASE_HEADERS = {
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
} as const;

export const jsonResponse = (body: unknown, status = 200, headers: HeadersInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, 'content-type': 'application/json; charset=utf-8', ...headers },
  });

export const noContent = (headers: HeadersInit = {}): Response =>
  new Response(undefined, { status: 204, headers: { ...BASE_HEADERS, ...headers } });

export const errorResponse = (status: number, error: string): Response =>
  jsonResponse({ error }, status);

export const badRequest = (error: string): Response => errorResponse(400, error);
export const unauthorized = (error = 'Authentication required.'): Response =>
  errorResponse(401, error);
export const forbidden = (error: string): Response => errorResponse(403, error);
export const notFound = (error = 'Not found.'): Response => errorResponse(404, error);
