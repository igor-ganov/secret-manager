import type {
  CreatedTokenResponse,
  IssuedLinkResponse,
  MeResponse,
  SettingsResponse,
  TokenResponse,
} from '../../features/http-api/api-types.ts';

export type Session =
  | { readonly kind: 'loading' }
  | { readonly kind: 'anonymous'; readonly botId: number }
  | { readonly kind: 'signed-in'; readonly botId: number; readonly user: MeResponse };

export type RowMode = 'idle' | 'setting' | 'deleting';

/* The single live region: whatever the last action produced. */
export type Notice =
  | { readonly kind: 'idle' }
  | { readonly kind: 'info'; readonly text: string }
  | { readonly kind: 'link'; readonly intro: string; readonly link: IssuedLinkResponse }
  | { readonly kind: 'token'; readonly token: CreatedTokenResponse };

export type AppState = {
  readonly session: Session;
  readonly keys: readonly string[];
  readonly rowModes: Readonly<Record<string, RowMode>>;
  readonly settings: SettingsResponse;
  readonly tokens: readonly TokenResponse[];
  readonly notice: Notice;
  readonly error: string | undefined;
  readonly toast: string;
};
