import { describe, expect, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { IssuedLinkResponse } from '../../features/http-api/api-types.ts';
import type { ApiResult } from '../api/api-client.ts';
import { createMcpServer, TOOL_NAME } from './create-mcp-server.ts';

const LINK: IssuedLinkResponse = { url: 'https://s.test/s/t', curl: 'curl -X POST https://s.test/s/t', ttlMinutes: 90 };
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

/* The server under test and an SDK client wired to it in memory. */
const build = async (drop: (value: string, ttlMinutes: number) => Promise<ApiResult<IssuedLinkResponse>>) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({ drop, now: () => NOW });
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
  return { client, server };
};

describe('createMcpServer (mcp AC-2.2–2.4)', () => {
  test('exposes exactly one tool whose description keeps the value out of the chat', async () => {
    const { client, server } = await build(async () => ({ ok: true, value: LINK }));
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([TOOL_NAME]);
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
