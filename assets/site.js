const modes={solo:['One AI learns the method and does every job.','SOLO keeps saved self-handoffs. Independent review requires a different model family.'],team:['Seven role files. Sessions you open yourself.','Researcher goes first. You open each session and carry handoffs; the installer does not launch workers.']};
document.querySelectorAll('[data-task]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-task]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelector('#task-text').textContent=modes[button.dataset.task][0];document.querySelector('#mode-note').textContent=modes[button.dataset.task][1];}));
document.querySelector('.copy')?.addEventListener('click',async function(){try{await navigator.clipboard.writeText('npx website-build-skill');this.textContent='✓';document.querySelector('#copy-status').textContent='Copied npx website-build-skill';setTimeout(()=>this.textContent='⧉',1800)}catch{document.querySelector('#copy-status').textContent='Select and copy the command manually.'}});
import {setupNavigation} from './navigation.js';
setupNavigation();


import {setupTrailer} from './trailer.js';
import {refreshRelease} from './releases.js';
setupTrailer(document.querySelector('#trailer video'));
refreshRelease();
document.querySelectorAll('.mobile-nav a').forEach(link => link.addEventListener('click', () => { link.closest('details').open = false; }));
