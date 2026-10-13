-- MOUNT TOP initial schema for Supabase. Review before production use.
-- Run in Supabase Dashboard > SQL Editor. Never expose service_role or Paystack secret keys.

create extension if not exists pgcrypto;

create table if not exists public.wallet_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_kobo bigint not null default 0 check (balance_kobo >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reference text unique not null,
  amount_kobo bigint not null check (amount_kobo > 0),
  transaction_type text not null check (transaction_type in ('deposit','purchase','refund','adjustment')),
  status text not null default 'pending' check (status in ('pending','successful','failed')),
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_type text not null check (length(service_type) between 2 and 100),
  full_name text not null check (length(full_name) between 2 and 100),
  email text not null,
  phone text not null check (length(phone) between 5 and 20),
  details text not null check (length(details) between 10 and 4000),
  attachment_path text,
  status text not null default 'received' check (status in ('received','reviewing','in_progress','completed','rejected')),
  created_at timestamptz not null default now()
);

alter table public.wallet_balances enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.service_requests enable row level security;

drop policy if exists "Users can read their own wallet" on public.wallet_balances;
create policy "Users can read their own wallet" on public.wallet_balances for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read their own transactions" on public.wallet_transactions;
create policy "Users can read their own transactions" on public.wallet_transactions for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read their own requests" on public.service_requests;
create policy "Users can read their own requests" on public.service_requests for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can create their own requests" on public.service_requests;
create policy "Users can create their own requests" on public.service_requests for insert to authenticated with check (auth.uid() = user_id);

-- Do not create client insert/update policies for wallet_balances or wallet_transactions.
-- Only trusted server-side functions with secret credentials should credit wallets.
-- Create a private storage bucket named service-attachments in Storage, then apply policies:
-- allow authenticated users to upload only to a first folder equal to auth.uid()::text;
-- allow users to read only their own folder. Do not make sensitive uploads public.
-- Create a balance row automatically for every new user.
create or replace function public.create_wallet_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.wallet_balances(user_id,balance_kobo) values (new.id,0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_wallet on auth.users;
create trigger on_auth_user_created_wallet after insert on auth.users
for each row execute procedure public.create_wallet_for_new_user();

-- Optional backfill for accounts created before this trigger:
insert into public.wallet_balances(user_id,balance_kobo)
select id,0 from auth.users on conflict (user_id) do nothing;
