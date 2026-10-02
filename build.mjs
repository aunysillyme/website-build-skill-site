import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { documentHtml, renderMarkdown, releaseEntries, pages, origin, repository, escape, populateLanding } from './content.mjs';
import { validRelease } from './assets/releases.js';
import {marked} from 'marked';


const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, 'source');
const out = path.join(here, 'dist');
const lock = JSON.parse(await readFile(path.join(here, 'source-lock.json'), 'utf8'));
const commit = lock.commit;
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Expected a full source commit SHA');
for (const [name, digest] of Object.entries(lock.files)) {
 const bytes = await readFile(path.join(root, name));
 if(createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error(`Source digest mismatch: ${name}`);
}
let siteCommit = process.env.VERCEL_GIT_COMMIT_SHA || execFileSync('git', ['rev-parse','HEAD'], {cwd:here,encoding:'utf8'}).trim();
if(!/^[a-f0-9]{40}$/.test(siteCommit)) throw new Error('Expected a full site commit SHA');
const built = new Date().toISOString();
const fallback = JSON.parse(await readFile(path.join(here, 'release-fallback.json'), 'utf8'));
let published = fallback;
let registryVerified = false;
try {
  const response = await fetch('https://registry.npmjs.org/website-build-skill/latest', {signal: AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error(`npm returned ${response.status}`);
  const metadata = await response.json();
  if (!validRelease(metadata)) throw new Error('Unexpected npm metadata');
  published = {name: metadata.name, version: metadata.version, verifiedAt: built};
  registryVerified = true;
} catch (error) {
  if (!validRelease(fallback) || !fallback.verifiedAt) throw error;
  console.warn(`npm lookup unavailable; using verified fallback ${fallback.version} (${fallback.verifiedAt})`);
}

const changelog = await readFile(path.join(root, 'CHANGELOG.md'), 'utf8');
const releases = releaseEntries(changelog);
const latest = releases.find(entry => entry.version === published.version);
function releaseSummary(markdown) {
  const tokens = marked.lexer(markdown);
  const list = tokens.find(token => token.type === 'list');
  return list ? list.items.slice(0, 2).map(item => item.raw).join('\n') : tokens.filter(token => token.type === 'paragraph').slice(0, 1).map(token => token.raw).join('\n');
}
const releasePanels = releases.map(entry => `<article class="release" data-release="${entry.version}"${entry === latest ? '' : ' hidden'}><div><strong>v${entry.version}</strong><small>${escape(entry.date)}</small></div><div class="release-copy">${renderMarkdown(releaseSummary(entry.markdown), 'CHANGELOG.md')}</div></article>`).join('\n');
const releaseArea = `<p class="note" data-release-status>${registryVerified ? 'Latest published version, checked with npm at build time.' : `Published version last verified ${escape(published.verifiedAt)}. Checking npm for an update.`}</p>${releasePanels}<p><a class="primary" href="/docs/changelog/">Full changelog ↗</a></p>`;
const proofFigures = '';
let landing = await readFile(path.join(here, 'landing.html'), 'utf8');
landing = populateLanding(landing, `v${published.version}`, releaseArea);
landing = landing.replace('{{PROOF}}', () => proofFigures);
landing = landing.replace('</footer>', `<span>Source <a href="${repository}/tree/${commit}" target="_blank" rel="noopener noreferrer">${commit.slice(0, 7)}</a></span></footer>`);

await rm(out, {recursive: true, force: true});
await mkdir(out, {recursive: true});
await cp(path.join(here, 'assets'), path.join(out, 'assets'), {recursive: true});
await writeFile(path.join(out, 'index.html'), documentHtml({title: 'Website Build Skill | AunySillyMe', description: 'A skill pack that teaches your AI current website-building practice in research, design, code, accessibility, performance, search and security.', route: '/', body: landing}));

const navItems = [...pages].map(([source, slug]) => `<a href="/docs/${slug}/">${escape(({overview: 'Overview', guides: 'All guides', commands: 'Commands', proof: 'Measured proof', changelog: 'Changelog'})[slug] || slug.replaceAll('-', ' '))}</a>`).join('');
const publicDocuments = new Map();
for (const [source, slug] of pages) {
  const markdown = await readFile(path.join(root, source), 'utf8');
  const title = markdown.match(/^# (.+)$/m)?.[1].replace(/[`*_]/g, '') || slug;
  const body = `<header class="top"><a class="brand" href="/"><img src="/assets/avatar.png" alt="AunySillyMe"><span>website-build-skill</span></a><nav class="topnav" aria-label="Project links"><a href="/">Home</a><a href="${repository}" target="_blank" rel="noopener noreferrer">GitHub ↗</a></nav></header>
<a class="skip" href="#document">Skip to content</a><div class="layout"><aside><p class="side-label">DOCUMENTATION</p><nav class="side-links" aria-label="Documentation">${navItems}</nav><div class="side-bottom">Questions or feedback?<a class="issue-button" href="${repository}/issues" target="_blank" rel="noopener noreferrer">File an issue ↗</a></div></aside>
<main class="main document" id="document"><details class="mobile-nav"><summary>Documentation</summary><nav aria-label="Mobile documentation">${navItems}</nav></details><div class="crumb"><a href="/">website-build-skill</a><span>/</span><span>Documentation</span></div>
<p class="source-note">From <a href="${repository}/blob/${commit}/${source}" target="_blank" rel="noopener noreferrer">${escape(source)}</a> · <a href="${repository}/tree/${commit}" target="_blank" rel="noopener noreferrer">${commit.slice(0, 7)}</a> · Built ${built.slice(0, 10)}</p>
<article class="markdown">${renderMarkdown(markdown, source)}</article><footer class="bottom"><a href="/">← Back to website-build-skill</a><a href="${repository}/issues" target="_blank" rel="noopener noreferrer">File an issue ↗</a></footer></main></div>`;
  const directory = path.join(out, 'docs', slug);
  await mkdir(directory, {recursive: true});
  const plain = markdown;
  publicDocuments.set(slug, {title, markdown: plain});
  await writeFile(path.join(directory, 'index.md'), plain);
  await writeFile(path.join(directory, 'index.html'), documentHtml({title: `${title} | Website Build Skill`, description: `${title}. Documentation from the website-build-skill repository.`, route: `/docs/${slug}/`, body}));
}
await writeFile(path.join(out, 'llms.txt'), `# Website Build Skill\n\n${[...pages].map(([source,slug])=>`- [${slug}](${origin}/docs/${slug}/): ${source}`).join('\n')}\n`);
await writeFile(path.join(out, 'index.md'), await readFile(path.join(root, 'README.md'), 'utf8'));
const publicRoutes = ['/', ...[...pages.values()].map(slug=>`/docs/${slug}/`)];

await writeFile(path.join(out, '404.html'), documentHtml({title: 'Page not found | Website Build Skill', description: 'Return to website-build-skill and its documentation.', route: '/', discovery: false, body: '<main class="main document"><h1>Page not found</h1><p>The page may have moved.</p><p><a class="primary" href="/">Return to website-build-skill →</a></p></main>'}));
await writeFile(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${publicRoutes.map(route => `<url><loc>${origin}${route}</loc></url>`).join('')}</urlset>\n`);
await writeFile(path.join(out, 'build-info.json'), JSON.stringify({commit, siteCommit, built, published, registryVerified, pages: pages.size + 1}, null, 2) + '\n');
console.log(`Built landing page and ${pages.size} source-derived docs pages, npm v${published.version}, commit ${commit.slice(0, 7)}.`);
