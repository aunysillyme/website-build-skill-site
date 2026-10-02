import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const commit=process.argv[2];
if(!/^[a-f0-9]{40}$/.test(commit||''))throw new Error('Provide the reviewed full WBS commit SHA.');
const previous=JSON.parse(await readFile(path.join(here,'source-lock.json'),'utf8'));
const base=`https://raw.githubusercontent.com/${previous.repository}/${commit}`;
async function get(name){const response=await fetch(`${base}/${name}`,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`${name}: HTTP ${response.status}`);return Buffer.from(await response.arrayBuffer());}
const metadata=JSON.parse((await get('package.json')).toString());
if(metadata.name!=='website-build-skill'||!/^\d+\.\d+\.\d+$/.test(metadata.version))throw new Error('Unexpected package metadata');
const documents=await Promise.all(Object.keys(previous.files).map(async name=>[name,await get(name)]));
const stage=path.join(here,'.source-refresh');
await mkdir(stage,{recursive:true});
const files={};
for(const [name,bytes]of documents){const file=path.join(stage,name);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);files[name]=createHash('sha256').update(bytes).digest('hex');}
const backup=path.join(here,'.source-backup');
await rename(path.join(here,'source'),backup);
try{await rename(stage,path.join(here,'source'));await writeFile(path.join(here,'source-lock.json'),JSON.stringify({...previous,commit,version:metadata.version,files},null,2)+'\n');}catch(error){await rm(path.join(here,'source'),{recursive:true,force:true});await rename(backup,path.join(here,'source'));throw error;}
await rm(backup,{recursive:true});
console.log(`Pinned ${documents.length} public documents from WBS ${metadata.version} at ${commit}. Review the diff before publishing.`);
