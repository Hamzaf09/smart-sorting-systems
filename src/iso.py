"""Tiny isometric SVG engine: boxes, cylinders, rods, prisms, callouts, legend."""
import math
from html import escape as esc

C = math.cos(math.radians(30))
S = 0.5
K3 = math.sqrt(1.5)  # sphere / circle radius factor for this projection


def _cl(v):
    return max(0, min(255, int(round(v))))


def hex2rgb(h):
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb2hex(r, g, b):
    return '#%02x%02x%02x' % (_cl(r), _cl(g), _cl(b))


def shade(h, f):
    r, g, b = hex2rgb(h)
    if f <= 1:
        return rgb2hex(r * f, g * f, b * f)
    t = f - 1
    return rgb2hex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t)


def hull(pts):
    pts = sorted(set((round(x, 2), round(y, 2)) for x, y in pts))
    if len(pts) <= 2:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo = []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    up = []
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def P(pts, fill, stroke=None, sw=0.7, op=1, extra=''):
    d = ' '.join('%.1f,%.1f' % p for p in pts)
    st = f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"' if stroke else ''
    o = f' fill-opacity="{op}" ' if op < 1 else ''
    if stroke and op < 1:
        st += f' stroke-opacity="{min(1, op + 0.35):.2f}"'
    return f'<polygon points="{d}" fill="{fill}"{o}{st}{extra}/>'


CAT = {
    'sense': ('#8e44ad', 'Sensors'),
    'ctrl': ('#0e8f9f', 'Controllers'),
    'act': ('#e67e22', 'Motors / servos'),
    'struct': ('#34495e', 'Frame / transport'),
    'bin': ('#27ae60', 'Entry / bins'),
}


class Scene:
    def __init__(s):
        s.items = []
        s.overlays = []   # (kind, data)
        s.parts = []      # numbered callouts
        s.tags = []
        s.defs = {}
        s.n = 0

    # ------------------------------------------------------------------ core
    def _g(s, kind, col):
        k = (kind, col)
        if k not in s.defs:
            s.defs[k] = 'g%d' % len(s.defs)
        return s.defs[k]

    def _add(s, bb, draw, layer=1):
        s.items.append(dict(bb=bb, draw=draw, layer=layer, n=len(s.items)))

    def uid(s):
        s.n += 1
        return 'u%d' % s.n

    # ------------------------------------------------------------- primitives
    def box(s, x, y, z, dx, dy, dz, col, a=1, layer=None, edge=None, top=None):
        layer = layer if layer is not None else (2 if a < 1 else 1)
        x1, y1, z1 = x + dx, y + dy, z + dz
        ec = edge or shade(col, 0.4)
        tc = top or shade(col, 1.15)

        def draw(T, k):
            return (P([T(x, y, z1), T(x1, y, z1), T(x1, y1, z1), T(x, y1, z1)], tc, ec, .7, a) +
                    P([T(x1, y, z), T(x1, y1, z), T(x1, y1, z1), T(x1, y, z1)], shade(col, .70), ec, .7, a) +
                    P([T(x, y1, z), T(x1, y1, z), T(x1, y1, z1), T(x, y1, z1)], shade(col, .86), ec, .7, a))
        s._add((x, x1, y, y1, z, z1), draw, layer)
        return (x + dx / 2, y + dy / 2, z + dz)

    def bin_(s, x, y, z, dx, dy, dz, col, wall=0.9, balls=2, layer=None):
        """Open-top collection bin with visible interior."""
        x1, y1, z1 = x + dx, y + dy, z + dz
        ec = shade(col, 0.4)
        cid = s.uid()

        def draw(T, k):
            o = P([T(x, y, z1), T(x1, y, z1), T(x1, y1, z1), T(x, y1, z1)], shade(col, 1.15), ec, .7)
            o += P([T(x1, y, z), T(x1, y1, z), T(x1, y1, z1), T(x1, y, z1)], shade(col, .70), ec, .7)
            o += P([T(x, y1, z), T(x1, y1, z), T(x1, y1, z1), T(x, y1, z1)], shade(col, .86), ec, .7)
            a0, b0, a1, b1 = x + wall, y + wall, x1 - wall, y1 - wall
            op = [T(a0, b0, z1), T(a1, b0, z1), T(a1, b1, z1), T(a0, b1, z1)]
            d = ' '.join('%.1f,%.1f' % p for p in op)
            o += f'<clipPath id="{cid}"><polygon points="{d}"/></clipPath>'
            o += P(op, shade(col, .32), ec, .6)
            o += f'<g clip-path="url(#{cid})">'
            zf = z + wall
            o += P([T(a0, b0, zf), T(a1, b0, zf), T(a1, b1, zf), T(a0, b1, zf)], shade(col, .42))
            o += P([T(a0, b0, z1), T(a0, b1, z1), T(a0, b1, zf), T(a0, b0, zf)], shade(col, .58))
            o += P([T(a0, b0, z1), T(a1, b0, z1), T(a1, b0, zf), T(a0, b0, zf)], shade(col, .72))
            o += '</g>'
            return o
        s._add((x, x1, y, y1, z, z1), draw, layer if layer is not None else 1)
        # a few sorted items poking above the floor
        if balls:
            cx, cy = x + dx / 2, y + dy / 2
            r = min(dx, dy) * 0.17
            offs = [(-0.18, -0.12), (0.2, 0.05), (-0.02, 0.22)][:balls]
            for ox, oy in offs:
                s.sphere(cx + ox * dx, cy + oy * dy, z1 - r * 0.9, r, col, layer=3)
        return (x + dx / 2, y + dy / 2, z1)

    def frust(s, cx, cy, z, h, r0, r1, col, a=1, layer=None, hole=0, edge=None):
        layer = layer if layer is not None else (2 if a < 1 else 1)
        ec = edge or shade(col, .4)
        R = max(r0, r1)

        def draw(T, k):
            pts = []
            for i in range(40):
                t = 2 * math.pi * i / 40
                pts.append(T(cx + r0 * math.cos(t), cy + r0 * math.sin(t), z))
                pts.append(T(cx + r1 * math.cos(t), cy + r1 * math.sin(t), z + h))
            gid = s._g('lin', col)
            o = P(hull(pts), f'url(#{gid})', ec, .7, a)
            top = [T(cx + r1 * math.cos(2 * math.pi * i / 40), cy + r1 * math.sin(2 * math.pi * i / 40), z + h) for i in range(40)]
            o += P(top, shade(col, 1.2), ec, .7, a)
            if hole:
                ri = r1 - hole
                inner = [T(cx + ri * math.cos(2 * math.pi * i / 40), cy + ri * math.sin(2 * math.pi * i / 40), z + h) for i in range(40)]
                o += P(inner, shade(col, .3), ec, .6)
            return o
        s._add((cx - R, cx + R, cy - R, cy + R, z, z + h), draw, layer)
        return (cx, cy, z + h)

    def cyl(s, axis, x, y, z, L, r, col, a=1, layer=None):
        """Cylinder along 'x' or 'y' starting at (x,y,z) (centre of start cap)."""
        layer = layer if layer is not None else (2 if a < 1 else 1)
        ec = shade(col, .4)

        def ends():
            if axis == 'x':
                return (x, y, z), (x + L, y, z)
            return (x, y, z), (x, y + L, z)

        def circ(c, n=32):
            pts = []
            for i in range(n):
                t = 2 * math.pi * i / n
                if axis == 'x':
                    pts.append((c[0], c[1] + r * math.cos(t), c[2] + r * math.sin(t)))
                else:
                    pts.append((c[0] + r * math.cos(t), c[1], c[2] + r * math.sin(t)))
            return pts

        def draw(T, k):
            e0, e1 = ends()
            p0 = [T(*p) for p in circ(e0)]
            p1 = [T(*p) for p in circ(e1)]
            gid = s._g('lin', col)
            o = P(hull(p0 + p1), f'url(#{gid})', ec, .7, a)
            o += P(p1, shade(col, 1.18), ec, .7, a)
            return o
        e0, e1 = ends()
        if axis == 'x':
            bb = (x, x + L, y - r, y + r, z - r, z + r)
        else:
            bb = (x - r, x + r, y, y + L, z - r, z + r)
        s._add(bb, draw, layer)
        return (e1[0], e1[1], e1[2])

    def sphere(s, cx, cy, cz, r, col, layer=None):
        def draw(T, k):
            px, py = T(cx, cy, cz)
            gid = s._g('rad', col)
            return (f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{K3 * r * k:.1f}" fill="url(#{gid})" '
                    f'stroke="{shade(col, .45)}" stroke-width=".6"/>')
        s._add((cx - r, cx + r, cy - r, cy + r, cz - r, cz + r), draw, layer if layer is not None else 1)

    def rod(s, A, B, r, col, a=1, layer=None):
        layer = layer if layer is not None else (2 if a < 1 else 1)

        def draw(T, k):
            pa, pb = T(*A), T(*B)
            w = max(1.2, 2 * K3 * r * k)
            o = (f'<line x1="{pa[0]:.1f}" y1="{pa[1]:.1f}" x2="{pb[0]:.1f}" y2="{pb[1]:.1f}" stroke="{shade(col, .4)}" '
                 f'stroke-width="{w + 1.6:.1f}" stroke-linecap="round" stroke-opacity="{a}"/>')
            o += (f'<line x1="{pa[0]:.1f}" y1="{pa[1]:.1f}" x2="{pb[0]:.1f}" y2="{pb[1]:.1f}" stroke="{col}" '
                  f'stroke-width="{w:.1f}" stroke-linecap="round" stroke-opacity="{a}"/>')
            if w > 4:
                off = w * .18
                o += (f'<line x1="{pa[0] - off:.1f}" y1="{pa[1] - off:.1f}" x2="{pb[0] - off:.1f}" y2="{pb[1] - off:.1f}" '
                      f'stroke="{shade(col, 1.4)}" stroke-width="{w * .28:.1f}" stroke-linecap="round" stroke-opacity="{a * .8:.2f}"/>')
            return o
        bb = (min(A[0], B[0]) - r, max(A[0], B[0]) + r, min(A[1], B[1]) - r, max(A[1], B[1]) + r,
              min(A[2], B[2]) - r, max(A[2], B[2]) + r)
        s._add(bb, draw, layer)

    def wire(s, pts, col='#222', r=0.28):
        for a, b in zip(pts, pts[1:]):
            s.rod(a, b, r, col, layer=3)

    def prism(s, prof, ya, yb, col, a=1, layer=None):
        """Profile in the X-Z plane extruded along Y."""
        layer = layer if layer is not None else (2 if a < 1 else 1)
        ec = shade(col, .4)
        n = len(prof)
        area = sum(prof[i][0] * prof[(i + 1) % n][1] - prof[(i + 1) % n][0] * prof[i][1] for i in range(n))
        sign = 1 if area > 0 else -1

        def draw(T, k):
            o = ''
            for i in range(n):
                p, q = prof[i], prof[(i + 1) % n]
                dx, dz = q[0] - p[0], q[1] - p[1]
                nx, nz = sign * dz, -sign * dx
                ln = math.hypot(nx, nz) or 1
                if (nx + nz) / ln <= 0.02:
                    continue
                f = 0.62 + 0.5 * max(0, nz / ln)
                o += P([T(p[0], ya, p[1]), T(q[0], ya, q[1]), T(q[0], yb, q[1]), T(p[0], yb, p[1])], shade(col, f), ec, .6, a)
            o += P([T(p[0], yb, p[1]) for p in prof], shade(col, .9), ec, .7, a)
            return o
        xs = [p[0] for p in prof]
        zs = [p[1] for p in prof]
        s._add((min(xs), max(xs), ya, yb, min(zs), max(zs)), draw, layer)

    def quad3(s, pts, col, a=1, layer=None, edge=None):
        layer = layer if layer is not None else (2 if a < 1 else 1)

        def draw(T, k):
            return P([T(*p) for p in pts], col, edge or shade(col, .5), .7, a)
        xs, ys, zs = zip(*pts)
        s._add((min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)), draw, layer)

    def ring(s, cx, cy, z, r, w, col, glow=None):
        def draw(T, k):
            pts = [T(cx + r * math.cos(2 * math.pi * i / 48), cy + r * math.sin(2 * math.pi * i / 48), z) for i in range(48)]
            d = ' '.join('%.1f,%.1f' % p for p in pts)
            o = ''
            if glow:
                o += f'<polygon points="{d}" fill="none" stroke="{glow}" stroke-width="{w * k * 2.6:.1f}" stroke-opacity=".28"/>'
            o += f'<polygon points="{d}" fill="none" stroke="{col}" stroke-width="{max(1.6, w * k):.1f}"/>'
            return o
        s._add((cx - r, cx + r, cy - r, cy + r, z, z + .1), draw, 3)

    def toptext(s, x, y, z, txt, size, col='#ffffff', weight='700'):
        def draw(T, k):
            e, f = T(x, y, z)
            return (f'<text transform="matrix({C * k:.3f} {S * k:.3f} {-C * k:.3f} {S * k:.3f} {e:.1f} {f:.1f})" '
                    f'font-family="Helvetica,Arial,sans-serif" font-size="{size}" font-weight="{weight}" fill="{col}">{txt}</text>')
        s._add((x, x + .1, y, y + .1, z, z + .2), draw, 4)

    def facetext(s, face, x, y, z, txt, size, col='#ffffff', weight='700'):
        """face 'y+': text along +x on the y+ face (origin = top-left). 'x+': text along -y on x+ face (origin = right end)."""
        def draw(T, k):
            e, f = T(x, y, z)
            if face == 'y+':
                m = f'{C * k:.3f} {S * k:.3f} 0 {k:.3f}'
            else:
                m = f'{C * k:.3f} {-S * k:.3f} 0 {k:.3f}'
            return (f'<text transform="matrix({m} {e:.1f} {f:.1f})" font-family="Helvetica,Arial,sans-serif" '
                    f'font-size="{size}" font-weight="{weight}" fill="{col}">{txt}</text>')
        s._add((x, x + .1, y, y + .1, z - size, z), draw, 4)

    # --------------------------------------------------------------- overlays
    def arrow(s, pts, col='#ff7a00', w=3.4, dash=None, head=True, halo=True, op=1):
        s.overlays.append(('arrow', dict(pts=pts, col=col, w=w, dash=dash, head=head, halo=halo, op=op)))

    def beam(s, A, B, col='#e53935'):
        s.overlays.append(('arrow', dict(pts=[A, B], col=col, w=1.8, dash='5 4', head=False, halo=False, op=1)))

    def tag(s, anchor, text, dx, dy, col='#1e9e55'):
        s.tags.append(dict(anchor=anchor, text=text, dx=dx, dy=dy, col=col))

    def part(s, num, cat, name, func, anchor, side=None):
        s.parts.append(dict(num=num, cat=cat, name=name, func=func, anchor=anchor, side=side))

    # ----------------------------------------------------------------- render
    def _order(s):
        items = sorted(s.items, key=lambda it: (it['layer'], it['n']))
        out = []
        layers = sorted(set(it['layer'] for it in items))
        e = 1e-6
        for L in layers:
            grp = [it for it in items if it['layer'] == L]
            n = len(grp)

            def behind(i, j):
                a, b = grp[i]['bb'], grp[j]['bb']
                return a[1] <= b[0] + e or a[3] <= b[2] + e or a[5] <= b[4] + e

            def key(i):
                b = grp[i]['bb']
                return ((b[0] + b[1]) / 2 + (b[2] + b[3]) / 2 + 0.4 * (b[4] + b[5]) / 2, grp[i]['n'])
            pred = [set() for _ in range(n)]
            for i in range(n):
                for j in range(i + 1, n):
                    bi, bj = behind(i, j), behind(j, i)
                    if bi and not bj:
                        pred[j].add(i)
                    elif bj and not bi:
                        pred[i].add(j)
            done = set()
            while len(done) < n:
                avail = [i for i in range(n) if i not in done and pred[i] <= done]
                if not avail:
                    avail = [i for i in range(n) if i not in done]
                i = min(avail, key=key)
                done.add(i)
                out.append(grp[i])
        return out

    def render(s, num, name, tagline, chips, pipeline, innov='', W=1760, H=1040):
        order = s._order()
        # ---- bounds in unit-iso space
        def pr(x, y, z):
            return ((x - y) * C, (x + y) * S - z)
        xs, ys, zs = [], [], []
        px, py = [], []
        for it in order:
            b = it['bb']
            xs += [b[0], b[1]]
            ys += [b[2], b[3]]
            zs += [b[4], b[5]]
            for X in (b[0], b[1]):
                for Y in (b[2], b[3]):
                    for Z in (b[4], b[5]):
                        q = pr(X, Y, Z)
                        px.append(q[0]); py.append(q[1])
        for kind, d in s.overlays:
            for p in d['pts']:
                q = pr(*p); px.append(q[0]); py.append(q[1])
        for t in s.tags:
            q = pr(*t['anchor']); px.append(q[0]); py.append(q[1])
        gx0, gx1, gy0, gy1 = min(xs) - 6, max(xs) + 6, min(ys) - 6, max(ys) + 6
        for X in (gx0, gx1):
            for Y in (gy0, gy1):
                q = pr(X, Y, 0); px.append(q[0]); py.append(q[1])
        minx, maxx, miny, maxy = min(px), max(px), min(py), max(py)
        LEG_X = 1190
        reg_x0, reg_x1, reg_y0, reg_y1 = 14, LEG_X - 14, 106, 892
        colw = 66
        avail_w = (reg_x1 - reg_x0) - 2 * colw
        avail_h = (reg_y1 - reg_y0) - 30
        k = min(avail_w / (maxx - minx), avail_h / (maxy - miny))
        ox = (reg_x0 + reg_x1) / 2 - k * (minx + maxx) / 2
        oy = (reg_y0 + reg_y1) / 2 - k * (miny + maxy) / 2

        def T(x, y, z):
            return (ox + k * (x - y) * C, oy + k * ((x + y) * S - z))

        out = []
        out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Helvetica,Arial,sans-serif">')
        # defs (gradients) filled later
        body = []
        # ---- floor grid
        body.append(P([T(gx0, gy0, 0), T(gx1, gy0, 0), T(gx1, gy1, 0), T(gx0, gy1, 0)], '#e9eef5', '#c3cedc', 1))
        gx = math.ceil(gx0 / 10) * 10
        while gx <= gx1:
            a, b = T(gx, gy0, 0), T(gx, gy1, 0)
            body.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#cdd6e3" stroke-width=".7"/>')
            gx += 10
        gy = math.ceil(gy0 / 10) * 10
        while gy <= gy1:
            a, b = T(gx0, gy, 0), T(gx1, gy, 0)
            body.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#cdd6e3" stroke-width=".7"/>')
            gy += 10
        # ---- items
        for it in order:
            body.append(it['draw'](T, k))
        # ---- overlays (flow arrows, beams)
        for kind, d in s.overlays:
            pts = [T(*p) for p in d['pts']]
            dd = ' '.join('%.1f,%.1f' % p for p in pts)
            dash = f' stroke-dasharray="{d["dash"]}"' if d['dash'] else ''
            if d['halo']:
                body.append(f'<polyline points="{dd}" fill="none" stroke="#fff" stroke-width="{d["w"] + 3.4}" stroke-linejoin="round" stroke-linecap="round" stroke-opacity=".85"{dash}/>')
            body.append(f'<polyline points="{dd}" fill="none" stroke="{d["col"]}" stroke-width="{d["w"]}" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="{d["op"]}"{dash}/>')
            if d['head'] and len(pts) >= 2:
                (x0, y0), (x1, y1) = pts[-2], pts[-1]
                ang = math.atan2(y1 - y0, x1 - x0)
                L = 6.5 + d['w'] * 2.2
                wd = 3.2 + d['w'] * 1.3
                tip = (x1 + math.cos(ang) * 2, y1 + math.sin(ang) * 2)
                bx, by = tip[0] - math.cos(ang) * L, tip[1] - math.sin(ang) * L
                p1 = (bx + math.cos(ang + math.pi / 2) * wd, by + math.sin(ang + math.pi / 2) * wd)
                p2 = (bx + math.cos(ang - math.pi / 2) * wd, by + math.sin(ang - math.pi / 2) * wd)
                body.append(P([tip, p1, p2], d['col'], '#fff', 1.4, d['op']))
        # ---- numbered callouts
        mx0, mx1 = ox + k * minx, ox + k * maxx
        cxm = (mx0 + mx1) / 2
        left_x, right_x = mx0 - 36, mx1 + 36
        left_x = max(left_x, reg_x0 + 22)
        right_x = min(right_x, reg_x1 - 22)
        placed = []
        for p in s.parts:
            ax, ay = T(*p['anchor'])
            side = p['side'] or ('L' if ax < cxm else 'R')
            placed.append([p, ax, ay, side, ay])
        for side in ('L', 'R'):
            col = sorted([q for q in placed if q[3] == side], key=lambda q: q[2])
            minsp = 34
            lo, hi = reg_y0 + 8, reg_y1 - 8
            for q in col:
                q[4] = q[2]
            for i, q in enumerate(col):
                q[4] = max(q[4], lo + i * 0)
                if i and q[4] < col[i - 1][4] + minsp:
                    q[4] = col[i - 1][4] + minsp
            if col and col[-1][4] > hi:
                col[-1][4] = hi
                for i in range(len(col) - 2, -1, -1):
                    if col[i][4] > col[i + 1][4] - minsp:
                        col[i][4] = col[i + 1][4] - minsp
        lines, dots, badges = [], [], []
        for p, ax, ay, side, by in placed:
            bx = left_x if side == 'L' else right_x
            c = CAT[p['cat']][0]
            lines.append(f'<line x1="{bx:.1f}" y1="{by:.1f}" x2="{ax:.1f}" y2="{ay:.1f}" stroke="#fff" stroke-width="4" stroke-opacity=".9"/>')
            lines.append(f'<line x1="{bx:.1f}" y1="{by:.1f}" x2="{ax:.1f}" y2="{ay:.1f}" stroke="{c}" stroke-width="1.5"/>')
            dots.append(f'<circle cx="{ax:.1f}" cy="{ay:.1f}" r="4" fill="#fff" stroke="{c}" stroke-width="2"/>')
            badges.append(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="14" fill="{c}" stroke="#fff" stroke-width="2.2"/>'
                          f'<text x="{bx:.1f}" y="{by + 5:.1f}" text-anchor="middle" font-size="14" font-weight="800" fill="#fff">{p["num"]}</text>')
        body += lines + dots + badges
        # ---- tags
        for t in s.tags:
            ax, ay = T(*t['anchor'])
            tx, ty = ax + t['dx'], ay + t['dy']
            w = 8 * len(t['text']) * 0.82 + 22
            body.append(f'<line x1="{ax:.1f}" y1="{ay:.1f}" x2="{tx:.1f}" y2="{ty:.1f}" stroke="{t["col"]}" stroke-width="1.6"/>')
            body.append(f'<circle cx="{ax:.1f}" cy="{ay:.1f}" r="3.4" fill="{t["col"]}" stroke="#fff" stroke-width="1.2"/>')
            body.append(f'<rect x="{tx - w / 2:.1f}" y="{ty - 11:.1f}" width="{w:.1f}" height="22" rx="11" fill="{t["col"]}" stroke="#fff" stroke-width="1.5"/>')
            body.append(f'<text x="{tx:.1f}" y="{ty + 4.3:.1f}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#fff" letter-spacing=".4">{esc(t["text"])}</text>')

        # ---- gradients
        defs = ['<defs>']
        for (kind, col), gid in s.defs.items():
            if kind == 'lin':
                defs.append(f'<linearGradient id="{gid}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="{shade(col, 1.25)}"/>'
                            f'<stop offset=".45" stop-color="{col}"/><stop offset="1" stop-color="{shade(col, .55)}"/></linearGradient>')
            else:
                defs.append(f'<radialGradient id="{gid}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="{shade(col, 1.55)}"/>'
                            f'<stop offset=".5" stop-color="{col}"/><stop offset="1" stop-color="{shade(col, .5)}"/></radialGradient>')
        defs.append('<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f9fc"/><stop offset="1" stop-color="#e6ecf4"/></linearGradient>')
        defs.append('</defs>')
        out += defs
        out.append(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')
        # ---- header
        out.append(f'<rect x="0" y="0" width="{W}" height="96" fill="#0f1b2d"/>')
        out.append(f'<rect x="0" y="92" width="{W}" height="4" fill="#ff7a00"/>')
        out.append(f'<circle cx="62" cy="48" r="32" fill="#ff7a00"/><text x="62" y="62" text-anchor="middle" font-size="40" font-weight="900" fill="#fff">{num}</text>')
        out.append(f'<text x="112" y="44" font-size="34" font-weight="900" fill="#fff" letter-spacing=".5">{esc(name)}</text>')
        out.append(f'<text x="112" y="74" font-size="17" fill="#b9c7dd">{esc(tagline)}</text>')
        cx = W - 28
        for lab, val in reversed(chips):
            w = 14 + 8.2 * (len(lab) + len(val)) * 0.9 + 16
            cx -= w
            out.append(f'<rect x="{cx:.0f}" y="26" width="{w:.0f}" height="44" rx="8" fill="#1d2e49" stroke="#34507c"/>')
            out.append(f'<text x="{cx + w / 2:.0f}" y="43" text-anchor="middle" font-size="11" fill="#8fa6c9" letter-spacing="1">{esc(lab.upper())}</text>')
            out.append(f'<text x="{cx + w / 2:.0f}" y="61" text-anchor="middle" font-size="15" font-weight="800" fill="#fff">{esc(val)}</text>')
            cx -= 10
        out.append('<g id="scene">' + ''.join(body) + '</g>')
        out.append(f'<text x="30" y="{reg_y1 + 14}" font-size="12" fill="#6b7c93">ISOMETRIC ENGINEERING VIEW · units ≈ cm · grid = 10 cm · orange arrows = object flow · red dashed = sensor beam · translucent = acrylic</text>')

        # ---- legend panel
        lx = LEG_X
        lw = W - lx - 24
        out.append(f'<rect x="{lx}" y="112" width="{lw}" height="{reg_y1 - 112 + 10}" rx="14" fill="#fff" stroke="#c9d4e4" stroke-width="1.5"/>')
        out.append(f'<text x="{lx + 20}" y="142" font-size="15" font-weight="900" fill="#0f1b2d" letter-spacing="1.5">COMPONENT LEGEND</text>')
        out.append(f'<text x="{lx + lw - 20}" y="142" text-anchor="end" font-size="11" fill="#7a8aa3">No. → Component → Main function</text>')
        out.append(f'<line x1="{lx + 20}" y1="152" x2="{lx + lw - 20}" y2="152" stroke="#e1e8f2"/>')
        n = len(s.parts)
        avail = reg_y1 - 160 - 36 - (112 if innov else 0)
        rowh = min(40, avail / n)
        y = 160 + rowh / 2
        for p in sorted(s.parts, key=lambda q: q['num']):
            c = CAT[p['cat']][0]
            out.append(f'<circle cx="{lx + 38}" cy="{y:.1f}" r="12.5" fill="{c}"/><text x="{lx + 38}" y="{y + 4.8:.1f}" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">{p["num"]}</text>')
            out.append(f'<text x="{lx + 60}" y="{y - 2:.1f}" font-size="13.2" font-weight="800" fill="#0f1b2d">{esc(p["name"])}</text>')
            out.append(f'<text x="{lx + 60}" y="{y + 12:.1f}" font-size="11.4" fill="#4b5d78">→ {esc(p["func"])}</text>')
            y += rowh
        if innov:
            iy = reg_y1 - 24 - 104
            out.append(f'<rect x="{lx + 16}" y="{iy}" width="{lw - 32}" height="100" rx="10" fill="#fff4e6" stroke="#ffb866"/>')
            out.append(f'<text x="{lx + 30}" y="{iy + 24}" font-size="12" font-weight="900" fill="#c25a00" letter-spacing="1.4">KEY INNOVATION</text>')
            words, cur, ls = innov.split(), '', []
            for w_ in words:
                if len(cur) + len(w_) + 1 > 78:
                    ls.append(cur); cur = w_
                else:
                    cur = (cur + ' ' + w_).strip()
            ls.append(cur)
            for j, ln in enumerate(ls[:5]):
                out.append(f'<text x="{lx + 30}" y="{iy + 44 + j * 16}" font-size="12" fill="#5b3b12">{esc(ln)}</text>')
        # category key
        ky = reg_y1 - 14
        kx = lx + 20
        for cat in ('sense', 'ctrl', 'act', 'struct', 'bin'):
            c, lab = CAT[cat]
            out.append(f'<circle cx="{kx + 5}" cy="{ky}" r="5" fill="{c}"/><text x="{kx + 14}" y="{ky + 4}" font-size="10.2" fill="#4b5d78">{esc(lab)}</text>')
            kx += 14 + 5.6 * len(lab) + 16

        # ---- pipeline strip
        py0 = reg_y1 + 30
        out.append(f'<rect x="20" y="{py0}" width="{W - 40}" height="{H - py0 - 18}" rx="14" fill="#0f1b2d"/>')
        bw = (W - 40 - 5 * 14) / 4
        names = ['1 · DETECT', '2 · CLASSIFY', '3 · DECIDE', '4 · SORT']
        for i, (head, txt) in enumerate(zip(names, pipeline)):
            bx = 20 + 14 + i * (bw + 14)
            out.append(f'<text x="{bx + 6:.0f}" y="{py0 + 28}" font-size="14" font-weight="900" fill="#ff9d3c" letter-spacing="1.5">{head}</text>')
            words = txt.split()
            lines_, cur = [], ''
            for w_ in words:
                if len(cur) + len(w_) + 1 > int(bw / 6.55):
                    lines_.append(cur); cur = w_
                else:
                    cur = (cur + ' ' + w_).strip()
            lines_.append(cur)
            for j, ln in enumerate(lines_[:4]):
                out.append(f'<text x="{bx + 6:.0f}" y="{py0 + 48 + j * 16}" font-size="12.2" fill="#dbe5f5">{esc(ln)}</text>')
            if i < 3:
                out.append(f'<text x="{bx + bw + 7:.0f}" y="{py0 + 28}" text-anchor="middle" font-size="22" font-weight="900" fill="#ff7a00">›</text>')
        out.append('</svg>')
        return '\n'.join(out)
