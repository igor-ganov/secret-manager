/* Wire types shared by the server and both clients (site, CLI). */

export type ErrorResponse = { readonly error: string };

export type MeResponse = { readonly id: number; readonly name: string };

export type AuthConfigResponse = { readonly botId: number };

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

export type TokensResponse = { readonly tokens: readonly TokenResponse[] };

export type CreatedTokenResponse = TokenResponse & { readonly token: string };
