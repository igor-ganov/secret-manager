import type {
  DeviceClaimResponse,
  DeviceStartResponse,
  DevicesResponse,
  IssuedLinkResponse,
  KeysResponse,
  MeResponse,
  SettingsResponse,
  UploadTicketResponse,
  ValueResponse,
} from '../../features/http-api/api-types.ts';
import type { Result } from '../../features/result/result.ts';
import type { Bytes } from '../../features/secret-files/upload-in-parts.ts';

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
  readonly devices: () => Promise<ApiResult<DevicesResponse>>;
  readonly revokeToken: (id: string) => Promise<ApiResult<true>>;
  /* A file upload whose link honours the account's lifetime (secret-files AC-1.1). */
  readonly beginFile: (name: string, size: number, contentType: string) => Promise<ApiResult<UploadTicketResponse>>;
};

/* The unauthenticated half of the API: the device-login handshake
   (device-login US-2) and anonymous drops (mcp US-1). */
export type PublicClient = {
  readonly start: (label: string, callback: string) => Promise<ApiResult<DeviceStartResponse>>;
  readonly claim: (deviceSecret: string, grant: string) => Promise<ApiResult<DeviceClaimResponse>>;
  readonly drop: (value: string, ttlMinutes: number) => Promise<ApiResult<IssuedLinkResponse>>;
  /* Anonymous file drop, then the upload id is the only credential (secret-files AC-1.2, AC-1.9). */
  readonly dropFile: (name: string, size: number, contentType: string, ttlMinutes: number) => Promise<ApiResult<UploadTicketResponse>>;
  readonly putPart: (uploadId: string, partNumber: number, bytes: Bytes) => Promise<ApiResult<true>>;
  readonly completeUpload: (uploadId: string) => Promise<ApiResult<IssuedLinkResponse>>;
  readonly abortUpload: (uploadId: string) => Promise<ApiResult<true>>;
};
