import type { RowMode } from '../state/app-state.ts';

/* Everything a view may ask the shell to do. */
export type Actions = {
  readonly continueWithPasskey: () => Promise<void>;
  readonly recover: (code: string) => Promise<void>;
  readonly enrollHere: (code: string, label: string) => Promise<void>;
  /* The link page: passkey, approval and the return to the device. */
  readonly approveLink: (code: string) => Promise<void>;
  readonly addPasskeyHere: (label: string) => Promise<void>;
  readonly removePasskey: (id: string) => Promise<void>;
  readonly createEnrollment: () => Promise<void>;
  readonly unlinkTelegram: () => Promise<void>;
  readonly revokeToken: (id: string) => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly share: (key: string, value: string) => Promise<void>;
  readonly linkFor: (key: string) => Promise<void>;
  readonly setRowMode: (key: string, mode: RowMode) => void;
  readonly saveValue: (key: string, value: string) => Promise<void>;
  readonly confirmDelete: (key: string) => Promise<void>;
  readonly setTtl: (minutes: number) => Promise<void>;
  readonly copy: (text: string) => Promise<void>;
};
