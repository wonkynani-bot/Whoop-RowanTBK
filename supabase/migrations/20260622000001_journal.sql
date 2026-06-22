create table if not exists journal_entries (
  id         serial primary key,
  date       date not null unique,
  content    text not null default '',
  updated_at timestamptz default now()
);
