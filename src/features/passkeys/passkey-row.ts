import type { PasskeyRecord } from './passkey-store.ts';

/* Column shape shared by the sqlite and D1 adapters. */
export type PasskeyRow = {
  readonly credential_id: string;
  readonly account_id: number;
  readonly public_key: string;
  readonly counter: number;
  readonly transports: string;
  readonly backed_up: number;
  readonly label: string;
  readonly created_at: number;
};

export const PASSKEY_COLUMNS =
  'credential_id, account_id, public_key, counter, transports, backed_up, label, created_at';

const parseTransports = (json: string): readonly string[] => {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

export const rowToPasskey = (row: PasskeyRow): PasskeyRecord => ({
  credentialId: row.credential_id,
  accountId: row.account_id,
  publicKey: row.public_key,
  counter: row.counter,
  transports: parseTransports(row.transports),
  backedUp: row.backed_up === 1,
  label: row.label,
  createdAt: row.created_at,
});

export const passkeyToValues = (
  passkey: PasskeyRecord,
): [string, number, string, number, string, number, string, number] => [
  passkey.credentialId,
  passkey.accountId,
  passkey.publicKey,
  passkey.counter,
  JSON.stringify(passkey.transports),
  passkey.backedUp ? 1 : 0,
  passkey.label,
  passkey.createdAt,
];
