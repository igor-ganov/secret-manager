import type { AppState } from './app-state.ts';

export const initialState: AppState = {
  session: { kind: 'loading' },
  keys: [],
  rowModes: {},
  settings: { linkTtlMinutes: 5, presets: [] },
  tokens: [],
  notice: { kind: 'idle' },
  error: undefined,
  toast: '',
};
