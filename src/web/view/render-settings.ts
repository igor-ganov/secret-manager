import type { SettingsResponse } from '../../features/http-api/api-types.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { renderTtlChoices } from './render-ttl-choices.ts';

export const renderSettings = (h: H, actions: Actions, settings: SettingsResponse): HTMLElement =>
  h(
    'section',
    { attrs: { 'aria-labelledby': 'settings-heading' } },
    h('h2', { attrs: { id: 'settings-heading' } }, 'Settings'),
    renderTtlChoices(h, {
      presets: settings.presets,
      current: settings.linkTtlMinutes,
      onChange: (minutes) => void actions.setTtl(minutes),
    }),
  );
