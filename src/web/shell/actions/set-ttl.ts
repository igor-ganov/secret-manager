import { matchResult } from '../../../features/result/match-result.ts';
import type { ActionDeps } from '../action-deps.ts';

export const setTtl =
  ({ api, store }: ActionDeps) =>
  async (minutes: number): Promise<void> =>
    matchResult(
      await api.saveSettings(minutes),
      () =>
        store.patch({
          settings: { ...store.get().settings, linkTtlMinutes: minutes },
          notice: { kind: 'info', text: `Links now stay valid for ${minutes} minutes.` },
          error: undefined,
        }),
      (error) => store.patch({ error }),
    );
