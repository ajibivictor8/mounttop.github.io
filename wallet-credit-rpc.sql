-- Run in Supabase SQL Editor. This RPC should only be executable by service_role.
create or replace function public.credit_wallet_from_verified_deposit(p_reference text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tx public.wallet_transactions%rowtype;
begin
  select * into tx from public.wallet_transactions
  where reference = p_reference for update;
  if not found then raise exception 'Transaction not found'; end if;
  if tx.transaction_type <> 'deposit' then raise exception 'Not a deposit'; end if;
  if tx.status = 'successful' then return; end if;
  if tx.status <> 'pending' then raise exception 'Transaction is not pending'; end if;
  update public.wallet_balances
    set balance_kobo = balance_kobo + tx.amount_kobo, updated_at = now()
    where user_id = tx.user_id;
  if not found then raise exception 'Wallet not found'; end if;
  update public.wallet_transactions set status = 'successful' where id = tx.id;
end;
$$;
revoke all on function public.credit_wallet_from_verified_deposit(text) from public, anon, authenticated;
grant execute on function public.credit_wallet_from_verified_deposit(text) to service_role;
