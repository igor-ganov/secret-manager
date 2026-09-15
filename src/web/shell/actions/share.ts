import type { IssuedLinkResponse } from '../../../features/http-api/api-types.ts';
import { matchResult } from '../../../features/result/match-result.ts';
import type { ActionDeps } from '../action-deps.ts';
import { refreshKeys } from './refresh-keys.ts';

const INTROS: Readonly<Record<`${boolean}`, (key: string) => string>> = {
  true: () => 'One-time link (nothing was saved):',
  false: (key) => `Saved “${key}”. One-time link to the value:`,
};

export const share =
  (deps: ActionDeps) =>
  async (key: string, value: string): Promise<void> => {
    const { api, store } = deps;
    const intro = INTROS[`${key === ''}`](key);
    const onOk = async (link: IssuedLinkResponse): Promise<void> =>
      store.patch({ notice: { kind: 'link', intro, link }, keys: await refreshKeys(deps)(), error: undefined });
    await matchResult(await api.share(key, value), onOk, async (error) => store.patch({ error }));
  };
