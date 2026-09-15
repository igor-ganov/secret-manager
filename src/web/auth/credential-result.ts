import type { Result } from '../../features/result/result.ts';

const NOTHING = 'No passkey was returned by the browser.';

const isPublicKeyCredential = (value: unknown): value is PublicKeyCredential =>
  value instanceof PublicKeyCredential;

/* Turns what `navigator.credentials` returned into the JSON the server
   verifies. `toJSON()` is the browser's own serialiser (base64url fields). */
export const credentialResult = (credential: unknown): Result<unknown> => {
  const found = [credential].find(isPublicKeyCredential);
  switch (found) {
    case undefined:
      return { ok: false, error: NOTHING };
    default: {
      const json: unknown = found.toJSON();
      return { ok: true, value: json };
    }
  }
};
