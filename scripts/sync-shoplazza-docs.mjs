import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'docs', 'shoplazza');
const destDir = path.join(root, 'public', 'shoplazza-docs');

fs.rmSync(destDir, { recursive: true, force: true });
fs.cpSync(srcDir, destDir, { recursive: true });
console.log('synced docs/shoplazza -> public/shoplazza-docs');