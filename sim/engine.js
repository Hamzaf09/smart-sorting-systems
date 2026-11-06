'use strict';
/* Isometric canvas engine + shared simulation shell (controls, status, legend). */
const C30 = Math.cos(Math.PI / 6), S5 = 0.5, K3 = Math.sqrt(1.5);
const clamp8 = v => Math.max(0, Math.min(255, Math.round(v)));
function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); }
function rgb2hex(r, g, b) { return '#' + [r, g, b].map(v => clamp8(v).toString(16).padStart(2, '0')).join(''); }
function shade(h, f) { const [r, g, b] = hex2rgb(h); if (f <= 1) return rgb2hex(r * f, g * f, b * f); const t = f - 1; return rgb2hex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t); }
function hull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  const up = []; for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const lerp = (a, b, t) => a + (b - a) * t;
const clampv = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

class Iso {
  constructor(canvas, bounds, margin) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.bounds = bounds;
    this.margin = margin || { l: 70, r: 70, t: 20, b: 20 }; this.items = []; this.overs = []; this.resize();
  }
  resize() {
    const r = this.cv.getBoundingClientRect(); this.dpr = window.devicePixelRatio || 1; this.W = r.width; this.H = r.height;
    this.cv.width = Math.round(r.width * this.dpr); this.cv.height = Math.round(r.height * this.dpr);
    const b = this.bounds, xs = [], ys = [];
    for (const X of b.x) for (const Y of b.y) for (const Z of b.z) { xs.push((X - Y) * C30); ys.push((X + Y) * S5 - Z); }
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys), m = this.margin;
    this.k = Math.max(.5, Math.min((this.W - m.l - m.r) / (maxx - minx), (this.H - m.t - m.b) / (maxy - miny)));
    this.ox = m.l + (this.W - m.l - m.r) / 2 - this.k * (minx + maxx) / 2;
    this.oy = m.t + (this.H - m.t - m.b) / 2 - this.k * (miny + maxy) / 2;
    this.modelX = [this.ox + this.k * minx, this.ox + this.k * maxx];
  }
  T(x, y, z) { return [this.ox + this.k * (x - y) * C30, this.oy + this.k * ((x + y) * S5 - z)]; }
  begin() { this.items = []; this.overs = []; }
  add(bb, draw, layer = 1) { this.items.push({ bb, draw, layer, n: this.items.length }); }
  over(fn) { this.overs.push(fn); }
  poly(pts, fill, stroke, a = 1, sw = .7) {
    const c = this.ctx; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
    c.globalAlpha = a; c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = sw; c.lineJoin = 'round'; c.globalAlpha = Math.min(1, a + .35); c.stroke(); }
    c.globalAlpha = 1;
  }
  // ---------------------------------------------------------- primitives
  box(x, y, z, dx, dy, dz, col, o = {}) {
    const a = o.a ?? 1, layer = o.layer ?? (a < 1 ? 2 : 1), x1 = x + dx, y1 = y + dy, z1 = z + dz, ec = o.edge || shade(col, .4), tc = o.top || shade(col, 1.15);
    this.add([x, x1, y, y1, z, z1], g => {
      const T = (X, Y, Z) => g.T(X, Y, Z);
      g.poly([T(x, y, z1), T(x1, y, z1), T(x1, y1, z1), T(x, y1, z1)], tc, ec, a);
      g.poly([T(x1, y, z), T(x1, y1, z), T(x1, y1, z1), T(x1, y, z1)], shade(col, .7), ec, a);
      g.poly([T(x, y1, z), T(x1, y1, z), T(x1, y1, z1), T(x, y1, z1)], shade(col, .86), ec, a);
    }, layer);
    return [x + dx / 2, y + dy / 2, z + dz];
  }
  frust(cx, cy, z, h, r0, r1, col, o = {}) {
    const a = o.a ?? 1, layer = o.layer ?? (a < 1 ? 2 : 1), R = Math.max(r0, r1), ec = o.edge || shade(col, .4);
    this.add([cx - R, cx + R, cy - R, cy + R, z, z + h], g => {
      const pts = [], top = [];
      for (let i = 0; i < 36; i++) { const t = 2 * Math.PI * i / 36, c = Math.cos(t), s = Math.sin(t); pts.push(g.T(cx + r0 * c, cy + r0 * s, z)); const u = g.T(cx + r1 * c, cy + r1 * s, z + h); pts.push(u); top.push(u); }
      const hl = hull(pts), xs = hl.map(p => p[0]), c = g.ctx, gr = c.createLinearGradient(Math.min(...xs), 0, Math.max(...xs), 0);
      gr.addColorStop(0, shade(col, 1.25)); gr.addColorStop(.45, col); gr.addColorStop(1, shade(col, .55));
      c.beginPath(); hl.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
      if (a < 1) { top.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); }
      c.globalAlpha = a; c.fillStyle = gr; c.fill(a < 1 ? 'evenodd' : 'nonzero'); c.strokeStyle = ec; c.lineWidth = .7; c.globalAlpha = Math.min(1, a + .35); c.stroke(); c.globalAlpha = 1;
      if (a >= 1) {
        g.poly(top, shade(col, 1.2), ec, 1);
        if (o.hole) { const ri = r1 - o.hole, inner = []; for (let i = 0; i < 36; i++) { const t = 2 * Math.PI * i / 36; inner.push(g.T(cx + ri * Math.cos(t), cy + ri * Math.sin(t), z + h)); } g.poly(inner, shade(col, .3), ec, 1, .6); }
      } else { g.poly(top, 'rgba(0,0,0,0)', shade(col, 1.3), 0, 0); c.beginPath(); top.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.strokeStyle = shade(col, 1.35); c.lineWidth = 2; c.stroke(); }
    }, layer);
    return [cx, cy, z + h];
  }
  sphere(cx, cy, cz, r, col, layer = 1) {
    this.add([cx - r, cx + r, cy - r, cy + r, cz - r, cz + r], g => {
      const [px, py] = g.T(cx, cy, cz), rr = K3 * r * g.k, c = g.ctx, gr = c.createRadialGradient(px - rr * .3, py - rr * .35, rr * .05, px, py, rr);
      gr.addColorStop(0, shade(col, 1.55)); gr.addColorStop(.5, col); gr.addColorStop(1, shade(col, .5));
      c.beginPath(); c.arc(px, py, rr, 0, 7); c.fillStyle = gr; c.fill(); c.strokeStyle = shade(col, .45); c.lineWidth = .6; c.stroke();
    }, layer);
  }
  rod(A, B, r, col, o = {}) {
    const a = o.a ?? 1, layer = o.layer ?? (a < 1 ? 2 : 1);
    this.add([Math.min(A[0], B[0]) - r, Math.max(A[0], B[0]) + r, Math.min(A[1], B[1]) - r, Math.max(A[1], B[1]) + r, Math.min(A[2], B[2]) - r, Math.max(A[2], B[2]) + r], g => {
      const pa = g.T(...A), pb = g.T(...B), w = Math.max(1.2, 2 * K3 * r * g.k), c = g.ctx;
      c.lineCap = 'round'; c.globalAlpha = a;
      const ln = (ox, ox2, col2, lw) => { c.beginPath(); c.moveTo(pa[0] + ox, pa[1] + ox); c.lineTo(pb[0] + ox, pb[1] + ox); c.strokeStyle = col2; c.lineWidth = lw; c.stroke(); };
      ln(0, 0, shade(col, .4), w + 1.6); ln(0, 0, col, w); if (w > 4) ln(-w * .18, 0, shade(col, 1.4), w * .28);
      c.globalAlpha = 1;
    }, layer);
  }
  wire(pts, col = '#222', r = .28) { for (let i = 0; i < pts.length - 1; i++) this.rod(pts[i], pts[i + 1], r, col, { layer: 3 }); }
  /** extruded rotated rectangle (cube) */
  cube(cx, cy, z, sx, sy, sz, yaw, col, layer = 1) {
    const co = Math.cos(yaw), si = Math.sin(yaw), hx = sx / 2, hy = sy / 2;
    const P = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(([a, b]) => [cx + a * co - b * si, cy + a * si + b * co]);
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    this.add([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), z, z + sz], g => {
      const ec = shade(col, .4);
      for (let i = 0; i < 4; i++) {
        const p = P[i], q = P[(i + 1) % 4], nx = q[1] - p[1], ny = -(q[0] - p[0]);
        if (nx + ny <= 0) continue;
        g.poly([g.T(p[0], p[1], z), g.T(q[0], q[1], z), g.T(q[0], q[1], z + sz), g.T(p[0], p[1], z + sz)], shade(col, nx > ny ? .7 : .86), ec, 1);
      }
      g.poly(P.map(p => g.T(p[0], p[1], z + sz)), shade(col, 1.15), ec, 1);
    }, layer);
  }
  cyl(axis, x, y, z, L, r, col, o = {}) {
    const a = o.a ?? 1, layer = o.layer ?? (a < 1 ? 2 : 1), ec = shade(col, .4);
    const bb = axis === 'x' ? [x, x + L, y - r, y + r, z - r, z + r] : [x - r, x + r, y, y + L, z - r, z + r];
    const circ = e => Array.from({ length: 28 }, (_, i) => { const t = 2 * Math.PI * i / 28; return axis === 'x' ? [e, y + r * Math.cos(t), z + r * Math.sin(t)] : [x + r * Math.cos(t), e, z + r * Math.sin(t)]; });
    this.add(bb, g => {
      const e0 = axis === 'x' ? x : y, p0 = circ(e0).map(p => g.T(...p)), p1 = circ(e0 + L).map(p => g.T(...p)), hl = hull(p0.concat(p1)), xs = hl.map(p => p[0]), c = g.ctx;
      const gr = c.createLinearGradient(Math.min(...xs), 0, Math.max(...xs), 0); gr.addColorStop(0, shade(col, 1.25)); gr.addColorStop(.45, col); gr.addColorStop(1, shade(col, .55));
      g.poly(hl, gr, ec, a); g.poly(p1, shade(col, 1.18), ec, a);
    }, layer);
  }
  ring(cx, cy, z, r, w, col, glow) {
    this.add([cx - r, cx + r, cy - r, cy + r, z, z + .1], g => {
      const c = g.ctx, pts = []; for (let i = 0; i < 48; i++) pts.push(g.T(cx + r * Math.cos(2 * Math.PI * i / 48), cy + r * Math.sin(2 * Math.PI * i / 48), z));
      const path = () => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); };
      if (glow) { path(); c.strokeStyle = glow; c.globalAlpha = .3; c.lineWidth = w * g.k * 2.6; c.stroke(); c.globalAlpha = 1; }
      path(); c.strokeStyle = col; c.lineWidth = Math.max(1.6, w * g.k); c.stroke();
    }, 3);
  }
  quad(pts, col, a = 1, layer, edge) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), zs = pts.map(p => p[2]);
    this.add([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), Math.min(...zs), Math.max(...zs)], g => g.poly(pts.map(p => g.T(...p)), col, edge || shade(col, .5), a), layer ?? (a < 1 ? 2 : 1));
  }
  /** X-Z profile polygon extruded along Y from ya to yb (ramps, planks) */
  prism(prof, ya, yb, col, o = {}) {
    const a = o.a ?? 1, layer = o.layer ?? (a < 1 ? 2 : 1), ec = o.edge || shade(col, .4), n = prof.length;
    let area = 0; for (let i = 0; i < n; i++) { const p = prof[i], q = prof[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
    const sg = area > 0 ? 1 : -1, xs = prof.map(p => p[0]), zs = prof.map(p => p[1]);
    this.add([Math.min(...xs), Math.max(...xs), ya, yb, Math.min(...zs), Math.max(...zs)], g => {
      for (let i = 0; i < n; i++) {
        const p = prof[i], q = prof[(i + 1) % n], dx = q[0] - p[0], dz = q[1] - p[1], nx = sg * dz, nz = -sg * dx, ln = Math.hypot(nx, nz) || 1;
        if ((nx + nz) / ln <= .02) continue;
        g.poly([g.T(p[0], ya, p[1]), g.T(q[0], ya, q[1]), g.T(q[0], yb, q[1]), g.T(p[0], yb, p[1])], shade(col, .62 + .5 * Math.max(0, nz / ln)), ec, a, .6);
      }
      g.poly(prof.map(p => g.T(p[0], yb, p[1])), shade(col, .9), ec, a, .7);
    }, layer);
  }
  toptext(x, y, z, txt, size, col = '#fff') {
    this.add([x, x + .1, y, y + .1, z, z + .2], g => {
      const [e, f] = g.T(x, y, z), c = g.ctx, k = g.k; c.save(); c.transform(C30 * k, S5 * k, -C30 * k, S5 * k, e, f);
      c.font = `700 ${size}px Helvetica,Arial,sans-serif`; c.fillStyle = col; c.fillText(txt, 0, 0); c.restore();
    }, 4);
  }
  facetext(x, y, z, txt, size, col = '#fff') {
    this.add([x, x + .1, y, y + .1, z - size, z], g => {
      const [e, f] = g.T(x, y, z), c = g.ctx, k = g.k; c.save(); c.transform(C30 * k, S5 * k, 0, k, e, f);
      c.font = `700 ${size}px Helvetica,Arial,sans-serif`; c.fillStyle = col; c.fillText(txt, 0, 0); c.restore();
    }, 4);
  }
  line3(pts, col, w, dash, a = 1) {
    this.over(g => { const c = g.ctx; c.beginPath(); pts.forEach((p, i) => { const q = g.T(...p); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.strokeStyle = col; c.lineWidth = w; c.globalAlpha = a; c.setLineDash(dash || []); c.lineCap = 'round'; c.stroke(); c.setLineDash([]); c.globalAlpha = 1; });
  }
  // ---------------------------------------------------------- ordering + flush
  order() {
    const items = this.items.slice().sort((a, b) => a.layer - b.layer || a.n - b.n), out = [], e = 1e-6;
    for (const L of [...new Set(items.map(i => i.layer))]) {
      const grp = items.filter(i => i.layer === L), n = grp.length, pred = Array.from({ length: n }, () => new Set());
      const behind = (i, j) => { const a = grp[i].bb, b = grp[j].bb; return a[1] <= b[0] + e || a[3] <= b[2] + e || a[5] <= b[4] + e; };
      const key = i => { const b = grp[i].bb; return (b[0] + b[1]) / 2 + (b[2] + b[3]) / 2 + .4 * (b[4] + b[5]) / 2; };
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const bi = behind(i, j), bj = behind(j, i); if (bi && !bj) pred[j].add(i); else if (bj && !bi) pred[i].add(j); }
      const done = new Set(), keys = grp.map((_, i) => key(i));
      while (done.size < n) {
        let best = -1, bk = 1e9;
        for (let i = 0; i < n; i++) { if (done.has(i)) continue; let ok = true; for (const p of pred[i]) if (!done.has(p)) { ok = false; break; } if (ok && keys[i] < bk) { bk = keys[i]; best = i; } }
        if (best < 0) for (let i = 0; i < n; i++) if (!done.has(i) && keys[i] < bk) { bk = keys[i]; best = i; }
        done.add(best); out.push(grp[best]);
      }
    }
    return out;
  }
  flush(floor) {
    const c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.W, this.H);
    if (floor) {
      const [x0, x1, y0, y1] = floor, T = (x, y) => this.T(x, y, 0);
      this.poly([T(x0, y0), T(x1, y0), T(x1, y1), T(x0, y1)], '#e9eef5', '#c3cedc', 1, 1);
      c.strokeStyle = '#cdd6e3'; c.lineWidth = .7; c.beginPath();
      for (let x = Math.ceil(x0 / 10) * 10; x <= x1; x += 10) { const a = T(x, y0), b = T(x, y1); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
      for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += 10) { const a = T(x0, y), b = T(x1, y); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
      c.stroke();
    }
    for (const it of this.order()) it.draw(this);
    for (const f of this.overs) f(this);
  }
}

/* ------------------------------------------------------------------ parts */
const Parts = {
  WOOD: '#c9a26b', ALU: '#b9c1c9', ACR: '#8fd3ee',
  arduino(g, x, y, z, w = 9, d = 5.4, txt = 'MEGA') {
    g.box(x, y, z, w, d, .8, '#0a8f9f'); g.box(x - .9, y + .7, z + .1, 2.8, 2.6, 1.7, '#c9ced3'); g.box(x + w - 3.4, y + d * .28, z + .8, 2.2, 2.2, .5, '#111');
    g.box(x + 1.6, y + .25, z + .8, w - 3.2, .5, .8, '#222'); g.box(x + 1.6, y + d - .75, z + .8, w - 3.2, .5, .8, '#222'); g.toptext(x + 2.4, y + d * .66, z + .85, txt, 1.2);
    return [x + w / 2, y + d / 2, z + .8];
  },
  rpi(g, x, y, z, w = 8.6, d = 5.6) {
    g.box(x, y, z, w, d, .7, '#2d9b57'); g.box(x + w - 2.3, y + .5, z + .7, 3, 2, 1.6, '#c9ced3'); g.box(x + w - 2.3, y + 3, z + .7, 3, 2, 1.6, '#c9ced3');
    g.box(x + 2.2, y + 1.6, z + .7, 2.4, 2.4, .5, '#111'); g.box(x + .3, y + d - .7, z + .7, w - 3, .4, .7, '#222'); g.toptext(x + .7, y + 1.2, z + .75, 'Pi 4', 1.1);
    return [x + w / 2, y + d / 2, z + .7];
  },
  psu(g, x, y, z, w = 11, d = 6, h = 4.8) {
    g.box(x, y, z, w, d, h, '#aab3bc'); for (let i = 0; i < 6; i++) g.box(x + 1 + i * (w - 2) / 6, y + .6, z + h, .5, d - 1.2, .12, '#6f7a85');
    g.box(x + w - .3, y + 1, z + 1.2, .6, d - 2, 2.2, '#27a35a'); g.facetext(x + .8, y + d, z + h - .9, '12V 10A', 1.5, '#2b2f36');
    return [x + w / 2, y + d / 2, z + h];
  },
  l298n(g, x, y, z, w = 6.4, d = 5.6, lab = 'A4988') {
    g.box(x, y, z, w, d, .6, '#c0392b'); g.box(x + 1.3, y + 1, z + .6, 3, 3.2, 3, '#222'); g.box(x + .15, y + .3, z + .6, 1.1, d - .6, 1, '#2e6fd8');
    g.box(x + w - 1.25, y + .3, z + .6, 1.1, d - .6, 1, '#2e6fd8'); g.facetext(x + .6, y + d, z + .6, lab, 1, '#fff');
    return [x + w / 2, y + d / 2, z + 1.5];
  },
  servo(g, x, y, z, dx = 4.6, dy = 2.4, dz = 4.4, col = '#2a6fdb') {
    g.box(x, y, z, dx, dy, dz, col); g.box(x - 1, y, z + dz * .62, dx + 2, dy, .35, col);
    return [x + dx / 2, y + dy / 2, z + dz];
  },
  camera(g, x, y, z, dx = 4, dy = 3.2, dz = 3.4) {
    g.box(x, y, z, dx, dy, dz, '#1c1f24'); g.box(x + .3, y + .3, z + dz, dx - .6, dy - .6, .25, '#2a7a3a'); return [x + dx / 2, y + dy / 2, z + dz];
  },
  post(g, x, y, z, h, w = 2) { g.box(x, y, z, w, w, h, '#b9c1c9'); },
};

/* ------------------------------------------------------------------ Shell */
const STAGES = ['DETECTING', 'CLASSIFYING', 'DECISION', 'SORTING', 'COMPLETED'];
const CATS = { sense: ['#8e44ad', 'Sensors'], ctrl: ['#0e8f9f', 'Controllers'], act: ['#e67e22', 'Motors / servos'], struct: ['#34495e', 'Frame / transport'], bin: ['#27ae60', 'Entry / bins'] };
const $ = (s, r = document) => r.querySelector(s);
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

class Shell {
  constructor(sim) {
    this.sim = sim; this.running = false; this.speed = 1; this.hover = null; this.shape = 'ball'; this.kind = sim.kinds[0].id; this.stepMode = false;
    document.title = sim.title + ' – simulation';
    const app = $('#app');
    app.innerHTML = `
    <header><a class="back" href="../index.html">← All concepts</a><div class="num">${sim.num}</div><div><h1>${sim.title}</h1><p>${sim.subtitle}</p></div></header>
    <main>
      <section class="stage"><canvas id="cv"></canvas><div id="tip" class="tip"></div>
        <div class="hud"><span id="hudTime">t = 0.0 s</span><span id="hudState"></span></div></section>
      <aside>
        <div class="card"><h3>Controls</h3>
          <div class="row"><button id="bStart" class="pri">▶ Start</button><button id="bPause">⏸ Pause</button><button id="bStep">⏭ One object</button><button id="bReset">⟳ Reset</button></div>
          <label class="sl">Speed <input id="spd" type="range" min="0.25" max="4" step="0.25" value="1"><b id="spdv">1×</b></label>
          <div class="sub">Object</div><div class="chips" id="kinds"></div>
          <div class="row"><div class="seg" id="shapes"></div></div>
          <div class="row"><button id="bAdd">＋ Add to queue</button><button id="bRnd">＋5 random</button><button id="bClr">Clear queue</button></div>
          <div id="opts"></div>
          <div class="sub">Queue (<span id="qn">0</span>)</div><div class="queue" id="queue"></div></div>
        <div class="card"><h3>Decision pipeline</h3><div class="pills" id="pills"></div><div class="progress"><i id="prog"></i></div></div>
        <div class="card"><h3>Live object data</h3><table id="props"></table></div>
        ${sim.cameraView ? '<div class="card"><h3>Camera view (OpenCV)</h3><canvas id="cam" width="300" height="170"></canvas></div>' : ''}
        <div class="card"><h3>Collection bins</h3><div id="bins" class="bins"></div><div id="stats" class="stats"></div></div>
        <div class="card"><h3>Event log</h3><div id="log" class="log"></div></div>
      </aside>
    </main>
    <section class="legend"><h3>Component legend <small>hover a row or a numbered badge to locate it · active parts pulse during the process</small></h3><div id="leg"></div></section>`;
    this.cv = $('#cv'); this.g = new Iso(this.cv, sim.bounds, { l: 74, r: 74, t: 24, b: 20 });
    this.cam = $('#cam') ? $('#cam').getContext('2d') : null;
    this.buildUI(); this.bind(); this.layoutCallouts();
    new ResizeObserver(() => { this.g.resize(); this.layoutCallouts(); }).observe(this.cv);
    this.last = performance.now(); this.uiT = 0; requestAnimationFrame(t => this.loop(t));
    sim.onDone = () => { if (this.stepMode) { this.running = false; this.stepMode = false; this.sync(); } };
    this.sync();
  }
  buildUI() {
    const s = this.sim;
    $('#kinds').append(...s.kinds.map(k => { const b = el('button', 'chip' + (k.id === this.kind ? ' on' : ''), `<i style="background:${k.hex}"></i>${k.name}`); b.onclick = () => { this.kind = k.id; [...$('#kinds').children].forEach(c => c.classList.toggle('on', c === b)); }; return b; }));
    $('#shapes').append(...['ball', 'cube'].map(sh => { const b = el('button', sh === this.shape ? 'on' : '', sh === 'ball' ? '● Ball' : '■ Cube'); b.onclick = () => { this.shape = sh; [...$('#shapes').children].forEach(c => c.classList.toggle('on', c === b)); }; return b; }));
    $('#pills').append(...STAGES.map(st => el('div', 'pill', st)));
    $('#opts').append(...(s.options || []).map(o => { const l = el('label', 'opt', `<input type="checkbox" ${o.value ? 'checked' : ''}> ${o.label}`); l.firstChild.onchange = e => { s.opts[o.id] = e.target.checked; }; s.opts[o.id] = !!o.value; return l; }));
    $('#bins').append(...s.bins.map((b, i) => el('div', 'bin', `<i style="background:${b.hex}"></i><span>${b.name}</span><b id="bc${i}">0</b>`)));
    const leg = $('#leg');
    for (const p of [...s.parts].sort((a, b) => a.n - b.n)) {
      const r = el('div', 'lrow', `<span class="bdg" style="background:${CATS[p.cat][0]}">${p.n}</span><div><b>${p.name}</b><small>→ ${p.func}</small></div>`);
      r.onmouseenter = () => { this.hover = p.n; }; r.onmouseleave = () => { this.hover = null; }; leg.append(r);
    }
    leg.append(el('div', 'lkey', Object.values(CATS).map(c => `<span><i style="background:${c[0]}"></i>${c[1]}</span>`).join('')));
  }
  bind() {
    const s = this.sim;
    $('#bStart').onclick = () => { this.running = true; this.stepMode = false; this.sync(); };
    $('#bPause').onclick = () => { this.running = false; this.sync(); };
    $('#bStep').onclick = () => { this.running = true; this.stepMode = true; this.sync(); };
    $('#bReset').onclick = () => { s.reset(); this.running = false; this.stepMode = false; this.sync(); };
    $('#spd').oninput = e => { this.speed = +e.target.value; $('#spdv').textContent = this.speed + '×'; };
    $('#bAdd').onclick = () => s.enqueue(this.kind, this.shape);
    $('#bRnd').onclick = () => { for (let i = 0; i < 5; i++) s.enqueue(s.kinds[Math.floor(Math.random() * s.kinds.length)].id, Math.random() < .6 ? 'ball' : 'cube'); };
    $('#bClr').onclick = () => { s.queue.length = 0; };
    this.cv.onmousemove = e => {
      const r = this.cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; let hit = null;
      for (const c of this.callouts) if (Math.hypot(c.bx - mx, c.by - my) < 16) hit = c.p;
      this.hover = hit ? hit.n : null; const tip = $('#tip');
      if (hit) { tip.style.display = 'block'; tip.style.left = (mx + 18) + 'px'; tip.style.top = (my - 10) + 'px'; tip.innerHTML = `<b>${hit.n}. ${hit.name}</b><br>${hit.func}`; } else tip.style.display = 'none';
    };
    this.cv.onmouseleave = () => { this.hover = null; $('#tip').style.display = 'none'; };
  }
  sync() { $('#bStart').classList.toggle('on', this.running); $('#bPause').classList.toggle('on', !this.running); }
  layoutCallouts() {
    const g = this.g, parts = this.sim.parts, placed = parts.map(p => { const [ax, ay] = g.T(...p.anchor); return { p, ax, ay, side: p.side || (ax < (g.modelX[0] + g.modelX[1]) / 2 ? 'L' : 'R'), by: ay }; });
    for (const side of ['L', 'R']) {
      const col = placed.filter(q => q.side === side).sort((a, b) => a.ay - b.ay);
      col.forEach((q, i) => { if (i && q.by < col[i - 1].by + 30) q.by = col[i - 1].by + 30; });
      const hi = g.H - 18; if (col.length && col[col.length - 1].by > hi) { col[col.length - 1].by = hi; for (let i = col.length - 2; i >= 0; i--) if (col[i].by > col[i + 1].by - 30) col[i].by = col[i + 1].by - 30; }
    }
    this.callouts = placed.map(q => ({ p: q.p, ax: q.ax, ay: q.ay, bx: q.side === 'L' ? Math.max(24, g.modelX[0] - 30) : Math.min(g.W - 24, g.modelX[1] + 30), by: q.by }));
  }
  drawCallouts(active) {
    const c = this.g.ctx, now = performance.now() / 1000;
    for (const k of this.callouts) {
      const col = CATS[k.p.cat][0], act = active.has(k.p.n), hov = this.hover === k.p.n, dim = this.hover != null && !hov;
      c.globalAlpha = dim ? .25 : 1;
      c.beginPath(); c.moveTo(k.bx, k.by); c.lineTo(k.ax, k.ay); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 4; c.stroke();
      c.strokeStyle = col; c.lineWidth = act || hov ? 2.6 : 1.4; c.stroke();
      c.beginPath(); c.arc(k.ax, k.ay, act || hov ? 5.5 : 4, 0, 7); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 2; c.stroke();
      if (act || hov) { const pr = (now * 1.6 + k.p.n * .13) % 1; c.beginPath(); c.arc(k.ax, k.ay, 6 + pr * 16, 0, 7); c.strokeStyle = hov ? '#ff7a00' : '#ffb000'; c.globalAlpha = (1 - pr) * .9; c.lineWidth = 2.5; c.stroke(); c.globalAlpha = dim ? .25 : 1; }
      c.beginPath(); c.arc(k.bx, k.by, 13, 0, 7); c.fillStyle = col; c.fill(); c.lineWidth = 2.2; c.strokeStyle = act ? '#ffb000' : '#fff'; c.stroke();
      c.fillStyle = '#fff'; c.font = '800 13px Helvetica,Arial'; c.textAlign = 'center'; c.fillText(k.p.n, k.bx, k.by + 4.6); c.globalAlpha = 1;
    }
    c.textAlign = 'left';
    for (const t of (this.sim.tags ? this.sim.tags() : [])) {
      const [ax, ay] = this.g.T(...t.anchor), tx = ax + t.dx, ty = ay + t.dy, w = t.text.length * 7.4 + 22;
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(tx, ty); c.strokeStyle = t.col || '#1e9e55'; c.lineWidth = 1.6; c.stroke();
      c.beginPath(); c.arc(ax, ay, 3.4, 0, 7); c.fillStyle = t.col || '#1e9e55'; c.fill();
      c.beginPath(); c.roundRect(tx - w / 2, ty - 11, w, 22, 11); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = '#fff'; c.font = '800 11px Helvetica,Arial'; c.textAlign = 'center'; c.fillText(t.text, tx, ty + 4); c.textAlign = 'left';
    }
  }
  loop(t) {
    const dt = Math.min(.05, (t - this.last) / 1000); this.last = t;
    const s = this.sim;
    if (this.running) { const sub = Math.max(1, Math.ceil(this.speed * 2)); for (let i = 0; i < sub; i++) s.update(dt * this.speed / sub, true); } else s.update(0, false);
    s.running = this.running;
    this.g.begin(); s.draw(this.g); this.g.flush(s.floor); this.drawCallouts(s.activeParts());
    this.uiT += dt; if (this.uiT > .08) { this.uiT = 0; this.refresh(); }
    requestAnimationFrame(t2 => this.loop(t2));
  }
  refresh() {
    const s = this.sim; $('#hudTime').textContent = 't = ' + s.time.toFixed(1) + ' s'; $('#hudState').textContent = this.running ? (this.stepMode ? 'RUNNING · ONE OBJECT' : 'RUNNING') : 'PAUSED';
    const idx = STAGES.indexOf(s.stage); [...$('#pills').children].forEach((p, i) => { p.className = 'pill' + (i < idx ? ' done' : '') + (i === idx ? ' on' : ''); });
    $('#prog').style.width = (s.progress * 100).toFixed(0) + '%';
    $('#props').innerHTML = s.info().map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
    s.counts.forEach((n, i) => { $('#bc' + i).textContent = n; });
    $('#stats').innerHTML = `Sorted <b>${s.stats.sorted}</b> · Correct <b>${s.stats.correct}</b> · Accuracy <b>${s.stats.sorted ? Math.round(100 * s.stats.correct / s.stats.sorted) : '–'}%</b> · Rejected <b>${s.stats.rejected}</b>`;
    $('#qn').textContent = s.queue.length;
    $('#queue').innerHTML = s.queue.map(q => `<i class="${q.shape}" style="background:${s.kinds.find(k => k.id === q.kind).hex}"></i>`).join('') || '<em>empty – add objects</em>';
    $('#log').innerHTML = s.log.slice(-9).reverse().map(l => `<div>${l}</div>`).join('');
    if (this.cam && s.cameraView) s.cameraView(this.cam, 300, 170);
  }
}
