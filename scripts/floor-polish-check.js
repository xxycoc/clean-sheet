// Optional real-browser smoke check. Uses an existing Edge/Chromium, installs nothing.
// Checks static hosting, playback and live URL routing; records CDN availability.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { projectRoot } from '../src/mcp/channel.js';

const executable = process.env.FLOOR_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!existsSync(executable)) throw new Error('Set FLOOR_BROWSER to an existing Chromium executable.');
const temporary = mkdtempSync(join(tmpdir(), 'floor-browser-'));
const server = createServer((req,res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (!path.startsWith('/clean-sheet/')) { res.writeHead(404).end(); return; }
  const relative = path.slice('/clean-sheet/'.length) || 'index.html';
  try { const file = relative.endsWith('/') ? relative + 'index.html' : relative; const data = readFileSync(join(projectRoot,'public',file)); res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(data); } catch {res.writeHead(404).end();}
});
server.stop = () => server.close();
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
  for (const [width,height] of [[1920,1080],[1280,720]]) {
    await command('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:false});
    await command('Page.navigate', {url:pathToFileURL(join(projectRoot,'public/floor/index.html')).href});
    await until(`document.getElementById('position')?.textContent.endsWith('/ 238')`);
    await delay(1400);
    assert.ok(await evaluate(`Number(document.getElementById('cursor').value)>=0`));
    await evaluate(`document.getElementById('play').click()`);
    await screenshot('polish-'+width);
    checks.push({width,threeD:await evaluate(`!document.getElementById('view').hidden`),fallback:await evaluate(`document.getElementById('fallback').textContent`)});
    const overlaps=await evaluate(`(() => {const r=[...document.querySelectorAll('.tag:not([hidden])')].map(e=>e.getBoundingClientRect());return r.reduce((n,a,i)=>n+r.slice(i+1).filter(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top).length,0)})()`);
    assert.equal(overlaps,0);
    await scrub(`e=>e.type==='keeper.decision'&&e.decision==='BLOCK'`); await screenshot('polish-block-'+width);
  }
  await evaluate(`document.getElementById('cursor').value=237;document.getElementById('cursor').dispatchEvent(new Event('input'));document.getElementById('play').click()`);
  // Seek to the penultimate event while retaining playback to exercise the end hold.
  await evaluate(`document.getElementById('cursor').value=236;document.getElementById('cursor').dispatchEvent(new Event('input'));document.getElementById('play').click()`);
  await delay(1200); assert.equal(await evaluate(`document.getElementById('cursor').value`),'237');
  await delay(2200); assert.equal(await evaluate(`document.getElementById('cursor').value`),'237');
  await delay(1000); assert.equal(await evaluate(`document.getElementById('cursor').value`),'0');
  checks.push('Autoplay at 1x, pause, final 3-second hold and loop passed');
  await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await command('Page.reload'); await until(`document.getElementById('cursor')?.value==='237'`);
  await delay(1300); assert.equal(await evaluate(`document.getElementById('play').textContent`),'Play');
  checks.push('Reduced motion opens final state without autoplay');
  await command('Page.navigate',{url:base+'/clean-sheet/'});
  await until(`location.pathname==='/clean-sheet/floor/' && document.getElementById('cursor')?.value==='237'`);
  checks.push('GitHub Pages /clean-sheet/ redirect and relative assets work');
  await command('Page.addScriptToEvaluateOnNewDocument',{source:`window.EventSource=class {constructor(url){window.streamURL=url;}addEventListener(){}close(){}};`});
  await command('Page.navigate',{url:base+'/clean-sheet/floor/?server=https%3A%2F%2Fexample.com&token=owner-test'});
  await until(`window.streamURL`);
  assert.equal(await evaluate(`window.streamURL`),'https://example.com/api/events?token=owner-test');
  checks.push('Explicit HTTPS server and token routed correctly (EventSource mock)');
  assert.deepEqual(errors,[]);
  writeFileSync(join(output,'polish-checks.json'),JSON.stringify({checks,errors,networkErrors},null,2));console.log(JSON.stringify({checks,errors,networkErrors},null,2));
} finally {
  ws?.close();
  if (browserEndpoint) { const control = new WebSocket(browserEndpoint); try { await deadline(once(control, 'open'), 'browser cleanup'); control.send(JSON.stringify({ id: 1, method: 'Browser.close' })); await Promise.race([once(browser, 'exit'), delay(5000)]); } catch (e) { console.error(e.message); } finally { control.close(); } }
  if (browser.exitCode === null) browser.kill();
  server.stop();
  // Only remove the directory created by this invocation, after browser handles close.
  try { rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { console.error(`Temporary browser data retained: ${temporary}`); }
}
