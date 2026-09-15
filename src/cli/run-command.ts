import type { CommandContext } from './commands/command.ts';
import { findCommand } from './commands/commands.ts';
import { EXIT, type Outcome } from './outcome.ts';

const USAGE_HINT = 'Unknown command. Run: help';

const report = (context: CommandContext, outcome: Outcome): number => {
  switch (outcome.kind) {
    case 'ok':
      return EXIT.ok;
    case 'error':
      context.io.printError(outcome.message);
      return outcome.code;
  }
};

/* Dispatches one command line (argument mode or a session line) and turns
   its outcome into an exit code, printing any error to stderr. */
export const runCommand = async (context: CommandContext, argv: readonly string[]): Promise<number> => {
  const [name, ...args] = argv;
  const command = name === undefined ? undefined : findCommand(name);
  if (command === undefined) {
    context.io.printError(USAGE_HINT);
    return EXIT.usage;
  }
  return report(context, await command.run(context, args));
};
