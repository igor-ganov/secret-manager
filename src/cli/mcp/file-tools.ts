import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Result } from '../../features/result/result.ts';
import { formatFileSize } from '../../features/secret-files/format-file-size.ts';
import { DROP_MAX_TTL_MINUTES } from '../../features/sharing/drop-limits.ts';
import { issuedLinkLines } from '../commands/issued-link-lines.ts';
import type { ReceivedLink } from '../files/receive-link.ts';
import type { UploadedLocalFile } from '../files/upload-local-file.ts';

export const FILE_TOOL_NAME = 'create_one_time_file_link';
export const FETCH_TOOL_NAME = 'fetch_one_time_link';

export type FileToolDependencies = {
  /* Uploads a local file as an anonymous drop; errors are ready to show. */
  readonly dropFile: (path: string, ttlMinutes: number) => Promise<Result<UploadedLocalFile, string>>;
  /* Opens a link into a new local file; never returns its content. */
  readonly fetchLink: (url: string, outPath: string) => Promise<Result<ReceivedLink, string>>;
  readonly now: () => number;
};

const FILE_DESCRIPTION = [
  'Turns a local file (key file, certificate, .env, dump; up to 100 MiB) into a link that downloads it exactly once and then dies.',
  'Use it whenever a secret file has to reach the person: reply with the url (and the curl line, which saves the file under its own name), never paste the file content into the chat.',
  `The link lives ttlMinutes minutes (1–${String(DROP_MAX_TTL_MINUTES)}); the file is deleted once downloaded or expired.`,
].join(' ');

const FETCH_DESCRIPTION = [
  'Opens a one-time link someone gave you (text or file) and writes what it holds into the local file outPath, which must not exist yet.',
  'The link is used up by this call. The result says only where the content went, its kind, name and size: the secret itself never enters the conversation.',
  'Do not read the saved file back into the chat unless the person asks for it; pass its path to whatever needs it.',
].join(' ');

const toolError = (text: string): CallToolResult => ({ isError: true, content: [{ type: 'text', text }] });

const fileLinkResult = ({ link, file }: UploadedLocalFile, expiresAt: string): CallToolResult => ({
  content: [{ type: 'text', text: [...issuedLinkLines(link), `File: ${file.name} (${formatFileSize(file.size)})`].join('\n') }],
  structuredContent: { ...link, expiresAt, fileName: file.name, sizeBytes: file.size },
});

const receivedText = ({ path, kind, name, sizeBytes }: ReceivedLink): string =>
  kind === 'file'
    ? `Saved ${name} (${formatFileSize(sizeBytes)}) to ${path}. The content stays in that file.`
    : `Saved the text secret (${formatFileSize(sizeBytes)}) to ${path}. The content stays in that file.`;

const receivedResult = (received: ReceivedLink): CallToolResult => ({
  content: [{ type: 'text', text: receivedText(received) }],
  structuredContent: { ...received },
});

/* Secret files over MCP (secret-files US-6): send a local file, receive a
   link into a local file. Results carry metadata only (AC-8.2). */
export const registerFileTools = (server: McpServer, { dropFile, fetchLink, now }: FileToolDependencies): void => {
  server.registerTool(
    FILE_TOOL_NAME,
    {
      title: 'Create a one-time file link',
      description: FILE_DESCRIPTION,
      inputSchema: {
        path: z.string().min(1).describe('Path of the local file to hand over; relative paths start at the working folder.'),
        ttlMinutes: z.int().min(1).max(DROP_MAX_TTL_MINUTES).describe('How many minutes the link stays valid if nobody opens it.'),
      },
      outputSchema: {
        url: z.string(),
        curl: z.string().describe('Command that downloads the file under its own name.'),
        ttlMinutes: z.int(),
        expiresAt: z.string(),
        fileName: z.string(),
        sizeBytes: z.int(),
      },
    },
    async ({ path, ttlMinutes }) => {
      const uploaded = await dropFile(path, ttlMinutes);
      return uploaded.ok ? fileLinkResult(uploaded.value, new Date(now() + ttlMinutes * 60 * 1000).toISOString()) : toolError(uploaded.error);
    },
  );
  server.registerTool(
    FETCH_TOOL_NAME,
    {
      title: 'Open a one-time link into a file',
      description: FETCH_DESCRIPTION,
      inputSchema: {
        url: z.string().min(1).describe('The one-time link (…/s/<token>).'),
        outPath: z.string().min(1).describe('Local file to create with the content; relative paths start at the working folder.'),
      },
      outputSchema: {
        path: z.string().describe('Absolute path of the file written.'),
        kind: z.enum(['text', 'file']),
        name: z.string(),
        sizeBytes: z.int(),
      },
    },
    async ({ url, outPath }) => {
      const received = await fetchLink(url, outPath);
      return received.ok ? receivedResult(received.value) : toolError(received.error);
    },
  );
};
