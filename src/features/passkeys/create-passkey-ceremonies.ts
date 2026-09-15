import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { fromBase64url, toBase64url } from '../crypto/base64url.ts';
import type { PasskeyCeremonies, VerifiedAuthentication, VerifiedRegistration } from './passkey-ceremonies.ts';
import type { WebAuthnConfig } from './webauthn-config.ts';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value instanceof Object && !Array.isArray(value);

/* The library validates the full shape; here only the fields it needs to
   exist before parsing are checked so a garbage body fails cleanly. */
const isCredentialResponse = (
  value: unknown,
): value is RegistrationResponseJSON & AuthenticationResponseJSON =>
  isRecord(value) && typeof value['id'] === 'string' && isRecord(value['response']);

const swallow = async <T>(work: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await work();
  } catch {
    return undefined;
  }
};

export const createPasskeyCeremonies = ({ rpId, origin, rpName }: WebAuthnConfig): PasskeyCeremonies => {
  const registrationOptions: PasskeyCeremonies['registrationOptions'] = async ({ userHandle, userName, existing }) => {
    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userName,
      userID: fromBase64url(userHandle),
      attestationType: 'none',
      excludeCredentials: existing.map((passkey) => ({ id: passkey.credentialId, transports: [...passkey.transports] })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    return { challenge: options.challenge, options };
  };

  const verifyRegistration: PasskeyCeremonies['verifyRegistration'] = async (response, expectedChallenge) => {
    if (!isCredentialResponse(response)) {
      return undefined;
    }
    const verified = await swallow(() =>
      verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
        requireUserVerification: true,
      }),
    );
    if (verified === undefined || !verified.verified) {
      return undefined;
    }
    const { credential, credentialBackedUp } = verified.registrationInfo;
    const result: VerifiedRegistration = {
      credentialId: credential.id,
      publicKey: toBase64url(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      backedUp: credentialBackedUp,
    };
    return result;
  };

  const authenticationOptions: PasskeyCeremonies['authenticationOptions'] = async () => {
    const options = await generateAuthenticationOptions({ rpID: rpId, userVerification: 'required', allowCredentials: [] });
    return { challenge: options.challenge, options };
  };

  const verifyAuthentication: PasskeyCeremonies['verifyAuthentication'] = async (response, expectedChallenge, passkey) => {
    if (!isCredentialResponse(response)) {
      return undefined;
    }
    const verified = await swallow(() =>
      verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
        requireUserVerification: true,
        credential: {
          id: passkey.credentialId,
          publicKey: fromBase64url(passkey.publicKey),
          counter: passkey.counter,
          transports: [...passkey.transports],
        },
      }),
    );
    if (verified === undefined || !verified.verified) {
      return undefined;
    }
    const result: VerifiedAuthentication = {
      credentialId: verified.authenticationInfo.credentialID,
      newCounter: verified.authenticationInfo.newCounter,
      backedUp: verified.authenticationInfo.credentialBackedUp,
    };
    return result;
  };

  const credentialIdOf: PasskeyCeremonies['credentialIdOf'] = (response) =>
    isCredentialResponse(response) ? response.id : undefined;

  const challengeOf: PasskeyCeremonies['challengeOf'] = (response) => {
    if (!isCredentialResponse(response) || typeof response.response.clientDataJSON !== 'string') {
      return undefined;
    }
    try {
      const clientData: unknown = JSON.parse(new TextDecoder().decode(fromBase64url(response.response.clientDataJSON)));
      return isRecord(clientData) && typeof clientData['challenge'] === 'string' ? clientData['challenge'] : undefined;
    } catch {
      return undefined;
    }
  };

  return {
    registrationOptions,
    verifyRegistration,
    authenticationOptions,
    verifyAuthentication,
    credentialIdOf,
    challengeOf,
  };
};
