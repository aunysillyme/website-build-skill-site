import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import GithubSlugger from 'github-slugger';
import path from 'node:path';
import {validVersion} from './assets/releases.js';

export const origin = 'https://website-build-skill.aunysillyme.dev';
export const repository = 'https://github.com/aunysillyme/website-build-skill';
export const pages = new Map([
 ['README.md','overview'], ['docs/README.md','guides'], ['docs/INSTALLER.md','installer'],
 ['docs/COMPATIBILITY.md','compatibility'], ['docs/METHOD.md','method'], ['docs/EVALUATION.md','evaluation'],
 ['docs/PROVENANCE.md','provenance'], ['docs/LIBRARY-CHECK.md','library-check'], ['CHANGELOG.md','changelog'],
 ...['codex','claude-code','hermes','antigravity','grok','chatgpt-project'].map(name=>[`adapters/${name}.md`,name]),
]);
export const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
export const semver = validVersion;

export function populateLanding(template, version, releases) {
  return template.replace('{{VERSION}}', () => version).replace('{{RELEASES}}', () => releases);
}

export function releaseEntries(markdown) {
  const headings = [...markdown.matchAll(/^## \[([^\]]+)\](?: - (\d{4}-\d{2}-\d{2}))?\s*$/gm)];
  return headings.flatMap((match, index) => semver(match[1]) ? [{
    version: match[1], date: match[2] || '',
    markdown: markdown.slice(match.index + match[0].length, headings[index + 1]?.index ?? markdown.length).replace(/^\[[^\]]+\]:.*$/gm, '').trim(),
  }] : []);
}

function rewriteUrl(href, source, image = false) {
  if (!href || href.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) return href;
  const [file, fragment] = href.split('#');
  const normalized = path.posix.normalize(path.posix.join(path.posix.dirname(source), file));
  const suffix = fragment ? `#${fragment}` : '';
  if (!image && pages.has(normalized)) return `/docs/${pages.get(normalized)}/${suffix}`;
  return `${image ? 'https://raw.githubusercontent.com/aunysillyme/website-build-skill/main' : `${repository}/blob/main`}/${normalized}${suffix}`;
}

export function renderMarkdown(markdown, source) {
  const slugger = new GithubSlugger();
  const renderer = new marked.Renderer();
  renderer.image = function (token) {
    if (token.href?.endsWith('/docs/trailer.gif')) {
      return `<video controls muted loop playsinline preload="none" width="960" height="540" poster="/assets/trailer-poster.jpg" aria-label="${escape(token.text)}"><source src="/assets/trailer.webm" type="video/webm"><source src="/assets/trailer.mp4" type="video/mp4">${escape(token.text)}</video>`;
    }
    return marked.Renderer.prototype.image.call(this, token);
  };
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const id = slugger.slug(sanitizeHtml(text, {allowedTags: [], allowedAttributes: {}}));
    return `<h${depth} id="${escape(id)}">${text}</h${depth}>\n`;
  };
  return sanitizeHtml(marked.parse(markdown, {renderer, gfm: true}), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'details', 'summary', 'del', 'video', 'source'],
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'id'], img: ['src', 'alt', 'width', 'height', 'loading'],
      '*': ['id'], code: ['class'], pre: ['tabindex'], table: ['tabindex'],
      video: ['controls', 'muted', 'loop', 'playsinline', 'preload', 'width', 'height', 'poster', 'aria-label'],
      source: ['src', 'type'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      pre: (_tag, attributes) => ({tagName: 'pre', attribs: {...attributes, tabindex: '0'}}),
      table: (_tag, attributes) => ({tagName: 'table', attribs: {...attributes, tabindex: '0'}}),
      a: (_tag, attributes) => {
        const href = rewriteUrl(attributes.href, source);
        const external = /^https?:\/\//i.test(href || '');
        return {tagName: 'a', attribs: {...attributes, href, ...(external ? {target: '_blank', rel: 'noopener noreferrer'} : {target: '', rel: ''})}};
      },
      img: (_tag, attributes) => ({tagName: 'img', attribs: {...attributes, src: attributes.src?.endsWith('/docs/demo.gif') ? '/assets/demo.gif' : rewriteUrl(attributes.src, source, true), loading: 'lazy'}}),
    },
  });
}

export function documentHtml({title, description, route, body, discovery = true}) {
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Website Build Skill",
    "description": "A skill pack that turns your AI into an expert website builder: current research, design, code, accessibility, speed, SEO and security, alone or as a team.",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "macOS, Linux, Windows",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "url": origin,
    "sameAs": [
      repository,
      "https://www.npmjs.com/package/website-build-skill"
    ],
    "author": {
      "@type": "Organization",
      "name": "AunySillyMe",
      "url": "https://aunysillyme.com"
    }
  });
  return `<!doctype html><html lang="en"><head><script type="application/ld+json">\n${jsonLd}\n</script><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title><meta name="description" content="${escape(description)}">
${discovery ? `<link rel="describedby" href="${origin}/llms.txt"><link rel="alternate" type="text/markdown" href="${origin}${route}index.md">` : '<meta name="robots" content="noindex">'}
<link rel="canonical" href="${origin}${route}"><meta property="og:type" content="website">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${origin}${route}"><meta property="og:image" content="${origin}/assets/trailer-poster.jpg"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${origin}/assets/trailer-poster.jpg"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#050806">
<link rel="icon" href="/assets/avatar.png"><link rel="apple-touch-icon" href="/assets/avatar.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,500&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css"><script type="module" src="/assets/site.js"></script></head><body>${body}</body></html>`;
}
