const MASK = '••••';

type Redactor = (args: readonly string[]) => string | undefined;

/* Commands whose inline arguments may carry a secret: the typed line is
   replaced on screen (and kept out of the prompt history) the moment it is
   submitted, so a value entered inline lingers no longer than a hidden one. */
const REDACTORS: Readonly<Record<string, Redactor>> = {
  share: (args) => (args.length === 0 ? undefined : `share ${MASK}`),
  set: (args) => (args.length < 2 ? undefined : `set ${args[0]} ${MASK}`),
};

export const redactSecretLine = (argv: readonly string[]): string | undefined => {
  const [name, ...args] = argv;
  return name === undefined ? undefined : REDACTORS[name]?.(args);
};
