import type { CeremonyOptionsResponse } from '../api-types.ts';
import { isRecord } from '../guards/is-record.ts';
import { decodeWith } from './decode-with.ts';

/* The options object itself is opaque here: the browser's WebAuthn JSON
   parser validates it. */
const isCeremonyOptions = (value: unknown): value is CeremonyOptionsResponse =>
  isRecord(value) && isRecord(value['options']);

export const decodeCeremonyOptions = decodeWith(isCeremonyOptions);
