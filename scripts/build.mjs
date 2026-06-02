import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pages, robots, sitemap } from '../src/site.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');

async function writeRoute(slug, html) {
  const targetDir = slug === '' ? dist : join(dist, slug);
  await mkdir(targetDir, { recursive: true });
  await writeFile(join(targetDir, 'index.html'), html);
}

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'assets'), { recursive: true });

await cp(join(root, 'public'), dist, { recursive: true });
await cp(join(root, 'src', 'styles.css'), join(dist, 'assets', 'styles.css'));
await cp(join(root, 'src', 'site-client.js'), join(dist, 'assets', 'site.js'));

for (const [slug, render] of pages) {
  await writeRoute(slug, render());
}

await writeFile(join(dist, 'sitemap.xml'), sitemap());
await writeFile(join(dist, 'robots.txt'), robots());

console.log(`Built ${pages.length} pages into ${dist}`);
