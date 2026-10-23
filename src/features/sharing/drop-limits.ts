/* Bounds of an anonymous drop: nobody is signed in, so the request itself
   carries the lifetime, and both are capped to keep the public endpoint from
   becoming free storage. Shared by the route and the MCP tool schema. */
export const DROP_MAX_VALUE_BYTES = 16 * 1024;
export const DROP_MAX_TTL_MINUTES = 1440;

const encoder = new TextEncoder();

export const isValidDropValue = (value: string): boolean =>
  value !== '' && encoder.encode(value).byteLength <= DROP_MAX_VALUE_BYTES;

export const isValidDropTtl = (minutes: number): boolean =>
  Number.isInteger(minutes) && minutes >= 1 && minutes <= DROP_MAX_TTL_MINUTES;
