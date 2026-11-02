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
  return JSON.stringify({openapi:'3.1.0',info:{title:name,version:'1.0.0',description:'Generated API contract. Starter records are in memory and are cleared when the service stops.'},servers:[{url:'http://127.0.0.1:3000'}],paths,...(hasCrud?{components:{schemas:{Record:item}}}:{})},null,2)+'\n';
}

export function createStarterFiles(language, name, idea) {
  const resource = resourceForIdea(idea);
  const files = {
    'README.md': `# ${name}\n\n## What this backend does\n${idea}\n\n## Learn the request flow\nA client sends an HTTP request → the server matches a route → a handler applies logic to data → the server returns a status and JSON response.\n\n## Starter routes\n- GET /health — check that the API is running\n- GET /${resource} — list all records\n- POST /${resource} — create a record using a JSON body\n- GET /${resource}/1 — read one record\n- PUT or PATCH /${resource}/1 — update a record\n- DELETE /${resource}/1 — delete a record\n\n## Run and test\nOpen this project in BackendDev. Choose Run API server, then try http://127.0.0.1:3000/health in the API tester. Choose Run tests to check the starter. Records are in memory and reset when the server stops. Connect a database before using real data.\n`,
  };

  if (language === 'Python') {
    files['main.py'] = `from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse
import os
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
            if length < 0 or length > 1_000_000:
                return None
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
        data.pop("id", None)
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
    host = os.environ.get("HOST") or ("0.0.0.0" if os.environ.get("PORT") else "127.0.0.1")
    port = int(os.environ.get("PORT", "3000"))
    print(f"Your API is running on {host}:{port}")
    print("Try GET /health and CRUD /${resource}")
    HTTPServer((host, port), Handler).serve_forever()
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
  let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 1_000_000) throw new Error("Request body is too large"); chunks.push(chunk); }
  const value = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
  return value;
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
  if (["PUT", "PATCH"].includes(req.method) && parts.length === 2) { try { const item = records.find(record => String(record.id) === parts[1]); if (!item) return send(res, 404, { error: "Item not found" }); const updates = await readBody(req); delete updates.id; Object.assign(item, updates); return send(res, 200, item); } catch { return send(res, 400, { error: "Expected valid JSON under 1 MB" }); } }
  if (req.method === "DELETE" && parts.length === 2) { const index = records.findIndex(record => String(record.id) === parts[1]); if (index < 0) return send(res, 404, { error: "Item not found" }); records.splice(index, 1); return send(res, 200, { deleted: true }); }
  return send(res, 404, { error: "Route not found" });
});
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
server.listen(port, host, () => console.log("API listening at http://" + host + ":" + port));
`;
    files['package.json'] = JSON.stringify({ name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'), version: '1.0.0', scripts: { start: 'node index.js', test: 'node --check index.js' } }, null, 2);
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
  return files;
}

