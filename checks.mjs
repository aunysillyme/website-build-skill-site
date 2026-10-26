import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {parseDocument} from 'htmlparser2';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const out=fileURLToPath(new URL('./dist/',import.meta.url));
async function files(dir){const list=[];for(const name of await readdir(dir)){const file=path.join(dir,name);if((await stat(file)).isDirectory())list.push(...await files(file));else list.push(file);}return list;}
function nodes(node){return [node,...(node.children||[]).flatMap(nodes)];}
test('Every generated local link, asset and anchor resolves',async()=>{for(const file of (await files(out)).filter(f=>f.endsWith('.html'))){const doc=nodes(parseDocument(await readFile(file,'utf8')));for(const node of doc){const link=node.attribs?.href||node.attribs?.src||node.attribs?.poster;if(!link||/^(https?:|mailto:|data:)/.test(link))continue;const [url,fragment]=link.split('#');let target=url?path.join(out,url):file;if(url?.endsWith('/'))target=path.join(target,'index.html');assert.ok((await stat(target)).isFile(),`${file}: ${link}`);if(fragment){const targetNodes=url?nodes(parseDocument(await readFile(target,'utf8'))):doc;assert.ok(targetNodes.some(n=>n.attribs?.id===decodeURIComponent(fragment)),`${file}: missing anchor ${link}`);}}}});
test('Landing has WBS metadata, verified release, limitations and product media',async()=>{const html=await readFile(path.join(out,'index.html'),'utf8');assert.match(html,/<title>Website Build Skill/);assert.match(html,/14.5-SECOND TRAILER/);assert.match(html,/native SOLO discovery and loading tested/);assert.match(html,/TEAM and the full SOLO route remain unverified/);const fallback=JSON.parse(await readFile(new URL('./release-fallback.json',import.meta.url),'utf8'));assert.ok(html.includes(`v${fallback.version}`));assert.doesNotMatch(html,/Model router for AI coding|aunx|Model-orchestrator trailer|googletagmanager/);});

test('Security headers cover every route and inline script hashes match the build',async()=>{
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
    const overview=file==='docs/overview/index.html';
    assert.equal(trailer.attribs.poster,overview?'/assets/trailer-loop-poster.jpg':'/assets/trailer-poster.jpg');
    assert.equal(trailer.attribs.width,overview?'960':'1280');
    assert.equal(trailer.attribs.height,overview?'540':'720');
    assert.deepEqual(trailer.children.filter(node=>node.name==='source').map(node=>node.attribs),overview?[
      {src:'/assets/trailer-loop.mp4',type:'video/mp4'},{src:'/assets/trailer-loop.webm',type:'video/webm'}
    ]:[{src:'/assets/trailer.mp4',type:'video/mp4'}]);
  }
  for(const file of (await files(out)).filter(file=>file.endsWith('.html')))assert.doesNotMatch(await readFile(file,'utf8'),/trailer\.gif/);
  assert.ok(!(await files(out)).some(file=>file.endsWith('/assets/trailer.gif')));
  for(const name of ['trailer-loop.mp4','trailer-loop.webm'])assert.ok((await stat(path.join(out,'assets',name))).size<500000);
});

test('Generated pages provide landmarks and keyboard access to scrollable content',async()=>{
  for(const file of (await files(out)).filter(file=>file.endsWith('.html'))){
    const doc=nodes(parseDocument(await readFile(file,'utf8')));
    for(const name of ['header','nav','main','footer'])assert.ok(doc.some(node=>node.name===name),`${file}: missing ${name}`);
    for(const node of doc.filter(node=>node.name==='footer')){
      let parent=node.parent;
      while(parent){
        assert.ok(!['main','article','section','nav','aside'].includes(parent.name),`${file}: footer must be a page landmark`);
        parent=parent.parent;
      }
    }
    for(const node of doc.filter(node=>node.attribs?.class==='skip')){
      let parent=node.parent;
      while(parent&&parent.name!=='header')parent=parent.parent;
      assert.ok(parent,`${file}: skip link must belong to the header landmark`);
    }
    for(const node of doc.filter(node=>['pre','table'].includes(node.name)))assert.equal(node.attribs.tabindex,'0',`${file}: ${node.name}`);
  }
});

// Preserve the hero and share image from aun1753-base.
test('Landing hero and share images preserve the base assets',async()=>{
  const digests={"trailer.mp4":"1179bb4388abd0c3708e17db9c88cf3f9042ef67039750aacaceee8523a4ddc6","trailer-poster.jpg":"2fe6b9e9cfcc1488868fc06a0b3cbfc082f4f88fe7d273cb91a36ff64470e313"};
  for(const [name,digest] of Object.entries(digests)){
    assert.equal(createHash('sha256').update(await readFile(new URL(`./assets/${name}`,import.meta.url))).digest('hex'),digest,name);
    assert.equal(createHash('sha256').update(await readFile(path.join(out,'assets',name))).digest('hex'),digest,`built ${name}`);
  }
  for(const file of (await files(out)).filter(file=>file.endsWith('.html'))){
    const doc=nodes(parseDocument(await readFile(file,'utf8')));
    for(const attribute of ['og:image','twitter:image']){
      const meta=doc.find(node=>node.name==='meta'&&(node.attribs.property===attribute||node.attribs.name===attribute));
      assert.equal(meta?.attribs.content,'https://website-build-skill.aunysillyme.dev/assets/trailer-poster.jpg',`${file}: ${attribute}`);
    }
    if(file!==path.join(out,'docs/overview/index.html')){
      for(const node of doc)for(const attribute of ['src','poster'])assert.ok(!node.attribs?.[attribute]?.includes('trailer-loop'),`${file}: overview-only media`);
    }
  }
});
