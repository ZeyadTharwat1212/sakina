// Stamp the service-worker cache name per build so updated content packs reach existing installs.
import fs from 'node:fs';
const v = `sakina-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)}`;
const p = 'dist/sw.js';
fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/const VERSION = '[^']+'/, `const VERSION = '${v}'`));
console.log('sw cache version', v);
