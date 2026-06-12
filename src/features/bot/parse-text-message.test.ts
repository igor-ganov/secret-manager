import { describe, expect, test } from 'bun:test';
import { parseTextMessage } from './parse-text-message.ts';

describe('parseTextMessage', () => {
  test('parses a key and a value separated by a space', () => {
    expect(parseTextMessage('api-key secret-value')).toEqual({
      kind: 'pair',
      key: 'api-key',
      value: 'secret-value',
    });
  });

  test('keeps whitespace inside the value', () => {
    expect(parseTextMessage('api-key multi word value')).toEqual({
      kind: 'pair',
      key: 'api-key',
      value: 'multi word value',
    });
  });

  test('treats a single token as a bare value', () => {
    expect(parseTextMessage('just-a-secret')).toEqual({
      kind: 'single',
      value: 'just-a-secret',
    });
  });

  test('trims surrounding whitespace', () => {
    expect(parseTextMessage('  api-key   value  ')).toEqual({
      kind: 'pair',
      key: 'api-key',
      value: 'value',
    });
  });

  test('detects an empty message', () => {
    expect(parseTextMessage('   ')).toEqual({ kind: 'empty' });
  });

  test('splits on a newline separator as well', () => {
    expect(parseTextMessage('api-key\nline value')).toEqual({
      kind: 'pair',
      key: 'api-key',
      value: 'line value',
    });
  });
});
