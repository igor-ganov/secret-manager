import type { IssuedLinkResponse } from '../../features/http-api/api-types.ts';
import type { ConsoleIo } from '../io/console-io.ts';

/* Same three lines the bot and the site show. */
export const printIssuedLink = (io: ConsoleIo, link: IssuedLinkResponse): void => {
  io.print(link.url);
  io.print(link.curl);
  io.print(`Valid for ${link.ttlMinutes} minutes, opens once.`);
};
