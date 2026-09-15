import type {
  AuthConfigResponse,
  CreatedTokenResponse,
  IssuedLinkResponse,
  KeysResponse,
  MeResponse,
  SettingsResponse,
  TokensResponse,
} from '../../features/http-api/api-types.ts';
import type { Result } from '../../features/result/result.ts';

export type ApiClient = {
  readonly authConfig: () => Promise<Result<AuthConfigResponse>>;
  readonly me: () => Promise<Result<MeResponse>>;
  readonly loginTelegram: (payload: unknown) => Promise<Result<MeResponse>>;
  readonly logout: () => Promise<Result<true>>;
  readonly keys: () => Promise<Result<KeysResponse>>;
  readonly share: (key: string, value: string) => Promise<Result<IssuedLinkResponse>>;
  readonly save: (key: string, value: string) => Promise<Result<true>>;
  readonly linkFor: (key: string) => Promise<Result<IssuedLinkResponse>>;
  readonly remove: (key: string) => Promise<Result<true>>;
  readonly settings: () => Promise<Result<SettingsResponse>>;
  readonly saveSettings: (linkTtlMinutes: number) => Promise<Result<true>>;
  readonly tokens: () => Promise<Result<TokensResponse>>;
  readonly createToken: (label: string) => Promise<Result<CreatedTokenResponse>>;
  readonly revokeToken: (id: string) => Promise<Result<true>>;
};
