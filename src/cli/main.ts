import { homedir } from 'node:os';
import { createApiClient } from './api/create-api-client.ts';
import type { CommandContext } from './commands/command.ts';
import { createConfigStore } from './config/create-config-store.ts';
import { resolveConfigPath } from './config/resolve-config-path.ts';
import { resolveDefaultServerUrl } from './config/resolve-default-server-url.ts';
import type { ConsoleIo } from './io/console-io.ts';
import { createConsoleIo } from './io/create-console-io.ts';
import { createLineIo } from './io/create-line-io.ts';
import { createLineReader } from './io/create-line-reader.ts';
import { runCommand } from './run-command.ts';
import { runSession } from './run-session.ts';

const createIo = (): ConsoleIo =>
  process.stdin.isTTY
    ? createConsoleIo({ stdin: process.stdin, stdout: process.stdout, stderr: process.stderr })
    : createLineIo({ nextLine: createLineReader(Bun.stdin.stream()), stdout: process.stdout, stderr: process.stderr });

const context: CommandContext = {
  io: createIo(),
  config: createConfigStore(resolveConfigPath({ platform: process.platform, env: process.env, homeDir: homedir() })),
  createClient: createApiClient((input, init) => fetch(input, init)),
  readStdin: () => Bun.stdin.text(),
  defaultServerUrl: resolveDefaultServerUrl(process.env),
};

const argv = process.argv.slice(2);
const code = argv.length === 0 ? await runSession(context) : await runCommand(context, argv);
process.exit(code);
