import type { Notice } from '../state/app-state.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { renderFreshToken } from './render-fresh-token.ts';
import { renderLinkResult } from './render-link-result.ts';

const content = (h: H, actions: Actions, notice: Notice): readonly Node[] => {
  switch (notice.kind) {
    case 'idle':
      return [];
    case 'info':
      return [h('p', {}, notice.text)];
    case 'link':
      return renderLinkResult(h, actions, notice.intro, notice.link);
    case 'token':
      return renderFreshToken(h, actions, notice.token);
  }
};

const className = (notice: Notice): string => {
  switch (notice.kind) {
    case 'idle':
      return '';
    case 'info':
    case 'link':
    case 'token':
      return 'notice';
  }
};

export const renderNotice = (h: H, actions: Actions, notice: Notice): HTMLElement =>
  h('div', { attrs: { role: 'status', class: className(notice) } }, ...content(h, actions, notice));
