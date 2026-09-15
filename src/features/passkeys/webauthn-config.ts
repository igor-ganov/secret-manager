/* Relying-party identity: configuration, never request headers. */
export type WebAuthnConfig = {
  readonly rpId: string;
  readonly origin: string;
  readonly rpName: string;
};

export const RP_NAME = 'Secret manager';

/* Derives the relying party from a configured public URL (local server). */
export const webAuthnConfigFromUrl = (publicUrl: string): WebAuthnConfig => {
  const url = new URL(publicUrl);
  return { rpId: url.hostname, origin: url.origin, rpName: RP_NAME };
};
