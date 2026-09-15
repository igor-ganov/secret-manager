import { createRecoveryCode, normalizeRecoveryCode } from '../accounts/recovery-code.ts';
import { sha256Hex } from '../crypto/sha256-hex.ts';
import { finishRegistration, startRegistration, storePasskey, type RegistrationFlowDeps } from '../passkeys/registration-flow.ts';
import type { CeremonyOptionsResponse, SignedInResponse } from './api-types.ts';
import { badRequest, jsonResponse } from './json-response.ts';
import { readJsonObject, readString } from './read-json-object.ts';
import type { Route } from './route.ts';
import type { SessionIssuer } from './session.ts';

export type RecoveryRouteDeps = RegistrationFlowDeps & {
  readonly issueSession: SessionIssuer;
};

/* One message for every failure so nothing reveals whether a code exists. */
const RECOVERY_FAILED = 'Recovery failed. Check the code and try again.';

export const createRecoveryRoutes = (deps: RecoveryRouteDeps): readonly Route[] => {
  const { accounts, issueSession } = deps;

  const accountForCode = async (body: Readonly<Record<string, unknown>> | undefined): Promise<number | undefined> => {
    const typed = body === undefined ? undefined : readString(body, 'code');
    return typed === undefined ? undefined : accounts.findByRecoveryHash(await sha256Hex(normalizeRecoveryCode(typed)));
  };

  return [
    {
      method: 'POST',
      pattern: '/api/recovery/options',
      auth: 'none',
      limited: true,
      handle: async ({ request }) => {
        const accountId = await accountForCode(await readJsonObject(request));
        const account = accountId === undefined ? undefined : await accounts.get(accountId);
        const userHandle = accountId === undefined ? undefined : await accounts.userHandleOf(accountId);
        if (account === undefined || userHandle === undefined) {
          return badRequest(RECOVERY_FAILED);
        }
        const options = await startRegistration(deps, {
          flow: 'recovery',
          accountId: account.id,
          userHandle,
          userName: account.name,
          payload: '{}',
        });
        const body: CeremonyOptionsResponse = { options };
        return jsonResponse(body);
      },
    },
    {
      method: 'POST',
      pattern: '/api/recovery/verify',
      auth: 'none',
      limited: true,
      handle: async ({ request }) => {
        const body = await readJsonObject(request);
        const accountId = await accountForCode(body);
        const finished = await finishRegistration(deps, 'recovery', body?.['response']);
        if (accountId === undefined || finished === undefined || finished.challenge.accountId !== accountId) {
          return badRequest(RECOVERY_FAILED);
        }
        await storePasskey(deps, finished, accountId, 'Recovered device');
        const recoveryCode = createRecoveryCode();
        await accounts.setRecoveryHash(accountId, await sha256Hex(normalizeRecoveryCode(recoveryCode)));
        const account = await accounts.get(accountId);
        const signedIn: SignedInResponse = { id: accountId, name: account?.name ?? 'Account', recoveryCode };
        return issueSession(request, accountId, signedIn);
      },
    },
  ];
};
