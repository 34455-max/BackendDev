export function resourceForIdea(idea = '') {
  const text = idea.toLowerCase();
  const groups = [['products','product'],['customers','customer'],['orders','order'],['users','user'],['tasks','task'],['bookings','booking'],['appointments','appointment'],['posts','post'],['comments','comment'],['invoices','invoice'],['tickets','ticket'],['events','event'],['courses','course']];
  return groups.find(([plural, singular]) => text.includes(plural) || text.includes(singular))?.[0] || 'items';
}

export function createStarterFiles(language, name, idea) {
  const resource = resourceForIdea(idea);
  const files = {
    'README.md': `# ${name}\n\n## What this backend does\n${idea}\n\n## Learn the request flow\nA client sends an HTTP request → the server matches a route → a handler applies logic to data → the server returns a status and JSON response.\n\n## Starter routes\n- GET /health — check that the API is running\n- GET /${resource} — list all records\n- POST /${resource} — create a record using a JSON body\n- GET /${resource}/1 — read one record\n- PUT or PATCH /${resource}/1 — update a record\n- DELETE /${resource}/1 — delete a record\n\n## Run and test\nOpen this project in BackendDev. Choose Run API server, then try http://127.0.0.1:3000/health in the API tester. Choose Run tests to check the starter. Records are in memory and reset when the server stops. Connect a database before using real data.\n`,
  };

  if (language === 'Python') {
    files['main.py'] = `from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse
import json

# Temporary in-memory data; use a database for persistent records.
items = []
next_id = 1
RESOURCE = "${resource}"

def send(handler, status, payload):
    body = json.dumps(payload).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(body)

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parts = urlparse(self.path).path.strip("/").split("/")
        if parts == ["health"]:
            return send(self, 200, {"status": "ok"})
        if parts[0] != RESOURCE:
            return send(self, 404, {"error": "Route not found"})
        if len(parts) == 1:
            return send(self, 200, items)
        found = next((item for item in items if str(item["id"]) == parts[1]), None)
        return send(self, 200, found) if found else send(self, 404, {"error": "Item not found"})

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            return json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return None

    def do_POST(self):
        global next_id
        if urlparse(self.path).path.strip("/") != RESOURCE:
            return send(self, 404, {"error": "Route not found"})
        data = self.read_json()
        if not isinstance(data, dict):
            return send(self, 400, {"error": "Expected a JSON object"})
        data["id"] = next_id
        next_id += 1
        items.append(data)
        return send(self, 201, data)

    def do_PUT(self):
        parts = urlparse(self.path).path.strip("/").split("/")
        if len(parts) != 2 or parts[0] != RESOURCE:
            return send(self, 404, {"error": "Route not found"})
        data = self.read_json()
        if not isinstance(data, dict):
            return send(self, 400, {"error": "Expected a JSON object"})
        found = next((item for item in items if str(item["id"]) == parts[1]), None)
        if not found:
            return send(self, 404, {"error": "Item not found"})
        found.update(data)
        return send(self, 200, found)

    do_PATCH = do_PUT

    def do_DELETE(self):
        parts = urlparse(self.path).path.strip("/").split("/")
        if len(parts) != 2 or parts[0] != RESOURCE:
            return send(self, 404, {"error": "Route not found"})
        for index, item in enumerate(items):
            if str(item["id"]) == parts[1]:
                items.pop(index)
                return send(self, 200, {"deleted": True})
        return send(self, 404, {"error": "Item not found"})

if __name__ == "__main__":
    print("Your API is running at http://127.0.0.1:3000")
    print("Try GET /health and CRUD /${resource}")
    HTTPServer(("127.0.0.1", 3000), Handler).serve_forever()
`;
    files['test_main.py'] = `import json
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
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
        request = Request(self.base + route, data=data, method=method, headers={"Content-Type": "application/json"})
        try:
            with urlopen(request, timeout=3) as response:
                return response.status, json.loads(response.read() or b"null")
        except HTTPError as error:
            return error.code, json.loads(error.read() or b"{}")

    def test_health_route(self):
        self.assertEqual(self.request("GET", "/health"), (200, {"status": "ok"}))

    def test_create_read_update_delete_flow(self):
        status, created = self.request("POST", "/" + main.RESOURCE, {"name": "Ada"})
        self.assertEqual(status, 201)
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
const records = [];
let nextId = 1;
const resource = "${resource}";
function send(res, status, data) {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS", "access-control-allow-headers": "Content-Type" });
  res.end(JSON.stringify(data));
}
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
}
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS", "access-control-allow-headers": "Content-Type" }); return res.end(); }
  if (pathname === "/health" && req.method === "GET") return send(res, 200, { status: "ok" });
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== resource) return send(res, 404, { error: "Route not found" });
  if (req.method === "GET" && parts.length === 1) return send(res, 200, records);
  if (req.method === "GET" && parts.length === 2) { const item = records.find(record => String(record.id) === parts[1]); return item ? send(res, 200, item) : send(res, 404, { error: "Item not found" }); }
  if (req.method === "POST" && parts.length === 1) { try { const item = { ...await readBody(req), id: nextId++ }; records.push(item); return send(res, 201, item); } catch { return send(res, 400, { error: "Expected valid JSON" }); } }
  if (["PUT", "PATCH"].includes(req.method) && parts.length === 2) { try { const item = records.find(record => String(record.id) === parts[1]); if (!item) return send(res, 404, { error: "Item not found" }); Object.assign(item, await readBody(req)); return send(res, 200, item); } catch { return send(res, 400, { error: "Expected valid JSON" }); } }
  if (req.method === "DELETE" && parts.length === 2) { const index = records.findIndex(record => String(record.id) === parts[1]); if (index < 0) return send(res, 404, { error: "Item not found" }); records.splice(index, 1); return send(res, 200, { deleted: true }); }
  return send(res, 404, { error: "Route not found" });
});
server.listen(3000, "127.0.0.1", () => console.log("API listening at http://127.0.0.1:3000"));
`;
    files['package.json'] = JSON.stringify({ name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'), version: '1.0.0', scripts: { start: 'node index.js', test: 'node --check index.js' } }, null, 2);
  } else if (language === 'Go') {
    files['main.go'] = `package main

import ("fmt"; "net/http")

func main() {
 http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { w.Header().Set("Content-Type", "application/json"); w.Header().Set("Access-Control-Allow-Origin", "*"); fmt.Fprint(w, \`{"status":"ok"}\`) })
 fmt.Println("API listening on http://127.0.0.1:3000")
 http.ListenAndServe("127.0.0.1:3000", nil)
}
`;
  } else if (language === 'Rust') {
    files['main.rs'] = 'fn main() { println!("Starter program. Add an HTTP framework to serve API routes."); }\n';
  } else if (language === 'Java') {
    files['Main.java'] = 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Starter program. Add a web framework to serve API routes.");\n  }\n}\n';
  }
  return files;
}
