import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseCliConfig, type CliConfig } from './cli-config.ts';

export type ConfigStore = {
  readonly path: string;
  readonly read: () => Promise<CliConfig>;
  readonly write: (config: CliConfig) => Promise<void>;
};

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export const createConfigStore = (path: string): ConfigStore => {
  const read = async (): Promise<CliConfig> => {
    try {
      return parseCliConfig(parseJson(await readFile(path, 'utf8')));
    } catch {
      return {};
    }
  };

  /* Mode 0o600 keeps the token private on POSIX; Windows ignores it and
     %APPDATA% is already per-user. */
  const write = async (config: CliConfig): Promise<void> => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(config, undefined, 2)}\n`, { mode: 0o600 });
  };

  return { path, read, write };
};
