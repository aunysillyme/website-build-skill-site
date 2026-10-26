import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {parseDocument} from 'htmlparser2';
import {fileURLToPath} from 'node:url';
const out=fileURLToPath(new URL('./dist/',import.meta.url));
async function files(dir){const list=[];for(const name of await readdir(dir)){const file=path.join(dir,name);if((await stat(file)).isDirectory())list.push(...await files(file));else list.push(file);}return list;}
function nodes(node){return [node,...(node.children||[]).flatMap(nodes)];}
test('Every generated local link, asset and anchor resolves',async()=>{for(const file of (await files(out)).filter(f=>f.endsWith('.html'))){const doc=nodes(parseDocument(await readFile(file,'utf8')));for(const node of doc){const link=node.attribs?.href||node.attribs?.src;if(!link||/^(https?:|mailto:|data:)/.test(link))continue;const [url,fragment]=link.split('#');let target=url?path.join(out,url):file;if(url?.endsWith('/'))target=path.join(target,'index.html');assert.ok((await stat(target)).isFile(),`${file}: ${link}`);if(fragment){const targetNodes=url?nodes(parseDocument(await readFile(target,'utf8'))):doc;assert.ok(targetNodes.some(n=>n.attribs?.id===decodeURIComponent(fragment)),`${file}: missing anchor ${link}`);}}}});
test('Landing has WBS metadata, verified release, limitations and product media',async()=>{const html=await readFile(path.join(out,'index.html'),'utf8');assert.match(html,/<title>Website Build Skill/);assert.match(html,/14.5-SECOND TRAILER/);assert.match(html,/native SOLO discovery and loading tested/);assert.match(html,/TEAM and the full SOLO route remain unverified/);const fallback=JSON.parse(await readFile(new URL('./release-fallback.json',import.meta.url),'utf8'));assert.ok(html.includes(`v${fallback.version}`));assert.doesNotMatch(html,/Model router for AI coding|aunx|Model-orchestrator trailer|googletagmanager/);});

test('Security headers cover every route and inline script hashes match the build',async()=>{
  const {createHash}=await import('node:crypto');
  const config=JSON.parse(await readFile(new URL('./vercel.json',import.meta.url),'utf8'));
  const headers=Object.fromEntries(config.headers.find(rule=>rule.source==='/(.*)').headers.map(header=>[header.key,header.value]));
  assert.equal(headers['X-Frame-Options'],'DENY');
  assert.equal(headers['Permissions-Policy'],'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  assert.equal(headers['X-Content-Type-Options'],'nosniff');
  assert.equal(headers['Referrer-Policy'],'strict-origin-when-cross-origin');
  const directives=Object.fromEntries(headers['Content-Security-Policy'].split(';').map(part=>part.trim().split(/\s+/)).filter(([name])=>name).map(([name,...values])=>[name,values]));
  for(const name of ['default-src','base-uri','media-src'])assert.deepEqual(directives[name],["'self'"]);
  for(const name of ['object-src','frame-ancestors'])assert.deepEqual(directives[name],["'none'"]);
  assert.equal(directives['script-src'][0],"'self'");
  assert.ok(directives['script-src'].slice(1).every(value=>/^'sha256-[A-Za-z0-9+/]{43}='$/.test(value)));
  const hashes=new Set();
  for(const file of (await files(out)).filter(file=>file.endsWith('.html'))){
    const html=await readFile(file,'utf8');
    for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
      if(!/\bsrc=/.test(match[1]))hashes.add(`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
    }
    for(const node of nodes(parseDocument(html))){
      for(const name of Object.keys(node.attribs||{}))assert.ok(!/^on/i.test(name)&&name!=='style',`${file}: inline ${name}`);
      const url=node.attribs?.src||(node.name==='link'?node.attribs?.href:null);
      if(!url?.startsWith('https://')||node.attribs?.rel==='preconnect'||['canonical','describedby','alternate'].includes(node.attribs?.rel))continue;
      const directive=node.name==='img'?'img-src':node.name==='link'?'style-src':node.name==='source'?'media-src':'script-src';
      assert.ok(directives[directive].includes(new URL(url).origin),`${file}: ${url} missing from ${directive}`);
    }
  }
  assert.deepEqual([...hashes].sort(),directives['script-src'].slice(1).sort(),'Update the CSP hashes in vercel.json for the built inline scripts');
});

test('Documentation trailers use small local video sources and preserve the GIF description',async()=>{
  const html=await readFile(path.join(out,'docs/overview/index.html'),'utf8');
  const doc=nodes(parseDocument(html));
  const video=doc.find(node=>node.name==='video');
  assert.ok(video);
  const markdown=await readFile(new URL('./source/README.md',import.meta.url),'utf8');
  assert.equal(video.attribs['aria-label'],markdown.match(/!\[([^\]]+)\]\([^\n]*\/docs\/trailer.gif\)/)[1]);
  assert.equal(video.attribs.width,'960');assert.equal(video.attribs.height,'540');
  for(const file of ['index.html','docs/overview/index.html']){
    const page=nodes(parseDocument(await readFile(path.join(out,file),'utf8')));
    const trailer=page.find(node=>node.name==='video');
    for(const attribute of ['muted','loop','playsinline','controls'])assert.ok(attribute in trailer.attribs,`${file}: ${attribute}`);
    assert.ok(!('autoplay' in trailer.attribs));
    assert.equal(trailer.attribs.preload,'none');
    assert.equal(trailer.attribs.poster,'/assets/trailer-poster.jpg');
    assert.deepEqual(trailer.children.filter(node=>node.name==='source').map(node=>node.attribs),[
      {src:'/assets/trailer.webm',type:'video/webm'},{src:'/assets/trailer.mp4',type:'video/mp4'}
    ]);
  }
  for(const file of (await files(out)).filter(file=>file.endsWith('.html')))assert.doesNotMatch(await readFile(file,'utf8'),/trailer\.gif/);
  assert.ok(!(await files(out)).some(file=>file.endsWith('/assets/trailer.gif')));
  for(const name of ['trailer.mp4','trailer.webm'])assert.ok((await stat(path.join(out,'assets',name))).size<500000);
});

test('Generated pages provide landmarks and keyboard access to scrollable content',async()=>{
  for(const file of (await files(out)).filter(file=>file.endsWith('.html'))){
    const doc=nodes(parseDocument(await readFile(file,'utf8')));
    for(const name of ['header','nav','main','footer'])assert.ok(doc.some(node=>node.name===name),`${file}: missing ${name}`);
    for(const node of doc.filter(node=>['pre','table'].includes(node.name)))assert.equal(node.attribs.tabindex,'0',`${file}: ${node.name}`);
  }
});
