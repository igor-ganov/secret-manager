import type { Actions } from '../view/actions.ts';
import type { ActionDeps } from './action-deps.ts';
import { dropFile } from './actions/drop-file.ts';
import { pickFile, removeFile } from './actions/pick-file.ts';
import { shareFile } from './actions/share-file.ts';

type FileActions = Pick<Actions, 'pickFile' | 'removeFile' | 'dropFile' | 'shareFile'>;

/* Secret files (secret-files US-4): choose, forget, send anonymously or signed in. */
export const createFileActions = (deps: ActionDeps): FileActions => ({
  pickFile: pickFile(deps),
  removeFile: removeFile(deps),
  dropFile: dropFile(deps),
  shareFile: shareFile(deps),
});
