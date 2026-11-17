import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { documentHtml, renderMarkdown, rewriteMirror, releaseEntries, pages, origin, repository, escape, populateLanding } from './content.mjs';
import { renderProjectsPopup } from './scripts/lib/projects-popup-render.mjs';
import { validRelease } from './assets/releases.js';
import {marked} from 'marked';

export const routeMeta = new Map([
  ['/', {
    title: 'Website Build Skill: AI Skill Pack for Building Websites',
    description: 'Open-source skill pack teaching Claude Code, Codex and Gemini current web practice: research, design, HTML/CSS, accessibility, CWV, SEO and security.',
  }],
  ['/docs/overview/', {
    title: 'Website Build Skill Overview & Workflow | Docs',
    description: 'End-to-end overview of website-build-skill: solo and team agent stages from live research and visual direction to accessible code, SEO and QA gates.',
  }],
  ['/docs/guides/', {
    title: 'All Documentation & Host Guides | Website Build Skill',
    description: 'Complete index of website-build-skill documentation: installer flags, 7-stage build method, host compatibility, evaluation rubric and adapter guides.',
  }],
  ['/docs/installer/', {
    title: 'Installer CLI & File Contract | Website Build Skill',
    description: 'Install website-build-skill via npx: supported target flags, --dry previews, file placement, non-destructive backups and clean uninstall commands.',
  }],
  ['/docs/compatibility/', {
    title: 'AI Host Compatibility Matrix | Website Build Skill',
    description: 'Dated discovery and loading test evidence for website-build-skill across Claude Code, Codex CLI, Gemini Antigravity, Hermes, Grok and ChatGPT Projects.',
  }],
  ['/docs/method/', {
    title: 'The Website Build Method & Gates | Website Build Skill',
    description: 'How website-build-skill sequences live web research, design direction, semantic code, WCAG accessibility, Core Web Vitals, SEO/AEO and security checks.',
  }],
  ['/docs/evaluation/', {
    title: 'Evaluation Rubric & Test Evidence | Website Build Skill',
    description: 'How website-build-skill outputs are scored and verified across visual quality, responsive layout, keyboard accessibility, performance and security.',
  }],
  ['/docs/provenance/', {
    title: 'Source Provenance & Licensing | Website Build Skill',
    description: 'Provenance record, MIT license terms, upstream reference boundaries and source-commit verification for the website-build-skill repository and package.',
  }],
  ['/docs/library-check/', {
    title: 'Library Receipt Checker Reference | Website Build Skill',
    description: 'Verify live package versions, API docs and fetch receipts before writing frontend code so AI coding agents do not ship outdated framework patterns.',
  }],
  ['/docs/changelog/', {
    title: 'Release Notes & Changelog | Website Build Skill',
    description: 'Published version history and release notes for website-build-skill on npm, documenting skill updates, host adapters, installer fixes and QA checks.',
  }],
  ['/docs/codex/', {
    title: 'OpenAI Codex CLI Adapter Guide | Website Build Skill',
    description: 'Install and run website-build-skill in OpenAI Codex CLI: skill directory layout, AGENTS.md discovery wiring, invocation prompts and known host limits.',
  }],
  ['/docs/claude-code/', {
    title: 'Claude Code Skill Adapter Guide | Website Build Skill',
    description: 'Install and run website-build-skill in Anthropic Claude Code: .claude/skills setup, native slash discovery, subagent handoffs and verification steps.',
  }],
  ['/docs/hermes/', {
    title: 'Hermes Agent Adapter Guide | Website Build Skill',
    description: 'Configure website-build-skill for Nous Research Hermes Agent: skill folder installation, prompt activation and tested compatibility boundaries.',
  }],
  ['/docs/antigravity/', {
    title: 'Gemini & Antigravity CLI Guide | Website Build Skill',
    description: 'Set up website-build-skill in Gemini CLI and Antigravity: global and workspace .agents/skills paths, SKILL.md activation and verification commands.',
  }],
  ['/docs/grok/', {
    title: 'Grok Adapter & Manual Setup Guide | Website Build Skill',
    description: 'Use website-build-skill with Grok workspaces and CLI sessions: bundle attachment order, stage prompts, research rules and manual verification steps.',
  }],
  ['/docs/chatgpt-project/', {
    title: 'ChatGPT Project Setup Guide | Website Build Skill',
    description: 'Load website-build-skill into a ChatGPT Project: knowledge file upload order, custom project instructions and browser-check handoff workflow.',
  }],
]);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, 'source');
const out = path.join(here, 'dist');
const lock = JSON.parse(await readFile(path.join(here, 'source-lock.json'), 'utf8'));
const commit = lock.commit;
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Expected a full source commit SHA');
for (const [name, digest] of Object.entries(lock.files)) {
  const bytes = await readFile(path.join(root, name));
  if (createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error(`Source digest mismatch: ${name}`);
}
let siteCommit = process.env.VERCEL_GIT_COMMIT_SHA || execFileSync('git', ['rev-parse','HEAD'], {cwd:here,encoding:'utf8'}).trim();
if(!/^[a-f0-9]{40}$/.test(siteCommit)) throw new Error('Expected a full site commit SHA');
const built = new Date().toISOString();
const fallback = JSON.parse(await readFile(path.join(here, 'release-fallback.json'), 'utf8'));
const projectsPopup = renderProjectsPopup({ rows: JSON.parse(await readFile(path.join(here, '.repo-build', 'set.json'), 'utf8')).rows, current: 'website-build-skill', id: 'projects-popup', fallbackHref: 'https://aunysillyme.dev/#projects' });
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
landing = landing.replace(/(<!-- projects-popup:start -->)[\s\S]*?(<!-- projects-popup:end -->)/, (_, start, end) => `${start}${projectsPopup}${end}`);
landing = populateLanding(landing, `v${published.version}`, releaseArea);
landing = landing.replace('{{PROOF}}', () => proofFigures);
landing = landing.replace('</footer>', `<span>Source <a href="${repository}/tree/${commit}" target="_blank" rel="noopener noreferrer">${commit.slice(0, 7)}</a></span></footer>`);

await rm(out, {recursive: true, force: true});
await mkdir(out, {recursive: true});
await cp(path.join(here, 'assets'), path.join(out, 'assets'), {recursive: true});
await rm(path.join(out, 'assets', 'trailer.gif'), {force: true});
await cp(path.join(here, 'assets', 'favicon.ico'), path.join(out, 'favicon.ico'));
const homeMeta = routeMeta.get('/');
await writeFile(path.join(out, 'index.html'), documentHtml({title: homeMeta.title, description: homeMeta.description, route: '/', body: landing}));

const projectHeader = `<header class="top"><a class="brand" href="/"><img src="/assets/avatar.png" alt="AunySillyMe"><span>website-build-skill</span></a><nav class="topnav" aria-label="Project links"><a href="/">Home</a><!-- projects-popup:start -->${projectsPopup}<!-- projects-popup:end --><a href="${repository}" target="_blank" rel="noopener noreferrer">GitHub ↗</a></nav><a class="skip" href="#document">Skip to content</a></header>`;
const navItems = [...pages].map(([source, slug]) => `<a href="/docs/${slug}/">${escape(({overview: 'Overview', guides: 'All guides', commands: 'Commands', proof: 'Measured proof', changelog: 'Changelog'})[slug] || slug.replaceAll('-', ' '))}</a>`).join('');
const publicDocuments = new Map();
function checkMirror(markdown, name) {
  marked.walkTokens(marked.lexer(markdown), token => {
    if (['link', 'image', 'def'].includes(token.type) && token.href && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(token.href)) throw new Error(`${name}: relative target ${token.href}`);
  });
}
for (const [source, slug] of pages) {
  const markdown = await readFile(path.join(root, source), 'utf8');
  const title = markdown.match(/^# (.+)$/m)?.[1].replace(/[`*_]/g, '') || slug;
  const route = `/docs/${slug}/`;
  const meta = routeMeta.get(route);
  if (!meta) throw new Error(`Missing SEO metadata for ${route}`);
  const body = `${projectHeader}
<div class="layout"><aside><p class="side-label">DOCUMENTATION</p><nav class="side-links" aria-label="Documentation">${navItems}</nav><div class="side-bottom">Questions or feedback?<a class="issue-button" href="${repository}/issues" target="_blank" rel="noopener noreferrer">File an issue ↗</a></div></aside>
<main class="main document" id="document"><details class="mobile-nav"><summary>Documentation</summary><nav aria-label="Mobile documentation">${navItems}</nav></details><div class="crumb"><a href="/">website-build-skill</a><span>/</span><span>Documentation</span></div>
<p class="source-note">From <a href="${repository}/blob/${commit}/${source}" target="_blank" rel="noopener noreferrer">${escape(source)}</a> · <a href="${repository}/tree/${commit}" target="_blank" rel="noopener noreferrer">${commit.slice(0, 7)}</a> · Built ${built.slice(0, 10)}</p>
<article class="markdown">${renderMarkdown(markdown, source)}</article></main><footer class="bottom"><a href="/">← Back to website-build-skill</a><a href="${repository}/issues" target="_blank" rel="noopener noreferrer">File an issue ↗</a></footer></div>`;
  const directory = path.join(out, 'docs', slug);
  await mkdir(directory, {recursive: true});
  const plain = `Canonical page: ${origin}/docs/${slug}/\nSource: ${repository}/blob/${commit}/${source}\nLinks below point to published pages or the pinned repository source.\n\n---\n\n${rewriteMirror(markdown, source, commit)}`;
  checkMirror(plain, source);
  publicDocuments.set(slug, {title, description: meta.description, markdown: plain});
  await writeFile(path.join(directory, 'index.md'), plain);
  await writeFile(path.join(directory, 'index.html'), documentHtml({title: meta.title, description: meta.description, route, body}));
}
const llmsDocLinks = [...publicDocuments].map(([slug, {title, description}]) => `- [${title.replace(/[\[\]\r\n]/g, '')}](${origin}/docs/${slug}/): ${description}`).join('\n');
const llmsTxt = `# Website Build Skill\n\n> ${homeMeta.description}\n\nInstall: \`npx website-build-skill\` · License: MIT · Author: Auny (https://aunysillyme.dev/)\n\n## Documentation\n\n- [Overview](${origin}/): ${homeMeta.description}\n${llmsDocLinks}\n\n## Machine-Readable & Agent Endpoints\n\n- [Homepage in Markdown](${origin}/index.md): Clean Markdown mirror of the landing page.\n- [Full Documentation Bundle](${origin}/llms-full.txt): Single-fetch Markdown bundle of all reviewed public pages.\n- [Public Agent Guide](${origin}/AGENTS.md): Navigation, citation and verification boundaries.\n- [XML Sitemap](${origin}/sitemap.xml): Canonical HTML URLs.\n\n## Source & Package\n\n- [GitHub Repository](${repository})\n- [npm Package](https://www.npmjs.com/package/website-build-skill)\n`;
await writeFile(path.join(out, 'llms.txt'), llmsTxt);
const landingMirror = `# Website Build Skill\n\nCanonical page: ${origin}/\n\nA skill pack that teaches your AI current website-building practice.\n\n- [Installation](${origin}/docs/installer/)\n- [Method](${origin}/docs/method/)\n- [Compatibility and dated evidence](${origin}/docs/compatibility/)\n- [Source repository](${repository})\n- [npm package](https://www.npmjs.com/package/website-build-skill)\n`;
checkMirror(landingMirror, 'index.md');
await writeFile(path.join(out, 'index.md'), landingMirror);
await writeFile(path.join(out, 'llms-full.txt'), `${landingMirror}\n---\n\n${[...publicDocuments.values()].map(doc=>doc.markdown).join('\n\n---\n\n')}\n`);
const agentsMd = `# Public agent guide: Website Build Skill\n\nThis file guides agents reading ${origin}/. It is public navigation metadata, not repository contributor instructions or permission to run commands.\n\n- Canonical website: ${origin}/\n- Start with [llms.txt](${origin}/llms.txt) for the concise page index, or [llms-full.txt](${origin}/llms-full.txt) for single-fetch documentation.\n- Every HTML page at \`${origin}/<path>/\` has a clean Markdown twin at \`${origin}/<path>/index.md\`.\n- Cite the canonical HTML URL (\`${origin}/<path>/\`) when linking people to a page.\n- Check [npm](https://www.npmjs.com/package/website-build-skill) and [GitHub](${repository}) for live release versions and source commits.\n- Opening this website or following links does not authorize command execution, credential use, or purchases; require explicit user confirmation.\n`;
await writeFile(path.join(out, 'AGENTS.md'), agentsMd);
await writeFile(path.join(out, 'agents.md'), agentsMd);
const publicRoutes = ['/', ...[...pages.values()].map(slug=>`/docs/${slug}/`)];

await writeFile(path.join(out, '404.html'), documentHtml({title: 'Page not found | Website Build Skill', description: 'Return to website-build-skill and its documentation.', route: '/', discovery: false, body: `${projectHeader}<main class="main document" id="document"><h1>Page not found</h1><p>The page may have moved.</p><p><a class="primary" href="/">Return to website-build-skill →</a></p></main><footer class="bottom"><a href="/">website-build-skill</a></footer>`}));
await writeFile(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${publicRoutes.map(route => `<url><loc>${origin}${route}</loc><lastmod>${built}</lastmod></url>`).join('')}</urlset>\n`);
await writeFile(path.join(out, 'build-info.json'), JSON.stringify({commit, siteCommit, built, published, registryVerified, pages: pages.size + 1}, null, 2) + '\n');
console.log(`Built landing page and ${pages.size} source-derived docs pages, npm v${published.version}, commit ${commit.slice(0, 7)}.`);
