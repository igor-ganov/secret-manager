import { decodeBase64url } from './decode-base64url.ts';

/* Same pattern Telegram's own widget uses to read its redirect back. */
const RESULT_PATTERN = /[#?&]tgAuthResult=([A-Za-z0-9\-_=]*)$/;

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const decodeMatch = (encoded: string): unknown => parseJson(decodeBase64url(encoded));

export const parseTgAuthResult = (hash: string): unknown =>
  [RESULT_PATTERN.exec(hash)?.[1]].filter((match): match is string => match !== undefined).map(decodeMatch)[0];
