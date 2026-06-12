export type AppConfig = {
  readonly botToken: string;
  readonly port: number;
  readonly baseUrl: string;
  readonly databasePath: string;
  readonly linkTtlMinutes: number;
};

type EnvSource = Readonly<Record<string, string | undefined>>;

const readRequired = (env: EnvSource, name: string): string => {
  const value = env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${name}. Check your .env file.`);
  }
  return value;
};

const readNumber = (env: EnvSource, name: string, fallback: number): number => {
  const raw = env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive number, got "${raw}".`);
  }
  return parsed;
};

export const loadConfig = (env: EnvSource): AppConfig => {
  const port = readNumber(env, 'PORT', 3000);
  return {
    botToken: readRequired(env, 'BOT_TOKEN'),
    port,
    baseUrl: env['BASE_URL'] ?? `http://localhost:${port}`,
    databasePath: env['DATABASE_PATH'] ?? 'secrets.sqlite',
    linkTtlMinutes: readNumber(env, 'LINK_TTL_MINUTES', 5),
  };
};
