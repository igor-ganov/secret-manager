const QUOTES = new Set(['"', "'"]);

type Scan = {
  readonly tokens: readonly string[];
  readonly current: string;
  readonly quote: string | undefined;
  readonly open: boolean;
};

const START: Scan = { tokens: [], current: '', quote: undefined, open: false };

const step = (scan: Scan, character: string): Scan => {
  if (scan.quote !== undefined) {
    return character === scan.quote
      ? { ...scan, quote: undefined }
      : { ...scan, current: scan.current + character };
  }
  if (QUOTES.has(character)) {
    return { ...scan, quote: character, open: true };
  }
  if (/\s/.test(character)) {
    return scan.open
      ? { tokens: [...scan.tokens, scan.current], current: '', quote: undefined, open: false }
      : scan;
  }
  return { ...scan, current: scan.current + character, open: true };
};

/* Splits a typed line into arguments; quotes group words, so a value with
   spaces can be entered as "like this" inside the session. */
export const splitCommandLine = (line: string): readonly string[] => {
  const scan = Array.from(line).reduce(step, START);
  return scan.open ? [...scan.tokens, scan.current] : scan.tokens;
};
