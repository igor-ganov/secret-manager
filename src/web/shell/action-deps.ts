import type { ApiClient } from '../api/api-client.ts';
import type { AppState } from '../state/app-state.ts';
import type { Store } from '../state/create-store.ts';

export type ActionDeps = {
  readonly api: ApiClient;
  readonly store: Store<AppState>;
  readonly clipboard: (text: string) => Promise<void>;
};
