-- Token storage for server-side cron access (single row, id=1)
create table if not exists whoop_tokens (
  id            serial primary key,
  access_token  text not null,
  refresh_token text not null,
  expires_at    bigint not null,
  updated_at    timestamptz default now()
);

-- Daily Whoop metrics (one row per date)
create table if not exists whoop_data (
  id               serial primary key,
  date             date not null unique,
  hrv              numeric,
  recovery_score   numeric,
  sleep_score      numeric,
  strain           numeric,
  respiratory_rate numeric,
  created_at       timestamptz default now()
);

-- Manual food logs
create table if not exists food_logs (
  id         serial primary key,
  date       date not null,
  meal_name  text not null,
  protein    numeric,
  carbs      numeric,
  fats       numeric,
  calories   numeric,
  notes      text,
  created_at timestamptz default now()
);

-- AI-generated daily coach cards (one row per date)
create table if not exists coach_cards (
  id            serial primary key,
  date          date not null unique,
  whoop_summary jsonb,
  food_summary  jsonb,
  brief         text not null,
  created_at    timestamptz default now()
);
