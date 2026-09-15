import { initialState } from '../../state/initial-state.ts';
import type { ActionDeps } from '../action-deps.ts';

export const logout =
  ({ api, store }: ActionDeps) =>
  async (botId: number): Promise<void> => {
    await api.logout();
    store.patch({ ...initialState, session: { kind: 'anonymous', botId } });
  };
