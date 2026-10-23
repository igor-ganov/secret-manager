import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

/* Speaks the protocol over this process's stdin/stdout and resolves once the
   client hangs up (stdin closes), so the process can exit cleanly. */
export const serveMcp = async (server: McpServer): Promise<void> => {
  await server.connect(new StdioServerTransport());
  await new Promise<void>((resolve) => {
    server.server.onclose = resolve;
  });
};
