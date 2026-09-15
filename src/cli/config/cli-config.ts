import { isRecord } from '../../features/http-api/guards/is-record.ts';
import { isString } from '../../features/http-api/guards/is-string.ts';

export type CliConfig = {
  readonly serverUrl?: string;
  readonly token?: string;
};

const optionalString = (value: unknown): { readonly value?: string } =>
  isString(value) && value !== '' ? { value } : {};

/* Anything that is not a well-formed config file reads as "nothing stored". */
export const parseCliConfig = (raw: unknown): CliConfig => {
  if (!isRecord(raw)) {
    return {};
  }
  const serverUrl = optionalString(raw['serverUrl']).value;
  const token = optionalString(raw['token']).value;
  return {
    ...(serverUrl === undefined ? {} : { serverUrl }),
    ...(token === undefined ? {} : { token }),
  };
};
