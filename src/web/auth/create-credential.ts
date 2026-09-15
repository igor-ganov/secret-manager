import { isRecord } from '../../features/http-api/guards/is-record.ts';
import { isString } from '../../features/http-api/guards/is-string.ts';
import type { Result } from '../../features/result/result.ts';
import { credentialResult } from './credential-result.ts';
import { describeWebauthnError } from './describe-webauthn-error.ts';

const UNEXPECTED = 'Unexpected registration options from the server.';

/* The browser's JSON parser validates the rest; this only rules out garbage. */
const isCreationOptions = (value: unknown): value is PublicKeyCredentialCreationOptionsJSON =>
  isRecord(value) && isString(value['challenge']) && isRecord(value['rp']) && isRecord(value['user']);

const create = async (options: PublicKeyCredentialCreationOptionsJSON): Promise<Result<unknown>> => {
  try {
    const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(options);
    return credentialResult(await navigator.credentials.create({ publicKey }));
  } catch (error) {
    return { ok: false, error: describeWebauthnError(error) };
  }
};

/* Registration ceremony: creation options in, credential JSON out. */
export const createCredential = async (options: unknown): Promise<Result<unknown>> => {
  const parsed = [options].find(isCreationOptions);
  switch (parsed) {
    case undefined:
      return { ok: false, error: UNEXPECTED };
    default:
      return create(parsed);
  }
};
