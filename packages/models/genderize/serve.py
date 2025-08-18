import os, json, traceback
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse
from predict import Predictor

HOST = os.environ.get("COG_HOST", "127.0.0.1")
PORT = int(os.environ.get("COG_PORT", "5000"))
DEBUG = os.environ.get("DEBUG", "0") not in ("", "0", "false", "False")

pred = Predictor()
try:
    pred.setup()
    if DEBUG:
        print("[serve] predictor setup OK", flush=True)
except Exception as e:
    print("[serve] FATAL during setup:", e, flush=True)
    print(traceback.format_exc(), flush=True)
    # still start the HTTP server so /healthz doesn't wedge, but /predictions will error

class Handler(BaseHTTPRequestHandler):
    def _write_bytes(self, code: int, data: bytes, content_type: str):
        self.send_response(code)
        self.send_header("content-type", content_type)
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _write_json(self, code: int, obj):
        self._write_bytes(code, json.dumps(obj).encode("utf-8"), "application/json")

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/healthz", "/readyz", "/"):
            self._write_bytes(200, b"ok", "text/plain")
        else:
            self._write_json(404, {"error": "not found"})

    def do_HEAD(self):
        path = urlparse(self.path).path
        if path in ("/healthz", "/readyz", "/"):
            self.send_response(200)
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if urlparse(self.path).path != "/predictions":
            self._write_json(404, {"error": "not found"})
            return

        length = int(self.headers.get("content-length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
            name = (payload.get("input") or {}).get("name", "")
            out = pred.predict(name)
            self._write_json(200, {"status": "succeeded", "output": out})
        except Exception as e:
            # Print full traceback so CloudWatch shows the real reason for 500
            print("[serve] ERROR handling /predictions:", e, flush=True)
            print(traceback.format_exc(), flush=True)
            self._write_json(500, {"status": "failed", "error": str(e)})

if __name__ == "__main__":
    print(f"[entry] starting shim on {HOST}:{PORT}")
    HTTPServer((HOST, PORT), Handler).serve_forever()
