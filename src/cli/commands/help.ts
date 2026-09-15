import { succeeded } from '../outcome.ts';
import type { Command } from './command.ts';

export const HELP_LINES: readonly string[] = [
  'secret — one-time links and per-user secrets, same account as the Telegram bot.',
  '',
  'Run without arguments for an interactive session (secret values are typed',
  'hidden, nothing lands in the shell history). Commands:',
];

export const createHelp = (commands: () => readonly Command[]): Command => ({
  name: 'help',
  usage: 'help',
  description: 'Show this list',
  run: async ({ io }) => {
    const rows = [...commands().map((command) => [command.usage, command.description]), ['exit', 'Leave the interactive session']];
    const width = Math.max(...rows.map(([usage]) => usage?.length ?? 0));
    HELP_LINES.forEach((line) => io.print(line));
    rows.forEach(([usage, description]) => io.print(`  ${(usage ?? '').padEnd(width)}  ${description}`));
    return succeeded;
  },
});
