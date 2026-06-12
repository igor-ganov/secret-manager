export type SecretStore = {
  readonly save: (userId: number, key: string, value: string) => Promise<void>;
  readonly read: (userId: number, key: string) => Promise<string | undefined>;
  readonly list: (userId: number) => Promise<readonly string[]>;
  readonly remove: (userId: number, key: string) => Promise<void>;
};
