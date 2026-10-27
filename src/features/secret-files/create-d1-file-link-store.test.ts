import { describe, expect, test } from 'bun:test';
import { Database, type SQLQueryBindings } from 'bun:sqlite';
import type { D1Database, D1PreparedStatement } from '../cloudflare/d1-types.ts';
import { createD1FileLinkStore } from './create-d1-file-link-store.ts';

/* D1's statement API over bun:sqlite, loaded with the real schema.sql, so the
   adapter's SQL (RETURNING, numbered parameters) runs against SQLite itself. */
const createSqliteD1 = async (): Promise<D1Database> => {
  const db = new Database(':memory:');
  db.exec(await Bun.file('schema.sql').text());
  const statement = (sql: string, values: readonly SQLQueryBindings[]): D1PreparedStatement => ({
    bind: (...next) => statement(sql, next),
    first: async <Row,>() => db.query<Row, SQLQueryBindings[]>(sql).get(...values),
    run: async () => db.query(sql).run(...values),
    all: async <Row,>() => ({ results: db.query<Row, SQLQueryBindings[]>(sql).all(...values) }),
  });
  return { prepare: (sql) => statement(sql, []) };
};

const SESSION = {
  uploadId: 'up-1',
  objectKey: 'obj-1',
  multipartId: 'mp-1',
  name: 'dump.sql',
  size: 10,
  contentType: 'application/sql',
  ttlMinutes: 15,
  expiresAt: 1000,
};

const FILE = { objectKey: 'obj-2', name: 'a.txt', size: 3, contentType: 'text/plain' };

const build = async () => {
  let currentTime = 0;
  let counter = 0;
  const store = createD1FileLinkStore({
    database: await createSqliteD1(),
    now: () => currentTime,
    createToken: () => `tok${String((counter += 1))}`,
  });
  return {
    store,
    at: (time: number) => {
      currentTime = time;
    },
  };
};

describe('createD1FileLinkStore over the real schema (secret-files §2)', () => {
  test('upload sessions keep their parts until they end, once (AC-1.5, AC-1.6, AC-1.8)', async () => {
    const { store, at } = await build();
    await store.beginUpload(SESSION);
    expect(await store.findUpload('up-1')).toEqual(SESSION);
    await store.recordPart('up-1', { partNumber: 2, etag: 'b' });
    await store.recordPart('up-1', { partNumber: 1, etag: 'a' });
    await store.recordPart('up-1', { partNumber: 1, etag: 'a2' });
    expect(await store.listParts('up-1')).toEqual([
      { partNumber: 1, etag: 'a2' },
      { partNumber: 2, etag: 'b' },
    ]);
    expect(await store.endUpload('up-1')).toEqual(SESSION);
    expect(await store.endUpload('up-1')).toBeUndefined();
    expect(await store.listParts('up-1')).toEqual([]);

    await store.beginUpload({ ...SESSION, uploadId: 'up-2' });
    at(1000);
    expect(await store.findUpload('up-2')).toBeUndefined();
    expect(await store.endUpload('up-2')).toBeUndefined();
    /* An expired session is left to the sweep, which reports it for abort. */
    expect((await store.sweep()).uploads).toEqual([{ objectKey: 'obj-1', multipartId: 'mp-1' }]);
  });

  test('claiming an expired link leaves it to the sweep, which reports its object (AC-3.1)', async () => {
    const { store, at } = await build();
    const token = await store.issue(FILE, 500);
    at(500);
    expect(await store.claim(token)).toBeUndefined();
    expect((await store.sweep()).objectKeys).toEqual(['obj-2']);
  });

  test('a file link is peeked freely and claimed once (AC-2.2, AC-2.5)', async () => {
    const { store } = await build();
    const token = await store.issue(FILE, 500);
    expect(token).toBe('tok1');
    expect(await store.peek(token)).toEqual(FILE);
    expect(await store.claim(token)).toEqual(FILE);
    expect(await store.claim(token)).toBeUndefined();
    expect(await store.peek(token)).toBeUndefined();
  });

  test('sweep returns and forgets expired links and sessions (AC-3.1)', async () => {
    const { store, at } = await build();
    const expired = await store.issue(FILE, 500);
    const alive = await store.issue({ ...FILE, objectKey: 'obj-3' }, 5000);
    await store.beginUpload(SESSION);
    await store.recordPart('up-1', { partNumber: 1, etag: 'a' });
    at(1000);
    expect(await store.claim(expired)).toBeUndefined();
    expect(await store.sweep()).toEqual({ objectKeys: ['obj-2'], uploads: [{ objectKey: 'obj-1', multipartId: 'mp-1' }] });
    expect(await store.sweep()).toEqual({ objectKeys: [], uploads: [] });
    expect(await store.listParts('up-1')).toEqual([]);
    expect(await store.peek(alive)).toEqual({ ...FILE, objectKey: 'obj-3' });
  });
});
