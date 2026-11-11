"""Local dev server for PaprKoin: serves this folder with caching turned off.

Usage:  python dev-server.py [port]
"""
import http.server
import sys
from functools import partial
from pathlib import Path


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
    root = Path(__file__).resolve().parent
    handler = partial(NoCacheHandler, directory=str(root))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"PaprKoin dev server on http://localhost:{port}")
        httpd.serve_forever()
