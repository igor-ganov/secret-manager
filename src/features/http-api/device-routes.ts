import type { ApiTokenStore } from '../api-tokens/api-token-store.ts';
import { sha256Hex } from '../crypto/sha256-hex.ts';
import type { DeviceLogin } from '../device-login/create-device-login.ts';
import type { LoginRequestKind, LoginRequestStore, LoginRequestView } from '../device-login/login-request-store.ts';
import type { TelegramLinkStore } from '../device-login/telegram-link-store.ts';
import type { TelegramNotifier } from '../device-login/telegram-notifier.ts';
import type { DevicePollResponse, DeviceStartResponse, LoginRequestInfoResponse } from './api-types.ts';
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

const POLL_HEADER = 'x-poll-token';
const MAX_LABEL = 64;
const GONE = 'This login request has expired or was denied.';
const LINKED_MESSAGE = 'This chat is now linked to your account. Send me a value or a "key value" pair.';

type Approval = (deps: DeviceRouteDeps, codeHash: string, accountId: number, view: LoginRequestView) => Promise<boolean>;

/* What "approve" means depends on who is asking. */
const APPROVALS: Readonly<Record<LoginRequestKind, Approval>> = {
  cli: async ({ tokens, loginRequests }, codeHash, accountId, view) => {
    const { token } = await tokens.create(accountId, view.label);
    return loginRequests.approve(codeHash, accountId, token);
  },
  telegram: async (deps, codeHash, accountId, view) => {
    const approved = await deps.loginRequests.approve(codeHash, accountId, undefined);
    if (!approved) {
      return false;
    }
    const telegramUserId = Number(view.subject);
    await deps.telegramLinks.link(telegramUserId, accountId, deps.now());
    await deps.moveLegacyData(telegramUserId, accountId);
    await deps.notifyTelegram(telegramUserId, LINKED_MESSAGE);
    return true;
  },
};

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
        const label = (body === undefined ? undefined : readString(body, 'label')?.trim()) || 'Console';
        const started = await deviceLogin.start('cli', label.slice(0, MAX_LABEL), label.slice(0, MAX_LABEL));
        const response: DeviceStartResponse = started;
        return jsonResponse(response, 201);
      },
    },
    {
      method: 'GET',
      pattern: '/api/device/poll',
      auth: 'none',
      limited: true,
      handle: async ({ request }) => {
        const pollToken = request.headers.get(POLL_HEADER) ?? '';
        const result = pollToken === '' ? undefined : await loginRequests.poll(await sha256Hex(pollToken));
        if (result === undefined) {
          return errorResponse(410, GONE);
        }
        const response: DevicePollResponse = result;
        return jsonResponse(response);
      },
    },
    {
      method: 'GET',
      pattern: '/api/device/:code',
      auth: 'user',
      handle: async ({ params }) => {
        const view = await loginRequests.peek(await codeOf(params));
        if (view === undefined || view.status !== 'pending') {
          return notFound(GONE);
        }
        const body: LoginRequestInfoResponse = { kind: view.kind, label: view.label };
        return jsonResponse(body);
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
        return (await APPROVALS[view.kind](deps, codeHash, principal.userId, view))
          ? noContent()
          : badRequest(GONE);
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
