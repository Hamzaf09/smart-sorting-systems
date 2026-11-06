'use strict';
/* PUSTACHE SORTER – upgraded Tinkercad design: feed tube → 2-pin escapement (one object at a time) → lit inspection chamber (IR + camera)
   → decision (HSV vote, reject on uncertainty) → G1 gate → servo swing chute → 4 cups on an arc (R / G / B / REJECT) */
(() => {
  const G = 260, DEG = Math.PI / 180, CX = 22, CY = 22, RC = 18, RO = 19, ZG1 = 34, ZR1 = 39.75, ZP1 = 39.45, ZP2 = 44.25, HOME = 90;
  const KINDS = [
    { id: 'red', name: 'Red', hex: '#e53935', hue: 2 }, { id: 'green', name: 'Green', hex: '#2ecc71', hue: 135 },
    { id: 'blue', name: 'Blue', hex: '#3498db', hue: 207 }, { id: 'yellow', name: 'Yellow', hex: '#f1c40f', hue: 51 },
    { id: 'unknown', name: 'Unknown', hex: '#9b59b6', hue: 285 }];
  const BINS = [{ name: 'Red cup', hex: '#e74c3c' }, { name: 'Green cup', hex: '#2ecc71' }, { name: 'Blue cup', hex: '#3498db' }, { name: 'REJECT cup (grey)', hex: '#8a949e' }];
  const BANG = [36, 72, 144, 108], CLS = ['red', 'green', 'blue'], BTXT = ['RED', 'GREEN', 'BLUE', 'REJECT'];
  const cup = i => [CX + RC * Math.cos(BANG[i] * DEG), CY + RC * Math.sin(BANG[i] * DEG)];
  const zf = r => 26 - (11 / 19) * r;
  const randn = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); };
  const hueClass = h => { h = (h + 360) % 360; if (h < 20 || h > 340) return 'red'; if (h >= 90 && h <= 160) return 'green'; if (h >= 190 && h <= 250) return 'blue'; if (h >= 35 && h <= 75) return 'yellow'; return 'unknown'; };
  const slot = k => { const i = k % 4; return [(i % 2 ? 1.3 : -1.3), (i < 2 ? -1.3 : 1.3), Math.floor(k / 4)]; };
  const rank = { feed: 0, tube: 0, drop1: 1, chamber: 1, scan: 2, decide: 3, aim: 3, fall2: 4, slide: 4, air: 5 };

  const sim = {
    num: '06', title: 'PUSTACHE SORTER', subtitle: 'Upgraded Tinkercad design · tube + escapement · lit chamber with IR + camera · reject cup · servo swing chute · 4 cups',
    kinds: KINDS, bins: BINS, options: [
      { id: 'noise', label: 'Noisy camera (forces re-scan / reject)', value: false },
      { id: 'light', label: 'Venue lighting changed (colours shift)', value: false },
      { id: 'teach', label: 'Teach mode applied (re-calibrated to lighting)', value: false }],
    opts: {}, bounds: { x: [-3, 47], y: [12, 48], z: [0, 62] }, floor: [-6, 50, 10, 50],
    queue: [], log: [], counts: [0, 0, 0, 0], stats: { sorted: 0, correct: 0, rejected: 0 }, stage: 'IDLE', progress: 0, time: 0,
    parts: [
      { n: 1, cat: 'struct', name: 'Red backboard (reused)', func: 'Main wall; everything mounts on it', anchor: [44, 15, 24], side: 'R' },
      { n: 2, cat: 'bin', name: 'Feed tube (reused, object entry)', func: 'Gravity queue; bore = object + 4 mm', anchor: [25, 22, 54], side: 'R' },
      { n: 3, cat: 'act', name: 'Escapement servo + 2 pins (new)', func: 'Releases exactly ONE object at a time', anchor: [28, 22, 42], side: 'R' },
      { n: 4, cat: 'sense', name: 'IR break-beam (new)', func: 'Object entered the chamber / jam check', anchor: [21.4, 17.4, 36], side: 'L' },
      { n: 5, cat: 'struct', name: 'Inspection chamber + LED strip (new)', func: 'Fixed light, fixed distance, matte background', anchor: [18.5, 20, 38], side: 'L' },
      { n: 6, cat: 'sense', name: 'Pi camera (new)', func: 'OpenCV HSV colour, 5-frame vote', anchor: [22, 34.5, 36], side: 'R' },
      { n: 7, cat: 'act', name: 'Gate G1 servo + flap (new)', func: 'Holds object for the scan, then drops it', anchor: [15.5, 21.5, 35], side: 'L' },
      { n: 8, cat: 'struct', name: 'Swing chute (reused ramp)', func: 'Slides object into the chosen cup', anchor: [22, 30, 22], side: 'L' },
      { n: 9, cat: 'act', name: 'Chute servo S2', func: 'Aims the chute at 1 of 4 cups', anchor: [22, 22, 21], side: 'L' },
      { n: 10, cat: 'bin', name: 'Cups ×4 incl. REJECT (reused)', func: 'Red / green / blue / reject, funnel lips', anchor: [36.6, 32.6, 9], side: 'R' },
      { n: 11, cat: 'sense', name: 'IR drop-confirm ×4 (new)', func: 'Proves the object reached its cup', anchor: [7.4, 32.6, 13], side: 'L' },
      { n: 12, cat: 'ctrl', name: 'Raspberry Pi 4', func: 'Vision + decision, sends class by USB', anchor: [6, 18.5, 47.6], side: 'L' },
      { n: 13, cat: 'ctrl', name: 'Arduino Uno', func: 'Servo + IR timing, state machine', anchor: [31.5, 18, 47.6], side: 'R' },
      { n: 14, cat: 'ctrl', name: 'Breadboard / terminal block', func: 'Power + signal distribution', anchor: [33, 24, 48], side: 'R' },
      { n: 15, cat: 'ctrl', name: '5 V supplies (servo rail + Pi)', func: 'Separate servo rail, common ground', anchor: [40, 18, 50], side: 'R' },
      { n: 16, cat: 'struct', name: 'Camera arm', func: 'Fixes camera distance to the chamber', anchor: [25.4, 28, 37], side: 'R' },
      { n: 17, cat: 'struct', name: 'Top shelf (reused)', func: 'Electronics level', anchor: [2, 24, 46.6], side: 'L' },
      { n: 18, cat: 'struct', name: 'Middle shelf (reused)', func: 'Carries the chute servo', anchor: [13, 26, 18.6], side: 'L' },
      { n: 19, cat: 'struct', name: 'Base plate + braces', func: 'Rigid footprint; arc layout for the cups', anchor: [-2, 40, 1], side: 'L' },
    ],

    reset() {
      this.objs = []; this.bins_ = [[], [], [], []]; this.log = []; this.time = 0; this.stats = { sorted: 0, correct: 0, rejected: 0 }; this.counts = [0, 0, 0, 0];
      this.stage = 'IDLE'; this.progress = 0; this.nextId = 1; this.queue.length = 0; this.focus = null; this.lastDone = null; this.irT = 0; this.camT = 0; this.spawnCd = 0;
      this.esc = { e: 1, target: 1 }; this.ph = 'idle'; this.g1 = { th: 0, target: 0, wig: 0 }; this.s2 = { a: HOME, target: HOME }; this.irD = [0, 0, 0, 0]; this.ledOn = false;
      [['red', 'ball'], ['green', 'cube'], ['blue', 'ball'], ['yellow', 'cube'], ['unknown', 'ball'], ['red', 'cube'], ['blue', 'cube']].forEach(([k, s]) => this.enqueue(k, s));
      this.say('System ready. Press ▶ Start.');
    },
    say(t) { this.log.push(`<b>${this.time.toFixed(1)}s</b> ${t}`); },
    enqueue(kind, shape) { if (this.queue.length < 30) this.queue.push({ kind, shape }); },

    frame(o) {
      const shift = this.opts.light && !this.opts.teach ? 26 : 0, n = this.opts.noise, hue = o.k.hue + shift + randn() * (n ? 14 : 3);
      const ratio = clampv(.9 - Math.abs(randn()) * (n ? .16 : .04) - (shift ? .12 : 0), .2, .98);
      return { hue, c: hueClass(hue), ratio };
    },

    update(dt, running) {
      if (dt > 0) this.time += dt;
      for (const k of ['irT', 'camT']) if (this[k] > 0) this[k] -= dt;
      for (let i = 0; i < 4; i++) if (this.irD[i] > 0) this.irD[i] -= dt;
      if (this.spawnCd > 0) this.spawnCd -= dt;
      const O = this.objs, stepMode = window.shell && window.shell.stepMode, E = this.esc, g1 = this.g1, s2 = this.s2;
      // servos
      E.e += clampv(E.target - E.e, -5 * dt, 5 * dt); g1.th += clampv(g1.target - g1.th, -420 * dt, 420 * dt); if (g1.wig > 0) g1.wig -= dt;
      s2.a += clampv(s2.target - s2.a, -150 * dt, 150 * dt);
      // feed
      const stackN = O.filter(o => o.st === 'tube' || o.st === 'feed').length;
      if (running && this.queue.length && stackN < 6 && this.spawnCd <= 0 && !O.some(o => o.st === 'feed' && o.z > 52) && !(stepMode && O.length)) {
        const q = this.queue.shift(), k = KINDS.find(k => k.id === q.kind), r = q.shape === 'ball' ? 1.5 : 1.25;
        O.push({ id: this.nextId++, kind: q.kind, k, shape: q.shape, r, x: CX, y: CY, z: 62, vz: 0, yaw: Math.random(), st: 'feed', rescans: 0 });
        this.spawnCd = .9; this.say(`Object #${this.nextId - 1} (${k.name} ${q.shape}) dropped into the feed tube`);
      }
      // tube stack (resting on the escapement pins)
      const st = O.filter(o => o.st === 'tube' || o.st === 'feed').sort((a, b) => a.z - b.z), hold = E.e < .5;
      st.forEach((o, i) => {
        if (i === 0 && hold && o.st === 'tube') { o.vz = 0; return; }
        const tz = i === 0 ? ZR1 + o.r : st[i - 1].z + st[i - 1].r + o.r;
        if (o.z > tz + .001 || o.st === 'feed') { o.vz -= G * dt; o.z += o.vz * dt; if (o.z <= tz) { o.z = tz; o.vz = 0; o.st = 'tube'; } } else { o.z = tz; o.vz = 0; }
      });
      // escapement controller
      const busy = O.some(o => ['drop1', 'chamber', 'scan', 'decide', 'aim'].includes(o.st));
      if (this.ph === 'idle' && running && !busy && E.e > .99 && st[0] && st[0].st === 'tube' && Math.abs(st[0].z - (ZR1 + st[0].r)) < .05) { E.target = 0; this.ph = 'release'; this.say('Escapement: pin 1 out, pin 2 pinches the next object → release ONE'); }
      else if (this.ph === 'release' && E.e <= .02) { const o = st[0]; if (o) { o.st = 'drop1'; o.vz = 0; } this.ph = 'wait'; }
      else if (this.ph === 'wait') { if (!O.some(o => o.st === 'drop1')) { E.target = 1; this.ph = 'restore'; } }
      else if (this.ph === 'restore' && E.e >= .99) this.ph = 'idle';
      // chamber objects
      for (const o of O) {
        if (o.st === 'drop1') {
          const rest = ZG1 + .25 + o.r; o.vz -= G * dt; o.z += o.vz * dt;
          if (!o.ir && o.z <= 37.4) { o.ir = 1; this.irT = .8; this.say(`#${o.id}: IR break-beam → object entered the chamber`); }
          if (o.z <= rest) { o.z = rest; o.vz = 0; o.st = 'chamber'; o.t = 0; }
        } else if (o.st === 'chamber') { o.t += dt; if (o.t > .4) { o.st = 'scan'; o.t = 0; o.fr = []; this.say(`#${o.id}: settled → LED on, camera capturing 5 frames`); } }
        else if (o.st === 'scan') {
          o.t += dt; if (o.t >= .15 * (o.fr.length + 1) && o.fr.length < 5) { o.fr.push(this.frame(o)); this.camT = .12; }
          if (o.fr.length === 5 && o.t > .85) {
            const cnt = {}; o.fr.forEach(f => { cnt[f.c] = (cnt[f.c] || 0) + 1; }); const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0], votes = cnt[best], ratio = o.fr.reduce((s, f) => s + f.ratio, 0) / 5;
            o.vote = { c: best, n: votes, ratio }; const sure = votes >= 4 && ratio >= .6, ok = CLS.includes(best) && sure;
            if (ok) { o.cls = best; o.bin = CLS.indexOf(best); o.rule = `${votes}/5 frames agree, area ${Math.round(ratio * 100)}%`; o.st = 'decide'; o.t = 0; }
            else if (!sure && o.rescans < 1) { o.rescans++; g1.wig = .5; o.st = 'chamber'; o.t = 0; this.say(`#${o.id}: unsure (${best} ${votes}/5, ${Math.round(ratio * 100)}%) → nudge + <b>re-scan</b>`); }
            else { o.cls = 'reject'; o.bin = 3; o.rule = sure ? (best === 'yellow' ? 'colour has no cup' : 'colour not recognised') : `low confidence (${votes}/5, ${Math.round(ratio * 100)}%)`; o.st = 'decide'; o.t = 0; o.rej = true; }
            if (o.st === 'decide') this.say(`#${o.id}: decision <b>${o.cls.toUpperCase()}</b> → ${BINS[o.bin].name} (${o.rule}) → serial "C:${o.cls === 'reject' ? 'X' : o.cls[0].toUpperCase()}"`);
          }
        } else if (o.st === 'decide') { o.t += dt; if (o.t > .5) o.st = 'aim'; }
      }
      // aim + release
      const chuteBusy = O.some(o => o.st === 'fall2' || o.st === 'slide'), cur = O.find(o => o.st === 'fall2' || o.st === 'slide') || O.find(o => o.st === 'aim' && !chuteBusy);
      s2.target = cur ? BANG[cur.bin] : HOME;
      for (const o of O.filter(o => o.st === 'aim')) if (!chuteBusy && Math.abs(s2.a - BANG[o.bin]) < .8) { g1.target = 85; if (g1.th > 70) { o.st = 'fall2'; o.vz = 0; this.say(`#${o.id}: chute aimed at ${BANG[o.bin]}° → gate G1 opens`); } }
      for (const o of O.filter(o => o.st === 'fall2')) {
        const rest = zf(0) + 1.15 * o.r; o.vz -= G * dt; o.z += o.vz * dt; if (o.z < 32) g1.target = 0;
        if (o.z <= rest) { o.z = rest; o.st = 'slide'; o.rr = 0; o.v = 7; }
      }
      for (const o of O.filter(o => o.st === 'slide')) {
        o.v += G * .5 * .5 * dt; o.rr += o.v * dt * .866; const a = BANG[o.bin] * DEG; o.x = CX + o.rr * Math.cos(a); o.y = CY + o.rr * Math.sin(a); o.z = zf(o.rr) + 1.15 * o.r; o.yaw += o.v * dt * .05;
        if (o.rr >= RO) {
          const n = this.bins_[o.bin].length, sl = slot(n), [cx, cy] = cup(o.bin), tz = 2.8 + o.r + sl[2] * o.r * 2, dz = Math.max(.5, o.z - tz), T = Math.sqrt(2 * dz / G) + .05;
          o.tgt = [cx + sl[0], cy + sl[1], tz]; o.T = T; o.t0 = 0; o.hx = (o.tgt[0] - o.x) / T; o.hy = (o.tgt[1] - o.y) / T; o.vz = -10; o.st = 'air';
        }
      }
      for (const o of O.filter(o => o.st === 'air')) {
        o.vz -= G * dt; o.z += o.vz * dt; o.x += o.hx * dt; o.y += o.hy * dt; o.t0 += dt;
        if (!o.conf && o.z <= 13) { o.conf = 1; this.irD[o.bin] = .7; this.say(`#${o.id}: IR drop-confirm on the ${BINS[o.bin].name} ✔`); }
        if (o.t0 >= o.T || o.z <= o.tgt[2]) {
          [o.x, o.y, o.z] = o.tgt; o.st = 'bin'; this.bins_[o.bin].push(o); this.counts[o.bin]++;
          const truth = CLS.includes(o.kind) ? CLS.indexOf(o.kind) : 3, ok = truth === o.bin; this.stats.sorted++; if (ok) this.stats.correct++; if (o.bin === 3) this.stats.rejected++;
          this.lastDone = o; this.say(`#${o.id} (${o.k.name}) → <b>${BINS[o.bin].name}</b> ${ok ? '✔ correct' : '✘ wrong'}`); if (this.onDone) this.onDone();
        }
      }
      this.objs = O.filter(o => o.st !== 'bin');
      this.ledOn = this.objs.some(o => ['scan', 'chamber', 'decide'].includes(o.st));
      const act = this.objs.filter(o => o.st !== 'tube' && o.st !== 'feed'), f = act.slice().sort((a, b) => rank[b.st] - rank[a.st])[0]; this.focus = f || null;
      if (f) { const r = rank[f.st]; this.stage = r <= 1 ? 'DETECTING' : r === 2 ? 'CLASSIFYING' : r === 3 ? 'DECISION' : 'SORTING'; this.progress = [.05, .2, .2 + .3 * clampv((f.t || 0) / .85, 0, 1) + .1, .66, .8, .95][r] || .5; }
      else if (this.objs.length) { this.stage = 'DETECTING'; this.progress = .05; }
      else { this.stage = this.stats.sorted ? 'COMPLETED' : 'IDLE'; this.progress = this.stats.sorted ? 1 : 0; }
    },

    activeParts() {
      const s = new Set(); if (!this.running) return s; s.add(15);
      for (const o of this.objs) {
        const r = rank[o.st]; if (o.st === 'feed' || o.st === 'tube') s.add(2); else if (r === 1) { [2, 3, 4, 13].forEach(n => s.add(n)); } else if (r === 2) { [5, 6, 12, 16].forEach(n => s.add(n)); } else if (r === 3) { [12, 13, 9].forEach(n => s.add(n)); } else if (r === 4) { [7, 8, 9, 13].forEach(n => s.add(n)); } else s.add(11), s.add(10);
      }
      if (this.ph === 'release' || this.ph === 'restore') s.add(3);
      return s;
    },
    tags() {
      const t = [{ anchor: [22, 22, 58.5], text: 'OBJECT ENTRY', dx: -40, dy: -22 }];
      const f = this.focus; if (f && f.bin !== undefined) { const [cx, cy] = cup(f.bin); t.push({ anchor: [cx, cy, 12], text: 'TARGET: ' + BINS[f.bin].name.toUpperCase(), dx: 0, dy: 46, col: f.bin === 3 ? '#c0392b' : '#1e9e55' }); }
      return t;
    },
    info() {
      const f = this.focus || this.lastDone, v = f && f.vote;
      return [['Object', f ? `#${f.id} · ${f.k.name} ${f.shape}` : '—'],
        ['Frames (5)', f && f.fr && f.fr.length ? f.fr.map(x => `<span style="color:${(KINDS.find(k => k.id === x.c) || { hex: '#9b59b6' }).hex}">●</span>`).join(' ') : '—'],
        ['Vote / confidence', v ? `<b>${v.c.toUpperCase()}</b> ${v.n}/5 · area ${Math.round(v.ratio * 100)}%` : '—'], ['Decision', f && f.cls ? `<b>${f.cls.toUpperCase()}</b> → ${BINS[f.bin].name}` : '—'],
        ['Rule applied', f && f.rule ? f.rule : '—'], ['Escapement', this.esc.e > .5 ? 'pin 1 IN (holding)' : 'pin 2 IN (pinching next)'],
        ['Gate G1', `${Math.round(this.g1.th)}°`], ['Chute S2', `${Math.round(this.s2.a)}°`], ['IR chamber', this.irT > 0 ? '<b style="color:#c47f00">BROKEN</b>' : 'clear'],
        ['In tube', this.objs.filter(o => o.st === 'tube' || o.st === 'feed').length], ['Throughput', this.stats.sorted && this.time ? `${(this.stats.sorted / this.time * 60).toFixed(1)} obj/min` : '—']];
    },
    cameraView(c, W, H) {
      c.fillStyle = '#0b0f16'; c.fillRect(0, 0, W, H); c.font = '10px ui-monospace,Menlo,monospace'; c.fillStyle = '#6fa0d8'; c.fillText('CHAMBER CAM · ROI + HSV vote', 6, 12);
      c.fillStyle = this.ledOn ? '#e6e9ee' : '#2a303b'; c.fillRect(30, 22, W - 60, H - 52);
      const o = this.objs.find(o => ['chamber', 'scan', 'decide', 'aim'].includes(o.st));
      if (!o) { c.fillStyle = '#5b6b82'; c.textAlign = 'center'; c.fillText('chamber empty', W / 2, 84); c.textAlign = 'left'; return; }
      const x = W / 2, y = 82, s = o.r * 17; c.fillStyle = o.k.hex; c.beginPath(); if (o.shape === 'ball') c.arc(x, y, s, 0, 7); else c.rect(x - s, y - s, s * 2, s * 2); c.fill();
      c.strokeStyle = '#1b8a4a'; c.lineWidth = 1.5; c.setLineDash([4, 3]); c.strokeRect(x - 40, y - 40, 80, 80); c.setLineDash([]);
      (o.fr || []).forEach((f, i) => { c.fillStyle = (KINDS.find(k => k.id === f.c) || { hex: '#9b59b6' }).hex; c.beginPath(); c.arc(40 + i * 18, H - 14, 6, 0, 7); c.fill(); });
      c.fillStyle = '#9fb3cf'; c.fillText(o.vote ? `${o.vote.c.toUpperCase()} ${o.vote.n}/5` : `frame ${(o.fr || []).length}/5`, W - 100, H - 10);
    },

    drawObj(g, o, lay) { if (o.shape === 'ball') g.sphere(o.x, o.y, o.z, o.r, o.k.hex, lay); else g.cube(o.x, o.y, o.z - o.r, o.r * 2, o.r * 2, o.r * 2, o.yaw, o.k.hex, lay); },
    draw(g) {
      const { ALU, ACR, WOOD } = Parts, blink = this.running && Math.floor(performance.now() / 250) % 2, tm = this.time, E = this.esc, s2 = this.s2;
      g.box(-2, 12, 0, 48, 36, 2, WOOD, { layer: 0 });
      g.box(0, 14, 2, 44, 2, 52, '#c0392b');
      g.box(0, 14, 46, 44, 14, 1.2, '#f4f6f8'); g.box(12, 14, 18, 20, 14, 1.2, '#f4f6f8');
      Parts.post(g, 1, 26, 2, 44, 1.6); Parts.post(g, 41.4, 26, 2, 44, 1.6); g.box(2.6, 26.4, 45.2, 38.8, .8, .8, ALU);
      // electronics on the top shelf
      Parts.rpi(g, 2, 16, 47.2); Parts.arduino(g, 28, 15.5, 47.2, 7.4, 5, 'UNO'); g.box(29, 22, 47.2, 8, 4.5, .8, '#e9ecef'); g.toptext(29.6, 25.6, 48, 'BREADBOARD', .8, '#556');
      Parts.psu(g, 36.8, 15.5, 47.2, 6.2, 5, 3.4); g.sphere(31, 17.5, 48.4, .3, blink ? '#ffe400' : '#6b5d00', 3); g.sphere(8, 17, 49, .3, this.running ? '#22ff55' : '#116622', 3);
      // tube + chamber
      g.frust(CX, CY, 39, 19.5, 3, 3, '#e08a2a', { a: .35 }); g.frust(CX, CY, 58.5, .6, 3.3, 3.3, '#e08a2a');
      g.box(18.5, 18.5, 34, 7, 7, 5, '#ffffff', { a: .2 });
      const lc = this.ledOn ? '#fffbd0' : '#d8d2a0'; g.box(18.6, 19.5, 34.8, .5, 5, 3.6, lc, { layer: 3 }); g.box(24.9, 19.5, 34.8, .5, 5, 3.6, lc, { layer: 3 });
      if (this.ledOn) g.over(gg => { const [x, y] = gg.T(CX, CY, 36.5), c = gg.ctx, gr = c.createRadialGradient(x, y, 2, x, y, 46); gr.addColorStop(0, 'rgba(255,255,210,.4)'); gr.addColorStop(1, 'rgba(255,255,210,0)'); c.fillStyle = gr; c.fillRect(x - 48, y - 48, 96, 96); });
      // IR beam across the chamber
      g.box(21.35, 17.2, 35.2, 1.3, 1.3, 1.7, '#202226'); g.box(21.35, 26.6, 35.2, 1.3, 1.3, 1.7, '#202226');
      g.line3([[22, 18.5, 36], [22, 26.6, 36]], this.irT > 0 ? '#ffd400' : '#e53935', this.irT > 0 ? 3.4 : 1.6, this.irT > 0 ? null : [4, 3]);
      // camera + arm
      g.box(24.6, 16, 35.8, 1.6, 19.6, 1.4, ALU); Parts.camera(g, 20, 33.4, 34.4, 4.6, 3.2, 3.4); g.sphere(22.3, 33.4, 36.1, .9, '#101214', 3);
      // escapement: servo + rack + pins
      Parts.servo(g, 28.8, 20.8, 38.4, 4.4, 2.4, 4.2); g.rod([28.4, 22, 38.8], [28.4, 22, 45], .3, '#9aa3ad', { layer: 3 });
      for (const [z, eP] of [[ZP1, E.e], [ZP2, 1 - E.e]]) g.rod([28.4, 22, z], [lerp(27.2, 20.8, eP), 22, z], .38, '#ff7a00', { layer: 3 });
      // gate G1
      const th = (g1 => g1.th + (g1.wig > 0 ? 9 * Math.sin(tm * 50) : 0))(this.g1) * DEG; Parts.servo(g, 13.2, 20.8, 33, 4.6, 2.4, 4.2);
      g.rod([17.8, 22, 34.2], [18.9, 22, 34], .3, '#9aa3ad', { layer: 3 }); g.rod([18.9, 22, 34], [18.9 + 6 * Math.cos(th), 22, 34 - 6 * Math.sin(th)], .42, '#ff7a00', { layer: 3 });
      // chute servo + swing chute
      g.box(19.7, 20.8, 19.2, 4.6, 2.4, 4.2, '#2a6fdb'); g.frust(CX, CY, 23.4, 1.6, 1.4, 1.4, '#c8cdd2');
      const a = s2.a * DEG, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, w = 1.9, r0 = -1.8, r1 = RO + .8, P = (r, k, z) => [CX + r * ux + k * nx, CY + r * uy + k * ny, z];
      g.quad([P(r0, w, zf(r0)), P(r1, w, zf(r1)), P(r1, -w, zf(r1)), P(r0, -w, zf(r0))], '#3b4a63', 1, 3);
      g.quad([P(r0, w, zf(r0)), P(r1, w, zf(r1)), P(r1, w, zf(r1) + 2), P(r0, w, zf(r0) + 2)], ACR, .5, 3); g.quad([P(r0, -w, zf(r0)), P(r1, -w, zf(r1)), P(r1, -w, zf(r1) + 2), P(r0, -w, zf(r0) + 2)], ACR, .5, 3);
      // cups + IR drop confirm
      for (let i = 0; i < 4; i++) {
        const [cx, cy] = cup(i), an = BANG[i] * DEG, px = -Math.sin(an), py = Math.cos(an); for (const ob of this.bins_[i]) this.drawObj(g, ob, 1);
        g.frust(cx, cy, 2, 10, 4.2, 4.6, BINS[i].hex, { a: .45 }); g.frust(cx, cy, 10.6, 1.4, 4.6, 5.6, BINS[i].hex, { a: .5 });
        for (const sg of [-1, 1]) g.box(cx + sg * 6.4 * px - .5, cy + sg * 6.4 * py - .5, 12, 1, 1, 1.4, '#202226');
        g.line3([[cx - 6 * px, cy - 6 * py, 12.7], [cx + 6 * px, cy + 6 * py, 12.7]], this.irD[i] > 0 ? '#ffd400' : 'rgba(229,57,53,.7)', this.irD[i] > 0 ? 3 : 1.2, this.irD[i] > 0 ? null : [3, 3]);
        g.over(gg => { const [x, y] = gg.T(cx, cy + 5.5, 1), c = gg.ctx, tw = BTXT[i].length * 7 + 14; c.fillStyle = i === 3 ? '#c0392b' : 'rgba(15,27,45,.85)'; c.beginPath(); c.roundRect(x - tw / 2, y + 2, tw, 16, 8); c.fill(); c.fillStyle = '#fff'; c.font = '700 10px Helvetica,Arial'; c.textAlign = 'center'; c.fillText(BTXT[i], x, y + 13.5); c.textAlign = 'left'; });
      }
      for (const o of this.objs) this.drawObj(g, o, 4);
      for (const o of this.objs) { if (o.st === 'tube' && o.z > 47) continue; const txt = `#${o.id}`; g.over(gg => { const [x, y] = gg.T(o.x, o.y, o.z + o.r + 1), c = gg.ctx, w2 = 28; c.fillStyle = 'rgba(15,27,45,.88)'; c.beginPath(); c.roundRect(x - w2 / 2 + 22, y - 12, w2, 15, 7); c.fill(); c.fillStyle = '#fff'; c.font = '700 10px Helvetica,Arial'; c.textAlign = 'center'; c.fillText(txt, x + 22, y - 1); c.textAlign = 'left'; }); }
      const sc = this.objs.find(o => o.st === 'scan'); if (sc && this.camT > 0) g.line3([[22.3, 33.4, 36.1], [sc.x, sc.y, sc.z]], '#ffd400', 3);
      g.line3([[22, 22, 57], [22, 22, 40]], 'rgba(255,122,0,.5)', 2.4, [8, 6]); g.line3([[22, 22, 33], [22, 22, 27]], 'rgba(255,122,0,.5)', 2.4, [6, 5]);
    },
  };
  sim.reset();
  window.addEventListener('DOMContentLoaded', () => { window.shell = new Shell(sim); });
})();
