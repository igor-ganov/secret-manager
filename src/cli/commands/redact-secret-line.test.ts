import { describe, expect, test } from 'bun:test';
import { redactSecretLine } from './redact-secret-line.ts';

describe('redactSecretLine (cli AC-1.6)', () => {
  test('masks inline values of share and set', () => {
    expect(redactSecretLine(['share', 'hunter2'])).toBe('share ••••');
    expect(redactSecretLine(['set', 'db', 'hunter2'])).toBe('set db ••••');
    expect(redactSecretLine(['set', 'db', 'two', 'words'])).toBe('set db ••••');
  });

  test('leaves lines without an inline secret alone', () => {
    expect(redactSecretLine(['share'])).toBeUndefined();
    expect(redactSecretLine(['set', 'db'])).toBeUndefined();
    expect(redactSecretLine(['get', 'db'])).toBeUndefined();
    expect(redactSecretLine(['list'])).toBeUndefined();
    expect(redactSecretLine([])).toBeUndefined();
  });
});
