import type { ReadStream, WriteStream } from 'node:tty';

const ENTER = new Set(['\r', '\n']);
const BACKSPACE = new Set(['', '\b']);
const CTRL_C = '';
const CTRL_D = '';

/* Reads one line in raw mode without echo. Enter finishes, Backspace edits,
   Ctrl+C aborts (undefined) so a half-typed secret is never printed. */
export const readHiddenLine = (
  stdin: ReadStream,
  stdout: WriteStream,
  prompt: string,
): Promise<string | undefined> =>
  new Promise((resolve) => {
    let buffer = '';
    const finish = (value: string | undefined): void => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      resolve(value);
    };
    const onKey = (key: string): void => {
      if (ENTER.has(key)) {
        finish(buffer);
      } else if (key === CTRL_C) {
        finish(undefined);
      } else if (key === CTRL_D) {
        finish(buffer);
      } else if (BACKSPACE.has(key)) {
        buffer = buffer.slice(0, -1);
      } else {
        buffer += key;
      }
    };
    const onData = (chunk: Buffer | string): void => {
      Array.from(chunk.toString()).forEach(onKey);
    };
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    stdin.on('data', onData);
  });
