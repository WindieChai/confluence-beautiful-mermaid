import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');

await mkdir(dist, { recursive: true });

const shared = {
  platform: 'browser',
  target: ['es2018'],
  minify: true,
  sourcemap: false,
  logLevel: 'info',
};

await esbuild.build({
  ...shared,
  entryPoints: [join(root, 'node_modules/beautiful-mermaid/dist/index.js')],
  bundle: true,
  format: 'iife',
  globalName: 'BeautifulMermaid',
  outfile: join(dist, 'beautiful-mermaid.bundle.js'),
});

await esbuild.build({
  ...shared,
  entryPoints: [join(root, 'src/init.js')],
  bundle: true,
  format: 'iife',
  outfile: join(dist, 'beautiful-mermaid.init.js'),
});

await copyFile(join(root, 'src', 'icon.png'), join(dist, 'beautiful-mermaid.icon.png'));

console.log('Built dist/beautiful-mermaid.bundle.js');
console.log('Built dist/beautiful-mermaid.init.js');
console.log('Copied dist/beautiful-mermaid.icon.png');
