import type { CommandContext } from './command.ts';

const STDIN_MARKER = '-';

/* Where a secret value comes from, in order of preference for safety:
   hidden prompt (nothing on the command line), stdin pipe (`-`), argument. */
export const resolveValue = async (
  { io, readStdin }: CommandContext,
  provided: string | undefined,
  prompt: string,
): Promise<string | undefined> => {
  if (provided === undefined) {
    return io.askHidden(prompt);
  }
  if (provided === STDIN_MARKER) {
    return (await readStdin()).replace(/\r?\n$/, '');
  }
  return provided;
};
