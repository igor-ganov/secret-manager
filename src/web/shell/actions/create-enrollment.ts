import { matchResult } from '../../../features/result/match-result.ts';
import type { ActionDeps } from '../action-deps.ts';

export const createEnrollment =
  ({ api, store }: ActionDeps) =>
  async (): Promise<void> =>
    matchResult(
      await api.createEnrollment(),
      (enrollment) => store.patch({ notice: { kind: 'enrollment', enrollment }, error: undefined }),
      (error) => store.patch({ error }),
    );
