create type public.org_role as enum ('admin','financial_manager','auditor','employee');
create type public.risk_level as enum ('LOW','MEDIUM','HIGH','CRITICAL');
create type public.alert_status as enum ('open','investigating','pending_review','resolved','dismissed');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_currency text not null default 'ZAR',
  approval_limit numeric not null default 50000,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
grant select, update on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role public.org_role not null,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
grant select, update, delete on public.org_members to authenticated;
grant all on public.org_members to service_role;
alter table public.org_members enable row level security;

create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.org_role not null,
  invited_by uuid not null,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);
grant select, insert, delete on public.org_invites to authenticated;
grant all on public.org_invites to service_role;
alter table public.org_invites enable row level security;

create or replace function public.is_org_member(_org uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_members where org_id = _org and user_id = _user)
$$;

create or replace function public.has_org_role(_org uuid, _user uuid, _roles public.org_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_members where org_id = _org and user_id = _user and role = any(_roles))
$$;

create policy "members read org" on public.organizations for select to authenticated using (public.is_org_member(id, auth.uid()));
create policy "admins update org" on public.organizations for update to authenticated using (public.has_org_role(id, auth.uid(), array['admin']::public.org_role[]));

create policy "members read members" on public.org_members for select to authenticated using (public.is_org_member(org_id, auth.uid()));
create policy "admins update members" on public.org_members for update to authenticated using (public.has_org_role(org_id, auth.uid(), array['admin']::public.org_role[]) and user_id <> auth.uid());
create policy "admins delete members" on public.org_members for delete to authenticated using (public.has_org_role(org_id, auth.uid(), array['admin']::public.org_role[]) and user_id <> auth.uid());

create policy "admins read invites" on public.org_invites for select to authenticated using (public.has_org_role(org_id, auth.uid(), array['admin']::public.org_role[]));
create policy "admins create invites" on public.org_invites for insert to authenticated with check (public.has_org_role(org_id, auth.uid(), array['admin']::public.org_role[]) and invited_by = auth.uid());
create policy "admins delete invites" on public.org_invites for delete to authenticated using (public.has_org_role(org_id, auth.uid(), array['admin']::public.org_role[]));

create or replace function public.create_organization(_name text, _currency text default 'ZAR')
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if coalesce(trim(_name),'') = '' then raise exception 'Name required'; end if;
  insert into public.organizations(name, base_currency, created_by) values (trim(_name), coalesce(_currency,'ZAR'), auth.uid()) returning id into _id;
  insert into public.org_members(org_id, user_id, role, email) values (_id, auth.uid(), 'admin', auth.jwt()->>'email');
  return _id;
end $$;

create or replace function public.accept_pending_invites()
returns integer language plpgsql security definer set search_path = public as $$
declare _email text; _n integer := 0;
begin
  if auth.uid() is null then return 0; end if;
  select email into _email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if _email is null then return 0; end if;
  insert into public.org_members(org_id, user_id, role, email)
    select org_id, auth.uid(), role, _email from public.org_invites where lower(email) = lower(_email)
    on conflict (org_id, user_id) do nothing;
  get diagnostics _n = row_count;
  delete from public.org_invites where lower(email) = lower(_email);
  return _n;
end $$;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  txn_date date not null,
  amount numeric(18,2) not null check (amount >= 0),
  currency text not null default 'ZAR',
  direction text not null default 'outflow' check (direction in ('outflow','inflow')),
  payment_method text,
  frequency text not null default 'once',
  employee text,
  counterparty text not null,
  counterparty_type text not null default 'supplier' check (counterparty_type in ('supplier','customer')),
  invoice_ref text,
  reference text,
  description text,
  source text not null default 'manual',
  risk_score integer not null default 0,
  risk_level public.risk_level,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index on public.transactions(org_id, txn_date);
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "staff read all txns" on public.transactions for select to authenticated using (public.has_org_role(org_id, auth.uid(), array['admin','financial_manager','auditor']::public.org_role[]));
create policy "employees read own txns" on public.transactions for select to authenticated using (created_by = auth.uid() and public.is_org_member(org_id, auth.uid()));
create policy "writers insert txns" on public.transactions for insert to authenticated with check (created_by = auth.uid() and public.has_org_role(org_id, auth.uid(), array['admin','financial_manager','employee']::public.org_role[]));
create policy "managers update txns" on public.transactions for update to authenticated using (public.has_org_role(org_id, auth.uid(), array['admin','financial_manager']::public.org_role[]));
create policy "admins delete txns" on public.transactions for delete to authenticated using (public.has_org_role(org_id, auth.uid(), array['admin']::public.org_role[]));

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  transaction_id uuid references public.transactions(id) on delete cascade,
  related_ids uuid[] not null default '{}',
  alert_type text not null,
  risk_level public.risk_level not null,
  score integer not null,
  title text not null,
  evidence jsonb not null default '{}',
  status public.alert_status not null default 'open',
  owner text,
  created_at timestamptz not null default now()
);
create index on public.alerts(org_id, created_at);
grant select, update on public.alerts to authenticated;
grant all on public.alerts to service_role;
alter table public.alerts enable row level security;
create policy "staff read alerts" on public.alerts for select to authenticated using (public.has_org_role(org_id, auth.uid(), array['admin','financial_manager','auditor']::public.org_role[]));
create policy "managers update alerts" on public.alerts for update to authenticated using (public.has_org_role(org_id, auth.uid(), array['admin','financial_manager']::public.org_role[]));