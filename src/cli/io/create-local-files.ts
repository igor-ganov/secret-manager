import type { Stats } from 'node:fs';
import { rename, rm, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { LocalFile, LocalFiles } from './local-files.ts';

const statOf = async (path: string): Promise<Stats | undefined> => {
  try {
    return await stat(path);
  } catch {
    return undefined;
  }
};

/* The real disk for the utility and its MCP server (secret-files US-5, US-6). */
export const createLocalFiles = (workingFolder: () => string): LocalFiles => {
  const absolute = (path: string): string => resolve(workingFolder(), path);

  const statFile = async (path: string): Promise<LocalFile | undefined> => {
    const info = await statOf(absolute(path));
    return info?.isFile() === true ? { name: basename(path), size: info.size, contentType: Bun.file(absolute(path)).type } : undefined;
  };

  /* Chunk by chunk through a FileSink (Bun.write of a Response wrapping a
     large network stream never settles in Bun 1.3), into `<path>.part`
     first and renamed once complete: a cut download never sits under the
     real name. */
  const write = async (path: string, body: ReadableStream<Uint8Array>): Promise<number> => {
    const target = absolute(path);
    const partial = `${target}.part`;
    const sink = Bun.file(partial).writer();
    try {
      let written = 0;
      for await (const chunk of body) {
        await sink.write(chunk);
        written += chunk.byteLength;
      }
      await sink.end();
      await rename(partial, target);
      return written;
    } catch (error) {
      await Promise.resolve(sink.end()).catch(() => undefined);
      await rm(partial, { force: true });
      throw error;
    }
  };

  return {
    stat: statFile,
    readRange: async (path, start, end) => new Uint8Array(await Bun.file(absolute(path)).slice(start, end).arrayBuffer()),
    exists: async (path) => (await statOf(absolute(path))) !== undefined,
    resolve: absolute,
    write,
    remove: (path) => rm(absolute(path), { force: true }),
  };
};
