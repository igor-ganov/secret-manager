import type { ConsoleIo } from './console-io.ts';
import type { LineReader } from './create-line-reader.ts';

export type LineStreams = {
  readonly nextLine: LineReader;
  readonly stdout: { readonly write: (text: string) => unknown };
  readonly stderr: { readonly write: (text: string) => unknown };
};

/* Piped io: every prompt, visible or hidden, is answered by the next input
   line and nothing is echoed, so scripts and tests drive the same flow. */
export const createLineIo = ({ nextLine, stdout, stderr }: LineStreams): ConsoleIo => ({
  interactive: false,
  print: (text) => {
    stdout.write(`${text}\n`);
  },
  printError: (text) => {
    stderr.write(`${text}\n`);
  },
  ask: () => nextLine(),
  askHidden: () => nextLine(),
});
