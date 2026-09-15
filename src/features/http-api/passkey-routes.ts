import { createAccountId } from '../accounts/create-account-id.ts';
import { createRecoveryCode, normalizeRecoveryCode } from '../accounts/recovery-code.ts';
import { randomBase64url } from '../crypto/base64url.ts';
import { sha256Hex } from '../crypto/sha256-hex.ts';
import {
  CHALLENGE_TTL_MS,
  finishRegistration,
  startRegistration,
  storePasskey,
  type RegistrationFlowDeps,
} from '../passkeys/registration-flow.ts';
import type { CeremonyOptionsResponse, PasskeyResponse, SignedInResponse } from './api-types.ts';
import { badRequest, jsonResponse, noContent, notFound } from './json-response.ts';
import { readJsonObject, readString } from './read-json-object.ts';
import type { Route } from './route.ts';
import type { SessionIssuer } from './session.ts';

export type PasskeyRouteDeps = RegistrationFlowDeps & {
  readonly issueSession: SessionIssuer;
};

const CEREMONY_FAILED = 'The passkey ceremony could not be verified.';
const MAX_NAME_LENGTH = 64;
const DEFAULT_LABEL = 'Passkey';

const readLabel = (body: Readonly<Record<string, unknown>> | undefined, field: string, fallback: string): string => {
  const value = body === undefined ? undefined : readString(body, field)?.trim();
  return value === undefined || value === '' ? fallback : value.slice(0, MAX_NAME_LENGTH);
};

const readResponse = (body: Readonly<Record<string, unknown>> | undefined): unknown => body?.['response'];

const optionsResponse = (options: unknown): Response => {
  const body: CeremonyOptionsResponse = { options };
  return jsonResponse(body);
};

export const toPasskeyResponse = (passkey: {
  readonly credentialId: string;
  readonly label: string;
  readonly createdAt: number;
  readonly backedUp: boolean;
}): PasskeyResponse => ({
  id: passkey.credentialId,
  label: passkey.label,
  createdAt: passkey.createdAt,
  backedUp: passkey.backedUp,
});

export const createPasskeyRoutes = (deps: PasskeyRouteDeps): readonly Route[] => {
  const { ceremonies, challenges, passkeys, accounts, now, issueSession } = deps;

  return [
    {
      method: 'POST',
      pattern: '/api/passkeys/register/options',
      auth: 'none',
      limited: true,
      handle: async ({ request }) => {
        const body = await readJsonObject(request);
        const name = readLabel(body, 'name', 'My account');
        const userHandle = randomBase64url(32);
        const payload = JSON.stringify({ name, userHandle });
        return optionsResponse(
          await startRegistration(deps, { flow: 'register', accountId: undefined, userHandle, userName: name, payload }),
        );
      },
    },
    {
      method: 'POST',
      pattern: '/api/passkeys/register/verify',
      auth: 'none',
      limited: true,
      handle: async ({ request }) => {
        const body = await readJsonObject(request);
        const finished = await finishRegistration(deps, 'register', readResponse(body));
        if (finished === undefined) {
          return badRequest(CEREMONY_FAILED);
        }
        const pending = JSON.parse(finished.challenge.payload);
        const name = readLabel(pending, 'name', 'My account');
        const userHandle = readLabel(pending, 'userHandle', '');
        const recoveryCode = createRecoveryCode();
        const id = createAccountId();
        await accounts.create({
          id,
          name,
          userHandle,
          recoveryHash: await sha256Hex(normalizeRecoveryCode(recoveryCode)),
          createdAt: now(),
        });
        await storePasskey(deps, finished, id, readLabel(body, 'label', DEFAULT_LABEL));
        const signedIn: SignedInResponse = { id, name, recoveryCode };
        return issueSession(request, id, signedIn, 201);
      },
    },
    {
      method: 'POST',
      pattern: '/api/passkeys/login/options',
      auth: 'none',
      limited: true,
      handle: async () => {
        const { challenge, options } = await ceremonies.authenticationOptions();
        await challenges.put({ challenge, flow: 'login', accountId: undefined, payload: '{}', expiresAt: now() + CHALLENGE_TTL_MS });
        return optionsResponse(options);
      },
    },
    {
      method: 'POST',
      pattern: '/api/passkeys/login/verify',
      auth: 'none',
      limited: true,
      handle: async ({ request }) => {
        const response = readResponse(await readJsonObject(request));
        const challengeValue = ceremonies.challengeOf(response);
        const challenge = challengeValue === undefined ? undefined : await challenges.take(challengeValue);
        const credentialId = ceremonies.credentialIdOf(response);
        const passkey = credentialId === undefined ? undefined : await passkeys.find(credentialId);
        if (challenge === undefined || challenge.flow !== 'login' || passkey === undefined) {
          return badRequest(CEREMONY_FAILED);
        }
        const verified = await ceremonies.verifyAuthentication(response, challenge.challenge, passkey);
        /* Clone detection: a counter that did not advance means a copied key. */
        const cloned = verified !== undefined && verified.newCounter !== 0 && verified.newCounter <= passkey.counter;
        if (verified === undefined || cloned) {
          return badRequest(CEREMONY_FAILED);
        }
        await passkeys.updateCounter(passkey.credentialId, verified.newCounter, verified.backedUp);
        const account = await accounts.get(passkey.accountId);
        const signedIn: SignedInResponse = { id: passkey.accountId, name: account?.name ?? 'Account' };
        return issueSession(request, passkey.accountId, signedIn);
      },
    },
    {
      method: 'POST',
      pattern: '/api/passkeys/add/options',
      auth: 'user',
      limited: true,
      handle: async ({ principal }) => {
        const account = await accounts.get(principal.userId);
        const userHandle = await accounts.userHandleOf(principal.userId);
        if (account === undefined || userHandle === undefined) {
          return notFound();
        }
        return optionsResponse(
          await startRegistration(deps, { flow: 'add', accountId: account.id, userHandle, userName: account.name, payload: '{}' }),
        );
      },
    },
    {
      method: 'POST',
      pattern: '/api/passkeys/add/verify',
      auth: 'user',
      limited: true,
      handle: async ({ request, principal }) => {
        const body = await readJsonObject(request);
        const finished = await finishRegistration(deps, 'add', readResponse(body));
        if (finished === undefined || finished.challenge.accountId !== principal.userId) {
          return badRequest(CEREMONY_FAILED);
        }
        await storePasskey(deps, finished, principal.userId, readLabel(body, 'label', DEFAULT_LABEL));
        return noContent();
      },
    },
    {
      method: 'DELETE',
      pattern: '/api/passkeys/:id',
      auth: 'user',
      handle: async ({ params, principal }) => {
        const owned = await passkeys.listByAccount(principal.userId);
        if (owned.length <= 1) {
          return badRequest('The last passkey cannot be removed.');
        }
        return (await passkeys.remove(principal.userId, params['id'] ?? '')) ? noContent() : notFound('No such passkey.');
      },
    },
  ];
};
