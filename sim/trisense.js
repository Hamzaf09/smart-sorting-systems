'use strict';
/* TRISENSE LINE – conveyor: IR entry → camera + ToF height + inductive metal → fused decision → servo pushers → bins */
(() => {
  const G = 260, DEG = Math.PI / 180, BELT_V = 12, YC = 6;
  const KINDS = [
    { id: 'red', name: 'Red', hex: '#e53935', hue: 2 }, { id: 'green', name: 'Green', hex: '#2ecc71', hue: 135 },
    { id: 'blue', name: 'Blue', hex: '#3498db', hue: 207 }, { id: 'yellow', name: 'Yellow', hex: '#f1c40f', hue: 51 },
    { id: 'unknown', name: 'Unknown', hex: '#9b59b6', hue: 285 }];
  const BINS = [{ name: 'Red bin (pusher 1)', hex: '#e74c3c' }, { name: 'Green bin (pusher 2)', hex: '#2ecc71' }, { name: 'Blue bin (pusher 3)', hex: '#3498db' }, { name: 'Reject bin (belt end)', hex: '#8a949e' }];
  const CLASSES = ['red', 'green', 'blue'];
  const PX = [38.9, 48.9, 58.9]; // pusher pivots
  const randn = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); };
  const hueClass = h => { h = (h + 360) % 360; if (h < 20 || h > 340) return 'red'; if (h >= 35 && h <= 75) return 'yellow'; if (h >= 90 && h <= 160) return 'green'; if (h >= 190 && h <= 250) return 'blue'; return 'unknown'; };
  const slot = k => { const layer = Math.floor(k / 6), i = k % 6; return [(i % 3 - 1) * 3.2, (Math.floor(i / 3) - .5) * 4.5, layer]; };
  const binBox = i => i < 3 ? [36 + 10 * i, 14.5, 10, 14] : [66.8, 0, 12, 12];

  const sim = {
    num: '04', title: 'TRISENSE LINE', subtitle: 'Conveyor scanning colour (camera) + height (ToF) + metal (inductive) · servo pushers · 3 bins + reject',
    kinds: KINDS, bins: BINS, options: [
      { id: 'metal', label: 'New objects are METALLIC (inductive sensor flags them)', value: false },
      { id: 'big', label: 'New objects are OVERSIZE (ToF height > 35 mm)', value: false },
      { id: 'noise', label: 'Noisy camera', value: false }],
    opts: {}, bounds: { x: [-31, 89], y: [-17, 29], z: [0, 30] }, floor: [-34, 92, -20, 32],
    queue: [], log: [], counts: [0, 0, 0, 0], stats: { sorted: 0, correct: 0, rejected: 0 }, stage: 'IDLE', progress: 0, time: 0,
    parts: [
      { n: 1, cat: 'bin', name: 'Entry funnel guides', func: 'Centre objects onto the belt (object entry)', anchor: [-4, -3.5, 15.5] },
      { n: 2, cat: 'sense', name: 'IR break-beam', func: 'Detects an object, starts the scan', anchor: [9.65, -1.8, 12.6] },
      { n: 3, cat: 'sense', name: 'Camera', func: 'Colour + shape under controlled light', anchor: [22, 4.4, 27.2], side: 'R' },
      { n: 4, cat: 'sense', name: 'LED light bars', func: 'Shadow-free lighting in the tunnel', anchor: [25.4, 10.6, 27.2], side: 'R' },
      { n: 5, cat: 'sense', name: 'ToF height sensor (VL53L0X)', func: 'Measures object height → size class', anchor: [22, 1.4, 26.2], side: 'R' },
      { n: 6, cat: 'sense', name: 'Inductive sensor', func: 'Flags metal objects under the belt', anchor: [32.2, 6, 11.6], side: 'R' },
      { n: 7, cat: 'struct', name: 'Conveyor belt + rollers', func: 'Carries objects through every station', anchor: [12, 8, 12.9] },
      { n: 8, cat: 'act', name: 'DC gear motor', func: 'Drives the belt roller', anchor: [63.8, -14, 13.1] },
      { n: 9, cat: 'ctrl', name: 'L298N motor driver', func: 'PWM speed control of the belt', anchor: [-12.5, 1.3, 4.5] },
      { n: 10, cat: 'ctrl', name: 'Arduino Mega', func: 'Sensor fusion, encoder-free timing', anchor: [-24.7, 10.6, 3.8] },
      { n: 11, cat: 'ctrl', name: 'Raspberry Pi 4', func: 'OpenCV classification', anchor: [-11.7, 10.8, 3.7] },
      { n: 12, cat: 'ctrl', name: '12 V power supply', func: 'Motor + logic power', anchor: [-24.5, 1, 8] },
      { n: 13, cat: 'act', name: 'Servo pushers ×3', func: 'Swing paddles to shove object into bin', anchor: [38.9, -2.2, 15.6] },
      { n: 14, cat: 'bin', name: 'Collection bins ×3', func: 'Red / green / blue destinations', anchor: [41, 28.5, 6] },
      { n: 15, cat: 'bin', name: 'Reject bin', func: 'End-of-belt catch for unknown objects', anchor: [78.8, 6, 5] },
      { n: 16, cat: 'struct', name: 'Aluminium frame', func: '2020 profile legs + rails', anchor: [27, 14, 5] },
    ],
    reset() {
      this.objs = []; this.bins_ = [[], [], [], []]; this.log = []; this.time = 0; this.stats = { sorted: 0, correct: 0, rejected: 0 }; this.counts = [0, 0, 0, 0]; this.stage = 'IDLE'; this.progress = 0;
      this.nextId = 1; this.belt = 0; this.queue.length = 0; this.last = null; this.irT = 0; this.tofT = 0; this.indT = 0; this.ledOn = false; this.doneT = []; this.focus = null;
      this.pushers = PX.map(x => ({ x, phi: 0, st: 'idle', obj: null, t: 0 }));
      [['red', 'ball'], ['green', 'cube'], ['blue', 'ball'], ['yellow', 'cube'], ['unknown', 'ball'], ['red', 'cube'], ['green', 'ball']].forEach(([k, s]) => this.enqueue(k, s));
      this.say('System ready. Press ▶ Start.');
    },
    say(t) { this.log.push(`<b>${this.time.toFixed(1)}s</b> ${t}`); },
    enqueue(kind, shape) { if (this.queue.length < 30) this.queue.push({ kind, shape, metal: !!this.opts.metal, big: !!this.opts.big }); },

    update(dt, running) {
      if (dt > 0) this.time += dt;
      if (this.irT > 0) this.irT -= dt; if (this.tofT > 0) this.tofT -= dt; if (this.indT > 0) this.indT -= dt;
      const moving = running && (this.objs.length > 0 || this.queue.length > 0), v = moving ? BELT_V : 0; this.v = v; this.belt += v * dt;
      // spawn
      if (running && this.queue.length && this.objs.every(o => o.x > 22 || o.st === 'bin' || o.st === 'air') && this.objs.filter(o => o.st === 'drop').length === 0) {
        const q = this.queue.shift(), k = KINDS.find(k => k.id === q.kind), r = (q.shape === 'ball' ? 1.5 : 1.25) * (q.big ? 1.6 : 1);
        this.objs.push({ id: this.nextId++, kind: q.kind, k, shape: q.shape, metal: q.metal, big: q.big, r, x: 3, y: YC + (Math.random() - .5) * 1.6, z: 26, vz: 0, yaw: 0, st: 'drop', bounced: false, ev: {}, res: {}, dest: -1 });
        this.say(`Object #${this.nextId - 1} (${k.name} ${q.shape}${q.metal ? ', metal' : ''}${q.big ? ', oversize' : ''}) placed at the entry`);
      }
      for (const o of this.objs) {
        if (o.st === 'drop') {
          o.vz -= G * dt; o.z += o.vz * dt; const rest = 12.8 + o.r;
          if (o.z <= rest) { o.z = rest; if (!o.bounced && o.vz < -25) { o.vz *= -.25; o.bounced = true; } else { o.vz = 0; o.st = 'belt'; } }
        } else if (o.st === 'belt') {
          o.x += v * dt; o.z = 12.8 + o.r; if (o.pushed) { /* handled by pusher */ }
          const e = o.ev;
          if (!e.ir && o.x >= 9.65) { e.ir = 1; this.irT = .5; this.say(`#${o.id}: IR gate triggered → scan timer started`); }
          if (o.x >= 18 && o.x < 26) this.ledOn = true;
          if (!e.cam && o.x >= 22) {
            e.cam = 1; const hue = o.k.hue + randn() * (this.opts.noise ? 16 : 3), c = hueClass(hue), conf = clampv(.97 - Math.abs(randn()) * (this.opts.noise ? .22 : .03), .3, .995), hmm = Math.round(o.r * 20 + randn() * 1.2);
            o.res.hue = hue; o.res.c = c; o.res.conf = conf; o.res.h = hmm; this.tofT = .5; this.say(`#${o.id}: camera ${c.toUpperCase()} (${Math.round(conf * 100)}%) · ToF height ${hmm} mm`);
          }
          if (!e.ind && o.x >= 32.2) { e.ind = 1; o.res.metal = o.metal; if (o.metal) this.indT = .8; this.say(`#${o.id}: inductive sensor → ${o.metal ? '<b>METAL</b>' : 'non-metal'}`); }
          if (!e.dec && o.x >= 34) {
            e.dec = 1; const r = o.res, okH = r.h >= 20 && r.h <= 35, okC = CLASSES.includes(r.c) && r.conf >= .7, ok = okH && okC && !r.metal; o.dest = ok ? CLASSES.indexOf(r.c) : 3;
            r.why = ok ? 'all checks pass' : !okC ? (r.c === 'unknown' ? 'colour not recognised' : r.c === 'yellow' ? 'colour has no pusher' : 'low confidence') : r.metal ? 'metal' : 'height out of range';
            this.say(`#${o.id}: fusion → <b>${BINS[o.dest].name}</b> (${r.why})`);
          }
          if (o.x >= 66.2) { this.launch(o, 3, 12); }
        } else if (o.st === 'air') {
          o.vz -= G * dt; o.z += o.vz * dt; o.x += o.hx * dt; o.y += o.hy * dt; o.t0 += dt;
          if (o.t0 >= o.T || o.z <= o.tgt[2]) {
            [o.x, o.y, o.z] = o.tgt; o.st = 'bin'; this.bins_[o.bin].push(o); this.counts[o.bin]++;
            const truth = (CLASSES.includes(o.kind) && !o.metal && !o.big) ? CLASSES.indexOf(o.kind) : 3, ok = truth === o.bin;
            this.stats.sorted++; if (ok) this.stats.correct++; if (o.bin === 3) this.stats.rejected++; this.lastDone = o; this.doneT.push([o, this.time]);
            this.say(`#${o.id} (${o.k.name}${o.metal ? ' metal' : ''}${o.big ? ' oversize' : ''}) → <b>${BINS[o.bin].name}</b> ${ok ? '✔ correct' : '✘ wrong'}`);
          }
        }
      }
      this.objs = this.objs.filter(o => o.st !== 'bin');
      this.ledOn = this.objs.some(o => o.st === 'belt' && o.x >= 18 && o.x < 26);
      // pushers
      for (let i = 0; i < 3; i++) {
        const p = this.pushers[i];
        if (p.st === 'idle') { const o = this.objs.find(o => o.st === 'belt' && o.dest === i && o.x >= p.x + 1.5); if (o) { p.st = 'swing'; p.obj = o; p.t = 0; o.pushed = true; this.say(`Pusher ${i + 1} fires for #${o.id}`); } }
        else if (p.st === 'swing') {
          p.t += dt; p.phi = Math.min(82, p.phi + 230 * dt); const o = p.obj;
          if (o.st === 'belt') { const yc = .4 + Math.max(0, o.x - p.x) * Math.tan(p.phi * DEG); if (yc + o.r > o.y - o.r * 0 && o.x <= p.x + 7.5) o.y = Math.min(o.y + 55 * dt, yc + o.r + .2); if (o.y >= 11.6) this.launch(o, i, o.y); }
          if (o.st !== 'belt' || p.t > 1) p.st = 'return';
        } else if (p.st === 'return') { p.phi = Math.max(0, p.phi - 200 * dt); if (p.phi <= 0) { p.st = 'idle'; p.obj = null; } }
      }
      // stage of focus object (most advanced unfinished)
      const act = this.objs.filter(o => o.st !== 'bin'), f = act.sort((a, b) => b.x - a.x)[0]; this.focus = f || null;
      if (f) { const x = f.st === 'air' ? 99 : f.x; this.stage = x < 18 ? 'DETECTING' : x < 26 ? 'CLASSIFYING' : x < 36 ? 'DECISION' : 'SORTING'; this.progress = f.st === 'air' ? .95 : clampv(f.x / 66, 0, 1); }
      else { this.stage = this.stats.sorted ? 'COMPLETED' : 'IDLE'; this.progress = this.stats.sorted ? 1 : 0; if (running && !this.queue.length && this.stats.sorted && this.onDone && !this._d) { this._d = 1; this.onDone(); } if (this.queue.length) this._d = 0; }
      if (f) this._d = 0;
    },
    launch(o, bin, fromY) {
      const b = binBox(bin), n = this.bins_[bin].length, sl = slot(n), tx = b[0] + b[2] / 2 + sl[0], ty = b[1] + b[3] / 2 + sl[1], zf = .8 + o.r + sl[2] * o.r * 2, dz = Math.max(.5, o.z - zf), T = Math.sqrt(2 * dz / G) + .08;
      o.bin = bin; o.tgt = [tx, ty, zf]; o.T = T; o.t0 = 0; o.hx = (tx - o.x) / T; o.hy = (ty - o.y) / T; o.vz = 0; o.st = 'air';
    },
    activeParts() {
      const s = new Set(); if (this.v > 0) [7, 8, 9].forEach(n => s.add(n));
      for (const o of this.objs) { if (o.st === 'drop' || (o.st === 'belt' && o.x < 18)) [1, 2].forEach(n => s.add(n)); else if (o.st === 'belt' && o.x < 26) [3, 4, 5, 11].forEach(n => s.add(n)); else if (o.st === 'belt' && o.x < 36) [6, 10, 11].forEach(n => s.add(n)); else if (o.st !== 'bin') { [13, 10].forEach(n => s.add(n)); s.add(o.dest === 3 || o.bin === 3 ? 15 : 14); } }
      return s;
    },
    tags() {
      const t = [{ anchor: [-4, 3, 17.5], text: 'OBJECT ENTRY', dx: -46, dy: -40 }, { anchor: [72, 6, 11], text: 'REJECT / UNKNOWN', dx: 40, dy: 46, col: '#c0392b' }];
      const f = this.focus; if (f && f.dest >= 0) { const b = binBox(f.dest); t.push({ anchor: [b[0] + b[2] / 2, b[1] + b[3] / 2, 11], text: 'TARGET: ' + BINS[f.dest].name.toUpperCase(), dx: 40, dy: 50, col: '#1e9e55' }); }
      return t;
    },
    info() {
      const f = this.focus || this.lastDone, r = f && f.res, has = !!f;
      return [['Object', has ? `#${f.id} · ${f.k.name} ${f.shape}${f.metal ? ' · metal' : ''}${f.big ? ' · oversize' : ''}` : '—'],
        ['Camera colour', r && r.c ? `hue ${Math.round((r.hue + 360) % 360)}° → <b>${r.c.toUpperCase()}</b> (${Math.round(r.conf * 100)}%)` : '—'],
        ['ToF height', r && r.h ? `${r.h} mm ${r.h >= 20 && r.h <= 35 ? '✔' : '✘ out of 20–35'}` : '—'],
        ['Inductive', r && r.metal !== undefined ? (r.metal ? '<span style="color:#c0392b">METAL ✘</span>' : 'non-metal ✔') : '—'],
        ['Fusion result', f && f.dest >= 0 ? `<b>${BINS[f.dest].name}</b> · ${r.why}` : '—'],
        ['Belt speed', `${this.v || 0} cm/s · PWM ${this.v ? 62 : 0}%`], ['On belt', this.objs.filter(o => o.st !== 'bin').length], ['Pushers', this.pushers.map((p, i) => `${i + 1}:${p.st === 'idle' ? 'rest' : Math.round(p.phi) + '°'}`).join('  ')],
        ['Throughput', this.stats.sorted && this.time ? `${(this.stats.sorted / this.time * 60).toFixed(0)} obj/min` : '—']];
    },
    cameraView(c, W, H) {
      c.fillStyle = '#0b0f16'; c.fillRect(0, 0, W, H); c.font = '10px ui-monospace,Menlo,monospace'; c.fillStyle = '#6fa0d8'; c.fillText('TUNNEL CAM · x 18–26 cm', 6, 12);
      c.fillStyle = this.ledOn ? '#2b3442' : '#171c25'; c.fillRect(0, 30, W, 110); c.strokeStyle = '#4a5568'; c.beginPath(); c.moveTo(0, 30); c.lineTo(W, 30); c.moveTo(0, 140); c.lineTo(W, 140); c.stroke();
      const off = (this.belt * 6) % 20; c.strokeStyle = 'rgba(120,140,170,.25)'; for (let x = -off; x < W; x += 20) { c.beginPath(); c.moveTo(x, 30); c.lineTo(x, 140); c.stroke(); }
      c.strokeStyle = 'rgba(44,255,122,.5)'; c.setLineDash([4, 3]); c.strokeRect(W / 2 - 55, 36, 110, 98); c.setLineDash([]);
      const o = this.objs.filter(o => o.st === 'belt' && o.x > 12 && o.x < 32).sort((a, b) => Math.abs(a.x - 22) - Math.abs(b.x - 22))[0];
      if (!o) { c.fillStyle = '#5b6b82'; c.textAlign = 'center'; c.fillText('belt empty', W / 2, 90); c.textAlign = 'left'; return; }
      const x = W / 2 + (o.x - 22) * 13, y = 85, s = o.r * 15; c.fillStyle = o.k.hex; c.beginPath(); if (o.shape === 'ball') c.arc(x, y, s, 0, 7); else c.rect(x - s, y - s, s * 2, s * 2); c.fill();
      if (o.x >= 18 && o.x <= 26) { c.strokeStyle = '#2cff7a'; c.lineWidth = 1.5; c.strokeRect(x - s - 5, y - s - 5, s * 2 + 10, s * 2 + 10); c.fillStyle = '#2cff7a'; c.fillText(o.res.c ? `${o.res.c.toUpperCase()} ${Math.round(o.res.conf * 100)}%  h=${o.res.h}mm` : 'tracking…', Math.max(4, x - 50), y - s - 9); }
      c.lineWidth = 1;
    },

    /* ----------------------------------------------------------------- draw */
    drawObj(g, o, lay) { if (o.shape === 'ball') g.sphere(o.x, o.y, o.z, o.r, o.k.hex, lay); else g.cube(o.x, o.y, o.z - o.r, o.r * 2, o.r * 2, o.r * 2, o.yaw, o.k.hex, lay); if (o.metal) g.sphere(o.x - o.r * .5, o.y - o.r * .3, o.z + o.r * .9, o.r * .22, '#ffffff', lay); },
    draw(g) {
      const { ALU, ACR } = Parts, blink = this.running && Math.floor(performance.now() / 250) % 2;
      g.box(-31, -3, 0, 25, 20, 3, '#2f343b', { layer: 0 });
      Parts.psu(g, -30, -2, 3, 11, 6, 5); Parts.l298n(g, -16, -1.5, 3, 7, 5.6, 'L298N'); Parts.arduino(g, -30, 8, 3, 10.5, 5.3, 'MEGA'); Parts.rpi(g, -16, 8, 3);
      g.sphere(-27, 9, 3.9, .35, blink ? '#ffe400' : '#6b5d00', 3); g.sphere(-14, 9, 3.8, .35, this.running ? '#22ff55' : '#116622', 3);
      for (const x of [2, 28, 56]) { g.box(x, -2, 0, 2, 2, 8.4, ALU); g.box(x, -2, 6, 2, 16, 1.6, ALU); }
      for (const x of [2, 26]) g.box(x, 12, 0, 2, 2, 8.4, ALU);
      g.box(0, -2, 8.4, 61, 2, 2.8, ALU); g.box(0, 12, 8.4, 28, 2, 2.8, ALU);
      g.box(2.2, .5, 8.4, 61.6, 11, .3, '#2a2d32'); g.box(2.2, .5, 12.4, 61.6, 11, .4, '#3c4045');
      const ph = this.belt % 4.2; for (let x = 5 - 4.2 + ph; x < 60; x += 4.2) if (x > 3 && x < 62) g.box(x, .9, 12.8, .5, 10.2, .22, '#6a717a');
      g.cyl('y', 2.2, -.2, 10.6, 12.4, 2.2, '#a1a8af'); g.cyl('y', 63.8, -.2, 10.6, 12.4, 2.2, '#a1a8af');
      const ang = this.belt / 2.2; for (const xc of [2.2, 63.8]) g.sphere(xc + 1.7 * Math.cos(ang), 12.5, 10.6 + 1.7 * Math.sin(ang), .35, '#ff7a00', 3);
      g.cyl('y', 63.8, -6.8, 10.6, 6.6, .7, '#d0d4d8'); g.box(60.8, -10.6, 8.2, 6, 3.8, 4.8, '#c9ced3'); g.cyl('y', 63.8, -17.6, 10.6, 7, 2.5, '#d9a41a');
      g.box(59.8, -13, 6.2, 8, 8, 1.2, ALU); g.box(60.4, -12.6, 0, 1.6, 1.6, 6.2, ALU); g.box(66, -12.6, 0, 1.6, 1.6, 6.2, ALU);
      g.wire([[-12, -3, 3.4], [-12, -10, .5], [62.5, -10, .5], [63.8, -14, .5], [63.8, -14, 8.2]], '#222', .3);
      // entry
      g.box(0, 0, 12.8, 7, .8, 5, ACR, { a: .4 }); g.box(0, 11.2, 12.8, 7, .8, 5, ACR, { a: .4 });
      g.quad([[-8, -7, 12.8], [0, 0, 12.8], [0, 0, 18], [-8, -7, 18]], ACR, .4); g.quad([[-8, 19, 12.8], [0, 12, 12.8], [0, 12, 18], [-8, 19, 18]], ACR, .4);
      g.box(9, -1.8, 11.2, 1.3, 1.3, 1.7, '#202226'); g.box(9, 12.2, 11.2, 1.3, 1.3, 1.7, '#202226');
      g.line3([[9.65, -.5, 13.9], [9.65, 12.2, 13.9]], this.irT > 0 ? '#ffd400' : '#e53935', this.irT > 0 ? 3.4 : 1.8, this.irT > 0 ? null : [5, 4]);
      // tunnel
      for (const [px, py] of [[18, -2], [24, -2], [18, 12], [24, 12]]) g.box(px, py, 11.2, 2, 2, 16, '#25282d');
      g.box(18, -2, 27.2, 8, 16, 2, '#25282d'); const lc = this.ledOn ? '#ffffff' : '#fff8cc'; g.box(18.6, 1, 26.9, 6.8, .8, .3, lc, { layer: 3 }); g.box(18.6, 10.2, 26.9, 6.8, .8, .3, lc, { layer: 3 });
      Parts.camera(g, 20.2, 4.4, 23.6, 3.6, 3.6, 3.2); g.frust(22, 6.2, 22.4, 1.2, 1, .9, '#101214'); g.box(20.4, 1.2, 26, 3.2, 2.2, .8, '#7d3c98', { layer: 3 });
      if (this.ledOn) g.over(gg => { const [x, y] = gg.T(22, 6, 14), c = gg.ctx, gr = c.createRadialGradient(x, y, 3, x, y, 60); gr.addColorStop(0, 'rgba(255,255,210,.4)'); gr.addColorStop(1, 'rgba(255,255,210,0)'); c.fillStyle = gr; c.fillRect(x - 64, y - 64, 128, 128); });
      g.line3([[22, 2.6, 26.2], [22, 2.6, 13.4]], this.tofT > 0 ? '#ffd400' : 'rgba(229,57,53,.55)', this.tofT > 0 ? 3 : 1.4, [3, 3]);
      // inductive
      g.box(30, 4, 5.8, 4.4, 4, .8, ALU); g.frust(32.2, 6, 6.6, 5.4, 1.6, 1.6, this.indT > 0 ? '#ff5a36' : '#c9a227');
      if (this.indT > 0) g.ring(32.2, 6, 12.1, 3.2, .5, '#ff5a36', '#ff9a7a');
      // pushers, chute plates, bins
      for (let i = 0; i < 3; i++) {
        const x0 = 36 + 10 * i, p = this.pushers[i]; Parts.servo(g, x0 + .6, -2.2, 11.2, 4.6, 2.2, 4.4); g.frust(x0 + 2.9, .4, 15.6, .6, 1, 1, '#fff');
        const ph = p.phi * DEG, cxp = x0 + 2.9 + 3.5 * Math.cos(ph), cyp = .4 + 3.5 * Math.sin(ph); g.cube(cxp, cyp, 12.8, 7, .7, 3.6, ph, '#f2f2f2', 2);
        g.quad([[x0, 12, 12.4], [x0 + 10, 12, 12.4], [x0 + 10, 15.4, 9.8], [x0, 15.4, 9.8]], '#8a9097');
      }
      for (let i = 0; i < 4; i++) { const b = binBox(i); for (const ob of this.bins_[i]) this.drawObj(g, ob, 1); g.box(b[0], b[1], 0, b[2], b[3], 10, BINS[i].hex, { a: .42, layer: 2 }); }
      for (const o of this.objs) { if (o.st === 'bin') continue; this.drawObj(g, o, o.z > 20 ? 3 : 1); }
      for (const o of this.objs) if (o.st !== 'bin' && o.x < 70) { const txt = `#${o.id}`; g.over(gg => { const [x, y] = gg.T(o.x, o.y, o.z + o.r + 1.2), c = gg.ctx, w = 30; c.fillStyle = 'rgba(15,27,45,.88)'; c.beginPath(); c.roundRect(x - w / 2, y - 24, w, 16, 8); c.fill(); c.fillStyle = '#fff'; c.font = '700 10.5px Helvetica,Arial'; c.textAlign = 'center'; c.fillText(txt, x, y - 12); c.textAlign = 'left'; }); }
      // flow arrow along belt
      g.line3([[-11, 6, 17.5], [0, 6, 15.8], [22, 6, 15.4], [56, 6, 15.4], [66, 6, 15.4]], 'rgba(255,122,0,.55)', 2.4, [8, 6]);
    },
  };
  sim.reset();
  window.addEventListener('DOMContentLoaded', () => { window.shell = new Shell(sim); });
})();
