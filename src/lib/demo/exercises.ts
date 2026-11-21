// Animated demos for Nandita's exercise library, keyed by exercise name (lower case).
// Poses are rough illustrations; her own videos replace them as she uploads them.
import { FLOOR, type Demo, type Frame, type Part, type Pose } from './rig';

type Steps = [string, string, string];
const mk = (view: Demo['view'], anchor: Demo['anchor'], frames: Frame[], work: Part[], tempo: string, steps: Steps, avoid: string, extra: Partial<Demo> = {}): Demo =>
  ({ view, anchor, frames, work, tempo, steps, avoid, ...extra });
const F = (p: Partial<Pose>, d = 1200, h = 300): Frame => ({ p, d, h });

// ---- base poses ----
const STAND: Pose = { x: 100, y: FLOOR, t: -90, a1: 95, e1: 92, a2: 85, e2: 88, k1: 90, s1: 90, k2: 92, s2: 90, f1: 0, f2: 0 };
const ARMS_FWD = { a1: -2, e1: -2, a2: -4, e2: -4 };
const SQ_BOT = { t: -50, k1: 15, s1: 118, k2: 17, s2: 118 };
const LIE: Pose = { x: 118, y: 176, t: 180, h: 192, a1: 3, e1: 0, a2: 5, e2: 0, k1: -50, s1: 70, k2: -48, s2: 72, f1: 0, f2: 0 };
const PRONE: Pose = { ...LIE, x: 112, a1: 200, e1: -20, a2: 200, e2: -20, k1: 0, s1: 0, k2: 2, s2: 2, f1: 90, f2: 90 };
const FOURS: Pose = { x: 82, y: FLOOR - 3, t: -8, h: -8, a1: 92, e1: 90, a2: 90, e2: 90, k1: 90, s1: 180, k2: 90, s2: 180, f1: 180, f2: 180 };
const SEAT: Pose = { x: 92, y: 146, t: -88, a1: 100, e1: 92, a2: 98, e2: 90, k1: 0, s1: 90, k2: 2, s2: 90, f1: 0, f2: 0 };
const FRONT: Pose = { x: 100, y: FLOOR, t: 0, a1: 100, e1: 95, a2: 80, e2: 85, k1: 95, s1: 90, k2: 85, s2: 90 };
const FRONT_TOP: Pose = { ...FRONT, x: 100, y: 122 };
const HANDS_CHEST = { a1: 101, e1: -38, a2: 79, e2: -142 };
const ARMS_WIDE = { a1: 180, e1: 188, a2: 0, e2: -8 };
const PRESS_LOW_F = { a1: 180, e1: -90, a2: 0, e2: -90 };
const PRESS_TOP_F = { a1: -105, e1: -95, a2: -75, e2: -85 };

// ---- builders for families ----
const squat = (extra: Partial<Pose>, bottom: Partial<Pose>) =>
  [F({ ...STAND, ...ARMS_FWD, ...extra }, 1600, 400), F({ ...SQ_BOT, ...ARMS_FWD, ...extra, ...bottom }, 1000, 400)] as Frame[];
const LUNGE_TOP = { x: 122, k1: 70, s1: 95, k2: 105, s2: 110, t: -90 };
const LUNGE_BOT = { k1: 20, s1: 90, k2: 112, s2: 172, t: -88 };
const LUNGE_STAND = { x: 122, k1: 90, s1: 90, k2: 92, s2: 90, t: -90 };

export const DEMOS: Record<string, Demo> = {
  // ---------- chest ----------
  'dumbbell floor press': mk('side', 'hip', [F({ ...LIE, a1: 12, e1: -88 }, 1000, 300), F({ a1: -90, e1: -90 }, 1800, 400)], ['arm1'],
    '1s up · 2s down', ['Lie on the floor, knees bent, a dumbbell in each hand', 'Press straight up over the chest until the arms are long', 'Lower slowly until the elbows touch the floor'],
    'Avoid: elbows flaring out to 90°; keep them at about 45°', { props: ['db'] }),
  'dumbbell floor fly': mk('front', 'hip', [F({ ...FRONT_TOP, ...ARMS_WIDE }, 1200, 300), F({ ...HANDS_CHEST }, 1800, 300)], ['arm1', 'arm2'],
    '1s up · 2s down', ['Lie on your back, dumbbells above the chest, palms facing', 'With a soft bend in the elbows, open the arms wide', 'Stop when the upper arms touch the floor, squeeze back up'],
    'Avoid: straightening the elbows fully as you lower', { props: ['db', 'db2'], label: 'Seen from above' }),
  'dumbbell standing chest fly': mk('front', 'feet', [F({ ...FRONT, ...ARMS_WIDE }, 1200, 300), F({ ...HANDS_CHEST }, 1800, 300)], ['arm1', 'arm2'],
    '1s in · 2s out', ['Stand tall, lean slightly forward, arms open wide', 'Bring the dumbbells together in front of the chest', 'Squeeze the chest, then open slowly'],
    'Avoid: swinging the weights with the lower back', { props: ['db', 'db2'] }),
  'dumbbell close-grip press': mk('side', 'hip', [F({ ...LIE, a1: 25, e1: -80, a2: 25, e2: -80 }, 1000, 300), F({ a1: -90, e1: -90, a2: -90, e2: -90 }, 1800, 400)], ['arm1', 'arm2'],
    '1s up · 2s down', ['Lie down, dumbbells pressed together over the chest', 'Lower to the chest keeping elbows close to the body', 'Press back up, keeping the dumbbells touching'],
    'Avoid: letting the dumbbells drift apart', { props: ['db'] }),
  'resistance band chest press': mk('side', 'ankle1', [F({ ...STAND, a1: 150, e1: 2, a2: 152, e2: 4 }, 1000, 300), F({ a1: 0, e1: 0, a2: 2, e2: 2 }, 1800, 300)], ['arm1', 'arm2'],
    '1s out · 2s back', ['Band behind your upper back, a handle in each hand', 'Press forward until the arms are straight at chest height', 'Return slowly, elbows back by the ribs'],
    'Avoid: shrugging the shoulders up to the ears', { props: ['bandBack'] }),
  'resistance band floor fly': mk('front', 'hip', [F({ ...FRONT_TOP, ...ARMS_WIDE }, 1200, 300), F({ ...HANDS_CHEST }, 1800, 300)], ['arm1', 'arm2'],
    '1s in · 2s out', ['Lie on the band across your upper back, ends in the hands', 'Open the arms wide with soft elbows', 'Bring the hands together over the chest against the band'],
    'Avoid: arching the lower back off the floor', { label: 'Seen from above' }),

  // ---------- back ----------
  'floor dumbbell pullover': mk('side', 'hip', [F({ ...LIE, a1: 186, e1: 186, a2: 188, e2: 188 }, 1300, 300), F({ a1: 270, e1: 270, a2: 270, e2: 270 }, 2000, 300)], ['arm1', 'arm2'],
    '2s back · 1s over', ['Lie down, one dumbbell held in both hands over the chest', 'With soft elbows, lower it behind the head toward the floor', 'Pull it back over the chest, ribs stay down'],
    'Avoid: the ribs flaring and the back arching', { props: ['db'] }),
  'dumbbell single-arm row': mk('side', 'ankle1', [F({ ...STAND, x: 92, t: -22, h: -15, k1: 82, s1: 92, k2: 72, s2: 100, a1: 92, e1: 90, a2: 58, e2: 75 }, 1000, 200), F({ a1: 160, e1: 88 }, 1800, 400)], ['arm1'],
    '1s up · 2s down', ['Hand and knee on a chair, back flat, dumbbell hanging', 'Pull the dumbbell up to the hip, elbow close to the body', 'Lower slowly to a full stretch'],
    'Avoid: twisting the torso to lift the weight', { props: ['db', 'chairFront'], chair: [150, 40] }),
  'dumbbell double-arm row': mk('side', 'ankle1', [F({ ...STAND, x: 108, t: -28, h: -20, k1: 72, s1: 96, k2: 74, s2: 96, a1: 92, e1: 90, a2: 92, e2: 90 }, 1000, 200), F({ a1: 155, e1: 85, a2: 157, e2: 87 }, 1800, 400)], ['arm1', 'arm2', 'torso'],
    '1s up · 2s down', ['Hinge at the hips, soft knees, back flat', 'Pull both dumbbells to the lower ribs', 'Squeeze the shoulder blades, lower slowly'],
    'Avoid: rounding the back or standing up as you pull', { props: ['db'] }),
  'dumbbell shrugs': mk('front', 'feet', [F({ ...FRONT, sh: 0 }, 900, 200), F({ sh: 8 }, 1300, 900)], ['torso'],
    '1s up · 1s hold · 1s down', ['Stand tall, dumbbells by the sides', 'Lift the shoulders straight up toward the ears', 'Hold, then lower slowly. No rolling'],
    'Avoid: rolling the shoulders in circles', { props: ['db', 'db2'] }),
  'seated resistance band row': mk('side', 'hip', [F({ x: 72, y: 176, t: -90, h: -90, a1: 0, e1: 0, a2: 2, e2: 2, k1: 0, s1: 0, k2: 2, s2: 2, f1: -80, f2: -80 }, 1000, 300), F({ a1: 132, e1: 0, a2: 134, e2: 2 }, 1800, 500)], ['arm1', 'arm2'],
    '1s pull · 1s hold · 2s back', ['Sit tall, band around the feet, arms long', 'Pull the elbows back past the body', 'Squeeze the shoulder blades, return slowly'],
    'Avoid: leaning back to finish the pull', { props: ['band'] }),

  // ---------- shoulders ----------
  'seated dumbbell shoulder press': mk('side', 'hip', [F({ ...SEAT, a1: 95, e1: -82, a2: 97, e2: -80 }, 1000, 300), F({ a1: -92, e1: -90, a2: -92, e2: -90 }, 1800, 300)], ['arm1', 'arm2'],
    '1s up · 2s down', ['Sit tall, dumbbells at shoulder height', 'Press straight up until the arms are long', 'Lower with control back to the shoulders'],
    'Avoid: leaning back or flaring the ribs', { props: ['db', 'bench'], chair: [92, 33] }),
  'resistance band shoulder press': mk('front', 'feet', [F({ ...FRONT, ...PRESS_LOW_F }, 1000, 300), F({ ...PRESS_TOP_F }, 1800, 300)], ['arm1', 'arm2'],
    '1s up · 2s down', ['Stand on the band, handles at shoulder height', 'Press overhead, keeping the ribs down', 'Lower slowly to the shoulders'],
    'Avoid: arching the lower back as you press', { props: ['band'] }),
  'dumbbell lateral raise': mk('front', 'feet', [F({ ...FRONT }, 1000, 300), F({ a1: 180, e1: 186, a2: 0, e2: -6 }, 2000, 400)], ['arm1', 'arm2'],
    '1s up · 2s down', ['Stand tall, dumbbells by the sides, soft elbows', 'Raise out to the sides to shoulder height', 'Lower slowly, no swinging'],
    'Avoid: lifting above shoulder height or shrugging', { props: ['db', 'db2'] }),
  'resistance band lateral raise': mk('front', 'feet', [F({ ...FRONT }, 1000, 300), F({ a1: 180, e1: 186, a2: 0, e2: -6 }, 2000, 400)], ['arm1', 'arm2'],
    '1s up · 2s down', ['Stand on the band, handles by your sides', 'Raise the arms out to shoulder height', 'Lower against the band, slowly'],
    'Avoid: leaning to one side to finish the lift', { props: ['band'] }),
  'dumbbell rear delt fly': mk('front', 'feet', [F({ ...FRONT, tl: 0.72, a1: 98, e1: 94, a2: 82, e2: 86 }, 1000, 300), F({ a1: 172, e1: 176, a2: 8, e2: 4 }, 1800, 400)], ['arm1', 'arm2'],
    '1s up · 2s down', ['Hinge forward with a flat back, arms hanging', 'Open the arms out to the sides, squeezing the upper back', 'Lower slowly, keep the hinge'],
    'Avoid: using momentum or lifting the chest', { props: ['db', 'db2'], label: 'Hinged forward' }),
  'resistance band rear delt fly': mk('front', 'feet', [F({ ...FRONT, ...HANDS_CHEST }, 1000, 300), F({ ...ARMS_WIDE }, 1800, 500)], ['arm1', 'arm2'],
    '1s apart · 1s hold · 2s back', ['Hold the band at chest height, arms straight', 'Pull the band apart until it touches the chest', 'Squeeze the shoulder blades, return slowly'],
    'Avoid: bending the elbows to make it easier', { props: ['bandHands'] }),
  'dumbbell arnold press': mk('front', 'feet', [F({ ...FRONT, a1: 96, e1: -78, a2: 84, e2: -102 }, 1200, 300), F({ ...PRESS_TOP_F }, 2000, 300)], ['arm1', 'arm2'],
    '2s up · 2s down', ['Dumbbells in front of the shoulders, palms facing you', 'Rotate the palms forward as you press overhead', 'Reverse the rotation on the way down'],
    'Avoid: rushing the rotation; keep it smooth', { props: ['db', 'db2'] }),

  // ---------- lower body ----------
  squats: mk('side', 'ankle1', squat({}, {}), ['leg1', 'leg2'],
    '2s down · 1s up', ['Feet shoulder width, arms out in front', 'Sit back and down, knees tracking over the toes', 'Drive through the heels to stand tall'], 'Avoid: knees caving in or heels lifting'),
  'sumo squats': mk('front', 'feet', [F({ ...FRONT, k1: 115, s1: 100, k2: 65, s2: 80, ...HANDS_CHEST }, 1600, 400), F({ k1: 160, s1: 69, k2: 20, s2: 111 }, 1000, 400)], ['leg1', 'leg2'],
    '2s down · 1s up', ['Wide stance, toes turned out', 'Sit straight down, knees pushing out over the toes', 'Squeeze the glutes as you stand'], 'Avoid: knees falling inward'),
  'goblet squats': mk('side', 'ankle1', squat({ a1: 72, e1: -100, a2: 74, e2: -98 }, { a1: 85, e1: -88, a2: 87, e2: -86 }), ['leg1', 'leg2'],
    '2s down · 1s up', ['Hold one dumbbell at the chest, elbows down', 'Squat down between the knees, chest up', 'Push through the heels to stand'], 'Avoid: the chest dropping forward', { props: ['db'] }),
  'weighted squats (dumbbells on shoulders)': mk('side', 'ankle1', squat({ a1: 35, e1: -150, a2: 37, e2: -148 }, { a1: 75, e1: -115, a2: 77, e2: -113 }), ['leg1', 'leg2'],
    '2s down · 1s up', ['Rest a dumbbell on each shoulder', 'Squat to a comfortable depth, chest proud', 'Drive up through the whole foot'], 'Avoid: the elbows dropping and the back rounding', { props: ['db'] }),
  'bulgarian split squat': mk('side', 'ankle1', [F({ ...STAND, x: 128, k1: 72, s1: 96, k2: 102, s2: 162, f2: 160 }, 1400, 300), F({ t: -86, k1: 22, s1: 92, k2: 112, s2: 205 }, 1000, 300)], ['leg1'],
    '2s down · 1s up', ['Back foot on a chair, front foot a big step forward', 'Lower the back knee toward the floor', 'Push through the front heel to rise'], 'Avoid: the front knee caving in', { props: ['chair'], chair: [62, 40] }),
  'heel-elevated squat': mk('side', 'ankle1', squat({}, { t: -62, k1: 10, s1: 112, k2: 12, s2: 112 }), ['leg1', 'leg2'],
    '2s down · 1s up', ['Heels on a book or plate, toes on the floor', 'Squat deep with an upright chest', 'Stand tall, feel it in the thighs'], 'Avoid: leaning forward; stay upright', { props: ['wedge'] }),
  'chair squats': mk('side', 'ankle1', [F({ ...STAND, ...ARMS_FWD }, 1600, 300), F({ ...SQ_BOT, t: -55, ...ARMS_FWD }, 1000, 500)], ['leg1', 'leg2'],
    '2s down · tap · 1s up', ['Stand in front of a chair, arms forward', 'Sit back until you lightly touch the seat', 'Stand back up without using your hands'], 'Avoid: flopping onto the chair', { props: ['chair'], chair: [70, 40] }),
  'dumbbell lying hamstring curl': mk('side', 'hip', [F({ ...PRONE }, 1000, 200), F({ s1: -88, s2: -86, f1: -180, f2: -178 }, 1800, 300)], ['leg1', 'leg2'],
    '1s up · 2s down', ['Lie face down, dumbbell held between the feet', 'Curl the heels toward the glutes', 'Lower slowly, hips stay down'], 'Avoid: the hips lifting off the floor', { props: ['dbFeet'] }),
  'dumbbell romanian deadlift': mk('side', 'ankle1', [F({ ...STAND, x: 108, k1: 92, s1: 88, k2: 93, s2: 88, a1: 92, e1: 92, a2: 90, e2: 90 }, 1800, 300), F({ t: -14, h: -10, k1: 74, s1: 96, k2: 75, s2: 96, a1: 90, e1: 90, a2: 90, e2: 90 }, 1200, 300)], ['leg1', 'torso'],
    '2s down · 1s up', ['Stand tall, dumbbells in front of the thighs', 'Push the hips back, dumbbells slide down the legs', 'Stop at mid-shin, squeeze the glutes to stand'], 'Avoid: rounding the back', { props: ['db'] }),
  'dumbbell leg extension': mk('side', 'hip', [F({ ...SEAT }, 1000, 200), F({ s1: 4, f1: -86 }, 1800, 500)], ['leg1'],
    '1s up · 1s hold · 2s down', ['Sit tall on a chair, dumbbell between the feet', 'Straighten the knees until the legs are level', 'Hold, then lower slowly'], 'Avoid: kicking up fast', { props: ['dbFeet', 'bench'], chair: [92, 33] }),
  'glute bridge': mk('side', 'hip', [F({ ...LIE }, 1000, 200), F({ x: 112, y: 152, t: 151, k1: 0, s1: 82, k2: 2, s2: 84 }, 1200, 900)], ['leg1', 'torso'],
    '1s up · 1s hold · 2s down', ['Lie on your back, knees bent, feet flat', 'Push through the heels and lift the hips', 'Squeeze the glutes at the top, lower slowly'], 'Avoid: arching the lower back at the top'),
  'weighted glute bridge': mk('side', 'hip', [F({ ...LIE }, 1000, 200), F({ x: 112, y: 152, t: 151, k1: 0, s1: 82, k2: 2, s2: 84 }, 1200, 900)], ['leg1', 'torso'],
    '1s up · 1s hold · 2s down', ['Dumbbell resting on the hip bones', 'Drive up through the heels', 'Squeeze for a second at the top, lower slowly'], 'Avoid: pushing through the toes', { props: ['dbHips'] }),
  'calf raises': mk('side', 'ankle1', [F({ ...STAND }, 700, 200), F({ y: FLOOR - 8, f1: 42, f2: 42 }, 1500, 700)], ['leg1', 'leg2'],
    '1s up · 1s hold · 2s down', ['Stand tall, a hand on a wall for balance', 'Rise high onto the toes', 'Pause, then lower slowly'], 'Avoid: bouncing at the bottom'),
  lunges: mk('side', 'ankle1', [F({ ...STAND, ...LUNGE_TOP }, 1400, 300), F({ ...LUNGE_BOT }, 1000, 300)], ['leg1', 'leg2'],
    '2s down · 1s up', ['Step forward into a long stride', 'Lower until both knees are at 90°', 'Push back up through the front heel'], 'Avoid: the front knee shooting past the toes'),
  'reverse lunges': mk('side', 'ankle1', [F({ ...STAND, ...LUNGE_STAND }, 1400, 300), F({ ...LUNGE_BOT }, 1200, 300)], ['leg1', 'leg2'],
    '2s down · 1s up', ['Stand tall, feet hip width', 'Step back and lower the back knee', 'Drive through the front heel to return'], 'Avoid: leaning the chest forward'),
  'dumbbell lunges': mk('side', 'ankle1', [F({ ...STAND, ...LUNGE_TOP }, 1400, 300), F({ ...LUNGE_BOT }, 1000, 300)], ['leg1', 'leg2'],
    '2s down · 1s up', ['Dumbbells by your sides, step forward', 'Lower until both knees are at 90°', 'Push back to standing'], 'Avoid: the dumbbells swinging', { props: ['db'] }),
  'dumbbell reverse lunges': mk('side', 'ankle1', [F({ ...STAND, ...LUNGE_STAND }, 1400, 300), F({ ...LUNGE_BOT }, 1200, 300)], ['leg1', 'leg2'],
    '2s down · 1s up', ['Dumbbells by your sides', 'Step back and lower the back knee', 'Drive up through the front heel'], 'Avoid: the torso tipping forward', { props: ['db'] }),
  'walking lunges': mk('side', 'ankle1', [F({ ...STAND, ...LUNGE_TOP }, 1400, 200), F({ ...LUNGE_BOT }, 1000, 200)], ['leg1', 'leg2'],
    '2s down · step through', ['Lunge forward, both knees to 90°', 'Bring the back leg through into the next step', 'Keep the torso upright the whole way'], 'Avoid: short, choppy steps'),
  'pulse squat': mk('side', 'ankle1', [F({ ...STAND, ...ARMS_FWD, ...SQ_BOT }, 450, 0), F({ t: -60, k1: 32, s1: 112, k2: 34, s2: 112 }, 450, 0)], ['leg1', 'leg2'],
    'Small, fast pulses', ['Sit into a squat and stay low', 'Pulse up and down a few centimetres', 'Keep the chest up and the weight in the heels'], 'Avoid: standing all the way up between pulses'),
  'pulse lunges': mk('side', 'ankle1', [F({ ...STAND, ...LUNGE_TOP, ...LUNGE_BOT }, 450, 0), F({ k1: 32, s1: 92, k2: 110, s2: 155 }, 450, 0)], ['leg1', 'leg2'],
    'Small, fast pulses', ['Get into the bottom of a lunge', 'Pulse up and down a few centimetres', 'Finish all reps, then switch legs'], 'Avoid: the back knee banging the floor'),

  // ---------- abs ----------
  'heel slides (table top)': mk('side', 'hip', [F({ ...LIE }, 1500, 300), F({ k1: -6, s1: 8, f1: -70 }, 1500, 300)], ['leg1'],
    'Slow, with the breath', ['Lie on your back, knees bent, ribs down', 'Exhale and slide one heel away along the floor', 'Inhale and slide it back. Belly stays flat'], 'Stop if the belly domes or bulges', { work: ['leg1', 'torso'] }),
  'toe taps (table top)': mk('side', 'hip', [F({ ...LIE, k1: -90, s1: 0, k2: -88, s2: 2, f1: -70, f2: -70 }, 1300, 300), F({ k1: -45, s1: 60, f1: 0 }, 1300, 200)], ['leg1', 'torso'],
    'Slow, with the breath', ['Legs in table top, knees over hips', 'Exhale and tap one toe to the floor', 'Return and switch sides. Back stays down'], 'Stop if the belly domes or bulges'),
  'bird dog': mk('side', 'knee1', [F({ ...FOURS }, 1400, 300), F({ a1: -6, e1: -6, k2: 178, s2: 178, f2: 90 }, 1400, 900)], ['arm1', 'leg2', 'torso'],
    '2s out · 1s hold · 2s back', ['On all fours, hands under shoulders', 'Reach one arm forward and the opposite leg back', 'Hold with level hips, return and switch'], 'Avoid: the hips tipping or the back sagging'),
  'cat camel': mk('side', 'knee1', [F({ ...FOURS, c: -6, h: -38 }, 1800, 300), F({ c: 11, h: 55 }, 1800, 300)], ['torso'],
    'Slow, with the breath', ['On all fours, hands under shoulders', 'Exhale and round the back up toward the ceiling', 'Inhale and let the back dip gently, head up'], 'Avoid: forcing the range; move gently'),
  'dead bug': mk('side', 'hip', [F({ ...LIE, a1: -90, e1: -90, a2: -90, e2: -90, k1: -90, s1: 0, k2: -88, s2: 2, f1: -70, f2: -70 }, 1600, 300), F({ k1: -12, s1: -6, f1: -80, a2: -170, e2: -170 }, 2000, 300)], ['leg1', 'arm2', 'torso'],
    '3s out · 2s back', ['On your back, arms up, knees over hips', 'Exhale and lower one leg and the opposite arm', 'Lower back stays pressed down. Return and switch'], 'Avoid: the back lifting off the floor'),
  crunches: mk('side', 'hip', [F({ ...LIE, a1: -20, e1: -20, a2: -18, e2: -18 }, 900, 200), F({ t: 207, h: 222, a1: -10, e1: -10, a2: -8, e2: -8 }, 1400, 500)], ['torso'],
    '1s up · 2s down', ['Lie on your back, knees bent', 'Lift only the shoulder blades, reaching to the knees', 'Lower slowly, chin off the chest'], 'Avoid: pulling on the neck'),
  'bicycle crunches': mk('side', 'hip', [F({ ...LIE, t: 203, h: 215, a1: -150, e1: 30, a2: -148, e2: 32, k1: -115, s1: -20, k2: -14, s2: -10, f1: -100, f2: -100 }, 900, 150), F({ k1: -14, s1: -10, k2: -115, s2: -20 }, 900, 150)], ['torso', 'leg1', 'leg2'],
    'Slow and controlled', ['Shoulders lifted, hands lightly at the head', 'Bring one knee in as the other leg extends', 'Turn the opposite elbow toward the knee, switch'], 'Avoid: yanking the neck with the hands'),
  'russian twist': mk('front', 'hip', [F({ ...FRONT, y: 168, t: -14, k1: -125, s1: 95, k2: -55, s2: 85, a1: 87, e1: -52, a2: 65, e2: -156 }, 1000, 150), F({ t: 14, a1: 115, e1: -24, a2: 93, e2: -128 }, 1000, 150)], ['torso'],
    'Steady rhythm', ['Sit, lean back slightly, feet down or lifted', 'Rotate the ribs to one side, hands together', 'Rotate to the other side. Chest stays tall'], 'Avoid: just swinging the arms; turn from the ribs'),
  'weighted russian twist': mk('front', 'hip', [F({ ...FRONT, y: 168, t: -14, k1: -125, s1: 95, k2: -55, s2: 85, a1: 87, e1: -52, a2: 65, e2: -156 }, 1100, 150), F({ t: 14, a1: 115, e1: -24, a2: 93, e2: -128 }, 1100, 150)], ['torso'],
    'Steady rhythm', ['Sit and lean back slightly, dumbbell at the chest', 'Rotate the ribs and dumbbell to one side', 'Rotate across to the other side'], 'Avoid: rounding the back', { props: ['db'] }),
  'duck walk': mk('side', 'hip', [F({ x: 100, y: 148, t: -70, h: -75, ...ARMS_FWD, k1: 5, s1: 110, k2: 30, s2: 149 }, 700, 100), F({ k1: 30, s1: 149, k2: 5, s2: 110 }, 700, 100)], ['leg1', 'leg2'],
    'Small, steady steps', ['Drop into a deep squat', 'Walk forward in small steps, staying low', 'Keep the chest up throughout'], 'Avoid: popping up between steps'),
  'leg raises': mk('side', 'hip', [F({ ...LIE, k1: -90, s1: -90, k2: -88, s2: -88, f1: -180, f2: -178 }, 2200, 300), F({ k1: -12, s1: -12, k2: -10, s2: -10, f1: -100, f2: -98 }, 1300, 400)], ['leg1', 'leg2', 'torso'],
    '2s down · 1s up', ['Lie flat, legs straight up, hands by your sides', 'Lower the legs only as far as the back stays down', 'Raise back up with control'], 'Avoid: the lower back arching off the floor'),
  'sit ups': mk('side', 'hip', [F({ ...LIE, a1: -20, e1: -20, a2: -18, e2: -18 }, 1400, 200), F({ t: 282, h: 288, a1: 0, e1: 0, a2: 2, e2: 2 }, 1800, 300)], ['torso'],
    '1s up · 2s down', ['Lie with knees bent, feet anchored', 'Roll up to sitting, reaching forward', 'Roll down slowly one vertebra at a time'], 'Avoid: jerking up with momentum'),
  'leg raise holds (30°, 60°, 90°)': mk('side', 'hip', [
    F({ ...LIE, k1: -8, s1: -8, k2: -6, s2: -6, f1: -98, f2: -96 }, 900, 300), F({ k1: -30, s1: -30, k2: -28, s2: -28, f1: -120, f2: -118 }, 900, 1800),
    F({ k1: -60, s1: -60, k2: -58, s2: -58, f1: -150, f2: -148 }, 900, 1800), F({ k1: -90, s1: -90, k2: -88, s2: -88, f1: -180, f2: -178 }, 1800, 1800)], ['leg1', 'leg2', 'torso'],
    'Hold each angle a few seconds', ['Lie flat, lower back pressed down', 'Raise the legs to 30°, hold. Then 60°, hold. Then 90°, hold', 'Lower slowly back to the floor'], 'Avoid: the lower back lifting at the 30° hold'),
  'jathara parivartanasana': mk('front', 'hip', [F({ ...FRONT_TOP, a1: 180, e1: 180, a2: 0, e2: 0, k1: 138, s1: 118, k2: 142, s2: 124 }, 2600, 900), F({ k1: 38, s1: 56, k2: 42, s2: 62 }, 2600, 900)], ['leg1', 'leg2', 'torso'],
    'Slow, with the breath', ['Lie on your back, arms out in a T, knees bent together', 'Exhale and lower the knees to one side', 'Inhale to centre, exhale to the other side. Shoulders stay down'], 'Avoid: the opposite shoulder lifting', { label: 'Seen from above' }),

  // ---------- cardio ----------
  'brisk walk': mk('side', 'hip', [F({ ...STAND, x: 100, y: 116, t: -87, k1: 65, s1: 85, k2: 118, s2: 125, a1: 118, e1: 100, a2: 62, e2: 45 }, 520, 0), F({ k1: 118, s1: 125, k2: 65, s2: 85, a1: 62, e1: 45, a2: 118, e2: 100 }, 520, 0)], ['leg1', 'leg2'],
    'Talk, but not sing', ['Walk tall, eyes forward', 'Swing the arms naturally, heel to toe', 'Keep a pace where you can talk but not sing'], 'Avoid: slouching over the phone'),
};

export const demoFor = (name: string): Demo | undefined => DEMOS[name.toLowerCase()];
