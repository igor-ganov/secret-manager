/* Compiles the console utility into a single Windows executable. Set
   SECRET_MANAGER_URL to bake in the server so `login` only asks for the token. */
import { mkdir } from 'node:fs/promises';

const OUT_FILE = 'dist/secret.exe';
const target = process.env['CLI_TARGET'] ?? 'bun-windows-x64';
const serverUrl = process.env['SECRET_MANAGER_URL'];

await mkdir('dist', { recursive: true });

const defines = serverUrl === undefined ? [] : ['--define', `SECRET_MANAGER_URL=${JSON.stringify(serverUrl)}`];

const build = Bun.spawn(
  ['bun', 'build', '--compile', `--target=${target}`, '--minify', ...defines, 'src/cli/main.ts', '--outfile', OUT_FILE],
  { stdout: 'inherit', stderr: 'inherit' },
);

process.exit(await build.exited);
