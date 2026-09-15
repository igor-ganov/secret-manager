import { describe, expect, test } from 'bun:test';
import { resolveConfigPath } from './resolve-config-path.ts';
import { parseCliConfig } from './cli-config.ts';

describe('resolveConfigPath (AC-2.2)', () => {
  test('uses %APPDATA% on Windows', () => {
    const path = resolveConfigPath({ platform: 'win32', env: { APPDATA: 'C:\\Users\\u\\AppData\\Roaming' }, homeDir: 'C:\\Users\\u' });
    expect(path).toBe('C:\\Users\\u\\AppData\\Roaming\\secret-manager\\config.json');
  });

  test('uses XDG_CONFIG_HOME, falling back to ~/.config, elsewhere', () => {
    expect(resolveConfigPath({ platform: 'linux', env: { XDG_CONFIG_HOME: '/xdg' }, homeDir: '/home/u' })).toBe(
      '/xdg/secret-manager/config.json',
    );
    expect(resolveConfigPath({ platform: 'linux', env: {}, homeDir: '/home/u' })).toBe(
      '/home/u/.config/secret-manager/config.json',
    );
  });

  test('SECRET_MANAGER_CONFIG overrides the location', () => {
    expect(resolveConfigPath({ platform: 'win32', env: { SECRET_MANAGER_CONFIG: 'X:\\c.json' }, homeDir: '' })).toBe('X:\\c.json');
  });
});

describe('parseCliConfig', () => {
  test('keeps only non-empty string fields', () => {
    expect(parseCliConfig({ serverUrl: 'https://s', token: 't', extra: 1 })).toEqual({ serverUrl: 'https://s', token: 't' });
    expect(parseCliConfig({ serverUrl: '', token: 5 })).toEqual({});
    expect(parseCliConfig('nope')).toEqual({});
  });
});
