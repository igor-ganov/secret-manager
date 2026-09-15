/* Account ids live above 2^40 so they can never collide with Telegram user
   ids (which are far below) inside the shared `user_id` columns. 48 random
   bits on top keep the value a safe integer. */
export const ACCOUNT_ID_FLOOR = 2 ** 40;

export const createAccountId = (): number => {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const random = bytes.reduce((accumulated, byte) => accumulated * 256 + byte, 0);
  return ACCOUNT_ID_FLOOR + random;
};

export const isAccountId = (id: number): boolean => Number.isSafeInteger(id) && id >= ACCOUNT_ID_FLOOR;
