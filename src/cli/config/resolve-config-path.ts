import { posix, win32 } from 'node:path';

export type PathEnvironment = {
  readonly platform: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly homeDir: string;
};

const APP_DIR = 'secret-manager';
const FILE_NAME = 'config.json';

/* SECRET_MANAGER_CONFIG overrides everything (tests, portable installs);
   otherwise %APPDATA% on Windows and the XDG config dir elsewhere. */
export const resolveConfigPath = ({ platform, env, homeDir }: PathEnvironment): string => {
  const override = env['SECRET_MANAGER_CONFIG'];
  if (override !== undefined && override !== '') {
    return override;
  }
  if (platform === 'win32') {
    const base = env['APPDATA'] ?? win32.join(homeDir, 'AppData', 'Roaming');
    return win32.join(base, APP_DIR, FILE_NAME);
  }
  const base = env['XDG_CONFIG_HOME'] ?? posix.join(homeDir, '.config');
  return posix.join(base, APP_DIR, FILE_NAME);
};
