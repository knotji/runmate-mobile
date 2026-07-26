create table if not exists public.workout_routes (
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id text not null,
  source text not null default 'samsung_gpx',
  route_points jsonb not null,
  start_time timestamptz,
  end_time timestamptz,
  distance_km numeric,
  original_point_count integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, workout_id),
  constraint workout_routes_points_array check (jsonb_typeof(route_points) = 'array'),
  constraint workout_routes_point_count check (original_point_count >= 2)
);

alter table public.workout_routes enable row level security;

create policy "Users can read their own workout routes"
  on public.workout_routes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own workout routes"
  on public.workout_routes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own workout routes"
  on public.workout_routes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own workout routes"
  on public.workout_routes for delete
  using (auth.uid() = user_id);
