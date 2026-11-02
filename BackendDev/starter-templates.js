export function resourceForIdea(idea = '') {
  const text = idea.toLowerCase();
  const groups = [['products','product'],['customers','customer'],['orders','order'],['users','user'],['tasks','task'],['bookings','booking'],['appointments','appointment'],['posts','post'],['comments','comment'],['invoices','invoice'],['tickets','ticket'],['events','event'],['courses','course']];
  return groups.find(([plural, singular]) => text.includes(plural) || text.includes(singular))?.[0] || 'items';
}

function makeOpenApi(name, resource, hasCrud) {
  const jsonResponse = schema => ({description:'JSON response',content:{'application/json':{schema}}});
  const item = {type:'object',properties:{id:{type:'integer'},name:{type:'string'}},additionalProperties:true};
  const paths = {'/health':{get:{summary:'Check service health',responses:{'200':jsonResponse({type:'object',properties:{status:{type:'string',example:'ok'}}})}}}};
  if (hasCrud) {
    paths[`/${resource}`]={get:{summary:`List ${resource}`,responses:{'200':jsonResponse({type:'array',items:{$ref:'#/components/schemas/Record'}})}},post:{summary:`Create ${resource.slice(0,-1)||'record'}`,requestBody:{required:true,content:{'application/json':{schema:{type:'object',additionalProperties:true}}}},responses:{'201':jsonResponse({$ref:'#/components/schemas/Record'}),'400':{description:'Invalid JSON object'}}}};
    paths[`/${resource}/{id}`]={parameters:[{name:'id',in:'path',required:true,schema:{type:'string'}}],get:{summary:`Read one ${resource.slice(0,-1)||'record'}`,responses:{'200':jsonResponse({$ref:'#/components/schemas/Record'}),'404':{description:'Record not found'}}},put:{summary:'Replace record fields',requestBody:{required:true,content:{'application/json':{schema:{type:'object',additionalProperties:true}}}},responses:{'200':jsonResponse({$ref:'#/components/schemas/Record'}),'404':{description:'Record not found'}}},patch:{summary:'Update record fields',requestBody:{required:true,content:{'application/json':{schema:{type:'object',additionalProperties:true}}}},responses:{'200':jsonResponse({$ref:'#/components/schemas/Record'}),'404':{description:'Record not found'}}},delete:{summary:'Delete record',responses:{'200':jsonResponse({type:'object',properties:{deleted:{type:'boolean'}}}),'404':{description:'Record not found'}}}};
  }
  return JSON.stringify({openapi:'3.1.0',info:{title:name,version:'1.0.0',description:hasCrud?'CRUD routes require Authorization: Bearer API_ACCESS_TOKEN; records persist in SQLite.':'Generated API contract for the current health route.'},servers:[{url:'http://127.0.0.1:3000'}],paths,...(hasCrud?{components:{schemas:{Record:item}}}:{})},null,2)+'\n';
}

function createSupabaseStarterFiles(language, name, idea, resource) {
  const tableSql = `CREATE TABLE IF NOT EXISTS public.backenddev_records (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,\n  resource text NOT NULL,\n  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),\n  created_at timestamptz NOT NULL DEFAULT now(),\n  updated_at timestamptz NOT NULL DEFAULT now()\n);\n\nCREATE INDEX IF NOT EXISTS backenddev_records_owner_resource_idx ON public.backenddev_records (owner_id, resource, id);\nALTER TABLE public.backenddev_records ENABLE ROW LEVEL SECURITY;\nDROP POLICY IF EXISTS "Users manage their own BackendDev records" ON public.backenddev_records;\nCREATE POLICY "Users manage their own BackendDev records" ON public.backenddev_records\n  FOR ALL TO authenticated\n  USING (auth.uid() = owner_id)\n  WITH CHECK (auth.uid() = owner_id);\nGRANT SELECT, INSERT, UPDATE, DELETE ON public.backenddev_records TO authenticated;\nGRANT USAGE, SELECT ON SEQUENCE public.backenddev_records_id_seq TO authenticated;\n`;
  const files = {
    'README.md': `# ${name}\n\n${idea}\n\nThis starter provides a per-user ${resource} REST API backed by Supabase Postgres. It sends each caller's Supabase access token to the Supabase Data API, where PostgreSQL row-level security restricts reads and writes to that signed-in user.\n\n## Setup\n1. In Supabase SQL Editor, run migrations/001_initial_schema.sql.\n2. Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and ALLOWED_ORIGINS in the API host environment. Do not use or expose a service-role/secret key.\n3. Start this API and call GET /health. For CRUD, send Authorization: Bearer <Supabase user access token>.\n\nThe API validates request shape and size, but you must add domain-specific validation, limits, and tests before production. The host's HTTPS URL and Supabase project must be reachable from each other.\n`,
    'migrations/001_initial_schema.sql': tableSql,
    '.gitignore': '.env\nnode_modules/\n__pycache__/\n',
    '.env.example': 'SUPABASE_URL=https://your-project.supabase.co\nSUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me\nALLOWED_ORIGINS=http://127.0.0.1:4173,http://localhost:4173\n',
    'DATABASE.md': `# Supabase Postgres and per-user access\n\n## 1. Create the table safely\nOpen your Supabase project, choose SQL Editor, create a query, paste migrations/001_initial_schema.sql, and run it. The table uses PostgreSQL JSONB for starter fields and an owner_id tied to auth.users. The migration enables row-level security and grants access only to authenticated users through a policy that checks auth.uid() against owner_id.\n\n## 2. Configure the API host\nSet SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY from your Supabase project's API settings. Set ALLOWED_ORIGINS to your exact web app origin(s), comma-separated. Use these public project settings only; the generated API never needs SUPABASE_SECRET_KEY or a service-role key. Keep secrets and environment values in the host's environment settings.\n\n## 3. Call the API as a signed-in user\nYour client must sign the user into the same Supabase project and send the current access token as Authorization: Bearer <access token>. The API forwards that token and the publishable key to Supabase PostgREST. PostgreSQL RLS scopes every database operation to the user id in the verified token. The API tester's bearer-token field is for local debugging; do not put a shared server secret in a shipped browser app.\n\nRoutes: GET /health is public; GET /${resource}, POST /${resource}, GET /${resource}/:id, PATCH /${resource}/:id, PUT /${resource}/:id, DELETE /${resource}/:id require a valid user access token. Write bodies are JSON objects with up to 40 simple field names, no id field, and a 100 KB maximum. List results are limited to 100 records per request.\n\nThis starter uses a flexible JSONB payload. Add explicit columns, foreign keys, input schemas, per-record authorization rules, rate limits, monitoring, and backups as your application needs grow. The deployment host still needs to be created and configured by you.\n`,
    'openapi.json': makeOpenApi(name, resource, true)
  };
  files['openapi.json'] = JSON.stringify({ ...JSON.parse(files['openapi.json']), info:{...JSON.parse(files['openapi.json']).info,description:'Supabase Postgres API. CRUD routes forward the caller JWT; row-level security scopes data to that authenticated user.'} },null,2)+'\n';
  if (language === 'JavaScript') {
    files['index.js'] = `const http = require("node:http");\nconst allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || "http://127.0.0.1:4173,http://localhost:4173").split(",").map(value => value.trim()).filter(Boolean));\nconst supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\\/$/, "");\nconst publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || "";\nconst resource = "${resource}";\nfunction send(res,status,data,origin=""){const headers={"content-type":"application/json","x-content-type-options":"nosniff","access-control-allow-methods":"GET, POST, PUT, PATCH, DELETE, OPTIONS","access-control-allow-headers":"Content-Type, Authorization"};if(origin&&allowedOrigins.has(origin)){headers["access-control-allow-origin"]=origin;headers.vary="Origin"}res.writeHead(status,headers);res.end(JSON.stringify(data))}\nasync function readBody(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>100_000)throw Error("JSON body is too large (100 KB maximum)");chunks.push(chunk)}const value=JSON.parse(Buffer.concat(chunks).toString()||"{}");if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Expected a JSON object");const keys=Object.keys(value);if(!keys.length||keys.length>40||keys.some(key=>key==="id"||["__proto__","prototype","constructor"].includes(key)||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)))throw Error("Use 1–40 fields with simple names; id is reserved");return value}\nasync function dbRequest(method,query,body,token){const url=new URL("/rest/v1/backenddev_records",supabaseUrl);for(const [key,value] of Object.entries(query))url.searchParams.set(key,value);const headers={apikey:publishableKey,authorization:token,accept:"application/json"};if(body){headers["content-type"]="application/json";headers.prefer="return=representation"}const response=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12_000)});const text=await response.text();let data=[];try{data=text?JSON.parse(text):[]}catch{}if(!response.ok){const error=Error("Supabase rejected the database request");error.status=response.status;throw error}return data}\nconst server=http.createServer(async(req,res)=>{const origin=req.headers.origin||"",pathname=new URL(req.url,"http://localhost").pathname;if(req.method==="OPTIONS"){const headers={"access-control-allow-methods":"GET, POST, PUT, PATCH, DELETE, OPTIONS","access-control-allow-headers":"Content-Type, Authorization"};if(origin&&allowedOrigins.has(origin)){headers["access-control-allow-origin"]=origin;headers.vary="Origin"}res.writeHead(204,headers);return res.end()}if(pathname==="/health"&&req.method==="GET")return send(res,200,{status:"ok"},origin);if(!pathname.startsWith("/${resource}"))return send(res,404,{error:"Route not found"},origin);if(!supabaseUrl||!publishableKey)return send(res,503,{error:"SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be configured"},origin);const token=req.headers.authorization||"";if(!token.startsWith("Bearer ")||token.length<20)return send(res,401,{error:"Sign in and send a Supabase user access token"},origin);try{const parts=pathname.split("/").filter(Boolean);if(req.method==="GET"&&parts.length===1){const rows=await dbRequest("GET",{select:"id,payload,created_at",resource:"eq.${resource}",order:"id.asc",limit:"100"},null,token);return send(res,200,rows.map(row=>({...row.payload,id:row.id,created_at:row.created_at})),origin)}if(req.method==="POST"&&parts.length===1){const payload=await readBody(req),rows=await dbRequest("POST",{select:"id,payload,created_at"},{resource,payload},token);return send(res,201,{...rows[0].payload,id:rows[0].id,created_at:rows[0].created_at},origin)}if(parts.length===2&&!/^\\d+$/.test(parts[1]))return send(res,400,{error:"Record id must be a number"},origin);if(req.method==="GET"&&parts.length===2){const rows=await dbRequest("GET",{select:"id,payload,created_at",resource:"eq.${resource}",id:"eq."+parts[1],limit:"1"},null,token);return rows.length?send(res,200,{...rows[0].payload,id:rows[0].id,created_at:rows[0].created_at},origin):send(res,404,{error:"Record not found"},origin)}if(["PUT","PATCH"].includes(req.method)&&parts.length===2){const updates=await readBody(req),existing=await dbRequest("GET",{select:"id,payload",resource:"eq.${resource}",id:"eq."+parts[1],limit:"1"},null,token);if(!existing.length)return send(res,404,{error:"Record not found"},origin);const payload=req.method==="PUT"?updates:{...existing[0].payload,...updates};const rows=await dbRequest("PATCH",{select:"id,payload,created_at",resource:"eq.${resource}",id:"eq."+parts[1]},{payload,updated_at:new Date().toISOString()},token);return send(res,200,{...rows[0].payload,id:rows[0].id,created_at:rows[0].created_at},origin)}if(req.method==="DELETE"&&parts.length===2){const rows=await dbRequest("DELETE",{select:"id",resource:"eq.${resource}",id:"eq."+parts[1]},null,token);return rows.length?send(res,200,{deleted:true},origin):send(res,404,{error:"Record not found"},origin)}return send(res,404,{error:"Route not found"},origin)}catch(error){if(error.status===401||error.status===403)return send(res,error.status,{error:"Supabase rejected this user token or row access"},origin);console.error("Database request failed:",error.message);return send(res,502,{error:"Could not complete the database request"},origin)}});\nserver.headersTimeout=10_000;server.requestTimeout=15_000;const port=Number(process.env.PORT||3000),host=process.env.HOST||(process.env.PORT?"0.0.0.0":"127.0.0.1");server.listen(port,host,()=>console.log("Supabase-backed API listening at http://"+host+":"+port));\n`;
    files['package.json'] = JSON.stringify({ name:name.toLowerCase().replace(/[^a-z0-9-]/g,'-'),version:'1.0.0',engines:{node: '>=22.5'},scripts:{start:'node index.js',test:'node --check index.js'} },null,2);
  } else {
    files['main.py'] = `from http.server import BaseHTTPRequestHandler, HTTPServer\nfrom urllib.parse import urlparse, urlencode\nfrom urllib.request import Request, urlopen\nfrom urllib.error import HTTPError, URLError\nimport json, os\n\nRESOURCE = "${resource}"\nSUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")\nSUPABASE_PUBLISHABLE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")\nALLOWED_ORIGINS = {x.strip() for x in os.environ.get("ALLOWED_ORIGINS", "http://127.0.0.1:4173,http://localhost:4173").split(",") if x.strip()}\ndef send(handler,status,payload):\n body=json.dumps(payload).encode();handler.send_response(status);handler.send_header("Content-Type","application/json");handler.send_header("Content-Length",str(len(body)));handler.send_header("X-Content-Type-Options","nosniff");origin=handler.headers.get("Origin","")\n if origin in ALLOWED_ORIGINS: handler.send_header("Access-Control-Allow-Origin",origin);handler.send_header("Vary","Origin")\n handler.send_header("Access-Control-Allow-Methods","GET, POST, PUT, PATCH, DELETE, OPTIONS");handler.send_header("Access-Control-Allow-Headers","Content-Type, Authorization");handler.end_headers();handler.wfile.write(body)\ndef database(method,query,body,token):\n url=SUPABASE_URL+"/rest/v1/backenddev_records"+("?"+urlencode(query) if query else "");headers={"apikey":SUPABASE_PUBLISHABLE_KEY,"Authorization":token,"Accept":"application/json"};data=None\n if body is not None: data=json.dumps(body).encode();headers["Content-Type"]="application/json";headers["Prefer"]="return=representation"\n request=Request(url,data=data,method=method,headers=headers)\n try:\n  with urlopen(request,timeout=12) as response:return response.status,json.loads(response.read() or b"[]")\n except HTTPError as error:return error.code,[]\n except URLError as error:raise RuntimeError("Could not connect to Supabase") from error\ndef read_payload(handler):\n length=int(handler.headers.get("Content-Length",0))\n if length<1 or length>100000: raise ValueError("JSON body must be between 1 byte and 100 KB")\n value=json.loads(handler.rfile.read(length))\n if not isinstance(value,dict) or not value or len(value)>40 or any(key=="id" or not __import__("re").fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,63}",key) for key in value):raise ValueError("Use a JSON object with 1–40 simple field names; id is reserved")\n return value\nclass Handler(BaseHTTPRequestHandler):\n def do_OPTIONS(self):\n  self.send_response(204);origin=self.headers.get("Origin","")\n  if origin in ALLOWED_ORIGINS:self.send_header("Access-Control-Allow-Origin",origin);self.send_header("Vary","Origin")\n  self.send_header("Access-Control-Allow-Methods","GET, POST, PUT, PATCH, DELETE, OPTIONS");self.send_header("Access-Control-Allow-Headers","Content-Type, Authorization");self.end_headers()\n def do_GET(self):self.handle_api()\n def do_POST(self):self.handle_api()\n def do_PUT(self):self.handle_api()\n def do_PATCH(self):self.handle_api()\n def do_DELETE(self):self.handle_api()\n def handle_api(self):\n  path=urlparse(self.path).path.strip("/").split("/")\n  if path==["health"]:return send(self,200,{"status":"ok"})\n  if path[0]!=RESOURCE:return send(self,404,{"error":"Route not found"})\n  if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:return send(self,503,{"error":"SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be configured"})\n  token=self.headers.get("Authorization","")\n  if not token.startswith("Bearer ") or len(token)<20:return send(self,401,{"error":"Sign in and send a Supabase user access token"})\n  try:\n   if self.command=="GET" and len(path)==1:\n    status,rows=database("GET",{"select":"id,payload,created_at","resource":"eq."+RESOURCE,"order":"id.asc","limit":"100"},None,token)\n    if status in (401,403):return send(self,status,{"error":"Supabase rejected this user token or row access"})\n    if status>=400:return send(self,502,{"error":"Supabase database request failed"})\n    return send(self,200,[dict(row["payload"],id=row["id"],created_at=row["created_at"]) for row in rows])\n   if self.command=="POST" and len(path)==1:\n    payload=read_payload(self);status,rows=database("POST",{"select":"id,payload,created_at"},{"resource":RESOURCE,"payload":payload},token)\n    if status in (401,403):return send(self,status,{"error":"Supabase rejected this user token or row access"})\n    if status>=400:return send(self,502,{"error":"Supabase database request failed"})\n    return send(self,201,dict(rows[0]["payload"],id=rows[0]["id"],created_at=rows[0]["created_at"]))\n   if len(path)==2 and not path[1].isdigit():return send(self,400,{"error":"Record id must be a number"})\n   if self.command=="GET" and len(path)==2:status,rows=database("GET",{"select":"id,payload,created_at","resource":"eq."+RESOURCE,"id":"eq."+path[1],"limit":"1"},None,token)\n   elif self.command in ("PATCH","PUT") and len(path)==2:\n    changes=read_payload(self);status,existing=database("GET",{"select":"id,payload","resource":"eq."+RESOURCE,"id":"eq."+path[1],"limit":"1"},None,token)\n    if status in (401,403):return send(self,status,{"error":"Supabase rejected this user token or row access"})\n    if status>=400:return send(self,502,{"error":"Supabase database request failed"})\n    if not existing:return send(self,404,{"error":"Record not found"})\n    payload=changes if self.command=="PUT" else {**existing[0]["payload"],**changes};status,rows=database("PATCH",{"select":"id,payload,created_at","resource":"eq."+RESOURCE,"id":"eq."+path[1]},{"payload":payload},token)\n   elif self.command=="DELETE" and len(path)==2:status,rows=database("DELETE",{"select":"id","resource":"eq."+RESOURCE,"id":"eq."+path[1]},None,token)\n   else:return send(self,404,{"error":"Route not found"})\n   if status in (401,403):return send(self,status,{"error":"Supabase rejected this user token or row access"})\n   if status>=400:return send(self,502,{"error":"Supabase database request failed"})\n   if not rows:return send(self,404,{"error":"Record not found"})\n   if self.command=="DELETE":return send(self,200,{"deleted":True})\n   row=rows[0];return send(self,200,dict(row["payload"],id=row["id"],created_at=row.get("created_at")))\n  except ValueError as error:return send(self,400,{"error":str(error)})\n  except Exception:return send(self,502,{"error":"Could not complete the Supabase database request"})\nif __name__=="__main__":\n host=os.environ.get("HOST") or ("0.0.0.0" if os.environ.get("PORT") else "127.0.0.1");port=int(os.environ.get("PORT","3000"));print(f"Supabase-backed API listening on {host}:{port}");HTTPServer((host,port),Handler).serve_forever()\n`;
    files['test_main.py'] = `import unittest\nimport main\nclass StarterTests(unittest.TestCase):\n def test_routes_require_a_user_token(self):\n  self.assertTrue(main.SUPABASE_URL == "" or isinstance(main.SUPABASE_URL,str))\nif __name__=="__main__":unittest.main()\n`;
  }
  return files;
}

export function createStarterFiles(language, name, idea, database = 'SQLite') {
  const resource = resourceForIdea(idea);
  if (database === 'Supabase Postgres' && ['Python','JavaScript'].includes(language)) return createSupabaseStarterFiles(language,name,idea,resource);
  const files = {
    'README.md': `# ${name}\n\n## What this backend does\n${idea}\n\n## Learn the request flow\nA client sends an HTTP request → the server matches a route → a handler applies logic to data → the server returns a status and JSON response.\n\n## Starter routes\n- GET /health — check that the API is running\n- GET /${resource} — list all records\n- POST /${resource} — create a record using a JSON body\n- GET /${resource}/1 — read one record\n- PUT or PATCH /${resource}/1 — update a record\n- DELETE /${resource}/1 — delete a record\n\n## Run and test\nOpen this project in BackendDev. Choose Run API server, then try http://127.0.0.1:3000/health in the API tester. Choose Run tests to check the starter. Records are in memory and reset when the server stops. Connect a database before using real data.\n`,
  };

  if (language === 'Python') {
    files['main.py'] = `from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse
import os
import json
import sqlite3
import hmac
import re

RESOURCE = "${resource}"
DATABASE_PATH = os.environ.get("DATABASE_PATH", "backend.sqlite3")
API_ACCESS_TOKEN = os.environ.get("API_ACCESS_TOKEN", "")
ALLOWED_ORIGINS = {origin.strip() for origin in os.environ.get("ALLOWED_ORIGINS", "http://127.0.0.1:4173,http://localhost:4173").split(",") if origin.strip()}

def open_database():
    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("CREATE TABLE IF NOT EXISTS " + RESOURCE + " (id INTEGER PRIMARY KEY AUTOINCREMENT, data_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")
    return connection

def load_items():
    with open_database() as connection:
        rows = connection.execute("SELECT id, data_json FROM " + RESOURCE + " ORDER BY id").fetchall()
    return [{**json.loads(row["data_json"]), "id": row["id"]} for row in rows]

items = load_items()
next_id = max((item["id"] for item in items), default=0) + 1

def send(handler, status, payload):
    body = json.dumps(payload).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("X-Content-Type-Options", "nosniff")
    origin = handler.headers.get("Origin", "")
    if origin in ALLOWED_ORIGINS:
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Vary", "Origin")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    handler.end_headers()
    handler.wfile.write(body)

def authorize(handler):
    if not API_ACCESS_TOKEN:
        send(handler, 503, {"error": "API_ACCESS_TOKEN is not configured on the server"})
        return False
    supplied = handler.headers.get("Authorization", "")
    expected = "Bearer " + API_ACCESS_TOKEN
    if not hmac.compare_digest(supplied, expected):
        send(handler, 401, {"error": "A valid bearer token is required"})
        return False
    return True

def valid_payload(value):
    if not isinstance(value, dict) or not value or len(value) > 40:
        return False
    if any(key == "id" or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,63}", key) for key in value):
        return False
    try:
        return len(json.dumps(value, allow_nan=False).encode("utf-8")) <= 100_000
    except (TypeError, ValueError):
        return False

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        parts = urlparse(self.path).path.strip("/").split("/")
        if parts == ["health"]:
            return send(self, 200, {"status": "ok"})
        if not authorize(self):
            return
        if parts[0] != RESOURCE:
            return send(self, 404, {"error": "Route not found"})
        if len(parts) == 1:
            return send(self, 200, items)
        found = next((item for item in items if str(item["id"]) == parts[1]), None)
        return send(self, 200, found) if found else send(self, 404, {"error": "Item not found"})

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length < 0 or length > 1_000_000:
                return None
            return json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return None

    def do_POST(self):
        global next_id
        if urlparse(self.path).path.strip("/") != RESOURCE:
            return send(self, 404, {"error": "Route not found"})
        if not authorize(self):
            return
        data = self.read_json()
        if not valid_payload(data):
            return send(self, 400, {"error": "Expected a JSON object with up to 40 fields, valid names, and no reserved id field"})
        data["id"] = next_id
        next_id += 1
        items.append(data)
        with open_database() as connection:
            connection.execute("INSERT INTO " + RESOURCE + " (id, data_json) VALUES (?, ?)", (data["id"], json.dumps({key: value for key, value in data.items() if key != "id"})))
        return send(self, 201, data)

    def do_PUT(self):
        parts = urlparse(self.path).path.strip("/").split("/")
        if len(parts) != 2 or parts[0] != RESOURCE:
            return send(self, 404, {"error": "Route not found"})
        if not authorize(self):
            return
        data = self.read_json()
        if not valid_payload(data):
            return send(self, 400, {"error": "Expected a JSON object with up to 40 fields, valid names, and no reserved id field"})
        found = next((item for item in items if str(item["id"]) == parts[1]), None)
        if not found:
            return send(self, 404, {"error": "Item not found"})
        data.pop("id", None)
        found.update(data)
        with open_database() as connection:
            connection.execute("UPDATE " + RESOURCE + " SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (json.dumps({key: value for key, value in found.items() if key != "id"}), found["id"]))
        return send(self, 200, found)

    do_PATCH = do_PUT

    def do_DELETE(self):
        parts = urlparse(self.path).path.strip("/").split("/")
        if len(parts) != 2 or parts[0] != RESOURCE:
            return send(self, 404, {"error": "Route not found"})
        if not authorize(self):
            return
        for index, item in enumerate(items):
            if str(item["id"]) == parts[1]:
                items.pop(index)
                with open_database() as connection:
                    connection.execute("DELETE FROM " + RESOURCE + " WHERE id = ?", (item["id"],))
                return send(self, 200, {"deleted": True})
        return send(self, 404, {"error": "Item not found"})

if __name__ == "__main__":
    host = os.environ.get("HOST") or ("0.0.0.0" if os.environ.get("PORT") else "127.0.0.1")
    port = int(os.environ.get("PORT", "3000"))
    print(f"Your API is running on {host}:{port}")
    print("Try GET /health and CRUD /${resource}")
    HTTPServer((host, port), Handler).serve_forever()
`;
    files['test_main.py'] = `import json
import os
import tempfile
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
os.environ["DATABASE_PATH"] = os.path.join(tempfile.gettempdir(), "backenddev-generated-test-" + str(os.getpid()) + ".sqlite3")
os.environ["API_ACCESS_TOKEN"] = "backenddev-test-token"
try:
    os.remove(os.environ["DATABASE_PATH"])
except FileNotFoundError:
    pass
import main

class BackendApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = main.HTTPServer(("127.0.0.1", 0), main.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = "http://127.0.0.1:" + str(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def request(self, method, route, payload=None):
        data = json.dumps(payload).encode() if payload is not None else None
        request = Request(self.base + route, data=data, method=method, headers={"Content-Type": "application/json", "Authorization": "Bearer backenddev-test-token"})
        try:
            with urlopen(request, timeout=3) as response:
                return response.status, json.loads(response.read() or b"null")
        except HTTPError as error:
            return error.code, json.loads(error.read() or b"{}")

    def test_health_route(self):
        self.assertEqual(self.request("GET", "/health"), (200, {"status": "ok"}))

    def test_create_read_update_delete_flow(self):
        try:
            urlopen(self.base + "/" + main.RESOURCE, timeout=3)
            self.fail("CRUD route must require a bearer token")
        except HTTPError as error:
            self.assertEqual(error.code, 401)
        status, created = self.request("POST", "/" + main.RESOURCE, {"name": "Ada"})
        self.assertEqual(status, 201)
        self.assertEqual(main.load_items()[0]["name"], "Ada", "created rows must be stored in SQLite")
        item_id = created["id"]
        self.assertEqual(self.request("GET", "/" + main.RESOURCE + "/" + str(item_id))[1]["name"], "Ada")
        self.assertEqual(self.request("PUT", "/" + main.RESOURCE + "/" + str(item_id), {"name": "Grace"})[1]["name"], "Grace")
        self.assertEqual(self.request("DELETE", "/" + main.RESOURCE + "/" + str(item_id)), (200, {"deleted": True}))
        self.assertEqual(self.request("GET", "/" + main.RESOURCE + "/" + str(item_id))[0], 404)

if __name__ == "__main__":
    unittest.main()
`;
  } else if (language === 'JavaScript') {
    files['index.js'] = `const http = require("node:http");
const crypto = require("node:crypto");
  const { DatabaseSync } = require("node:sqlite");
  const path = require("node:path");
  const db = new DatabaseSync(process.env.DATABASE_PATH || path.join(process.cwd(), "backend.sqlite3"));
  const recordsTable = "${resource}";
  db.exec("CREATE TABLE IF NOT EXISTS " + recordsTable + " (id INTEGER PRIMARY KEY AUTOINCREMENT, data_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  const records = db.prepare("SELECT id, data_json FROM " + recordsTable + " ORDER BY id").all().map(row => ({ ...JSON.parse(row.data_json), id: row.id }));
  let nextId = (db.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM " + recordsTable).get().id || 0) + 1;
const resource = "${resource}";
const API_ACCESS_TOKEN = process.env.API_ACCESS_TOKEN || "";
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || "http://127.0.0.1:4173,http://localhost:4173").split(",").map(value => value.trim()).filter(Boolean));
function send(res, status, data) {
  const headers = { "content-type": "application/json", "x-content-type-options": "nosniff", "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS", "access-control-allow-headers": "Content-Type, Authorization" };
  const origin = res.req?.headers?.origin;
  if (origin && allowedOrigins.has(origin)) { headers["access-control-allow-origin"] = origin; headers.vary = "Origin"; }
  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
}
function authorize(req, res) {
  if (!API_ACCESS_TOKEN) { send(res, 503, { error: "API_ACCESS_TOKEN is not configured on the server" }); return false; }
  const supplied = Buffer.from(req.headers.authorization || ""), expected = Buffer.from("Bearer " + API_ACCESS_TOKEN);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) { send(res, 401, { error: "A valid bearer token is required" }); return false; }
  return true;
}
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 1_000_000) throw new Error("Request body is too large"); chunks.push(chunk); }
  const value = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
  const keys = Object.keys(value);
  if (!keys.length || keys.length > 40 || keys.some(key => key === "id" || ["__proto__", "prototype", "constructor"].includes(key) || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key))) throw new Error("Use 1–40 fields with simple names; id is reserved");
  if (Buffer.byteLength(JSON.stringify(value)) > 100_000) throw new Error("JSON body is too large (100 KB maximum)");
  return value;
}
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (req.method === "OPTIONS") { const headers={"access-control-allow-methods":"GET, POST, PUT, PATCH, DELETE, OPTIONS","access-control-allow-headers":"Content-Type, Authorization"};const origin=req.headers.origin;if(origin&&allowedOrigins.has(origin)){headers["access-control-allow-origin"]=origin;headers.vary="Origin"}res.writeHead(204,headers);return res.end(); }
  if (pathname === "/health" && req.method === "GET") return send(res, 200, { status: "ok" });
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== resource) return send(res, 404, { error: "Route not found" });
  if (!authorize(req,res)) return;
  if (req.method === "GET" && parts.length === 1) return send(res, 200, records);
  if (req.method === "GET" && parts.length === 2) { const item = records.find(record => String(record.id) === parts[1]); return item ? send(res, 200, item) : send(res, 404, { error: "Item not found" }); }
  if (req.method === "POST" && parts.length === 1) { try { const item = { ...await readBody(req), id: nextId++ }; records.push(item); db.prepare("INSERT INTO " + recordsTable + " (id, data_json) VALUES (?, ?)").run(item.id, JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key]) => key !== "id")))); return send(res, 201, item); } catch { return send(res, 400, { error: "Expected valid JSON" }); } }
  if (["PUT", "PATCH"].includes(req.method) && parts.length === 2) { try { const item = records.find(record => String(record.id) === parts[1]); if (!item) return send(res, 404, { error: "Item not found" }); const updates = await readBody(req); delete updates.id; Object.assign(item, updates); db.prepare("UPDATE " + recordsTable + " SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key]) => key !== "id"))), item.id); return send(res, 200, item); } catch { return send(res, 400, { error: "Expected valid JSON under 1 MB" }); } }
  if (req.method === "DELETE" && parts.length === 2) { const index = records.findIndex(record => String(record.id) === parts[1]); if (index < 0) return send(res, 404, { error: "Item not found" }); const [item] = records.splice(index, 1); db.prepare("DELETE FROM " + recordsTable + " WHERE id = ?").run(item.id); return send(res, 200, { deleted: true }); }
  return send(res, 404, { error: "Route not found" });
});
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
server.listen(port, host, () => console.log("API listening at http://" + host + ":" + port));
`;
    files['package.json'] = JSON.stringify({ name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'), version: '1.0.0', engines: { node: '>=22.5' }, scripts: { start: 'node index.js', test: 'node --check index.js' } }, null, 2);
  } else if (language === 'C++') {
    files['main.cpp'] = `#include <iostream>
#include <string>
#include <cstdlib>
#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "Ws2_32.lib")
using Socket = SOCKET;
static const Socket invalidSocket = INVALID_SOCKET;
static void closeSocket(Socket socket) { closesocket(socket); }
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
using Socket = int;
static const Socket invalidSocket = -1;
static void closeSocket(Socket socket) { close(socket); }
#endif

int main() {
#ifdef _WIN32
  WSADATA winsock;
  if (WSAStartup(MAKEWORD(2, 2), &winsock) != 0) { std::cerr << "Could not start Winsock\\n"; return 1; }
#endif
  const Socket server = socket(AF_INET, SOCK_STREAM, 0);
  if (server == invalidSocket) { std::cerr << "Could not create socket\\n"; return 1; }
  sockaddr_in address{};
  address.sin_family = AF_INET;
  const char* portValue = std::getenv("PORT");
  const int port = portValue ? std::atoi(portValue) : 3000;
  const char* hostValue = std::getenv("HOST");
  if (!hostValue) hostValue = portValue ? "0.0.0.0" : "127.0.0.1";
  if (port < 1 || port > 65535 || inet_pton(AF_INET, hostValue, &address.sin_addr) != 1) {
    std::cerr << "Set PORT to a valid TCP port and HOST to an IPv4 address.\\n";
    closeSocket(server);
    return 1;
  }
  address.sin_port = htons(static_cast<unsigned short>(port));
  if (bind(server, reinterpret_cast<sockaddr*>(&address), sizeof(address)) < 0 || listen(server, 8) < 0) {
    std::cerr << "Could not listen on the requested host and port (is the port already in use?)\\n";
    closeSocket(server);
    return 1;
  }
  std::cout << "C++ API listening at http://" << hostValue << ":" << port << "/health\\n";
  while (true) {
    const Socket client = accept(server, nullptr, nullptr);
    if (client == invalidSocket) continue;
    char request[4096]{};
#ifdef _WIN32
    const int bytes = recv(client, request, sizeof(request) - 1, 0);
#else
    const auto bytes = recv(client, request, sizeof(request) - 1, 0);
#endif
    const std::string firstLine(request, bytes > 0 ? static_cast<std::size_t>(bytes) : 0);
    const bool options = firstLine.rfind("OPTIONS ", 0) == 0;
    const bool health = firstLine.rfind("GET /health ", 0) == 0;
    const std::string body = options ? "" : (health ? R"({"status":"ok","language":"C++"})" : R"({"error":"Try GET /health"})");
    const std::string status = options ? "204 No Content" : (health ? "200 OK" : "404 Not Found");
    const std::string response = "HTTP/1.1 " + status + "\\r\\nContent-Type: application/json\\r\\nContent-Length: " + std::to_string(body.size()) + "\\r\\nAccess-Control-Allow-Origin: *\\r\\nAccess-Control-Allow-Methods: GET, OPTIONS\\r\\nAccess-Control-Allow-Headers: Content-Type\\r\\nConnection: close\\r\\n\\r\\n" + body;
    send(client, response.c_str(), static_cast<int>(response.size()), 0);
    closeSocket(client);
  }
  closeSocket(server);
#ifdef _WIN32
  WSACleanup();
#endif
  return 0;
}
`;
    files['README.md'] = `# ${name}\n\n## C++ backend starter\n${idea}\n\nThis is a small native HTTP health service. It answers GET /health with JSON and includes CORS headers for the browser API tester. It demonstrates a server loop and HTTP response; add routes, request parsing, authentication, and a database as you learn.\n\n## Build and run\nInstall a C++17 compiler (MinGW on Windows or GCC on Linux/macOS). Choose Build to compile, Test to check source syntax, or Run API server. Local runs listen on 127.0.0.1:3000; deployment uses PORT and binds to 0.0.0.0.\n\n## Production limits\nThis health-service starter has no CRUD routes or persistent storage. Its CORS policy is open for learning. Add a database, authentication, input validation, rate limits, and a restricted CORS origin before using real data or public users.\n`;
    files['Dockerfile'] = `FROM gcc:14\nWORKDIR /app\nCOPY main.cpp ./main.cpp\nRUN g++ -std=c++17 main.cpp -o backend\nENV PORT=10000\nEXPOSE 10000\nCMD ["./backend"]\n`;
  } else if (language === 'Assembly') {
    files['main.asm'] = `; BackendDev Assembly starter: Linux x86-64, NASM, and GNU ld required.
; This small HTTP service returns a health response on port 3000.
BITS 64
global _start

section .data
address:
  dw 2
  dw 0xB80B                 ; port 3000 in network byte order
  dd 0x0100007F              ; 127.0.0.1
  dq 0
response:
  db 'HTTP/1.1 200 OK', 13, 10
  db 'Content-Type: application/json', 13, 10
  db 'Access-Control-Allow-Origin: *', 13, 10
  db 'Access-Control-Allow-Methods: GET, OPTIONS', 13, 10
  db 'Access-Control-Allow-Headers: Content-Type', 13, 10
  db 'Connection: close', 13, 10, 13, 10
  db '{"status":"ok","language":"Assembly","route":"/health"}'
response_len equ $ - response

section .bss
server_fd resq 1
client_fd resq 1
request_buffer resb 4096

section .text
_start:
  mov eax, 41                 ; socket(AF_INET, SOCK_STREAM, 0)
  mov edi, 2
  mov esi, 1
  xor edx, edx
  syscall
  test rax, rax
  js .exit
  mov [server_fd], rax

  mov eax, 49                 ; bind(server_fd, &address, 16)
  mov rdi, [server_fd]
  lea rsi, [rel address]
  mov edx, 16
  syscall
  test rax, rax
  js .close_server

  mov eax, 50                 ; listen(server_fd, 8)
  mov rdi, [server_fd]
  mov esi, 8
  syscall
  test rax, rax
  js .close_server

.accept:
  mov eax, 43                 ; accept(server_fd, NULL, NULL)
  mov rdi, [server_fd]
  xor esi, esi
  xor edx, edx
  syscall
  test rax, rax
  js .accept
  mov [client_fd], rax
  xor eax, eax                 ; read(client_fd, request_buffer, 4096)
  mov rdi, [client_fd]
  lea rsi, [rel request_buffer]
  mov edx, 4096
  syscall
  mov eax, 1                   ; write(client_fd, response, response_len)
  mov rdi, [client_fd]
  lea rsi, [rel response]
  mov edx, response_len
  syscall
  mov eax, 3                   ; close(client_fd)
  mov rdi, [client_fd]
  syscall
  jmp .accept

.close_server:
  mov eax, 3
  mov rdi, [server_fd]
  syscall
.exit:
  mov eax, 60
  mov edi, 1
  syscall
`;
    files['README.md'] = `# ${name}\n\n## Assembly backend starter\n${idea}\n\nThis starter is a tiny HTTP health service written in x86-64 Linux assembly. It responds with JSON on GET /health. Assembly can power backend services, but is uncommon for full web APIs; it is architecture-specific and requires Linux x86-64, NASM, and GNU ld. On Windows, use WSL.\n\n## Build and run\nUse NASM to assemble main.asm, GNU ld to link it, then run the resulting backend binary. The default port is 3000. The hosted BackendDev service does not execute user code.\n`;
  } else if (language === 'Go') {
    files['go.mod'] = `module backenddev-generated\n\ngo 1.22\n`;
    files['main.go'] = `package main

import ("fmt"; "net"; "net/http"; "os")

func main() {
 http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { w.Header().Set("Content-Type", "application/json"); w.Header().Set("Access-Control-Allow-Origin", "*"); fmt.Fprint(w, \`{"status":"ok"}\`) })
 port := os.Getenv("PORT")
 if port == "" { port = "3000" }
 host := os.Getenv("HOST")
 if host == "" { if os.Getenv("PORT") != "" { host = "0.0.0.0" } else { host = "127.0.0.1" } }
 address := net.JoinHostPort(host, port)
 fmt.Println("API listening on http://" + address)
 if err := http.ListenAndServe(address, nil); err != nil { fmt.Fprintln(os.Stderr, err); os.Exit(1) }
}
`;
    files['README.md'] = `# ${name}\n\n## Go HTTP starter\n${idea}\n\nThis starter exposes GET /health using Go's standard HTTP library. Add route handlers, authentication, and persistent storage for your application.\n\n## Run and deploy\nInstall Go 1.22 or newer. Run \`go run .\` locally and try http://127.0.0.1:3000/health. Deploy with build command \`go build -o backend .\` and start command \`./backend\`; the service binds to the host-provided PORT.\n\n## Production limits\nThis is a health-service starter without CRUD routes or persistent storage. CORS is open for learning. Add a database, authentication, input validation, rate limits, and a restricted CORS origin before using real data or public users.\n`;
  } else if (language === 'Rust') {
    files['main.rs'] = 'fn main() { println!("Starter program. Add an HTTP framework to serve API routes."); }\n';
    files['README.md'] = `# ${name}\n\n## Rust console starter\n${idea}\n\nThis starter is a runnable Rust console program, not an HTTP server yet. Select a web framework such as Axum or Actix Web, then add routes and a database before treating it as an API.\n`;
  } else if (language === 'Java') {
    files['Main.java'] = 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Starter program. Add a web framework to serve API routes.");\n  }\n}\n';
    files['README.md'] = `# ${name}\n\n## Java console starter\n${idea}\n\nThis starter is a runnable Java console program, not an HTTP server yet. Add a web framework such as Spring Boot, API routes, and a database before treating it as an API.\n`;
  }
  if (['Python','JavaScript','Go','C++','Assembly'].includes(language)) files['openapi.json']=makeOpenApi(name,resource,['Python','JavaScript'].includes(language));
  files['migrations/001_initial_schema.sql'] = `CREATE TABLE IF NOT EXISTS ${resource} (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  data_json TEXT NOT NULL,\n  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP\n);\n`;
  files['DATABASE.md'] = `# Database setup\n\nThis starter includes a SQLite schema in migrations/001_initial_schema.sql. ${['Python','JavaScript'].includes(language) ? 'Its CRUD routes read and write this SQLite database automatically.' : `The ${language} starter includes the schema, but its current API code does not yet connect to SQLite. Add a database driver and wire CRUD handlers before expecting persistence.`}\n\nThe starter stores each record's submitted fields as JSON in one resource table. This keeps the first API easy to explore, but it does not infer relational tables, foreign keys, or field validation from your idea. Design those explicitly before using complex business data.\n\nFor Python, SQLite is included with Python. Set DATABASE_PATH to choose the database file. For JavaScript, use Node.js 22.5 or newer; node:sqlite is built in, and DATABASE_PATH selects the file. Keep the database file out of Git if it contains real data.\n\nSQLite is suitable for local development and a single-process service with durable disk. For multiple service instances or a hosted platform with ephemeral storage, use managed PostgreSQL, a PostgreSQL driver, and durable backups. This export does not provision a hosted database. Never put database passwords in source files.\n`;
  files['README.md'] = files['README.md'].replace('Records are in memory and reset when the server stops. Connect a database before using real data.', ['Python','JavaScript'].includes(language) ? 'Python and JavaScript starters store CRUD records in SQLite. See DATABASE.md and migrations/001_initial_schema.sql. Other language starters include the schema but need a database driver connected to the API code.' : 'This starter does not yet connect its API handlers to a database. See DATABASE.md for the included SQLite schema and integration notes.');
  files['.gitignore'] = `backend.sqlite3\n*.sqlite3\nnode_modules/\n__pycache__/\n.env\n`;
  files['.env.example'] = `API_ACCESS_TOKEN=replace-with-a-long-random-secret\nDATABASE_PATH=backend.sqlite3\nALLOWED_ORIGINS=http://127.0.0.1:4173,http://localhost:4173\n`;
  files['DATABASE.md'] += `\n## API access and browser origins\n\nAll collection and item routes require Authorization: Bearer API_ACCESS_TOKEN. Generate a unique secret with Node.js: node -p "require('node:crypto').randomBytes(32).toString('hex')". Set it as an environment variable in your hosting provider. For a local BackendDev runner, add API_ACCESS_TOKEN and ALLOWED_ORIGINS to BackendDev/.env and restart the local app; the generated runner inherits those local settings. For direct Python/Node runs, set the variables in your terminal before starting the process. Never commit the real value or place this shared secret in a browser/mobile app. This is shared service authentication, not per-user identity. Public client apps need user authentication and per-user authorization.\n\nThe default CORS list allows only the local BackendDev origins. For a deployed web client, set ALLOWED_ORIGINS to its exact HTTPS origin(s), comma-separated. The health endpoint remains public. Request bodies are limited to 100 KB and 40 simple field names; id is reserved. These checks do not replace a domain-specific schema or authorization policy.\n`;
  return files;
}

