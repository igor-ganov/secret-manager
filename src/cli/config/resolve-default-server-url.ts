/* `bun build --compile --define SECRET_MANAGER_URL='"https://…"'` bakes a
   default into the executable; the environment variable wins at run time,
   and with neither the login prompt simply has no default. */
declare global {
  const SECRET_MANAGER_URL: string | undefined;
}

const builtIn = (): string | undefined =>
  typeof SECRET_MANAGER_URL === 'string' ? SECRET_MANAGER_URL : undefined;

export const resolveDefaultServerUrl = (
  env: Readonly<Record<string, string | undefined>>,
): string | undefined => {
  const fromEnv = env['SECRET_MANAGER_URL'];
  return fromEnv === undefined || fromEnv === '' ? builtIn() : fromEnv;
};
