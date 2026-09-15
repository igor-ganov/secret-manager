import { describe, expect, test } from 'bun:test';
import { describeWebauthnError } from './describe-webauthn-error.ts';
import { runCeremony } from './run-ceremony.ts';

describe('runCeremony', () => {
  test('threads options through the ceremony into verification', async () => {
    const result = await runCeremony(
      async () => ({ ok: true, value: { options: { challenge: 'c' } } }),
      async (options) => ({ ok: true, value: { echoed: options } }),
      async (response) => ({ ok: true, value: JSON.stringify(response) }),
    );
    expect(result).toEqual({ ok: true, value: '{"echoed":{"challenge":"c"}}' });
  });

  test('short-circuits on the first failure', async () => {
    const noOptions = await runCeremony(
      async () => ({ ok: false, error: 'no options' }),
      async () => ({ ok: true, value: {} }),
      async () => ({ ok: true, value: 1 }),
    );
    const cancelled = await runCeremony(
      async () => ({ ok: true, value: { options: {} } }),
      async () => ({ ok: false, error: 'cancelled' }),
      async () => ({ ok: true, value: 1 }),
    );
    expect(noOptions).toEqual({ ok: false, error: 'no options' });
    expect(cancelled).toEqual({ ok: false, error: 'cancelled' });
  });
});

describe('describeWebauthnError', () => {
  test('uses the error message when there is one', () => {
    expect(describeWebauthnError(new Error('The operation was cancelled.'))).toBe('The operation was cancelled.');
    expect(describeWebauthnError('x')).toBe('The passkey operation did not complete.');
  });
});
