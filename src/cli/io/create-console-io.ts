import { clearLine, cursorTo, moveCursor } from 'node:readline';
import { createInterface } from 'node:readline/promises';
import type { ReadStream, WriteStream } from 'node:tty';
import type { ConsoleIo } from './console-io.ts';
import { readHiddenLine } from './read-hidden-line.ts';

export type ConsoleStreams = {
  readonly stdin: ReadStream;
  readonly stdout: WriteStream;
  readonly stderr: WriteStream;
};

/* Terminal-backed io. A fresh readline interface per visible prompt keeps
   readline and the raw-mode hidden reader from fighting over stdin; the
   recallable history is handed in by the caller, so it never holds secrets. */
export const createConsoleIo = ({ stdin, stdout, stderr }: ConsoleStreams): ConsoleIo => {
  const ask = async (prompt: string, signal?: AbortSignal, history: readonly string[] = []): Promise<string | undefined> => {
    const readline = createInterface({ input: stdin, output: stdout, terminal: true, history: [...history] });
    const closed = new Promise<undefined>((resolve) => readline.once('close', () => resolve(undefined)));
    const question = signal === undefined ? readline.question(prompt) : readline.question(prompt, { signal });
    try {
      return await Promise.race([question, closed]);
    } catch {
      /* Aborted through the signal: the answer came from elsewhere. */
      return undefined;
    } finally {
      readline.close();
      stdout.write(signal?.aborted === true ? '\n' : '');
    }
  };

  /* The submitted line sits one row above the cursor: go up, wipe it,
     write the replacement, come back down. */
  const replaceLastLine = (text: string): void => {
    moveCursor(stdout, 0, -1);
    cursorTo(stdout, 0);
    clearLine(stdout, 0);
    stdout.write(`${text}\n`);
  };

  return {
    interactive: true,
    print: (text) => {
      stdout.write(`${text}\n`);
    },
    printError: (text) => {
      stderr.write(`${text}\n`);
    },
    ask,
    askHidden: (prompt) => readHiddenLine(stdin, stdout, prompt),
    replaceLastLine,
  };
};
