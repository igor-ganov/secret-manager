/* Everything the commands need from the terminal. `undefined` from a prompt
   means the input ended, the user aborted (Ctrl+C during hidden input), or
   the prompt was abandoned through its signal. */
export type ConsoleIo = {
  /* True when prompts are shown to a person; false when lines are piped. */
  readonly interactive: boolean;
  readonly print: (text: string) => void;
  readonly printError: (text: string) => void;
  /* `signal` withdraws the prompt (another event answered the question);
     `history` (newest first) is what the arrow keys recall. */
  readonly ask: (prompt: string, signal?: AbortSignal, history?: readonly string[]) => Promise<string | undefined>;
  /* Nothing typed is echoed, so the value never appears on screen. */
  readonly askHidden: (prompt: string) => Promise<string | undefined>;
  /* Overwrites the line just submitted (a secret typed inline). */
  readonly replaceLastLine: (text: string) => void;
};
