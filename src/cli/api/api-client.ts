import type {
  IssuedLinkResponse,
  KeysResponse,
  MeResponse,
  SettingsResponse,
  TokensResponse,
  ValueResponse,
} from '../../features/http-api/api-types.ts';
import type { Result } from '../../features/result/result.ts';

export type ApiFailure =
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'rejected'; readonly message: string }
  | { readonly kind: 'unreachable'; readonly message: string };

export type ApiResult<T> = Result<T, ApiFailure>;

export type ApiCredentials = {
  readonly serverUrl: string;
  readonly token: string;
};

export type ApiClient = {
  readonly me: () => Promise<ApiResult<MeResponse>>;
  readonly keys: () => Promise<ApiResult<KeysResponse>>;
  readonly read: (key: string) => Promise<ApiResult<ValueResponse>>;
  readonly share: (key: string, value: string) => Promise<ApiResult<IssuedLinkResponse>>;
  readonly linkFor: (key: string) => Promise<ApiResult<IssuedLinkResponse>>;
  readonly remove: (key: string) => Promise<ApiResult<true>>;
  readonly settings: () => Promise<ApiResult<SettingsResponse>>;
  readonly saveSettings: (linkTtlMinutes: number) => Promise<ApiResult<true>>;
  readonly tokens: () => Promise<ApiResult<TokensResponse>>;
  readonly revokeToken: (id: string) => Promise<ApiResult<true>>;
};
