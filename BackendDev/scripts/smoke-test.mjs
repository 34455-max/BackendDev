import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { createStarterFiles, resourceForIdea } from '../starter-templates.js';

const root = new URL('../', import.meta.url);
let app, mockDb, appPort, mockPort, lastSignupRedirect='', lastRecoveryRedirect='', signupMetadata=null, updatedPassword='', modelCalls=0, resendCalls=0;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function ready(url, child) { for (let i=0;i<80;i++) { if (child.exitCode!==null) throw Error('BackendDev process exited before it was ready'); try { const r=await fetch(url); if(r.ok)return; } catch {} await wait(100); } throw Error('BackendDev did not start in time'); }

before(async () => {
  mockPort = await freePort();
  mockDb = http.createServer(async (req, res) => {
    let raw=''; for await (const chunk of req) raw += chunk;
    res.setHeader('content-type','application/json');
    if (req.url === '/auth/v1/user'&&req.method==='GET') { const member=req.headers.authorization==='Bearer non-owner-token';res.end(JSON.stringify({id:member?'44444444-4444-4444-8444-444444444444':'11111111-1111-4111-8111-111111111111',email:member?'member@example.test':'owner@example.test'})); return; }
    if (req.url==='/auth/v1/admin/users?page=1&per_page=100') { res.end(JSON.stringify({users:[{id:'22222222-2222-4222-8222-222222222222',email:'member@example.test',created_at:'2026-01-01T00:00:00Z',confirmed_at:'2026-01-02T00:00:00Z'}]}));return; }
    if (req.url.startsWith('/auth/v1/admin/users/')&&req.method==='PUT') { const uid=req.url.split('/').pop(),patch=JSON.parse(raw);assert.equal(req.headers.apikey,'sb_secret_test-key');assert.notEqual(req.headers.authorization,'Bearer sb_secret_test-key');res.end(JSON.stringify({user:{id:uid,banned_until:patch.ban_duration==='none'?null:'2126-01-01T00:00:00Z'}}));return; }
    if (req.url.startsWith('/auth/v1/admin/users/')&&req.method==='DELETE') { assert.equal(req.headers.apikey,'sb_secret_test-key');res.end(JSON.stringify({id:req.url.split('/').pop()}));return; }
    if (req.url === '/v1/chat/completions') { const payload=JSON.parse(raw);modelCalls++;assert.equal(payload.model,'test-model');if(payload.messages[1].content.includes('simulate quota error')){res.statusCode=429;res.end(JSON.stringify({error:{message:'insufficient_quota: no credits remaining'}}));return}res.end(JSON.stringify({choices:[{message:{content:'```json\n{"summary":"Added a health route","files":{"main.py":"print(\"ok\")"}}\n```'}}]}));return; }
    if (req.url.startsWith('/auth/v1/token?grant_type=password')) { const credentials=JSON.parse(raw);res.end(JSON.stringify(credentials.password==='correct-password'?{access_token:'mock-access-token',token_type:'bearer',user:{id:'11111111-1111-4111-8111-111111111111'}}:(res.statusCode=400,{code:'invalid_credentials',msg:'Invalid login credentials'})));return; }
    if (req.url.startsWith('/auth/v1/signup?')) { lastSignupRedirect=new URL(req.url,'http://mock-supabase.test').searchParams.get('redirect_to');signupMetadata=JSON.parse(raw).data;res.end(JSON.stringify({id:'11111111-1111-4111-8111-111111111111',email:'learner@example.test'}));return; }
    if (req.url.startsWith('/auth/v1/recover?')) { lastRecoveryRedirect=new URL(req.url,'http://mock-supabase.test').searchParams.get('redirect_to');res.end(JSON.stringify({}));return; }
    if (req.url==='/auth/v1/user'&&req.method==='PUT') { updatedPassword=JSON.parse(raw).password;res.end(JSON.stringify({id:'11111111-1111-4111-8111-111111111111'}));return; }
    if (req.url==='/auth/v1/resend') { resendCalls++;res.end(JSON.stringify({}));return; }
    if (req.url.startsWith('/rest/v1/user_feedback')) {
      assert.equal(req.headers.apikey,'sb_secret_test-key');
      if(req.method==='POST'){const feedback=JSON.parse(raw);assert.equal(feedback.user_id,'11111111-1111-4111-8111-111111111111');assert.equal(feedback.user_email,'owner@example.test');res.end(JSON.stringify([{id:'44444444-4444-4444-8444-444444444444',...feedback,status:'New'}]));return;}
      if(req.method==='GET'){res.end(JSON.stringify([{id:'44444444-4444-4444-8444-444444444444',user_id:'11111111-1111-4111-8111-111111111111',user_email:'member@example.test',category:'Problem',subject:'Cannot build',message:'The builder did not create my project.',status:'New',created_at:'2026-11-01T00:00:00Z'}]));return;}
      if(req.method==='PATCH'){assert.match(raw,/\"status\":\"Resolved\"/);res.end('');return;}
    }
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
  app=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(appPort),NODE_ENV:'test',SUPABASE_URL:`http://127.0.0.1:${mockPort}`,SUPABASE_ANON_KEY:'test-publishable-key',APP_URL:'http://127.0.0.1:4173',APP_ADMIN_EMAILS:'owner@example.test',SUPABASE_SECRET_KEY:'sb_secret_test-key',MODEL_API_KEY:'mock-model-key',MODEL_API_URL:`http://127.0.0.1:${mockPort}/v1/chat/completions`,MODEL_NAME:'test-model'},stdio:'ignore'});
  await ready(`http://127.0.0.1:${appPort}/api/health`,app);
});
after(async()=>{app?.kill();if(mockDb)await new Promise(resolve=>mockDb.close(resolve));});

test('serves the app and reports API health',async()=>{
  const page=await fetch(`http://127.0.0.1:${appPort}/`);assert.equal(page.status,200);const html=await page.text();assert.match(html,/BackendDev/);assert.match(html,/Build my project/);assert.match(html,/What happens when someone uses your app/);assert.match(html,/id="closeProject"/);assert.match(html,/type="module" src="app.js"/);assert.match(html,/placeholder="Enter your email"/);assert.match(html,/placeholder="Enter your password"/);assert.match(html,/id="passwordPolicyNote"/);assert.match(html,/id="openFeedback"/);assert.match(html,/id="feedbackDialog"/);assert.match(html,/id="adminFeedback"/);assert.match(html,/id="adminProjectDialog"/);assert.match(html,/id="adminUserCount"/);assert.match(html,/12 or more characters/);assert.match(html,/id="passwordStrength"/);assert.match(html,/Forgot password\?/);assert.match(html,/Owner access setup/);assert.match(html,/What you can manage/);assert.match(html,/Developed with <span aria-label="love">❤️<\/span> by <b>Hans Ayub<\/b>/);
  const script=await (await fetch(`http://127.0.0.1:${appPort}/app.js`)).text(),ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));for(const [,id] of script.matchAll(/querySelector\(['"]#([\w-]+)/g))assert.ok(ids.has(id),`app.js refers to missing #${id}`);
  assert.match(script,/querySelector\('#newProject'\)\.addEventListener/);assert.match(script,/querySelector\('#accountButton'\)\.addEventListener/);assert.match(script,/querySelector\('#authForm'\)\.addEventListener/);assert.match(script,/openAuthDialog\(\)/);assert.match(script,/session expired\/i/);assert.match(script,/applyTheme/);assert.match(script,/localStorage\.getItem\(THEME_KEY\)\|\|'light'/);assert.match(script,/\/api\/auth\/recover/);assert.match(script,/\/api\/admin\/me/);assert.match(script,/\/api\/feedback/);assert.match(script,/\/api\/admin\/feedback/);assert.match(script,/if\(!accessToken\)projects=\[\];renderProjects\(\);renderActivity\(\);syncProjects\(\);/);assert.match(html,/id="accessStatus"/);assert.match(html,/if \(location\.protocol === 'file:'\)/);assert.match(html,/id="themeToggle"/);assert.match(html,/id="authThemeToggle"/);assert.match(html,/id="termsDialog"/);assert.match(html,/id="adminDialog"/);assert.match(html,/auth-access-note/);
  const css=await (await fetch(`http://127.0.0.1:${appPort}/styles.css`)).text();assert.match(css,/body\{font-size:16px/);assert.match(css,/\.learning-steps/);assert.match(css,/body\[data-theme="light"\]/);assert.match(css,/\.auth-modal label\{display:block;width:100%;font-size:18px/);assert.match(css,/\.forgot-arrow/);assert.match(css,/\.admin-access-guide/);assert.match(css,/\.feedback-launcher/);assert.match(css,/\.admin-overview/);assert.match(css,/\.password-strength/);
  assert.match(css,/@media\(max-width:820px\)/);assert.match(css,/\.sidebar nav\.main-nav\{display:flex/);assert.match(css,/\.content\{width:100%;max-width:100%;min-width:0/);
  const health=await (await fetch(`http://127.0.0.1:${appPort}/api/health`)).json();assert.equal(health.status,'ok');
});
test('creates beginner CRUD starter templates that pass their generated checks',async()=>{
  assert.equal(resourceForIdea('I need to manage a product catalog'),'products');
  const html=await(await fetch(`http://127.0.0.1:${appPort}/`)).text();
  assert.match(html,/<label for="stackChoice">Backend language<\/label>/);
  assert.match(html,/<select id="stackChoice" name="stackChoice" required/);
  assert.match(html,/determines the generated source files and which local runtime BackendDev uses/);
  for(const [language,entry] of [['Python','main.py'],['JavaScript','index.js'],['Go','main.go'],['Rust','main.rs'],['Java','Main.java']]) {
    const files=createStarterFiles(language,'Choice API','Manage products');
    assert.ok(files[entry],`${language} selection must generate its matching entry file`);
    assert.match(files['README.md'],/GET \/products/);
  }
  const python=createStarterFiles('Python','Shop API','Manage products, customers and orders');
  assert.match(python['main.py'],/RESOURCE = "products"/);assert.match(python['main.py'],/Access-Control-Allow-Origin/);assert.match(python['main.py'],/def do_PUT/);
  const pythonRun=await fetch(`http://127.0.0.1:${appPort}/api/run`,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer test-token'},body:JSON.stringify({language:'python',task:'test',files:python})});
  assert.equal(pythonRun.status,200);const pythonResult=await pythonRun.json();assert.equal(pythonResult.exitCode,0,pythonResult.output);assert.match(pythonResult.output,/Ran 2 tests/);
  const javascript=createStarterFiles('JavaScript','Shop API','Manage products');assert.match(javascript['index.js'],/const resource = "products"/);assert.match(javascript['index.js'],/"DELETE"/);
  const jsRun=await fetch(`http://127.0.0.1:${appPort}/api/run`,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer test-token'},body:JSON.stringify({language:'javascript',task:'test',files:javascript})});
  assert.equal(jsRun.status,200);const jsResult=await jsRun.json();assert.equal(jsResult.exitCode,0,jsResult.output);
});
test('creates and updates projects using only real Supabase columns',async()=>{
  const headers={'content-type':'application/json',authorization:'Bearer test-token'};
  const payload={name:'Store API',language:'Python',framework:'Standard library',description:'Manage products and orders',status:'Draft',files:{'main.py':'print("ok")'},updated:'Created just now'};
  const created=await fetch(`http://127.0.0.1:${appPort}/api/projects`,{method:'POST',headers,body:JSON.stringify(payload)});
  assert.equal(created.status,201);const project=await created.json();assert.ok(project.updated_at);assert.equal(project.description,payload.description);
  const updated=await fetch(`http://127.0.0.1:${appPort}/api/projects/${project.id}`,{method:'PUT',headers,body:JSON.stringify({files:{'main.py':'print("changed")'},updated:'just now'})});
  assert.equal(updated.status,200);assert.ok((await updated.json()).updated_at);
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
  const anonymous=await fetch(`http://127.0.0.1:${appPort}/api/auth/password`,{method:'POST',headers,body:JSON.stringify({password:'new-password-123'})});assert.equal(anonymous.status,401);
  const weak=await fetch(`http://127.0.0.1:${appPort}/api/auth/password`,{method:'POST',headers:{...headers,authorization:'Bearer recovery-token'},body:JSON.stringify({password:'new-password-123'})});assert.equal(weak.status,400);assert.equal((await weak.json()).error_code,'weak_password');
  const updated=await fetch(`http://127.0.0.1:${appPort}/api/auth/password`,{method:'POST',headers:{...headers,authorization:'Bearer recovery-token'},body:JSON.stringify({password:'Brisk-Lantern!Orbit47'})});assert.equal(updated.status,200);assert.equal(updatedPassword,'Brisk-Lantern!Orbit47');
});
test('signin attempts are throttled per account across changing client IPs',async()=>{
  const route=`http://127.0.0.1:${appPort}/api/auth/signin`,body=JSON.stringify({email:'distributed-guess@example.test',password:'wrong-password'});
  for(let i=0;i<20;i++){const r=await fetch(route,{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':`198.51.100.${i+1}`},body});assert.equal(r.status,400,`attempt ${i+1} should reach auth before the per-account threshold`)}
  const limited=await fetch(route,{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'203.0.113.88'},body});assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);
});
test('owner controls require a signed-in allowlisted account and keep the service key server-side',async()=>{
  const base=`http://127.0.0.1:${appPort}/api/admin`,headers={'content-type':'application/json',authorization:'Bearer test-token'};
  assert.equal((await fetch(`${base}/users`)).status,401);
  assert.equal((await fetch(`${base}/users`,{headers:{...headers,authorization:'Bearer non-owner-token'}})).status,403);assert.equal((await fetch(`${base}/projects/33333333-3333-4333-8333-333333333333`,{headers:{...headers,authorization:'Bearer non-owner-token'}})).status,403);assert.equal((await fetch('http://127.0.0.1:'+appPort+'/api/feedback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({category:'Problem',subject:'Test issue',message:'This is a sample feedback message.'})})).status,401);
  const me=await(await fetch(`${base}/me`,{headers})).json();assert.equal(me.isAdmin,true);assert.equal(me.controlsReady,true);assert.equal(Object.hasOwn(me,'email'),false);
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
