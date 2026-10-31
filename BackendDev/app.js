const STORE_KEY = 'backenddev.projects.v1';
const dialog = document.querySelector('#projectDialog');
const form = document.querySelector('#projectForm');
const nameInput = document.querySelector('#projectName');
const stackSelect = document.querySelector('#stackChoice');
const toast = document.querySelector('#toast');
let toastTimer;
let currentProjectId = null;

const seeds = [
  { id:'atlas', name:'Atlas API', language:'Go', framework:'Fiber', status:'Live', description:'Core platform API and service layer.', files:{'README.md':'# Atlas API\n\nGo backend service built with Fiber.\n\n## Next steps\n- Configure your database\n- Add API routes\n- Run `go run .`\n','main.go':'package main\n\nimport (\n  "github.com/gofiber/fiber/v2"\n)\n\nfunc main() {\n  app := fiber.New()\n  app.Get("/health", func(c *fiber.Ctx) error {\n    return c.JSON(fiber.Map{"status": "ok"})\n  })\n  app.Listen(":3000")\n}\n'}},
  { id:'billing', name:'Billing service', language:'TypeScript', framework:'NestJS', status:'Building', description:'Subscriptions, invoices, and payments.', files:{'README.md':'# Billing service\n\nTypeScript service built with NestJS.\n','src/app.controller.ts':'import { Controller, Get } from "@nestjs/common";\n\n@Controller()\nexport class AppController {\n  @Get("health")\n  health() { return { status: "ok" }; }\n}\n'}},
  { id:'auth', name:'Auth gateway', language:'Python', framework:'FastAPI', status:'Paused', description:'Identity, access, and token services.', files:{'README.md':'# Auth gateway\n\nPython API built with FastAPI.\n','main.py':'from fastapi import FastAPI\n\napp = FastAPI(title="Auth gateway")\n\n@app.get("/health")\ndef health():\n    return {"status": "ok"}\n'}}
];

function loadProjects() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    return Array.isArray(saved) ? [...seeds, ...saved.filter(p => !seeds.some(s => s.id === p.id))] : [...seeds];
  } catch { return [...seeds]; }
}
let projects = loadProjects();
async function api(path,options={}){const r=await fetch(path,{headers:{'content-type':'application/json'},...options});const d=await r.json();if(!r.ok)throw Error(d.error||`Request failed (${r.status})`);return d}
async function syncProjects(){try{const remote=await api('/api/projects');projects=[...seeds,...remote.filter(p=>!seeds.some(s=>s.id===p.id))];renderProjects()}catch{}}
function saveProjects() { localStorage.setItem(STORE_KEY, JSON.stringify(projects.filter(p => !seeds.some(s => s.id === p.id)))); }
function notify(message) { toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2800); }
function iconFor(language) { return ({TypeScript:'TS',Python:'Py',Go:'Go',Rust:'Rs',Java:'Jv','C#':'C#',Ruby:'Rb',PHP:'PHP',Other:'···'})[language] || 'JS'; }
function classFor(language) { return ({TypeScript:'ts',Python:'py',Go:'go'})[language] || 'custom'; }

function renderProjects() {
  const grid = document.querySelector('#projects'); grid.replaceChildren();
  const nav = document.querySelector('#projectNav'); nav.replaceChildren();
  projects.forEach(project => {
    const card = document.createElement('article'); card.className='project-card'; card.dataset.project=project.name; card.dataset.lang=project.language;
    const statusClass = project.status === 'Live' ? 'live' : project.status === 'Building' ? 'build' : 'paused';
    card.innerHTML=`<div class="card-head"><span class="lang-icon ${classFor(project.language)}">${iconFor(project.language)}</span><button class="kebab" aria-label="Project actions">···</button></div><div class="project-title"><h3></h3><span class="badge ${statusClass}"><i></i>${project.status}</span></div><p></p><div class="project-meta"><span class="stack-label"></span><span>${project.updated || 'Created recently'}</span></div><div class="card-footer"><span><i class="status-dot ${project.status==='Live'?'green':project.status==='Building'?'amber':'gray'}"></i>${project.status==='Live'?'Production':project.status==='Building'?'Staging':'Local'}</span><a href="#editor">Open workspace <b>→</b></a></div>`;
    card.querySelector('h3').textContent=project.name; card.querySelector('p').textContent=project.description || 'Backend project workspace.'; card.querySelector('.stack-label').textContent=`⌘ ${project.language} · ${project.framework}`;
    card.querySelector('a').addEventListener('click',e=>{e.preventDefault();openWorkspace(project.id)});
    card.querySelector('.kebab').addEventListener('click',()=>showProjectActions(project)); grid.append(card);
    const item=document.createElement('a'); item.href='#projects'; const dot=document.createElement('i'); dot.className=`status-dot ${project.status==='Live'?'green':project.status==='Building'?'amber':'gray'}`; item.append(dot,document.createTextNode(` ${project.name}`)); item.addEventListener('click',e=>{e.preventDefault();openWorkspace(project.id)});nav.append(item);
  });
  document.querySelector('#projectCount').textContent=String(projects.length).padStart(2,'0');
  document.querySelector('#languageCount').textContent=new Set(projects.map(p=>p.language)).size.toString().padStart(2,'0');
  document.querySelector('#languageSummary').textContent=[...new Set(projects.map(p=>p.language))].join(' · ');
}
function openCreateDialog(){form.reset();dialog.showModal();setTimeout(()=>nameInput.focus(),50)}
async function showProjectActions(project){
  if (seeds.some(s=>s.id===project.id)) { notify('Sample projects are read-only. Create a project to edit files.'); return; }
  const action=prompt(`Project: ${project.name}\nType DELETE to remove this project.`);
  if(action==='DELETE'){try{await api(`/api/projects/${project.id}`,{method:'DELETE'})}catch(error){notify(`Could not delete project: ${error.message}`);return}projects=projects.filter(p=>p.id!==project.id);saveProjects();renderProjects();notify(`${project.name} deleted.`)}
}
function openWorkspace(id){
  const project=projects.find(p=>p.id===id);if(!project)return;currentProjectId=id;
  document.querySelector('#workspaceTitle').textContent=project.name;
  const files=Object.keys(project.files||{}); const select=document.querySelector('#fileSelect');select.replaceChildren(...files.map(f=>{const o=document.createElement('option');o.value=f;o.textContent=f;return o}));
  select.onchange=()=>{document.querySelector('#fileEditor').value=project.files[select.value]||''};select.dispatchEvent(new Event('change'));
  document.querySelector('#workspaceDialog').showModal();
}
document.querySelector('#newProject').addEventListener('click',openCreateDialog);document.querySelector('#newProjectSmall').addEventListener('click',openCreateDialog);
document.querySelector('#exploreStacks').addEventListener('click',openCreateDialog);
document.querySelectorAll('.main-nav a').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.main-nav a').forEach(n=>n.classList.remove('active'));a.classList.add('active')}));
document.querySelector('#projectSearch').addEventListener('input',event=>{const query=event.target.value.trim().toLowerCase();document.querySelectorAll('.project-card').forEach(card=>{card.hidden=!`${card.dataset.project} ${card.dataset.lang} ${card.textContent}`.toLowerCase().includes(query)})});
form.addEventListener('submit',async event=>{if(event.submitter?.value==='cancel')return;event.preventDefault();if(!form.reportValidity())return;
  const name=nameInput.value.trim();if(projects.some(p=>p.name.toLowerCase()===name.toLowerCase())){notify('A project with that name already exists.');return}
  const [language,framework]=stackSelect.value.split(' · ');const files={'README.md':`# ${name}\n\n${language} backend project using ${framework}.\n\n## Getting started\nAdd your application entry point and configure your runtime.\n`};
  if(language==='Python')files['main.py']='from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/health")\ndef health():\n    return {"status": "ok"}\n';
  else if(language==='TypeScript')files['src/index.ts']='import express from "express";\nconst app = express();\napp.get("/health", (_req, res) => res.json({ status: "ok" }));\napp.listen(3000);\n';
  else if(language==='Go')files['main.go']='package main\n\nimport "net/http"\n\nfunc main() {\n http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(`{"status":"ok"}`)) })\n http.ListenAndServe(":3000", nil)\n}\n';
  const project={name,language,framework,status:'Draft',description:'New backend project workspace.',files,updated:'Created just now'};try{const saved=await api('/api/projects',{method:'POST',body:JSON.stringify(project)});projects.push(saved)}catch(error){project.id=crypto.randomUUID();projects.push(project);saveProjects();notify(`API unavailable; saved locally: ${error.message}`)}renderProjects();dialog.close();if(project.id)notify(`${name} created and saved.`);
});
document.querySelector('#saveFile').addEventListener('click',async()=>{const project=projects.find(p=>p.id===currentProjectId);if(!project)return;project.files[document.querySelector('#fileSelect').value]=document.querySelector('#fileEditor').value;saveProjects();try{await api(`/api/projects/${project.id}`,{method:'PUT',body:JSON.stringify({files:project.files})});notify('File saved to BackendDev.')}catch{notify('File saved in this browser only.')}});
document.querySelector('#runCheck').addEventListener('click',async()=>{const project=projects.find(p=>p.id===currentProjectId);const out=document.querySelector('#checkOutput');out.textContent='Starting runner…';try{const result=await api('/api/run',{method:'POST',body:JSON.stringify({language:project.language,files:project.files})});out.textContent=`Exit code: ${result.exitCode}\n${result.output}`}catch(e){out.textContent=e.message}});
let proposedFiles=null;
document.querySelector('#assistantForm').addEventListener('submit',async e=>{e.preventDefault();const input=document.querySelector('#assistantInput');if(!input.value.trim())return;const out=document.querySelector('#aiOutput');out.textContent='Contacting model…';document.querySelector('#applyAi').hidden=true;try{const project=projects.find(p=>p.id===currentProjectId);const result=await api('/api/generate',{method:'POST',body:JSON.stringify({prompt:input.value,files:project?.files||{}})});const proposal=JSON.parse(result.answer);if(!proposal.files||typeof proposal.files!=='object')throw Error('Model response did not include a files object. Ask again with a more specific change.');proposedFiles=proposal.files;out.textContent=`${proposal.summary||'Proposed changes'}\n\n${Object.entries(proposedFiles).map(([file,content])=>`--- ${file} ---\n${content}`).join('\n\n')}`;document.querySelector('#applyAi').hidden=false}catch(err){proposedFiles=null;out.textContent=err.message}});
document.querySelector('#applyAi').addEventListener('click',async()=>{if(!proposedFiles)return;const project=projects.find(p=>p.id===currentProjectId);for(const [file,content] of Object.entries(proposedFiles)){if(file.startsWith('/')||file.split(/[\\/]/).includes('..')){notify(`Rejected unsafe file path: ${file}`);return}project.files[file]=String(content)}try{await api(`/api/projects/${project.id}`,{method:'PUT',body:JSON.stringify({files:project.files})});saveProjects();proposedFiles=null;document.querySelector('#applyAi').hidden=true;const select=document.querySelector('#fileSelect'),old=select.value,files=Object.keys(project.files);select.replaceChildren(...files.map(file=>{const o=document.createElement('option');o.value=file;o.textContent=file;return o}));select.value=files.includes(old)?old:files[0];select.dispatchEvent(new Event('change'));document.querySelector('#aiOutput').textContent='Changes applied and saved. Review files in the selector.';notify('AI changes applied and saved.')}catch(error){notify(`Could not save AI changes: ${error.message}`)}});
document.querySelector('#closeWorkspace').addEventListener('click',()=>document.querySelector('#workspaceDialog').close());
document.querySelector('#downloadProject').addEventListener('click',()=>{const p=projects.find(x=>x.id===currentProjectId);const blob=new Blob([JSON.stringify({name:p.name,language:p.language,framework:p.framework,files:p.files},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${p.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-project.json`;a.click();URL.revokeObjectURL(a.href)});
renderProjects();syncProjects();
