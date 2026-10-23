import { matchResult } from '../../../features/result/match-result.ts';
import type { ApiClient } from '../../api/api-client.ts';
import type { AppState } from '../../state/app-state.ts';
import type { Store } from '../../state/create-store.ts';

export type DropDeps = {
  readonly api: Pick<ApiClient, 'drop'>;
  readonly store: Store<AppState>;
};

const INTRO = 'One-time link (nothing was saved):';

/* Success clears the draft; failure hands it back so the re-rendered field
   still holds what was typed (web-quick-start AC-1.3, AC-1.4). */
export const drop =
  ({ api, store }: DropDeps) =>
  async (value: string, ttlMinutes: number): Promise<void> =>
    matchResult(
      await api.drop(value, ttlMinutes),
      (link) =>
        store.patch({ notice: { kind: 'link', intro: INTRO, link }, quickDraft: '', quickTtlMinutes: ttlMinutes, error: undefined }),
      (error) => store.patch({ error, quickDraft: value, quickTtlMinutes: ttlMinutes }),
    );
