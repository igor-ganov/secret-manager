import { describe, expect, test } from 'bun:test';
import {
  buildCallbackData,
  parseCallbackData,
  type CallbackAction,
} from './callback-data.ts';

const ROUND_TRIP_ACTIONS: readonly CallbackAction[] = [
  { kind: 'get', key: 'api-key' },
  { kind: 'set', key: 'api-key' },
  { kind: 'delete-request', key: 'api-key' },
  { kind: 'delete-confirm', key: 'api-key' },
  { kind: 'set-ttl', minutes: 15 },
  { kind: 'cancel-set' },
  { kind: 'cancel-delete' },
  { kind: 'noop' },
];

describe('callback data', () => {
  test.each(ROUND_TRIP_ACTIONS.map((action) => [action] as const))(
    'round-trips %j',
    (action) => {
      expect(parseCallbackData(buildCallbackData(action))).toEqual(action);
    },
  );

  test('rejects unknown payloads', () => {
    expect(parseCallbackData('x:whatever')).toBeUndefined();
    expect(parseCallbackData('')).toBeUndefined();
    expect(parseCallbackData('g:')).toBeUndefined();
    expect(parseCallbackData('t:abc')).toBeUndefined();
    expect(parseCallbackData('t:0')).toBeUndefined();
    expect(parseCallbackData('t:-5')).toBeUndefined();
  });
});
