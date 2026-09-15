import type { Route } from '../state/app-state.ts';
import type { Actions } from '../view/actions.ts';

/* Actions only the shell itself triggers (start-up and fragment changes). */
export type ShellActions = Actions & {
  readonly init: (route: Route) => Promise<void>;
  readonly loadRoute: (route: Route) => Promise<void>;
};
