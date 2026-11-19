// Optional real-browser smoke check. Uses an existing Edge/Chromium, installs nothing.
// External requests are blocked: this check exercises the offline fallback and local SSE.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { Channel, projectRoot } from '../src/mcp/channel.js';
import { createHttpServer } from '../src/mcp/http.js';

const executable = process.env.FLOOR_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!existsSync(executable)) throw new Error('Set FLOOR_BROWSER to an existing Chromium executable.');
const temporary = mkdtempSync(join(tmpdir(), 'floor-browser-'));
const channel = new Channel({ runtime: join(temporary, 'runtime') });
const server = createHttpServer({ channel, ownerToken: 'local-floor-check' });
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const browser = spawn(executable, ['--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--remote-debugging-port=0', `--user-data-dir=${join(temporary, 'profile')}`, '--no-first-run', '--no-default-browser-check', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
const output = join(projectRoot, 'docs/floor-check'); mkdirSync(output, { recursive: true });
let ws, browserEndpoint;
const errors = [], checks = [], networkErrors = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const deadline = (promise, label) => Promise.race([promise, new Promise((_, reject) => { const timeout = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 20000); timeout.unref(); })]);
try {
  browserEndpoint = await new Promise((resolve, reject) => {
    let log = ''; const timeout = setTimeout(() => reject(new Error(`Browser debugging endpoint did not start: ${log.slice(-2000)}`)), 20000);
    browser.stderr.on('data', chunk => { log += chunk; const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
    browser.on('error', reject);
  });
  console.log('Browser endpoint ready');
  const debugBase = browserEndpoint.replace('ws:', 'http:').split('/devtools/')[0];
  const targets = await (await fetch(debugBase + '/json/list')).json();
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl); await deadline(once(ws, 'open'), 'page socket');
  console.log('Page socket ready');
  let serial = 0; const pending = new Map();
  ws.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.id) { const p = pending.get(msg.id); pending.delete(msg.id); if (p) msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    if (msg.method === 'Network.loadingFailed') networkErrors.push(msg.params.errorText);
  });
  const command = (method, params = {}) => deadline(new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }), method);
  const evaluate = async expression => { const r = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
  const until = async (expression, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await evaluate(expression)) return; await delay(100); } throw new Error(`Timed out: ${expression}`); };
  const screenshot = async name => { await delay(150); const { data } = await command('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(output, name + '.png'), Buffer.from(data, 'base64')); };
  const scrub = async predicate => { await evaluate(`(() => { const i=FLOOR_SAMPLE.findIndex(${predicate}); if(i<0)throw Error('Missing event'); const r=document.getElementById('cursor');r.value=i;r.dispatchEvent(new Event('input'));return i; })()`); await delay(200); };
  await command('Runtime.enable'); await command('Page.enable'); await command('Network.enable');
  await command('Network.setBlockedURLs', { urls: ['https://*'] });
  await command('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await command('Page.navigate', { url: base + '/floor/' });
  console.log('Floor navigated');
  await until(`document.getElementById('position')?.textContent.endsWith('/ 238')`);
  await until(`!document.getElementById('fallback').textContent.startsWith('Loading')`);
  checks.push({ desktop3D: await evaluate(`!document.getElementById('view').hidden`), fallback: await evaluate(`document.getElementById('fallback').textContent`), error: await evaluate(`document.getElementById('view').dataset.error`) });
  await screenshot('desktop-ready');
  await scrub(`e=>e.type==='keeper.decision'&&e.decision==='BLOCK'`); await screenshot('desktop-block');
  await evaluate(`document.getElementById('card').click()`); assert.equal(await evaluate(`document.getElementById('drawer').hidden`), false); await screenshot('decision-drawer'); await evaluate(`document.getElementById('close').click()`);
  await scrub(`e=>e.type==='keeper.decision'&&e.decision==='HOLD_FOR_APPROVAL'`); await screenshot('desktop-hold');
  await scrub(`e=>e.type==='file.read'&&e.trust==='untrusted'`); await screenshot('desktop-villain');
  await scrub(`e=>e.type==='file.read'&&e.in_scope===false`); await screenshot('desktop-out-of-scope');
  const overlayCheck = await evaluate(`(() => { const tags=[...document.querySelectorAll('.tag')].filter(e=>!e.hidden).map(e=>e.getBoundingClientRect());const card=document.getElementById('card'),r=card.getBoundingClientRect();return {docked:card.dataset.docked,overlaps:tags.filter(b=>r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top).length};})()`);
  checks.push({ overlays: overlayCheck });
  await evaluate(`document.getElementById('sample').click();document.getElementById('speed').value='4';document.getElementById('play').click()`); await delay(700); await evaluate(`document.getElementById('play').click()`); assert.ok(await evaluate(`Number(document.getElementById('cursor').value)>=1`)); checks.push('Replay play/pause at 4x advances cursor');
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }); await until(`document.getElementById('fallback').textContent.includes('Reduced motion')`); await screenshot('reduced-motion');
  await command('Emulation.setEmulatedMedia', { features: [] });
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 1100, deviceScaleFactor: 1, mobile: false }); await until(`document.getElementById('fallback').textContent.includes('narrower')`); await screenshot('mobile-390');
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true); checks.push('390px has no horizontal overflow and uses 2D');
  await command('Emulation.setDeviceMetricsOverride', { width: 320, height: 1100, deviceScaleFactor: 1, mobile: false }); await screenshot('mobile-320'); assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true);
  await command('Page.navigate', { url: pathToFileURL(join(projectRoot, 'public/floor/index.html')).href }); await until(`document.getElementById('position')?.textContent.endsWith('/ 238')`); checks.push('file:// sample opens with 238 real events'); await screenshot('file-sample');
  await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await command('Page.navigate', { url: base + '/floor/?token=local-floor-check' }); await until(`document.getElementById('connection')?.textContent==='Live · Connected'`);
  await delay(250);
  const task = channel.call('start_task', { agent: 'Support', instruction: 'A routine reply' }).structuredContent.task_id;
  channel.call('send_email', { task_id: task, to: 'daniel@harbourbean.example', body: 'Thanks for your message.' });
  await until(`document.getElementById('position').textContent==='4 / 4'`, 10000); assert.equal(await evaluate(`document.getElementById('conceded').textContent`), '0'); await screenshot('live-allow'); checks.push('Live SSE receives task/proposal/decision/execution through Channel');
  await command('Page.reload'); await until(`document.getElementById('position')?.textContent==='4 / 4'`); checks.push('Live reconnect replays history without duplicate events');
  assert.deepEqual(errors, []); checks.push('No uncaught browser exceptions');
  writeFileSync(join(output, 'checks.json'), JSON.stringify({ checks, errors, networkErrors }, null, 2)); console.log(JSON.stringify({ checks, errors, networkErrors }, null, 2));
} finally {
  ws?.close();
  if (browserEndpoint) { const control = new WebSocket(browserEndpoint); try { await deadline(once(control, 'open'), 'browser cleanup'); control.send(JSON.stringify({ id: 1, method: 'Browser.close' })); await Promise.race([once(browser, 'exit'), delay(5000)]); } catch (e) { console.error(e.message); } finally { control.close(); } }
  if (browser.exitCode === null) browser.kill();
  server.stop();
  // Only remove the directory created by this invocation, after browser handles close.
  try { rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { console.error(`Temporary browser data retained: ${temporary}`); }
}
