import type { H } from './h.ts';

export type UploadProgress = { readonly name: string; readonly sent: number; readonly total: number };

/* A native <progress> (role progressbar) named after the file, with the
   percentage as text for those who read rather than look (AC-8.1). */
export const renderUploadProgress = (h: H, { name, sent, total }: UploadProgress): readonly Node[] => [
  h('p', {}, `Uploading ${name}: ${String(Math.floor((sent / total) * 100))}%`),
  h('progress', { attrs: { max: String(total), value: String(sent), 'aria-label': `Uploading ${name}` } }),
];
