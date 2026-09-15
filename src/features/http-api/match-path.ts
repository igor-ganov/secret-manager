export type PathParams = Readonly<Record<string, string>>;

const decode = (segment: string): string | undefined => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
};

/* Matches `/api/secrets/:key/link` style patterns; `:name` segments are
   URL-decoded. Bun has no URLPattern yet, and the table is tiny. */
export const matchPath = (pattern: string, pathname: string): PathParams | undefined => {
  const expected = pattern.split('/');
  const actual = pathname.split('/');
  if (expected.length !== actual.length) {
    return undefined;
  }
  const params: Record<string, string> = {};
  for (const [index, part] of expected.entries()) {
    const segment = actual[index] ?? '';
    if (part.startsWith(':')) {
      const decoded = decode(segment);
      if (decoded === undefined || decoded === '') {
        return undefined;
      }
      params[part.slice(1)] = decoded;
    } else if (part !== segment) {
      return undefined;
    }
  }
  return params;
};
