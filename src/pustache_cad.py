"""Pustache Sorter - parametric 3D model (millimetres, Z up).
Outputs per-part binary STL, one merged assembly STL, and parts.json for the web viewer.
Pure numpy; no CAD kernel needed.  Run:  python3 src/pustache_cad.py
"""
import json
import math
import os
import struct
import numpy as np

OUT = os.path.join(os.path.dirname(__file__), '..', '3d')
CX = CY = 220.0                       # tube / chute axis
BANG = [36, 72, 144, 108]              # cup angles around the chute axis (deg)
RC = 180.0                             # cup arc radius


# ---------------------------------------------------------------- mesh helpers
def _fix(V, F):
    V = np.asarray(V, float)
    F = np.asarray(F, int)
    vol = np.einsum('ij,ij->i', V[F[:, 0]], np.cross(V[F[:, 1]], V[F[:, 2]])).sum() / 6
    if vol < 0:
        F = F[:, [0, 2, 1]]
    return V, F


def box(x, y, z, dx, dy, dz):
    V = [[x, y, z], [x + dx, y, z], [x + dx, y + dy, z], [x, y + dy, z],
         [x, y, z + dz], [x + dx, y, z + dz], [x + dx, y + dy, z + dz], [x, y + dy, z + dz]]
    F = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4],
         [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]]
    return _fix(V, F)


def lathe(profile, center=(0, 0, 0), axis='z', n=48):
    """Revolve a closed (r, c) polygon around the axis. axis in x|y|z."""
    P = np.asarray(profile, float)
    k = len(P)
    V = []
    for i in range(n):
        t = 2 * math.pi * i / n
        ct, st = math.cos(t), math.sin(t)
        for r, c in P:
            a, b = r * ct, r * st
            if axis == 'z':
                V.append([a, b, c])
            elif axis == 'y':
                V.append([a, c, b])
            else:
                V.append([c, a, b])
    V = np.asarray(V) + np.asarray(center, float)
    F = []
    for i in range(n):
        j = (i + 1) % n
        for m in range(k):
            m2 = (m + 1) % k
            a, b, c, d = i * k + m, j * k + m, j * k + m2, i * k + m2
            F += [[a, b, c], [a, c, d]]
    # degenerate triangles (profile points on the axis) are harmless for STL viewers
    return _fix(V, F)


def cyl(cx, cy, z0, h, r, axis='z', n=40):
    if axis == 'z':
        return lathe([(0, 0), (r, 0), (r, h), (0, h)], (cx, cy, z0), 'z', n)
    return lathe([(0, 0), (r, 0), (r, h), (0, h)], (cx, cy, z0), axis, n)


def prism(profile, w0, w1, mapper):
    """Convex 2-D profile (u, v) extruded across w in [w0, w1]; mapper(u, v, w) -> xyz."""
    n = len(profile)
    V = [mapper(u, v, w0) for u, v in profile] + [mapper(u, v, w1) for u, v in profile]
    F = []
    for i in range(1, n - 1):
        F += [[0, i, i + 1], [n, n + i + 1, n + i]]
    for i in range(n):
        j = (i + 1) % n
        F += [[i, j, n + j], [i, n + j, n + i]]
    return _fix(V, F)


def merge(meshes):
    Vs, Fs, off = [], [], 0
    for V, F in meshes:
        Vs.append(V)
        Fs.append(F + off)
        off += len(V)
    return np.vstack(Vs), np.vstack(Fs)


def write_stl(path, mesh, name='part'):
    V, F = mesh
    tri = V[F]
    nrm = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    ln = np.linalg.norm(nrm, axis=1)
    keep = ln > 1e-9
    nrm = nrm[keep] / ln[keep][:, None]
    tri = tri[keep]
    with open(path, 'wb') as f:
        f.write(name.encode()[:80].ljust(80, b' '))
        f.write(struct.pack('<I', len(tri)))
        for nv, t in zip(nrm, tri):
            f.write(struct.pack('<12fH', *nv, *t.reshape(-1), 0))


# ---------------------------------------------------------------- the design
PARTS = []   # dicts: id, name, group, color, alpha, make, qty, note, meshes


def part(pid, name, group, color, make, meshes, alpha=1.0, qty=1, note=''):
    if isinstance(meshes, tuple):
        meshes = [meshes]
    PARTS.append(dict(id=pid, name=name, group=group, color=color, alpha=alpha, make=make, qty=qty, note=note, mesh=merge(meshes)))


def servo(x, y, z, dx=44, dy=24, dz=42):
    return [box(x, y, z, dx, dy, dz), box(x - 10, y, z + 0.62 * dz, dx + 20, dy, 3.5)]


def cup_center(i):
    a = math.radians(BANG[i])
    return CX + RC * math.cos(a), CY + RC * math.sin(a)


def build():
    # structure
    part('base', 'Base plate', 'Frame', '#c9a26b', '6 mm plywood / laser cut', box(-20, 120, 0, 480, 360, 20), note='480 x 360 x 20 mm')
    part('board', 'Red backboard (reused)', 'Frame', '#c0392b', 'Laser cut / 3D print panels', box(0, 140, 20, 440, 20, 520), note='440 x 520 x 20 mm')
    part('shelf_top', 'Top shelf (reused)', 'Frame', '#f4f6f8', '6 mm acrylic / plywood', box(0, 140, 460, 440, 140, 12))
    part('shelf_mid', 'Middle shelf (reused)', 'Frame', '#f4f6f8', '6 mm acrylic / plywood', box(120, 140, 180, 200, 140, 12), note='carries chute servo S2')
    part('braces', 'Shelf braces', 'Frame', '#b9c1c9', '2020 aluminium profile / 16 mm square rod',
         [box(10, 260, 20, 16, 16, 440), box(414, 260, 20, 16, 16, 440), box(26, 264, 452, 388, 8, 8)], qty=3)
    # feed + escapement
    part('tube', 'Feed tube (reused)', 'Object entry', '#e08a2a', '3D print / PVC pipe',
         lathe([(17, 390), (20, 390), (20, 585), (17, 585)], (CX, CY, 0), 'z'), alpha=0.45, note='bore 34 mm = 30 mm object + 4 mm; length 195 mm holds ~6 objects')
    part('esc_servo', 'Escapement servo', 'Object entry', '#2a6fdb', 'MG90S micro servo', servo(288, 208, 384))
    pins = [lathe([(0, 0), (3.5, 0), (3.5, 76), (0, 76)], (208, CY, 394.5), 'x', 24),
            lathe([(0, 0), (3.5, 0), (3.5, 12), (0, 12)], (272, CY, 442.5), 'x', 24),
            lathe([(0, 0), (3, 0), (3, 66), (0, 66)], (284, CY, 388), 'z', 24)]
    part('esc_pins', 'Escapement pins + rack', 'Object entry', '#ff7a00', '3D print / 3.5 mm rod', pins, note='pin 1 holds object #1, pin 2 pinches #2 while #1 is released')
    # inspection chamber
    w = []
    w += [box(185, 185, 340, 3, 70, 50), box(252, 185, 340, 3, 70, 50), box(185, 185, 340, 70, 3, 50)]
    w += [box(185, 252, 340, 70, 3, 10), box(185, 252, 380, 70, 3, 10), box(185, 252, 350, 17, 3, 30), box(238, 252, 350, 17, 3, 30)]   # front wall with camera window
    part('chamber', 'Inspection chamber (matte white)', 'Detection', '#ffffff', 'White PLA / acrylic, matte inside', w, alpha=0.35, note='window 36 x 30 mm for the camera')
    part('leds', 'LED strips (2)', 'Detection', '#fff7b0', '5 V white LED strip', [box(186, 195, 348, 4, 50, 36), box(250, 195, 348, 4, 50, 36)], qty=2)
    part('ir_chamber', 'IR break-beam pair', 'Detection', '#202226', 'IR LED + phototransistor', [box(213.5, 172, 352, 13, 13, 17), box(213.5, 266, 352, 13, 13, 17)], qty=2, note='beam across chamber at z = 360 mm')
    part('camera', 'Pi camera', 'Detection', '#1c1f24', 'Pi Camera v2 / USB webcam',
         [box(200, 334, 344, 46, 32, 34), lathe([(0, 0), (9, 0), (9, -14), (0, -14)], (223, 334, 361), 'y', 28)])
    part('cam_arm', 'Camera arm', 'Detection', '#b9c1c9', '3D print / aluminium bar', box(246, 160, 358, 16, 196, 14), note='fixes camera distance ~ 12 cm from the object')
    # gate + chute
    part('g1_servo', 'Gate G1 servo', 'Sorting', '#2a6fdb', 'MG90S micro servo', servo(132, 208, 330))
    part('g1_flap', 'Gate G1 flap', 'Sorting', '#ff7a00', '3D print', box(189, 203, 340, 60, 34, 4))
    part('s2_servo', 'Chute servo S2', 'Sorting', '#2a6fdb', 'MG90S micro servo (metal gear)', box(197, 208, 192, 46, 24, 42), note='shaft up; horn carries the chute')
    part('s2_hub', 'Chute hub / horn', 'Sorting', '#c8cdd2', '3D print', lathe([(0, 0), (14, 0), (14, 16), (0, 16)], (CX, CY, 234), 'z'))

    def zf(r):
        return 260 - (110.0 / 190.0) * r

    def mp(u, v, wv):          # chute at HOME angle 90 deg (points along +Y)
        return (CX - wv, CY + u, v)
    floor = prism([(-18, zf(-18) - 4), (198, zf(198) - 4), (198, zf(198)), (-18, zf(-18))], -19, 19, mp)
    wall = [prism([(-18, zf(-18)), (198, zf(198)), (198, zf(198) + 20), (-18, zf(-18) + 20)], s * 19 - (3 if s < 0 else 0) + (0 if s < 0 else 0), s * 19 + (0 if s < 0 else 3), mp) for s in (-1, 1)]
    part('chute', 'Swing chute (reused ramp)', 'Sorting', '#3b4a63', '3D print, smooth finish', [floor] + wall, note='width 38 mm, slope ~30 deg, drawn at HOME (90 deg); sweeps 36-144 deg')
    # cups
    cols = ['#e74c3c', '#2ecc71', '#3498db', '#8a949e']
    nm = ['RED', 'GREEN', 'BLUE', 'REJECT']
    prof = [(0, 20), (42, 20), (46, 106), (56, 120), (53, 120), (43.2, 106), (39, 23), (0, 23)]
    for i in range(4):
        cx, cy = cup_center(i)
        part(f'cup_{nm[i].lower()}', f'{nm[i]} cup', 'Collection', cols[i], '3D print / plastic cup + funnel lip', lathe(prof, (cx, cy, 0), 'z', 56), alpha=0.5, note=f'chute angle {BANG[i]} deg')
        a = math.radians(BANG[i])
        px, py = -math.sin(a), math.cos(a)
        part(f'ir_{nm[i].lower()}', f'IR drop-confirm ({nm[i]})', 'Collection', '#202226', 'IR break-beam pair',
             [box(cx + 64 * px - 5, cy + 64 * py - 5, 120, 10, 10, 14), box(cx - 64 * px - 5, cy - 64 * py - 5, 120, 10, 10, 14)], qty=2)
    # electronics
    part('pi', 'Raspberry Pi 4', 'Electronics', '#2d9b57', 'Raspberry Pi 4 (2 GB)', [box(20, 160, 472, 86, 56, 7), box(86, 164, 479, 20, 14, 16), box(86, 184, 479, 20, 14, 16)])
    part('arduino', 'Arduino Uno', 'Electronics', '#0a8f9f', 'Arduino Uno', box(280, 155, 472, 74, 50, 8))
    part('breadboard', 'Breadboard / terminal block', 'Electronics', '#e9ecef', 'Half-size breadboard', box(290, 220, 472, 80, 45, 8))
    part('psu', '5 V supplies', 'Electronics', '#aab3bc', '5 V 3 A adapter + buck converter', box(368, 155, 472, 62, 50, 34))


def main():
    os.makedirs(os.path.join(OUT, 'downloads', 'parts'), exist_ok=True)
    build()
    allm, out = [], []
    for i, p in enumerate(PARTS, 1):
        V, F = p['mesh']
        write_stl(os.path.join(OUT, 'downloads', 'parts', f'{i:02d}_{p["id"]}.stl'), p['mesh'], p['name'])
        allm.append(p['mesh'])
        out.append(dict(id=p['id'], name=p['name'], group=p['group'], color=p['color'], alpha=p['alpha'], make=p['make'], qty=p['qty'], note=p['note'],
                        v=[round(float(x), 2) for x in V.reshape(-1)], f=[int(x) for x in F.reshape(-1)]))
    write_stl(os.path.join(OUT, 'downloads', 'Pustache_Sorter_assembly.stl'), merge(allm), 'Pustache Sorter assembly')
    with open(os.path.join(OUT, 'parts.json'), 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    with open(os.path.join(OUT, 'downloads', 'Pustache_Sorter_BOM.csv'), 'w') as f:
        f.write('No,Part,Group,Qty,Make / buy,Note\n')
        for i, p in enumerate(PARTS, 1):
            f.write(f'{i},"{p["name"]}",{p["group"]},{p["qty"]},"{p["make"]}","{p["note"]}"\n')
    V = np.vstack([p['mesh'][0] for p in PARTS])
    print(len(PARTS), 'parts; bbox mm', V.min(0).round(0), V.max(0).round(0))


if __name__ == '__main__':
    main()
