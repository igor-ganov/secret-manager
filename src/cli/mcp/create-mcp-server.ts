import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { IssuedLinkResponse } from '../../features/http-api/api-types.ts';
import { DROP_MAX_TTL_MINUTES, DROP_MAX_VALUE_BYTES, isValidDropValue } from '../../features/sharing/drop-limits.ts';
import type { ApiFailure, ApiResult } from '../api/api-client.ts';
import { issuedLinkLines } from '../commands/issued-link-lines.ts';
import { registerFileTools, type FileToolDependencies } from './file-tools.ts';

export { FETCH_TOOL_NAME, FILE_TOOL_NAME } from './file-tools.ts';

export const TOOL_NAME = 'create_one_time_link';

const INSTRUCTIONS = [
  'Hand credentials to the person through one-time links: call create_one_time_link with the value and how long the link may live, then reply with the link. Never write the value itself into the conversation.',
  'For a secret file (key, certificate, .env, dump; up to 100 MiB) call create_one_time_file_link with its path instead of pasting its content.',
  'When the person gives you a one-time link, call fetch_one_time_link with an outPath: the content lands in that file and never in the chat; do not read it back into the conversation unless the person asks.',
].join(' ');

const DESCRIPTION = [
  'Turns a secret (password, token, key, connection string) into a link that opens exactly once and then dies.',
  'Use it whenever a credential has to reach the person: reply with the url (and the curl line for scripts), never repeat the value in the chat.',
  `The link lives ttlMinutes minutes (1–${String(DROP_MAX_TTL_MINUTES)}); nothing is stored once it is opened or expired.`,
].join(' ');

export type McpServerDependencies = FileToolDependencies & {
  readonly drop: (value: string, ttlMinutes: number) => Promise<ApiResult<IssuedLinkResponse>>;
};

const INPUT = {
  value: z
    .string()
    .min(1)
    .refine(isValidDropValue, `The value must be at most ${String(DROP_MAX_VALUE_BYTES)} bytes.`)
    .describe('The secret to hand over, verbatim.'),
  ttlMinutes: z.int().min(1).max(DROP_MAX_TTL_MINUTES).describe('How many minutes the link stays valid if nobody opens it.'),
};

const OUTPUT = {
  url: z.string().describe('The one-time link: opening it shows a page with a Reveal button.'),
  curl: z.string().describe('Command that prints the value from a script instead of a browser.'),
  ttlMinutes: z.int(),
  expiresAt: z.string().describe('ISO 8601 instant after which the unopened link is gone.'),
};

const failureText = (failure: ApiFailure): string => {
  switch (failure.kind) {
    case 'unauthorized':
      return 'The server refused the request.';
    case 'rejected':
    case 'unreachable':
      return failure.message;
  }
};

const toolError = (text: string): CallToolResult => ({ isError: true, content: [{ type: 'text', text }] });

const toolLink = (link: IssuedLinkResponse, expiresAt: string): CallToolResult => ({
  content: [{ type: 'text', text: issuedLinkLines(link).join('\n') }],
  structuredContent: { ...link, expiresAt },
});

/* The protocol side of `secret mcp`: three tools over whatever transport the
   caller connects, so tests drive it in memory and main.ts over stdio. */
export const createMcpServer = ({ drop, dropFile, fetchLink, now }: McpServerDependencies): McpServer => {
  const server = new McpServer({ name: 'secret-manager', version: '1.0.0' }, { instructions: INSTRUCTIONS });
  server.registerTool(
    TOOL_NAME,
    { title: 'Create a one-time link', description: DESCRIPTION, inputSchema: INPUT, outputSchema: OUTPUT },
    async ({ value, ttlMinutes }) => {
      const result = await drop(value, ttlMinutes);
      return result.ok
        ? toolLink(result.value, new Date(now() + ttlMinutes * 60 * 1000).toISOString())
        : toolError(failureText(result.error));
    },
  );
  registerFileTools(server, { dropFile, fetchLink, now });
  return server;
};
