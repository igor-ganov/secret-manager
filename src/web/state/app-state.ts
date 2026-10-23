import type {
  DevicesResponse,
  EnrollmentInfoResponse,
  EnrollmentResponse,
  IssuedLinkResponse,
  LoginRequestInfoResponse,
  MeResponse,
  SettingsResponse,
} from '../../features/http-api/api-types.ts';

export type Session =
  | { readonly kind: 'loading' }
  | { readonly kind: 'anonymous' }
  | { readonly kind: 'signed-in'; readonly user: MeResponse };

/* Where the url fragment sent us: a plain visit, a device asking for
   approval, or another device's enrollment link. */
export type Route =
  | { readonly kind: 'home' }
  | { readonly kind: 'link'; readonly code: string }
  | { readonly kind: 'enroll'; readonly code: string };

export type RowMode = 'idle' | 'setting' | 'deleting';

/* The single live region: whatever the last action produced. */
export type Notice =
  | { readonly kind: 'idle' }
  | { readonly kind: 'info'; readonly text: string }
  | { readonly kind: 'link'; readonly intro: string; readonly link: IssuedLinkResponse }
  | { readonly kind: 'recovery'; readonly code: string }
  | { readonly kind: 'enrollment'; readonly enrollment: EnrollmentResponse };

export type AppState = {
  readonly session: Session;
  readonly route: Route;
  readonly keys: readonly string[];
  readonly rowModes: Readonly<Record<string, RowMode>>;
  readonly settings: SettingsResponse;
  readonly devices: DevicesResponse;
  readonly enrollmentInfo: EnrollmentInfoResponse | undefined;
  readonly linkInfo: LoginRequestInfoResponse | undefined;
  /* The quick start: a failed drop hands the typed secret back through here
     so the full re-render does not wipe it; the lifetime is kept between drops. */
  readonly quickDraft: string;
  readonly quickTtlMinutes: number;
  readonly notice: Notice;
  readonly error: string | undefined;
  readonly toast: string;
};
