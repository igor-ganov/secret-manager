/* Offered link lifetimes, in minutes; 1440 is one day. Discrete presets keep
   the choice unambiguous so a typed number is never mistaken for a secret. */
export const TTL_PRESETS_MINUTES: readonly number[] = [1, 5, 15, 30, 60, 1440];

export const isTtlPreset = (minutes: number): boolean => TTL_PRESETS_MINUTES.includes(minutes);
