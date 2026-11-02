from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse
import json

# Temporary in-memory data; use a database for persistent records.
items = []
next_id = 1
RESOURCE = "products"

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
    print("Try GET /health and CRUD /products")
    HTTPServer(("127.0.0.1", 3000), Handler).serve_forever()
