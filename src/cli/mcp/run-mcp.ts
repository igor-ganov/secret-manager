import type { PublicClient } from '../api/api-client.ts';
import type { LinkClient } from '../api/link-client.ts';
import type { ConfigStore } from '../config/create-config-store.ts';
import type { LocalFiles } from '../io/local-files.ts';
import { EXIT } from '../outcome.ts';
import { createMcpFileOperations } from './create-mcp-file-operations.ts';
import { createMcpServer } from './create-mcp-server.ts';
import { serveMcp } from './serve-mcp.ts';

export const MCP_URL_REQUIRED = 'A server URL is required: mcp <server-url>';

export type McpContext = {
  readonly config: ConfigStore;
  readonly createPublicClient: (serverUrl: string) => PublicClient;
  readonly defaultServerUrl: string | undefined;
  readonly printError: (text: string) => void;
  readonly now: () => number;
  readonly files: LocalFiles;
  readonly links: LinkClient;
};

/* Argument → built-in / environment default → the url `login` stored; no
   account is needed, only somewhere to send the drop. */
const resolveServerUrl = async ({ config, defaultServerUrl }: McpContext, argument: string | undefined): Promise<string | undefined> => {
  const known = argument ?? defaultServerUrl ?? (await config.read()).serverUrl;
  return known === '' ? undefined : known;
};

/* `secret mcp [server-url]`: stdout belongs to the protocol, so the only
   thing ever printed here goes to stderr. */
export const runMcp = async (context: McpContext, argument: string | undefined): Promise<number> => {
  const serverUrl = await resolveServerUrl(context, argument);
  if (serverUrl === undefined) {
    context.printError(MCP_URL_REQUIRED);
    return EXIT.usage;
  }
  const client = context.createPublicClient(serverUrl);
  await serveMcp(createMcpServer({ drop: client.drop, ...createMcpFileOperations(client, context.files, context.links), now: context.now }));
  return EXIT.ok;
};
