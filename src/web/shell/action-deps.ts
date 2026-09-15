import type { ApiClient } from '../api/api-client.ts';
import type { AppState } from '../state/app-state.ts';
import type { Store } from '../state/create-store.ts';

export type ActionDeps = {
  readonly api: ApiClient;
  readonly store: Store<AppState>;
  readonly clipboard: (text: string) => Promise<void>;
  /* Drops the fragment once a link/enroll code has been used. */
  readonly clearHash: () => void;
  /* Sends the browser back to a device's loopback callback. */
  readonly navigate: (url: string) => void;
  /* Default label for passkeys created in this browser. */
  readonly deviceName: string;
};
