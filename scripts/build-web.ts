/* Bundles the site into public/ for Cloudflare Workers static assets.
   Bun treats index.html as an entrypoint and hashes the scripts and styles
   it references; `_headers` is copied verbatim for the assets router. */
import { cp, mkdir, rm } from 'node:fs/promises';

const OUT_DIR = 'public';

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const result = await Bun.build({
  entrypoints: ['src/web/index.html'],
  outdir: OUT_DIR,
  minify: true,
  sourcemap: 'none',
});

if (!result.success) {
  console.error(result.logs.map(String).join('\n'));
  process.exit(1);
}

await cp('src/web/_headers', `${OUT_DIR}/_headers`);
console.log(`Built ${result.outputs.length} files into ${OUT_DIR}/`);
