import { API_PATH_PREFIX } from '../http-api/create-api-request-handler.ts';
import { LINK_PATH_PREFIX } from '../one-time-links/create-link-request-handler.ts';

export type RequestHandler = (request: Request) => Promise<Response>;

export type AppHandlers = {
  readonly api: RequestHandler;
  readonly links: RequestHandler;
};

/* Path-prefix dispatch shared by the worker and the local server; static
   site files are served in front of this by the respective runtime. */
export const createAppRequestHandler =
  ({ api, links }: AppHandlers): RequestHandler =>
  async (request) => {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith(API_PATH_PREFIX)) {
      return api(request);
    }
    if (pathname.startsWith(LINK_PATH_PREFIX)) {
      return links(request);
    }
    return new Response('Not found', { status: 404 });
  };
