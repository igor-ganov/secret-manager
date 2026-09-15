import type { CommandContext } from './commands/command.ts';
import { splitCommandLine } from './io/split-command-line.ts';
import { EXIT } from './outcome.ts';
import { runCommand } from './run-command.ts';

const PROMPT = 'secret> ';
const EXIT_WORDS = new Set(['exit', 'quit']);
const WELCOME = 'Interactive session. Type help for commands, exit to leave.';

/* Reads command lines until exit/quit or end of input; errors are printed
   and the session continues. */
export const runSession = async (context: CommandContext): Promise<number> => {
  if (context.io.interactive) {
    context.io.print(WELCOME);
  }
  for (;;) {
    const line = await context.io.ask(PROMPT);
    if (line === undefined) {
      return EXIT.ok;
    }
    const argv = splitCommandLine(line);
    const [name] = argv;
    if (name !== undefined && EXIT_WORDS.has(name)) {
      return EXIT.ok;
    }
    if (name !== undefined) {
      await runCommand(context, argv);
    }
  }
};
