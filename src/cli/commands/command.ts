import type { ApiClient, ApiCredentials, DeviceClient } from '../api/api-client.ts';
import type { ConfigStore } from '../config/create-config-store.ts';
import type { ConsoleIo } from '../io/console-io.ts';
import type { CallbackListener } from '../io/create-callback-listener.ts';
import type { Outcome } from '../outcome.ts';

export type CommandContext = {
  readonly io: ConsoleIo;
  readonly config: ConfigStore;
  readonly createClient: (credentials: ApiCredentials) => ApiClient;
  readonly createDeviceClient: (serverUrl: string) => DeviceClient;
  /* Whole standard input, for values given as `-`. */
  readonly readStdin: () => Promise<string>;
  readonly defaultServerUrl: string | undefined;
  /* Name shown to the account owner when this device asks to be approved. */
  readonly deviceLabel: string;
  /* Loopback listener the browser returns to after approval. */
  readonly listen: () => CallbackListener;
  readonly openBrowser: (url: string) => Promise<boolean>;
  readonly now: () => number;
};

export type Command = {
  readonly name: string;
  readonly usage: string;
  readonly description: string;
  readonly run: (context: CommandContext, args: readonly string[]) => Promise<Outcome>;
};
