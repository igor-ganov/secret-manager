import type { RowMode } from '../../state/app-state.ts';
import type { ActionDeps } from '../action-deps.ts';

export const setRowMode =
  ({ store }: ActionDeps) =>
  (key: string, mode: RowMode): void =>
    store.patch({ rowModes: { ...store.get().rowModes, [key]: mode } });
