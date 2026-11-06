import math
from iso import Scene
from parts import *


# =====================================================================
# 01  ORBIT PICKER  - 3-DOF radial pick-and-place arm
# =====================================================================
def scene_orbit():
    s = Scene()
    s.box(-6, 0, 0, 54, 54, 2, WOOD, layer=0)
    # electronics row (back edge)
    p_psu = psu(s, -3, 1.5, 2)
    p_pca = pca(s, 10, 2.2, 2)
    p_ard = arduino(s, 20, 1.5, 2, 9.5, 5.4, 'MEGA')
    p_pi = rpi(s, 33, 1.5, 2)

    # chute (object entry)
    def zc(x):
        return 15 - 12 * (x + 22) / 22
    s.prism([(-22, 15), (0, 3), (0, 2.2), (-22, 14.2)], 28.2, 33.2, '#7fb7d6')
    s.prism([(-22, 15), (0, 3), (0, 5.2), (-22, 17.2)], 27.4, 28.2, ACR, a=.5)
    s.prism([(-22, 15), (0, 3), (0, 5.2), (-22, 17.2)], 33.2, 34.0, ACR, a=.5)
    s.box(-20.5, 27.6, 0, 1.5, 1.5, 14.2, ALU)
    s.box(-20.5, 33.6, 0, 1.5, 1.5, 14.2, ALU)
    s.box(-8.6, 27.6, 0, 1.5, 1.5, zc(-8.6) - .8, ALU)
    s.box(-8.6, 33.6, 0, 1.5, 1.5, zc(-8.6) - .8, ALU)
    s.box(-15.3, 29.5, zc(-14) + .1, 2.4, 2.4, 2.4, RED, layer=3)
    s.sphere(-8.0, 30.7, zc(-8) + 1.9, 1.4, BLU, layer=3)

    # pick pad + IR gate + LED ring
    s.box(0, 27.2, 2, 7, 7, 1, '#3a3f47')
    ir_pair(s, 2.9, 25.7, 34.5, 3.0, beamz=3.9)
    s.sphere(3.5, 30.7, 4.4, 1.4, GRN, layer=3)

    # overhead mast + camera
    al_post(s, 9, 20, 2, 34)
    al_post(s, 9, 42, 2, 34)
    al_beam(s, 9, 20, 34, 2, 24, 2)
    al_beam(s, 2, 29.7, 34, 9, 2, 2)
    camera(s, 1.5, 29.2, 30.2, 4, 3, 3.8)
    s.ring(3.5, 30.7, 26.6, 5.2, .55, '#ffffff', glow='#ffe066')

    # arm
    s.box(17, 25, 2, 10, 10, .8, ALU)
    s.box(19, 27, 2.8, 6, 6, 6.2, SERVO)
    s.frust(22, 30, 9, 1.2, 3.6, 3.6, '#c8cdd2')
    s.box(12, 29.2, 11.3, 10, 2, 2, ALU)
    servo(s, 19.3, 28.5, 10.2, 5.5, 3, 4.2)
    servo(s, 9.5, 28.5, 10.2, 5.5, 3, 4.2)
    s.box(3, 29.2, 11.3, 9, 2, 2, ALU)
    servo(s, 1.5, 29.6, 8.1, 4, 2.2, 3.2, col='#3b82f6')
    s.box(2.9, 28.4, 4.7, 1.1, 0.8, 3.4, '#555')
    s.box(2.9, 32.2, 4.7, 1.1, 0.8, 3.4, '#555')
    s.wire([(14, 4, 2.6), (14, 22, 2.6), (20, 24.5, 2.6), (20.5, 27, 3)], '#e0b000')

    # bins in an arc
    cents = [(31, 14.4, RED), (38.9, 23.8, GRN), (38.9, 36.2, BLU), (31, 45.6, YEL)]
    for cx, cy, col in cents:
        s.bin_(cx - 4.5, cy - 4.5, 2, 9, 9, 8, col)

    # flow
    s.arrow([(-20, 30.7, 17.0), (-6, 30.7, 9.6), (1.0, 30.7, 6.4)], w=3.6)
    s.arrow([(3.5, 30.7, 15.5), (12, 36, 19), (28, 41, 18), (38.9, 36.2, 12.8)], w=3.6)
    s.tag((-20, 30.7, 17.0), 'OBJECT ENTRY', -30, -30)
    s.tag((38.9, 36.2, 12.8), 'SORTED HERE', 60, 20, col='#c0392b')

    P = s.part
    P(1, 'sense', 'USB / Pi camera', 'Captures pad image; OpenCV finds colour + shape', (3.5, 29.2, 32))
    P(2, 'sense', 'IR break-beam pair', 'Detects an object arriving on the pad', (3.5, 26.2, 4.3))
    P(3, 'sense', 'LED ring light', 'Constant lighting → stable colour reading', (8.5, 30.7, 26.6))
    P(4, 'bin', 'Feed chute (object entry)', 'Gravity-feeds objects onto the pick pad', (-16, 30.7, 12.5))
    P(5, 'struct', 'Pick pad', 'Fixed, repeatable pick position', (7, 32, 3.0))
    P(6, 'ctrl', 'Raspberry Pi 4', 'Runs OpenCV classification, sends class by USB', p_pi)
    P(7, 'ctrl', 'Arduino Mega', 'Inverse kinematics + servo timing', p_ard)
    P(8, 'ctrl', 'PCA9685 servo driver', 'Drives 4 servos from external 5 V', p_pca)
    P(9, 'act', 'Base servo (yaw)', 'Rotates the whole arm toward the target bin', (25, 30, 6))
    P(10, 'act', 'Shoulder + elbow servos', 'Set arm reach and height', (12.2, 28.5, 12.2))
    P(11, 'act', 'Gripper servo + fingers', 'Grabs and releases the object', (3.5, 28.4, 6.5))
    P(12, 'bin', 'Collection bins ×4', 'Red / green / blue / yellow destinations', (43.4, 23.8, 6))
    P(13, 'ctrl', '5 V 10 A power supply', 'Powers servos and boards', p_psu)
    P(14, 'struct', 'Aluminium camera mast', '2020 profile, holds camera over the pad', (9, 44, 30))
    P(15, 'struct', 'Plywood base', '54×54 cm rigid baseplate', (48, 18, 1))
    return s


# =====================================================================
# 02  REVOLVER VAULT - rotating chute over a ring of cups
# =====================================================================
def scene_revolver():
    s = Scene()
    cx = cy = 30
    s.box(-3, -4, 0, 66, 76, 2, WOOD, layer=0)
    s.frust(cx, cy, 2, .6, 29.5, 29.5, '#3b4048', layer=1)
    # electronics (back strip)
    p_psu = psu(s, 0, 61, 2, 12, 7, 5)
    p_drv = l298n(s, 15, 61.5, 2, 5.2, 4.6)
    p_ard = arduino(s, 24, 61, 2, 8, 5.3, 'UNO')
    p_pi = rpi(s, 36, 60.8, 2)

    # cups
    cols = [RED, GRN, BLU, YEL, GRY]
    cups = []
    for i, col in enumerate(cols):
        a = math.radians(72 * i)
        x, y = cx + 20 * math.cos(a), cy + 20 * math.sin(a)
        s.frust(x, y, 2.6, 10, 7.0, 7.5, col, hole=1.1)
        cups.append((x, y))
        s.sphere(x - 1.5, y, 11.5, 1.8, col, layer=3)
        s.sphere(x + 1.8, y + 1.2, 11.2, 1.8, col, layer=3)
    s.ring(cups[0][0], cups[0][1], 12.7, 8.8, .5, '#16c60c', glow='#7dff6a')

    # frame
    for px, py in [(21, 21), (37, 21), (21, 37), (37, 37)]:
        al_post(s, px, py, 2.6, 39.0)
    s.box(19, 19, 41.6, 22, 22, 1.4, ALU)
    s.box(23, 23, 24.2, 14, 14, .8, ALU)

    # rotating ring + belt + stepper
    s.frust(cx, cy, 17, 1.5, 6.6, 6.6, '#d6dbe0', hole=4.0)
    s.frust(cx, cy, 18.5, 3.5, 4.6, 2.2, ACR, a=.55)
    s.rod((30, 30, 19.6), (47, 30, 13.4), 2.0, '#6cc3e6', a=.75, layer=3)
    s.box(12.7, 27.7, 13.2, 4.6, 4.6, 4.8, '#2b2f36')
    s.box(12.4, 27.4, 17.9, 5.2, 5.2, .5, ALU)
    s.frust(15, 30, 18.4, 1.4, 1.2, 1.2, '#e5e7ea')
    s.box(11, 26, 12.4, 8.6, 8.6, .8, ALU)
    s.box(11.3, 26.3, 2.6, 1, 1, 9.8, ALU)
    s.box(17.6, 33.3, 2.6, 1, 1, 9.8, ALU)
    d = 15.0
    r1, r2 = 1.2, 6.6
    cb = (r1 - r2) / d
    sb = math.sqrt(1 - cb * cb)
    for sg in (1, -1):
        nx, ny = cb, sg * sb
        A = (15 + r1 * nx, 30 + r1 * ny, 18.9)
        B = (30 + r2 * nx, 30 + r2 * ny, 17.9)
        s.rod(A, B, .35, '#111', layer=3)

    # inspection chamber
    s.frust(cx, cy, 36, 5.6, 1.8, 1.8, '#cfe8f2', a=.5)
    s.box(25, 25, 25, 10, 10, 11, ACR, a=.2)
    s.box(25.4, 25.4, 25, 11.4, 9.2, .5, YEL, layer=3)  # trapdoor with tab
    s.sphere(30, 30, 27.0, 1.6, RED, layer=3)
    camera(s, 27.5, 35.2, 28.5, 5, 3.4, 3.8, down=False)
    s.box(35.2, 27.8, 29.0, 1.2, 4.4, 2.8, '#7d3c98')
    s.sphere(35.8, 28.6, 28.6, .38, '#fff', layer=3)
    s.sphere(35.8, 31.4, 28.6, .38, '#fff', layer=3)
    servo(s, 36.2, 31.0, 21.5, 2.4, 5, 4.4)
    ir_pair(s, 26.4, 28.6, 31.4, 38.0, beamz=38.9)

    # hopper (object entry)
    s.frust(cx, cy, 43, 7.5, 7.0, 2.2, '#e8edf2', hole=1.2)
    s.sphere(30, 30, 56.0, 1.8, BLU, layer=3)

    # flow
    s.arrow([(30, 30, 63), (30, 30, 30.6)], w=3.6)
    s.arrow([(30, 30, 24.2), (30, 30, 21.4), (40, 30, 17.6), (49.5, 30, 12.6)], w=3.6)
    # rotation arrow
    pts = [(cx + 12.5 * math.cos(math.radians(a)), cy + 12.5 * math.sin(math.radians(a)), 16.2) for a in range(200, 345, 8)]
    s.arrow(pts, col='#1e78ff', w=3.0)
    s.tag((30, 30, 63), 'OBJECT ENTRY', -70, -4)
    s.tag((50, 30, 12.6), 'TARGET CUP', 72, 22, col='#c0392b')
    s.tag(pts[len(pts) // 2], 'STEPPER ROTATES CHUTE', 150, 70, col='#1e78ff')

    P = s.part
    P(1, 'bin', 'Hopper funnel (object entry)', 'Objects dropped in here, one at a time', (36.5, 30, 46))
    P(2, 'sense', 'IR break-beam gate', 'Detects arrival → triggers inspection', (33.3, 29.8, 38.8))
    P(3, 'struct', 'Acrylic inspection chamber', 'Light-controlled box, object sits on trapdoor', (35, 26, 34))
    P(4, 'sense', 'Camera', 'OpenCV colour + shape classification', (30, 38.6, 30))
    P(5, 'sense', 'RGB colour sensor + LEDs', 'Second opinion on colour (fast)', (36.4, 30, 30))
    P(6, 'act', 'Trapdoor servo', 'Releases object after the decision', (38.6, 33.7, 24))
    P(7, 'act', 'NEMA 17 stepper', 'Indexes the chute to any cup angle', (15, 32.3, 15.5))
    P(8, 'struct', 'GT2 belt + rotary ring', 'Transmits stepper motion to the chute', (21.5, 27.8, 18.2))
    P(9, 'struct', 'Rotating chute', 'Slides object into the selected cup', (41.5, 30, 16.2))
    P(10, 'bin', 'Collection cups ×5', '4 colour cups + 1 reject cup', (13.8, 49.2, 7))
    P(11, 'ctrl', 'Arduino Uno', 'Stepper steps, servo, state machine', p_ard)
    P(12, 'ctrl', 'Raspberry Pi 4', 'Vision + decision logic, USB-serial to Uno', p_pi)
    P(13, 'ctrl', 'L298N / stepper driver', 'Current-limited coil drive', p_drv)
    P(14, 'ctrl', '12 V power supply', 'Motor + logic rail', p_psu)
    P(15, 'struct', 'Aluminium frame ×4', 'Rigid central tower', (39, 39, 22))
    return s
