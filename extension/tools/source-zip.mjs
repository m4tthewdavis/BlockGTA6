// Creates dist/safehouse-source-<version>.zip for Firefox Add-ons review (committed files only).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain', '--', 'extension', 'rules', 'docs'], { cwd: repo, encoding: 'utf8' }).trim();
if (dirty) console.warn('warning: uncommitted changes are NOT included in the source zip:\n' + dirty);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', `safehouse-source-${version}.zip`);
execFileSync('git', ['archive', '--format=zip', '-o', out, 'HEAD', 'extension', 'rules', 'docs'], { cwd: repo });
console.log('wrote', path.relative(root, out));
