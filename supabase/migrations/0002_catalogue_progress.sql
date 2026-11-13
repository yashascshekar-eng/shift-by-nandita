-- SHIFT v1.1: food catalogue, favourites, structured diet chart, body measurements.

-- ---------- food catalogue ----------
-- owner_client_id NULL  → Nandita's catalogue, visible to every client
-- owner_client_id set   → a client's own custom food, visible to that client and the coach
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  serving_qty numeric not null default 100,
  unit text not null default 'g',
  kcal numeric not null default 0,
  p numeric not null default 0,
  c numeric not null default 0,
  f numeric not null default 0,
  food_type text not null default 'veg' check (food_type in ('veg','egg','nonveg')),
  category text not null default 'Other',
  owner_client_id uuid references public.clients(id) on delete cascade,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index foods_owner on public.foods (owner_client_id);

create table public.favourites (
  client_id uuid not null references public.clients(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, food_id)
);

-- link logged meals to catalogue foods (optional; photo/AI meals have no food_id)
alter table public.meals add column food_id uuid references public.foods(id) on delete set null;
alter table public.meals add column qty numeric;
alter table public.meals add column unit text;

-- structured diet chart: [{meal, time, items:[{food_id,name,qty,unit,kcal,p,c,f}]}]
alter table public.clients add column diet_chart jsonb not null default '[]';

-- ---------- body measurements ----------
create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  date date not null,
  weight numeric, waist numeric, hip numeric, chest numeric, arm numeric, thigh numeric, neck numeric, body_fat numeric,
  note text default '',
  created_at timestamptz not null default now(),
  unique (client_id, date)
);

alter table public.foods enable row level security;
alter table public.favourites enable row level security;
alter table public.measurements enable row level security;
create policy "catalogue and own foods" on public.foods for select
  using (owner_client_id is null or owner_client_id = public.my_client_id() or public.is_coach());
create policy "own favourites" on public.favourites for select using (client_id = public.my_client_id() or public.is_coach());
create policy "own measurements" on public.measurements for select using (client_id = public.my_client_id() or public.is_coach());

-- ---------- starting catalogue ----------
-- Nandita's FITTR custom foods (clients' names removed) plus common home foods.
insert into public.foods (name, serving_qty, unit, kcal, p, c, f, food_type, category) values
  ('Raw rice / oats / wheat flour / rava', 50, 'g', 180, 5.7, 37.5, 0.8, 'veg', 'Grains'),
  ('Dosa batter', 100, 'g', 142, 4.7, 29.9, 0.3, 'veg', 'Grains'),
  ('Idli batter', 100, 'g', 154, 4.6, 33, 0.3, 'veg', 'Grains'),
  ('Saabudana / rajgira / sama rice', 30, 'g', 100, 4, 20, 1, 'veg', 'Grains'),
  ('Burger bun', 60, 'g', 154, 7.7, 28.9, 0.8, 'veg', 'Grains'),
  ('Sourdough bread', 65, 'g', 170, 7, 32, 1.5, 'veg', 'Grains'),
  ('Rice paper', 33, 'g', 115, 0.6, 27.9, 0, 'veg', 'Grains'),
  ('High protein oats', 50, 'g', 164, 13, 23.4, 3.2, 'veg', 'Grains'),
  ('NOBS classic masala oats', 75, 'g', 284, 26.2, 36.2, 3.9, 'veg', 'Grains'),
  ('NOBS mango coconut oatmeal', 75, 'g', 323, 27.5, 31.2, 9.9, 'veg', 'Grains'),
  ('Any legume / pulse / lentil (dal), raw', 75, 'g', 255, 19, 44, 1, 'veg', 'Pulses'),
  ('Mixed vegetables (except potato)', 100, 'g', 28, 1.6, 6.6, 0, 'veg', 'Vegetables'),
  ('Coconut (whole day allowance)', 100, 'g', 354, 3.3, 15.2, 33.5, 'veg', 'Fats & nuts'),
  ('Seeds (sunflower / chia)', 5, 'g', 30, 1, 2, 2.6, 'veg', 'Fats & nuts'),
  ('Khand (sugar)', 5, 'g', 20, 0.1, 4.9, 0, 'veg', 'Sweeteners'),
  ('Milk for coffee / tea', 100, 'ml', 63, 3, 5, 3.4, 'veg', 'Dairy'),
  ('Toned milk', 100, 'ml', 50, 3.3, 2.5, 3, 'veg', 'Dairy'),
  ('High protein milk', 250, 'ml', 162, 25, 14, 0.8, 'veg', 'Dairy'),
  ('Almond milk', 240, 'ml', 39, 1, 3, 3, 'veg', 'Dairy'),
  ('Oat milk', 240, 'ml', 150, 2, 19, 8, 'veg', 'Dairy'),
  ('Greek yogurt', 100, 'g', 89, 8, 9.5, 2.2, 'veg', 'Dairy'),
  ('Greek yogurt, 0% fat', 170, 'g', 90, 18, 5, 0, 'veg', 'Dairy'),
  ('Yogurt, low fat', 100, 'g', 77, 8, 6.5, 2.2, 'veg', 'Dairy'),
  ('Kvarg', 100, 'g', 60, 9.7, 4, 0.2, 'veg', 'Dairy'),
  ('Paneer, 0% fat', 100, 'g', 85, 17, 3.5, 0.5, 'veg', 'Dairy'),
  ('Paneer, high protein low fat', 100, 'g', 190, 25, 6.7, 9, 'veg', 'Dairy'),
  ('Paneer, high protein', 100, 'g', 213, 28, 0.5, 11, 'veg', 'Dairy'),
  ('Milky Mist high protein, low fat', 50, 'g', 101, 12.5, 2.9, 4.5, 'veg', 'Dairy'),
  ('Ice cream', 100, 'g', 154, 4.4, 14, 10, 'veg', 'Sweets'),
  ('Amul high protein shake', 200, 'ml', 138, 20, 19, 1.5, 'veg', 'Protein'),
  ('Whole Truth whey', 35, 'g', 139, 24.9, 6.4, 1.6, 'veg', 'Protein'),
  ('Impact whey, chocolate', 30, 'g', 115, 22.1, 2.4, 1.9, 'veg', 'Protein'),
  ('Whey protein', 31, 'g', 120, 24, 4, 1, 'veg', 'Protein'),
  ('Plant protein', 38, 'g', 140, 23.4, 11.3, 0.1, 'veg', 'Protein'),
  ('Yeast protein', 35, 'g', 140, 25, 4.8, 2.3, 'veg', 'Protein'),
  ('Protein bar, 40 g', 40, 'g', 160, 15, 14, 6, 'veg', 'Protein'),
  ('Protein bar, 50 g', 50, 'g', 230, 12, 18, 17, 'veg', 'Protein'),
  ('Chicken breast, raw', 200, 'g', 230, 44, 0, 4.5, 'nonveg', 'Meat & fish'),
  ('Chicken, cooked', 100, 'g', 131, 16, 0, 7.4, 'nonveg', 'Meat & fish'),
  ('Fish, cooked', 100, 'g', 50, 11, 0, 0.7, 'nonveg', 'Meat & fish'),
  ('Egg', 1, 'piece', 72, 6, 0, 4.8, 'egg', 'Eggs'),
  ('Egg white', 1, 'piece', 17, 3.6, 0.2, 0, 'egg', 'Eggs'),
  ('Banana', 100, 'g', 89, 1.1, 22.9, 0.3, 'veg', 'Fruits'),
  ('Idli', 1, 'piece', 60, 2, 12, 0.5, 'veg', 'Home meals'),
  ('Plain dosa', 1, 'piece', 170, 4, 28, 5, 'veg', 'Home meals'),
  ('Masala dosa', 1, 'piece', 330, 7, 48, 12, 'veg', 'Home meals'),
  ('Ragi mudde', 1, 'ball', 200, 5, 42, 1, 'veg', 'Home meals'),
  ('Chapati', 1, 'piece', 105, 3, 18, 3, 'veg', 'Home meals'),
  ('Rice, cooked', 1, 'cup', 205, 4, 45, 0.4, 'veg', 'Home meals'),
  ('Dal, cooked', 1, 'katori', 150, 9, 20, 4, 'veg', 'Home meals'),
  ('Sambar', 1, 'katori', 130, 6, 18, 4, 'veg', 'Home meals'),
  ('Vegetable sabzi / palya', 1, 'katori', 120, 3, 12, 7, 'veg', 'Home meals'),
  ('Poha', 1, 'plate', 250, 5, 45, 6, 'veg', 'Home meals'),
  ('Upma', 1, 'plate', 250, 6, 38, 8, 'veg', 'Home meals'),
  ('Curd', 1, 'cup', 150, 8, 11, 8, 'veg', 'Dairy'),
  ('Buttermilk', 1, 'glass', 40, 2, 4, 1.5, 'veg', 'Dairy'),
  ('Sprouts', 1, 'cup', 100, 7, 15, 1, 'veg', 'Pulses'),
  ('Fish curry', 1, 'katori', 220, 22, 6, 12, 'nonveg', 'Meat & fish'),
  ('Apple', 1, 'piece', 95, 0.5, 25, 0.3, 'veg', 'Fruits'),
  ('Filter coffee', 1, 'cup', 80, 2, 9, 4, 'veg', 'Drinks'),
  ('Tea with milk', 1, 'cup', 60, 2, 8, 2, 'veg', 'Drinks'),
  ('Peanuts', 30, 'g', 170, 7, 5, 14, 'veg', 'Fats & nuts'),
  ('Roasted chana', 30, 'g', 110, 6, 18, 2, 'veg', 'Pulses'),
  ('Dates', 1, 'piece', 23, 0.2, 6, 0, 'veg', 'Fruits'),
  ('Salad', 1, 'bowl', 40, 2, 8, 0.3, 'veg', 'Vegetables'),
  ('Ghee', 5, 'g', 45, 0, 0, 5, 'veg', 'Fats & nuts'),
  ('Cooking oil', 5, 'ml', 45, 0, 0, 5, 'veg', 'Fats & nuts');
