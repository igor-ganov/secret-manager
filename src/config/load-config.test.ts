import { describe, expect, test } from 'bun:test';
import { loadConfig } from './load-config.ts';

describe('loadConfig', () => {
  test('loads required values and applies defaults', () => {
    const config = loadConfig({ BOT_TOKEN: 'token-123' });
    expect(config).toEqual({
      botToken: 'token-123',
      port: 3000,
      baseUrl: 'http://localhost:3000',
      databasePath: 'secrets.sqlite',
      linkTtlMinutes: 5,
    });
  });

  test('uses explicit values when provided', () => {
    const config = loadConfig({
      BOT_TOKEN: 'token-123',
      PORT: '8080',
      BASE_URL: 'https://secrets.example.com',
      DATABASE_PATH: 'data/secrets.sqlite',
      LINK_TTL_MINUTES: '10',
    });
    expect(config.port).toBe(8080);
    expect(config.baseUrl).toBe('https://secrets.example.com');
    expect(config.databasePath).toBe('data/secrets.sqlite');
    expect(config.linkTtlMinutes).toBe(10);
  });

  test('throws when the bot token is missing', () => {
    expect(() => loadConfig({})).toThrow('BOT_TOKEN');
  });

  test('throws on a non-numeric port', () => {
    expect(() => loadConfig({ BOT_TOKEN: 't', PORT: 'not-a-number' })).toThrow('PORT');
  });
});
