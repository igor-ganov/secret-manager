export type CallbackAction =
  | { readonly kind: 'get'; readonly key: string }
  | { readonly kind: 'set'; readonly key: string }
  | { readonly kind: 'delete-request'; readonly key: string }
  | { readonly kind: 'delete-confirm'; readonly key: string }
  | { readonly kind: 'set-ttl'; readonly minutes: number }
  | { readonly kind: 'cancel-set' }
  | { readonly kind: 'cancel-delete' }
  | { readonly kind: 'noop' };

const KEYED_PREFIXES = {
  'g:': 'get',
  's:': 'set',
  'd:': 'delete-request',
  'D:': 'delete-confirm',
} as const;

const BARE_ACTIONS = {
  'cancel-set': 'cancel-set',
  'cancel-delete': 'cancel-delete',
  noop: 'noop',
} as const;

const isKeyedPrefix = (prefix: string): prefix is keyof typeof KEYED_PREFIXES =>
  prefix in KEYED_PREFIXES;

const isBareAction = (data: string): data is keyof typeof BARE_ACTIONS =>
  data in BARE_ACTIONS;

const TTL_PREFIX = 't:';

export const buildCallbackData = (action: CallbackAction): string => {
  switch (action.kind) {
    case 'get':
      return `g:${action.key}`;
    case 'set':
      return `s:${action.key}`;
    case 'delete-request':
      return `d:${action.key}`;
    case 'delete-confirm':
      return `D:${action.key}`;
    case 'set-ttl':
      return `${TTL_PREFIX}${action.minutes}`;
    case 'cancel-set':
    case 'cancel-delete':
    case 'noop':
      return action.kind;
  }
};

const parseTtl = (key: string): CallbackAction | undefined => {
  const minutes = Number(key);
  return Number.isInteger(minutes) && minutes > 0 ? { kind: 'set-ttl', minutes } : undefined;
};

export const parseCallbackData = (data: string): CallbackAction | undefined => {
  if (isBareAction(data)) {
    return { kind: BARE_ACTIONS[data] };
  }
  const prefix = data.slice(0, 2);
  const key = data.slice(2);
  if (prefix === TTL_PREFIX) {
    return parseTtl(key);
  }
  if (isKeyedPrefix(prefix) && key !== '') {
    return { kind: KEYED_PREFIXES[prefix], key };
  }
  return undefined;
};
