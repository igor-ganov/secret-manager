import type { CommandContext } from './commands/command.ts';
import { redactSecretLine } from './commands/redact-secret-line.ts';
import { splitCommandLine } from './io/split-command-line.ts';
import { EXIT } from './outcome.ts';
import { runCommand } from './run-command.ts';

const PROMPT = 'secret> ';
const EXIT_WORDS = new Set(['exit', 'quit']);
const WELCOME = 'Interactive session. Type help for commands, exit to leave.';
const HISTORY_SIZE = 50;

/* Reads command lines until exit/quit or end of input; errors are printed
   and the session continues. A line that carried a secret inline is wiped
   from the screen at once and never enters the arrow-key history. */
export const runSession = async (context: CommandContext): Promise<number> => {
  const { io } = context;
  let history: readonly string[] = [];
  if (io.interactive) {
    io.print(WELCOME);
  }
  for (;;) {
    const line = await io.ask(PROMPT, undefined, history);
    if (line === undefined) {
      return EXIT.ok;
    }
    const argv = splitCommandLine(line);
    const [name] = argv;
    if (name !== undefined && EXIT_WORDS.has(name)) {
      return EXIT.ok;
    }
    const redacted = redactSecretLine(argv);
    if (redacted !== undefined) {
      io.replaceLastLine(`${PROMPT}${redacted}`);
    }
    if (redacted === undefined && line.trim() !== '') {
      history = [line, ...history.filter((entry) => entry !== line)].slice(0, HISTORY_SIZE);
    }
    if (name !== undefined) {
      await runCommand(context, argv);
    }
  }
};
