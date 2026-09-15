import { isTtlPreset, TTL_PRESETS_MINUTES } from '../settings/ttl-presets.ts';
import type { SharingService } from '../sharing/sharing-service.ts';
import type { SettingsResponse } from './api-types.ts';
import { badRequest, jsonResponse, noContent } from './json-response.ts';
import { readJsonObject, readNumber } from './read-json-object.ts';
import type { Route } from './route.ts';

const TTL_ERROR = `linkTtlMinutes must be one of ${TTL_PRESETS_MINUTES.join(', ')}.`;

export const createSettingsRoutes = (sharing: SharingService): readonly Route[] => [
  {
    method: 'GET',
    pattern: '/api/settings',
    auth: 'user',
    handle: async ({ principal }) => {
      const body: SettingsResponse = {
        linkTtlMinutes: await sharing.getTtlMinutes(principal.userId),
        presets: TTL_PRESETS_MINUTES,
      };
      return jsonResponse(body);
    },
  },
  {
    method: 'PUT',
    pattern: '/api/settings',
    auth: 'user',
    handle: async ({ request, principal }) => {
      const body = await readJsonObject(request);
      const minutes = body === undefined ? undefined : readNumber(body, 'linkTtlMinutes');
      if (minutes === undefined || !isTtlPreset(minutes)) {
        return badRequest(TTL_ERROR);
      }
      await sharing.setTtlMinutes(principal.userId, minutes);
      return noContent();
    },
  },
];
