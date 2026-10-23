import { EXIT, failed } from '../outcome.ts';
import type { Command } from './command.ts';

export const MCP_IN_SESSION = 'The MCP server runs in argument mode: secret mcp [server-url]';

/* The real server is started by main.ts before the console io claims stdin
   (see cli/mcp/run-mcp.ts); this entry only makes `help` list it and tells a
   session user where it runs. */
export const mcp: Command = {
  name: 'mcp',
  usage: 'mcp [server-url]',
  description: 'Serve the MCP tool for AI assistants over stdio (no login needed)',
  run: async () => failed(MCP_IN_SESSION, EXIT.usage),
};
