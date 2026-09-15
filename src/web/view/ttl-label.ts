const NAMED: Readonly<Record<number, string>> = { 1440: '1 day' };

export const ttlLabel = (minutes: number): string => NAMED[minutes] ?? `${minutes} min`;
