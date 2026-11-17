import { describe, expect, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { IssuedLinkResponse } from '../../features/http-api/api-types.ts';
import type { ApiResult } from '../api/api-client.ts';
import { createMcpServer, FETCH_TOOL_NAME, FILE_TOOL_NAME, TOOL_NAME, type McpServerDependencies } from './create-mcp-server.ts';

const LINK: IssuedLinkResponse = { url: 'https://s.test/s/t', curl: 'curl -X POST https://s.test/s/t', ttlMinutes: 90 };
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

/* The server under test and an SDK client wired to it in memory. */
const FILE_LINK: IssuedLinkResponse = { url: 'https://s.test/s/f', curl: 'curl -X POST -OJ https://s.test/s/f', ttlMinutes: 30 };

const NO_FILES: Pick<McpServerDependencies, 'dropFile' | 'fetchLink'> = {
  dropFile: async () => ({ ok: false, error: 'unused' }),
  fetchLink: async () => ({ ok: false, error: 'unused' }),
};

const build = async (drop: (value: string, ttlMinutes: number) => Promise<ApiResult<IssuedLinkResponse>>, files = NO_FILES) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({ drop, ...files, now: () => NOW });
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
  return { client, server };
};

describe('createMcpServer (mcp AC-2.2–2.4)', () => {
  test('exposes the link tool, whose description keeps the value out of the chat, and the two file tools (secret-files AC-6.1, AC-6.2)', async () => {
    const { client, server } = await build(async () => ({ ok: true, value: LINK }));
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([TOOL_NAME, FILE_TOOL_NAME, FETCH_TOOL_NAME]);
    const [tool] = tools;
    expect(tool?.description).toMatch(/never/i);
    expect(tool?.inputSchema).toMatchObject({
      type: 'object',
      required: ['value', 'ttlMinutes'],
      properties: {
        value: { type: 'string', minLength: 1 },
        ttlMinutes: { type: 'integer', minimum: 1, maximum: 1440 },
      },
    });
    expect(tool?.outputSchema).toMatchObject({ type: 'object', required: ['url', 'curl', 'ttlMinutes', 'expiresAt'] });
    await server.close();
  });

  test('a call drops the value with the lifetime and answers with the link, as text and as data (AC-2.3)', async () => {
    const calls: string[] = [];
    const { client, server } = await build(async (value, ttlMinutes) => {
      calls.push(`${value}:${String(ttlMinutes)}`);
      return { ok: true, value: LINK };
    });
    const result = await client.callTool({ name: TOOL_NAME, arguments: { value: 'hunter2', ttlMinutes: 90 } });
    expect(calls).toEqual(['hunter2:90']);
    expect(result).toMatchObject({
      content: [{ type: 'text', text: `${LINK.url}\n${LINK.curl}\nValid for 90 minutes, opens once.` }],
      structuredContent: { ...LINK, expiresAt: '2026-01-01T13:30:00.000Z' },
    });
    expect(result.isError).toBeUndefined();
    await server.close();
  });

  test('a refused or unreachable server becomes a tool error with its message (AC-2.4)', async () => {
    const { client, server } = await build(async () => ({ ok: false, error: { kind: 'rejected', message: 'Value must be a non-empty string.' } }));
    const result = await client.callTool({ name: TOOL_NAME, arguments: { value: 'v', ttlMinutes: 5 } });
    expect(result).toMatchObject({ isError: true, content: [{ type: 'text', text: 'Value must be a non-empty string.' }] });
    await server.close();
  });

  test('arguments outside the limits are refused before any request is made (AC-2.2)', async () => {
    const calls: string[] = [];
    const { client, server } = await build(async (value) => {
      calls.push(value);
      return { ok: true, value: LINK };
    });
    const result = await client.callTool({ name: TOOL_NAME, arguments: { value: 'v', ttlMinutes: 1441 } });
    expect(result.isError).toBe(true);
    expect(calls).toEqual([]);
    await server.close();
  });
});

describe('createMcpServer file tools (secret-files US-6)', () => {
  test('create_one_time_file_link uploads the local file and answers with the link and its metadata (AC-6.1)', async () => {
    const calls: string[] = [];
    const { client, server } = await build(async () => ({ ok: true, value: LINK }), {
      ...NO_FILES,
      dropFile: async (path, ttlMinutes) => {
        calls.push(`${path}:${String(ttlMinutes)}`);
        return { ok: true, value: { link: FILE_LINK, file: { name: 'id_rsa', size: 2048, contentType: 'application/octet-stream' } } };
      },
    });
    const { tools } = await client.listTools();
    expect(tools.find((tool) => tool.name === FILE_TOOL_NAME)?.inputSchema).toMatchObject({
      required: ['path', 'ttlMinutes'],
      properties: { path: { type: 'string' }, ttlMinutes: { type: 'integer', minimum: 1, maximum: 1440 } },
    });
    const result = await client.callTool({ name: FILE_TOOL_NAME, arguments: { path: 'C:/keys/id_rsa', ttlMinutes: 30 } });
    expect(calls).toEqual(['C:/keys/id_rsa:30']);
    expect(result).toMatchObject({
      content: [{ type: 'text', text: `${FILE_LINK.url}\n${FILE_LINK.curl}\nValid for 30 minutes, opens once.\nFile: id_rsa (2.0 KiB)` }],
      structuredContent: { ...FILE_LINK, expiresAt: '2026-01-01T12:30:00.000Z', fileName: 'id_rsa', sizeBytes: 2048 },
    });
    const failed = await build(async () => ({ ok: true, value: LINK }), { ...NO_FILES, dropFile: async () => ({ ok: false, error: 'No such file: x' }) });
    expect(await failed.client.callTool({ name: FILE_TOOL_NAME, arguments: { path: 'x', ttlMinutes: 5 } })).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'No such file: x' }],
    });
    await server.close();
    await failed.server.close();
  });

  test('fetch_one_time_link saves into a file and returns only where it went (AC-6.2)', async () => {
    const { client, server } = await build(async () => ({ ok: true, value: LINK }), {
      ...NO_FILES,
      fetchLink: async (url, outPath) => ({ ok: true, value: { path: `/abs/${outPath}`, kind: 'text', name: outPath, sizeBytes: 7 } }),
    });
    const result = await client.callTool({ name: FETCH_TOOL_NAME, arguments: { url: 'https://s.test/s/t', outPath: 'pass.txt' } });
    expect(result).toMatchObject({
      content: [{ type: 'text', text: 'Saved the text secret (7 B) to /abs/pass.txt. The content stays in that file.' }],
      structuredContent: { path: '/abs/pass.txt', kind: 'text', name: 'pass.txt', sizeBytes: 7 },
    });
    await server.close();
  });
});
