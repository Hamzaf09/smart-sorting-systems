'use strict';
/* TILTSORT ARENA – working simulation: funnel → IR → plate → camera tracking → servo tilt (closed loop) → bin */
(() => {
  const G = 260, DEG = Math.PI / 180, PC = 34, MAXT = 13 * DEG, MU = .15;
  const KINDS = [
    { id: 'red', name: 'Red', hex: '#e53935', hue: 2 }, { id: 'green', name: 'Green', hex: '#2ecc71', hue: 135 },
    { id: 'blue', name: 'Blue', hex: '#3498db', hue: 207 }, { id: 'yellow', name: 'Yellow', hex: '#f1c40f', hue: 51 },
    { id: 'unknown', name: 'Unknown', hex: '#9b59b6', hue: 285 }];
  // bins: 0 red +x, 1 green +y, 2 blue -x, 3 yellow/reject -y
  const BINS = [{ name: 'Red bin (+X)', hex: '#e74c3c' }, { name: 'Green bin (+Y)', hex: '#2ecc71' }, { name: 'Blue bin (−X)', hex: '#3498db' }, { name: 'Yellow / Reject (−Y)', hex: '#f1c40f' }];
  const BOX = [[49.5, 22, 10, 24], [22, 49.5, 24, 10], [8.5, 22, 10, 24], [22, 8.5, 24, 10]]; // x,y,dx,dy
  const TARGET = [[52, 34], [34, 52], [16, 34], [34, 16]];
  const CLASSES = ['red', 'green', 'blue', 'yellow'];
  const randn = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); };
  const hueClass = h => { h = (h + 360) % 360; if (h < 20 || h > 340) return 'red'; if (h >= 35 && h <= 75) return 'yellow'; if (h >= 90 && h <= 160) return 'green'; if (h >= 190 && h <= 250) return 'blue'; return 'unknown'; };
  const slot = (b, k) => { const layer = Math.floor(k / 6), i = k % 6, al = (i % 3 - 1) * 6.5, ac = (Math.floor(i / 3) - .5) * 4; return b % 2 === 0 ? [ac, al, layer] : [al, ac, layer]; };

  const sim = {
    num: '03', title: 'TILTSORT ARENA', subtitle: 'Servo-tilted clear acrylic plate · camera closes the loop on the object’s live position · 4 bins',
    kinds: KINDS, bins: BINS, options: [{ id: 'noise', label: 'Noisy camera (low-confidence → reject bin)', value: false }, { id: 'slick', label: 'Slippery plate (less friction, more overshoot)', value: false }],
    opts: {}, bounds: { x: [0, 74], y: [0, 74], z: [0, 58] }, floor: [-4, 78, -4, 78],
    queue: [], log: [], counts: [0, 0, 0, 0], stats: { sorted: 0, correct: 0, rejected: 0 }, stage: 'IDLE', progress: 0, time: 0,
    parts: [
      { n: 1, cat: 'bin', name: 'Feeder funnel (object entry)', func: 'Drops one object at a time onto the plate', anchor: [39.6, 24, 40] },
      { n: 2, cat: 'sense', name: 'IR break-beam', func: 'Sees an object leave the funnel', anchor: [34, 27.4, 25] },
      { n: 3, cat: 'sense', name: 'Overhead camera', func: 'Tracks position + colour of the object', anchor: [34, 36, 38] },
      { n: 4, cat: 'sense', name: 'LED ring light', func: 'Even lighting on the plate', anchor: [40.2, 34, 32.6] },
      { n: 5, cat: 'struct', name: 'Clear acrylic tilt plate', func: '28 cm plate with corner guards', anchor: [48, 40, 16.6] },
      { n: 6, cat: 'struct', name: 'Ball-joint pivot', func: 'Centre pivot lets plate tilt on 2 axes', anchor: [34, 36.1, 14.9] },
      { n: 7, cat: 'act', name: 'Servo X (pitch)', func: 'Tilts plate toward ±X bins', anchor: [46.5, 31, 5] },
      { n: 8, cat: 'act', name: 'Servo Y (roll)', func: 'Tilts plate toward ±Y bins', anchor: [32.6, 43.4, 3.5] },
      { n: 9, cat: 'act', name: 'Push-rods', func: 'Link servo horns to plate underside', anchor: [44, 33.8, 12] },
      { n: 10, cat: 'bin', name: 'Collection bins ×4', func: 'One bin on each side of the plate', anchor: [59.5, 34, 8] },
      { n: 11, cat: 'ctrl', name: 'PCA9685 servo driver', func: 'Clean PWM for both servos', anchor: [25, 65.2, 2.5] },
      { n: 12, cat: 'ctrl', name: 'Arduino Uno', func: 'Plate-angle control loop', anchor: [34.8, 65.6, 2.8] },
      { n: 13, cat: 'ctrl', name: 'Raspberry Pi 4', func: 'Vision + object tracking (OpenCV)', anchor: [44.3, 65.6, 2.7] },
      { n: 14, cat: 'ctrl', name: '5 V power supply', func: 'Servos + boards', anchor: [12, 66, 7] },
      { n: 15, cat: 'struct', name: 'Aluminium L-gantry', func: 'Holds camera + feeder above the plate', anchor: [2, 3, 26] },
    ],
    reset() {
      this.ta = 0; this.tb = 0; this.cmdA = 0; this.cmdB = 0; this.obj = null; this.phase = 'idle'; this.phaseT = 0; this.bins_ = [[], [], [], []];
      this.log = []; this.time = 0; this.stats = { sorted: 0, correct: 0, rejected: 0 }; this.counts = [0, 0, 0, 0]; this.stage = 'IDLE'; this.progress = 0; this.nextId = 1;
      this.ledOn = false; this.irT = 0; this.res = null; this.dest = -1; this.queue.length = 0; this.trail = [];
      [['red', 'ball'], ['green', 'cube'], ['blue', 'ball'], ['yellow', 'cube'], ['unknown', 'ball']].forEach(([k, s]) => this.enqueue(k, s));
      this.say('System ready. Press ▶ Start.');
    },
    say(t) { this.log.push(`<b>${this.time.toFixed(1)}s</b> ${t}`); },
    enqueue(kind, shape) { if (this.queue.length < 30) this.queue.push({ kind, shape }); },
    zt(x, y) { return 17.2 - Math.tan(this.ta) * (x - PC) - Math.tan(this.tb) * (y - PC); },

    update(dt, running) {
      if (dt > 0) this.time += dt;
      const slew = 70 * DEG * dt; this.ta += clampv(this.cmdA - this.ta, -slew, slew); this.tb += clampv(this.cmdB - this.tb, -slew, slew);
      if (this.irT > 0) this.irT -= dt;
      const o = this.obj;
      switch (this.phase) {
        case 'idle':
          this.stage = this.stats.sorted ? 'COMPLETED' : 'IDLE'; this.progress = 0; this.cmdA = this.cmdB = 0;
          if (running && this.queue.length && Math.abs(this.ta) + Math.abs(this.tb) < .01) {
            const q = this.queue.shift(), k = KINDS.find(k => k.id === q.kind);
            this.obj = { id: this.nextId++, kind: q.kind, k, shape: q.shape, r: q.shape === 'ball' ? 1.5 : 1.25, x: PC, y: 24, z: 56, vx: 0, vy: 0, vz: 0, yaw: Math.random() * 3, st: 'fall', bounced: false };
            this.res = null; this.dest = -1; this.trail = []; this.phase = 'feed'; this.stage = 'DETECTING'; this.say(`Object #${this.obj.id} (${k.name} ${q.shape}) enters the feeder funnel`);
          }
          break;
        case 'feed': {
          const prev = o.z; o.vz -= G * dt; o.z += o.vz * dt; if (prev > 24.9 && o.z <= 24.9) { this.irT = .5; this.say('IR gate: object left the funnel'); }
          const rest = 17.2 + o.r; this.progress = clampv((56 - o.z) / 38, 0, 1) * .4;
          if (o.z <= rest) { o.z = rest; if (!o.bounced && o.vz < -30) { o.vz *= -.3; o.bounced = true; } else { o.vz = 0; this.phase = 'classify'; this.phaseT = 0; this.stage = 'CLASSIFYING'; this.ledOn = true; this.say('Object on plate → LED ring on, camera locking on'); } }
          break; }
        case 'classify':
          this.phaseT += dt; this.progress = clampv(this.phaseT / 1.4, 0, 1); this.stage = 'CLASSIFYING';
          if (this.phaseT >= 1.4) {
            const k = o.k, hue = k.hue + randn() * (this.opts.noise ? 18 : 3), c = hueClass(hue), conf = clampv(.97 - Math.abs(randn()) * (this.opts.noise ? .22 : .03), .3, .995);
            const ok = c !== 'unknown' && conf >= .7; this.res = { hue, c, conf, ok }; this.dest = ok ? CLASSES.indexOf(c) : 3; this.ledOn = false;
            this.say(`Camera: <b>${c.toUpperCase()}</b> hue ${Math.round((hue + 360) % 360)}° conf ${Math.round(conf * 100)}%`);
            this.phase = 'decide'; this.phaseT = 0; this.stage = 'DECISION'; this.say(`Decision → <b>${BINS[this.dest].name}</b>${ok ? '' : ' (reject)'}; target edge point (${TARGET[this.dest].join(', ')}) cm`);
          }
          break;
        case 'decide':
          this.phaseT += dt; this.progress = clampv(this.phaseT / .8, 0, 1);
          if (this.phaseT >= .8) { this.phase = 'tilt'; this.stage = 'SORTING'; this.phaseT = 0; this.say('PD loop active: camera position → servo X/Y tilt'); }
          break;
        case 'tilt': {
          this.phaseT += dt; const T = TARGET[this.dest], ex = T[0] - o.x, ey = T[1] - o.y, shapeK = o.shape === 'ball' ? .714 : 1, slick = this.opts.slick ? .6 : 1;
          let ax = clampv(6 * ex - 3.4 * o.vx, -G, G), ay = clampv(6 * ey - 3.4 * o.vy, -G, G);
          const dirx = Math.sign(ax), diry = Math.sign(ay), mu = o.shape === 'cube' ? MU : 0;
          const tx = o.shape === 'ball' ? Math.asin(clampv(ax / (G * shapeK * slick), -1, 1)) : dirx * (Math.atan(mu) + Math.abs(ax) / G);
          const ty = o.shape === 'ball' ? Math.asin(clampv(ay / (G * shapeK * slick), -1, 1)) : diry * (Math.atan(mu) + Math.abs(ay) / G);
          this.cmdA = clampv(tx, -MAXT, MAXT); this.cmdB = clampv(ty, -MAXT, MAXT);
          // physics on the plate
          const sx = Math.sin(this.ta), sy = Math.sin(this.tb);
          if (o.shape === 'ball') { const fr = this.opts.slick ? .5 : 1.4; o.vx += (G * .714 * sx - fr * o.vx) * dt; o.vy += (G * .714 * sy - fr * o.vy) * dt; }
          else {
            const gx = G * sx, gy = G * sy, gm = Math.hypot(gx, gy), sp = Math.hypot(o.vx, o.vy), fr = G * (this.opts.slick ? .08 : MU) * Math.cos(Math.hypot(this.ta, this.tb));
            if (sp < .6 && gm <= fr) { o.vx = o.vy = 0; } else if (sp < .6) { o.vx += (gx - fr * gx / gm) * dt; o.vy += (gy - fr * gy / gm) * dt; }
            else { o.vx += (gx - fr * o.vx / sp) * dt; o.vy += (gy - fr * o.vy / sp) * dt; }
          }
          o.x += o.vx * dt; o.y += o.vy * dt; o.z = this.zt(o.x, o.y) + o.r; o.spin = (o.spin || 0) + Math.hypot(o.vx, o.vy) * dt / o.r;
          if (this.trail.length === 0 || Math.hypot(o.x - this.trail[this.trail.length - 1][0], o.y - this.trail[this.trail.length - 1][1]) > 1.2) this.trail.push([o.x, o.y]);
          this.progress = clampv(1 - Math.hypot(ex, ey) / 20, 0, 1) * .8;
          // edges (corner guards reflect)
          const L = 20, H = 48; let exit = -1, along = 0;
          if (o.x > H) { exit = 0; along = o.y; } else if (o.y > H) { exit = 1; along = o.x; } else if (o.x < L) { exit = 2; along = o.y; } else if (o.y < L) { exit = 3; along = o.x; }
          if (exit >= 0 && (along < 24 || along > 44)) { if (exit % 2 === 0) { o.x = clampv(o.x, L, H); o.vx *= -.3; } else { o.y = clampv(o.y, L, H); o.vy *= -.3; } exit = -1; }
          if (exit >= 0) {
            this.exitBin = exit; const n = this.bins_[exit].length, sl = slot(exit, n), b = BOX[exit], tx2 = b[0] + b[2] / 2 + sl[0], ty2 = b[1] + b[3] / 2 + sl[1], zf = 2.6 + o.r + sl[2] * o.r * 2, dz = o.z - zf, T2 = Math.sqrt(2 * dz / G);
            o.tgt = [tx2, ty2, zf]; o.T = T2; o.t0 = 0; o.hx = (tx2 - o.x) / T2; o.hy = (ty2 - o.y) / T2; o.vz = 0; this.phase = 'air'; this.cmdA = this.cmdB = 0; this.say('Object leaves the plate edge → falling into bin');
          } else if (this.phaseT > 14) { this.say('Timeout – object stuck, retrying with max tilt'); this.phaseT = 8; }
          break; }
        case 'air':
          o.vz -= G * dt; o.z += o.vz * dt; o.x += o.hx * dt; o.y += o.hy * dt; o.t0 += dt; this.progress = .85 + .1 * clampv(o.t0 / o.T, 0, 1);
          if (o.t0 >= o.T || o.z <= o.tgt[2]) {
            o.x = o.tgt[0]; o.y = o.tgt[1]; o.z = o.tgt[2]; const eb = this.exitBin; this.bins_[eb].push(o); this.obj = null; this.phase = 'done'; this.phaseT = 0; this.stage = 'COMPLETED'; this.progress = 1;
            const truth = o.kind === 'unknown' ? 3 : CLASSES.indexOf(o.kind), ok = truth === eb; this.stats.sorted++; if (ok) this.stats.correct++; if (o.kind === 'unknown' || (this.res && !this.res.ok)) this.stats.rejected++; this.counts[eb]++;
            this.say(`Object #${o.id} (${o.k.name} ${o.shape}) → <b>${BINS[eb].name}</b> ${ok ? '✔ correct' : '✘ wrong bin'} · plate levelling`);
            this.doneObj = o; this.cmdA = this.cmdB = 0;
          }
          break;
        case 'done':
          this.phaseT += dt; if (this.phaseT > .9) { this.phase = 'idle'; this.dest = -1; this.trail = []; if (this.onDone) this.onDone(); }
          break;
      }
    },
    activeParts() {
      switch (this.phase) {
        case 'feed': return new Set([1, 2]);
        case 'classify': return new Set([3, 4, 13]);
        case 'decide': return new Set([13, 12]);
        case 'tilt': return new Set([3, 5, 6, 7, 8, 9, 11, 12]);
        case 'air': case 'done': return new Set([10]);
      }
      return new Set();
    },
    tags() {
      const t = [{ anchor: [34, 24, 56], text: 'OBJECT ENTRY', dx: -80, dy: 0 }];
      if (this.dest >= 0) { const b = BOX[this.dest]; t.push({ anchor: [b[0] + b[2] / 2, b[1] + b[3] / 2, 12], text: 'TARGET: ' + BINS[this.dest].name.toUpperCase(), dx: 0, dy: -60, col: '#c0392b' }); }
      return t;
    },
    info() {
      const o = this.obj || (this.phase === 'done' ? this.doneObj : null), r = this.res, has = o && this.phase !== 'idle';
      return [['Object', has ? `#${o.id} · ${o.k.name} ${o.shape}` : '—'], ['Colour (camera)', r && has ? `hue ${Math.round((r.hue + 360) % 360)}° → <b>${r.c.toUpperCase()}</b> (${Math.round(r.conf * 100)}%)` : this.phase === 'classify' ? 'analysing…' : '—'],
        ['Destination', this.dest >= 0 ? `<b>${BINS[this.dest].name}</b>` : '—'], ['Position (x, y)', this.obj && ['classify', 'decide', 'tilt'].includes(this.phase) ? `${(this.obj.x - PC).toFixed(1)}, ${(this.obj.y - PC).toFixed(1)} cm` : '—'],
        ['Speed', this.obj && this.phase === 'tilt' ? `${Math.hypot(this.obj.vx, this.obj.vy).toFixed(1)} cm/s` : '—'],
        ['Plate tilt X / Y', `${(this.ta / DEG).toFixed(1)}° / ${(this.tb / DEG).toFixed(1)}°`], ['Servo X / Y', `${Math.round(90 + this.ta / DEG * 3)}° / ${Math.round(90 + this.tb / DEG * 3)}°`],
        ['Control', this.phase === 'tilt' ? 'PD loop running' : this.phase === 'idle' ? 'plate level' : '—']];
    },
    cameraView(c, W, H) {
      c.fillStyle = '#0b0f16'; c.fillRect(0, 0, W, H); const S = 150, ox = W / 2 - S / 2, oy = H / 2 - S / 2, f = S / 28, px = x => ox + (x - 20) * f, py = y => oy + (y - 20) * f;
      c.fillStyle = this.ledOn ? '#27313f' : '#161c26'; c.fillRect(ox, oy, S, S); c.strokeStyle = 'rgba(80,120,170,.2)'; for (let i = 0; i <= 7; i++) { c.beginPath(); c.moveTo(ox + i * S / 7, oy); c.lineTo(ox + i * S / 7, oy + S); c.moveTo(ox, oy + i * S / 7); c.lineTo(ox + S, oy + i * S / 7); c.stroke(); }
      const ec = ['#e74c3c', '#2ecc71', '#3498db', '#f1c40f']; c.lineWidth = 4;
      [[ox + S, oy + S * .1, ox + S, oy + S * .9], [ox + S * .1, oy + S, ox + S * .9, oy + S], [ox, oy + S * .1, ox, oy + S * .9], [ox + S * .1, oy, ox + S * .9, oy]].forEach((l, i) => { c.strokeStyle = this.dest === i ? '#fff' : ec[i]; c.beginPath(); c.moveTo(l[0], l[1]); c.lineTo(l[2], l[3]); c.stroke(); });
      c.font = '10px ui-monospace,Menlo,monospace'; c.fillStyle = '#6fa0d8'; c.fillText('TOP VIEW · tracker', 6, 12);
      const o = this.obj; if (!o || o.z > 20) { c.fillStyle = '#5b6b82'; c.textAlign = 'center'; c.fillText(o ? 'object falling…' : 'NO OBJECT', W / 2, H / 2); c.textAlign = 'left'; return; }
      if (this.trail.length > 1) { c.strokeStyle = 'rgba(255,150,0,.8)'; c.lineWidth = 1.5; c.beginPath(); this.trail.forEach((p, i) => i ? c.lineTo(px(p[0]), py(p[1])) : c.moveTo(px(p[0]), py(p[1]))); c.stroke(); }
      const x = px(o.x), y = py(o.y); c.fillStyle = o.k.hex; c.beginPath(); if (o.shape === 'ball') c.arc(x, y, 8, 0, 7); else c.rect(x - 7, y - 7, 14, 14); c.fill();
      c.strokeStyle = '#2cff7a'; c.lineWidth = 1.5; c.strokeRect(x - 12, y - 12, 24, 24);
      if (this.phase === 'tilt') { const T = TARGET[this.dest]; c.strokeStyle = '#fff'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(x, y); c.lineTo(px(T[0]), py(T[1])); c.stroke(); c.setLineDash([]); c.strokeStyle = '#ff7a00'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + o.vx * .4, y + o.vy * .4); c.stroke(); }
      c.fillStyle = '#2cff7a'; c.fillText(`x ${(o.x - PC).toFixed(1)}  y ${(o.y - PC).toFixed(1)}`, 6, H - 6);
    },

    /* ---------------------------------------------------------------- draw */
    plate(g) {
      const th = this, L = 20, H = 48;
      g.add([L, H, L, H, 13, 21], gg => {
        const T = (x, y, d) => gg.T(x, y, th.zt(x, y) - d), ec = '#2b7aa6';
        gg.poly([T(L, L, 0), T(H, L, 0), T(H, H, 0), T(L, H, 0)], '#7cc8ea', ec, .4);
        gg.poly([T(H, L, 0), T(H, H, 0), T(H, H, 1.2), T(H, L, 1.2)], '#4f98b8', ec, .45);
        gg.poly([T(L, H, 0), T(H, H, 0), T(H, H, 1.2), T(L, H, 1.2)], '#66b0d0', ec, .45);
      }, 2);
      for (const [x, y, w, h] of [[20, 20, 1, 4], [20, 20, 4, 1], [47, 20, 1, 4], [44, 20, 4, 1], [20, 44, 1, 4], [20, 47, 4, 1], [47, 44, 1, 4], [44, 47, 4, 1]]) g.box(x, y, this.zt(x + w / 2, y + h / 2), w, h, 1.4, '#3f8fbf', { layer: 3 });
    },
    draw(g) {
      const { WOOD, ALU } = Parts, A = this.ta, B = this.tb;
      g.box(0, 0, 0, 74, 74, 2, WOOD, { layer: 0 });
      Parts.psu(g, 6, 63, 2, 12, 6.5, 5); Parts.l298n; const blink = this.running && Math.floor(performance.now() / 250) % 2;
      g.box(21, 63.5, 2, 8, 3.4, .5, '#1f5fbf'); g.box(21.6, 63.8, 2.5, 6.8, .9, .9, '#222'); g.toptext(21.6, 66.4, 2.55, 'PCA9685', .8);
      Parts.arduino(g, 31, 63, 2, 7.6, 5.3, 'UNO'); Parts.rpi(g, 40, 62.8, 2); g.sphere(33, 64, 3.1, .35, blink ? '#ffe400' : '#6b5d00', 3); g.sphere(41.5, 63.8, 2.9, .35, this.running ? '#22ff55' : '#116622', 3);
      // bins (translucent, contents visible)
      BOX.forEach((b, i) => { for (const ob of this.bins_[i]) this.drawObj(g, ob, 1); g.box(b[0], b[1], 2, b[2], b[3], 10, BINS[i].hex, { a: .42, layer: 2 }); });
      // pivot, servos, pushrods
      g.frust(PC, PC, 2, 12, 2.4, 1.9, '#cfd4d9'); g.sphere(PC, PC, 14.9, 2.1, '#e8e8e8', 1);
      g.box(40.5, 29.8, 2, 7, 3, .6, ALU); Parts.servo(g, 41.5, 30.4, 2.6, 5, 2.6, 5.2); g.box(28.8, 39.5, 2, 3, 7, .6, ALU); Parts.servo(g, 29.6, 40.6, 2.6, 2.6, 5, 5.2);
      const dzx = -Math.tan(A) * 10, dzy = -Math.tan(B) * 10, cx = clampv((3.4 + dzx * .35) / 3.4, -1, 1), cy = clampv((3.4 + dzy * .35) / 3.4, -1, 1);
      const px = Math.acos(cx), py = Math.acos(cy), tipX = [44 + 3.4 * Math.sin(px) * Math.sign(dzx || 1) * 0, 33.6, 5.2 + 3.4 * cx], tipY = [32.8, 43.4, 5.2 + 3.4 * cy];
      g.rod([44, 33.4, 5.2], tipX, .5, '#fff', { layer: 3 }); g.rod(tipX, [44, 34, this.zt(44, 34) - .3], .3, '#9aa3ab', { layer: 3 });
      g.rod([32.4, 43.4, 5.2], tipY, .5, '#fff', { layer: 3 }); g.rod(tipY, [34, 44, this.zt(34, 44) - .3], .3, '#9aa3ab', { layer: 3 });
      // gantry, camera, ring
      Parts.post(g, 1, 1, 2, 40); g.box(1, 1, 40, 34, 2, 2, ALU); g.box(33, 1, 40, 2, 35, 2, ALU); g.rod([2, 2, 26], [16, 2, 39], .6, '#9aa3ab', { layer: 3 });
      Parts.camera(g, 31.5, 32, 36, 5, 4, 4); g.frust(34, 34, 34.2, 1.8, 1.25, 1.1, '#101214');
      g.ring(34, 34, 32.6, 6.2, this.ledOn ? .9 : .5, this.ledOn ? '#fff9c4' : '#d8d8d8', this.ledOn ? '#ffe066' : null);
      if (this.ledOn) g.over(gg => { const [x, y] = gg.T(34, 34, 17.5), c = gg.ctx, gr = c.createRadialGradient(x, y, 4, x, y, 90); gr.addColorStop(0, 'rgba(255,255,200,.35)'); gr.addColorStop(1, 'rgba(255,255,200,0)'); c.fillStyle = gr; c.fillRect(x - 95, y - 95, 190, 190); });
      // feeder
      g.frust(34, 24, 20, 14, 2, 2, '#cfe8f2', { a: .5 }); g.frust(34, 24, 34, 11, 2.2, 6, '#eef2f6', { a: .6 });
      g.box(33.35, 20.7, 24, 1.3, 1.3, 1.7, '#202226'); g.box(33.35, 26.2, 24, 1.3, 1.3, 1.7, '#202226');
      g.line3([[34, 22, 24.9], [34, 26.2, 24.9]], this.irT > 0 ? '#ffd400' : '#e53935', this.irT > 0 ? 3.4 : 1.8, this.irT > 0 ? null : [5, 4]);
      // plate + object
      this.plate(g);
      if (this.obj) {
        const o = this.obj; this.drawObj(g, o, 3);
        if (['classify', 'decide'].includes(this.phase)) g.over(gg => { const [x, y] = gg.T(o.x, o.y, o.z), a = gg.T(34, 34, 36), c = gg.ctx; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(x - 18, y + 4); c.lineTo(x + 18, y + 4); c.closePath(); c.fillStyle = 'rgba(80,255,150,.18)'; c.fill(); c.strokeStyle = '#2cff7a'; c.lineWidth = 1.6; c.strokeRect(x - 14, y - 14, 28, 28); });
        if (this.phase === 'tilt' && this.trail.length > 1) g.line3(this.trail.map(p => [p[0], p[1], this.zt(p[0], p[1]) + .2]), '#ff7a00', 2, [4, 3], .8);
        const txt = `#${o.id} ${o.k.name.toUpperCase()}`; g.over(gg => { const [x, y] = gg.T(o.x, o.y, o.z + o.r + 1.5), c = gg.ctx, w = txt.length * 6.6 + 14; c.fillStyle = 'rgba(15,27,45,.88)'; c.beginPath(); c.roundRect(x + 12, y - 26, w, 18, 9); c.fill(); c.fillStyle = '#fff'; c.font = '700 11px Helvetica,Arial'; c.fillText(txt, x + 19, y - 13); });
      }
      // tilt readout arrow when tilting
      if (this.phase === 'tilt' || Math.abs(A) + Math.abs(B) > .01) g.over(gg => { const [x, y] = gg.T(34, 34, 19), c = gg.ctx; c.strokeStyle = '#ff7a00'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (A - B) * C30 * 340, y + (A + B) * .5 * 340); c.stroke(); });
    },
    drawObj(g, o, lay) { if (o.shape === 'ball') g.sphere(o.x, o.y, o.z, o.r, o.k.hex, lay); else g.cube(o.x, o.y, o.z - o.r, o.r * 2, o.r * 2, o.r * 2, o.yaw, o.k.hex, lay); },
  };
  sim.reset();
  window.addEventListener('DOMContentLoaded', () => { window.shell = new Shell(sim); });
})();
