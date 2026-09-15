/* Fields Telegram's login flow hands back (all optional except id, auth_date
   and hash). Unknown extra fields are kept: they take part in the signature. */
export type TelegramLoginPayload = {
  readonly id: number;
  readonly auth_date: number;
  readonly hash: string;
  readonly [field: string]: string | number;
};

const isScalar = (value: unknown): value is string | number =>
  typeof value === 'string' || typeof value === 'number';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value instanceof Object && !Array.isArray(value);

export const parseTelegramLoginPayload = (value: unknown): TelegramLoginPayload | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const { id, auth_date: authDate, hash } = value;
  if (typeof id !== 'number' || typeof authDate !== 'number' || typeof hash !== 'string') {
    return undefined;
  }
  const scalars = Object.entries(value).filter(
    (entry): entry is [string, string | number] => isScalar(entry[1]),
  );
  return { ...Object.fromEntries(scalars), id, auth_date: authDate, hash };
};
