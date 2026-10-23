import type { IssuedLinkResponse } from '../../features/http-api/api-types.ts';
import type { ConsoleIo } from '../io/console-io.ts';
import { issuedLinkLines } from './issued-link-lines.ts';

export const printIssuedLink = (io: ConsoleIo, link: IssuedLinkResponse): void => {
  issuedLinkLines(link).forEach((line) => io.print(line));
};
