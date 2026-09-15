import { describe, expect, test } from 'bun:test';
import { splitCommandLine } from './split-command-line.ts';

describe('splitCommandLine', () => {
  test('splits on whitespace and trims', () => {
    expect(splitCommandLine('  set  key   value ')).toEqual(['set', 'key', 'value']);
    expect(splitCommandLine('')).toEqual([]);
    expect(splitCommandLine('   ')).toEqual([]);
  });

  test('keeps quoted words together', () => {
    expect(splitCommandLine('set key "two words"')).toEqual(['set', 'key', 'two words']);
    expect(splitCommandLine("share 'it''s'")).toEqual(['share', 'its']);
    expect(splitCommandLine('share ""')).toEqual(['share', '']);
  });

  test('tolerates an unclosed quote', () => {
    expect(splitCommandLine('share "open')).toEqual(['share', 'open']);
  });
});
