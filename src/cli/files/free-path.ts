import type { LocalFiles } from '../io/local-files.ts';

const FALLBACK_NAME = 'download';

/* The server validates names, but a name from the network is still only a
   name: anything that could climb out of the folder is cut away. */
export const safeFileName = (name: string): string => {
  const base = (name.split(/[\\/]/).pop() ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return base === '' || base === '.' || base === '..' ? FALLBACK_NAME : base;
};

/* `report.pdf`, `report (1).pdf`, `report (2).pdf`…; a leading dot is part of
   the name, not an extension (`.env (1)`). */
export const candidateName = (name: string, index: number): string => {
  if (index === 0) {
    return name;
  }
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)} (${String(index)})${name.slice(dot)}` : `${name} (${String(index)})`;
};

/* The first candidate in the working folder that does not exist yet, so a
   fetched file never overwrites anything (secret-files AC-5.2). */
export const freePath = async (files: LocalFiles, name: string, index = 0): Promise<string> => {
  const path = files.resolve(candidateName(name, index));
  return (await files.exists(path)) ? freePath(files, name, index + 1) : path;
};
