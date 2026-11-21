-- SHIFT v1.2: exercise library, workout templates, custom macro ratios (stored in clients.targets JSON, no schema change).

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  muscle_group text not null default 'Other',
  equipment text not null default 'Bodyweight',
  cue text default '',
  sort int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  days jsonb not null default '{}',   -- same shape as clients.workout_plan
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.exercises enable row level security;
alter table public.workout_templates enable row level security;
-- Exercises (with form cues) are readable by any signed-in user; templates only by the coach.
create policy "signed-in read exercises" on public.exercises for select to authenticated using (true);
create policy "coach reads templates" on public.workout_templates for select using (public.is_coach());

-- Nandita's home exercise list (spelling tidied), plus brisk walk for rest days.
insert into public.exercises (name, muscle_group, equipment, cue, sort) values
  ('Dumbbell floor press', 'Chest', 'Dumbbells', 'Lie on the floor, elbows at 45°, press up and lower until elbows touch the floor.', 0),
  ('Dumbbell floor fly', 'Chest', 'Dumbbells', 'Soft bend in the elbows, open wide until upper arms touch the floor, squeeze back up.', 1),
  ('Dumbbell standing chest fly', 'Chest', 'Dumbbells', 'Slight forward lean, arms wide, bring the dumbbells together in front of the chest.', 2),
  ('Dumbbell close-grip press', 'Chest', 'Dumbbells', 'Dumbbells touching, press up from the chest, elbows close to the body.', 3),
  ('Resistance band chest press', 'Chest', 'Band', 'Band behind the back, press forward to straight arms, return slowly.', 4),
  ('Resistance band floor fly', 'Chest', 'Band', 'Lying on the band, open the arms wide and bring them together over the chest.', 5),
  ('Floor dumbbell pullover', 'Back', 'Dumbbells', 'Lie on the floor, one dumbbell in both hands, lower behind the head with soft elbows, pull back over the chest.', 6),
  ('Dumbbell single-arm row', 'Back', 'Dumbbells', 'Hand and knee on a chair, pull the dumbbell to the hip, back flat.', 7),
  ('Dumbbell double-arm row', 'Back', 'Dumbbells', 'Hinge at the hips, back flat, pull both dumbbells to the ribs.', 8),
  ('Dumbbell shrugs', 'Back', 'Dumbbells', 'Shoulders straight up to the ears, pause, lower slowly. No rolling.', 9),
  ('Seated resistance band row', 'Back', 'Band', 'Band around the feet, sit tall, pull elbows back and squeeze the shoulder blades.', 10),
  ('Seated dumbbell shoulder press', 'Shoulders', 'Dumbbells', 'Sit tall, press overhead without arching the lower back.', 11),
  ('Resistance band shoulder press', 'Shoulders', 'Band', 'Stand on the band, press overhead, ribs down.', 12),
  ('Dumbbell lateral raise', 'Shoulders', 'Dumbbells', 'Raise to shoulder height with soft elbows, lead with the elbows, lower slowly.', 13),
  ('Resistance band lateral raise', 'Shoulders', 'Band', 'Stand on the band, raise out to the sides to shoulder height.', 14),
  ('Dumbbell rear delt fly', 'Shoulders', 'Dumbbells', 'Hinge forward, arms hanging, open out to the sides squeezing the upper back.', 15),
  ('Resistance band rear delt fly', 'Shoulders', 'Band', 'Hold the band at chest height, pull it apart with straight arms.', 16),
  ('Dumbbell Arnold press', 'Shoulders', 'Dumbbells', 'Start palms facing you, rotate as you press overhead.', 17),
  ('Squats', 'Lower body', 'Bodyweight', 'Feet shoulder width, sit back and down, knees track over toes, chest up.', 18),
  ('Sumo squats', 'Lower body', 'Bodyweight', 'Wide stance, toes out, sit straight down, squeeze glutes at the top.', 19),
  ('Goblet squats', 'Lower body', 'Dumbbells', 'Hold one dumbbell at the chest, squat between the knees.', 20),
  ('Weighted squats (dumbbells on shoulders)', 'Lower body', 'Dumbbells', 'Dumbbells resting on the shoulders, squat to a comfortable depth.', 21),
  ('Bulgarian split squat', 'Lower body', 'Bodyweight', 'Back foot on a chair, lower the back knee, front knee over the foot.', 22),
  ('Heel-elevated squat', 'Lower body', 'Bodyweight', 'Heels on a book or plate, upright torso, deep squat for the quads.', 23),
  ('Chair squats', 'Lower body', 'Bodyweight', 'Sit back to touch the chair lightly, stand up without using hands.', 24),
  ('Dumbbell lying hamstring curl', 'Lower body', 'Dumbbells', 'Face down, dumbbell between the feet, curl heels toward the glutes.', 25),
  ('Dumbbell Romanian deadlift', 'Lower body', 'Dumbbells', 'Soft knees, push hips back, dumbbells slide down the legs, back flat.', 26),
  ('Dumbbell leg extension', 'Lower body', 'Dumbbells', 'Seated, dumbbell between the feet, straighten the knees, lower slowly.', 27),
  ('Glute bridge', 'Lower body', 'Bodyweight', 'Feet flat, push through the heels, squeeze the glutes at the top.', 28),
  ('Weighted glute bridge', 'Lower body', 'Dumbbells', 'Dumbbell on the hips, drive up and squeeze for a second.', 29),
  ('Calf raises', 'Lower body', 'Bodyweight', 'Rise onto the toes, pause, lower slowly. Hold a wall for balance.', 30),
  ('Lunges', 'Lower body', 'Bodyweight', 'Step forward, both knees to 90°, push back to standing.', 31),
  ('Reverse lunges', 'Lower body', 'Bodyweight', 'Step back, lower the back knee, drive up through the front heel.', 32),
  ('Dumbbell lunges', 'Lower body', 'Dumbbells', 'Forward lunge holding dumbbells at the sides.', 33),
  ('Dumbbell reverse lunges', 'Lower body', 'Dumbbells', 'Reverse lunge holding dumbbells at the sides.', 34),
  ('Walking lunges', 'Lower body', 'Bodyweight', 'Lunge forward step after step, torso upright.', 35),
  ('Pulse squat', 'Lower body', 'Bodyweight', 'Stay low in the squat and pulse up and down a few centimetres.', 36),
  ('Pulse lunges', 'Lower body', 'Bodyweight', 'Stay in the lunge and pulse a few centimetres.', 37),
  ('Heel slides (table top)', 'Abs', 'Bodyweight', 'Diastasis recti safe. On the back, knees bent, exhale and slide one heel out, return. Ribs down.', 38),
  ('Toe taps (table top)', 'Abs', 'Bodyweight', 'Diastasis recti safe. Legs in table top, exhale and tap one toe to the floor, return.', 39),
  ('Bird dog', 'Abs', 'Bodyweight', 'On all fours, reach opposite arm and leg, keep hips level.', 40),
  ('Cat camel', 'Abs', 'Bodyweight', 'On all fours, round the back up, then let it dip slowly. Breathe with it.', 41),
  ('Dead bug', 'Abs', 'Bodyweight', 'Back flat on the floor, lower opposite arm and leg slowly, exhale.', 42),
  ('Crunches', 'Abs', 'Bodyweight', 'Lift the shoulder blades only, chin off the chest.', 43),
  ('Bicycle crunches', 'Abs', 'Bodyweight', 'Elbow toward the opposite knee, slow and controlled.', 44),
  ('Russian twist', 'Abs', 'Bodyweight', 'Lean back slightly, rotate side to side from the ribs.', 45),
  ('Weighted Russian twist', 'Abs', 'Dumbbells', 'Russian twist holding one dumbbell.', 46),
  ('Duck walk', 'Abs', 'Bodyweight', 'Stay in a deep squat and walk forward in small steps.', 47),
  ('Leg raises', 'Abs', 'Bodyweight', 'Lower back pressed down, lower the legs only as far as you can control.', 48),
  ('Sit ups', 'Abs', 'Bodyweight', 'Feet anchored, roll up to sitting, roll down slowly.', 49),
  ('Leg raise holds (30°, 60°, 90°)', 'Abs', 'Bodyweight', 'Hold the legs at 30°, 60° and 90° for a few seconds each, lower back down on the floor.', 50),
  ('Jathara parivartanasana', 'Abs', 'Bodyweight', 'Revolved abdomen pose: arms out, knees bent together, lower them side to side slowly.', 51),
  ('Brisk walk', 'Cardio', 'Bodyweight', 'Steady pace where you can talk but not sing.', 52);

-- Demo templates written for Nandita to review and adapt.
insert into public.workout_templates (name, description, days, is_demo) values
  ('Beginner full body · 3 days', 'Home, dumbbells + band. Mon / Wed / Fri, with a walk on other days. Good first 4–6 weeks.', '{"Mon": [{"n": "Goblet squats", "s": "3", "r": "12", "rest": "60s"}, {"n": "Dumbbell floor press", "s": "3", "r": "10", "rest": "60s"}, {"n": "Dumbbell single-arm row", "s": "3", "r": "10 each", "rest": "60s"}, {"n": "Glute bridge", "s": "3", "r": "15", "rest": "45s"}, {"n": "Bird dog", "s": "3", "r": "8 each", "rest": "30s"}, {"n": "Dead bug", "s": "3", "r": "8 each", "rest": "30s"}], "Wed": [{"n": "Reverse lunges", "s": "3", "r": "10 each", "rest": "60s"}, {"n": "Seated dumbbell shoulder press", "s": "3", "r": "10", "rest": "60s"}, {"n": "Seated resistance band row", "s": "3", "r": "12", "rest": "60s"}, {"n": "Dumbbell Romanian deadlift", "s": "3", "r": "10", "rest": "60s"}, {"n": "Dumbbell lateral raise", "s": "2", "r": "12", "rest": "45s"}, {"n": "Heel slides (table top)", "s": "2", "r": "10 each", "rest": "30s"}], "Fri": [{"n": "Sumo squats", "s": "3", "r": "12", "rest": "60s"}, {"n": "Resistance band chest press", "s": "3", "r": "12", "rest": "60s"}, {"n": "Dumbbell double-arm row", "s": "3", "r": "10", "rest": "60s"}, {"n": "Weighted glute bridge", "s": "3", "r": "12", "rest": "60s"}, {"n": "Calf raises", "s": "3", "r": "15", "rest": "45s"}, {"n": "Bicycle crunches", "s": "3", "r": "12 each", "rest": "30s"}], "Sat": [{"n": "Brisk walk", "s": "1", "r": "30\u201345 min", "rest": "\u2014"}]}'::jsonb, true),
  ('Upper / lower · 4 days', 'Home, dumbbells + band. Mon lower, Tue upper, Thu lower, Fri upper. For clients who''ve done 4+ weeks of basics.', '{"Mon": [{"n": "Goblet squats", "s": "4", "r": "10", "rest": "90s"}, {"n": "Dumbbell Romanian deadlift", "s": "3", "r": "10", "rest": "90s"}, {"n": "Bulgarian split squat", "s": "3", "r": "8 each", "rest": "60s"}, {"n": "Glute bridge", "s": "3", "r": "15", "rest": "45s"}, {"n": "Calf raises", "s": "3", "r": "15", "rest": "45s"}, {"n": "Dead bug", "s": "3", "r": "10 each", "rest": "30s"}], "Tue": [{"n": "Dumbbell floor press", "s": "4", "r": "10", "rest": "90s"}, {"n": "Dumbbell single-arm row", "s": "3", "r": "10 each", "rest": "60s"}, {"n": "Seated dumbbell shoulder press", "s": "3", "r": "10", "rest": "60s"}, {"n": "Dumbbell lateral raise", "s": "3", "r": "12", "rest": "45s"}, {"n": "Dumbbell floor fly", "s": "3", "r": "12", "rest": "60s"}, {"n": "Russian twist", "s": "3", "r": "15 each", "rest": "30s"}], "Thu": [{"n": "Weighted squats (dumbbells on shoulders)", "s": "4", "r": "10", "rest": "90s"}, {"n": "Dumbbell reverse lunges", "s": "3", "r": "10 each", "rest": "60s"}, {"n": "Heel-elevated squat", "s": "3", "r": "12", "rest": "60s"}, {"n": "Weighted glute bridge", "s": "4", "r": "12", "rest": "60s"}, {"n": "Dumbbell lying hamstring curl", "s": "3", "r": "12", "rest": "45s"}, {"n": "Leg raises", "s": "3", "r": "10", "rest": "30s"}], "Fri": [{"n": "Dumbbell close-grip press", "s": "3", "r": "10", "rest": "60s"}, {"n": "Dumbbell double-arm row", "s": "3", "r": "12", "rest": "60s"}, {"n": "Dumbbell Arnold press", "s": "3", "r": "10", "rest": "60s"}, {"n": "Dumbbell rear delt fly", "s": "3", "r": "12", "rest": "45s"}, {"n": "Floor dumbbell pullover", "s": "3", "r": "12", "rest": "60s"}, {"n": "Dumbbell shrugs", "s": "3", "r": "12", "rest": "45s"}, {"n": "Bicycle crunches", "s": "3", "r": "12 each", "rest": "30s"}], "Sun": [{"n": "Brisk walk", "s": "1", "r": "45 min", "rest": "\u2014"}]}'::jsonb, true),
  ('Core-safe restart · 3 days', 'Diastasis-recti-friendly: no crunches, sit-ups or Russian twists. For postpartum clients or anyone rebuilding the core. Review with the client first.', '{"Mon": [{"n": "Cat camel", "s": "2", "r": "8", "rest": "30s"}, {"n": "Heel slides (table top)", "s": "3", "r": "8 each", "rest": "30s"}, {"n": "Toe taps (table top)", "s": "3", "r": "8 each", "rest": "30s"}, {"n": "Glute bridge", "s": "3", "r": "12", "rest": "45s"}, {"n": "Chair squats", "s": "3", "r": "10", "rest": "60s"}, {"n": "Seated resistance band row", "s": "3", "r": "12", "rest": "60s"}], "Wed": [{"n": "Bird dog", "s": "3", "r": "8 each", "rest": "30s"}, {"n": "Dead bug", "s": "3", "r": "6 each", "rest": "30s", "note": "Only if the tummy stays flat; otherwise heel slides."}, {"n": "Resistance band chest press", "s": "3", "r": "12", "rest": "60s"}, {"n": "Resistance band shoulder press", "s": "2", "r": "12", "rest": "60s"}, {"n": "Reverse lunges", "s": "2", "r": "8 each", "rest": "60s"}, {"n": "Calf raises", "s": "2", "r": "15", "rest": "45s"}], "Fri": [{"n": "Cat camel", "s": "2", "r": "8", "rest": "30s"}, {"n": "Toe taps (table top)", "s": "3", "r": "10 each", "rest": "30s"}, {"n": "Jathara parivartanasana", "s": "2", "r": "6 each", "rest": "30s", "note": "Small range, knees together."}, {"n": "Sumo squats", "s": "3", "r": "10", "rest": "60s"}, {"n": "Resistance band rear delt fly", "s": "3", "r": "12", "rest": "45s"}, {"n": "Glute bridge", "s": "3", "r": "15", "rest": "45s"}], "Sat": [{"n": "Brisk walk", "s": "1", "r": "30 min", "rest": "\u2014"}]}'::jsonb, true);
