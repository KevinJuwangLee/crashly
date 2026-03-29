-- Trip-request messages store JSON in content and set is_trip_request = true.
alter table public.messages
  add column if not exists is_trip_request boolean not null default false;
