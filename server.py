"""
Simple HTTP server with no-cache headers for Zürich Dashboard development.
Run: python server.py
Then open: http://localhost:8765
"""
import http.server
import socketserver

PORT = 8766

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        print(f"  > {self.address_string()} - {format % args}")

with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
    print(f"Dashboard running at http://localhost:{PORT}")
    print(f"  Press Ctrl+C to stop.\n")
    httpd.serve_forever()
