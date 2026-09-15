const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/Windows/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone|iPad/, 'iOS'],
  [/Mac OS/, 'macOS'],
  [/Linux/, 'Linux'],
];

const firstMatch = (table: readonly (readonly [RegExp, string])[], userAgent: string, fallback: string): string =>
  table.filter(([pattern]) => pattern.test(userAgent)).map(([, name]) => name)[0] ?? fallback;

/* Default label for a passkey created in this browser, e.g. "Chrome on Windows". */
export const describeBrowser = (userAgent: string): string =>
  `${firstMatch(BROWSERS, userAgent, 'Browser')} on ${firstMatch(SYSTEMS, userAgent, 'this device')}`;
