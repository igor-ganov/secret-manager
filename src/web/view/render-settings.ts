import type { SettingsResponse } from '../../features/http-api/api-types.ts';
import type { Actions } from './actions.ts';
import type { H } from './h.ts';
import { ttlLabel } from './ttl-label.ts';

const CHECKED: Readonly<Record<`${boolean}`, Readonly<Record<string, string>>>> = {
  true: { checked: '' },
  false: {},
};

const choice = (h: H, actions: Actions, minutes: number, current: number): HTMLElement =>
  h(
    'label',
    {},
    h('input', {
      attrs: {
        type: 'radio',
        name: 'ttl',
        value: String(minutes),
        ...CHECKED[`${minutes === current}`],
      },
      on: { change: () => void actions.setTtl(minutes) },
    }),
    ttlLabel(minutes),
  );

export const renderSettings = (h: H, actions: Actions, settings: SettingsResponse): HTMLElement =>
  h(
    'section',
    { attrs: { 'aria-labelledby': 'settings-heading' } },
    h('h2', { attrs: { id: 'settings-heading' } }, 'Settings'),
    h(
      'fieldset',
      { attrs: { role: 'radiogroup', 'aria-labelledby': 'ttl-legend' } },
      h('legend', { attrs: { id: 'ttl-legend' } }, 'Link lifetime'),
      h(
        'div',
        { attrs: { class: 'choices' } },
        ...settings.presets.map((minutes) => choice(h, actions, minutes, settings.linkTtlMinutes)),
      ),
    ),
  );
