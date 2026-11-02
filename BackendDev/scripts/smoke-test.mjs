import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStarterFiles, resourceForIdea } from '../starter-templates.js';

const root = new URL('../', import.meta.url);
let app, mockDb, mockGithub, appPort, mockPort, mockGithubPort, githubTokenRecord=null, githubCreatedRef=null, githubPublishedTree=null, githubPublishedCommit=null, githubPullRequest=null, lastSignupRedirect='', lastRecoveryRedirect='', signupMetadata=null, updatedPassword='', modelCalls=0, resendCalls=0;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function ready(url, child) { for (let i=0;i<80;i++) { if (child.exitCode!==null) throw Error('BackendDev process exited before it was ready'); try { const r=await fetch(url); if(r.ok)return; } catch {} await wait(100); } throw Error('BackendDev did not start in time'); }

before(async () => {
  mockPort = await freePort();
  mockGithubPort = await freePort();
  mockGithub = http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const url=new URL(req.url,'http://mock-github.test'),pathname=decodeURIComponent(url.pathname),json=data=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(data))};if(req.headers.authorization!=='Bearer github_pat_test-token'){res.statusCode=401;return json({message:'Bad credentials'})}if(pathname==='/user'&&req.method==='GET')return json({login:'backenddev-test'});if(pathname==='/user/repos'&&req.method==='GET')return json([{full_name:'acme/tasks-api',name:'tasks-api',private:true,default_branch:'main',html_url:'https://github.com/acme/tasks-api'}]);if(pathname==='/repos/acme/tasks-api'&&req.method==='GET')return json({full_name:'acme/tasks-api',default_branch:'main',private:true});if(pathname==='/repos/acme/tasks-api/pulls'&&req.method==='POST'){githubPullRequest=JSON.parse(raw);res.statusCode=201;return json({number:17,html_url:'https://github.com/acme/tasks-api/pull/17',state:'open',head:{ref:githubPullRequest.head},base:{ref:githubPullRequest.base}})}if(pathname==='/repos/acme/tasks-api/git/matching-refs/heads'&&req.method==='GET')return json([{ref:'refs/heads/main',object:{sha:'base-sha'}},...(githubCreatedRef?[{ref:githubCreatedRef,object:{sha:'base-sha'}}]:[])]);if(pathname==='/repos/acme/tasks-api/git/ref/heads/main'&&req.method==='GET')return json({ref:'refs/heads/main',object:{sha:'base-sha'}});if(pathname.startsWith('/repos/acme/tasks-api/git/ref/heads/')&&req.method==='GET')return json({ref:'refs/heads/'+pathname.split('/').slice(-1)[0],object:{sha:githubPublishedCommit||'base-sha'}});if(pathname==='/repos/acme/tasks-api/git/refs'&&req.method==='POST'){const data=JSON.parse(raw);githubCreatedRef=data.ref;res.statusCode=201;return json({ref:data.ref,object:{sha:data.sha}})}if(pathname==='/repos/acme/tasks-api/git/commits/base-sha'&&req.method==='GET')return json({sha:'base-sha',tree:{sha:'tree-base'}});if(pathname==='/repos/acme/tasks-api/git/trees/tree-base'&&req.method==='GET')return json({sha:'tree-base',truncated:false,tree:[{path:'README.md',mode:'100644',type:'blob',sha:'blob-readme',size:16},{path:'index.js',mode:'100644',type:'blob',sha:'blob-index',size:18},{path:'.env',mode:'100644',type:'blob',sha:'blob-env',size:20},{path:'node_modules/dep/index.js',mode:'100644',type:'blob',sha:'blob-dep',size:10}]});if(pathname==='/repos/acme/tasks-api/git/blobs/blob-readme'&&req.method==='GET')return json({encoding:'base64',content:Buffer.from('# Imported API\n').toString('base64')});if(pathname==='/repos/acme/tasks-api/git/blobs/blob-index'&&req.method==='GET')return json({encoding:'base64',content:Buffer.from('console.log("api")\n').toString('base64')});if(pathname==='/repos/acme/tasks-api/git/trees'&&req.method==='POST'){githubPublishedTree=JSON.parse(raw);return json({sha:'tree-new'})}if(pathname==='/repos/acme/tasks-api/git/commits'&&req.method==='POST'){githubPublishedCommit='new-commit-sha';return json({sha:githubPublishedCommit})}if(pathname==='/repos/acme/tasks-api/git/refs/heads/feature/api'&&req.method==='PATCH'){const data=JSON.parse(raw);githubPublishedCommit=data.sha;return json({ref:'refs/heads/feature/api',object:{sha:data.sha}})}res.statusCode=404;json({message:`Mock GitHub route not found: ${req.method} ${pathname}`})});
  await new Promise(resolve=>mockGithub.listen(mockGithubPort,'127.0.0.1',resolve));
  mockDb = http.createServer(async (req, res) => {
    let raw=''; for await (const chunk of req) raw += chunk;
    res.setHeader('content-type','application/json');
    if (req.url === '/auth/v1/user'&&req.method==='GET') { const token=req.headers.authorization,member=token==='Bearer non-owner-token',aal1=token==='Bearer owner-aal1-token';res.end(JSON.stringify({id:member?'44444444-4444-4444-8444-444444444444':'11111111-1111-4111-8111-111111111111',email:member?'member@example.test':'owner@example.test',aal:aal1?'aal1':'aal2'})); return; }
    if(req.url==='/auth/v1/factors'&&req.method==='GET'&&req.headers.authorization==='Bearer owner-aal2-factors-405-token'){res.statusCode=405;res.end(JSON.stringify({}));return;}
    if (req.url === '/auth/v1/factors'&&req.method==='GET') { res.end(JSON.stringify({all:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',factor_type:'totp',status:'verified'}],totp:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',factor_type:'totp',status:'verified'}],phone:[]}));return; }
    if (req.url === '/auth/v1/factors'&&req.method==='POST') { res.end(JSON.stringify({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',factor_type:'totp',status:'unverified',totp:{qr_code:'<svg/>',secret:'TEST-SECRET',uri:'otpauth://totp/BackendDev:test?secret=TEST-SECRET&issuer=BackendDev'}}));return; }
    if (req.url.endsWith('/challenge')&&req.method==='POST') { res.end(JSON.stringify({id:'challenge-test'}));return; }
    if (req.url.endsWith('/verify')&&req.method==='POST') { const data=JSON.parse(raw);assert.equal(data.challenge_id,'challenge-test');assert.match(data.code,/^\d{6}$/);res.end(JSON.stringify({access_token:'mfa-access-token',token_type:'bearer',user:{id:'11111111-1111-4111-8111-111111111111'}}));return; }
    if (req.url.startsWith('/auth/v1/factors/')&&req.method==='DELETE') { res.end(JSON.stringify({id:req.url.split('/').pop()}));return; }
    if (req.url.startsWith('/auth/v1/admin/users?page=')) { assert.equal(req.headers.apikey,'sb_secret_test-key');res.end(JSON.stringify({users:[{id:'22222222-2222-4222-8222-222222222222',email:'member@example.test',created_at:'2026-01-01T00:00:00Z',confirmed_at:'2026-01-02T00:00:00Z'}]}));return; }
    if (req.url.startsWith('/auth/v1/admin/users/')&&req.method==='PUT') { const uid=req.url.split('/').pop(),patch=JSON.parse(raw);assert.equal(req.headers.apikey,'sb_secret_test-key');assert.notEqual(req.headers.authorization,'Bearer sb_secret_test-key');res.end(JSON.stringify({user:{id:uid,banned_until:patch.ban_duration==='none'?null:'2126-01-01T00:00:00Z'}}));return; }
    if (req.url.startsWith('/auth/v1/admin/users/')&&req.method==='DELETE') { assert.equal(req.headers.apikey,'sb_secret_test-key');res.end(JSON.stringify({id:req.url.split('/').pop()}));return; }
    if (req.url === '/v1/chat/completions') { const payload=JSON.parse(raw);modelCalls++;assert.equal(payload.model,'test-model');if(payload.messages[1].content.includes('simulate quota error')){res.statusCode=429;res.end(JSON.stringify({error:{message:'insufficient_quota: no credits remaining'}}));return}res.end(JSON.stringify({choices:[{message:{content:'```json\n{"summary":"Added a health route","files":{"main.py":"print(\"ok\")"}}\n```'}}]}));return; }
    if (req.url.startsWith('/auth/v1/token?grant_type=password')) { const credentials=JSON.parse(raw);res.end(JSON.stringify(credentials.password==='correct-password'?{access_token:'mock-access-token',token_type:'bearer',user:{id:'11111111-1111-4111-8111-111111111111'}}:(res.statusCode=400,{code:'invalid_credentials',msg:'Invalid login credentials'})));return; }
    if (req.url.startsWith('/auth/v1/signup?')) { lastSignupRedirect=new URL(req.url,'http://mock-supabase.test').searchParams.get('redirect_to');signupMetadata=JSON.parse(raw).data;res.end(JSON.stringify({id:'11111111-1111-4111-8111-111111111111',email:'learner@example.test'}));return; }
    if (req.url.startsWith('/auth/v1/recover?')) { lastRecoveryRedirect=new URL(req.url,'http://mock-supabase.test').searchParams.get('redirect_to');if(JSON.parse(raw).email==='limited@example.test'){res.statusCode=429;res.end(JSON.stringify({code:'over_email_send_rate_limit',msg:'email rate limit exceeded'}));return;}res.end(JSON.stringify({}));return; }
    if (req.url==='/auth/v1/user'&&req.method==='PUT') { updatedPassword=JSON.parse(raw).password;res.end(JSON.stringify({id:'11111111-1111-4111-8111-111111111111'}));return; }
    if (req.url==='/auth/v1/resend') { resendCalls++;res.end(JSON.stringify({}));return; }
    if (req.url.startsWith('/rest/v1/user_feedback')) {
      assert.equal(req.headers.apikey,'sb_secret_test-key');
      if(req.method==='POST'){const feedback=JSON.parse(raw);assert.equal(feedback.user_id,'11111111-1111-4111-8111-111111111111');assert.equal(feedback.user_email,'owner@example.test');res.end(JSON.stringify([{id:'44444444-4444-4444-8444-444444444444',...feedback,status:'New'}]));return;}
      if(req.method==='GET'){res.end(JSON.stringify([{id:'44444444-4444-4444-8444-444444444444',user_id:'11111111-1111-4111-8111-111111111111',user_email:'member@example.test',category:'Problem',subject:'Cannot build',message:'The builder did not create my project.',status:'New',created_at:'2026-11-01T00:00:00Z'}]));return;}
      if(req.method==='PATCH'){assert.match(raw,/\"status\":\"Resolved\"/);res.end('');return;}
    }
    if(req.url.startsWith('/rest/v1/github_connections')){assert.equal(req.headers.apikey,'sb_secret_test-key');if(req.method==='GET'){res.end(JSON.stringify(githubTokenRecord?[githubTokenRecord]:[]));return}if(req.method==='POST'){const record=JSON.parse(raw);assert.ok(record.token_ciphertext);assert.ok(!Object.hasOwn(record,'token'));githubTokenRecord=record;res.end(JSON.stringify([record]));return}if(req.method==='DELETE'){githubTokenRecord=null;res.end('');return}}
    if (req.url.startsWith('/rest/v1/projects')) {
      if(req.url.includes('select=id,owner_id,name,language,framework,description,status,files,created_at,updated_at')){assert.equal(req.headers.apikey,'sb_secret_test-key');res.end(JSON.stringify([{id:'33333333-3333-4333-8333-333333333333',owner_id:'22222222-2222-4222-8222-222222222222',name:'Example API',language:'Python',framework:'FastAPI',description:'Example',status:'Draft',files:{'main.py':'print("private")'}}]));return;}
      if(req.url.includes('select=id,owner_id,name,language,framework,status,created_at,updated_at')){assert.equal(req.headers.apikey,'sb_secret_test-key');assert.notEqual(req.headers.authorization,'Bearer sb_secret_test-key');res.end(JSON.stringify([{id:'33333333-3333-4333-8333-333333333333',owner_id:'22222222-2222-4222-8222-222222222222',name:'Example API',language:'Python',framework:'FastAPI',status:'Draft'}]));return;}
      if(req.method==='DELETE'&&req.url.includes('id=eq.')){assert.equal(req.headers.apikey,'sb_secret_test-key');res.end('');return;}
      if (req.method === 'GET') { res.end('[]'); return; }
      const payload=raw?JSON.parse(raw):{};
      if (req.method === 'POST') assert.equal(payload.owner_id,'11111111-1111-4111-8111-111111111111');
      assert.ok(!Object.hasOwn(payload,'updated'),'legacy UI-only `updated` field must never reach Supabase');
      if (req.method !== 'DELETE') {
        assert.ok(payload.updated_at,'write should provide valid updated_at database timestamp');
        const inserted={id:'22222222-2222-4222-8222-222222222222',...payload};
        res.end(JSON.stringify([inserted])); return;
      }
      res.end('[]'); return;
    }
    res.statusCode=404;res.end(JSON.stringify({error:'not found'}));
  });
  await new Promise(resolve => mockDb.listen(mockPort,'127.0.0.1',resolve));
  appPort=await freePort();
  app=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(appPort),NODE_ENV:'test',SUPABASE_URL:`http://127.0.0.1:${mockPort}`,SUPABASE_ANON_KEY:'test-publishable-key',APP_URL:'http://127.0.0.1:4173',APP_ADMIN_EMAILS:'owner@example.test',SUPABASE_SECRET_KEY:'sb_secret_test-key',GITHUB_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),GITHUB_API_BASE_URL:`http://127.0.0.1:${mockGithubPort}`,MODEL_API_KEY:'mock-model-key',MODEL_API_URL:`http://127.0.0.1:${mockPort}/v1/chat/completions`,MODEL_NAME:'test-model'},stdio:'ignore'});
  await ready(`http://127.0.0.1:${appPort}/api/health`,app);
});
after(async()=>{app?.kill();if(mockDb)await new Promise(resolve=>mockDb.close(resolve));if(mockGithub)await new Promise(resolve=>mockGithub.close(resolve));});

test('serves the app and reports API health',async()=>{
  const page=await fetch(`http://127.0.0.1:${appPort}/`);assert.equal(page.status,200);const html=await page.text();assert.match(html,/BackendDev/);assert.match(html,/Build my project/);assert.match(html,/What happens when someone uses your app/);assert.match(html,/id="closeProject"/);assert.match(html,/type="module" src="app.js"/);assert.match(html,/placeholder="Enter your email"/);assert.match(html,/placeholder="Enter your password"/);assert.match(html,/id="passwordPolicyNote"/);assert.match(html,/id="openFeedback"/);assert.match(html,/id="feedbackDialog"/);assert.match(html,/id="adminFeedback"/);assert.match(html,/id="adminProjectDialog"/);assert.match(html,/id="adminUserCount"/);assert.match(html,/12 or more characters/);assert.match(html,/id="passwordStrength"/);assert.match(html,/Forgot password\?/);assert.match(html,/Owner access setup/);assert.match(html,/What you can manage/);assert.match(html,/Developed with <span aria-label="love">❤️<\/span> by <b>Hans Ayub<\/b>/);
  for(const privatePath of ['/server.mjs','/.env','/package.json','/package-lock.json','/README.md','/data/projects.json'])assert.equal((await fetch(`http://127.0.0.1:${appPort}${privatePath}`)).status,404,`${privatePath} must not be served as a static file`);
  const script=await (await fetch(`http://127.0.0.1:${appPort}/app.js`)).text(),ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));for(const [,id] of script.matchAll(/querySelector\(['"]#([\w-]+)/g))assert.ok(ids.has(id),`app.js refers to missing #${id}`);
  assert.match(script,/querySelector\('#newProject'\)\.addEventListener/);assert.match(script,/querySelector\('#accountButton'\)\.addEventListener/);assert.match(script,/querySelector\('#authForm'\)\.addEventListener/);assert.match(script,/openAuthDialog\(\)/);assert.match(script,/session expired\/i/);assert.match(script,/applyTheme/);assert.match(script,/localStorage\.getItem\(THEME_KEY\)\|\|'light'/);assert.match(script,/\/api\/auth\/recover/);assert.match(script,/eye-open/);assert.match(html,/class="eye-icon eye-open"/);assert.match(html,/smtp-setup-help/);assert.match(script,/\/api\/admin\/me/);assert.match(script,/\/api\/feedback/);assert.match(script,/\/api\/admin\/feedback/);assert.match(script,/if\(!accessToken\)projects=\[\];renderProjects\(\);renderActivity\(\);syncProjects\(\);/);assert.match(html,/id="accessStatus"/);assert.match(html,/if \(location\.protocol === 'file:'\)/);assert.match(html,/id="themeToggle"/);assert.match(html,/id="authThemeToggle"/);assert.match(html,/id="termsDialog"/);assert.match(html,/id="adminDialog"/);assert.match(html,/auth-access-note/);
  const css=await (await fetch(`http://127.0.0.1:${appPort}/styles.css`)).text();assert.match(css,/body\{font-size:16px/);assert.match(css,/\.learning-steps/);assert.match(css,/body\[data-theme="light"\]/);assert.match(css,/\.auth-modal label\{display:block;width:100%;font-size:18px/);assert.match(css,/\.auth-modal input\{display:block;width:100%;max-width:100%;min-width:0;height:56px[^}]*font-size:18px/);assert.match(css,/#adminButton\[hidden\],#securityButton\[hidden\]\{display:none!important\}/);assert.match(css,/\.forgot-arrow/);assert.match(css,/\.admin-access-guide/);assert.match(css,/\.feedback-launcher/);assert.match(css,/\.admin-overview/);assert.match(css,/\.password-strength/);
  assert.match(css,/@media\(max-width:820px\)/);assert.match(css,/\.sidebar nav\.main-nav\{display:flex/);assert.match(css,/\.content\{width:100%;max-width:100%;min-width:0/);
  const health=await (await fetch(`http://127.0.0.1:${appPort}/api/health`)).json();assert.equal(health.status,'ok');
});
test('creates beginner CRUD starter templates that pass their generated checks',async()=>{
  assert.equal(resourceForIdea('I need to manage a product catalog'),'products');
  const html=await(await fetch(`http://127.0.0.1:${appPort}/`)).text();
  assert.match(html,/<label for="stackChoice">Backend language<\/label>/);
  assert.match(html,/<select id="stackChoice" name="stackChoice" required/);
  assert.match(html,/id="workspaceLanguage"/);assert.match(html,/id="changeLanguage"/);
  assert.match(html,/C\+\+ · MinGW or GCC/);assert.match(html,/Assembly · NASM \(Linux x86-64/);
  assert.match(html,/<span>Assembly · Linux<\/span>/);
  for(const [language,entry] of [['Python','main.py'],['JavaScript','index.js'],['Go','main.go'],['Rust','main.rs'],['Java','Main.java'],['C++','main.cpp'],['Assembly','main.asm']]) {
    const files=createStarterFiles(language,'Choice API','Manage products');
    assert.ok(files[entry],`${language} selection must generate its matching entry file`);
    assert.match(files['migrations/001_initial_schema.sql'],/CREATE TABLE IF NOT EXISTS products/);
    assert.match(files['DATABASE.md'],language==='Python'||language==='JavaScript'?/CRUD routes read and write this SQLite database automatically/:/does not yet connect to SQLite/);
    if(['Python','JavaScript'].includes(language))assert.match(files['README.md'],/GET \/products/);else if(['Go','C++','Assembly'].includes(language))assert.match(files['README.md'],/GET \/health/);else assert.match(files['README.md'],/not an HTTP server/);
  }
  const python=createStarterFiles('Python','Shop API','Manage products, customers and orders');
  assert.match(python['main.py'],/RESOURCE = "products"/);assert.match(python['main.py'],/Access-Control-Allow-Origin/);assert.match(python['main.py'],/def do_PUT/);
  const pythonRun=await fetch(`http://127.0.0.1:${appPort}/api/run`,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer test-token'},body:JSON.stringify({language:'python',task:'test',files:python})});
  assert.equal(pythonRun.status,200);const pythonResult=await pythonRun.json();assert.equal(pythonResult.exitCode,0,pythonResult.output);assert.match(pythonResult.output,/Ran 2 tests/);
  const javascript=createStarterFiles('JavaScript','Shop API','Manage products');assert.match(javascript['index.js'],/const resource = "products"/);assert.match(javascript['index.js'],/"DELETE"/);assert.match(javascript['index.js'],/node:sqlite/);assert.equal(JSON.parse(javascript['package.json']).engines.node,'>=22.5');assert.match(javascript['.gitignore'],/backend\.sqlite3/);
  const jsRun=await fetch(`http://127.0.0.1:${appPort}/api/run`,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer test-token'},body:JSON.stringify({language:'javascript',task:'test',files:javascript})});
  assert.equal(jsRun.status,200);const jsResult=await jsRun.json();assert.equal(jsResult.exitCode,0,jsResult.output);
  const cpp=createStarterFiles('C++','Health API','');assert.match(cpp['main.cpp'],/GET/);assert.match(cpp['README.md'],/MinGW.*GCC/);
  const cppRun=await fetch(`http://127.0.0.1:${appPort}/api/run/native`,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer test-token'},body:JSON.stringify({language:'C++',task:'test',files:cpp})});
  const cppResult=await cppRun.json();assert.equal(cppRun.status,200,JSON.stringify(cppResult));assert.ok(cppResult.exitCode===0||/unrecognized command line option.*c\+\+17/i.test(cppResult.output),cppResult.output);
  const assembly=createStarterFiles('Assembly','Health API','');assert.match(assembly['main.asm'],/global _start/);assert.match(assembly['README.md'],/Linux x86-64/);
  const asmRun=await fetch(`http://127.0.0.1:${appPort}/api/run/native`,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer test-token'},body:JSON.stringify({language:'Assembly',task:'test',files:assembly})});assert.equal(asmRun.status,200);const asmResult=await asmRun.json();if(process.platform==='linux'&&process.arch==='x64'){assert.ok(asmResult.exitCode===0||asmResult.exitCode===127,asmResult.output);if(asmResult.exitCode===127)assert.match(asmResult.output,/Could not start nasm/)}else{assert.equal(asmResult.exitCode,1);assert.match(asmResult.output,/Linux x86-64/)}
});
test('builds and exercises a sample Tasks API through the BackendDev local runner',async()=>{
  const files=createStarterFiles('JavaScript','Community Tasks API','Manage team tasks'),headers={'content-type':'application/json',authorization:'Bearer test-token'};
  const started=await fetch(`http://127.0.0.1:${appPort}/api/run/start`,{method:'POST',headers,body:JSON.stringify({language:'JavaScript',files})});assert.equal(started.status,200);const run=await started.json();assert.ok(run.sessionId);assert.equal(run.running,true,run.output);let health;
  try{
    for(let attempt=0;attempt<30;attempt++){try{health=await fetch('http://127.0.0.1:3000/health');if(health.ok)break}catch{}await wait(100)}
    assert.equal(health?.status,200,'generated API should listen on port 3000');assert.deepEqual(await health.json(),{status:'ok'});
    const preflight=await fetch('http://127.0.0.1:3000/tasks',{method:'OPTIONS'});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'*');
    const created=await fetch('http://127.0.0.1:3000/tasks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Test the API',done:false})});assert.equal(created.status,201);const task=await created.json();assert.equal(task.id,1);
    const list=await fetch('http://127.0.0.1:3000/tasks');assert.deepEqual(await list.json(),[task]);
    const read=await fetch(`http://127.0.0.1:3000/tasks/${task.id}`);assert.equal((await read.json()).name,'Test the API');
    const updated=await fetch(`http://127.0.0.1:3000/tasks/${task.id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({done:true})});assert.equal((await updated.json()).done,true);
    const invalid=await fetch('http://127.0.0.1:3000/tasks',{method:'POST',headers:{'content-type':'application/json'},body:'{invalid'});assert.equal(invalid.status,400);
    const missing=await fetch('http://127.0.0.1:3000/tasks/999');assert.equal(missing.status,404);
    const removed=await fetch(`http://127.0.0.1:3000/tasks/${task.id}`,{method:'DELETE'});assert.equal(removed.status,200);const gone=await fetch(`http://127.0.0.1:3000/tasks/${task.id}`);assert.equal(gone.status,404);
  }finally{await fetch(`http://127.0.0.1:${appPort}/api/run/${run.sessionId}`,{method:'DELETE',headers:{authorization:'Bearer test-token'}})}
});
test('generated Node CRUD data survives an API process restart',async()=>{
  const files=createStarterFiles('JavaScript','Persistent Tasks API','Manage team tasks'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'backenddev-sqlite-')),port=await freePort(),dbPath=path.join(dir,'records.sqlite3');
  await fs.writeFile(path.join(dir,'index.js'),files['index.js']);
  const start=()=>spawn(process.execPath,[path.join(dir,'index.js')],{cwd:dir,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATABASE_PATH:dbPath},stdio:'ignore'});
  const waitForApi=async child=>{for(let i=0;i<40;i++){if(child.exitCode!==null)throw new Error('Generated API exited early');try{const response=await fetch(`http://127.0.0.1:${port}/health`);if(response.ok)return}catch{}await wait(100)}throw new Error('Generated SQLite API did not start')};
  let child=start();
  try{
    await waitForApi(child);
    const created=await fetch(`http://127.0.0.1:${port}/tasks`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Survive restart'})});assert.equal(created.status,201);const row=await created.json();
    child.kill();await new Promise(resolve=>child.once('exit',resolve));child=start();await waitForApi(child);
    const restored=await fetch(`http://127.0.0.1:${port}/tasks/${row.id}`);assert.equal(restored.status,200);assert.deepEqual(await restored.json(),row);
  }finally{child.kill();await new Promise(resolve=>child.once('exit',resolve));await fs.rm(dir,{recursive:true,force:true})}
});
test('creates and updates projects using only real Supabase columns',async()=>{
  const headers={'content-type':'application/json',authorization:'Bearer test-token'};
  const payload={name:'Store API',language:'Python',framework:'Standard library',description:'Manage products and orders',status:'Draft',files:{'main.py':'print("ok")'},updated:'Created just now'};
  const created=await fetch(`http://127.0.0.1:${appPort}/api/projects`,{method:'POST',headers,body:JSON.stringify(payload)});
  assert.equal(created.status,201);const project=await created.json();assert.ok(project.updated_at);assert.equal(project.description,payload.description);
  const updated=await fetch(`http://127.0.0.1:${appPort}/api/projects/${project.id}`,{method:'PUT',headers,body:JSON.stringify({files:{'main.py':'print("changed")'},updated:'just now'})});
  assert.equal(updated.status,200);assert.ok((await updated.json()).updated_at);
});
test('connects encrypted GitHub credentials and imports, branches, and publishes a project',async()=>{
  const auth={authorization:'Bearer test-token'},headers={'content-type':'application/json',...auth};
  assert.equal((await fetch(`http://127.0.0.1:${appPort}/api/github/repos`)).status,401);
  const connected=await fetch(`http://127.0.0.1:${appPort}/api/github/connect`,{method:'POST',headers,body:JSON.stringify({token:'github_pat_test-token'})});assert.equal(connected.status,200);assert.equal((await connected.json()).login,'backenddev-test');assert.ok(githubTokenRecord.token_ciphertext);assert.notEqual(githubTokenRecord.token_ciphertext,'github_pat_test-token');assert.equal(Object.hasOwn(githubTokenRecord,'token'),false);
  const status=await(await fetch(`http://127.0.0.1:${appPort}/api/github/status`,{headers:auth})).json();assert.equal(status.connected,true);assert.equal(status.login,'backenddev-test');
  const repos=await(await fetch(`http://127.0.0.1:${appPort}/api/github/repos`,{headers:auth})).json();assert.equal(repos.repositories[0].full_name,'acme/tasks-api');
  const branches=await(await fetch(`http://127.0.0.1:${appPort}/api/github/branches?repo=acme%2Ftasks-api`,{headers:auth})).json();assert.equal(branches.default_branch,'main');assert.deepEqual(branches.branches,['main']);
  const invalidBranch=await fetch(`http://127.0.0.1:${appPort}/api/github/branches`,{method:'POST',headers,body:JSON.stringify({repo:'acme/tasks-api',branch:'../unsafe'})});assert.equal(invalidBranch.status,400);
  const created=await fetch(`http://127.0.0.1:${appPort}/api/github/branches`,{method:'POST',headers,body:JSON.stringify({repo:'acme/tasks-api',branch:'feature/api'})});assert.equal(created.status,201);assert.equal((await created.json()).branch,'feature/api');
  const importedResponse=await fetch(`http://127.0.0.1:${appPort}/api/github/import`,{method:'POST',headers,body:JSON.stringify({repo:'acme/tasks-api',branch:'main'})});assert.equal(importedResponse.status,201);const imported=(await importedResponse.json()).project;assert.equal(imported.language,'JavaScript');assert.ok(imported.files['index.js']);assert.equal(Object.keys(imported.files).some(name=>name==='.env'||name.startsWith('node_modules/')),false);
  const published=await fetch(`http://127.0.0.1:${appPort}/api/github/commit`,{method:'POST',headers,body:JSON.stringify({repo:'acme/tasks-api',branch:'feature/api',projectName:'Tasks API',files:{'index.js':'console.log("updated")','openapi.json':'{}','migration-backup/Python/main.py':'print(1)','.env.example':'API_KEY=replace-me'}})});assert.equal(published.status,200);const result=await published.json();assert.equal(result.commit,'new-commit-sha');assert.equal(result.branch,'feature/api');assert.equal(githubPublishedTree.tree.some(file=>file.path.startsWith('migration-backup/')),false);assert.ok(githubPublishedTree.tree.some(file=>file.path==='.env.example'));
  const invalidPr=await fetch(`http://127.0.0.1:${appPort}/api/github/pull-requests`,{method:'POST',headers,body:JSON.stringify({repo:'acme/tasks-api',head:'main',base:'main',title:'No-op'})});assert.equal(invalidPr.status,400);
  const prResponse=await fetch(`http://127.0.0.1:${appPort}/api/github/pull-requests`,{method:'POST',headers,body:JSON.stringify({repo:'acme/tasks-api',head:'feature/api',title:'Add tasks API',body:'Review the generated API and tests.'})});assert.equal(prResponse.status,201);const pr=await prResponse.json();assert.equal(pr.number,17);assert.equal(pr.base,'main');assert.deepEqual(githubPullRequest,{title:'Add tasks API',head:'feature/api',base:'main',body:'Review the generated API and tests.'});
  const secret=await fetch(`http://127.0.0.1:${appPort}/api/github/commit`,{method:'POST',headers,body:JSON.stringify({repo:'acme/tasks-api',branch:'feature/api',files:{'main.js':'const key="ghp_123456789012345678901234567890";'}})});assert.equal(secret.status,400);
  const disconnected=await fetch(`http://127.0.0.1:${appPort}/api/github/connect`,{method:'DELETE',headers:auth});assert.equal(disconnected.status,200);assert.equal(githubTokenRecord,null);assert.equal((await(await fetch(`http://127.0.0.1:${appPort}/api/github/status`,{headers:auth})).json()).connected,false);
});
test('sign-in and signup endpoints enforce terms and use the app origin locally',async()=>{
  const signin=await fetch(`http://127.0.0.1:${appPort}/api/auth/signin`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'learner@example.test',password:'correct-password'})});assert.equal(signin.status,200);assert.equal((await signin.json()).access_token,'mock-access-token');
  const failed=await fetch(`http://127.0.0.1:${appPort}/api/auth/signin`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'learner@example.test',password:'wrong-password'})});assert.equal(failed.status,400);assert.match((await failed.json()).msg,/Invalid login credentials/);
  const weak=await fetch(`http://127.0.0.1:${appPort}/api/auth/signup`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'weak@example.test',password:'correct-password',termsAccepted:true})});assert.equal(weak.status,400);assert.equal((await weak.json()).error_code,'weak_password');
  const rejectedSignup=await fetch(`http://127.0.0.1:${appPort}/api/auth/signup`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'learner@example.test',password:'Brisk-Lantern!Orbit47'})});assert.equal(rejectedSignup.status,400);
  const signup=await fetch(`http://127.0.0.1:${appPort}/api/auth/signup`,{method:'POST',headers:{'content-type':'application/json',origin:`http://127.0.0.1:${appPort}`},body:JSON.stringify({email:'learner@example.test',password:'Brisk-Lantern!Orbit47',termsAccepted:true})});assert.equal(signup.status,200);assert.equal(lastSignupRedirect,`http://127.0.0.1:${appPort}`);assert.equal(signupMetadata.terms_version,'2026-11-01');assert.ok(signupMetadata.terms_accepted_at);
});
test('password recovery links return to the app and require the emailed recovery token to update the password',async()=>{
  const headers={'content-type':'application/json'},route=`http://127.0.0.1:${appPort}/api/auth/recover`;
  const requested=await fetch(route,{method:'POST',headers,body:JSON.stringify({email:'recover@example.test'})});assert.equal(requested.status,200);assert.equal(lastRecoveryRedirect,'http://127.0.0.1:4173');
  const limited=await fetch(route,{method:'POST',headers,body:JSON.stringify({email:'limited@example.test'})});assert.equal(limited.status,429);assert.equal((await limited.json()).error_code,'email_provider_rate_limited');
  const anonymous=await fetch(`http://127.0.0.1:${appPort}/api/auth/password`,{method:'POST',headers,body:JSON.stringify({password:'new-password-123'})});assert.equal(anonymous.status,401);
  const weak=await fetch(`http://127.0.0.1:${appPort}/api/auth/password`,{method:'POST',headers:{...headers,authorization:'Bearer recovery-token'},body:JSON.stringify({password:'new-password-123'})});assert.equal(weak.status,400);assert.equal((await weak.json()).error_code,'weak_password');
  const updated=await fetch(`http://127.0.0.1:${appPort}/api/auth/password`,{method:'POST',headers:{...headers,authorization:'Bearer recovery-token'},body:JSON.stringify({password:'Brisk-Lantern!Orbit47'})});assert.equal(updated.status,200);assert.equal(updatedPassword,'Brisk-Lantern!Orbit47');
});
test('signin throttling is per visitor and cannot lock an email across devices',async()=>{
  const route='http://127.0.0.1:'+appPort+'/api/auth/signin',body=JSON.stringify({email:'distributed-guess@example.test',password:'wrong-password'});
  for(let i=0;i<20;i++){const r=await fetch(route,{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'198.51.100.'+(i+1)},body});assert.equal(r.status,400,'attempt '+(i+1)+' from a separate IP should reach auth')}
  const separateDevice=await fetch(route,{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'203.0.113.88'},body});assert.equal(separateDevice.status,400,'same email on a new IP must not inherit another visitor cooldown');
  const sameIpHeaders={'content-type':'application/json','x-forwarded-for':'192.0.2.88'};
  for(let i=0;i<8;i++){const r=await fetch(route,{method:'POST',headers:sameIpHeaders,body});assert.equal(r.status,400)}
  const limited=await fetch(route,{method:'POST',headers:sameIpHeaders,body});assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);
});
test('owner controls require a signed-in allowlisted account and keep the service key server-side',async()=>{
  const base=`http://127.0.0.1:${appPort}/api/admin`,headers={'content-type':'application/json',authorization:'Bearer test-token'};
  assert.equal((await fetch(`${base}/users`)).status,401);
  assert.equal((await fetch(`${base}/users`,{headers:{...headers,authorization:'Bearer non-owner-token'}})).status,403);assert.equal((await fetch(`${base}/projects/33333333-3333-4333-8333-333333333333`,{headers:{...headers,authorization:'Bearer non-owner-token'}})).status,403);assert.equal((await fetch('http://127.0.0.1:'+appPort+'/api/feedback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({category:'Problem',subject:'Test issue',message:'This is a sample feedback message.'})})).status,401);
  const me=await(await fetch(`${base}/me`,{headers})).json();assert.equal(me.isAdmin,true);assert.equal(me.controlsReady,true);assert.equal(me.mfaEnrolled,true);assert.equal(me.mfaVerified,true);assert.equal(Object.hasOwn(me,'email'),false);
  const users=await fetch(`${base}/users`,{headers});assert.equal(users.status,200);assert.equal((await users.json()).users[0].email,'member@example.test');
  const projects=await fetch(`${base}/projects`,{headers});assert.equal(projects.status,200);assert.equal((await projects.json()).projects[0].name,'Example API');
  const privateProject=await fetch(`${base}/projects/33333333-3333-4333-8333-333333333333`,{headers});assert.equal(privateProject.status,200);assert.equal((await privateProject.json()).project.files['main.py'],'print("private")');
  const submitted=await fetch('http://127.0.0.1:'+appPort+'/api/feedback',{method:'POST',headers,body:JSON.stringify({category:'Problem',subject:'Cannot build',message:'The builder did not create my project.'})});assert.equal(submitted.status,201);
  const inbox=await fetch(`${base}/feedback`,{headers});assert.equal(inbox.status,200);assert.equal((await inbox.json()).feedback[0].user_email,'member@example.test');
  const feedbackUpdate=await fetch(`${base}/feedback/44444444-4444-4444-8444-444444444444`,{method:'PUT',headers,body:JSON.stringify({status:'Resolved'})});assert.equal(feedbackUpdate.status,200);
  const self=await fetch(`${base}/users/11111111-1111-4111-8111-111111111111/suspend`,{method:'POST',headers,body:'{}'});assert.equal(self.status,400);
  const suspended=await fetch(`${base}/users/22222222-2222-4222-8222-222222222222/suspend`,{method:'POST',headers,body:'{}'});assert.equal(suspended.status,200);
  const selfDelete=await fetch(`${base}/users/11111111-1111-4111-8111-111111111111`,{method:'DELETE',headers});assert.equal(selfDelete.status,400);
  const deleted=await fetch(`${base}/users/22222222-2222-4222-8222-222222222222`,{method:'DELETE',headers});assert.equal(deleted.status,200);
  const projectDelete=await fetch(`${base}/projects/33333333-3333-4333-8333-333333333333`,{method:'DELETE',headers});assert.equal(projectDelete.status,200);
});
test('owner controls require verified TOTP and MFA setup endpoints proxy to Supabase',async()=>{
  const root=`http://127.0.0.1:${appPort}/api`,aal1={'content-type':'application/json',authorization:'Bearer owner-aal1-token'},ready={'content-type':'application/json',authorization:'Bearer test-token'};
  const blocked=await fetch(`${root}/admin/users`,{headers:aal1});assert.equal(blocked.status,403);assert.equal((await blocked.json()).error_code,'owner_mfa_verification_required');
  const factors=await fetch(`${root}/auth/mfa/factors`,{headers:ready});assert.equal(factors.status,200);assert.equal((await factors.json()).totp[0].status,'verified');
  const enroll=await fetch(`${root}/auth/mfa/enroll`,{method:'POST',headers:ready,body:'{}'});assert.equal(enroll.status,200);const enrolled=await enroll.json();assert.equal(enrolled.totp.secret,'TEST-SECRET');assert.match(enrolled.totp.qr_code,/^data:image\/png;base64,/);assert.ok(Buffer.from(enrolled.totp.qr_code.split(',')[1],'base64').length>100);
  const challenge=await fetch(`${root}/auth/mfa/factors/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/challenge`,{method:'POST',headers:ready,body:'{}'});assert.equal((await challenge.json()).id,'challenge-test');
  const invalid=await fetch(`${root}/auth/mfa/factors/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/verify`,{method:'POST',headers:ready,body:JSON.stringify({challenge_id:'challenge-test',code:'12'})});assert.equal(invalid.status,400);
  const verify=await fetch(`${root}/auth/mfa/factors/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/verify`,{method:'POST',headers:ready,body:JSON.stringify({challenge_id:'challenge-test',code:'123456'})});assert.equal((await verify.json()).access_token,'mfa-access-token');
  const remove=await fetch(`${root}/auth/mfa/factors/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/unenroll`,{method:'DELETE',headers:ready});assert.equal(remove.status,200);
  const setup=await(await fetch(`${root}/admin/setup-status`,{headers:ready})).json();assert.ok(setup.checks.find(check=>check.key==='adminApi')?.ok);assert.ok(setup.checks.find(check=>check.key==='feedback')?.ok);assert.ok(setup.checks.find(check=>check.key==='mfa')?.ok);
  const aal2={'content-type':'application/json',authorization:'Bearer owner-aal2-factors-405-token'},ownerStatus=await(await fetch(`${root}/admin/me`,{headers:aal2})).json();assert.equal(ownerStatus.mfaVerified,true);assert.equal(ownerStatus.mfaEnrolled,true);assert.equal(ownerStatus.mfaCheckAvailable,true);const ownerSetup=await(await fetch(`${root}/admin/setup-status`,{headers:aal2})).json();assert.equal(ownerSetup.checks.find(check=>check.key==='mfa')?.ok,true);assert.equal((await fetch(`${root}/admin/overview`,{headers:aal2})).status,200);
});
test('auth proxy rate limits repeated confirmation emails before they reach Supabase',async()=>{
  const route=`http://127.0.0.1:${appPort}/api/auth/resend`,beforeCount=resendCalls,headers={'content-type':'application/json','x-forwarded-for':'198.51.100.77'};
  const body=JSON.stringify({email:'rate-limit@example.test'}),first=await fetch(route,{method:'POST',headers,body});assert.equal(first.status,200);assert.equal(resendCalls,beforeCount+1);
  const immediate=await fetch(route,{method:'POST',headers,body});assert.equal(immediate.status,429);assert.equal(immediate.headers.get('retry-after'),'60');assert.equal(resendCalls,beforeCount+1);
});
test('AI proposal endpoint authenticates and returns usable model file proposals',async()=>{
  const route=`http://127.0.0.1:${appPort}/api/generate`,body=JSON.stringify({prompt:'Add a health endpoint',files:{'main.py':'print("starter")'}});
  const anonymous=await fetch(route,{method:'POST',headers:{'content-type':'application/json'},body});assert.equal(anonymous.status,401);
  const projects=await fetch(`http://127.0.0.1:${appPort}/api/projects`);assert.equal(projects.status,401);
  const runtimes=await fetch(`http://127.0.0.1:${appPort}/api/runtimes`);assert.equal(runtimes.status,401);
  const run=await fetch(`http://127.0.0.1:${appPort}/api/run`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({language:'python',task:'test',files:{'main.py':'pass'}})});assert.equal(run.status,401);
  const result=await fetch(route,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer test-token'},body});assert.equal(result.status,200);const data=await result.json();assert.match(data.answer,/"summary":"Added a health route"/);assert.equal(modelCalls,1);
  const quota=await fetch(route,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer test-token'},body:JSON.stringify({prompt:'simulate quota error',files:{}})});assert.equal(quota.status,502);assert.match((await quota.json()).error,/rate limited|no available quota/);assert.equal(modelCalls,2);
});
test('keeps a local backend alive until its run session is stopped',async(t)=>{
  const auth={'authorization':'Bearer test-token'},runtimes=await (await fetch(`http://127.0.0.1:${appPort}/api/runtimes`,{headers:auth})).json();if(!runtimes.python?.installed)t.skip('Python runtime is not installed');
  let sessionId;
  try{const started=await fetch(`http://127.0.0.1:${appPort}/api/run/start`,{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({language:'python',files:{'main.py':'import time\nprint("ready", flush=True)\ntime.sleep(30)'}})});assert.equal(started.status,200);const data=await started.json();sessionId=data.sessionId;assert.ok(sessionId);assert.equal(data.running,true);assert.match(data.output,/ready/);
    const poll=await fetch(`http://127.0.0.1:${appPort}/api/run/${sessionId}`,{headers:auth});assert.equal(poll.status,200);assert.equal((await poll.json()).running,true);
    const stopped=await fetch(`http://127.0.0.1:${appPort}/api/run/${sessionId}`,{method:'DELETE',headers:auth});assert.equal(stopped.status,200);let finalState;for(let i=0;i<20;i++){await wait(100);finalState=await (await fetch(`http://127.0.0.1:${appPort}/api/run/${sessionId}`,{headers:auth})).json();if(!finalState.running)break}assert.equal(finalState.running,false,'stop should terminate the local backend');
  }finally{if(sessionId)await fetch(`http://127.0.0.1:${appPort}/api/run/${sessionId}`,{method:'DELETE',headers:auth});}
});
test('production mode refuses to execute user code',async()=>{
  const port=await freePort(),child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),NODE_ENV:'production',SUPABASE_URL:'',SUPABASE_ANON_KEY:'',APP_URL:''},stdio:'ignore'});
  try { await ready(`http://127.0.0.1:${port}/api/health`,child);for(const route of ['/api/run','/api/run/start']){const result=await fetch(`http://127.0.0.1:${port}${route}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({language:'python',files:{'main.py':'print(1)'}})});assert.equal(result.status,503);assert.match((await result.json()).error,/secure isolated worker|secure isolated runner/);} }
  finally { child.kill(); }
});
test('Render public URL supports the production auth redirect health check',async()=>{
  const port=await freePort(),publicUrl='https://backenddev.example.onrender.com',child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),NODE_ENV:'production',SUPABASE_URL:`http://127.0.0.1:${mockPort}`,SUPABASE_ANON_KEY:'test-publishable-key',APP_URL:'',RENDER_EXTERNAL_URL:publicUrl},stdio:'ignore'});
  try{await ready(`http://127.0.0.1:${port}/api/health`,child);const health=await(await fetch(`http://127.0.0.1:${port}/api/health`)).json();assert.equal(health.multiUserReady,true);const signup=await fetch(`http://127.0.0.1:${port}/api/auth/signup`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'learner@example.test',password:'Brisk-Lantern!Orbit47',termsAccepted:true})});assert.equal(signup.status,200);assert.equal(lastSignupRedirect,publicUrl)}finally{child.kill()}
});
