import type { AppState } from './app-state.ts';

export const initialState: AppState = {
  session: { kind: 'loading' },
  route: { kind: 'home' },
  keys: [],
  rowModes: {},
  settings: { linkTtlMinutes: 5, presets: [] },
  devices: { passkeys: [], telegram: { linked: false }, tokens: [] },
  enrollmentInfo: undefined,
  linkInfo: undefined,
  quickDraft: '',
  quickTtlMinutes: 5,
  notice: { kind: 'idle' },
  error: undefined,
  toast: '',
};
