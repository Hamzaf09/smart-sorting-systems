'use strict';
/* CASCADE TOWER – Archimedes-screw lift → scan chamber (camera + RGB) → sliding gate → servo flap tree A / B1 / B2 → 4 bins */
(() => {
  const G = 260, DEG = Math.PI / 180, AX = -6, AY = 22.5, YC = 22.5, CX = 34;
  const FL = 26.565, FLAP_V = 200, GATE_MAX = 8, GATE_OPEN = 7.3, GATE_V = 18;
  const LIFT_V = 13, WMAX = 2.4 * 2 * Math.PI, ZBOT = 14.4, PLATE = 50.5;
  const KINDS = [
    { id: 'red', name: 'Red', hex: '#e53935', hue: 2 }, { id: 'green', name: 'Green', hex: '#2ecc71', hue: 135 },
    { id: 'blue', name: 'Blue', hex: '#3498db', hue: 207 }, { id: 'yellow', name: 'Yellow', hex: '#f1c40f', hue: 51 },
    { id: 'unknown', name: 'Unknown', hex: '#9b59b6', hue: 285 }];
  const PROTO = { red: [229, 57, 53], green: [46, 204, 113], blue: [52, 152, 219], yellow: [241, 196, 15], unknown: [155, 89, 182] };
  const BINS = [{ name: 'Red bin (code 00)', hex: '#e74c3c' }, { name: 'Green bin (code 01)', hex: '#2ecc71' }, { name: 'Blue bin (code 10)', hex: '#3498db' }, { name: 'Yellow / reject bin (code 11)', hex: '#f1c40f' }];
  const BX = [14, 26, 42, 54], CLS = ['red', 'green', 'blue', 'yellow'], BIN_TXT = ['RED', 'GREEN', 'BLUE', 'YEL / REJ'];
  const randn = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); };
  const hueClass = h => { h = (h + 360) % 360; if (h < 20 || h > 340) return 'red'; if (h >= 35 && h <= 75) return 'yellow'; if (h >= 90 && h <= 160) return 'green'; if (h >= 190 && h <= 250) return 'blue'; return 'unknown'; };
  const rgbClass = rgb => { let best = 'unknown', bd = 80; for (const k of CLS) { const p = PROTO[k], d = Math.hypot(rgb[0] - p[0], rgb[1] - p[1], rgb[2] - p[2]); if (d < bd) { bd = d; best = k; } } return best; };
  const zr = x => 22 - (7.2 / 17) * (x + 26);       // entry ramp top surface
  const zt = x => 61.6 - (10.2 / 31) * (x + 3);     // transfer ramp top surface
  const topZ = r => 61.6 + 1.12 * r + .3;
  const slot = k => { const L = Math.floor(k / 6), i = k % 6; return [(i % 3 - 1) * 1.3, (Math.floor(i / 3) - .5) * 3.4, L]; };
  const mir = p => [68 - p[0], p[1]];
  const stageRank = { ramp: 0, wait: 0, load: 1, lift: 1, top: 2, xfer: 3, enter: 4, scan: 5, decide: 6, release: 7, drop: 8, air: 9 };

  // surface polylines [x, z_surface] for the left half of the tree (A = left); right half is the mirror image about x = 34
  function leftHalf(outer) {
    const base = [[34, 44.4], [33, 43.9], [33, 43.4], [21, 36.6]];
    return outer ? base.concat([[20.4, 33.7], [18.8, 32.9], [18.8, 32.2], [14, 27.4]])
      : base.concat([[20.4, 33.3], [22.2, 32.4], [22.2, 31.2], [26, 27.4]]);
  }

  const sim = {
    num: '05', title: 'CASCADE TOWER', subtitle: 'Archimedes-screw lift · closed scan chamber (camera + RGB) · sliding gate · servo flap tree A / B1 / B2 · 4 bins',
    kinds: KINDS, bins: BINS, options: [
      { id: 'noise', label: 'Noisy camera (forces re-scans)', value: false },
      { id: 'fault', label: 'RGB sensor fault (disagrees with camera)', value: false }],
    opts: {}, bounds: { x: [-27, 66], y: [8, 44], z: [0, 76] }, floor: [-30, 70, 8, 46],
    queue: [], log: [], counts: [0, 0, 0, 0], stats: { sorted: 0, correct: 0, rejected: 0 }, stage: 'IDLE', progress: 0, time: 0,
    parts: [
      { n: 1, cat: 'bin', name: 'Entry ramp (object entry)', func: 'Operator drops object here; gravity feeds the auger', anchor: [-18, 24.9, 19.2] },
      { n: 2, cat: 'sense', name: 'IR break-beam', func: 'Detects object → starts lift motor', anchor: [-12.6, 18.5, 17.4] },
      { n: 3, cat: 'act', name: 'DC gear motor', func: 'Spins the Archimedes screw', anchor: [-6, 25.3, 6] },
      { n: 4, cat: 'struct', name: 'Archimedes-screw lift', func: 'Helix carries objects up the tube', anchor: [-6, 25.9, 38] },
      { n: 5, cat: 'struct', name: 'Transfer chute', func: 'Slides object into the inspection chamber', anchor: [12, 25.1, 57.8] },
      { n: 6, cat: 'struct', name: 'Inspection chamber + gate', func: 'Object waits on the gate while scanned', anchor: [40, 22, 57], side: 'R' },
      { n: 7, cat: 'sense', name: 'Camera', func: 'OpenCV colour / shape classification', anchor: [34, 29, 55.5], side: 'R' },
      { n: 8, cat: 'sense', name: 'RGB colour sensor', func: 'Fast colour cross-check', anchor: [41.2, 22.5, 56], side: 'R' },
      { n: 9, cat: 'act', name: 'Gate servo', func: 'Slides the floor plate open after the decision', anchor: [53.5, 23, 52.8], side: 'R' },
      { n: 10, cat: 'act', name: 'Diverter servos ×3', func: 'Set flap A, B1, B2 per class', anchor: [34, 28.6, 44] },
      { n: 11, cat: 'struct', name: 'Diverter flaps + guide planks', func: 'Binary tree: 2 levels → 4 outputs', anchor: [44, 24.8, 38.3], side: 'R' },
      { n: 12, cat: 'struct', name: 'Acrylic channel panels', func: 'Keep objects in the Plinko channel', anchor: [60, 26, 44], side: 'R' },
      { n: 13, cat: 'bin', name: 'Collection bins ×4', func: 'One per class, at the base', anchor: [54, 30, 8], side: 'R' },
      { n: 14, cat: 'ctrl', name: 'L298N motor driver', func: 'Speed control of the lift motor', anchor: [-4.8, 39.3, 3.5] },
      { n: 15, cat: 'ctrl', name: 'Arduino Mega', func: 'Flap/gate timing, motor control', anchor: [7.2, 38.6, 2.8] },
      { n: 16, cat: 'ctrl', name: 'Raspberry Pi 4', func: 'Vision + decision', anchor: [20.3, 38.8, 2.7] },
      { n: 17, cat: 'ctrl', name: 'PCA9685 servo driver', func: 'Drives 4 servos', anchor: [34, 38.2, 2.5], side: 'R' },
      { n: 18, cat: 'ctrl', name: '12 V power supply', func: 'Motor + logic rail', anchor: [-18, 39.2, 7] },
      { n: 19, cat: 'struct', name: 'Aluminium frame', func: 'Tall rigid tower, 2020 profile', anchor: [63, 18.5, 40], side: 'R' },
    ],

    reset() {
      this.objs = []; this.bins_ = [[], [], [], []]; this.log = []; this.time = 0; this.stats = { sorted: 0, correct: 0, rejected: 0 }; this.counts = [0, 0, 0, 0];
      this.stage = 'IDLE'; this.progress = 0; this.nextId = 1; this.queue.length = 0; this.focus = null; this.lastDone = null; this.irT = 0; this.camT = 0; this.rgbT = 0;
      this.motor = { w: 0, phase: 0, hold: 0 }; this.gate = { slide: 0, target: 0 }; this.flap = { A: FL, B1: FL, B2: -FL }; this.flapT = { A: FL, B1: FL, B2: -FL };
      this.ledOn = false; this.spawnCd = 0; this._d = 0;
      [['red', 'ball'], ['green', 'cube'], ['blue', 'ball'], ['yellow', 'cube'], ['unknown', 'ball'], ['red', 'cube'], ['blue', 'cube']].forEach(([k, s]) => this.enqueue(k, s));
      this.say('System ready. Press ▶ Start.');
    },
    say(t) { this.log.push(`<b>${this.time.toFixed(1)}s</b> ${t}`); },
    enqueue(kind, shape) { if (this.queue.length < 30) this.queue.push({ kind, shape }); },

    /* ---------------------------------------------------------------- path following (ramps, planks, flaps) */
    setPath(o, pts, v0) {
      o.path = pts; o.cum = [0]; for (let i = 1; i < pts.length; i++) o.cum.push(o.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      o.s = 0; o.v = v0 || 0; o.seg = 0;
    },
    follow(o, dt) {
      const P = o.path, tot = o.cum[o.cum.length - 1];
      let guard = 0;
      while (dt > 1e-6 && guard++ < 8) {
        while (o.seg < P.length - 2 && o.s >= o.cum[o.seg + 1]) o.seg++;
        const a = P[o.seg], b = P[o.seg + 1], len = Math.max(1e-6, o.cum[o.seg + 1] - o.cum[o.seg]), sin = (a[1] - b[1]) / len;
        if (o.lastSin !== undefined && o.lastSin - sin > .4) o.v *= .5;
        o.lastSin = sin;
        const acc = sin > .02 ? G * sin * (.5 + .35 * sin * sin) : -20;
        o.v = clampv(o.v + acc * dt, sin < .02 ? 8 : 0, 62);
        const rem = o.cum[o.seg + 1] - o.s, step = o.v * dt;
        if (step < rem || o.seg >= P.length - 2) { o.s = Math.min(tot, o.s + step); dt = 0; }
        else { o.s = o.cum[o.seg + 1] + 1e-6; dt -= rem / Math.max(o.v, 1e-3); if (o.seg >= P.length - 2) break; }
        if (o.s >= tot) return true;
      }
      const seg = Math.min(o.seg, P.length - 2), a = P[seg], b = P[seg + 1], t = clampv((o.s - o.cum[seg]) / Math.max(1e-6, o.cum[seg + 1] - o.cum[seg]), 0, 1);
      o.x = lerp(a[0], b[0], t); o.z = lerp(a[1], b[1], t);
      return o.s >= tot - 1e-6;
    },
    dropPath(o) {
      const k = 1.12 * o.r, a = o.bin >> 1, outer = a ? (o.bin & 1) === 1 : (o.bin & 1) === 0;
      let pts = leftHalf(outer); if (a) pts = pts.map(mir);
      return [[CX, PLATE + o.r]].concat(pts.map(p => [p[0], p[1] + k]));
    },
    launch(o) {
      const bin = o.bin, n = this.bins_[bin].length, sl = slot(n), tx = BX[bin] + sl[0], ty = YC + sl[1], zf = 2.9 + o.r + sl[2] * o.r * 2, dz = Math.max(.5, o.z - zf), T = Math.sqrt(2 * dz / G) + .06;
      o.tgt = [tx, ty, zf]; o.T = T; o.t0 = 0; o.hx = (tx - o.x) / T; o.hy = (ty - o.y) / T; o.vz = 0; o.st = 'air';
    },

    /* ---------------------------------------------------------------- sensors */
    camRead(o) { const n = this.opts.noise, hue = o.k.hue + randn() * (n ? 18 : 3); return { hue, c: hueClass(hue), conf: clampv(.97 - Math.abs(randn()) * (n ? .24 : .03), .3, .995) }; },
    rgbRead(o) {
      let rgb; if (this.opts.fault && Math.random() < .65) { const oth = CLS.filter(x => x !== o.kind); rgb = PROTO[oth[Math.floor(Math.random() * oth.length)]].map(v => v + randn() * 6); }
      else rgb = PROTO[o.kind].map(v => v + randn() * (this.opts.noise ? 22 : 6));
      rgb = rgb.map(v => clampv(Math.round(v), 0, 255)); return { rgb, c: rgbClass(rgb) };
    },

    /* ---------------------------------------------------------------- simulation step */
    update(dt, running) {
      if (dt > 0) this.time += dt;
      if (this.irT > 0) this.irT -= dt; if (this.camT > 0) this.camT -= dt; if (this.rgbT > 0) this.rgbT -= dt; if (this.spawnCd > 0) this.spawnCd -= dt;
      const O = this.objs, stepMode = window.shell && window.shell.stepMode;
      // spawn at the top of the entry ramp
      if (running && this.queue.length && O.length < 5 && this.spawnCd <= 0 && !O.some(o => o.st === 'ramp' && o.x < -19) && !(stepMode && O.length)) {
        const q = this.queue.shift(), k = KINDS.find(k => k.id === q.kind), r = q.shape === 'ball' ? 1.5 : 1.25;
        O.push({ id: this.nextId++, kind: q.kind, k, shape: q.shape, r, x: -24.5, y: YC, z: zr(-24.5) + 1.12 * r, vx: 0, vz: 0, yaw: Math.random() * 1.5, st: 'ramp', try: 0, bits: '' });
        this.spawnCd = .9; this.say(`Object #${this.nextId - 1} (${k.name} ${q.shape}) dropped on the entry ramp`);
      }
      // ---- entry ramp (queueing against the stopper)
      const ramps = O.filter(o => o.st === 'ramp').sort((a, b) => b.x - a.x);
      ramps.forEach((o, i) => {
        const lim = i ? ramps[i - 1].x - 3.5 : (O.some(p => p.st === 'wait' || p.st === 'load') ? -12.9 : -9.4);
        o.vx += 46 * dt; o.x = Math.min(lim, o.x + o.vx * dt); if (o.x >= lim) o.vx = 0; o.z = zr(o.x) + 1.12 * o.r;
        if (!o.ir && o.x >= -13.3) { o.ir = 1; this.irT = .6; this.say(`#${o.id}: IR break-beam triggered → lift motor armed`); }
        if (i === 0 && o.x >= -9.41) { o.st = 'wait'; o.vx = 0; }
      });
      // ---- loading into the tube
      const lifters = O.filter(o => o.st === 'lift').sort((a, b) => b.z - a.z);
      for (const o of O.filter(o => o.st === 'wait')) if (!O.some(p => p.st === 'load') && !lifters.some(p => p.z < 31)) { o.st = 'load'; o.t = 0; o.x0 = o.x; o.z0 = o.z; }
      for (const o of O.filter(o => o.st === 'load')) {
        o.t += dt / .5; const t = ease(clampv(o.t, 0, 1)); o.x = lerp(o.x0, AX + 1.2, t); o.y = lerp(YC, AY + 1.6, t); o.z = lerp(o.z0, ZBOT, t) + Math.sin(t * Math.PI) * 1.2;
        if (o.t >= 1) { o.st = 'lift'; o.z = ZBOT; this.say(`#${o.id}: picked up by the screw`); }
      }
      // ---- motor + lift
      const lf = O.filter(o => o.st === 'lift').sort((a, b) => b.z - a.z); let need = false;
      lf.forEach((o, i) => { o.lim = i ? lf[i - 1].z - 11 : topZ(o.r); if (o.z < o.lim - .01) need = true; });
      if (running && (need || O.some(o => o.st === 'load' || o.st === 'wait' || (o.st === 'ramp' && o.ir)))) this.motor.hold = .9; else this.motor.hold = Math.max(0, this.motor.hold - dt);
      const M = this.motor, wT = running && M.hold > 0 ? WMAX : 0; M.w += clampv(wT - M.w, -WMAX * 3 * dt, WMAX * 3 * dt); M.phase += M.w * dt; const rate = LIFT_V * M.w / WMAX; this.rate = rate;
      for (const o of lf) { o.z = Math.min(o.lim, o.z + rate * dt); if (o.i === undefined) o.i = 0; }
      const chamberFree = !O.some(p => ['xfer', 'enter', 'scan', 'decide', 'release'].includes(p.st)) && this.gate.slide < .3;
      if (lf.length && lf[0].z >= lf[0].lim - .02 && lf[0].lim === topZ(lf[0].r)) {
        const o = lf[0];
        if (chamberFree) { o.st = 'xfer'; this.setPath(o, [[AX + 1.2, topZ(o.r)], [-3, zt(-3) + 1.12 * o.r], [28, zt(28) + 1.12 * o.r]], 12); o.y0 = o.y; this.say(`#${o.id}: reached the top → transfer chute`); }
        else if (o.st === 'lift') o.waitTop = true;
      }
      // ---- chute → chamber
      for (const o of O.filter(o => o.st === 'xfer')) {
        const done = this.follow(o, dt); o.y = lerp(o.y0, YC, clampv(o.s / 5, 0, 1));
        if (done) { o.st = 'enter'; o.vx = Math.max(10, o.v * .93); o.x = 28; }
      }
      for (const o of O.filter(o => o.st === 'enter')) {
        const rem = CX - o.x; o.vx -= o.vx * o.vx / (2 * Math.max(rem, .06)) * dt; o.vx = Math.max(o.vx, 3); o.x = Math.min(CX, o.x + o.vx * dt);
        o.z = PLATE + o.r + (.9 + .12 * o.r) * clampv(1 - (o.x - 28) / 1.2, 0, 1);
        if (o.x >= CX - .01) { o.x = CX; o.st = 'scan'; o.t = 0; o.try = 0; o.cam = null; o.rgb = null; o.stepdone = {}; this.say(`#${o.id}: in the chamber → light ON, door closed`); }
      }
      // ---- scan / decide
      for (const o of O.filter(o => o.st === 'scan')) {
        o.t += dt; const sd = o.stepdone;
        if (o.t > .35 && !sd.cam) { sd.cam = 1; o.cam = this.camRead(o); this.camT = .5; this.say(`#${o.id}: camera → ${o.cam.c.toUpperCase()} (${Math.round(o.cam.conf * 100)}%)`); }
        if (o.t > .8 && !sd.rgb) { sd.rgb = 1; o.rgb = this.rgbRead(o); this.rgbT = .5; this.say(`#${o.id}: RGB sensor → ${o.rgb.c.toUpperCase()} (${o.rgb.rgb.join(',')})`); }
        if (o.t > 1.25) {
          const ok = o.cam.c === o.rgb.c && o.cam.conf >= .7 && o.cam.c !== 'unknown';
          if (ok) { o.cls = o.cam.c; o.bin = CLS.indexOf(o.cls); o.agree = 'agree ✔'; }
          else if (o.cam.c === 'unknown' && o.rgb.c === 'unknown') { o.cls = 'unknown'; o.bin = 3; o.agree = 'both unknown → reject'; o.rej = true; }
          else if (o.try < 2) { o.try++; o.t = 0; o.stepdone = {}; this.say(`#${o.id}: sensors disagree / low confidence → <b>re-scan ${o.try}</b>`); continue; }
          else { o.cls = 'unknown'; o.bin = 3; o.agree = 'no consensus → reject'; o.rej = true; }
          o.st = 'decide'; o.t = 0; o.flapSet = false; o.bits = (o.bin >> 1) + '' + (o.bin & 1);
          this.say(`#${o.id}: decision <b>${o.cls.toUpperCase()}</b> → code <b>${o.bits}</b> → ${BINS[o.bin].name}`);
        }
      }
      const treeFree = !O.some(p => p.st === 'drop');
      for (const o of O.filter(o => o.st === 'decide')) {
        o.t += dt;
        if (o.t >= .8 && treeFree) {
          if (!o.flapSet) {
            o.flapSet = true; const a = o.bin >> 1, outer = a ? (o.bin & 1) === 1 : (o.bin & 1) === 0;
            this.flapT.A = a ? -FL : FL;
            if (!a) this.flapT.B1 = outer ? FL : -FL; else this.flapT.B2 = outer ? -FL : FL;
            this.say(`Servos: flap A → ${a ? 'RIGHT' : 'LEFT'}, ${a ? 'B2' : 'B1'} → ${(a ? 'B2' : 'B1') && (outer ? 'OUTER' : 'INNER')} bin`);
          }
          if (Math.abs(this.flap.A - this.flapT.A) < 1 && Math.abs(this.flap.B1 - this.flapT.B1) < 1 && Math.abs(this.flap.B2 - this.flapT.B2) < 1) { o.st = 'release'; this.gate.target = GATE_MAX; this.say(`#${o.id}: flaps set → gate opens`); }
        }
      }
      // ---- servos + gate
      for (const f of ['A', 'B1', 'B2']) { const d = this.flapT[f] - this.flap[f]; this.flap[f] += clampv(d, -FLAP_V * dt, FLAP_V * dt); }
      const gt = this.gate; gt.slide += clampv(gt.target - gt.slide, -GATE_V * dt, GATE_V * dt);
      for (const o of O.filter(o => o.st === 'release')) if (gt.slide >= GATE_OPEN) { o.st = 'drop'; this.setPath(o, this.dropPath(o), 0); o.lastSin = undefined; o.z = PLATE + o.r; }
      // ---- gravity run through the flap tree
      for (const o of O.filter(o => o.st === 'drop')) {
        const done = this.follow(o, dt); o.y = YC; o.yaw += o.v * dt * .05;
        if (o.z < 48.2) gt.target = 0;
        if (done) this.launch(o);
      }
      for (const o of O.filter(o => o.st === 'air')) {
        o.vz -= G * dt; o.z += o.vz * dt; o.x += o.hx * dt; o.y += o.hy * dt; o.t0 += dt; if (gt.target && o.z < 48.2) gt.target = 0;
        if (o.t0 >= o.T || o.z <= o.tgt[2]) {
          [o.x, o.y, o.z] = o.tgt; o.st = 'bin'; this.bins_[o.bin].push(o); this.counts[o.bin]++;
          const truth = CLS.includes(o.kind) ? CLS.indexOf(o.kind) : 3, ok = truth === o.bin; this.stats.sorted++; if (ok) this.stats.correct++; if (o.rej) this.stats.rejected++;
          this.lastDone = o; this.say(`#${o.id} (${o.k.name}) → <b>${BINS[o.bin].name}</b> ${ok ? '✔ correct' : '✘ wrong'}`);
          if (this.onDone) this.onDone();
        }
      }
      this.objs = O.filter(o => o.st !== 'bin');
      this.ledOn = this.objs.some(o => o.st === 'scan' || o.st === 'decide' || o.st === 'release');
      // ---- focus + stage
      const act = this.objs, f = act.slice().sort((a, b) => stageRank[b.st] - stageRank[a.st])[0]; this.focus = f || null;
      if (f) {
        const r = stageRank[f.st]; this.stage = r < 5 ? 'DETECTING' : r === 5 ? 'CLASSIFYING' : r === 6 ? 'DECISION' : 'SORTING';
        this.progress = r <= 1 ? .04 + (f.st === 'lift' ? .16 * (f.z - ZBOT) / 48 : .02) : r === 2 ? .2 : r === 3 ? .26 : r === 4 ? .3 : r === 5 ? .34 + .24 * clampv(f.t / 1.25, 0, 1) : r === 6 ? .64 : r === 7 ? .74 : r === 8 ? .74 + .2 * clampv(f.s / f.cum[f.cum.length - 1], 0, 1) : .96;
      } else { this.stage = this.stats.sorted ? 'COMPLETED' : 'IDLE'; this.progress = this.stats.sorted ? 1 : 0; }
    },

    activeParts() {
      const s = new Set(), run = this.running; if (!run) return s;
      if (this.motor.w > 1) [3, 4, 14, 18].forEach(n => s.add(n));
      for (const o of this.objs) {
        const r = stageRank[o.st];
        if (r <= 1) { s.add(1); s.add(2); s.add(15); } else if (r === 2 || r === 3) { s.add(5); s.add(15); } else if (r === 4) { s.add(6); s.add(5); }
        else if (r === 5) { [6, 7, 8, 16, 15].forEach(n => s.add(n)); } else if (r === 6) { [15, 17, 10, 16].forEach(n => s.add(n)); }
        else if (r === 7) { [9, 17, 6].forEach(n => s.add(n)); } else if (r === 8) { [10, 11, 12].forEach(n => s.add(n)); } else { [13, 12].forEach(n => s.add(n)); }
      }
      return s;
    },
    tags() {
      const t = [{ anchor: [-24, 22.5, 25.5], text: 'OBJECT ENTRY', dx: -26, dy: -34 }];
      const f = this.focus; if (f && f.bin !== undefined && f.st !== 'ramp') t.push({ anchor: [BX[f.bin], 22.5, 14], text: 'TARGET: ' + BINS[f.bin].name.toUpperCase(), dx: 0, dy: 60, col: '#1e9e55' });
      return t;
    },
    info() {
      const f = this.focus || this.lastDone, has = !!f, F = this.flap, d = a => a > 0 ? '◀ L' : 'R ▶';
      const fl = `A ${d(F.A)} · B1 ${F.B1 > 0 ? '◀ out' : 'in ▶'} · B2 ${F.B2 > 0 ? '◀ in' : 'out ▶'}`;
      return [['Object', has ? `#${f.id} · ${f.k.name} ${f.shape}` : '—'],
        ['Camera', f && f.cam ? `hue ${Math.round((f.cam.hue + 360) % 360)}° → <b>${f.cam.c.toUpperCase()}</b> (${Math.round(f.cam.conf * 100)}%)` : '—'],
        ['RGB sensor', f && f.rgb ? `(${f.rgb.rgb.join(', ')}) → <b>${f.rgb.c.toUpperCase()}</b>` : '—'],
        ['Cross-check', f && f.agree ? f.agree + (f.try ? ` · ${f.try} re-scan` : '') : (f && f.try ? `re-scan ${f.try}` : '—')],
        ['Class code (A B)', f && f.bits ? `<b>${f.bits}</b> → ${BINS[f.bin].name}` : '—'],
        ['Flaps', fl], ['Gate', `${Math.round(this.gate.slide / GATE_MAX * 100)}% open`],
        ['Lift motor', this.motor.w > 1 ? `${Math.round(this.motor.w / (2 * Math.PI) * 60)} rpm · PWM ${Math.round(this.motor.w / WMAX * 70)}%` : 'stopped'],
        ['In tower', this.objs.length], ['Throughput', this.stats.sorted && this.time ? `${(this.stats.sorted / this.time * 60).toFixed(0)} obj/min` : '—']];
    },
    cameraView(c, W, H) {
      c.fillStyle = '#0b0f16'; c.fillRect(0, 0, W, H); c.font = '10px ui-monospace,Menlo,monospace'; c.fillStyle = '#6fa0d8'; c.fillText('CHAMBER CAM · gate plate view', 6, 12);
      c.fillStyle = this.ledOn ? '#2c3646' : '#161b24'; c.fillRect(14, 22, W - 28, H - 54); c.strokeStyle = '#4a5568'; c.strokeRect(14, 22, W - 28, H - 54);
      const o = this.objs.find(o => ['enter', 'scan', 'decide', 'release'].includes(o.st));
      if (!o) { c.fillStyle = '#5b6b82'; c.textAlign = 'center'; c.fillText('chamber empty', W / 2, 84); c.textAlign = 'left'; return; }
      const x = W / 2 + (o.x - CX) * 9, y = 78, s = o.r * 19;
      c.fillStyle = o.k.hex; c.beginPath(); if (o.shape === 'ball') c.arc(x, y, s, 0, 7); else c.rect(x - s, y - s, s * 2, s * 2); c.fill();
      if (o.st !== 'enter') { c.strokeStyle = '#2cff7a'; c.lineWidth = 1.5; c.strokeRect(x - s - 6, y - s - 6, s * 2 + 12, s * 2 + 12); c.fillStyle = '#2cff7a'; c.fillText(o.cam ? `${o.cam.c.toUpperCase()} ${Math.round(o.cam.conf * 100)}%` : 'tracking…', x - s - 6, y - s - 10); c.lineWidth = 1; }
      if (o.rgb) { ['#e53935', '#2ecc71', '#3498db'].forEach((col, i) => { c.fillStyle = '#222'; c.fillRect(20, H - 44 + i * 0 + 0, 0, 0); c.fillStyle = col; c.fillRect(24 + i * 90, H - 24, o.rgb.rgb[i] / 255 * 80, 6); c.fillStyle = '#9fb3cf'; c.fillText(o.rgb.rgb[i], 24 + i * 90, H - 28); }); }
      if (o.bits) { c.fillStyle = '#ffb000'; c.fillText('code ' + o.bits, W - 70, 34); }
    },

    /* ----------------------------------------------------------------- draw */
    drawObj(g, o, lay) { if (o.shape === 'ball') g.sphere(o.x, o.y, o.z, o.r, o.k.hex, lay); else g.cube(o.x, o.y, o.z - o.r, o.r * 2, o.r * 2, o.r * 2, o.yaw, o.k.hex, lay); },
    draw(g) {
      const { ALU, ACR, WOOD } = Parts, blink = this.running && Math.floor(performance.now() / 250) % 2, ph = this.motor.phase, F = this.flap;
      g.box(-26, 10, 0, 94, 36, 2, WOOD, { layer: 0 });
      // electronics (front strip)
      Parts.psu(g, -24, 36, 2, 12, 6.5, 5); Parts.l298n(g, -8, 36.5, 2, 6.4, 5.6, 'L298N'); Parts.arduino(g, 2, 36, 2, 10.5, 5.3, 'MEGA'); Parts.rpi(g, 16, 36, 2);
      g.box(30, 36.5, 2, 8, 3.4, .5, '#1f5fbf'); g.box(30.6, 36.8, 2.5, 6.8, .9, .9, '#222'); g.toptext(30.6, 39.4, 2.55, 'PCA9685', .8);
      g.sphere(4, 40, 3.2, .3, blink ? '#ffe400' : '#6b5d00', 3); g.sphere(18, 40, 3.2, .3, this.running ? '#22ff55' : '#116622', 3);
      // frame
      for (const x of [-11, -1, 4, 62]) Parts.post(g, x, 16.5, 2, 60);
      g.box(-11, 16.5, 62, 75, 2, 2, ALU); for (const z of [20, 40]) g.box(-11, 16.5, z, 12, 2, 1.5, ALU);
      // auger
      g.frust(AX, AY, 2, 8, 2.8, 2.8, '#d9a41a'); g.frust(AX, AY, 10, 1, 1.2, 1.2, '#cfd4d9');
      if (Math.cos(ph) + Math.sin(ph) > 0) g.sphere(AX + 1.25 * Math.cos(ph), AY + 1.25 * Math.sin(ph), 10.5, .3, '#ff7a00', 3);
      g.frust(AX, AY, 11, 53, 3.4, 3.4, '#cfe8f2', { a: .3 });
      g.add([AX - 3, AX + 3, AY - 3, AY + 3, 12, 62], gg => {
        const c = gg.ctx, pts = [], n = 240; for (let i = 0; i <= n; i++) { const t = i / n, ang = t * 2 * Math.PI * 7 + ph; pts.push(gg.T(AX + 2.6 * Math.cos(ang), AY + 2.6 * Math.sin(ang), 12 + t * 50)); }
        c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.strokeStyle = '#7a3b0a'; c.lineWidth = Math.max(2.4, .62 * gg.k); c.stroke(); c.strokeStyle = '#f08a24'; c.lineWidth = Math.max(1.4, .36 * gg.k); c.stroke();
      }, 1);
      g.frust(AX, AY, 11, 53, .7, .7, '#8a949e', { layer: 1 });
      // entry ramp + IR
      g.prism([[-26, 22], [-9, 14.8], [-9, 14], [-26, 21.2]], 20.5, 24.5, '#7fb7d6');
      g.prism([[-26, 22], [-9, 14.8], [-9, 17.2], [-26, 24.4]], 19.9, 20.5, ACR, { a: .45 }); g.prism([[-26, 22], [-9, 14.8], [-9, 17.2], [-26, 24.4]], 24.5, 25.1, ACR, { a: .45 });
      g.box(-25, 20.5, 2, 1.6, 1.6, 19, ALU); g.box(-25, 23.5, 2, 1.6, 1.6, 19, ALU); g.box(-11.5, 20.5, 2, 1.6, 1.6, 12.4, ALU); g.box(-11.5, 23.5, 2, 1.6, 1.6, 12.4, ALU);
      g.box(-13.3, 18.2, 16.5, 1.3, 1.3, 1.7, '#202226'); g.box(-13.3, 25.6, 16.5, 1.3, 1.3, 1.7, '#202226');
      g.line3([[-12.65, 19.5, 17.4], [-12.65, 25.7, 17.4]], this.irT > 0 ? '#ffd400' : '#e53935', this.irT > 0 ? 3.4 : 1.6, this.irT > 0 ? null : [4, 3]);
      // transfer ramp + chamber
      g.prism([[-3, 61.6], [28, 51.4], [28, 50.4], [-3, 60.6]], 20.4, 24.6, '#7fb7d6');
      g.prism([[-3, 61.6], [28, 51.4], [28, 54.4], [-3, 64.6]], 19.9, 20.4, ACR, { a: .45 }); g.prism([[-3, 61.6], [28, 51.4], [28, 54.4], [-3, 64.6]], 24.6, 25.1, ACR, { a: .45 });
      g.box(28, 19.5, 50, 12, 6, 8, ACR, { a: this.ledOn ? .3 : .2 });
      const gs = this.gate.slide; g.box(28.4 + gs, 20, 50, 14, 5, .5, '#e0b020', { layer: 3 });
      g.ring(CX, YC, 57.4, 3.2, .45, this.ledOn ? '#ffffff' : '#c8cdd4', this.ledOn ? '#fff7b0' : null);
      Parts.camera(g, 31.5, 25.8, 53, 5, 3.2, 3.6); g.sphere(34, 25.6, 54.6, .85, '#101214', 3);
      g.box(40, 21, 53.8, 1.2, 3.8, 2.6, '#7d3c98'); g.sphere(40.7, 21.8, 53.4, .35, this.rgbT > 0 ? '#ffe36a' : '#fff', 3); g.sphere(40.7, 24.2, 53.4, .35, this.rgbT > 0 ? '#ffe36a' : '#fff', 3);
      Parts.servo(g, 51.6, 20.6, 48.6, 2.6, 4.4, 4.6); g.rod([53, 22.8, 50.6], [28.4 + gs + 14, 22.8, 50.25], .3, '#555', { layer: 3 });
      g.box(31.5, 20.2, 44, 5, 4.6, 6, ACR, { a: .25 });
      // channel panels + planks
      g.box(6, 19, 14, 56, 1, 34, '#e3e9f0', { a: .9, layer: 1 });
      for (const prof of [[[33, 43.4], [21, 36.6], [21, 35.6], [33, 42.4]], [[35, 43.4], [47, 36.6], [47, 35.6], [35, 42.4]], [[19, 32.4], [14, 27.4], [14, 26.4], [19, 31.4]], [[21, 32.4], [26, 27.4], [26, 26.4], [21, 31.4]], [[47, 32.4], [42, 27.4], [42, 26.4], [47, 31.4]], [[49, 32.4], [54, 27.4], [54, 26.4], [49, 31.4]]]) g.prism(prof, 20.2, 24.8, '#3b4a63');
      for (const bx of BX) g.box(bx - 2.5, 20, 14.2, 5, 4.8, 12.2, ACR, { a: .25 });
      // flaps (rod + shaft + servo horn)
      for (const [px, pz, ang, sv] of [[34, 44, F.A, 41.2], [20, 33, F.B1, 30.3], [48, 33, F.B2, 30.3]]) {
        const a = ang * DEG, c = Math.cos(a), s = Math.sin(a);
        g.rod([px - 2.9 * c, 22.5, pz - 2.9 * s], [px + 2.9 * c, 22.5, pz + 2.9 * s], .5, '#ff7a00', { layer: 3 });
        g.rod([px, 22.6, pz], [px, 26.2, pz], .25, '#9aa3ad', { layer: 3 });
        Parts.servo(g, px - 2.6, 26, sv, 5.2, 2.6, 5.4);
        g.rod([px, 28.9, pz], [px + 2.6 * c, 28.9, pz + 2.6 * s], .3, '#ffffff', { layer: 3 });
      }
      g.box(6, 25, 14, 56, 1, 34, ACR, { a: .16, layer: 2 });
      // bins
      for (let i = 0; i < 4; i++) {
        const bx = BX[i]; for (const ob of this.bins_[i]) this.drawObj(g, ob, 1);
        g.box(bx - 5, 15, 2, 10, 15, 12, BINS[i].hex, { a: .42, layer: 2 }); g.facetext(bx - 4, 30, 6.6, BIN_TXT[i], i === 3 ? 1.9 : 2.4, '#10253f');
      }
      // objects
      for (const o of this.objs) this.drawObj(g, o, o.z > 15 ? 4 : 1);
      for (const o of this.objs) { const txt = `#${o.id}`; g.over(gg => { const [x, y] = gg.T(o.x, o.y, o.z + o.r + 1.2), c = gg.ctx, w = 30; c.fillStyle = 'rgba(15,27,45,.88)'; c.beginPath(); c.roundRect(x - w / 2, y - 24, w, 16, 8); c.fill(); c.fillStyle = '#fff'; c.font = '700 10.5px Helvetica,Arial'; c.textAlign = 'center'; c.fillText(txt, x, y - 12); c.textAlign = 'left'; }); }
      // sensing flashes
      const sc = this.objs.find(o => o.st === 'scan' || o.st === 'decide');
      if (sc && this.camT > 0) g.line3([[34, 25.6, 54.6], [sc.x, sc.y, sc.z]], '#ffd400', 3);
      if (sc && this.rgbT > 0) g.line3([[40.2, 22.8, 53.6], [sc.x, sc.y, sc.z]], '#ffd400', 3);
      // flow arrows
      g.line3([[-24, 22.5, 25.5], [-11, 22.5, 18.4], [-6, 22.5, 14]], 'rgba(255,122,0,.55)', 2.4, [8, 6]);
      g.line3([[-6, 29, 13], [-6, 29, 60]], 'rgba(255,122,0,.55)', 2.4, [8, 6]);
      g.line3([[-4, 22.5, 64.2], [27, 22.5, 55], [34, 22.5, 53.5]], 'rgba(255,122,0,.55)', 2.4, [8, 6]);
      g.line3([[34, 22.5, 49], [34, 22.5, 45.6], [22, 22.5, 38.4], [20, 22.5, 34.8], [14.5, 22.5, 29], [14, 22.5, 17]], 'rgba(255,122,0,.4)', 2.4, [8, 6]);
    },
  };
  sim.reset();
  window.addEventListener('DOMContentLoaded', () => { window.shell = new Shell(sim); });
})();
