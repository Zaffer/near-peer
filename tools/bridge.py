#!/usr/bin/env python3
"""Temporary: play against Claude.

Serves the game (instead of `python3 -m http.server`) and holds the game record
at /api/game, which the page (?vs=claude) and Claude (tools/claude.js) both read
and write. Like online play, a record only replaces the stored one if its rev is
higher. Kept in memory, so restarting the bridge starts a new game.

    python3 tools/bridge.py      then open http://localhost:8000/?vs=claude
                                 (or http://localhost:8000/v2/?vs=claude for v2,
                                 which keeps its own record at /v2/api/game)
"""
import http.server
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# One game record per version: '' for v1 (/api/game), 'v2' for v2 (/v2/api/game).
records = {'': {'rev': 0, 'batches': []}, 'v2': {'rev': 0, 'batches': []}}


def version_of(path):
    for v in records:
        if path.startswith(f'/{v}/api/game' if v else '/api/game'):
            return v
    return None


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
        v = version_of(self.path)
        if v is not None:
            return self.send_json(200, records[v])
        return super().do_GET()

    def do_POST(self):
        v = version_of(self.path)
        if v is None:
            return self.send_json(404, {'error': 'not found'})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
            rev, batches = int(body['rev']), body['batches']
            assert isinstance(batches, list)
        except Exception:
            return self.send_json(400, {'error': 'expected {rev, batches}'})
        if rev <= records[v]['rev']:
            return self.send_json(409, {'error': f'stale rev {rev}, have {records[v]["rev"]}', **records[v]})
        records[v] = {'rev': rev, 'batches': batches}
        return self.send_json(200, records[v])

    def log_message(self, fmt, *args):
        if '/api/game' not in self.path:  # the page polls every second
            super().log_message(fmt, *args)


if __name__ == '__main__':
    print('Near Peer vs Claude: http://localhost:8000/?vs=claude (v2: http://localhost:8000/v2/?vs=claude)')
    http.server.ThreadingHTTPServer(('', 8000), Handler).serve_forever()
