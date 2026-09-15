import type { H } from './h.ts';

export const renderError = (h: H, error: string | undefined): readonly Node[] => {
  switch (error) {
    case undefined:
      return [];
    default:
      return [h('div', { attrs: { role: 'alert' } }, error)];
  }
};
