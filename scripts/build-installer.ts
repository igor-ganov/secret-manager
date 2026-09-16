/* Compiles installer/secret.iss with Inno Setup into dist/secret-setup.exe.
   Expects dist/secret.exe from `bun run build:cli`. APP_VERSION (or the git
   tag in CI) becomes the installer's version. */
import { existsSync } from 'node:fs';

const CANDIDATES = [
  process.env['ISCC'],
  'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
  'iscc',
].filter((candidate): candidate is string => candidate !== undefined && candidate !== '');

const compiler = CANDIDATES.find((candidate) => candidate === 'iscc' || existsSync(candidate));
if (compiler === undefined || !existsSync('dist/secret.exe')) {
  console.error('Need Inno Setup 6 (ISCC.exe) and dist/secret.exe (run `bun run build:cli` first).');
  process.exit(1);
}

const version = (process.env['APP_VERSION'] ?? '0.0.0').replace(/^v/, '');
const build = Bun.spawn([compiler, `/DAppVersion=${version}`, 'installer/secret.iss'], {
  stdout: 'inherit',
  stderr: 'inherit',
});
process.exit(await build.exited);
