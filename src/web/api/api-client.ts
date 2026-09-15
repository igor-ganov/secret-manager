import type {
  CeremonyOptionsResponse,
  DevicesResponse,
  EnrollmentInfoResponse,
  EnrollmentResponse,
  IssuedLinkResponse,
  KeysResponse,
  LoginRequestInfoResponse,
  MeResponse,
  SettingsResponse,
  SignedInResponse,
} from '../../features/http-api/api-types.ts';
import type { Result } from '../../features/result/result.ts';

type Options = Promise<Result<CeremonyOptionsResponse>>;
type SignedIn = Promise<Result<SignedInResponse>>;
type Done = Promise<Result<true>>;

export type ApiClient = {
  readonly me: () => Promise<Result<MeResponse>>;
  readonly logout: () => Done;
  readonly keys: () => Promise<Result<KeysResponse>>;
  readonly share: (key: string, value: string) => Promise<Result<IssuedLinkResponse>>;
  readonly save: (key: string, value: string) => Done;
  readonly linkFor: (key: string) => Promise<Result<IssuedLinkResponse>>;
  readonly remove: (key: string) => Done;
  readonly settings: () => Promise<Result<SettingsResponse>>;
  readonly saveSettings: (linkTtlMinutes: number) => Done;
  readonly devices: () => Promise<Result<DevicesResponse>>;
  readonly revokeToken: (id: string) => Done;
  readonly removePasskey: (id: string) => Done;
  readonly unlinkTelegram: () => Done;
  readonly registerOptions: (name: string) => Options;
  readonly registerVerify: (response: unknown, label: string) => SignedIn;
  readonly loginOptions: () => Options;
  readonly loginVerify: (response: unknown) => SignedIn;
  readonly addOptions: () => Options;
  readonly addVerify: (response: unknown, label: string) => Done;
  readonly createEnrollment: () => Promise<Result<EnrollmentResponse>>;
  readonly enrollmentInfo: (code: string) => Promise<Result<EnrollmentInfoResponse>>;
  readonly enrollOptions: (code: string) => Options;
  readonly enrollVerify: (code: string, response: unknown, label: string) => SignedIn;
  readonly recoveryOptions: (code: string) => Options;
  readonly recoveryVerify: (code: string, response: unknown) => SignedIn;
  readonly loginRequestInfo: (code: string) => Promise<Result<LoginRequestInfoResponse>>;
  readonly approveDevice: (code: string) => Done;
  readonly denyDevice: (code: string) => Done;
};
