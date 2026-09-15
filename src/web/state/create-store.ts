export type Store<S> = {
  readonly get: () => S;
  readonly patch: (partial: Partial<S>) => void;
  readonly subscribe: (listener: (state: S) => void) => void;
};

/* One mutable cell in the whole client; every change is a shallow merge
   followed by a full re-render. */
export const createStore = <S extends object>(initial: S): Store<S> => {
  let state = initial;
  const listeners: ((state: S) => void)[] = [];

  const patch = (partial: Partial<S>): void => {
    state = { ...state, ...partial };
    listeners.forEach((listener) => listener(state));
  };

  return {
    get: () => state,
    patch,
    subscribe: (listener) => {
      listeners.push(listener);
      listener(state);
    },
  };
};
