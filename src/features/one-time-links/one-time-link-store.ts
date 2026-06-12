export type OneTimeLinkStore = {
  readonly issue: (value: string) => Promise<string>;
  readonly peek: (token: string) => Promise<boolean>;
  readonly consume: (token: string) => Promise<string | undefined>;
};
