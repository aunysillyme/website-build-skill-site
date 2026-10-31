import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { renderProjectsPopup, escapeHtml } from './lib/projects-popup-render.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const { rows } = JSON.parse(readFileSync(resolve(root, '.repo-build/set.json'), 'utf8'));
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--check') || args.length > 1) throw new Error('Usage: node scripts/render-projects-popup.mjs [--check]');
const check = args.includes('--check');
const start = '<!-- projects-popup:start -->';
const end = '<!-- projects-popup:end -->';
const html = readFileSync(resolve(root, 'landing.html'), 'utf8');
if (html.split(start).length !== 2 || html.split(end).length !== 2 || html.indexOf(start) > html.indexOf(end)) {
  throw new Error('landing.html: expected one ordered projects popup marker pair');
}
const popup = renderProjectsPopup({ rows, current: 'website-build-skill', id: 'projects-popup', fallbackHref: 'https://aunysillyme.dev/#projects' });
const updated = html.slice(0, html.indexOf(start) + start.length) + popup + html.slice(html.indexOf(end));
const siblingsStart = '<!-- projects-siblings:start -->';
const siblingsEnd = '<!-- projects-siblings:end -->';
if (updated.split(siblingsStart).length !== 2 || updated.split(siblingsEnd).length !== 2 || updated.indexOf(siblingsStart) > updated.indexOf(siblingsEnd)) {
  throw new Error('landing.html: expected one ordered projects siblings marker pair');
}
const siblings = rows.filter(({ name }) => name !== 'website-build-skill').map(({ name }) => `<a href="https://${escapeHtml(name)}.aunysillyme.dev/" target="_blank" rel="noopener noreferrer">${escapeHtml(name)} ↗</a>`).join('');
const rendered = updated.slice(0, updated.indexOf(siblingsStart) + siblingsStart.length) + siblings + updated.slice(updated.indexOf(siblingsEnd));
const configPath = resolve(root, 'vercel.json');
const config = readFileSync(configPath, 'utf8');
const hashes = rows.map((_, index) => `'sha256-${createHash('sha256').update(`--row:${index}`).digest('base64')}'`).join(' ');
const directive = `style-src-attr 'unsafe-hashes' ${hashes};`;
if (!/style-src-attr [^;]*;/.test(config)) throw new Error('vercel.json: missing style-src-attr directive');
const updatedConfig = config.replace(/style-src-attr [^;]*;/, directive);
if (rendered !== html || updatedConfig !== config) {
  if (check) { console.error('Generated projects markup or CSP hashes are out of date'); process.exitCode = 1; }
  else {
    if (rendered !== html) writeFileSync(resolve(root, 'landing.html'), rendered);
    if (updatedConfig !== config) writeFileSync(configPath, updatedConfig);
    console.log('Rendered projects markup and CSP hashes.');
  }
} else if (check) console.log('Projects markup and CSP hashes are current.');
