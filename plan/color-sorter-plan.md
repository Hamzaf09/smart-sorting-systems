# Colour Sorter "Pustache" -> Smart Sorting System (IEEE Competition plan)

Source: two Tinkercad screenshots (FRONT and RIGHT views) of "Copy of color sorting pustache".
Everything marked (?) could not be confirmed from the screenshots and needs a check in Tinkercad (select a shape -> read W/L/H).

## 1. What is in the current design (inspected)

| # | Visible component | Where | What it appears to be |
|---|---|---|---|
| 1 | Red backboard (thick slab, full height) | rear, ~4x thicker than the shelves in the RIGHT view | Main structural wall that everything hangs on |
| 2 | Thin dark rectangle frame inside the board | FRONT view | Window / outline of the board (?) |
| 3 | Three white horizontal shelves | high / middle / low | Platforms for electronics, servo, and ramp |
| 4 | Orange vertical tube (extends above the board, passes the top shelf) | left | Object feed tube / hopper (gravity entry) |
| 5 | Small yellow bar under the tube | top shelf | Stopper / gate stub (?) |
| 6 | Dark grey boxes (3-4 small blocks) | top shelf, right | Placeholder electronics: controller + breadboard (?) |
| 7 | Blue block with horn + red bar over it | middle shelf, left | Servo with a lever/arm |
| 8 | Dark grey inclined slim channel | centre, slopes down toward the front | Ramp / chute to the cups (fixed or servo-driven is (?)) |
| 9 | White block with blue top | lower, near the ramp (RIGHT view) | Second servo or sensor placeholder (?) |
| 10 | Four cylindrical cups: blue, yellow, green, red | floor | Collection bins; in the RIGHT view they sit at different depths |

## 2. What can be reused (keep as-is)
- Vertical layout on one backboard: gravity does the transport, so no belt or arm is needed.
- Orange feed tube (keep, only add singulation).
- Shelves as mounting levels (keep; add supports).
- Servo + inclined chute idea (keep as the single sorting actuator).
- Four coloured cups (keep; one becomes REJECT).
- Electronics on the top shelf, away from moving parts.

## 3. Weaknesses found
1. **No singulation**: a tube lets several objects drop together, so jams and double-sorts.
2. **No fixed inspection spot or controlled light**: colour cannot be read reliably on a falling object under room light.
3. **No sensors anywhere** (no IR, no camera mount): the pipeline Detect -> Identify -> Decide is invisible.
4. **Chute reach**: one tilted channel and a servo on the far left cannot obviously reach 4 cups that sit at different depths. Cups must lie on one arc under the chute outlet.
5. **No reject path**: the 4th cup is yellow, so uncertainty is not handled.
6. **Open cups**: objects can bounce out.
7. **Shelf spans** look unsupported (flex when printed / acrylic).
8. **Sizes unknown**: tube bore, chute width and cup diameter must be derived from the object size (rule below).

## 4. Design decisions (and why)
| Decision | Why |
|---|---|
| Keep the red backboard + 3 shelves + tube + chute + 4 cups | Student team already modelled it; gravity layout is the simplest reliable transport |
| Add a **two-pin escapement (G0)** at the tube bottom and a **flap gate G1** under the inspection chamber | A plain flap would drop the whole queue; the rocker holds object #2 with pin 2 while pin 1 lets #1 fall, so exactly one object is released. G1 holds it for the scan |
| Add **inspection chamber** between G0 and G1 (black/white matte box, LED strip, window for camera) | Same lighting and distance every time = reliable OpenCV colour |
| Add **IR break-beam** across the chamber | Proves "object entered", starts the scan, detects jams (G0 opened but no beam break) |
| Make the chute a **swing chute on one servo** (S2), cups on an arc under its outlet | One moving part decides the bin; no belts, no arm |
| Cups: Red, Green, Blue, **REJECT** (repaint the yellow cup grey/black) | Demonstrates uncertainty handling; yellow can be an optional 5th class later |
| Raspberry Pi does vision only; Arduino does all timing | Pi never drives servos directly, so a Python hiccup cannot crash a mechanism |
| Add funnel lips on cups, IR drop-confirm on at least the reject cup | No bounce-out; closed-loop proof of sorting |

Sizing rule (object diameter D): tube bore = D + 4 mm; chamber height = 1.5 D between the gates; chute width = D + 6 mm with side walls 0.7 D; cup diameter >= 3 D; chute slope 20-30 degrees; arc radius = chute length to outlet.

## 5. Final system layout (top to bottom on the backboard)
- Top shelf: Raspberry Pi 4, Arduino Uno, breadboard/terminal block, 5 V supplies.
- Feed tube (orange) with **G0 gate**; below it the **inspection chamber** with LED strip, IR beam, camera window and **G1 gate**.
- Middle shelf: **S2 servo** holding the swing chute pivot.
- Chute swings across the arc; four cups below: RED / GREEN / BLUE / REJECT.
- Camera on a printed arm facing the chamber window, 12-15 cm away.

## 6. Component list
| Component | Qty | Function | Suggested model | Essential? |
|---|---|---|---|---|
| Raspberry Pi | 1 | OpenCV classification | Pi 4 2 GB (or Pi 3B+) | Essential |
| microSD card | 1 | OS | 32 GB class 10 | Essential |
| Camera | 1 | Colour image | Pi Camera v2 / any USB webcam | Essential |
| Arduino | 1 | Servo + IR control, state machine | Uno (clone ok) | Essential |
| Servo (gate/chute) | 3 | G0, G1, S2 | MG90S (metal gear) or SG90 | Essential |
| IR break-beam pair | 1 (2 optional) | Object entry detect (+ drop confirm) | 5 mm IR LED + phototransistor, or 3 mm break-beam kit | Essential (1), Optional (2nd) |
| LED strip / ring | 1 | Constant lighting | 5 V white LED strip, 20 cm | Essential |
| Pi power | 1 | Power Pi | Official 5 V 3 A USB-C | Essential |
| Servo power | 1 | Separate rail for 3 servos | 5 V 3 A adapter or buck converter | Essential |
| Breadboard + jumper wires + terminal block | 1 set | Wiring | Half-size breadboard | Essential |
| USB cable A-B | 1 | Pi <-> Arduino serial | Standard | Essential |
| Resistors, capacitor | 1 set | IR LED 220 ohm, 470 uF across servo rail | Assorted | Essential |
| Push button + status LEDs | 1 / 3 | START, calibrate, READY/BUSY/REJECT | Panel buttons | Optional (recommended) |
| Backboard + shelves | 1 set | Frame | 6 mm plywood/acrylic or the printed red board | Essential |
| Feed tube | 1 | Gravity entry | Printed or PVC tube, bore D+4 mm | Essential |
| Inspection chamber | 1 | Fixed light and background | Printed box, matte white inside | Essential |
| Swing chute | 1 | Direct object to bin | Printed channel, smooth | Essential |
| Collection cups | 4 | Red, Green, Blue, Reject | Printed or plastic cups with funnel lip | Essential |
| Screws, standoffs, hot glue, tape | set | Assembly | M3 kit | Essential |
| Test objects | 30 | Red/green/blue + unknown | Equal-size balls or cubes | Essential |
| Monitor / laptop | 1 | Live dashboard | Any | Recommended |

Estimated cost: about USD 110-160 (Pi and camera are most of it).

## 7. Architecture
```
Object -> Tube/G0 -> Chamber (LED + IR beam + camera) ----IR "present"----> Arduino
Camera -> Raspberry Pi (OpenCV HSV vote) -> class + confidence -> DECISION
Pi --USB serial "C:R|G|B|X"--> Arduino --PWM--> S2 aims chute -> G1 opens -> Object -> Correct cup
Arduino --serial "DONE"/"JAM"--> Pi dashboard
```

## 8. Decision flow
```
IR beam broken? -> wait 0.4 s (object settles) -> capture 5 frames
For each frame: HSV mask in the central region of interest -> best colour area ratio
vote: >= 4/5 frames agree AND area ratio >= 0.60 AND second colour < 0.15
  RED   -> RED cup      GREEN -> GREEN cup      BLUE -> BLUE cup
  else  -> one re-scan (G1 wiggle); still unsure -> REJECT cup
```

## 9. Step-by-step operation
1. READY: G0 closed, G1 closed, chute at HOME, LEDs on.
2. Operator drops objects in the tube (several allowed); they queue above G0.
3. Arduino swings the G0 escapement (pin 1 out, pin 2 pinches the next object): exactly one object drops into the chamber and rests on G1; the pins swap back.
4. IR beam breaks: "object entered" -> Arduino tells Pi `SCAN`. No beam break within 1 s of G0 opening = JAM alarm.
5. Pi captures 5 frames, classifies, decides, sends `C:R` (or G / B / X).
6. Arduino turns S2 to the arc angle of that bin (RED 25 deg, GREEN 65, BLUE 105, REJECT 145 - tune).
7. Arduino opens G1; the object drops onto the chute and slides into the cup; optional IR on the cup mouth confirms.
8. Arduino sends `DONE`; chute returns to HOME; counters update; next object is metered. About 6-7 s per object.

## 10. Build plan (beginner friendly)
1. Frame: cut/print backboard and shelves, mount tube, check straightness.
2. Object movement test: drop objects with no electronics, fix tube bore, chute slope, cup positions.
3. One servo mechanism: add S2 swing chute with a servo tester; mark four angles.
4. Arduino control: sketch to move S2 to 4 angles from serial commands; then G0 and G1.
5. Sensors: IR beam on Arduino (print state); LED strip on; jam logic.
6. Camera + OpenCV: fixed camera mount; Python script printing class + confidence; tune HSV thresholds with the calibration script.
7. Integrate: Pi sends serial commands; Arduino state machine; end-to-end with 10 objects.
8. Reliability: run 50 objects, log failures, fix; practise with unknown/overlit objects; write the demo script.

Team split (3 students): mechanics, electronics/Arduino, vision/Python.

## 11. Competition value (cheap ideas)
1. **Teach mode**: one button learns the venue lighting (user shows R, G, B sample, thresholds update), so the demo survives a different room.
2. **Live dashboard** on a monitor: camera view with box, class, confidence bar, counters and a visible DECISION line.
3. **Closed-loop proof**: drop-confirm IR on the cups plus jam detection and automatic re-scan before reject, so judges see uncertainty handling and verified sorting.

## 12. Open questions to confirm in Tinkercad
- Object size/type used in the competition (rules) and the real model dimensions.
- Whether the grey channel is attached to the blue servo or fixed.
- What the dark grey boxes on the top shelf represent.
