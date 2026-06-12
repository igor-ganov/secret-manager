export type PendingSetStore = {
  readonly begin: (userId: number, key: string) => Promise<void>;
  readonly take: (userId: number) => Promise<string | undefined>;
  readonly cancel: (userId: number) => Promise<void>;
};
