import { describe, expect, test } from 'bun:test';
import { createOneTimeLinkStore } from '../one-time-links/create-one-time-link-store.ts';
import { createSecretStore } from '../secrets/create-secret-store.ts';
import { createSettingsStore } from '../settings/create-settings-store.ts';
import { createSharingService } from './create-sharing-service.ts';

const USER = 7;

const build = () => {
  const issued: number[] = [];
  let counter = 0;
  const links = createOneTimeLinkStore({
    ttlMs: 1,
    now: () => 0,
    createToken: () => `tok${(counter += 1)}`,
  });
  const spyingLinks = {
    ...links,
    issue: (value: string, ttlMs?: number) => {
      issued.push(ttlMs ?? -1);
      return links.issue(value, ttlMs);
    },
  };
  const service = createSharingService({
    secrets: createSecretStore(':memory:'),
    links: spyingLinks,
    settings: createSettingsStore(':memory:'),
    buildLinkUrl: (token) => `https://x.test/s/${token}`,
    linkTtlMinutes: 5,
  });
  return { service, links, issued };
};

describe('createSharingService', () => {
  test('share issues a link with the default lifetime and saves nothing (AC-4.1)', async () => {
    const { service, links, issued } = build();
    const link = await service.share(USER, 'v');
    expect(link).toEqual({ url: 'https://x.test/s/tok1', ttlMinutes: 5 });
    expect(issued).toEqual([5 * 60 * 1000]);
    expect(await links.consume('tok1')).toBe('v');
    expect(await service.list(USER)).toEqual([]);
  });

  test('saveAndShare stores the pair and links to the value (AC-4.2)', async () => {
    const { service, links } = build();
    const link = await service.saveAndShare(USER, 'k', 'v');
    expect(link.url).toBe('https://x.test/s/tok1');
    expect(await service.read(USER, 'k')).toBe('v');
    expect(await links.consume('tok1')).toBe('v');
  });

  test('linkFor issues a fresh link to a stored value or nothing (AC-4.7)', async () => {
    const { service } = build();
    await service.save(USER, 'k', 'stored');
    expect(await service.linkFor(USER, 'k')).toEqual({ url: 'https://x.test/s/tok1', ttlMinutes: 5 });
    expect(await service.linkFor(USER, 'missing')).toBeUndefined();
  });

  test('links honor the user-configured lifetime (AC-5.1, AC-5.2)', async () => {
    const { service, issued } = build();
    await service.setTtlMinutes(USER, 30);
    expect(await service.getTtlMinutes(USER)).toBe(30);
    await service.share(USER, 'v');
    expect(issued).toEqual([30 * 60 * 1000]);
    expect(await service.getTtlMinutes(USER + 1)).toBe(5);
  });
});
