-- SHIFT by Nandita — initial schema
-- Security model:
--   * Row Level Security is ON for every table.
--   * Clients may READ only their own rows; the coach may READ everything.
--   * There are NO insert/update/delete policies: every write goes through the
--     app's server code using the service-role key, after it has checked who
--     the signed-in user is. Browsers can never write directly.

create extension if not exists pgcrypto;

-- ---------- people ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,                       -- digits only, e.g. 919742030111
  role text not null default 'client' check (role in ('client','coach')),
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  phone text unique not null,              -- WhatsApp wa_id, digits only
  name text,
  sex text check (sex in ('f','m')),
  age int,
  height_cm numeric,
  weight_kg numeric,
  target_weight numeric,
  activity text default 'light',
  goal text default 'lose' check (goal in ('lose','maintain','gain')),
  diet text default 'veg',
  notes text default '',
  status text not null default 'lead' check (status in ('lead','active','paused','ended')),
  plan_name text,
  plan_ends date,
  payment_link text,
  targets jsonb,                           -- {kcal,p,c,f,split,water,steps,confirmed}
  coach_note text default '',
  meal_plan jsonb not null default '[]',   -- [{meal, items}]
  workout_plan jsonb not null default '{}',-- {Mon:[{n,s,r}], ...}
  last_inbound_at timestamptz,             -- opens WhatsApp's 24h service window
  last_log_date date,
  created_at timestamptz not null default now()
);

create table public.logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  date date not null,
  weight numeric,
  water int,
  steps int,
  energy int check (energy between 1 and 5),
  workout text check (workout in ('done','partial','skipped')),
  note text default '',
  coach_reply text,
  coach_replied_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (client_id, date)
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('breakfast','lunch','snacks','dinner')),
  name text not null,
  kcal numeric not null default 0,
  p numeric not null default 0,
  c numeric not null default 0,
  f numeric not null default 0,
  source text not null default 'web' check (source in ('whatsapp','web','coach')),
  photo_path text,
  created_at timestamptz not null default now()
);
create index meals_client_date on public.meals (client_id, date);

-- ---------- WhatsApp ----------
create table public.wa_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  wa_id text not null,
  direction text not null check (direction in ('in','out')),
  kind text not null,                      -- text, image, button, interactive, template
  category text,                           -- service, utility, authentication (for cost tracking)
  body jsonb,
  wa_message_id text unique,               -- dedupes Meta's webhook retries
  created_at timestamptz not null default now()
);
create index wa_messages_client on public.wa_messages (client_id, created_at desc);

create table public.wa_sessions (
  wa_id text primary key,
  state text not null default 'idle',
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------- helpers ----------
create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coach');
$$;

create or replace function public.my_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.clients where user_id = auth.uid();
$$;

-- When someone signs in with their phone for the first time, create a profile and
-- link it to the client record the WhatsApp bot already made for that number.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone) values (new.id, new.phone)
  on conflict (id) do update set phone = excluded.phone;
  if new.phone is not null then
    update public.clients set user_id = new.id where phone = new.phone and user_id is null;
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- row level security ----------
alter table public.profiles   enable row level security;
alter table public.clients    enable row level security;
alter table public.logs       enable row level security;
alter table public.meals      enable row level security;
alter table public.wa_messages enable row level security;
alter table public.wa_sessions enable row level security;

create policy "own profile"    on public.profiles for select using (id = auth.uid() or public.is_coach());
create policy "own client row" on public.clients  for select using (user_id = auth.uid() or public.is_coach());
create policy "own logs"       on public.logs     for select using (client_id = public.my_client_id() or public.is_coach());
create policy "own meals"      on public.meals    for select using (client_id = public.my_client_id() or public.is_coach());
create policy "coach messages" on public.wa_messages for select using (public.is_coach());
-- wa_sessions: no policies → service role only.

-- ---------- storage for meal photos (private) ----------
insert into storage.buckets (id, name, public) values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;
create policy "coach reads meal photos" on storage.objects for select
  using (bucket_id = 'meal-photos' and public.is_coach());

-- ---------- make Nandita the coach ----------
-- After Nandita signs in once at /login with her phone, run:
--   update public.profiles set role = 'coach' where phone = '91XXXXXXXXXX';
