import { EXIT, failed, succeeded, type Outcome } from '../outcome.ts';
import { ABORTED } from './aborted.ts';
import type { Command, CommandContext } from './command.ts';
import { toOutcome } from './to-outcome.ts';

const EXPIRED = 'The login request expired, was denied, or the code was wrong. Run: login';
const OPEN_HINT = 'Open this link if the browser did not open by itself:';
const WAIT_HINT = 'Waiting for the browser to come back. If it does not, type the code shown on the page.';

/* Argument → stored → built-in default; the prompt is the last resort for a
   build without a baked-in server. */
const resolveServerUrl = async (context: CommandContext, argument: string | undefined): Promise<string | undefined> => {
  const known = argument ?? (await context.config.read()).serverUrl ?? context.defaultServerUrl;
  if (known !== undefined && known !== '') {
    return known;
  }
  const typed = await context.io.ask('Server URL: ');
  return typed === undefined ? undefined : typed.trim();
};

const never = (): Promise<string> => new Promise<string>(() => undefined);

/* Only a person can read the code off the page: with piped input the
   prompt is skipped (it would swallow the next scripted line), and an empty
   answer keeps waiting for the browser until the request expires. */
const typedGrant = async (context: CommandContext, signal: AbortSignal): Promise<string> => {
  if (!context.io.interactive) {
    return never();
  }
  const typed = (await context.io.ask('Code: ', signal))?.trim();
  return typed === undefined || typed === '' ? never() : typed;
};

const expiry = (context: CommandContext, expiresAt: number): Promise<undefined> =>
  new Promise((resolve) => setTimeout(() => resolve(undefined), Math.max(0, expiresAt - context.now())));

/* Whichever comes first: the browser hitting the loopback callback with the
   grant, the person typing the fallback code, or the request expiring. */
const waitForGrant = async (context: CommandContext, callback: Promise<string>, expiresAt: number): Promise<string | undefined> => {
  const controller = new AbortController();
  try {
    return await Promise.race([callback, typedGrant(context, controller.signal), expiry(context, expiresAt)]);
  } finally {
    controller.abort();
  }
};

export const login: Command = {
  name: 'login',
  usage: 'login [server-url]',
  description: 'Link this device to your account through the web site',
  run: async (context, [argument]): Promise<Outcome> => {
    const serverUrl = await resolveServerUrl(context, argument);
    if (serverUrl === undefined) {
      return ABORTED;
    }
    if (serverUrl === '') {
      return failed('A server URL is required: login <server-url>', EXIT.usage);
    }
    const device = context.createDeviceClient(serverUrl);
    const listener = context.listen();
    try {
      return await toOutcome(await device.start(context.deviceLabel, listener.callbackUrl), async ({ url, deviceSecret, expiresAt }) => {
        await context.openBrowser(url);
        context.io.print(OPEN_HINT);
        context.io.print(url);
        context.io.print(WAIT_HINT);
        const grant = await waitForGrant(context, listener.grant, expiresAt);
        if (grant === undefined) {
          return failed(EXPIRED, EXIT.auth);
        }
        return toOutcome(await device.claim(deviceSecret, grant), async ({ token }) =>
          toOutcome(await context.createClient({ serverUrl, token }).me(), async (me) => {
            await context.config.write({ serverUrl, token });
            context.io.print(`Logged in as ${me.name} (${me.id}). Config: ${context.config.path}`);
            return succeeded;
          }),
        );
      });
    } finally {
      listener.close();
    }
  },
};
