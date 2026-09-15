import { matchResult } from '../../../features/result/match-result.ts';
import type { ActionDeps } from '../action-deps.ts';

export const linkFor =
  ({ api, store }: ActionDeps) =>
  async (key: string): Promise<void> =>
    matchResult(
      await api.linkFor(key),
      (link) => store.patch({ notice: { kind: 'link', intro: `One-time link to “${key}”:`, link }, error: undefined }),
      (error) => store.patch({ error }),
    );
