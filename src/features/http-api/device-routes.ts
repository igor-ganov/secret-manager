import type { ApiTokenStore } from '../api-tokens/api-token-store.ts';
import { sha256Hex } from '../crypto/sha256-hex.ts';
import type { DeviceLogin } from '../device-login/create-device-login.ts';
import { createGrantCode, normalizeGrantCode } from '../device-login/grant-code.ts';
import { isLoopbackCallback } from '../device-login/is-loopback-callback.ts';
import type { LoginRequestKind, LoginRequestStore, LoginRequestView } from '../device-login/login-request-store.ts';
import type { TelegramLinkStore } from '../device-login/telegram-link-store.ts';
import type { TelegramNotifier } from '../device-login/telegram-notifier.ts';
import type {
  DeviceApprovalResponse,
  DeviceClaimResponse,
  DeviceStartResponse,
  LoginRequestInfoResponse,
} from './api-types.ts';
import { badRequest, errorResponse, jsonResponse, noContent, notFound } from './json-response.ts';
import { readJsonObject, readString } from './read-json-object.ts';
import type { Route } from './route.ts';

export type DeviceRouteDeps = {
  readonly deviceLogin: DeviceLogin;
  readonly loginRequests: LoginRequestStore;
  readonly tokens: ApiTokenStore;
  readonly telegramLinks: TelegramLinkStore;
  /* Moves secrets/settings stored under a Telegram id to the account. */
  readonly moveLegacyData: (fromUserId: number, toUserId: number) => Promise<void>;
  readonly notifyTelegram: TelegramNotifier;
  readonly now: () => number;
};

const SECRET_HEADER = 'x-device-secret';
const MAX_LABEL = 64;
const GONE = 'This login request has expired or was denied.';
const BAD_CALLBACK = 'The callback must be an http url on the loopback address.';
const LINKED_MESSAGE = 'This chat is now linked to your account. Send me a value or a "key value" pair.';

type Approval = (
  deps: DeviceRouteDeps,
  codeHash: string,
  accountId: number,
  view: LoginRequestView,
) => Promise<DeviceApprovalResponse | undefined>;

/* What "approve" means depends on who is asking. */
const APPROVALS: Readonly<Record<LoginRequestKind, Approval>> = {
  cli: async ({ tokens, loginRequests }, codeHash, accountId, view) => {
    const { token } = await tokens.create(accountId, view.label);
    const grant = createGrantCode();
    const approved = await loginRequests.approve(codeHash, accountId, token, grant);
    return approved ? { kind: 'cli', grant, callback: view.callback } : undefined;
  },
  telegram: async (deps, codeHash, accountId, view) => {
    const approved = await deps.loginRequests.approve(codeHash, accountId, '', '');
    if (!approved) {
      return undefined;
    }
    const telegramUserId = Number(view.subject);
    await deps.telegramLinks.link(telegramUserId, accountId, deps.now());
    await deps.moveLegacyData(telegramUserId, accountId);
    await deps.notifyTelegram(telegramUserId, LINKED_MESSAGE);
    return { kind: 'telegram', grant: '', callback: '' };
  },
};

const toInfo = (view: LoginRequestView): LoginRequestInfoResponse => ({
  kind: view.kind,
  label: view.label,
  status: view.status,
  grant: view.grant,
  callback: view.callback,
});

export const createDeviceRoutes = (deps: DeviceRouteDeps): readonly Route[] => {
  const { deviceLogin, loginRequests } = deps;
  const codeOf = (params: Readonly<Record<string, string>>): Promise<string> => sha256Hex(params['code'] ?? '');

  return [
    {
      method: 'POST',
      pattern: '/api/device/start',
      auth: 'none',
      limited: true,
      handle: async ({ request }) => {
        const body = await readJsonObject(request);
        const label = ((body === undefined ? undefined : readString(body, 'label')?.trim()) || 'Console').slice(0, MAX_LABEL);
        const callback = (body === undefined ? undefined : readString(body, 'callback')) ?? '';
        if (callback !== '' && !isLoopbackCallback(callback)) {
          return badRequest(BAD_CALLBACK);
        }
        const started = await deviceLogin.start({ kind: 'cli', label, subject: label, callback });
        const response: DeviceStartResponse = started;
        return jsonResponse(response, 201);
      },
    },
    {
      method: 'POST',
      pattern: '/api/device/claim',
      auth: 'none',
      limited: true,
      handle: async ({ request }) => {
        const body = await readJsonObject(request);
        const secret = request.headers.get(SECRET_HEADER) ?? '';
        const grant = body === undefined ? undefined : readString(body, 'grant');
        const token =
          secret === '' || grant === undefined
            ? undefined
            : await loginRequests.claim(await sha256Hex(secret), normalizeGrantCode(grant));
        if (token === undefined) {
          return errorResponse(410, GONE);
        }
        const response: DeviceClaimResponse = { token };
        return jsonResponse(response);
      },
    },
    {
      method: 'GET',
      pattern: '/api/device/:code',
      auth: 'user',
      handle: async ({ params }) => {
        const view = await loginRequests.peek(await codeOf(params));
        return view === undefined || view.status === 'denied' ? notFound(GONE) : jsonResponse(toInfo(view));
      },
    },
    {
      method: 'POST',
      pattern: '/api/device/:code/approve',
      auth: 'user',
      handle: async ({ params, principal }) => {
        const codeHash = await codeOf(params);
        const view = await loginRequests.peek(codeHash);
        if (view === undefined || view.status !== 'pending') {
          return notFound(GONE);
        }
        const approval = await APPROVALS[view.kind](deps, codeHash, principal.userId, view);
        return approval === undefined ? badRequest(GONE) : jsonResponse(approval);
      },
    },
    {
      method: 'POST',
      pattern: '/api/device/:code/deny',
      auth: 'user',
      handle: async ({ params }) => ((await loginRequests.deny(await codeOf(params))) ? noContent() : notFound(GONE)),
    },
  ];
};
