import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { createStarterFiles, resourceForIdea } from '../starter-templates.js';

const root = new URL('../', import.meta.url);
let app, mockDb, appPort, mockPort, lastSignupRedirect='', modelCalls=0;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function ready(url, child) { for (let i=0;i<80;i++) { if (child.exitCode!==null) throw Error('BackendDev process exited before it was ready'); try { const r=await fetch(url); if(r.ok)return; } catch {} await wait(100); } throw Error('BackendDev did not start in time'); }

before(async () => {
  mockPort = await freePort();
  mockDb = http.createServer(async (req, res) => {
    let raw=''; for await (const chunk of req) raw += chunk;
    res.setHeader('content-type','application/json');
    if (req.url === '/auth/v1/user') { res.end(JSON.stringify({id:'11111111-1111-4111-8111-111111111111'})); return; }
    if (req.url === '/v1/chat/completions') { const payload=JSON.parse(raw);modelCalls++;assert.equal(payload.model,'test-model');if(payload.messages[1].content.includes('simulate quota error')){res.statusCode=429;res.end(JSON.stringify({error:{message:'insufficient_quota: no credits remaining'}}));return}res.end(JSON.stringify({choices:[{message:{content:'```json\n{"summary":"Added a health route","files":{"main.py":"print(\"ok\")"}}\n```'}}]}));return; }
    if (req.url.startsWith('/auth/v1/token?grant_type=password')) { const credentials=JSON.parse(raw);res.end(JSON.stringify(credentials.password==='correct-password'?{access_token:'mock-access-token',token_type:'bearer',user:{id:'11111111-1111-4111-8111-111111111111'}}:(res.statusCode=400,{code:'invalid_credentials',msg:'Invalid login credentials'})));return; }
    if (req.url.startsWith('/auth/v1/signup?')) { lastSignupRedirect=new URL(req.url,'http://mock-supabase.test').searchParams.get('redirect_to');res.end(JSON.stringify({id:'11111111-1111-4111-8111-111111111111',email:'learner@example.test'}));return; }
    if (req.url==='/auth/v1/resend') { res.end(JSON.stringify({}));return; }
    if (req.url.startsWith('/rest/v1/projects')) {
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
  app=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(appPort),NODE_ENV:'test',SUPABASE_URL:`http://127.0.0.1:${mockPort}`,SUPABASE_ANON_KEY:'test-publishable-key',APP_URL:'http://127.0.0.1:4173',MODEL_API_KEY:'mock-model-key',MODEL_API_URL:`http://127.0.0.1:${mockPort}/v1/chat/completions`,MODEL_NAME:'test-model'},stdio:'ignore'});
  await ready(`http://127.0.0.1:${appPort}/api/health`,app);
});
after(async()=>{app?.kill();if(mockDb)await new Promise(resolve=>mockDb.close(resolve));});

test('serves the app and reports API health',async()=>{
  const page=await fetch(`http://127.0.0.1:${appPort}/`);assert.equal(page.status,200);const html=await page.text();assert.match(html,/BackendDev/);assert.match(html,/Build my project/);assert.match(html,/What happens when someone uses your app/);assert.match(html,/id="closeProject"/);assert.match(html,/type="module" src="app.js"/);
  const script=await (await fetch(`http://127.0.0.1:${appPort}/app.js`)).text(),ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));for(const [,id] of script.matchAll(/querySelector\(['"]#([\w-]+)/g))assert.ok(ids.has(id),`app.js refers to missing #${id}`);
  assert.match(script,/querySelector\('#newProject'\)\.addEventListener/);assert.match(script,/querySelector\('#accountButton'\)\.addEventListener/);assert.match(script,/querySelector\('#authForm'\)\.addEventListener/);assert.match(script,/openAuthDialog\(\)/);assert.match(script,/session expired\/i/);assert.match(script,/applyTheme/);assert.match(script,/if\(!accessToken\)projects=\[\];renderProjects\(\);renderActivity\(\);syncProjects\(\);/);assert.match(html,/id="accessStatus"/);assert.match(html,/if \(location\.protocol === 'file:'\)/);assert.match(html,/id="themeToggle"/);assert.match(html,/id="authThemeToggle"/);assert.match(html,/auth-access-note/);
  const css=await (await fetch(`http://127.0.0.1:${appPort}/styles.css`)).text();assert.match(css,/body\{font-size:16px/);assert.match(css,/\.learning-steps/);assert.match(css,/body\[data-theme="light"\]/);
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
test('sign-in and signup endpoints reach Supabase and use the app origin locally',async()=>{
  const signin=await fetch(`http://127.0.0.1:${appPort}/api/auth/signin`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'learner@example.test',password:'correct-password'})});assert.equal(signin.status,200);assert.equal((await signin.json()).access_token,'mock-access-token');
  const failed=await fetch(`http://127.0.0.1:${appPort}/api/auth/signin`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'learner@example.test',password:'wrong-password'})});assert.equal(failed.status,400);assert.match((await failed.json()).msg,/Invalid login credentials/);
  const signup=await fetch(`http://127.0.0.1:${appPort}/api/auth/signup`,{method:'POST',headers:{'content-type':'application/json',origin:`http://127.0.0.1:${appPort}`},body:JSON.stringify({email:'learner@example.test',password:'correct-password'})});assert.equal(signup.status,200);assert.equal(lastSignupRedirect,`http://127.0.0.1:${appPort}`);
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
  const port=await freePort(),child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),NODE_ENV:'production',SUPABASE_URL:'https://supabase.example.test',SUPABASE_ANON_KEY:'test-publishable-key',APP_URL:'',RENDER_EXTERNAL_URL:'https://backenddev.example.onrender.com'},stdio:'ignore'});
  try{await ready(`http://127.0.0.1:${port}/api/health`,child);const health=await(await fetch(`http://127.0.0.1:${port}/api/health`)).json();assert.equal(health.multiUserReady,true)}finally{child.kill()}
});
