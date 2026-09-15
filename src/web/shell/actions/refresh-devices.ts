import type { DevicesResponse } from '../../../features/http-api/api-types.ts';
import { valueOr } from '../../../features/result/value-or.ts';
import type { ActionDeps } from '../action-deps.ts';

export const refreshDevices =
  ({ api, store }: ActionDeps) =>
  async (): Promise<DevicesResponse> =>
    valueOr(await api.devices(), store.get().devices);
