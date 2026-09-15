/* Wire types shared by the server and both clients (site, CLI). */

export type ErrorResponse = { readonly error: string };

export type MeResponse = { readonly id: number; readonly name: string };

/* After signup or recovery the fresh recovery code rides along, once. */
export type SignedInResponse = MeResponse & { readonly recoveryCode?: string };

export type CeremonyOptionsResponse = { readonly options: unknown };

export type IssuedLinkResponse = {
  readonly url: string;
  readonly curl: string;
  readonly ttlMinutes: number;
};

export type KeysResponse = { readonly keys: readonly string[] };

export type ValueResponse = { readonly value: string };

export type SettingsResponse = {
  readonly linkTtlMinutes: number;
  readonly presets: readonly number[];
};

export type TokenResponse = {
  readonly id: string;
  readonly label: string;
  readonly createdAt: number;
  /* The token the request itself was authenticated with. */
  readonly current: boolean;
};

export type PasskeyResponse = {
  readonly id: string;
  readonly label: string;
  readonly createdAt: number;
  readonly backedUp: boolean;
};

export type DevicesResponse = {
  readonly passkeys: readonly PasskeyResponse[];
  readonly telegram: { readonly linked: boolean };
  readonly tokens: readonly TokenResponse[];
};

export type EnrollmentResponse = {
  readonly url: string;
  /* SVG data url of the QR code for `url`. */
  readonly qr: string;
  readonly expiresAt: number;
};

export type EnrollmentInfoResponse = { readonly accountName: string };

export type LoginRequestInfoResponse = {
  readonly kind: 'cli' | 'telegram';
  readonly label: string;
  readonly status: 'pending' | 'approved' | 'denied';
  /* Fallback code and callback url; empty until approved / for Telegram. */
  readonly grant: string;
  readonly callback: string;
};

export type DeviceStartResponse = {
  readonly url: string;
  readonly deviceSecret: string;
  readonly expiresAt: number;
};

export type DeviceApprovalResponse = {
  readonly kind: 'cli' | 'telegram';
  readonly grant: string;
  readonly callback: string;
};

export type DeviceClaimResponse = { readonly token: string };
