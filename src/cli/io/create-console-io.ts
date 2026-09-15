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
   readline and the raw-mode hidden reader from fighting over stdin. */
export const createConsoleIo = ({ stdin, stdout, stderr }: ConsoleStreams): ConsoleIo => {
  const ask = async (prompt: string): Promise<string | undefined> => {
    const readline = createInterface({ input: stdin, output: stdout, terminal: true });
    const closed = new Promise<undefined>((resolve) => readline.once('close', () => resolve(undefined)));
    try {
      return await Promise.race([readline.question(prompt), closed]);
    } finally {
      readline.close();
    }
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
  };
};
