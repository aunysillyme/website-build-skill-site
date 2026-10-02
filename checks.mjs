import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {parseDocument} from 'htmlparser2';
const out=new URL('./dist/',import.meta.url).pathname;
async function files(dir){const list=[];for(const name of await readdir(dir)){const file=path.join(dir,name);if((await stat(file)).isDirectory())list.push(...await files(file));else list.push(file);}return list;}
function nodes(node){return [node,...(node.children||[]).flatMap(nodes)];}
test('Every generated local link, asset and anchor resolves',async()=>{for(const file of (await files(out)).filter(f=>f.endsWith('.html'))){const doc=nodes(parseDocument(await readFile(file,'utf8')));for(const node of doc){const link=node.attribs?.href||node.attribs?.src;if(!link||/^(https?:|mailto:|data:)/.test(link))continue;const [url,fragment]=link.split('#');let target=url?path.join(out,url):file;if(url?.endsWith('/'))target=path.join(target,'index.html');assert.ok((await stat(target)).isFile(),`${file}: ${link}`);if(fragment){const targetNodes=url?nodes(parseDocument(await readFile(target,'utf8'))):doc;assert.ok(targetNodes.some(n=>n.attribs?.id===decodeURIComponent(fragment)),`${file}: missing anchor ${link}`);}}}});
test('Landing has WBS metadata, verified release, limitations and product media',async()=>{const html=await readFile(path.join(out,'index.html'),'utf8');assert.match(html,/<title>Website Build Skill/);assert.match(html,/14.5-SECOND TRAILER/);assert.match(html,/native SOLO discovery and loading tested/);assert.match(html,/TEAM and the full SOLO route remain unverified/);const fallback=JSON.parse(await readFile(new URL('./release-fallback.json',import.meta.url),'utf8'));assert.ok(html.includes(`v${fallback.version}`));assert.doesNotMatch(html,/Model router for AI coding|aunx|Model-orchestrator trailer|googletagmanager/);});
