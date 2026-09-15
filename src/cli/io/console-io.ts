/* Everything the commands need from the terminal. `undefined` from a prompt
   means the input ended or the user aborted (Ctrl+C during hidden input). */
export type ConsoleIo = {
  /* True when prompts are shown to a person; false when lines are piped. */
  readonly interactive: boolean;
  readonly print: (text: string) => void;
  readonly printError: (text: string) => void;
  readonly ask: (prompt: string) => Promise<string | undefined>;
  /* Nothing typed is echoed, so the value never appears on screen. */
  readonly askHidden: (prompt: string) => Promise<string | undefined>;
};
