import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { Channel } from '../src/mcp/channel.js';
import { createHttpServer } from '../src/mcp/http.js';

test('CORS preflight is answered without a token; the API still requires one', async () => {
  const runtime = mkdtempSync(join(tmpdir(), 'cors-'));
  const channel = new Channel({ runtime });
  const server = createHttpServer({ channel, ownerToken: 'cors-test' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const pre = await fetch(`${base}/api/queue`, { method: 'OPTIONS', headers: { Origin: 'https://example.qwenwork.page', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-origin'), '*');
    assert.match(pre.headers.get('access-control-allow-headers'), /Authorization/);
    assert.equal((await fetch(`${base}/api/queue`)).status, 401);
    assert.equal((await fetch(`${base}/api/queue`, { headers: { Authorization: 'Bearer cors-test' } })).status, 200);
  } finally {
    server.close(); channel.close?.(); rmSync(runtime, { recursive: true, force: true });
  }
});
