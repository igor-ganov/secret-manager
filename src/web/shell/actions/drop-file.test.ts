import { describe, expect, test } from 'bun:test';
import type { AppState, Notice } from '../../state/app-state.ts';
import { createStore } from '../../state/create-store.ts';
import { initialState } from '../../state/initial-state.ts';
import { dropFile, type FileUploadDeps } from './drop-file.ts';
import { shareFile } from './share-file.ts';

const LINK = { url: 'https://x/s/t', curl: 'curl -X POST -OJ https://x/s/t', ttlMinutes: 15 };
const TICKET = { uploadId: 'u', partSize: 2, partCount: 2, expiresAt: 0 };

const build = (completes: boolean) => {
  const file = new File(['abc'], 'note.txt', { type: 'text/plain' });
  const store = createStore<AppState>({ ...initialState, session: { kind: 'anonymous' }, file });
  const calls: unknown[] = [];
  const notices: Notice[] = [];
  store.subscribe((state) => notices.push(state.notice));
  const deps: FileUploadDeps = {
    store,
    api: {
      dropFile: async (...args) => {
        calls.push(['dropFile', ...args]);
        return { ok: true, value: TICKET };
      },
      beginFile: async (...args) => {
        calls.push(['beginFile', ...args]);
        return { ok: true, value: TICKET };
      },
      putPart: async (uploadId, partNumber, bytes) => {
        calls.push(['putPart', uploadId, partNumber, new TextDecoder().decode(bytes)]);
        return { ok: true, value: true };
      },
      completeUpload: async (uploadId) => {
        calls.push(['complete', uploadId]);
        return completes ? { ok: true, value: LINK } : { ok: false, error: 'Storage is unavailable.' };
      },
      abortUpload: async (uploadId) => {
        calls.push(['abort', uploadId]);
        return { ok: true, value: true };
      },
    },
  };
  return { store, calls, notices, file, deps };
};

describe('dropFile (secret-files AC-4.3, AC-4.4)', () => {
  test('uploads the parts with progress, then shows the link and forgets the file', async () => {
    const { store, calls, notices, file, deps } = build(true);
    await dropFile(deps)(file, 15);
    expect(calls).toEqual([
      ['dropFile', 'note.txt', 3, 'text/plain', 15],
      ['putPart', 'u', 1, 'ab'],
      ['putPart', 'u', 2, 'c'],
      ['complete', 'u'],
    ]);
    expect(notices).toContainEqual({ kind: 'upload', name: 'note.txt', sent: 2, total: 3 });
    expect(store.get()).toMatchObject({
      notice: { kind: 'link', intro: 'One-time link to “note.txt” (nothing was saved):', link: LINK },
      file: undefined,
      quickTtlMinutes: 15,
      error: undefined,
    });
  });

  test('a failure aborts the upload, shows the error and keeps the file', async () => {
    const { store, calls, file, deps } = build(false);
    await dropFile(deps)(file, 15);
    expect(calls.at(-1)).toEqual(['abort', 'u']);
    expect(store.get()).toMatchObject({ notice: { kind: 'idle' }, file, error: 'Storage is unavailable.' });
  });
});

describe('shareFile (secret-files AC-4.3)', () => {
  test('a signed-in upload begins on the account and shows the link', async () => {
    const { store, calls, file, deps } = build(true);
    await shareFile(deps)(file);
    expect(calls[0]).toEqual(['beginFile', 'note.txt', 3, 'text/plain']);
    expect(store.get()).toMatchObject({ notice: { kind: 'link', link: LINK }, file: undefined });
  });
});
