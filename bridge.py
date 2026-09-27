"""
DevAI Bridge — tiny localhost HTTP server that connects the DevAI website to Roblox Studio.
* Runs on http://127.0.0.1:42069/
* Website sends POST /send-studio  {title, type, target, code}  -> queues script for plugin
* Plugin polls GET /poll-studio  -> gets any queued scripts, then deletes them
* Plugin sends POST /send-web {kind,data,...} -> queues for website
* Website polls GET /poll-web -> gets any queued messages (explorer snapshots, scripts)
* No dependencies outside Python stdlib.
"""
import http.server, json, threading, urllib.parse, time, sys, os, webbrowser

PORT = 42069
state_lock = threading.Lock()
studio_queue = []   # messages from website -> plugin
web_queue = []      # messages from plugin -> website
paired = False

class Bridge(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a, **kw): pass  # silence logs

    def _send_json(self, code, obj):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        global paired
        path = urllib.parse.urlparse(self.path).path
        with state_lock:
            if path == '/status':
                self._send_json(200, {'ok': True, 'paired': paired})
            elif path == '/poll-studio':
                msgs = studio_queue[:]
                studio_queue.clear()
                paired = True
                self._send_json(200, {'messages': msgs})
            elif path == '/poll-web':
                msgs = web_queue[:]
                web_queue.clear()
                self._send_json(200, {'messages': msgs})
            elif path == '/':
                self.send_response(200)
                self.send_header('Content-Type', 'text/html')
                self.end_headers()
                self.wfile.write(b'<html><body style="font-family:sans-serif;background:#14100c;color:#eadfc5;padding:40px;text-align:center;"><h1 style="color:#ebbf5b">\xe2\x9a\x94 DevAI Bridge running</h1><p style="color:#a69470">Listening on port '+str(PORT).encode()+b'. Keep this window open while using DevAI.</p><p><a href="https://enestrupi.github.io/DevAI/" style="color:#c99a3e" target="_blank">Open DevAI website \xe2\x86\x92</a></p></body></html>')
            else:
                self._send_json(404, {'error':'not found'})

    def do_POST(self):
        global paired
        path = urllib.parse.urlparse(self.path).path
        length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(length) if length else b'{}'
        try:
            data = json.loads(raw.decode('utf-8'))
        except: data = {}
        with state_lock:
            if path == '/send-studio':
                studio_queue.append(data)
                paired = True
                self._send_json(200, {'ok': True, 'queued': len(studio_queue)})
            elif path == '/send-web':
                web_queue.append(data)
                paired = True
                self._send_json(200, {'ok': True})
            else:
                self._send_json(404, {'error':'not found'})

def main():
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Bridge)
    print("="*60)
    print("  DevAI Bridge running on http://127.0.0.1:%d" % PORT)
    print("  Keep this window open while using DevAI.")
    print("="*60)
    # Open the website automatically
    try: webbrowser.open('https://enestrupi.github.io/DevAI/?connected=local')
    except: pass
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nBridge stopped.")

if __name__ == '__main__':
    main()
