import type { OneTimeLinkStore } from '../one-time-links/one-time-link-store.ts';
import type { SecretStore } from '../secrets/secret-store.ts';
import type { SettingsStore } from '../settings/settings-store.ts';
import type { IssuedLink, SharingService } from './sharing-service.ts';

export type SharingDependencies = {
  readonly secrets: SecretStore;
  readonly links: OneTimeLinkStore;
  readonly settings: SettingsStore;
  readonly buildLinkUrl: (token: string) => string;
  /* Default link lifetime when a user has not chosen one in Settings. */
  readonly linkTtlMinutes: number;
};

const MS_PER_MINUTE = 60 * 1000;

export const createSharingService = ({
  secrets,
  links,
  settings,
  buildLinkUrl,
  linkTtlMinutes,
}: SharingDependencies): SharingService => {
  const getTtlMinutes = async (userId: number): Promise<number> =>
    (await settings.getTtlMinutes(userId)) ?? linkTtlMinutes;

  const share = async (userId: number, value: string): Promise<IssuedLink> => {
    const ttlMinutes = await getTtlMinutes(userId);
    const token = await links.issue(value, ttlMinutes * MS_PER_MINUTE);
    return { url: buildLinkUrl(token), ttlMinutes };
  };

  const save = (userId: number, key: string, value: string): Promise<void> =>
    secrets.save(userId, key, value);

  const saveAndShare = async (userId: number, key: string, value: string): Promise<IssuedLink> => {
    await save(userId, key, value);
    return share(userId, value);
  };

  const linkFor = async (userId: number, key: string): Promise<IssuedLink | undefined> => {
    const value = await secrets.read(userId, key);
    return value === undefined ? undefined : share(userId, value);
  };

  return {
    share,
    save,
    saveAndShare,
    linkFor,
    read: secrets.read,
    list: secrets.list,
    remove: secrets.remove,
    getTtlMinutes,
    setTtlMinutes: settings.setTtlMinutes,
  };
};
