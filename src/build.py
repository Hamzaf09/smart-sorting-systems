import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from iso import *
import scenes_a

OUT = os.path.join(os.path.dirname(__file__), '..', 'renders')
os.makedirs(OUT, exist_ok=True)

CONCEPTS = []
INNOV = {
    'orbit': 'Closed-loop, vision-guided robotic arm: the same hardware sorts by any visual rule you can code (colour, shape, size) with zero mechanical changes, and the pick-and-place motion is the most “industrial” demo on the floor.',
    'revolver': 'Index-then-drop architecture: one stepper positions a chute over 5+ cups, so bins scale by adding cups, not motors. Camera + RGB sensor must agree, otherwise the object goes to the reject cup, which makes it very reliable.',
    'trisense': 'Sensor fusion on a conveyor: vision (colour/shape) + ToF (height) + inductive (metal) feed one decision. Timing uses belt speed, so no encoder is required. Easiest to extend to extra sorting rules.',
    'tiltsort': 'The platform IS the actuator: no belt, arm or gripper. Two servos tilt a clear plate and the camera closes the loop on the object’s live position, so it can also steer objects around each other. Cheapest build with the strongest live-demo effect.',
    'cascade': 'Zero-contact sorting: objects are lifted by an Archimedes screw and then sorted purely by gravity through a servo-flap binary tree (2 flaps = 4 bins, 3 flaps = 8). Tall, transparent and very photogenic.',
}
try:
    import scenes_b
except ImportError:
    scenes_b = None


def build(only=None):
    defs = [
        ('01', 'orbit', 'ORBIT PICKER', 'Radial 3-DOF robotic arm · vision-guided pick-and-place into a ring of bins',
         scenes_a.scene_orbit, [('Build', 'MEDIUM-HIGH'), ('Wow', '★★★★☆'), ('Cost', '~$110')],
         ['IR break-beam on the pick pad sees the object land; LED ring + camera are triggered.',
          'Raspberry Pi grabs a frame, HSV mask + contour shape → class (red / green / blue / yellow).',
          'Class → bin lookup table → inverse kinematics gives base / shoulder / elbow angles.',
          'Arm grips, lifts, swings to the bin, releases and homes. ~4 s per object.']),
        ('02', 'revolver', 'REVOLVER VAULT', 'Drop-in inspection chamber + stepper-indexed rotating chute over a ring of cups',
         scenes_a.scene_revolver, [('Build', 'MEDIUM'), ('Wow', '★★★★☆'), ('Cost', '~$95')],
         ['IR gate under the hopper detects the object; it falls onto a trapdoor in the lit chamber.',
          'Camera (OpenCV) + RGB sensor vote on colour / shape; disagreement → reject cup.',
          'Class → cup index; stepper rotates the chute to that angle (shortest path) before release.',
          'Servo opens the trapdoor, object slides down the chute into the cup. Fully gravity-fed.']),
    ]
    if scenes_b:
        defs += scenes_b.DEFS
    for num, slug, name, tag, fn, chips, pipe in defs:
        if only and slug not in only:
            continue
        sc = fn()
        svg = sc.render(num, name, tag, chips, pipe, INNOV[slug])
        with open(os.path.join(OUT, f'{num}_{slug}.svg'), 'w') as f:
            f.write(svg)
        print('wrote', num, slug)


if __name__ == '__main__':
    build(sys.argv[1:] or None)
