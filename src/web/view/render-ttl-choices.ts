import type { H } from './h.ts';
import { ttlLabel } from './ttl-label.ts';

export type TtlChoicesProps = {
  readonly presets: readonly number[];
  readonly current: number;
  /* Settings persists on change; the quick start reads the value on submit. */
  readonly onChange?: (minutes: number) => void;
};

const CHECKED: Readonly<Record<`${boolean}`, Readonly<Record<string, string>>>> = {
  true: { checked: '' },
  false: {},
};

const NOOP = (): void => undefined;

const choice = (h: H, { current, onChange = NOOP }: TtlChoicesProps, minutes: number): HTMLElement =>
  h(
    'label',
    {},
    h('input', {
      attrs: { type: 'radio', name: 'ttl', value: String(minutes), ...CHECKED[`${minutes === current}`] },
      on: { change: () => onChange(minutes) },
    }),
    ttlLabel(minutes),
  );

/* The one "Link lifetime" radio group, shared by Settings and the quick start
   (they never render together, so the ids stay unique). */
export const renderTtlChoices = (h: H, props: TtlChoicesProps): HTMLElement =>
  h(
    'fieldset',
    { attrs: { role: 'radiogroup', 'aria-labelledby': 'ttl-legend' } },
    h('legend', { attrs: { id: 'ttl-legend' } }, 'Link lifetime'),
    h('div', { attrs: { class: 'choices' } }, ...props.presets.map((minutes) => choice(h, props, minutes))),
  );
