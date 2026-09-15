import type { ConsoleIo } from './console-io.ts';
import type { LineReader } from './create-line-reader.ts';

export type LineStreams = {
  readonly nextLine: LineReader;
  readonly stdout: { readonly write: (text: string) => unknown };
  readonly stderr: { readonly write: (text: string) => unknown };
};

/* Piped io: every prompt, visible or hidden, is answered by the next input
   line and nothing is echoed, so scripts and tests drive the same flow. A
   prompt withdrawn through its signal keeps its line for the next prompt. */
export const createLineIo = ({ nextLine, stdout, stderr }: LineStreams): ConsoleIo => {
  let unconsumed: Promise<string | undefined> | undefined;

  const takeLine = (): Promise<string | undefined> => {
    const line = unconsumed ?? nextLine();
    unconsumed = undefined;
    return line;
  };

  const ask = (_prompt: string, signal?: AbortSignal): Promise<string | undefined> => {
    const line = takeLine();
    if (signal === undefined) {
      return line;
    }
    return new Promise((resolve) => {
      signal.addEventListener('abort', () => {
        unconsumed = line;
        resolve(undefined);
      });
      void line.then((value) => {
        if (!signal.aborted) {
          resolve(value);
        }
      });
    });
  };

  return {
    interactive: false,
    print: (text) => {
      stdout.write(`${text}\n`);
    },
    printError: (text) => {
      stderr.write(`${text}\n`);
    },
    ask,
    askHidden: () => takeLine(),
  };
};
