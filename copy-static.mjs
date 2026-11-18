// Vite leaves classic <script src> files untouched, so copy them into dist after the build.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
mkdirSync('dist/src', { recursive: true });
cpSync('vendor', 'dist/vendor', { recursive: true });
cpSync('src/app.js', 'dist/src/app.js');
if (existsSync('images')) cpSync('images', 'dist/images', { recursive: true });
console.log('Copied vendor/ and src/app.js into dist/');
