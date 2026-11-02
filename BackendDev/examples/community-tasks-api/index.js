const http = require("node:http");
const records = [];
let nextId = 1;
const resource = "tasks";
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
