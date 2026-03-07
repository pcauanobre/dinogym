-- ============================================================
-- DinoGym — Supabase Schema
-- Cole e execute no SQL Editor do Supabase (Dashboard > SQL Editor > New Query)
-- ============================================================

-- ===== PROFILES (linked to auth.users) =====
create table profiles (
  id              uuid references auth.users(id) on delete cascade primary key,
  name            text not null,
  email           text,
  cpf             text unique,
  role            text not null default 'MEMBER' check (role in ('ADMIN', 'MEMBER')),
  first_access_done boolean default true,
  photo_base64    text,
  routine_templates jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ===== MACHINES (exercises) =====
create table machines (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references profiles(id) on delete cascade not null,
  name            text not null,
  category        text not null,
  photo_base64    text,
  current_pr      float,
  is_favorite     boolean default false,
  created_at      timestamptz default now()
);

-- ===== ROUTINE =====
create table routine_days (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references profiles(id) on delete cascade not null,
  day_of_week     integer not null check (day_of_week between 0 and 6),
  label           text,
  unique (user_id, day_of_week)
);

create table routine_exercises (
  id              uuid default gen_random_uuid() primary key,
  routine_day_id  uuid references routine_days(id) on delete cascade not null,
  machine_id      uuid references machines(id) on delete cascade not null,
  sets            integer default 3,
  reps            integer default 12,
  reps_max        integer,
  sort_order      integer default 0
);

-- ===== WORKOUTS =====
create table workout_sessions (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references profiles(id) on delete cascade not null,
  date            timestamptz default now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  duration        integer,
  day_rating      integer,
  nutrition       integer,
  finished        boolean default false
);

create table workout_entries (
  id              uuid default gen_random_uuid() primary key,
  session_id      uuid references workout_sessions(id) on delete cascade not null,
  machine_id      uuid references machines(id) on delete cascade not null,
  weight          float not null,
  sets            integer,
  reps            integer,
  hit_pr          boolean default false,
  previous_pr     float,
  notes           text,
  sets_data       text,
  comment         text,
  sort_order      integer,
  created_at      timestamptz default now()
);

-- ===== INDEXES =====
create index idx_machines_user on machines(user_id);
create index idx_sessions_user on workout_sessions(user_id);
create index idx_sessions_date on workout_sessions(user_id, date);
create index idx_entries_session on workout_entries(session_id);
create index idx_entries_machine on workout_entries(machine_id);
create index idx_routine_days_user on routine_days(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table machines enable row level security;
alter table routine_days enable row level security;
alter table routine_exercises enable row level security;
alter table workout_sessions enable row level security;
alter table workout_entries enable row level security;

-- Profiles
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);
create policy "profiles_select_admin" on profiles
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
  );

-- Machines (select: all authenticated for routine sharing; manage: own only)
create policy "machines_manage_own" on machines
  for all using (user_id = auth.uid());
create policy "machines_read_all" on machines
  for select using (auth.role() = 'authenticated');

-- Routine Days (select: all authenticated for sharing; manage: own)
create policy "routine_days_manage_own" on routine_days
  for all using (user_id = auth.uid());
create policy "routine_days_read_all" on routine_days
  for select using (auth.role() = 'authenticated');

-- Routine Exercises
create policy "routine_exercises_manage_own" on routine_exercises
  for all using (
    routine_day_id in (select id from routine_days where user_id = auth.uid())
  );
create policy "routine_exercises_read_all" on routine_exercises
  for select using (auth.role() = 'authenticated');

-- Workout Sessions
create policy "sessions_manage_own" on workout_sessions
  for all using (user_id = auth.uid());

-- Workout Entries
create policy "entries_manage_own" on workout_entries
  for all using (
    session_id in (select id from workout_sessions where user_id = auth.uid())
  );

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Auto-create profile when a new auth user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Usuario'),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'MEMBER')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Auto-update updated_at on profiles
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- ============================================================
-- RPC: Get routine by email (for friend sharing)
-- ============================================================
create or replace function get_routine_by_email(target_email text)
returns jsonb as $$
declare
  target_user record;
  result jsonb;
begin
  select id, name into target_user
  from profiles
  where email = lower(trim(target_email));

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'name', target_user.name,
    'days', coalesce((
      select jsonb_agg(day_obj order by (day_obj->>'dayOfWeek')::int)
      from (
        select jsonb_build_object(
          'dayOfWeek', rd.day_of_week,
          'label', rd.label,
          'exercises', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'name', m.name,
                'category', m.category,
                'sets', re.sets,
                'reps', re.reps,
                'repsMax', re.reps_max
              ) order by re.sort_order
            )
            from routine_exercises re
            join machines m on m.id = re.machine_id
            where re.routine_day_id = rd.id
          ), '[]'::jsonb)
        ) as day_obj
        from routine_days rd
        where rd.user_id = target_user.id
      ) sub
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$ language plpgsql security definer;

-- ============================================================
-- DEFAULT EXERCISES (150 exercises across 10 categories)
-- Called via: select create_default_exercises();
-- ============================================================
create or replace function create_default_exercises()
returns void as $$
declare
  uid uuid := auth.uid();
  exercises jsonb := '[
    {"name":"Supino Reto","category":"Peito"},{"name":"Supino Inclinado","category":"Peito"},
    {"name":"Supino Declinado","category":"Peito"},{"name":"Supino Halteres","category":"Peito"},
    {"name":"Supino Inclinado Halteres","category":"Peito"},{"name":"Supino Maquina","category":"Peito"},
    {"name":"Supino Pegada Neutra","category":"Peito"},{"name":"Crucifixo","category":"Peito"},
    {"name":"Crucifixo Inclinado","category":"Peito"},{"name":"Crossover","category":"Peito"},
    {"name":"Peck Deck","category":"Peito"},{"name":"Voador Maquina","category":"Peito"},
    {"name":"Pullover","category":"Peito"},{"name":"Flexao","category":"Peito"},
    {"name":"Supino Pegada Fechada","category":"Peito"},
    {"name":"Puxador Frontal","category":"Costas"},{"name":"Puxador Fechado","category":"Costas"},
    {"name":"Puxador Triangulo","category":"Costas"},{"name":"Puxador Unilateral","category":"Costas"},
    {"name":"Barra Fixa","category":"Costas"},{"name":"Remada T Bar","category":"Costas"},
    {"name":"Remada Alta","category":"Costas"},{"name":"Remada Curvado","category":"Costas"},
    {"name":"Remada Sentado Maquina","category":"Costas"},{"name":"Remada Unilateral","category":"Costas"},
    {"name":"Remada Fechada","category":"Costas"},{"name":"Serrote","category":"Costas"},
    {"name":"Levantamento Terra","category":"Costas"},{"name":"Hiperextensao Lombar","category":"Costas"},
    {"name":"Good Morning","category":"Costas"},
    {"name":"Desenvolvimento Barra","category":"Ombro"},{"name":"Desenvolvimento Halteres","category":"Ombro"},
    {"name":"Desenvolvimento Maquina","category":"Ombro"},{"name":"Desenvolvimento Arnold","category":"Ombro"},
    {"name":"Frontal Ombro","category":"Ombro"},{"name":"Lateral Ombro","category":"Ombro"},
    {"name":"Elevacao Lateral Cabo","category":"Ombro"},{"name":"Posterior de Ombro","category":"Ombro"},
    {"name":"Peck Deck Posterior","category":"Ombro"},{"name":"Crucifixo Invertido","category":"Ombro"},
    {"name":"Face Pull","category":"Ombro"},{"name":"Remada Alta Ombro","category":"Ombro"},
    {"name":"Encolhimento Barra","category":"Ombro"},{"name":"Encolhimento Halteres","category":"Ombro"},
    {"name":"Lateral Inclinado","category":"Ombro"},
    {"name":"Rosca Direta","category":"Biceps"},{"name":"Rosca Alternada","category":"Biceps"},
    {"name":"Rosca Martelo","category":"Biceps"},{"name":"Rosca Concentrada","category":"Biceps"},
    {"name":"Rosca Barra W","category":"Biceps"},{"name":"Biceps Scott Alta","category":"Biceps"},
    {"name":"Rosca Maquina","category":"Biceps"},{"name":"Rosca Cabo","category":"Biceps"},
    {"name":"Rosca Polia","category":"Biceps"},{"name":"Rosca Inclinada","category":"Biceps"},
    {"name":"Rosca Spider","category":"Biceps"},{"name":"Rosca Inversa","category":"Biceps"},
    {"name":"Rosca Simultanea","category":"Biceps"},{"name":"Rosca 21","category":"Biceps"},
    {"name":"Rosca Cross","category":"Biceps"},
    {"name":"Triceps Barra W","category":"Triceps"},{"name":"Triceps Polia","category":"Triceps"},
    {"name":"Triceps Corda","category":"Triceps"},{"name":"Triceps Barra Reta","category":"Triceps"},
    {"name":"Triceps Maquina","category":"Triceps"},{"name":"Triceps Frances","category":"Triceps"},
    {"name":"Triceps Testa","category":"Triceps"},{"name":"Triceps Overhead","category":"Triceps"},
    {"name":"Extensao Unilateral","category":"Triceps"},{"name":"Triceps Banco","category":"Triceps"},
    {"name":"Mergulho","category":"Triceps"},{"name":"Kickback","category":"Triceps"},
    {"name":"Coice Cabo","category":"Triceps"},{"name":"Triceps Supino Fechado","category":"Triceps"},
    {"name":"Triceps JM Press","category":"Triceps"},
    {"name":"Agachamento Livre","category":"Perna"},{"name":"Agachamento Hack","category":"Perna"},
    {"name":"Agachamento Sumo","category":"Perna"},{"name":"Agachamento Bulgaro","category":"Perna"},
    {"name":"Leg Press","category":"Perna"},{"name":"Leg Press 45","category":"Perna"},
    {"name":"Extensora","category":"Perna"},{"name":"Cadeira Flexora","category":"Perna"},
    {"name":"Flexora em Pe","category":"Perna"},{"name":"Stiff","category":"Perna"},
    {"name":"Afundo","category":"Perna"},{"name":"Adutora","category":"Perna"},
    {"name":"Abdutora","category":"Perna"},{"name":"Panturrilha Sentado","category":"Perna"},
    {"name":"Panturrilha em Pe","category":"Perna"},
    {"name":"Hip Thrust","category":"Gluteo"},{"name":"Hip Thrust Haltere","category":"Gluteo"},
    {"name":"Ponte Gluteo","category":"Gluteo"},{"name":"Gluteo Maquina","category":"Gluteo"},
    {"name":"Donkey Kick","category":"Gluteo"},{"name":"Coice Perna Cabo","category":"Gluteo"},
    {"name":"Extensao Quadril","category":"Gluteo"},{"name":"Abducao em Pe Cabo","category":"Gluteo"},
    {"name":"Step Up","category":"Gluteo"},{"name":"Agachamento Sumo Gluteo","category":"Gluteo"},
    {"name":"Passada Lateral","category":"Gluteo"},{"name":"Afundo Reverso","category":"Gluteo"},
    {"name":"Elevacao Quadril Unilateral","category":"Gluteo"},{"name":"Abdutora Maquina","category":"Gluteo"},
    {"name":"Agachamento Bulgaro Gluteo","category":"Gluteo"},
    {"name":"Abdominal Crunches","category":"Abdomen"},{"name":"Abdominal Maquina","category":"Abdomen"},
    {"name":"Abdominal Remador","category":"Abdomen"},{"name":"Abdominal Obliquo","category":"Abdomen"},
    {"name":"Prancha","category":"Abdomen"},{"name":"Elevacao de Pernas","category":"Abdomen"},
    {"name":"Joelho ao Peito","category":"Abdomen"},{"name":"Russian Twist","category":"Abdomen"},
    {"name":"Roda Abdominal","category":"Abdomen"},{"name":"Crunch Polia","category":"Abdomen"},
    {"name":"Mountain Climber","category":"Abdomen"},{"name":"Hollow Body","category":"Abdomen"},
    {"name":"Abdominal V","category":"Abdomen"},{"name":"Vacuum","category":"Abdomen"},
    {"name":"Dragon Flag","category":"Abdomen"},
    {"name":"Esteira","category":"Cardio"},{"name":"Bicicleta Ergometrica","category":"Cardio"},
    {"name":"Eliptico","category":"Cardio"},{"name":"Remo Ergometrico","category":"Cardio"},
    {"name":"Corda Naval","category":"Cardio"},{"name":"Pular Corda","category":"Cardio"},
    {"name":"Burpee","category":"Cardio"},{"name":"Jumping Jack","category":"Cardio"},
    {"name":"Sprint","category":"Cardio"},{"name":"Step Machine","category":"Cardio"},
    {"name":"Box Jump","category":"Cardio"},{"name":"Kettlebell Swing","category":"Cardio"},
    {"name":"Skipping","category":"Cardio"},{"name":"Corrida HIIT","category":"Cardio"},
    {"name":"Escada","category":"Cardio"}
  ]';
  ex jsonb;
begin
  for ex in select * from jsonb_array_elements(exercises) loop
    insert into machines (user_id, name, category)
    values (uid, ex->>'name', ex->>'category')
    on conflict do nothing;
  end loop;
end;
$$ language plpgsql security definer;

-- ============================================================
-- DEFAULT ROUTINE (Pull/Push/Leg/Upper/Leg2)
-- Called via: select create_default_routine();
-- ============================================================
create or replace function create_default_routine()
returns void as $$
declare
  uid uuid := auth.uid();
  day_id uuid;
  mid uuid;
  routine_def jsonb := '{
    "1": {"label": "Pull", "exercises": [
      ["Remada T Bar",2,6,9],["Remada Alta",2,6,9],["Puxador Frontal",2,6,9],
      ["Posterior de Ombro",2,6,9],["Biceps Scott Alta",2,6,9]
    ]},
    "2": {"label": "Push", "exercises": [
      ["Supino Inclinado",2,6,9],["Voador Maquina",2,6,9],["Frontal Ombro",2,6,9],
      ["Lateral Ombro",2,6,9],["Triceps Barra W",2,6,9]
    ]},
    "3": {"label": "Leg", "exercises": [
      ["Extensora",2,6,9],["Agachamento Hack",2,6,9],["Cadeira Flexora",2,6,9],
      ["Flexora em Pe",2,6,9],["Adutora",2,6,9],["Panturrilha Sentado",2,6,9]
    ]},
    "5": {"label": "Upper", "exercises": [
      ["Supino Pegada Neutra",2,6,9],["Remada T Bar",2,6,9],["Lateral Ombro",2,6,9],
      ["Frontal Ombro",2,6,9],["Biceps Scott Alta",2,6,9],["Triceps Barra W",2,6,9]
    ]},
    "6": {"label": "Lower", "exercises": [
      ["Extensora",2,6,9],["Agachamento Hack",2,6,9],["Cadeira Flexora",2,6,9],
      ["Flexora em Pe",2,6,9],["Abdutora",2,6,9],["Panturrilha em Pe",2,6,9]
    ]}
  }';
  dow text;
  day_data jsonb;
  ex jsonb;
  i int;
begin
  for dow, day_data in select * from jsonb_each(routine_def) loop
    -- Skip if day already exists
    if exists (select 1 from routine_days where user_id = uid and day_of_week = dow::int) then
      continue;
    end if;

    insert into routine_days (user_id, day_of_week, label)
    values (uid, dow::int, day_data->>'label')
    returning id into day_id;

    i := 0;
    for ex in select * from jsonb_array_elements(day_data->'exercises') loop
      select id into mid from machines
      where user_id = uid and name = ex->>0
      limit 1;

      if mid is not null then
        insert into routine_exercises (routine_day_id, machine_id, sets, reps, reps_max, sort_order)
        values (day_id, mid, (ex->>1)::int, (ex->>2)::int, (ex->>3)::int, i);
        i := i + 1;
      end if;
    end loop;
  end loop;
end;
$$ language plpgsql security definer;

-- ============================================================
-- SETUP NOTES:
-- 1. Execute este SQL no SQL Editor do Supabase
-- 2. Em Authentication > Providers > Email, desabilite "Confirm email"
-- 3. Copie URL e anon key de Settings > API para o .env do frontend
-- ============================================================
