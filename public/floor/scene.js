import { keeperMotion, KEEPER_YAW, keeperToWorld, worldToKeeper } from './keeper-motion.js';
import { STAFF, ZONES, COLORS, home, placeOverlay, separateWalkers } from './state.js';
import { characterFactory } from './characters.js';

export async function createFloor(canvas, tags, leaders, inspect, changed) {
  let T;
  try { T = await import('three'); }
  catch (cause) { throw new Error('Pinned three.js download unavailable', { cause }); }
  const { makeCharacter, poseCharacter } = characterFactory(T);
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true }); }
  catch (cause) { throw new Error('WebGL unavailable', { cause }); }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  const scene = new T.Scene(); scene.background = new T.Color('#102630');
  scene.add(new T.HemisphereLight(0xe2f3ff, 0x435450, 2.4));
  const sun = new T.DirectionalLight(0xfff2dc, 3.3); sun.position.set(-5, 18, 12); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 12, bottom: -12, far: 60 }); sun.shadow.normalBias = .035; scene.add(sun);
  const camera = new T.OrthographicCamera(-15, 15, 8, -8, .1, 100); camera.position.set(2.5, 20, 29); camera.lookAt(0, .4, 0); camera.updateMatrixWorld();
  const materials = new Map();
  const mat = color => { if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({ color, roughness: .8, flatShading: true })); return materials.get(color); };
  function mesh(parent, geometry, material, x, y, z) { const m = new T.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
  const box = (p, w, h, d, c, x = 0, y = 0, z = 0) => mesh(p, new T.BoxGeometry(w, h, d), mat(c), x, y, z);
  const cylinder = (p, r, h, c, x = 0, y = 0, z = 0) => mesh(p, new T.CylinderGeometry(r, r * .8, h, 10), mat(c), x, y, z);
  const sphere = (p, r, c, x = 0, y = 0, z = 0) => mesh(p, new T.IcosahedronGeometry(r, 1), mat(c), x, y, z);
  const desks = [];
  function desk(x, z, mail = false) {
    desks.push({ x, z });
    box(scene, 1.4, .12, .7, '#9eafb0', x, .85, z);
    for (const dx of [-.55, .55]) for (const dz of [-.25, .25]) box(scene, .07, .8, .07, '#486674', x + dx, .4, z + dz);
    if (mail) for (let i = 0; i < 3; i++) box(scene, .42, .04, .32, '#ebdfbd', x + .3, .95 + i * .05, z);
    else { box(scene, .65, .43, .06, '#243b49', x, 1.15, z - .08); box(scene, .55, .32, .02, '#8ad3db', x, 1.15, z - .035); box(scene, .4, .03, .2, '#d7e6e5', x, .94, z + .18); }
  }
  function chair(x, z) { box(scene, .55, .1, .5, '#637c90', x, .45, z); box(scene, .55, .5, .08, '#637c90', x, .7, z + .23); cylinder(scene, .06, .4, '#243b49', x, .2, z); }
  function plant(x, z) { cylinder(scene, .27, .5, '#e0b49a', x, .25, z); cylinder(scene, .045, .7, '#59826a', x, .75, z); for (const [dx, dy] of [[-.2, .8], [.2, .95], [0, 1.2]]) sphere(scene, .26, '#76b895', x + dx, dy, z); }
  function cabinet(x, z, color) { box(scene, .55, .95, .45, '#526977', x, .48, z); for (let k = 0; k < 3; k++) { box(scene, .49, .26, .03, color, x, .18 + k * .3, z + .24); box(scene, .16, .025, .04, '#dae3d8', x, .21 + k * .3, z + .27); } }
  box(scene, 26.5, .22, 11.7, '#24433e', 0, -.2, 0);
  box(scene, 26.5, .5, .16, '#46625e', 0, .05, -5.8);
  const labelItems = [], mats = new Map();
  function label(name, position, sub = '', type = 'room') {
    const el = document.createElement(type === 'agent' ? 'button' : 'div'); el.className = `tag ${type}`; el.textContent = name;
    if (sub) { const small = document.createElement('small'); small.textContent = sub; el.append(small); }
    if (type === 'agent') el.onclick = () => inspect(name);
    const leader = document.createElementNS('http://www.w3.org/2000/svg', 'line'); leaders.append(leader); tags.append(el);
    const item = { name, position, el, leader, type }; labelItems.push(item); return item;
  }
  for (const z of ZONES) {
    const c = COLORS[z.level] ?? '#80ada5';
    const material = new T.MeshStandardMaterial({ color: c, transparent: true, opacity: .12, roughness: .9 });
    mesh(scene, new T.BoxGeometry(z.w, .025, z.d), material, z.x, -.04, z.z);
    for (const side of [-1, 1]) { box(scene, z.w, .025, .035, c, z.x, -.01, z.z + side * z.d / 2); box(scene, .035, .025, z.d, c, z.x + side * z.w / 2, -.01, z.z); }
    const item = label(z.name, () => new T.Vector3(z.x, .1, z.z - z.d / 2 - .2), z.level ?? (z.name === 'Staff' ? 'AI staff' : z.name === 'Keeper' ? 'Rules as code' : 'Outbox · Uploads · Supplier'));
    if (z.name === 'Keeper') item.el.textContent = 'Keeper · rules as code';
    item.el.style.setProperty('--color', c); mats.set(z.name, { material, item });
    if (z.level && z.name !== 'Inbox') {
      cabinet(z.x - .95, z.z - .25, c);
      desk(z.x + .55, z.z + .35, true);
      cylinder(scene, .13, .3, '#e0b49a', z.x + 1, 1.1, z.z + .35);
      sphere(scene, .2, '#76b895', z.x + 1, 1.4, z.z + .35);
    }
  }
  STAFF.forEach((n, i) => { const p = home(n); desk(p.x, p.z - .85); chair(p.x, p.z + .35); });
  desk(-10, 1, true); cabinet(-11, 3.3, '#83b8d0'); plant(-10, -3.8); plant(-3.9, 0); plant(11, 3.6);
  // Window, wall clock, goal net and outside door are all primitives.
  box(scene, 2.4, 2.5, .13, '#365963', -10, 1.25, -1.6);
  box(scene, 2.1, 1.65, .15, '#88bbc4', -10, 1.55, -1.5);
  box(scene, .08, 1.7, .18, '#e3e9d5', -10, 1.55, -1.4); box(scene, 2.2, .08, .18, '#e3e9d5', -10, 1.55, -1.4);
  const clock = cylinder(scene, .42, .07, '#e1e7d9', -5.7, 1.9, -5.6); clock.rotation.x = Math.PI / 2;
  box(scene, .035, .25, .04, '#283a45', -5.7, 2, -5.54); const hand = box(scene, .23, .035, .04, '#283a45', -5.6, 1.9, -5.54); hand.rotation.z = -.3;
  const keeperStage = new T.Group(); scene.add(keeperStage);
  keeperStage.rotation.y = KEEPER_YAW;
  keeperStage.position.set(8.3 - 8.3 * Math.cos(KEEPER_YAW), 0, 8.3 * Math.sin(KEEPER_YAW));
  for (const z of [-1.6, 1.6]) cylinder(keeperStage, .07, 2.9, '#e6ecde', 8.3, 1.45, z);
  box(keeperStage, .12, .12, 3.3, '#e6ecde', 8.3, 2.9, 0);
  const net = new T.Group(); keeperStage.add(net);
  const netMaterial = new T.LineBasicMaterial({ color: '#99b9af', transparent: true, opacity: .35 });
  for (let y = 0; y <= 2.8; y += .35) net.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(8.8, y, -1.6), new T.Vector3(8.8, y, 1.6)]), netMaterial));
  for (let z = -1.6; z <= 1.6; z += .32) net.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(8.8, 0, z), new T.Vector3(8.8, 2.9, z)]), netMaterial));
  box(scene, 1.7, 2.8, .2, '#6e9d98', 11.3, 1.4, -2.9); box(scene, 1.35, 2.5, .23, '#172d34', 11.3, 1.25, -2.8); sphere(scene, .07, '#efd3a2', 11.8, 1.2, -2.64);
  const people = Object.fromEntries(STAFF.map((n, i) => [n, makeCharacter(i, scene)]));
  const keeper = makeCharacter(5, keeperStage); keeper.root.position.set(7.1, .02, 0); keeper.root.scale.setScalar(1); keeper.root.rotation.y = -Math.PI / 2; keeper.props.ball.visible = false;
  const villain = makeCharacter(7, scene); villain.root.position.set(-10, 0, -1.1); villain.root.visible = false;
  for (const n of STAFF) { const m = people[n]; m.root.rotation.y = -.08; label(n, () => m.root.position.clone().add(new T.Vector3(0, 2.1, 0)), '', 'agent'); poseCharacter(m, 0, true); }
  const villainTag = label('Untrusted sender', () => villain.root.position.clone().add(new T.Vector3(0, 2.3, 0)), '', 'room');
  const ball = new T.Group(); keeperStage.add(ball); mesh(ball, new T.SphereGeometry(.23, 24, 16), new T.MeshStandardMaterial({ color: '#f8f5e7' }), 0, 0, 0);
  for (let i = 0; i < 6; i++) sphere(ball, .065, '#233542', Math.cos(i * Math.PI / 3) * .19, Math.sin(i * Math.PI / 3) * .19, .1);
  const glowMaterial = new T.MeshBasicMaterial({ color: '#ffc65c', transparent: true, opacity: 0, depthWrite: false });
  mesh(ball, new T.SphereGeometry(.29, 20, 12), glowMaterial, 0, 0, 0);
  const impact = new T.Group(); keeperStage.add(impact);
  const impactMaterial = new T.MeshBasicMaterial({ color: '#fff1b4', transparent: true, opacity: 0 });
  mesh(impact, new T.TorusGeometry(.3, .025, 8, 32), impactMaterial, 0, 0, 0).rotation.y = Math.PI / 2;
  for (let i = 0; i < 6; i++) mesh(impact, new T.SphereGeometry(.045, 8, 6), impactMaterial, 0, Math.cos(i * Math.PI / 3) * .4, Math.sin(i * Math.PI / 3) * .4);
  const redCard = box(keeperStage, .08, .55, .35, '#ef515b', 6.7, 2.1, .8);
  const tick = new T.Group(); scene.add(tick); tick.position.set(10.9, 1, -2.3);
  const tickMaterial = new T.LineBasicMaterial({ color: '#62ed9b' });
  tick.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-.2,0,0),new T.Vector3(0,-.2,0),new T.Vector3(.4,.35,0)]),tickMaterial));
  const trail = Array.from({length: 9}, () => mesh(keeperStage, new T.SphereGeometry(.06, 8, 6), new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}), 0, 0, 0));
  let actionKind = 'ready', actionOrigin = worldToKeeper([4.4,.3,0]), actionStarted = 0, actionAnimate = false;
  let state, from = {}, started = 0, duration = 0, width = 1, height = 1, previousBall, previousVillain = false;
  function resize() {
    width = canvas.parentElement.clientWidth; height = canvas.parentElement.clientHeight; renderer.setSize(width, height, false);
    const points = [];
    for (const x of [-13.4, 13.4]) for (const y of [0, 3.4]) for (const z of [-5.9, 5.9]) points.push(new T.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
    const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
    const aspect = width / height, halfH = Math.max((maxY - minY) / 2, (maxX - minX) / aspect / 2) * 1.015;
    const cx = (maxX + minX) / 2, cy = (maxY + minY) / 2;
    camera.left = cx - halfH * aspect; camera.right = cx + halfH * aspect; camera.top = cy + halfH; camera.bottom = cy - halfH; camera.updateProjectionMatrix();
  }
  function update(next, animate) {
    from = Object.fromEntries(STAFF.map(n => [n, people[n].root.position.clone()])); previousBall = ball.visible ? ball.position.clone() : null;
    const nextKind = next.ball?.phase === 'rejected' ? 'reject' : next.ball?.ownerReleased ? 'release' : next.keeper;
    if (!state || next.ball?.id !== state.ball?.id || nextKind !== actionKind || next.index < state.index) {
      actionKind = nextKind; actionOrigin = previousBall?.toArray() ?? worldToKeeper([4.4,.3,0]); actionStarted = performance.now(); actionAnimate = animate;
      if (next.event?.type === 'keeper.decision') actionOrigin = worldToKeeper([4.9,.35,0]);
    }
    if (!animate) actionAnimate = false;
    previousVillain = state?.villain ?? false; state = next; started = performance.now(); duration = animate ? 650 : 0;
    for (const r of state.rooms) if (r.level) { const m = mats.get(r.name); m.material.color.set(COLORS[r.level]); m.item.el.style.setProperty('--color', COLORS[r.level]); m.item.el.querySelector('small').textContent = r.level; }
  }
  const project = p => { const v = p.clone().project(camera); return { x: (v.x + 1) * width / 2, y: (1 - v.y) * height / 2 }; };
  const goalBounds = new T.Box3().setFromPoints([8.2,8.9].flatMap(x => [0,3].flatMap(y => [-1.7,1.7].map(z => new T.Vector3(...keeperToWorld([x,y,z]))))));
  function screenBounds(bounds) {
    const points = [];
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) points.push(project(new T.Vector3(x, y, z)));
    const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
    return { x, y, w: Math.max(...points.map(p => p.x)) - x, h: Math.max(...points.map(p => p.y)) - y };
  }
  // Precise bounds include deformed tentacles and the Keeper's current dive pose.
  const objectBounds = object => screenBounds(new T.Box3().setFromObject(object, true));
  function draw(now) {
    if (!state) return { active: false, occupied: [], anchor: { x: width / 2, y: height / 2 } };
    const t = duration ? Math.min(1, (now - started) / duration) : 1, eased = t * t * (3 - 2 * t);
    for (const n of STAFF) {
      const m = people[n], a = state.agents[n], destination = new T.Vector3(a.x, 0, a.z);
      m.root.position.copy(from[n]).lerp(destination, eased);
      poseCharacter(m, t < 1 ? t * 2 : 0, true);
      if (t < 1 && from[n].distanceTo(destination) > .1) m.root.position.y = Math.sin(t * Math.PI * 6) * .06;
      if (state.ball?.phase === 'flight' && n === state.ball.agent) m.g.rotation.z = -.2 * Math.sin(t * Math.PI);
    }
    const separated = separateWalkers(STAFF.map(n => ({ x: people[n].root.position.x, z: people[n].root.position.z })), desks);
    STAFF.forEach((n, i) => { people[n].root.position.x = separated[i].x; people[n].root.position.z = separated[i].z; });
    const seconds = actionAnimate ? (now - actionStarted) / 1000 : 10;
    const km = keeperMotion(actionKind, seconds, actionOrigin);
    keeper.root.position.set(...km.root);
    poseCharacter(keeper, 0, true, km); keeper.props.ball.visible = false;
    net.scale.y = 1 - km.netOpen; net.visible = km.netOpen < .99;
    redCard.visible = km.card > 0; redCard.scale.setScalar(Math.max(.001, km.card));
    tick.visible = km.tick > 0; tick.scale.setScalar(Math.max(.001, km.tick));
    glowMaterial.opacity = km.glow * .22;
    impact.visible = km.impact > 0; impact.position.set(6.4,.97,1.07); impact.scale.setScalar(1 + (1 - km.impact) * 1.5); impactMaterial.opacity = km.impact;
    for (const [name, m] of mats) {
      const warning = state.alert && state.event?.file?.split('/')[0].toLowerCase() === name.toLowerCase();
      m.material.emissive.set(warning ? '#f1ba64' : '#000000');
      m.material.emissiveIntensity = warning ? .3 + .5 * Math.sin(t * Math.PI * 3) ** 2 : 0;
    }
    villain.root.visible = state.villain || (previousVillain && t < 1); villain.root.position.x = -10 - (!state.villain ? eased * 2 : 0); poseCharacter(villain, 5.4, true);
    ball.visible = !!state.ball;
    const decisionMotion = ['save','hold','allow','release','reject'].includes(actionKind);
    if (state.ball) {
      if (decisionMotion) ball.position.set(...km.ball);
      else { const b = state.ball; ball.position.copy(previousBall ?? new T.Vector3(...worldToKeeper([4.4,.3,0]))).lerp(new T.Vector3(...worldToKeeper([b.x,b.y,b.z])),eased); }
      ball.rotation.z = -ball.position.x * 3;
    }
    trail.forEach((dot,i) => {
      dot.visible = decisionMotion && ball.visible && km.trail && actionAnimate;
      dot.position.set(...keeperMotion(actionKind, Math.max(0, seconds - (i + 1) * .025), actionOrigin).ball);
      dot.material.color.set(km.netOpen ? '#62ed9b' : '#d3e9ef'); dot.material.opacity = .24 * (1 - i / trail.length);
    });
    scene.updateMatrixWorld(true);
    const obstacles = [objectBounds(keeper.root), screenBounds(goalBounds)];
    if (ball.visible) obstacles.push(objectBounds(ball));
    if (state.activeAgent && people[state.activeAgent]) obstacles.push(objectBounds(people[state.activeAgent].root));
    const occupied = [];
    for (const l of [...labelItems].sort((a, b) => Number(a.type === 'agent') - Number(b.type === 'agent'))) {
      const visible = l !== villainTag || villain.root.visible; l.el.hidden = !visible; l.leader.style.display = visible ? '' : 'none'; if (!visible) continue;
      l.el.classList.toggle('inactive', l.type === 'agent' && l.name !== state.activeAgent && l.name !== 'Keeper');
      const p = project(l.position()), w = l.el.offsetWidth, h = l.el.offsetHeight;
      let x = Math.max(5, Math.min(width - w - 5, p.x - w / 2)), y = Math.max(5, Math.min(height - h - 5, p.y - h));
      const clear = (xx, yy) => xx >= 4 && yy >= 4 && xx + w <= width - 4 && yy + h <= height - 4 && !occupied.some(b => xx < b.x + b.w + 5 && xx + w + 5 > b.x && yy < b.y + b.h + 5 && yy + h + 5 > b.y);
      if (!clear(x, y)) {
        const offset = placeOverlay(p, [w, h], { w: width, h: height }, occupied);
        if (clear(offset.x, offset.y)) { x = offset.x; y = offset.y; }
        else {
          let found = false;
          for (let yy = 5; yy < height - h && !found; yy += h + 6) for (let xx = 5; xx < width - w; xx += 12) {
            if (clear(xx, yy)) { x = xx; y = yy; found = true; break; }
          }
        }
      }
      l.el.style.left = `${x}px`; l.el.style.top = `${y}px`; occupied.push({ x, y, w, h });
      l.leader.setAttribute('x1', p.x); l.leader.setAttribute('y1', p.y + 7); l.leader.setAttribute('x2', x + w / 2); l.leader.setAttribute('y2', y + h);
    }
    renderer.render(scene, camera);
    // The dock has a fixed top-right origin and ends above protected scene objects.
    const dockHeight = Math.min(height - 24, ...obstacles.filter(b => b.x + b.w > width - 414).map(b => b.y - 24));
    return { active: t < 1 || (decisionMotion && km.active), occupied: [...occupied, ...obstacles], dockHeight, anchor: project(ball.visible ? ball.getWorldPosition(new T.Vector3()) : new T.Vector3(7, 1, 0)) };
  }
  const ray = new T.Raycaster();
  canvas.addEventListener('click', event => {
    const rect = canvas.getBoundingClientRect(); ray.setFromCamera(new T.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    for (const hit of ray.intersectObjects([ball, keeper.root, ...Object.values(people).map(m => m.root)], true)) {
      let obj = hit.object; while (obj.parent && obj.parent !== scene && obj.parent !== keeperStage) obj = obj.parent;
      if (obj === ball && ball.visible) { inspect(state.ball?.id); return; }
      if (obj === keeper.root) { inspect('Keeper'); return; }
      const name = STAFF.find(n => people[n].root === obj); if (name) { inspect(name); return; }
    }
  });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); changed('WebGL context lost'); });
  resize(); return { resize, update, draw };
}
