import { EXIT, failed, type Outcome } from '../outcome.ts';

export const ABORTED: Outcome = failed('Aborted.', EXIT.rejected);

export const EMPTY_VALUE: Outcome = failed('The value must not be empty.', EXIT.usage);
