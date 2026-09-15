import { isRecord } from '../../features/http-api/guards/is-record.ts';
import { isString } from '../../features/http-api/guards/is-string.ts';
import type { Result } from '../../features/result/result.ts';
import { credentialResult } from './credential-result.ts';
import { describeWebauthnError } from './describe-webauthn-error.ts';

const UNEXPECTED = 'Unexpected login options from the server.';

const isRequestOptions = (value: unknown): value is PublicKeyCredentialRequestOptionsJSON =>
  isRecord(value) && isString(value['challenge']);

const get = async (options: PublicKeyCredentialRequestOptionsJSON): Promise<Result<unknown>> => {
  try {
    const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(options);
    return credentialResult(await navigator.credentials.get({ publicKey }));
  } catch (error) {
    return { ok: false, error: describeWebauthnError(error) };
  }
};

/* Authentication ceremony with a discoverable credential: no username asked. */
export const getCredential = async (options: unknown): Promise<Result<unknown>> => {
  const parsed = [options].find(isRequestOptions);
  switch (parsed) {
    case undefined:
      return { ok: false, error: UNEXPECTED };
    default:
      return get(parsed);
  }
};
