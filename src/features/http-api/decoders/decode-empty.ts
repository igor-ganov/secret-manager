import type { Decoder } from './decoder.ts';

/* For 204 responses: success carries no payload. */
export const decodeEmpty: Decoder<true> = () => true;
