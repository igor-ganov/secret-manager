import type { MeResponse } from '../../../features/http-api/api-types.ts';
import { valueOr } from '../../../features/result/value-or.ts';
import { initialState } from '../../state/initial-state.ts';
import type { ActionDeps } from '../action-deps.ts';

/* Everything the workspace shows is fetched before the signed-in view
   appears, in one patch, so typing is never wiped by a late response. */
export const loadWorkspace =
  ({ api, store }: ActionDeps) =>
  async (user: MeResponse): Promise<void> => {
    const [keys, settings, devices] = await Promise.all([api.keys(), api.settings(), api.devices()]);
    store.patch({
      session: { kind: 'signed-in', user },
      keys: valueOr(keys, { keys: [] }).keys,
      settings: valueOr(settings, initialState.settings),
      devices: valueOr(devices, initialState.devices),
      rowModes: {},
      error: undefined,
    });
  };
