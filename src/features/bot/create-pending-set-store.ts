import type { PendingSetStore } from './pending-set-store.ts';

export const createPendingSetStore = (): PendingSetStore => {
  const pendingKeys = new Map<number, string>();

  const begin = async (userId: number, key: string): Promise<void> => {
    pendingKeys.set(userId, key);
  };

  const take = async (userId: number): Promise<string | undefined> => {
    const key = pendingKeys.get(userId);
    pendingKeys.delete(userId);
    return key;
  };

  const cancel = async (userId: number): Promise<void> => {
    pendingKeys.delete(userId);
  };

  return { begin, take, cancel };
};
