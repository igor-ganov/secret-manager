import { describe, expect, test } from 'bun:test';
import type { Result } from '../result/result.ts';
import { uploadInParts, type UploadTransport } from './upload-in-parts.ts';

const LINK = { url: 'https://x/s/t', curl: 'curl -X POST -OJ https://x/s/t', ttlMinutes: 5 };
const TICKET = { uploadId: 'u', partSize: 4, partCount: 3, expiresAt: 0 };

type Script = { readonly failPart?: number; readonly failuresBeforeSuccess?: number; readonly failComplete?: boolean };

const build = ({ failPart, failuresBeforeSuccess = 99, failComplete = false }: Script = {}) => {
  const calls: string[] = [];
  let failures = 0;
  const transport: UploadTransport<string> = {
    begin: async () => {
      calls.push('begin');
      return { ok: true, value: TICKET };
    },
    putPart: async (uploadId, partNumber, bytes): Promise<Result<true, string>> => {
      calls.push(`part:${uploadId}:${String(partNumber)}:${Array.from(bytes).join('')}`);
      const fails = partNumber === failPart && failures < failuresBeforeSuccess;
      failures += fails ? 1 : 0;
      return fails ? { ok: false, error: 'part failed' } : { ok: true, value: true };
    },
    complete: async (uploadId) => {
      calls.push(`complete:${uploadId}`);
      return failComplete ? { ok: false, error: 'complete failed' } : { ok: true, value: LINK };
    },
    abort: async (uploadId) => {
      calls.push(`abort:${uploadId}`);
    },
  };
  return { transport, calls };
};

const CONTENT = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
const readRange = async (start: number, end: number): Promise<Uint8Array> => CONTENT.slice(start, end);

describe('uploadInParts (secret-files §6)', () => {
  test('begins, sends every part in order with progress, completes (AC-1.5, AC-1.6)', async () => {
    const { transport, calls } = build();
    const progress: number[] = [];
    expect(await uploadInParts(transport, readRange, CONTENT.length, (sent) => progress.push(sent))).toEqual({ ok: true, value: LINK });
    expect(calls).toEqual(['begin', 'part:u:1:1234', 'part:u:2:5678', 'part:u:3:90', 'complete:u']);
    expect(progress).toEqual([0, 4, 8, 10]);
  });

  test('a part that fails is retried, up to three attempts', async () => {
    const { transport, calls } = build({ failPart: 2, failuresBeforeSuccess: 2 });
    expect((await uploadInParts(transport, readRange, CONTENT.length, () => undefined)).ok).toBe(true);
    expect(calls.filter((call) => call.startsWith('part:u:2'))).toHaveLength(3);
  });

  test('a part that keeps failing aborts the session and returns the error (AC-4.4)', async () => {
    const { transport, calls } = build({ failPart: 2 });
    expect(await uploadInParts(transport, readRange, CONTENT.length, () => undefined)).toEqual({ ok: false, error: 'part failed' });
    expect(calls.at(-1)).toBe('abort:u');
    expect(calls).not.toContain('complete:u');
  });

  test('a failed completion aborts too', async () => {
    const { transport, calls } = build({ failComplete: true });
    expect(await uploadInParts(transport, readRange, CONTENT.length, () => undefined)).toEqual({ ok: false, error: 'complete failed' });
    expect(calls.at(-1)).toBe('abort:u');
  });
});
