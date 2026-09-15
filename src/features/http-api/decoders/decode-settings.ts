import type { SettingsResponse } from '../api-types.ts';
import { isArrayOf } from '../guards/is-array-of.ts';
import { isNumber } from '../guards/is-number.ts';
import { isRecord } from '../guards/is-record.ts';
import { decodeWith } from './decode-with.ts';

const isSettings = (value: unknown): value is SettingsResponse =>
  isRecord(value) && isNumber(value['linkTtlMinutes']) && isArrayOf(isNumber)(value['presets']);

export const decodeSettings = decodeWith(isSettings);
