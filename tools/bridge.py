#!/usr/bin/env python3
"""Temporary: play against Claude.

Serves the game (instead of `python3 -m http.server`) and holds the game record
at /api/game, which the page (?vs=claude) and Claude (tools/claude.js) both read
and write. Like online play, a record only replaces the stored one if its rev is
higher. Kept in memory, so restarting the bridge starts a new game.

    python3 tools/bridge.py      then open http://localhost:8000/?vs=claude
"""
import http.server
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
record = {'rev': 0, 'batches': []}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith('/api/game'):
            return self.send_json(200, record)
        return super().do_GET()

    def do_POST(self):
        global record
        if not self.path.startswith('/api/game'):
            return self.send_json(404, {'error': 'not found'})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
            rev, batches = int(body['rev']), body['batches']
            assert isinstance(batches, list)
        except Exception:
            return self.send_json(400, {'error': 'expected {rev, batches}'})
        if rev <= record['rev']:
            return self.send_json(409, {'error': f'stale rev {rev}, have {record["rev"]}', **record})
        record = {'rev': rev, 'batches': batches}
        return self.send_json(200, record)

    def log_message(self, fmt, *args):
        if '/api/game' not in self.path:  # the page polls every second
            super().log_message(fmt, *args)


if __name__ == '__main__':
    print('Near Peer vs Claude: http://localhost:8000/?vs=claude')
    http.server.ThreadingHTTPServer(('', 8000), Handler).serve_forever()
