import type { Command } from './command.ts';
import { get } from './get.ts';
import { createHelp } from './help.ts';
import { link } from './link.ts';
import { list } from './list.ts';
import { login } from './login.ts';
import { logout } from './logout.ts';
import { rm } from './rm.ts';
import { set } from './set.ts';
import { share } from './share.ts';
import { ttl } from './ttl.ts';
import { whoami } from './whoami.ts';

const help = createHelp(() => COMMANDS);

export const COMMANDS: readonly Command[] = [share, set, get, link, list, rm, ttl, login, logout, whoami, help];

export const findCommand = (name: string): Command | undefined =>
  COMMANDS.find((command) => command.name === name);
