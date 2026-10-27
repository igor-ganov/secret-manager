import { describe, expect, test } from 'bun:test';
import { createFileLinkStore } from './create-file-link-store.ts';
import { createFileSharingService } from './create-file-sharing-service.ts';
import { createMemoryFileObjectStore } from './create-memory-file-object-store.ts';
import { FILE_PART_BYTES } from './file-limits.ts';

const USER = 7;
const MINUTE = 60 * 1000;

const build = () => {
  let currentTime = 0;
  let counter = 0;
  const now = () => currentTime;
  const createToken = () => `tok${String((counter += 1))}`;
  const objects = createMemoryFileObjectStore({ createToken });
  const service = createFileSharingService({
    objects,
    links: createFileLinkStore({ now, createToken }),
    ttlMinutesFor: async (userId) => (userId === USER ? 30 : 5),
    buildLinkUrl: (token) => `https://x.test/s/${token}`,
    createToken,
    now,
  });
  const advance = (ms: number): void => {
    currentTime += ms;
  };
  return { service, objects, advance };
};

const bytes = (length: number, fill = 7): Uint8Array => new Uint8Array(length).fill(fill);

const readAll = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> => new Uint8Array(await new Response(stream).arrayBuffer());

const ticketOf = async (service: ReturnType<typeof build>['service'], size: number) => {
  const begun = await service.begin({ kind: 'drop', ttlMinutes: 15 }, { name: 'dump.sql', size, contentType: 'application/sql' });
  if (!begun.ok) {
    throw new Error('begin failed');
  }
  return begun.value;
};

describe('createFileSharingService (secret-files US-1–US-3)', () => {
  test('begin hands out a ticket with 8 MiB parts that expires in an hour (AC-1.1, AC-1.2)', async () => {
    const { service } = build();
    const begun = await service.begin({ kind: 'user', userId: USER }, { name: 'a.bin', size: FILE_PART_BYTES * 2 + 1, contentType: 'x/y' });
    expect(begun).toEqual({ ok: true, value: { uploadId: expect.any(String), partSize: FILE_PART_BYTES, partCount: 3, expiresAt: 60 * MINUTE } });
  });

  test('begin refuses a bad size or name (AC-1.3, AC-1.4)', async () => {
    const { service } = build();
    const tooBig = await service.begin({ kind: 'drop', ttlMinutes: 5 }, { name: 'a', size: 104_857_601, contentType: '' });
    expect(tooBig).toEqual({ ok: false, error: { kind: 'invalid', message: 'A file must be 1 byte to 100 MiB (104857600 bytes).' } });
    const badName = await service.begin({ kind: 'drop', ttlMinutes: 5 }, { name: '../etc', size: 1, contentType: '' });
    expect(badName).toMatchObject({ ok: false, error: { kind: 'invalid' } });
  });

  test('parts, complete, open once: the file comes back byte for byte and is then deleted (AC-1.5, AC-1.6, AC-2.2, AC-2.3)', async () => {
    const { service, objects } = build();
    const size = FILE_PART_BYTES + 3;
    const ticket = await ticketOf(service, size);
    expect(await service.putPart(ticket.uploadId, 2, bytes(3, 2))).toEqual({ ok: true, value: true });
    expect(await service.putPart(ticket.uploadId, 1, bytes(FILE_PART_BYTES, 1))).toEqual({ ok: true, value: true });
    const link = await service.complete(ticket.uploadId);
    expect(link).toEqual({ ok: true, value: { url: 'https://x.test/s/tok4', ttlMinutes: 15 } });
    expect(await service.peek('tok4')).toEqual({ name: 'dump.sql', size, contentType: 'application/sql' });

    const opened = await service.open('tok4');
    expect(opened).toMatchObject({ name: 'dump.sql', size });
    const content = await readAll(opened?.body ?? new ReadableStream());
    expect(content.length).toBe(size);
    expect([content[0], content[FILE_PART_BYTES - 1], content[FILE_PART_BYTES]]).toEqual([1, 1, 2]);
    expect(await service.open('tok4')).toBeUndefined();
    expect(await service.peek('tok4')).toBeUndefined();
    await opened?.dispose();
    expect(objects.size()).toBe(0);
  });

  test('a part of the wrong length, a missing part and an unknown upload are refused (AC-1.5, AC-1.6, AC-1.8)', async () => {
    const { service } = build();
    const ticket = await ticketOf(service, FILE_PART_BYTES + 3);
    expect(await service.putPart(ticket.uploadId, 1, bytes(5))).toEqual({
      ok: false,
      error: { kind: 'invalid', message: `Part 1 must be exactly ${String(FILE_PART_BYTES)} bytes.` },
    });
    expect(await service.putPart(ticket.uploadId, 3, bytes(3))).toMatchObject({ ok: false, error: { kind: 'invalid' } });
    expect(await service.complete(ticket.uploadId)).toEqual({ ok: false, error: { kind: 'invalid', message: 'Upload parts 1, 2 first.' } });
    expect(await service.putPart('nope', 1, bytes(3))).toEqual({ ok: false, error: { kind: 'missing' } });
    expect(await service.complete('nope')).toEqual({ ok: false, error: { kind: 'missing' } });
  });

  test('a session completes once; abort discards it (AC-1.6, AC-1.7)', async () => {
    const { service, objects } = build();
    const ticket = await ticketOf(service, 4);
    await service.putPart(ticket.uploadId, 1, bytes(4));
    expect((await service.complete(ticket.uploadId)).ok).toBe(true);
    expect(await service.complete(ticket.uploadId)).toEqual({ ok: false, error: { kind: 'missing' } });

    const aborted = await ticketOf(service, 4);
    await service.putPart(aborted.uploadId, 1, bytes(4));
    expect(await service.abort(aborted.uploadId)).toBe(true);
    expect(await service.abort(aborted.uploadId)).toBe(false);
    expect(await service.putPart(aborted.uploadId, 1, bytes(4))).toEqual({ ok: false, error: { kind: 'missing' } });
    expect(objects.pendingUploads()).toBe(0);
  });

  test('a signed-in upload honours the account lifetime (AC-1.1)', async () => {
    const { service } = build();
    const begun = await service.begin({ kind: 'user', userId: USER }, { name: 'a', size: 1, contentType: '' });
    const uploadId = begun.ok ? begun.value.uploadId : '';
    await service.putPart(uploadId, 1, bytes(1));
    expect(await service.complete(uploadId)).toMatchObject({ ok: true, value: { ttlMinutes: 30 } });
  });

  test('sessions die after an hour, links after their lifetime; sweep deletes what is left (AC-1.8, AC-3.1)', async () => {
    const { service, objects, advance } = build();
    const stale = await ticketOf(service, 4);
    await service.putPart(stale.uploadId, 1, bytes(4));
    const done = await ticketOf(service, 4);
    await service.putPart(done.uploadId, 1, bytes(4));
    const link = await service.complete(done.uploadId);
    const token = link.ok ? (link.value.url.split('/').pop() ?? '') : '';
    advance(60 * MINUTE);
    expect(await service.putPart(stale.uploadId, 1, bytes(4))).toEqual({ ok: false, error: { kind: 'missing' } });
    expect(await service.peek(token)).toBeUndefined();
    expect(await service.open(token)).toBeUndefined();
    await service.sweep();
    expect(objects.size()).toBe(0);
    expect(objects.pendingUploads()).toBe(0);
  });

  test('shareBytes stores a small file in one go under the account lifetime (AC-7.1)', async () => {
    const { service } = build();
    const link = await service.shareBytes(USER, { name: 'note.txt', contentType: 'text/plain' }, bytes(10));
    expect(link).toEqual({ ok: true, value: { url: 'https://x.test/s/tok2', ttlMinutes: 30 } });
    const opened = await service.open('tok2');
    expect((await readAll(opened?.body ?? new ReadableStream())).length).toBe(10);
  });
});
