'use strict';
/* ORBIT PICKER – gravity chute → IR gate → camera + LED ring → 3-DOF arm (yaw / shoulder / elbow + gripper) → 4 bins on an arc */
(() => {
  const G = 260, DEG = Math.PI / 180, BX0 = 22, BY0 = 30, PADX = 3.5, PADY = 30.7;
  const SZ = 12.3, L1 = 10.6, L2 = 10, GD = 5.2, HOME = { yaw: 180, r: 14, h: 19 };
  const KINDS = [
    { id: 'red', name: 'Red', hex: '#e53935', hue: 2 }, { id: 'green', name: 'Green', hex: '#2ecc71', hue: 135 },
    { id: 'blue', name: 'Blue', hex: '#3498db', hue: 207 }, { id: 'yellow', name: 'Yellow', hex: '#f1c40f', hue: 51 },
    { id: 'unknown', name: 'Unknown', hex: '#9b59b6', hue: 285 }];
  const BINS = [{ name: 'Red bin', hex: '#e74c3c' }, { name: 'Green bin', hex: '#2ecc71' }, { name: 'Blue bin', hex: '#3498db' }, { name: 'Yellow / other bin', hex: '#f1c40f' }];
  const BC = [[31, 14.4], [38.9, 23.8], [38.9, 36.2], [31, 45.6]], BYAW = [300, 340, 20, 60], CLS = ['red', 'green', 'blue', 'yellow'], BTXT = ['RED', 'GREEN', 'BLUE', 'YELLOW'];
  const randn = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); };
  const hueClass = h => { h = (h + 360) % 360; if (h < 20 || h > 340) return 'red'; if (h >= 35 && h <= 75) return 'yellow'; if (h >= 90 && h <= 160) return 'green'; if (h >= 190 && h <= 250) return 'blue'; return 'unknown'; };
  const zc = x => 15 - 12 * (x + 22) / 22;
  const slot = k => { const i = k % 4; return [(i % 2 ? 1.9 : -1.9), (i < 2 ? -1.9 : 1.9), Math.floor(k / 4)]; };
  const stageRank = { chute: 0, settle: 1, scan: 2, decide: 3, ready: 3, pick: 4, carry: 4, air: 5 };
  const dAng = (a, b) => ((b - a + 540) % 360) - 180;

  function ik(r, h) {
    const dz = h - SZ; let d = Math.hypot(r, dz); d = clampv(d, Math.abs(L1 - L2) + .3, L1 + L2 - .05);
    const al = Math.atan2(dz, r) + Math.acos(clampv((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const E = [L1 * Math.cos(al), SZ + L1 * Math.sin(al)], be = Math.atan2(h - E[1], r - E[0]);
    return { E, al: al / DEG, el: (be - al) / DEG };
  }

  const sim = {
    num: '01', title: 'ORBIT PICKER', subtitle: 'Radial 3-DOF robotic arm · IR gate + camera/LED ring · picks each object and places it in a ring of 4 bins',
    kinds: KINDS, bins: BINS, options: [
      { id: 'noise', label: 'Noisy camera (forces re-scans)', value: false },
      { id: 'dim', label: 'LED ring OFF (dim lighting, low confidence)', value: false }],
    opts: {}, bounds: { x: [-23, 49], y: [0, 54], z: [0, 38] }, floor: [-26, 52, -2, 56],
    queue: [], log: [], counts: [0, 0, 0, 0], stats: { sorted: 0, correct: 0, rejected: 0 }, stage: 'IDLE', progress: 0, time: 0,
    parts: [
      { n: 1, cat: 'sense', name: 'USB / Pi camera', func: 'Captures pad image; OpenCV finds colour + shape', anchor: [3.5, 29.2, 32], side: 'R' },
      { n: 2, cat: 'sense', name: 'IR break-beam pair', func: 'Detects an object arriving on the pad', anchor: [3.5, 26.2, 4.3] },
      { n: 3, cat: 'sense', name: 'LED ring light', func: 'Constant lighting → stable colour reading', anchor: [8.5, 30.7, 26.6], side: 'R' },
      { n: 4, cat: 'bin', name: 'Feed chute (object entry)', func: 'Gravity-feeds objects onto the pick pad', anchor: [-16, 30.7, 12.5] },
      { n: 5, cat: 'struct', name: 'Pick pad', func: 'Fixed, repeatable pick position', anchor: [7, 32, 3.0] },
      { n: 6, cat: 'ctrl', name: 'Raspberry Pi 4', func: 'Runs OpenCV classification, sends class by USB', anchor: [37.3, 4.3, 2.7] },
      { n: 7, cat: 'ctrl', name: 'Arduino Mega', func: 'Inverse kinematics + servo timing', anchor: [24.7, 4.2, 2.8] },
      { n: 8, cat: 'ctrl', name: 'PCA9685 servo driver', func: 'Drives 4 servos from external 5 V', anchor: [14, 3.9, 2.5] },
      { n: 9, cat: 'act', name: 'Base servo (yaw)', func: 'Rotates the whole arm toward the target bin', anchor: [22, 30, 6] },
      { n: 10, cat: 'act', name: 'Shoulder + elbow servos', func: 'Set arm reach and height', anchor: [22, 28.5, 12.2] },
      { n: 11, cat: 'act', name: 'Gripper servo + fingers', func: 'Grabs and releases the object', anchor: [3.5, 28.4, 6.5] },
      { n: 12, cat: 'bin', name: 'Collection bins ×4', func: 'Red / green / blue / yellow destinations', anchor: [43.4, 23.8, 6], side: 'R' },
      { n: 13, cat: 'ctrl', name: '5 V 10 A power supply', func: 'Powers servos and boards', anchor: [2.5, 4.5, 6.8] },
      { n: 14, cat: 'struct', name: 'Aluminium camera mast', func: 'Holds the camera over the pad', anchor: [9, 44, 30], side: 'R' },
      { n: 15, cat: 'struct', name: 'Plywood base', func: '54×54 cm rigid baseplate', anchor: [48, 18, 1], side: 'R' },
    ],

    reset() {
      this.objs = []; this.bins_ = [[], [], [], []]; this.log = []; this.time = 0; this.stats = { sorted: 0, correct: 0, rejected: 0 }; this.counts = [0, 0, 0, 0];
      this.stage = 'IDLE'; this.progress = 0; this.nextId = 1; this.queue.length = 0; this.focus = null; this.lastDone = null; this.irT = 0; this.camT = 0; this.spawnCd = 0; this.ledOn = false;
      this.arm = { pose: { ...HOME }, grip: 1, job: null, steps: [], i: 0, mv: null, moving: { yaw: 0, r: 0, h: 0 }, gripping: false };
      [['red', 'ball'], ['green', 'cube'], ['blue', 'ball'], ['yellow', 'cube'], ['unknown', 'ball'], ['green', 'ball'], ['blue', 'cube']].forEach(([k, s]) => this.enqueue(k, s));
      this.say('System ready. Press ▶ Start.');
    },
    say(t) { this.log.push(`<b>${this.time.toFixed(1)}s</b> ${t}`); },
    enqueue(kind, shape) { if (this.queue.length < 30) this.queue.push({ kind, shape }); },

    /* ---------------------------------------------------------------- arm kinematics */
    tipPos() {
      const p = this.arm.pose, a = p.yaw * DEG, ik_ = ik(p.r, p.h), W = [p.r, p.h];
      return { x: BX0 + p.r * Math.cos(a), y: BY0 + p.r * Math.sin(a), z: p.h - GD, ik: ik_, W };
    },
    buildSteps(o) {
      const hg = 3 + o.r + GD, by = BYAW[o.bin];
      return [{ p: { yaw: 180, r: 18.4, h: 17 }, n: 'move to pad' }, { p: { h: hg }, n: 'descend' }, { grip: 0, n: 'grip' }, { p: { h: 19 }, n: 'lift' },
        { p: { r: 11 }, n: 'retract' }, { p: { yaw: by }, n: 'swing' }, { p: { r: 18 }, n: 'extend' }, { grip: 1, rel: true, n: 'release' },
        { p: { r: 11 }, n: 'retract' }, { p: { yaw: 180 }, n: 'swing home' }, { p: { r: HOME.r }, n: 'home' }];
    },
    stepArm(dt) {
      const A = this.arm; A.moving = { yaw: 0, r: 0, h: 0 }; A.gripping = false;
      if (!A.job) return;
      const o = A.job, st = A.steps[A.i];
      if (!st) { A.job = null; return; }
      if (!A.mv) {
        if (st.p) { const from = { ...A.pose }, to = { ...A.pose, ...st.p }; const dur = Math.max(.18, Math.abs(dAng(from.yaw, to.yaw)) / 105, Math.abs(to.r - from.r) / 22, Math.abs(to.h - from.h) / 20); A.mv = { from, to, t: 0, dur }; }
        else A.mv = { g0: A.grip, g1: st.grip, t: 0, dur: .45 };
        A.stName = st.n;
      }
      const m = A.mv; m.t += dt / m.dur; const k = ease(clampv(m.t, 0, 1));
      if (st.p) {
        A.pose.yaw = m.from.yaw + dAng(m.from.yaw, m.to.yaw) * k; A.pose.r = lerp(m.from.r, m.to.r, k); A.pose.h = lerp(m.from.h, m.to.h, k);
        A.moving = { yaw: Math.abs(m.to.yaw - m.from.yaw) > .1 && m.t < 1 ? 1 : 0, r: Math.abs(m.to.r - m.from.r) > .1 && m.t < 1 ? 1 : 0, h: Math.abs(m.to.h - m.from.h) > .1 && m.t < 1 ? 1 : 0 };
      } else { A.grip = lerp(m.g0, m.g1, k); A.gripping = m.t < 1; }
      if (m.t >= 1) {
        if (st.grip === 0) { o.st = 'carry'; this.say(`#${o.id}: gripped and lifted off the pad`); }
        if (st.rel) { const tp = this.tipPos(); o.x = tp.x; o.y = tp.y; o.z = tp.z; this.launch(o); this.say(`#${o.id}: released over ${BINS[o.bin].name}`); }
        A.mv = null; A.i++; if (A.i >= A.steps.length) { A.job = null; }
      }
      if (o.st === 'carry') { const tp = this.tipPos(); o.x = tp.x; o.y = tp.y; o.z = tp.z; }
    },
    launch(o) {
      const n = this.bins_[o.bin].length, sl = slot(n), [bx, by] = BC[o.bin], tx = bx + sl[0], ty = by + sl[1], zf = 2.8 + o.r + sl[2] * o.r * 2, dz = Math.max(.5, o.z - zf), T = Math.sqrt(2 * dz / G) + .05;
      o.tgt = [tx, ty, zf]; o.T = T; o.t0 = 0; o.hx = (tx - o.x) / T; o.hy = (ty - o.y) / T; o.vz = 0; o.st = 'air';
    },
    camRead(o) {
      const n = this.opts.noise, dim = this.opts.dim, hue = o.k.hue + randn() * (n ? 18 : dim ? 9 : 3);
      return { hue, c: hueClass(hue), conf: clampv(.97 - Math.abs(randn()) * (n ? .24 : .03) - (dim ? .2 : 0), .3, .995), shape: o.shape === 'ball' ? 'circle' : 'square' };
    },

    /* ---------------------------------------------------------------- simulation step */
    update(dt, running) {
      if (dt > 0) this.time += dt;
      if (this.irT > 0) this.irT -= dt; if (this.camT > 0) this.camT -= dt; if (this.spawnCd > 0) this.spawnCd -= dt;
      const O = this.objs, stepMode = window.shell && window.shell.stepMode;
      if (running && this.queue.length && O.length < 5 && this.spawnCd <= 0 && !O.some(o => o.st === 'chute' && o.x < -14) && !(stepMode && O.length)) {
        const q = this.queue.shift(), k = KINDS.find(k => k.id === q.kind), r = q.shape === 'ball' ? 1.5 : 1.25;
        O.push({ id: this.nextId++, kind: q.kind, k, shape: q.shape, r, x: -21.5, y: PADY, z: zc(-21.5) + 1.12 * r, vx: 0, vz: 0, yaw: .3, st: 'chute', try: 0 });
        this.spawnCd = 1; this.say(`Object #${this.nextId - 1} (${k.name} ${q.shape}) released on the feed chute`);
      }
      const padBusy = () => O.some(o => ['settle', 'scan', 'decide', 'ready', 'pick'].includes(o.st));
      // chute
      const ch = O.filter(o => o.st === 'chute').sort((a, b) => b.x - a.x);
      ch.forEach((o, i) => {
        const lim = i ? ch[i - 1].x - 3.4 : (padBusy() ? -3.2 : 99);
        o.vx += 54 * dt; o.x = Math.min(lim, o.x + o.vx * dt); if (o.x >= lim) o.vx = 0;
        o.z = o.x < 0 ? zc(o.x) + 1.12 * o.r : 3 + o.r + (.12 * o.r + 0) * Math.max(0, 1 - o.x / 1.2); o.yaw += o.vx * dt / o.r * .6;
        if (!o.ir && o.x >= 2.2) { o.ir = 1; this.irT = .7; this.say(`#${o.id}: IR break-beam → object on the pad`); }
        if (o.x >= 0 && i === 0 && !O.some(p => p.st === 'settle')) { o.st = 'settle'; }
      });
      for (const o of O.filter(o => o.st === 'settle')) {
        const rem = PADX - o.x; o.vx -= o.vx * o.vx / (2 * Math.max(rem, .05)) * dt; o.vx = Math.max(o.vx, 3); o.x = Math.min(PADX, o.x + o.vx * dt); o.z = 3 + o.r;
        if (!o.ir && o.x >= 2.2) { o.ir = 1; this.irT = .7; this.say(`#${o.id}: IR break-beam → object on the pad`); }
        if (o.x >= PADX - .01) { o.x = PADX; o.st = 'scan'; o.t = 0; o.try = 0; o.cam = null; o.sd = {}; this.say(`#${o.id}: centred on the pad → LED ring + camera`); }
      }
      for (const o of O.filter(o => o.st === 'scan')) {
        o.t += dt;
        if (o.t > .55 && !o.sd.cam) { o.sd.cam = 1; o.cam = this.camRead(o); this.camT = .5; this.say(`#${o.id}: camera → ${o.cam.c.toUpperCase()} ${o.cam.shape} (${Math.round(o.cam.conf * 100)}%)`); }
        if (o.t > 1.1) {
          if (o.cam.c !== 'unknown' && o.cam.conf >= .7) { o.cls = o.cam.c; o.bin = CLS.indexOf(o.cls); o.note = 'confident'; }
          else if (o.cam.c === 'unknown' && o.cam.conf >= .7) { o.cls = 'unknown'; o.bin = 3; o.note = 'unknown colour → other bin'; o.rej = true; }
          else if (o.try < 2) { o.try++; o.t = 0; o.sd = {}; this.say(`#${o.id}: low confidence → <b>re-scan ${o.try}</b>`); continue; }
          else { o.cls = 'unknown'; o.bin = 3; o.note = 'low confidence → other bin'; o.rej = true; }
          o.st = 'decide'; o.t = 0; this.say(`#${o.id}: decision <b>${o.cls.toUpperCase()}</b> → ${BINS[o.bin].name} (arm yaw ${BYAW[o.bin]}°)`);
        }
      }
      for (const o of O.filter(o => o.st === 'decide')) { o.t += dt; if (o.t > .6) o.st = 'ready'; }
      const A = this.arm;
      if (!A.job) { const o = O.find(o => o.st === 'ready'); if (o) { o.st = 'pick'; A.job = o; A.steps = this.buildSteps(o); A.i = 0; A.mv = null; this.say(`Arm: IK solved for #${o.id} → pick & place`); } }
      this.stepArm(dt);
      for (const o of O.filter(o => o.st === 'air')) {
        o.vz -= G * dt; o.z += o.vz * dt; o.x += o.hx * dt; o.y += o.hy * dt; o.t0 += dt;
        if (o.t0 >= o.T || o.z <= o.tgt[2]) {
          [o.x, o.y, o.z] = o.tgt; o.st = 'bin'; this.bins_[o.bin].push(o); this.counts[o.bin]++;
          const truth = CLS.includes(o.kind) ? CLS.indexOf(o.kind) : 3, ok = truth === o.bin; this.stats.sorted++; if (ok) this.stats.correct++; if (o.rej) this.stats.rejected++;
          this.lastDone = o; this.say(`#${o.id} (${o.k.name}) → <b>${BINS[o.bin].name}</b> ${ok ? '✔ correct' : '✘ wrong'}`); if (this.onDone) this.onDone();
        }
      }
      this.objs = O.filter(o => o.st !== 'bin');
      this.ledOn = this.objs.some(o => o.st === 'scan') && !this.opts.dim;
      const f = this.objs.slice().sort((a, b) => stageRank[b.st] - stageRank[a.st])[0]; this.focus = f || null;
      if (f) { const r = stageRank[f.st]; this.stage = r <= 1 ? 'DETECTING' : r === 2 ? 'CLASSIFYING' : r === 3 ? 'DECISION' : 'SORTING'; this.progress = [.08, .22, .4, .6, .62 + (f.st === 'carry' ? .2 : 0), .95][r]; }
      else { this.stage = this.stats.sorted ? 'COMPLETED' : 'IDLE'; this.progress = this.stats.sorted ? 1 : 0; }
    },

    activeParts() {
      const s = new Set(); if (!this.running) return s; s.add(13);
      for (const o of this.objs) {
        const r = stageRank[o.st];
        if (r === 0) { s.add(4); s.add(2); } else if (r === 1) { s.add(2); s.add(5); } else if (r === 2) { [1, 3, 6, 14].forEach(n => s.add(n)); } else if (r === 3) { [6, 7].forEach(n => s.add(n)); } else if (r === 4) { [7, 8, 11].forEach(n => s.add(n)); } else { s.add(12); }
      }
      const m = this.arm.moving; if (m.yaw) s.add(9); if (m.r || m.h) s.add(10); if (this.arm.gripping) s.add(11); if (this.arm.job) { s.add(7); s.add(8); }
      return s;
    },
    tags() {
      const t = [{ anchor: [-20, 30.7, 17], text: 'OBJECT ENTRY', dx: -26, dy: -34 }];
      const f = this.focus; if (f && f.bin !== undefined) t.push({ anchor: [BC[f.bin][0], BC[f.bin][1], 11], text: 'TARGET: ' + BINS[f.bin].name.toUpperCase(), dx: 62, dy: 30, col: '#1e9e55' });
      return t;
    },
    info() {
      const f = this.focus || this.lastDone, A = this.arm, tp = this.tipPos(), g = A.pose;
      return [['Object', f ? `#${f.id} · ${f.k.name} ${f.shape}` : '—'],
        ['Camera colour', f && f.cam ? `hue ${Math.round((f.cam.hue + 360) % 360)}° → <b>${f.cam.c.toUpperCase()}</b> (${Math.round(f.cam.conf * 100)}%)` : '—'],
        ['Shape (contour)', f && f.cam ? f.cam.shape : '—'], ['Decision', f && f.cls ? `<b>${f.cls.toUpperCase()}</b> → ${BINS[f.bin].name}` : '—'],
        ['Arm task', A.job ? `#${A.job.id} · ${A.stName || '…'}` : 'idle (home)'],
        ['Base yaw', `${Math.round((g.yaw % 360 + 360) % 360)}°`], ['Shoulder / elbow', `${Math.round(tp.ik.al)}° / ${Math.round(tp.ik.el)}°`],
        ['Reach / height', `${g.r.toFixed(1)} / ${g.h.toFixed(1)} cm`], ['Gripper', `${Math.round(A.grip * 100)}% open`],
        ['In system', this.objs.length], ['Throughput', this.stats.sorted && this.time ? `${(this.stats.sorted / this.time * 60).toFixed(1)} obj/min` : '—']];
    },
    cameraView(c, W, H) {
      c.fillStyle = '#0b0f16'; c.fillRect(0, 0, W, H); c.font = '10px ui-monospace,Menlo,monospace'; c.fillStyle = '#6fa0d8'; c.fillText('PAD CAM · top view', 6, 12);
      c.fillStyle = this.ledOn ? '#38455a' : '#1b212c'; c.beginPath(); c.arc(W / 2, 88, 66, 0, 7); c.fill(); c.strokeStyle = '#4a5568'; c.stroke();
      const o = this.objs.find(o => ['settle', 'scan', 'decide', 'ready', 'pick'].includes(o.st));
      if (!o) { c.fillStyle = '#5b6b82'; c.textAlign = 'center'; c.fillText('pad empty', W / 2, 90); c.textAlign = 'left'; return; }
      const x = W / 2 + (o.x - PADX) * 12, y = 88, s = o.r * 17; c.fillStyle = o.k.hex; c.beginPath(); if (o.shape === 'ball') c.arc(x, y, s, 0, 7); else c.rect(x - s, y - s, s * 2, s * 2); c.fill();
      if (o.st !== 'settle') { c.strokeStyle = '#2cff7a'; c.lineWidth = 1.5; c.strokeRect(x - s - 6, y - s - 6, s * 2 + 12, s * 2 + 12); c.fillStyle = '#2cff7a'; c.fillText(o.cam ? `${o.cam.c.toUpperCase()} ${o.cam.shape} ${Math.round(o.cam.conf * 100)}%` : 'tracking…', Math.max(4, x - 56), y - s - 10); c.lineWidth = 1; }
      c.fillStyle = '#9fb3cf'; c.fillText(`centroid (${Math.round(x)}, ${y}) px`, 8, H - 8);
    },

    /* ----------------------------------------------------------------- draw */
    drawObj(g, o, lay) { if (o.shape === 'ball') g.sphere(o.x, o.y, o.z, o.r, o.k.hex, lay); else g.cube(o.x, o.y, o.z - o.r, o.r * 2, o.r * 2, o.r * 2, o.yaw, o.k.hex, lay); },
    draw(g) {
      const { ALU, ACR, WOOD } = Parts, blink = this.running && Math.floor(performance.now() / 250) % 2, A = this.arm, p = A.pose, a = p.yaw * DEG, ca = Math.cos(a), sa = Math.sin(a);
      g.box(-6, 0, 0, 54, 54, 2, WOOD, { layer: 0 });
      Parts.psu(g, -3, 1.5, 2); g.box(10, 2.2, 2, 8, 3.4, .5, '#1f5fbf'); g.box(10.6, 2.5, 2.5, 6.8, .9, .9, '#222'); g.toptext(10.6, 5.1, 2.55, 'PCA9685', .8);
      Parts.arduino(g, 20, 1.5, 2, 9.5, 5.4, 'MEGA'); Parts.rpi(g, 33, 1.5, 2);
      g.sphere(24, 4, 3.2, .3, blink ? '#ffe400' : '#6b5d00', 3); g.sphere(36, 4, 3.2, .3, this.running ? '#22ff55' : '#116622', 3);
      g.wire([[14, 4, 2.6], [14, 22, 2.6], [20, 24.5, 2.6], [20.5, 27, 3]], '#e0b000', .28);
      // chute
      g.prism([[-22, 15], [0, 3], [0, 2.2], [-22, 14.2]], 28.2, 33.2, '#7fb7d6');
      g.prism([[-22, 15], [0, 3], [0, 5.2], [-22, 17.2]], 27.4, 28.2, ACR, { a: .5 }); g.prism([[-22, 15], [0, 3], [0, 5.2], [-22, 17.2]], 33.2, 34, ACR, { a: .5 });
      g.box(-20.5, 27.6, 0, 1.5, 1.5, 14.2, ALU); g.box(-20.5, 33.6, 0, 1.5, 1.5, 14.2, ALU); g.box(-8.6, 27.6, 0, 1.5, 1.5, zc(-8.6) - .8, ALU); g.box(-8.6, 33.6, 0, 1.5, 1.5, zc(-8.6) - .8, ALU);
      // pad + IR + mast + camera + LED ring
      g.box(0, 27.2, 2, 7, 7, 1, '#3a3f47'); g.box(2.9, 25.7, 3, 1.3, 1.3, 1.7, '#202226'); g.box(2.9, 34.5, 3, 1.3, 1.3, 1.7, '#202226');
      g.line3([[3.55, 27, 3.9], [3.55, 34.5, 3.9]], this.irT > 0 ? '#ffd400' : '#e53935', this.irT > 0 ? 3.4 : 1.6, this.irT > 0 ? null : [4, 3]);
      Parts.post(g, 9, 20, 2, 34); Parts.post(g, 9, 42, 2, 34); g.box(9, 20, 34, 2, 24, 2, ALU); g.box(2, 29.7, 34, 9, 2, 2, ALU);
      Parts.camera(g, 1.5, 29.2, 30.2, 4, 3, 3.8); g.frust(3.5, 30.7, 28.4, 1.8, 1.25, 1.1, '#101214');
      g.ring(3.5, 30.7, 26.6, 5.2, .55, this.ledOn ? '#ffffff' : '#cfd3d8', this.ledOn ? '#ffe066' : null);
      // base
      g.box(17, 25, 2, 10, 10, .8, ALU); g.box(19, 27, 2.8, 6, 6, 6.2, '#2a6fdb'); g.frust(BX0, BY0, 9, 1.2, 3.6, 3.6, '#c8cdd2');
      // arm (kinematic chain rotated by yaw)
      const tp = this.tipPos(), P = (r, z) => [BX0 + r * ca, BY0 + r * sa, z], S = P(0, SZ), E = P(tp.ik.E[0], tp.ik.E[1]), W = P(p.r, p.h);
      g.cube(BX0, BY0, 10.2, 5.5, 3, 4.2, a, '#2a6fdb', 3);
      g.rod(S, E, .95, ALU, { layer: 3 }); g.cube(E[0], E[1], E[2] - 2.1, 4, 3, 4.2, a, '#2a6fdb', 3); g.rod(E, W, .95, ALU, { layer: 3 });
      g.cube(W[0], W[1], W[2] - 1.6, 4, 2.2, 3.2, a, '#3b82f6', 3);
      const hs = (A.job ? A.job.r : 1.4) + .6 + A.grip * 1.7, nx = -sa, ny = ca, Tz = p.h - GD;
      for (const sg of [-1, 1]) g.cube(tp.x + sg * hs * nx, tp.y + sg * hs * ny, Tz - 1.4, 1.1, .8, 3.4, a, '#555', 3);
      // bins
      for (let i = 0; i < 4; i++) {
        const [bx, by] = BC[i]; for (const ob of this.bins_[i]) this.drawObj(g, ob, 1);
        g.box(bx - 4.5, by - 4.5, 2, 9, 9, 8, BINS[i].hex, { a: .42, layer: 2 }); g.facetext(bx - 3.6, by + 4.5, 5.4, BTXT[i], 1.6, '#10253f');
      }
      for (const o of this.objs) this.drawObj(g, o, o.z > 6 || o.st === 'carry' ? 4 : 3);
      for (const o of this.objs) { const txt = `#${o.id}`; g.over(gg => { const [x, y] = gg.T(o.x, o.y, o.z + o.r + 1.2), c = gg.ctx, w = 30; c.fillStyle = 'rgba(15,27,45,.88)'; c.beginPath(); c.roundRect(x - w / 2, y - 24, w, 16, 8); c.fill(); c.fillStyle = '#fff'; c.font = '700 10.5px Helvetica,Arial'; c.textAlign = 'center'; c.fillText(txt, x, y - 12); c.textAlign = 'left'; }); }
      const sc = this.objs.find(o => o.st === 'scan'); if (sc && this.camT > 0) g.line3([[3.5, 30.7, 28.4], [sc.x, sc.y, sc.z]], '#ffd400', 3);
      g.line3([[-20, 30.7, 17], [-6, 30.7, 9.6], [1, 30.7, 6.4]], 'rgba(255,122,0,.55)', 2.4, [8, 6]);
      g.line3([[3.5, 30.7, 15.5], [12, 36, 19], [28, 41, 18], [38.9, 36.2, 12.8]], 'rgba(255,122,0,.4)', 2.4, [8, 6]);
    },
  };
  sim.reset();
  window.addEventListener('DOMContentLoaded', () => { window.shell = new Shell(sim); });
})();
