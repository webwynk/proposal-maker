create table if not exists public.activity_logs (
  id bigserial primary key,
  actor_id bigint null references public.users(id) on delete set null,
  client_id bigint not null references public.users(id) on delete cascade,
  project_id bigint null references public.projects(id) on delete cascade,
  invoice_id bigint null references public.invoices(id) on delete set null,
  proposal_id bigint null references public.proposals(id) on delete set null,
  event_type text not null,
  title text not null,
  description text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_client_created
  on public.activity_logs(client_id, created_at desc);

create index if not exists idx_activity_logs_project_created
  on public.activity_logs(project_id, created_at desc);
