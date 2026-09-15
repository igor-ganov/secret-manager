import { describe, expect, test } from 'bun:test';
import { createLineReader } from './create-line-reader.ts';

const streamOf = (...chunks: readonly string[]): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start: (controller) => {
      chunks.forEach((chunk) => controller.enqueue(new TextEncoder().encode(chunk)));
      controller.close();
    },
  });

describe('createLineReader', () => {
  test('yields lines across chunk boundaries and strips CR', async () => {
    const next = createLineReader(streamOf('li', 'st\r\nget k\n', 'tail'));
    expect(await next()).toBe('list');
    expect(await next()).toBe('get k');
    expect(await next()).toBe('tail');
    expect(await next()).toBeUndefined();
    expect(await next()).toBeUndefined();
  });

  test('handles an empty stream', async () => {
    const next = createLineReader(streamOf());
    expect(await next()).toBeUndefined();
  });
});
