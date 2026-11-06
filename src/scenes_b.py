import math
from iso import Scene
from parts import *


# =====================================================================
# 03  TILTSORT ARENA - 2-axis tilting acrylic plate
# =====================================================================
def scene_tilt():
    s = Scene()
    s.box(0, 0, 0, 74, 74, 2, WOOD, layer=0)
    c = 34
    # electronics (front strip)
    p_psu = psu(s, 6, 63, 2, 12, 6.5, 5)
    p_pca = pca(s, 21, 63.5, 2)
    p_ard = arduino(s, 31, 63, 2, 7.6, 5.3, 'UNO')
    p_pi = rpi(s, 40, 62.8, 2)

    # bins on four sides
    s.bin_(49.5, 22, 2, 10, 24, 10, RED, balls=3)
    s.bin_(22, 49.5, 2, 24, 10, 10, GRN, balls=3)
    s.bin_(8.5, 22, 2, 10, 24, 10, BLU, balls=3)
    s.bin_(22, 8.5, 2, 24, 10, 10, YEL, balls=3)

    # pivot + servos + push-rods (visible through the acrylic plate)
    s.frust(c, c, 2, 12, 2.4, 1.9, '#cfd4d9')
    s.sphere(c, c, 14.9, 2.1, '#e8e8e8')
    s.box(40.5, 29.8, 2, 7, 3.0, .6, ALU)
    sx = servo(s, 41.5, 30.4, 2.6, 5, 2.6, 5.2)
    s.rod((44, 33.4, 5.2), (44, 33.6, 8.6), .5, '#fff')
    s.rod((44, 33.6, 8.6), (44, 34, 15.9), .3, '#9aa3ab')
    s.box(28.8, 39.5, 2, 3.0, 7, .6, ALU)
    sy = servo(s, 29.6, 40.6, 2.6, 2.6, 5, 5.2)
    s.rod((32.4, 43.4, 5.2), (32.8, 43.4, 8.6), .5, '#fff')
    s.rod((32.8, 43.4, 8.6), (34, 44, 15.9), .3, '#9aa3ab')
    # plate
    s.box(20, 20, 16, 28, 28, 1.2, '#7cc8ea', a=.4, edge='#2b7aa6')
    for (px, py, sx_, sy_) in [(20, 20, 1, 1), (45, 20, -1, 1), (20, 45, 1, -1), (45, 45, -1, -1)]:
        pass
    for px, py in [(20, 20), (44, 20), (20, 44), (44, 44)]:
        s.box(px, py, 17.2, 4, 1, 1.4, '#3f8fbf', layer=3)
        s.box(px if px == 20 else px + 3, py, 17.2, 1, 4, 1.4, '#3f8fbf', layer=3) if False else None
    s.box(20, 20, 17.2, 1, 4, 1.4, '#3f8fbf', layer=3)
    s.box(47, 20, 17.2, 1, 4, 1.4, '#3f8fbf', layer=3)
    s.box(20, 44, 17.2, 1, 4, 1.4, '#3f8fbf', layer=3)
    s.box(47, 44, 17.2, 1, 4, 1.4, '#3f8fbf', layer=3)

    # L-gantry with camera + feeder
    al_post(s, 1, 1, 2, 40)
    al_beam(s, 1, 1, 40, 34, 2, 2)
    al_beam(s, 33, 1, 40, 2, 35, 2)
    s.rod((2, 2, 26), (16, 2, 39), .6, '#9aa3ab', layer=3)
    camera(s, 31.5, 32.0, 36, 5, 4, 4, down=True)
    s.ring(34, 34, 32.6, 6.2, .5, '#ffffff', glow='#ffe066')
    # feeder funnel at (34,24)
    s.frust(34, 24, 20, 14, 2.0, 2.0, '#cfe8f2', a=.5)
    s.frust(34, 24, 34, 11, 2.2, 6.0, '#eef2f6', hole=1.2)
    ir_pair(s, 30.6, 22.4, 25.6, 24.0, beamz=24.9)
    s.sphere(34, 24, 50, 1.8, BLU, layer=3)
    s.sphere(34, 24, 18.9, 1.6, RED, layer=3)

    # flows
    s.arrow([(34, 24, 56), (34, 24, 20.8)], w=3.6)
    s.arrow([(35.5, 24, 18.7), (47, 24, 17.8), (53, 24, 13.0)], w=3.6)
    for pts in ([(33, 24, 18.7), (22, 24, 18.0), (14, 24, 13.0)],
                [(34, 25.5, 18.7), (34, 40, 18.0), (34, 53, 13.0)],
                [(34, 22.5, 18.7), (34, 14, 17.8), (34, 11, 13.0)]):
        s.arrow(pts, col='#9aa7b5', w=2.2, dash='6 5', op=.9)
    s.tag((34, 24, 56), 'OBJECT ENTRY', -80, 0)
    s.tag((53, 24, 13.0), 'RED → +X BIN', 70, 50, col='#c0392b')

    P = s.part
    P(1, 'bin', 'Feeder funnel (object entry)', 'Drops one object at a time onto the plate', (39.6, 24, 40))
    P(2, 'sense', 'IR break-beam', 'Sees an object leave the funnel', (36.3, 24.2, 25))
    P(3, 'sense', 'Overhead camera', 'Tracks position + colour of the object', (34, 36.1, 38))
    P(4, 'sense', 'LED ring light', 'Even lighting on the plate', (40.2, 34, 32.6))
    P(5, 'struct', 'Clear acrylic tilt plate', '28 cm plate with corner guards', (48, 40, 16.6))
    P(6, 'struct', 'Ball-joint pivot', 'Centre pivot lets plate tilt on 2 axes', (34, 36.1, 14.9))
    P(7, 'act', 'Servo X (pitch)', 'Tilts plate toward ±X bins', (46.5, 31, 5))
    P(8, 'act', 'Servo Y (roll)', 'Tilts plate toward ±Y bins', (32.6, 43.4, 3.5))
    P(9, 'act', 'Push-rods', 'Link servo horns to plate underside', (44, 33.8, 12))
    P(10, 'bin', 'Collection bins ×4', 'One bin on each side of the plate', (59.5, 34, 8))
    P(11, 'ctrl', 'PCA9685 servo driver', 'Clean PWM for both servos', p_pca)
    P(12, 'ctrl', 'Arduino Uno', 'Plate-angle control loop', p_ard)
    P(13, 'ctrl', 'Raspberry Pi 4', 'Vision + object tracking (OpenCV)', p_pi)
    P(14, 'ctrl', '5 V power supply', 'Servos + boards', p_psu)
    P(15, 'struct', 'Aluminium L-gantry', 'Holds camera + feeder above the plate', (2, 3, 26))
    return s


# =====================================================================
# 04  TRISENSE LINE - multi-sensor conveyor with servo pushers
# =====================================================================
def scene_line():
    s = Scene()
    # control tray
    s.box(-31, -3, 0, 25, 20, 3, '#2f343b', layer=0)
    p_psu = psu(s, -30, -2, 3, 11, 6, 5)
    p_drv = l298n(s, -16, -1.5, 3, 7, 5.6)
    p_ard = arduino(s, -30, 8, 3, 10.5, 5.3, 'MEGA')
    p_pi = rpi(s, -16, 8, 3)

    # frame
    for x in (2, 28, 56):
        s.box(x, -2, 0, 2, 2, 8.4, ALU)
        s.box(x, -2, 6.0, 2, 16, 1.6, ALU)
    for x in (2, 26):
        s.box(x, 12, 0, 2, 2, 8.4, ALU)
    s.box(0, -2, 8.4, 61, 2, 2.8, ALU)
    s.box(0, 12, 8.4, 28, 2, 2.8, ALU)
    # belt
    s.box(2.2, .5, 8.4, 61.6, 11, .3, '#2a2d32')
    s.box(2.2, .5, 12.4, 61.6, 11, .4, '#3c4045')
    for i in range(0, 14):
        s.box(5 + i * 4.2, .9, 12.8, .5, 10.2, .22, '#6a717a', layer=2)
    s.cyl('y', 2.2, -.2, 10.6, 12.4, 2.2, '#a1a8af')
    s.cyl('y', 63.8, -.2, 10.6, 12.4, 2.2, '#a1a8af')
    # drive: gearmotor
    s.cyl('y', 63.8, -6.8, 10.6, 6.6, .7, '#d0d4d8')
    s.box(60.8, -10.6, 8.2, 6, 3.8, 4.8, '#c9ced3')
    s.cyl('y', 63.8, -17.6, 10.6, 7.0, 2.5, GOLD)
    s.box(59.8, -13, 6.2, 8, 8, 1.2, ALU)
    s.box(60.4, -12.6, 0, 1.6, 1.6, 6.2, ALU)
    s.box(66.0, -12.6, 0, 1.6, 1.6, 6.2, ALU)
    s.wire([(-12, -3, 3.4), (-12, -10, .5), (62.5, -10, .5), (63.8, -14, .5), (63.8, -14, 8.2)], '#222', .3)

    # entry guides + flares
    s.box(0, 0, 12.8, 7, .8, 5, ACR, a=.4)
    s.box(0, 11.2, 12.8, 7, .8, 5, ACR, a=.4)
    s.quad3([(-8, -7, 12.8), (0, 0, 12.8), (0, 0, 18), (-8, -7, 18)], ACR, a=.4)
    s.quad3([(-8, 19, 12.8), (0, 12, 12.8), (0, 12, 18), (-8, 19, 18)], ACR, a=.4)
    ir_pair(s, 9, -1.8, 12.2, 11.2, beamz=13.9)
    # inspection tunnel
    for (px, py) in [(18, -2), (24, -2), (18, 12), (24, 12)]:
        s.box(px, py, 11.2, 2, 2, 16, '#25282d')
    s.box(18, -2, 27.2, 8, 16, 2, '#25282d')
    s.box(18.6, 1.0, 26.9, 6.8, .8, .3, '#fff8cc', layer=3)
    s.box(18.6, 10.2, 26.9, 6.8, .8, .3, '#fff8cc', layer=3)
    camera(s, 20.2, 4.4, 23.6, 3.6, 3.6, 3.2, down=True)
    s.box(20.4, 1.2, 26.0, 3.2, 2.2, .8, '#7d3c98', layer=3)
    # inductive metal sensor under belt
    s.box(30, 4, 5.8, 4.4, 4, .8, ALU)
    s.frust(32.2, 6, 6.6, 5.4, 1.6, 1.6, '#c9a227')
    # pushers + bins
    for i, bc in enumerate([RED, GRN, BLU]):
        x0 = 36 + 10 * i
        servo(s, x0 + .6, -2.2, 11.2, 4.6, 2.2, 4.4)
        s.box(x0 + 2.9, .05, 12.8, 7.0, .7, 3.6, '#f2f2f2', layer=2)
        s.quad3([(x0, 12, 12.4), (x0 + 10, 12, 12.4), (x0 + 10, 15.4, 9.8), (x0, 15.4, 9.8)], '#8a9097')
        s.bin_(x0, 14.5, 0, 10, 14, 10, bc, balls=2)
    s.bin_(66.8, 0, 0, 12, 12, 10, GRY, balls=2)

    # flow
    s.arrow([(-11, 6, 17.5), (0, 6, 15.8), (22, 6, 14.6), (50, 6, 14.6), (64, 6, 14.6), (72, 6, 10.0)], w=3.6)
    s.arrow([(51, 3, 17), (51, 20, 14.2)], w=3.8)
    for xx in (41, 61):
        s.arrow([(xx, 3, 16.6), (xx, 20, 13.8)], col='#9aa7b5', w=2.2, dash='6 5')
    s.tag((-11, 6, 17.5), 'OBJECT ENTRY', -18, -34)
    s.tag((72, 6, 10.0), 'REJECT / UNKNOWN', 40, 46, col='#c0392b')
    s.tag((51, 20, 14.2), 'GREEN → BIN 2', 70, 40, col='#1e9e55')

    P = s.part
    P(1, 'bin', 'Entry funnel guides', 'Centre objects onto the belt (object entry)', (-4, -3.5, 15.5))
    P(2, 'sense', 'IR break-beam', 'Detects an object, starts the scan', (9.65, -1.8, 12.6))
    P(3, 'sense', 'Camera', 'Colour + shape under controlled light', (22, 4.4, 27.2), 'R')
    P(4, 'sense', 'LED light bars', 'Shadow-free lighting in the tunnel', (25.4, 10.6, 27.2), 'R')
    P(5, 'sense', 'ToF height sensor (VL53L0X)', 'Measures object height → size class', (22, 1.4, 26.2))
    P(6, 'sense', 'Inductive sensor', 'Flags metal objects under the belt', (32.2, 6, 11.6))
    P(7, 'struct', 'Conveyor belt + rollers', 'Carries objects through every station', (12, 8, 12.9))
    P(8, 'act', 'DC gear motor', 'Drives the belt roller', (63.8, -14, 13.1))
    P(9, 'ctrl', 'L298N motor driver', 'PWM speed control of the belt', p_drv)
    P(10, 'ctrl', 'Arduino Mega', 'Sensor fusion, encoder-free timing', p_ard)
    P(11, 'ctrl', 'Raspberry Pi 4', 'OpenCV classification', p_pi)
    P(12, 'ctrl', '12 V power supply', 'Motor + logic power', p_psu)
    P(13, 'act', 'Servo pushers ×3', 'Swing paddles to shove object into bin', (38.9, -2.2, 15.6))
    P(14, 'bin', 'Collection bins ×3', 'Red / green / blue destinations', (41, 28.5, 6))
    P(15, 'bin', 'Reject bin', 'End-of-belt catch for unknown objects', (78.8, 6, 5))
    P(16, 'struct', 'Aluminium frame', '2020 profile legs + rails', (27, 14, 5))
    return s


# =====================================================================
# 05  CASCADE TOWER - Archimedes-screw lift + servo diverter tree
# =====================================================================
def scene_tower():
    s = Scene()
    s.box(-26, -6, 0, 100, 56, 2, WOOD, layer=0)
    # electronics (front strip)
    p_psu = psu(s, -24, 36, 2, 12, 6.5, 5)
    p_drv = l298n(s, -8, 36.5, 2, 6.4, 5.6)
    p_ard = arduino(s, 2, 36, 2, 10.5, 5.3, 'MEGA')
    p_pi = rpi(s, 16, 36, 2)
    p_pca = pca(s, 30, 36.5, 2)

    # frame
    for x in (-11, -1, 4, 62):
        al_post(s, x, 16.5, 2, 60)
    al_beam(s, -11, 16.5, 62, 75, 2, 2)
    for z in (20, 40):
        al_beam(s, -11, 16.5, z, 12, 2, 1.5)

    # auger lift
    ax, ay = -6, 22.5
    mot = s.frust(ax, ay, 2, 8, 2.8, 2.8, GOLD)
    s.frust(ax, ay, 10, 1, 1.2, 1.2, '#cfd4d9')
    s.frust(ax, ay, 11, 53, 3.4, 3.4, '#cfe8f2', a=.3)

    # helix inside tube (drawn as an item)
    def helix(T, k):
        pts = []
        n = 260
        for i in range(n + 1):
            t = i / n
            ang = t * 2 * math.pi * 7
            z = 12 + t * 50
            pts.append(T(ax + 2.6 * math.cos(ang), ay + 2.6 * math.sin(ang), z))
        d = ' '.join('%.1f,%.1f' % p for p in pts)
        return (f'<polyline points="{d}" fill="none" stroke="#7a3b0a" stroke-width="4.2" stroke-linejoin="round"/>'
                f'<polyline points="{d}" fill="none" stroke="#f08a24" stroke-width="2.6" stroke-linejoin="round"/>')
    s._add((ax - 3, ax + 3, ay - 3, ay + 3, 12, 62), helix, 1)
    s.frust(ax, ay, 11, 53, .7, .7, '#8a949e', layer=1)

    # entry ramp + IR
    s.prism([(-26, 22), (-9, 14.8), (-9, 14), (-26, 21.2)], 20.5, 24.5, '#7fb7d6')
    s.prism([(-26, 22), (-9, 14.8), (-9, 17.2), (-26, 24.4)], 19.9, 20.5, ACR, a=.45)
    s.prism([(-26, 22), (-9, 14.8), (-9, 17.2), (-26, 24.4)], 24.5, 25.1, ACR, a=.45)
    s.box(-25, 20.5, 2, 1.6, 1.6, 19, ALU)
    s.box(-25, 23.5, 2, 1.6, 1.6, 19, ALU)
    s.box(-11.5, 20.5, 2, 1.6, 1.6, 12.4, ALU)
    s.box(-11.5, 23.5, 2, 1.6, 1.6, 12.4, ALU)
    ir_pair(s, -13.3, 18.2, 25.6, 16.5, beamz=17.4)
    s.sphere(-21, 22.5, 22.0 + 1.5, 1.4, RED, layer=3)

    # transfer ramp + chamber
    s.prism([(-3, 61.6), (28, 51.4), (28, 50.4), (-3, 60.6)], 20.4, 24.6, '#7fb7d6')
    s.prism([(-3, 61.6), (28, 51.4), (28, 54.4), (-3, 64.6)], 19.9, 20.4, ACR, a=.45)
    s.prism([(-3, 61.6), (28, 51.4), (28, 54.4), (-3, 64.6)], 24.6, 25.1, ACR, a=.45)
    s.box(28, 19.5, 50, 12, 6, 8, ACR, a=.2)
    s.box(28.4, 20, 50, 14, 5, .5, YEL, layer=3)
    s.sphere(34, 22.5, 52.0, 1.5, GRN, layer=3)
    camera(s, 31.5, 25.8, 53, 5, 3.2, 3.6, down=False)
    s.box(40.0, 21.0, 53.8, 1.2, 3.8, 2.6, '#7d3c98')
    s.sphere(40.7, 21.8, 53.4, .35, '#fff', layer=3)
    s.sphere(40.7, 24.2, 53.4, .35, '#fff', layer=3)
    servo(s, 42.4, 20.6, 48.6, 2.6, 4.4, 4.6)
    s.box(31.5, 20.2, 44, 5, 4.6, 6, ACR, a=.25)

    # channel panels + planks
    s.box(6, 19, 14, 56, 1, 34, '#e3e9f0', a=.9, layer=1)
    for prof in ([(33, 43.4), (21, 36.6), (21, 35.6), (33, 42.4)],
                 [(35, 43.4), (47, 36.6), (47, 35.6), (35, 42.4)],
                 [(19, 32.4), (14, 27.4), (14, 26.4), (19, 31.4)],
                 [(21, 32.4), (26, 27.4), (26, 26.4), (21, 31.4)],
                 [(47, 32.4), (42, 27.4), (42, 26.4), (47, 31.4)],
                 [(49, 32.4), (54, 27.4), (54, 26.4), (49, 31.4)]):
        s.prism(prof, 20.2, 24.8, '#3b4a63')
    for bx in (14, 26, 42, 54):
        s.box(bx - 2.5, 20, 14.2, 5, 4.8, 12.2, ACR, a=.25)
    # flaps
    s.rod((31.4, 22.5, 42.7), (36.6, 22.5, 45.3), .5, '#ff7a00', layer=3)
    s.rod((17.4, 22.5, 31.7), (22.6, 22.5, 34.3), .5, '#ff7a00', layer=3)
    s.rod((45.4, 22.5, 34.3), (50.6, 22.5, 31.7), .5, '#ff7a00', layer=3)
    # flap servos on the front panel
    servo(s, 31.4, 26, 41.2, 5.2, 2.6, 5.4)
    servo(s, 17.4, 26, 30.3, 5.2, 2.6, 5.4)
    servo(s, 45.4, 26, 30.3, 5.2, 2.6, 5.4)
    s.box(6, 25, 14, 56, 1, 34, ACR, a=.16, layer=2)

    # bins
    for bx, col in ((14, RED), (26, GRN), (42, BLU), (54, YEL)):
        s.bin_(bx - 5, 15, 2, 10, 15, 12, col, balls=2)

    # flow
    s.arrow([(-24, 22.5, 25.5), (-11, 22.5, 18.4), (-6, 22.5, 14)], w=3.6)
    s.arrow([(-6, 29, 13), (-6, 29, 60)], w=3.6)
    s.arrow([(-4, 22.5, 64.2), (27, 22.5, 55), (34, 22.5, 53.5)], w=3.6)
    s.arrow([(34, 22.5, 49), (34, 22.5, 45.6), (22, 22.5, 38.4), (20, 22.5, 34.8), (14.5, 22.5, 29), (14, 22.5, 17)], w=3.6)
    s.tag((-24, 22.5, 25.5), 'OBJECT ENTRY', -50, -26)
    s.tag((14, 22.5, 17), 'SORTED OUT', -60, 40, col='#c0392b')

    P = s.part
    P(1, 'bin', 'Entry ramp (object entry)', 'Operator drops object here; gravity feeds the auger', (-18, 24.9, 19.2))
    P(2, 'sense', 'IR break-beam', 'Detects object → starts lift motor', (-12.6, 18.5, 17.4))
    P(3, 'act', 'DC gear motor', 'Spins the Archimedes screw', (-6, 25.3, 6))
    P(4, 'struct', 'Archimedes-screw lift', 'Helix carries objects up the tube', (-6, 25.9, 38))
    P(5, 'struct', 'Transfer chute', 'Slides object into the inspection chamber', (12, 25.1, 57.8))
    P(6, 'struct', 'Inspection chamber + gate', 'Object waits on the gate while scanned', (40, 22, 57))
    P(7, 'sense', 'Camera', 'OpenCV colour / shape classification', (34, 29, 55.5))
    P(8, 'sense', 'RGB colour sensor', 'Fast colour cross-check', (41.2, 22.5, 56))
    P(9, 'act', 'Gate servo', 'Releases the object after the decision', (45, 23, 52.8))
    P(10, 'act', 'Diverter servos ×3', 'Set flap A, B1, B2 per class', (34, 28.6, 44))
    P(11, 'struct', 'Diverter flaps + guide planks', 'Binary tree: 2 levels → 4 outputs', (44, 24.8, 38.3))
    P(12, 'struct', 'Acrylic channel panels', 'Keep objects in the Plinko channel', (62, 26, 44))
    P(13, 'bin', 'Collection bins ×4', 'One per class, at the base', (54, 30, 8))
    P(14, 'ctrl', 'L298N motor driver', 'Speed control of the lift motor', p_drv)
    P(15, 'ctrl', 'Arduino Mega', 'Flap/gate timing, motor control', p_ard)
    P(16, 'ctrl', 'Raspberry Pi 4', 'Vision + decision', p_pi)
    P(17, 'ctrl', 'PCA9685 servo driver', 'Drives 4 servos', p_pca)
    P(18, 'ctrl', '12 V power supply', 'Motor + logic rail', p_psu)
    P(19, 'struct', 'Aluminium frame', 'Tall rigid tower, 2020 profile', (63, 18.5, 40))
    return s


DEFS = [
    ('03', 'tiltsort', 'TILTSORT ARENA', 'Servo-tilted clear acrylic plate rolls each object off the correct edge into a bin',
     scene_tilt, [('Build', 'LOW-MEDIUM'), ('Wow', '★★★★★'), ('Cost', '~$70')],
     ['IR gate under the funnel sees the object drop; it lands on the plate near the centre.',
      'Overhead camera + OpenCV give colour, shape and live (x, y) position on the plate.',
      'Class → target edge; a PD loop on the 2 servos computes tilt angles from position.',
      'Plate tilts, object slides off the chosen edge into its bin, plate levels for the next one.']),
    ('04', 'trisense', 'TRISENSE LINE', 'Conveyor that scans colour, height and metal, then pushes each object into its bin',
     scene_line, [('Build', 'MEDIUM'), ('Wow', '★★★☆☆'), ('Cost', '~$130')],
     ['IR break-beam at the entrance sees the object and starts the scan timer.',
      'Tunnel: camera (colour/shape) + ToF (height) + inductive (metal) are fused into one class.',
      'Class → pusher number; belt speed gives travel time to that pusher, no encoder needed.',
      'Servo paddle swings across the belt at the right moment; unknown objects ride to the reject bin.']),
    ('05', 'cascade', 'CASCADE TOWER', 'Archimedes-screw lift raises objects to a scan chamber, then a servo flap tree drops them into 4 bins',
     scene_tower, [('Build', 'HIGH'), ('Wow', '★★★★★'), ('Cost', '~$150')],
     ['IR gate at the ramp starts the lift motor; screw carries the object up to the chamber.',
      'Object rests on the gate while camera + RGB sensor classify it in a closed, lit chamber.',
      'Class → 2-bit code: flap A picks left/right half, flap B1/B2 picks the final bin.',
      'Gate opens, object falls through the flaps by gravity into its bin. No pushers, no arm.']),
]
