import type { RowMode } from '../state/app-state.ts';

/* Everything a view may ask the shell to do. */
export type Actions = {
  readonly logout: (botId: number) => Promise<void>;
  readonly share: (key: string, value: string) => Promise<void>;
  readonly linkFor: (key: string) => Promise<void>;
  readonly setRowMode: (key: string, mode: RowMode) => void;
  readonly saveValue: (key: string, value: string) => Promise<void>;
  readonly confirmDelete: (key: string) => Promise<void>;
  readonly setTtl: (minutes: number) => Promise<void>;
  readonly createToken: (label: string) => Promise<void>;
  readonly revokeToken: (id: string) => Promise<void>;
  readonly copy: (text: string) => Promise<void>;
};
