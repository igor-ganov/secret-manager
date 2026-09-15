export const withoutKey = <V>(record: Readonly<Record<string, V>>, key: string): Readonly<Record<string, V>> =>
  Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
