import type { DeviceClient } from '../api/api-client.ts';
import { EXIT, failed, succeeded, type Outcome } from '../outcome.ts';
import { ABORTED } from './aborted.ts';
import type { Command, CommandContext } from './command.ts';
import { toOutcome } from './to-outcome.ts';

const POLL_INTERVAL_MS = 2000;
const EXPIRED = 'The login request expired or was denied. Run: login';

const askServerUrl = async (context: CommandContext): Promise<string | undefined> => {
  const stored = (await context.config.read()).serverUrl ?? context.defaultServerUrl;
  const hint = stored === undefined ? '' : ` [${stored}]`;
  const typed = await context.io.ask(`Server URL${hint}: `);
  return typed === undefined ? undefined : typed.trim() || stored;
};

/* Polls until the owner answers on the site; a 410 means expired/denied. */
const waitForApproval = async (
  context: CommandContext,
  device: DeviceClient,
  pollToken: string,
  expiresAt: number,
): Promise<string | undefined> => {
  while (Date.now() < expiresAt) {
    const polled = await device.poll(pollToken);
    if (!polled.ok) {
      return undefined;
    }
    if (polled.value.status === 'approved') {
      return polled.value.token;
    }
    await context.sleep(POLL_INTERVAL_MS);
  }
  return undefined;
};

/* No credential is typed here: the device asks, the owner approves on the
   site with a passkey, and the token arrives through the poll. */
export const login: Command = {
  name: 'login',
  usage: 'login',
  description: 'Link this device to your account through the web site',
  run: async (context): Promise<Outcome> => {
    const serverUrl = await askServerUrl(context);
    if (serverUrl === undefined) {
      return ABORTED;
    }
    if (serverUrl === '') {
      return failed('A server URL is required.', EXIT.usage);
    }
    const device = context.createDeviceClient(serverUrl);
    return toOutcome(await device.start(context.deviceLabel), async ({ url, pollToken, expiresAt }) => {
      context.io.print('Open this link, sign in with your passkey and approve this device:');
      context.io.print(url);
      context.io.print('Waiting for approval…');
      const token = await waitForApproval(context, device, pollToken, expiresAt);
      if (token === undefined) {
        return failed(EXPIRED, EXIT.auth);
      }
      return toOutcome(await context.createClient({ serverUrl, token }).me(), async (me) => {
        await context.config.write({ serverUrl, token });
        context.io.print(`Logged in as ${me.name} (${me.id}). Config: ${context.config.path}`);
        return succeeded;
      });
    });
  },
};
