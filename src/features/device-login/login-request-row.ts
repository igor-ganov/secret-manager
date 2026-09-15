import type { LoginRequestKind, LoginRequestStatus, LoginRequestView, PollResult } from './login-request-store.ts';

/* An empty issued token means "none": the row never holds SQL NULL. */
export const NO_TOKEN = '';

export type LoginRequestRow = {
  readonly kind: string;
  readonly label: string;
  readonly subject: string;
  readonly status: string;
  readonly issued_token: string;
};

const KINDS: readonly LoginRequestKind[] = ['cli', 'telegram'];
const STATUSES: readonly LoginRequestStatus[] = ['pending', 'approved', 'denied'];

const isKind = (value: string): value is LoginRequestKind => KINDS.some((kind) => kind === value);
const isStatus = (value: string): value is LoginRequestStatus =>
  STATUSES.some((status) => status === value);

export const rowToView = (row: LoginRequestRow): LoginRequestView | undefined =>
  isKind(row.kind) && isStatus(row.status)
    ? { kind: row.kind, label: row.label, subject: row.subject, status: row.status }
    : undefined;

/* Denied rows look like unknown ones to the poller, so a denial is final. */
export const rowToPoll = (row: LoginRequestRow): PollResult | undefined => {
  switch (row.status) {
    case 'pending':
      return { status: 'pending' };
    case 'approved':
      return row.issued_token === NO_TOKEN ? undefined : { status: 'approved', token: row.issued_token };
    default:
      return undefined;
  }
};
