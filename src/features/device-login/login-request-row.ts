import type { LoginRequestKind, LoginRequestStatus, LoginRequestView } from './login-request-store.ts';

/* Empty strings and 0 stand for "none": rows never hold SQL NULL. */
export const NO_TOKEN = '';
export const NO_ACCOUNT = 0;

export const REQUEST_COLUMNS = 'kind, label, subject, callback, status, issued_token, grant_code';

export type LoginRequestRow = {
  readonly kind: string;
  readonly label: string;
  readonly subject: string;
  readonly callback: string;
  readonly status: string;
  readonly issued_token: string;
  readonly grant_code: string;
};

const KINDS: readonly LoginRequestKind[] = ['cli', 'telegram'];
const STATUSES: readonly LoginRequestStatus[] = ['pending', 'approved', 'denied'];

const isKind = (value: string): value is LoginRequestKind => KINDS.some((kind) => kind === value);
const isStatus = (value: string): value is LoginRequestStatus =>
  STATUSES.some((status) => status === value);

export const rowToView = (row: LoginRequestRow): LoginRequestView | undefined =>
  isKind(row.kind) && isStatus(row.status)
    ? {
        kind: row.kind,
        label: row.label,
        subject: row.subject,
        callback: row.callback,
        status: row.status,
        grant: row.grant_code,
      }
    : undefined;

/* The token is handed out only for an approved row whose grant matches and
   whose token has not been taken yet. */
export const claimableToken = (row: LoginRequestRow | undefined, grant: string): string | undefined =>
  row !== undefined && row.status === 'approved' && row.grant_code === grant && row.issued_token !== NO_TOKEN
    ? row.issued_token
    : undefined;
