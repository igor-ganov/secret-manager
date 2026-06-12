import { describe, expect, test } from 'bun:test';
import { buildLinkMessage } from './build-link-message.ts';

const URL = 'https://example.com/s/abc123';

describe('buildLinkMessage', () => {
  test('contains the intro, the link and a curl POST snippet for the same url', () => {
    const { text } = buildLinkMessage('One-time link:', URL, 5);
    expect(text).toContain('One-time link:');
    expect(text).toContain(URL);
    expect(text).toContain(`curl -X POST ${URL}`);
    expect(text).toContain('Valid for 5 minutes, opens once.');
  });

  test('marks exactly the curl snippet as a pre block entity', () => {
    const { text, entities } = buildLinkMessage('Intro:', URL, 5);
    expect(entities).toHaveLength(1);
    const [entity] = entities;
    expect(entity?.type).toBe('pre');
    const snippet = text.slice(entity?.offset, (entity?.offset ?? 0) + (entity?.length ?? 0));
    expect(snippet).toBe(`curl -X POST ${URL}`);
  });

  test('keeps the entity offset correct for intros with non-ascii characters', () => {
    const { text, entities } = buildLinkMessage('Ссылка на “ключ”:', URL, 5);
    const [entity] = entities;
    const snippet = text.slice(entity?.offset, (entity?.offset ?? 0) + (entity?.length ?? 0));
    expect(snippet).toBe(`curl -X POST ${URL}`);
  });
});
