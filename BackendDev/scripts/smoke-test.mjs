import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import net from 'node:net';

const root = new URL('../', import.meta.url);
let app, mockDb, appPort, mockPort;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function ready(url, child) { for (let i=0;i<80;i++) { if (child.exitCode!==null) throw Error('BackendDev process exited before it was ready'); try { const r=await fetch(url); if(r.ok)return; } catch {} await wait(100); } throw Error('BackendDev did not start in time'); }

before(async () => {
  mockPort = await freePort();
  mockDb = http.createServer(async (req, res) => {
    let raw=''; for await (const chunk of req) raw += chunk;
    res.setHeader('content-type','application/json');
    if (req.url === '/auth/v1/user') { res.end(JSON.stringify({id:'11111111-1111-4111-8111-111111111111'})); return; }
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
  app=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(appPort),NODE_ENV:'test',SUPABASE_URL:`http://127.0.0.1:${mockPort}`,SUPABASE_ANON_KEY:'test-publishable-key',APP_URL:''},stdio:'ignore'});
  await ready(`http://127.0.0.1:${appPort}/api/health`,app);
});
after(async()=>{app?.kill();if(mockDb)await new Promise(resolve=>mockDb.close(resolve));});

test('serves the app and reports API health',async()=>{
  const page=await fetch(`http://127.0.0.1:${appPort}/`);assert.equal(page.status,200);assert.match(await page.text(),/BackendDev/);
  const health=await (await fetch(`http://127.0.0.1:${appPort}/api/health`)).json();assert.equal(health.status,'ok');
});
test('creates and updates projects using only real Supabase columns',async()=>{
  const headers={'content-type':'application/json',authorization:'Bearer test-token'};
  const payload={name:'Store API',language:'Python',framework:'Standard library',description:'Manage products and orders',status:'Draft',files:{'main.py':'print("ok")'},updated:'Created just now'};
  const created=await fetch(`http://127.0.0.1:${appPort}/api/projects`,{method:'POST',headers,body:JSON.stringify(payload)});
  assert.equal(created.status,201);const project=await created.json();assert.ok(project.updated_at);assert.equal(project.description,payload.description);
  const updated=await fetch(`http://127.0.0.1:${appPort}/api/projects/${project.id}`,{method:'PUT',headers,body:JSON.stringify({files:{'main.py':'print("changed")'},updated:'just now'})});
  assert.equal(updated.status,200);assert.ok((await updated.json()).updated_at);
});
test('production mode refuses to execute user code',async()=>{
  const port=await freePort(),child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),NODE_ENV:'production',SUPABASE_URL:'',SUPABASE_ANON_KEY:'',APP_URL:''},stdio:'ignore'});
  try { await ready(`http://127.0.0.1:${port}/api/health`,child);const result=await fetch(`http://127.0.0.1:${port}/api/run`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({language:'python',files:{'main.py':'print(1)'}})});assert.equal(result.status,503);assert.match((await result.json()).error,/secure isolated runner/); }
  finally { child.kill(); }
});
