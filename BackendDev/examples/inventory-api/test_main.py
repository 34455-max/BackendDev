import json
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
