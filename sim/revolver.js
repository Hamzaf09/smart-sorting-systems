'use strict';
/* REVOLVER VAULT – working simulation (hopper → IR gate → chamber → classify → stepper-indexed chute → cup) */
(() => {
  const CX = 30, CY = 30, G = 260, RING_RATIO = 6.6 / 1.2, DEG = Math.PI / 180;
  const KINDS = [
    { id: 'red', name: 'Red', hex: '#e53935', hue: 2, rgb: [211, 47, 47] },
    { id: 'green', name: 'Green', hex: '#2ecc71', hue: 135, rgb: [46, 190, 100] },
    { id: 'blue', name: 'Blue', hex: '#3498db', hue: 207, rgb: [52, 130, 220] },
    { id: 'yellow', name: 'Yellow', hex: '#f1c40f', hue: 51, rgb: [240, 196, 20] },
    { id: 'unknown', name: 'Unknown', hex: '#9b59b6', hue: 285, rgb: [150, 80, 180] },
  ];
  const BINS = [{ name: 'Red cup', hex: '#e74c3c' }, { name: 'Green cup', hex: '#2ecc71' }, { name: 'Blue cup', hex: '#3498db' }, { name: 'Yellow cup', hex: '#f1c40f' }, { name: 'Reject cup', hex: '#8a949e' }];
  const CLASSES = ['red', 'green', 'blue', 'yellow'];
  const randn = () => { let u = 0, v = 0; while (!u) u = Math.random(); v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const cupPos = i => [CX + 20 * Math.cos(72 * i * DEG), CY + 20 * Math.sin(72 * i * DEG)];
  const hueClass = h => { h = (h + 360) % 360; if (h < 20 || h > 340) return 'red'; if (h >= 35 && h <= 75) return 'yellow'; if (h >= 90 && h <= 160) return 'green'; if (h >= 190 && h <= 250) return 'blue'; return 'unknown'; };
  const rgbClass = rgb => { let best = 'unknown', bd = 95; for (const k of KINDS) { if (k.id === 'unknown') continue; const d = Math.hypot(rgb[0] - k.rgb[0], rgb[1] - k.rgb[1], rgb[2] - k.rgb[2]); if (d < bd) { bd = d; best = k.id; } } return best; };
  const slot = n => { const layer = Math.floor(n / 7), i = n % 7; return i === 0 ? [0, 0, layer] : [3.2 * Math.cos((i - 1) * 60 * DEG + layer), 3.2 * Math.sin((i - 1) * 60 * DEG + layer), layer]; };
  const AL = Math.atan2(6.2, 17), SIN_A = Math.sin(AL), COS_A = Math.cos(AL);
  const shortest = (from, to) => ((to - from + 540) % 360) - 180;

  const sim = {
    num: '02', title: 'REVOLVER VAULT', subtitle: 'Drop-in inspection chamber · stepper-indexed rotating chute · 5 cups',
    kinds: KINDS, bins: BINS, options: [
      { id: 'fault', label: 'Inject RGB-sensor fault (sensors disagree → reject)', value: false },
      { id: 'noise', label: 'Noisy camera (harder classification)', value: false }],
    opts: {}, bounds: { x: [-3, 63], y: [-4, 72], z: [0, 64] }, floor: [-6, 66, -7, 75],
    queue: [], log: [], counts: [0, 0, 0, 0, 0], stats: { sorted: 0, correct: 0, rejected: 0 }, stage: 'IDLE', progress: 0, time: 0,
    parts: [
      { n: 1, cat: 'bin', name: 'Hopper funnel (object entry)', func: 'Objects dropped in here, one at a time', anchor: [34.4, 30, 46] },
      { n: 2, cat: 'sense', name: 'IR break-beam gate', func: 'Detects arrival → triggers inspection', anchor: [30, 33.2, 39.7] },
      { n: 3, cat: 'struct', name: 'Acrylic inspection chamber', func: 'Light-controlled box, object sits on trapdoor', anchor: [35, 26, 34] },
      { n: 4, cat: 'sense', name: 'Camera', func: 'OpenCV colour + shape classification', anchor: [30, 38.4, 30] },
      { n: 5, cat: 'sense', name: 'RGB colour sensor + LEDs', func: 'Second opinion on colour (fast)', anchor: [36.4, 30, 30] },
      { n: 6, cat: 'act', name: 'Trapdoor servo (scotch yoke)', func: 'Slides the trapdoor open after the decision', anchor: [38.4, 31.5, 20] },
      { n: 7, cat: 'act', name: 'NEMA 17 stepper', func: 'Indexes the chute to any cup angle', anchor: [15, 32.3, 15.5] },
      { n: 8, cat: 'struct', name: 'GT2 belt + rotary ring', func: 'Transmits stepper motion (5.5:1) to the chute', anchor: [20, 28.4, 18] },
      { n: 9, cat: 'struct', name: 'Rotating funnel + chute', func: 'Slides object into the selected cup', anchor: [33, 30, 21.5] },
      { n: 10, cat: 'bin', name: 'Collection cups ×5', func: '4 colour cups + 1 reject cup', anchor: [13.8, 49.2, 7] },
      { n: 11, cat: 'ctrl', name: 'Arduino Uno', func: 'Stepper steps, servo, state machine', anchor: [28, 63.7, 2.8] },
      { n: 12, cat: 'ctrl', name: 'Raspberry Pi 4', func: 'Vision + decision logic, USB-serial to Uno', anchor: [40.3, 63.6, 2.7] },
      { n: 13, cat: 'ctrl', name: 'A4988 stepper driver', func: 'Current-limited coil drive', anchor: [17.6, 63.8, 2.6] },
      { n: 14, cat: 'ctrl', name: '12 V power supply', func: 'Motor + logic rail', anchor: [6, 64, 7] },
      { n: 15, cat: 'struct', name: 'Aluminium posts ×4', func: 'Rigid central tower', anchor: [39.1, 36, 22] },
    ],
    reset() {
      this.theta = 0; this.thetaV = 0; this.thetaTarget = 0; this.psi = 0; this.psiTarget = 0; this.obj = null; this.phase = 'idle'; this.phaseT = 0;
      this.cups = [[], [], [], [], []]; this.log = []; this.time = 0; this.stats = { sorted: 0, correct: 0, rejected: 0 }; this.counts = [0, 0, 0, 0, 0];
      this.stage = 'IDLE'; this.progress = 0; this.nextId = 1; this.ledOn = false; this.irT = 0; this.scan = 0; this.dest = -1; this.res = null; this.move = null; this.queue.length = 0;
      [['red', 'ball'], ['green', 'cube'], ['blue', 'ball'], ['yellow', 'cube'], ['unknown', 'ball']].forEach(([k, s]) => this.enqueue(k, s));
      this.say('System ready. Press ▶ Start.');
    },
    say(t) { this.log.push(`<b>${this.time.toFixed(1)}s</b> ${t}`); },
    enqueue(kind, shape) { if (this.queue.length < 30) this.queue.push({ kind, shape }); },
    discPos() { return this.psi; },
    plateDisp() { return 4.75 * (1 - Math.cos(Math.PI * this.psi)); },

    update(dt, running) {
      if (dt > 0) this.time += dt;
      this.psi += clampv(this.psiTarget - this.psi, -dt / .4, dt / .4);
      if (this.irT > 0) this.irT -= dt;
      const o = this.obj;
      switch (this.phase) {
        case 'idle':
          this.stage = this.stats.sorted ? 'COMPLETED' : 'IDLE'; this.progress = 0;
          if (running && this.queue.length) {
            const q = this.queue.shift(), k = KINDS.find(k => k.id === q.kind);
            this.obj = { id: this.nextId++, kind: q.kind, k, shape: q.shape, r: q.shape === 'ball' ? 1.5 : 1.25, x: CX, y: CY, z: 62, vz: 0, yaw: Math.random() * 3, st: 'fall', bounced: false };
            this.res = null; this.dest = -1; this.move = null; this.phase = 'feed'; this.phaseT = 0; this.stage = 'DETECTING';
            this.say(`Object #${this.obj.id} (${k.name} ${q.shape}) enters the hopper`);
          }
          break;
        case 'feed': {
          this.stage = 'DETECTING'; const prev = o.z; o.vz -= G * dt; o.z += o.vz * dt;
          if (prev > 38.9 && o.z <= 38.9) { this.irT = .5; this.say('IR gate beam broken → object detected'); }
          const rest = 25.5 + o.r;
          if (o.z <= rest) { o.z = rest; if (!o.bounced && o.vz < -30) { o.vz = -o.vz * .28; o.bounced = true; } else { o.vz = 0; this.phase = 'classify'; this.phaseT = 0; this.stage = 'CLASSIFYING'; this.ledOn = true; this.say('Object on trapdoor → LEDs on, camera + RGB sensor reading'); } }
          this.progress = clampv((62 - o.z) / 36, 0, 1) * .5;
          break; }
        case 'classify': {
          this.phaseT += dt; this.scan = clampv(this.phaseT / 1.8, 0, 1); this.progress = this.scan; this.stage = 'CLASSIFYING';
          if (this.phaseT >= 1.8) {
            const k = o.k, sigma = this.opts.noise ? 16 : 3, hue = k.hue + randn() * sigma, camC = hueClass(hue);
            const rgb = k.rgb.map(v => clampv(v + randn() * (this.opts.noise ? 40 : 12), 0, 255)); let rgbC = rgbClass(rgb);
            if (this.opts.fault) { const others = CLASSES.filter(c => c !== rgbC); rgbC = others[Math.floor(Math.random() * others.length)]; }
            const agree = camC === rgbC && camC !== 'unknown', dest = agree ? CLASSES.indexOf(camC) : 4;
            this.res = { hue, camC, rgb, rgbC, agree, conf: clampv(.97 - Math.abs(randn()) * (this.opts.noise ? .2 : .03), .3, .995), circ: o.shape === 'ball' ? .93 + Math.random() * .05 : .76 + Math.random() * .04 };
            this.dest = dest; this.ledOn = false;
            this.say(`Camera: <b>${camC.toUpperCase()}</b> (hue ${Math.round((hue + 360) % 360)}°) · RGB sensor: <b>${rgbC.toUpperCase()}</b> → ${agree ? 'agree' : camC === rgbC ? 'both unrecognised' : 'DISAGREE'}`);
            this.phase = 'decide'; this.phaseT = 0; this.stage = 'DECISION';
            const cur = ((this.theta % 360) + 360) % 360, delta = shortest(cur, 72 * dest), motorDeg = Math.abs(delta) * RING_RATIO;
            this.move = { delta, steps: Math.round(motorDeg / 1.8), dir: delta === 0 ? '—' : delta > 0 ? 'CW' : 'CCW', total: Math.abs(delta) };
            this.say(`Decision → <b>${BINS[dest].name}</b>: rotate chute ${delta.toFixed(0)}° (${this.move.steps} steps ${this.move.dir})`);
          }
          break; }
        case 'decide':
          this.phaseT += dt; this.progress = clampv(this.phaseT / .9, 0, 1);
          if (this.phaseT >= .9) { this.phase = 'rotate'; this.stage = 'SORTING'; this.thetaTarget = this.theta + this.move.delta; this.thetaV = 0; }
          break;
        case 'rotate': {
          const rem = this.thetaTarget - this.theta, dir = Math.sign(rem), vmax = 170, acc = 700;
          const want = dir * Math.min(vmax, Math.sqrt(2 * acc * Math.abs(rem)) + 4);
          this.thetaV += clampv(want - this.thetaV, -acc * dt, acc * dt); this.theta += this.thetaV * dt;
          if (Math.abs(rem) < .3 || Math.sign(this.thetaTarget - this.theta) !== dir) { this.theta = this.thetaTarget; this.thetaV = 0; this.phase = 'release'; this.psiTarget = 1; this.say('Chute aligned → trapdoor servo opens'); }
          this.progress = this.move.total ? clampv(1 - Math.abs(this.thetaTarget - this.theta) / this.move.total, 0, 1) * .5 : .5;
          break; }
        case 'release':
          this.progress = .5 + this.psi * .1;
          if (this.plateDisp() >= 4.8) { o.st = 'drop'; o.vz = 0; this.phase = 'fall'; }
          break;
        case 'fall': {
          o.vz -= G * dt; o.z += o.vz * dt; const zs = 19.6 + 1.2 + .6 * o.r; this.progress = .6;
          if (o.z <= zs) { o.z = zs; this.phase = 'slide'; o.s = 0; o.vs = 6; o.vz = 0; this.psiTarget = 0; this.say('Object in funnel → sliding down chute'); }
          break; }
        case 'slide': {
          const mu = o.shape === 'ball' ? 0 : .15, a = o.shape === 'ball' ? G * SIN_A * .714 : G * (SIN_A - mu * COS_A);
          o.vs += a * dt; o.s += o.vs * dt; const sxy = o.s * COS_A, u = [Math.cos(this.theta * DEG), Math.sin(this.theta * DEG)];
          o.x = CX + u[0] * sxy; o.y = CY + u[1] * sxy; o.z = 19.6 - sxy * Math.tan(AL) + 1.2 + .6 * o.r; o.yaw = this.theta * DEG; o.spin = (o.spin || 0) + o.vs * dt / o.r;
          this.progress = .6 + .25 * clampv(sxy / 17, 0, 1);
          if (sxy >= 17) {
            const n = this.cups[this.dest].length, sl = slot(n), cp = cupPos(this.dest), tx = cp[0] + sl[0], ty = cp[1] + sl[1], zf = 3.1 + o.r + sl[2] * o.r * 2;
            const vz = -o.vs * SIN_A, dz = o.z - zf, T = (vz + Math.sqrt(vz * vz + 2 * G * dz)) / G; o.T = T; o.t0 = 0; o.vz = vz; o.hx = (tx - o.x) / T; o.hy = (ty - o.y) / T; o.tgt = [tx, ty, zf]; this.phase = 'air';
          }
          break; }
        case 'air': {
          o.vz -= G * dt; o.z += o.vz * dt; o.x += o.hx * dt; o.y += o.hy * dt; o.t0 += dt; this.progress = .88 + .1 * clampv(o.t0 / o.T, 0, 1);
          if (o.t0 >= o.T || o.z <= o.tgt[2]) {
            o.x = o.tgt[0]; o.y = o.tgt[1]; o.z = o.tgt[2]; this.cups[this.dest].push(o); this.obj = null; this.phase = 'done'; this.phaseT = 0; this.stage = 'COMPLETED'; this.progress = 1;
            const truth = o.kind === 'unknown' ? 4 : CLASSES.indexOf(o.kind), ok = truth === this.dest;
            this.stats.sorted++; if (ok) this.stats.correct++; if (this.dest === 4) this.stats.rejected++; this.counts[this.dest]++;
            this.say(`Object #${o.id} (${o.k.name} ${o.shape}) → <b>${BINS[this.dest].name}</b> ${ok ? '✔ correct' : '✘ wrong bin'}`);
            this.doneObj = o;
          }
          break; }
        case 'done':
          this.phaseT += dt; if (this.phaseT > .9) { this.phase = 'idle'; this.dest = -1; if (this.onDone) this.onDone(); }
          break;
      }
    },
    activeParts() {
      switch (this.phase) {
        case 'feed': return new Set([1, 2]);
        case 'classify': return new Set([3, 4, 5, 12]);
        case 'decide': return new Set([11, 12]);
        case 'rotate': return new Set([7, 8, 9, 13, 14, 11]);
        case 'release': case 'fall': return new Set([6, 11]);
        case 'slide': case 'air': return new Set([9, 10]);
        case 'done': return new Set([10]);
      }
      return new Set();
    },
    tags() {
      const t = [{ anchor: [30, 30, 63], text: 'OBJECT ENTRY', dx: -78, dy: -4 }];
      if (this.dest >= 0) { const c = cupPos(this.dest); t.push({ anchor: [c[0], c[1], 12.6], text: 'TARGET: ' + BINS[this.dest].name.toUpperCase(), dx: 0, dy: 62, col: '#c0392b' }); }
      return t;
    },
    info() {
      const o = this.obj || this.doneObj, r = this.res, f = (a, b) => (this.obj || this.phase === 'done') ? a : b;
      const rows = [['Object', o && (this.obj || this.phase === 'done') ? `#${o.id} · ${o.k.name} ${o.shape}` : '—']];
      rows.push(['Size', o && this.phase !== 'idle' ? (o.shape === 'ball' ? 'Ø 30 mm' : '25 mm cube') : '—']);
      rows.push(['Camera (hue)', r && this.phase !== 'idle' ? `${Math.round((r.hue + 360) % 360)}° → <b>${r.camC.toUpperCase()}</b> (${Math.round(r.conf * 100)}%)` : this.phase === 'classify' ? 'analysing…' : '—']);
      rows.push(['Shape (circularity)', r && this.phase !== 'idle' ? `${r.circ.toFixed(2)} → ${r.circ > .85 ? 'circle' : 'square'}` : '—']);
      rows.push(['RGB sensor', r && this.phase !== 'idle' ? `(${r.rgb.map(Math.round).join(',')}) → <b>${r.rgbC.toUpperCase()}</b>` : '—']);
      rows.push(['Sensor agreement', r && this.phase !== 'idle' ? (r.agree ? '<span style="color:#1c7a45">✔ agree</span>' : '<span style="color:#c0392b">✘ ' + (r.camC === r.rgbC ? 'unrecognised' : 'disagree') + ' → reject</span>') : '—']);
      rows.push(['Destination', this.dest >= 0 ? `<b>${BINS[this.dest].name}</b>` : '—']);
      rows.push(['Stepper move', this.move ? `${this.move.delta.toFixed(0)}° · ${this.move.steps} steps ${this.move.dir}` : '—']);
      rows.push(['Chute angle', `${(((this.theta % 360) + 360) % 360).toFixed(0)}°`]);
      rows.push(['Trapdoor servo', `${Math.round(this.psi * 180)}°`]);
      return rows;
    },
    cameraView(c, W, H) {
      c.fillStyle = '#0b0f16'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(80,120,170,.15)'; c.lineWidth = 1; for (let x = 0; x < W; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = 0; y < H; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      const o = this.obj, inCh = o && ['classify', 'decide', 'rotate', 'release'].includes(this.phase), cx = W / 2, cy = H / 2 + 4;
      c.font = '10px ui-monospace,Menlo,monospace'; c.fillStyle = '#6fa0d8'; c.fillText('CH0 640×480 · HSV', 8, 14);
      c.beginPath(); c.arc(cx, cy, 52, 0, 7); c.fillStyle = this.ledOn ? '#2a313d' : '#171c25'; c.fill();
      if (!inCh) { c.fillStyle = '#5b6b82'; c.textAlign = 'center'; c.fillText(o ? 'object falling…' : 'NO OBJECT IN CHAMBER', cx, cy + 4); c.textAlign = 'left'; return; }
      const sz = o.shape === 'ball' ? 30 : 26 * 1.0;
      c.fillStyle = o.k.hex; c.beginPath(); if (o.shape === 'ball') c.arc(cx, cy, sz, 0, 7); else { c.save(); c.translate(cx, cy); c.rotate(o.yaw); c.rect(-sz, -sz, sz * 2, sz * 2); c.restore(); } c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(cx - sz * .3, cy - sz * .35, sz * .25, 0, 7); c.fill();
      const bx = cx - sz - 6, by = cy - sz - 6, bw = sz * 2 + 12; c.strokeStyle = '#2cff7a'; c.lineWidth = 1.6; c.strokeRect(bx, by, bw, bw);
      if (this.phase === 'classify') { const sx = bx + bw * this.scan; c.strokeStyle = 'rgba(44,255,122,.9)'; c.beginPath(); c.moveTo(sx, by - 8); c.lineTo(sx, by + bw + 8); c.stroke(); c.fillStyle = '#2cff7a'; c.fillText('scanning ' + Math.round(this.scan * 100) + '%', 8, H - 8); }
      else if (this.res) { c.fillStyle = '#2cff7a'; c.fillText(`${this.res.camC.toUpperCase()} ${Math.round(this.res.conf * 100)}%  circ ${this.res.circ.toFixed(2)}`, bx, by - 5); c.fillStyle = '#9fb3d1'; c.fillText(`H ${Math.round((this.res.hue + 360) % 360)}°`, 8, H - 8); }
    },

    /* ------------------------------------------------------------ drawing */
    draw(g) {
      const { WOOD, ALU, ACR } = Parts, th = this.theta * DEG, pulleyAng = this.theta * RING_RATIO * DEG;
      g.box(-3, -4, 0, 66, 76, 2, WOOD, { layer: 0 });
      g.frust(CX, CY, 2, .6, 29.5, 29.5, '#3b4048');
      Parts.psu(g, 0, 61, 2, 12, 7, 5); Parts.l298n(g, 15, 61.5, 2, 5.2, 4.6); Parts.arduino(g, 24, 61, 2, 8, 5.3, 'UNO'); Parts.rpi(g, 36, 60.8, 2);
      // blinking status LEDs on boards
      const blink = this.running && Math.floor(performance.now() / 250) % 2;
      g.sphere(26, 62, 3.1, .35, blink ? '#ffe400' : '#6b5d00', 3); g.sphere(37, 62, 2.9, .35, this.running ? '#22ff55' : '#116622', 3);
      // cups (translucent) + their contents
      const cc = ['#e74c3c', '#2ecc71', '#3498db', '#f1c40f', '#8a949e'];
      for (let i = 0; i < 5; i++) {
        const [x, y] = cupPos(i); g.frust(x, y, 2.6, 10, 7, 7.5, cc[i], { a: .42, layer: 2 });
        for (const ob of this.cups[i]) this.drawObj(g, ob);
      }
      if (this.dest >= 0) { const [x, y] = cupPos(this.dest), p = .5 + .5 * Math.sin(performance.now() / 180); g.ring(x, y, 12.8, 8.8, .4 + .3 * p, '#16c60c', '#7dff6a'); }
      // frame: 4 posts at the gaps between cups
      for (const a of [36, 108, 252, 324]) { const px = CX + 10 * Math.cos(a * DEG), py = CY + 10 * Math.sin(a * DEG); Parts.post(g, px - 1, py - 1, 2.6, 39); }
      g.box(19, 19, 41.6, 22, 22, 1.4, ALU);
      // tray frame under chamber (open centre for drop)
      g.box(23, 23, 24.2, 14, 2, .8, ALU); g.box(23, 35, 24.2, 14, 2, .8, ALU); g.box(23, 25, 24.2, 2, 10, .8, ALU); g.box(35, 25, 24.2, 2, 10, .8, ALU);
      // rotating ring, funnel, belt, stepper
      g.frust(CX, CY, 17, 1.5, 6.6, 6.6, '#d6dbe0', { hole: 4 });
      g.sphere(CX + 5.8 * Math.cos(th + 1.57), CY + 5.8 * Math.sin(th + 1.57), 18.9, .6, '#ff7a00', 3);
      g.frust(CX, CY, 18.5, 3.5, 2.2, 4.6, ACR, { a: .55 });
      const u = [Math.cos(th), Math.sin(th)], tip = [CX + 17 * u[0], CY + 17 * u[1], 13.4];
      g.rod([CX, CY, 19.6], tip, 2.0, '#6cc3e6', { a: .85, layer: 1 });
      g.box(12.7, 27.7, 13.2, 4.6, 4.6, 4.8, '#2b2f36'); g.box(12.4, 27.4, 17.9, 5.2, 5.2, .5, ALU); g.box(11, 26, 12.4, 8.6, 8.6, .8, ALU); g.box(11.3, 26.3, 2.6, 1, 1, 9.8, ALU); g.box(17.6, 33.3, 2.6, 1, 1, 9.8, ALU);
      g.frust(15, 30, 18.4, 1.4, 1.2, 1.2, '#e5e7ea');
      g.sphere(15 + .8 * Math.cos(pulleyAng), 30 + .8 * Math.sin(pulleyAng), 20, .3, '#ff7a00', 3);
      const d = 15, r1 = 1.2, r2 = 6.6, cb = (r1 - r2) / d, sb = Math.sqrt(1 - cb * cb);
      for (const sg of [1, -1]) g.rod([15 + r1 * cb, 30 + r1 * sg * sb, 18.9], [30 + r2 * cb, 30 + r2 * sg * sb, 17.9], .35, '#111', { layer: 3 });
      // neck + chamber + hopper
      g.frust(CX, CY, 36, 7, 2.4, 2.4, '#cfe8f2', { a: .5 });
      g.box(25, 25, 25, 10, 10, 11, ACR, { a: this.ledOn ? .32 : .2 });
      Parts.camera(g, 27.5, 35, 28.5, 5, 3.4, 3.8);
      g.box(35.2, 27.8, 29, 1.2, 4.4, 2.8, '#7d3c98'); const led = this.ledOn ? '#ffffff' : '#9a9a9a';
      g.sphere(35.8, 28.6, 28.6, .38, led, 3); g.sphere(35.8, 31.4, 28.6, .38, led, 3);
      if (this.ledOn) { g.over(gg => { const [px, py] = gg.T(35.4, 30, 29.5), c = gg.ctx, gr = c.createRadialGradient(px, py, 1, px, py, 34); gr.addColorStop(0, 'rgba(255,255,220,.55)'); gr.addColorStop(1, 'rgba(255,255,220,0)'); c.fillStyle = gr; c.fillRect(px - 36, py - 36, 72, 72); }); }
      // trapdoor + scotch-yoke servo
      const disp = this.plateDisp(); g.box(25.4 + disp, 25.4, 25, 11.4, 9.2, .5, '#f1c40f', { layer: 1 });
      Parts.servo(g, 36, 29, 18, 2.4, 5, 4.4); g.box(36.6, 31, 22.4, 1.6, 2, 1.8, ALU);
      const phi = Math.PI * (1 - this.psi), shaft = [37.2, 31.3, 23.1], htip = [37.2 + 4.75 * Math.cos(phi), 31.3 + 4.75 * Math.sin(phi), 23.1];
      g.rod(shaft, htip, .45, '#ffffff', { layer: 3 }); g.rod(htip, [htip[0], clampv(htip[1], 26, 34), 25], .25, '#9aa3ab', { layer: 3 });
      g.frust(CX, CY, 43, 7.5, 7, 2.4, '#e8edf2', { a: .6 });
      // IR gate (across y at x=30)
      g.box(29.35, 26.2, 38, 1.3, 1.3, 1.7, '#202226'); g.box(29.35, 32.5, 38, 1.3, 1.3, 1.7, '#202226');
      const irc = this.irT > 0 ? '#ffd400' : '#e53935';
      g.line3([[30, 27.5, 38.9], [30, 32.5, 38.9]], irc, this.irT > 0 ? 3.4 : 1.8, this.irT > 0 ? null : [5, 4]);
      // camera frustum + scan plane during classification
      if (this.phase === 'classify') {
        g.over(gg => { const c = gg.ctx, a = gg.T(30, 35, 30.4), o = this.obj, b = gg.T(o.x, o.y, o.z); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0] - 14, b[1]); c.lineTo(b[0] + 14, b[1]); c.closePath(); c.fillStyle = 'rgba(80,255,150,.16)'; c.fill(); });
        const sx = 25.4 + 9.2 * this.scan; g.quad([[sx, 25.4, 25.6], [sx, 34.6, 25.6], [sx, 34.6, 35.8], [sx, 25.4, 35.8]], '#2cff7a', .28, 2, '#2cff7a');
      }
      // object (in flight / on plate / on chute)
      if (this.obj) this.drawObj(g, this.obj);
      // label following the object
      if (this.obj) { const o = this.obj, txt = `#${o.id} ${o.k.name.toUpperCase()}`; g.over(gg => { const [px, py] = gg.T(o.x, o.y, o.z + o.r + 1.5), c = gg.ctx, w = txt.length * 6.6 + 14; c.fillStyle = 'rgba(15,27,45,.88)'; c.beginPath(); c.roundRect(px + 12, py - 26, w, 18, 9); c.fill(); c.fillStyle = '#fff'; c.font = '700 11px Helvetica,Arial'; c.fillText(txt, px + 19, py - 13); c.fillStyle = o.k.hex; c.beginPath(); c.arc(px + 12 + w - 9, py - 17, 4, 0, 7); c.fill(); }); }
    },
    drawObj(g, o) {
      const lay = o.z > 36 ? 3 : 1;
      if (o.shape === 'ball') g.sphere(o.x, o.y, o.z, o.r, o.k.hex, lay);
      else g.cube(o.x, o.y, o.z - o.r, o.r * 2, o.r * 2, o.r * 2, o.yaw, o.k.hex, lay);
    },
  };
  sim.reset();
  window.addEventListener('DOMContentLoaded', () => { window.shell = new Shell(sim); });
})();
