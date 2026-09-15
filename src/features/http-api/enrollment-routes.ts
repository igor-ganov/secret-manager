import qrcode from 'qrcode-generator';
import { randomBase64url } from '../crypto/base64url.ts';
import { sha256Hex } from '../crypto/sha256-hex.ts';
import type { EnrollmentStore } from '../enrollment/enrollment-store.ts';
import { finishRegistration, startRegistration, storePasskey, type RegistrationFlowDeps } from '../passkeys/registration-flow.ts';
import type { CeremonyOptionsResponse, EnrollmentInfoResponse, EnrollmentResponse, SignedInResponse } from './api-types.ts';
import { badRequest, jsonResponse, notFound } from './json-response.ts';
import { readJsonObject, readString } from './read-json-object.ts';
import type { Route } from './route.ts';
import type { SessionIssuer } from './session.ts';

export type EnrollmentRouteDeps = RegistrationFlowDeps & {
  readonly enrollments: EnrollmentStore;
  readonly issueSession: SessionIssuer;
  readonly siteOrigin: string;
};

export const ENROLLMENT_TTL_MS = 10 * 60 * 1000;
const GONE = 'This link has expired or was already used.';
const CEREMONY_FAILED = 'The passkey ceremony could not be verified.';

export const buildEnrollmentUrl = (siteOrigin: string, code: string): string => `${siteOrigin}/#enroll=${code}`;

/* Rendered server-side so the page shows it through <img>: no SVG markup
   is ever injected into the document. */
export const qrDataUrl = (text: string): string => {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return `data:image/svg+xml;base64,${btoa(qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }))}`;
};

export type EnrollmentIssuer = (accountId: number) => Promise<EnrollmentResponse>;

export const createEnrollmentIssuer =
  (enrollments: EnrollmentStore, siteOrigin: string, now: () => number): EnrollmentIssuer =>
  async (accountId) => {
    const code = randomBase64url(32);
    const expiresAt = now() + ENROLLMENT_TTL_MS;
    await enrollments.create(await sha256Hex(code), accountId, expiresAt);
    const url = buildEnrollmentUrl(siteOrigin, code);
    return { url, qr: qrDataUrl(url), expiresAt };
  };

export const createEnrollmentRoutes = (deps: EnrollmentRouteDeps): readonly Route[] => {
  const { enrollments, accounts, issueSession, siteOrigin, now } = deps;
  const issue = createEnrollmentIssuer(enrollments, siteOrigin, now);
  const codeOf = (params: Readonly<Record<string, string>>): Promise<string> => sha256Hex(params['code'] ?? '');

  return [
    {
      method: 'POST',
      pattern: '/api/enrollments',
      auth: 'user',
      limited: true,
      handle: async ({ principal }) => jsonResponse(await issue(principal.userId), 201),
    },
    {
      method: 'GET',
      pattern: '/api/enrollments/:code',
      auth: 'none',
      limited: true,
      handle: async ({ params }) => {
        const accountId = await enrollments.peek(await codeOf(params));
        const account = accountId === undefined ? undefined : await accounts.get(accountId);
        if (account === undefined) {
          return notFound(GONE);
        }
        const body: EnrollmentInfoResponse = { accountName: account.name };
        return jsonResponse(body);
      },
    },
    {
      method: 'POST',
      pattern: '/api/enrollments/:code/options',
      auth: 'none',
      limited: true,
      handle: async ({ params }) => {
        const codeHash = await codeOf(params);
        const accountId = await enrollments.peek(codeHash);
        const account = accountId === undefined ? undefined : await accounts.get(accountId);
        const userHandle = accountId === undefined ? undefined : await accounts.userHandleOf(accountId);
        if (account === undefined || userHandle === undefined) {
          return notFound(GONE);
        }
        const options = await startRegistration(deps, {
          flow: 'enroll',
          accountId: account.id,
          userHandle,
          userName: account.name,
          payload: JSON.stringify({ codeHash }),
        });
        const body: CeremonyOptionsResponse = { options };
        return jsonResponse(body);
      },
    },
    {
      method: 'POST',
      pattern: '/api/enrollments/:code/verify',
      auth: 'none',
      limited: true,
      handle: async ({ request, params }) => {
        const body = await readJsonObject(request);
        const finished = await finishRegistration(deps, 'enroll', body?.['response']);
        const codeHash = await codeOf(params);
        const boundTo = finished === undefined ? undefined : readString(JSON.parse(finished.challenge.payload), 'codeHash');
        if (finished === undefined || finished.challenge.accountId === undefined || boundTo !== codeHash) {
          return badRequest(CEREMONY_FAILED);
        }
        const accountId = await enrollments.consume(codeHash);
        if (accountId === undefined || accountId !== finished.challenge.accountId) {
          return notFound(GONE);
        }
        const label = (body === undefined ? undefined : readString(body, 'label')?.trim()) || 'New device';
        await storePasskey(deps, finished, accountId, label);
        const account = await accounts.get(accountId);
        const signedIn: SignedInResponse = { id: accountId, name: account?.name ?? 'Account' };
        return issueSession(request, accountId, signedIn);
      },
    },
  ];
};
