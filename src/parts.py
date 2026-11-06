"""Reusable electronics / hardware builders shared by all five scenes."""
from iso import Scene, shade

WOOD = '#c9a26b'
ALU = '#b9c1c9'
BLK = '#2b2f36'
ACR = '#8fd3ee'
RED, GRN, BLU, YEL, GRY = '#e74c3c', '#2ecc71', '#3498db', '#f1c40f', '#8a949e'
SERVO = '#2a6fdb'
GOLD = '#d9a41a'


def arduino(s, x, y, z, w=9.0, d=5.4, txt='MEGA'):
    s.box(x, y, z, w, d, .8, '#0a8f9f')
    s.box(x - .9, y + .7, z + .1, 2.8, 2.6, 1.7, '#c9ced3')
    s.box(x + w - 3.4, y + d * .28, z + .8, 2.2, 2.2, .5, '#111')
    s.box(x + 1.6, y + .25, z + .8, w - 3.2, .5, .8, '#222')
    s.box(x + 1.6, y + d - .75, z + .8, w - 3.2, .5, .8, '#222')
    s.toptext(x + 2.4, y + d * .66, z + .85, txt, 1.2)
    return (x + w / 2, y + d / 2, z + .8)


def rpi(s, x, y, z, w=8.6, d=5.6):
    s.box(x, y, z, w, d, .7, '#2d9b57')
    s.box(x + w - 2.3, y + .5, z + .7, 3.0, 2.0, 1.6, '#c9ced3')
    s.box(x + w - 2.3, y + 3.0, z + .7, 3.0, 2.0, 1.6, '#c9ced3')
    s.box(x + 2.2, y + 1.6, z + .7, 2.4, 2.4, .5, '#111')
    s.box(x + .3, y + d - .7, z + .7, w - 3, .4, .7, '#222')
    s.toptext(x + .7, y + 1.2, z + .75, 'Pi 4', 1.1)
    return (x + w / 2, y + d / 2, z + .7)


def psu(s, x, y, z, w=11.0, d=6.0, h=4.8):
    s.box(x, y, z, w, d, h, '#aab3bc')
    for i in range(6):
        s.box(x + 1.0 + i * (w - 2) / 6, y + .6, z + h, .5, d - 1.2, .12, '#6f7a85')
    s.box(x + w - 0.3, y + 1, z + 1.2, .6, d - 2, 2.2, '#27a35a')
    s.facetext('y+', x + .8, y + d, z + h - .9, '12V 10A', 1.5, '#2b2f36')
    return (x + w / 2, y + d / 2, z + h)


def l298n(s, x, y, z, w=6.4, d=5.6):
    s.box(x, y, z, w, d, .6, '#c0392b')
    s.box(x + 1.3, y + 1.0, z + .6, 3.0, 3.2, 3.0, '#222')
    s.box(x + .15, y + .3, z + .6, 1.1, d - .6, 1.0, '#2e6fd8')
    s.box(x + w - 1.25, y + .3, z + .6, 1.1, d - .6, 1.0, '#2e6fd8')
    s.facetext('y+', x + .6, y + d, z + .6, 'L298N', 1.0, '#fff')
    return (x + w / 2, y + d / 2, z + 1.5)


def pca(s, x, y, z, w=8.0, d=3.4):
    s.box(x, y, z, w, d, .5, '#1f5fbf')
    s.box(x + .6, y + .3, z + .5, w - 1.2, .9, .9, '#222')
    s.box(x + w * .5, y + 1.7, z + .5, 1.8, 1.4, .5, '#111')
    s.toptext(x + .6, y + 2.9, z + .55, 'PCA9685', .8)
    return (x + w / 2, y + d / 2, z + .5)


def servo(s, x, y, z, dx=4.6, dy=2.4, dz=4.4, col=SERVO):
    s.box(x, y, z, dx, dy, dz, col)
    s.box(x - 1.0, y, z + dz * .62, dx + 2.0, dy, .35, col)
    s.frust(x + dx * .27, y + dy / 2, z + dz, .5, .6, .6, '#e5e7ea')
    s.frust(x + dx * .27, y + dy / 2, z + dz + .5, .25, 1.05, 1.05, '#ffffff')
    return (x + dx / 2, y + dy / 2, z + dz)


def camera(s, x, y, z, dx=4.0, dy=3.2, dz=3.4, down=True):
    s.box(x, y, z, dx, dy, dz, '#1c1f24')
    s.box(x + .3, y + .3, z + dz, dx - .6, dy - .6, .25, '#2a7a3a')
    if down:
        s.frust(x + dx / 2, y + dy / 2, z - 1.8, 1.8, 1.25, 1.1, '#101214')
        s.frust(x + dx / 2, y + dy / 2, z - 1.85, .08, .7, .7, '#2d6cdf')
    return (x + dx / 2, y + dy / 2, z + dz)


def ir_pair(s, x, y0, y1, z, beamz=None):
    """Break-beam sensor pair across Y. returns anchors"""
    s.box(x, y0, z, 1.3, 1.3, 1.7, '#202226')
    s.sphere(x + .65, y0 + 1.3, z + .9, .38, '#ff3b30', layer=3)
    s.box(x, y1, z, 1.3, 1.3, 1.7, '#202226')
    s.sphere(x + .65, y1 - .0, z + .9, .38, '#ff3b30', layer=3)
    bz = beamz if beamz is not None else z + .9
    s.beam((x + .65, y0 + 1.4, bz), (x + .65, y1 - .1, bz))


def al_post(s, x, y, z, h, w=2.0):
    s.box(x, y, z, w, w, h, '#b9c1c9')
    s.box(x + w * .35, y + w * .35, z + h, w * .3, w * .3, .01, '#667')


def al_beam(s, x, y, z, dx, dy, dz):
    s.box(x, y, z, dx, dy, dz, '#b9c1c9')
