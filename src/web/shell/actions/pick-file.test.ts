import { describe, expect, test } from 'bun:test';
import type { AppState } from '../../state/app-state.ts';
import { createStore } from '../../state/create-store.ts';
import { initialState } from '../../state/initial-state.ts';
import { pickFile, removeFile } from './pick-file.ts';

/* A File whose size is declared, not allocated. */
const sized = (name: string, size: number): File => {
  const file = new File([], name);
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const build = () => createStore<AppState>({ ...initialState, session: { kind: 'anonymous' }, error: 'old' });

describe('pickFile (secret-files AC-4.1, AC-4.2)', () => {
  test('keeps a file of up to 100 MiB and the text typed so far', () => {
    const store = build();
    const file = sized('ok.bin', 100 * 1024 * 1024);
    pickFile({ store })(file, 'typed');
    expect(store.get()).toMatchObject({ file, quickDraft: 'typed', error: undefined });
  });

  test('refuses a larger or an empty file with an alert and keeps nothing', () => {
    const store = build();
    pickFile({ store })(sized('huge.iso', 100 * 1024 * 1024 + 1), '');
    expect(store.get()).toMatchObject({ file: undefined, error: 'The file is larger than 100 MiB.' });
    pickFile({ store })(sized('empty.txt', 0), '');
    expect(store.get()).toMatchObject({ file: undefined, error: 'The file is empty.' });
  });

  test('removeFile forgets the chosen file', () => {
    const store = build();
    pickFile({ store })(sized('a', 1), '');
    removeFile({ store })();
    expect(store.get().file).toBeUndefined();
  });
});
