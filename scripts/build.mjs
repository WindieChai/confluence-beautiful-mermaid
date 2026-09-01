import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');

await mkdir(dist, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, 'node_modules/beautiful-mermaid/dist/index.js')],
  bundle: true,
  format: 'iife',
  globalName: 'BeautifulMermaid',
  outfile: join(dist, 'beautiful-mermaid.bundle.js'),
  platform: 'browser',
  target: ['es2018'],
  minify: true,
  sourcemap: true,
  logLevel: 'info',
});

await copyFile(join(root, 'src/init.js'), join(dist, 'mermaid-init.js'));

console.log('Built dist/beautiful-mermaid.bundle.js');
console.log('Copied dist/mermaid-init.js');
