-- The trigger function must never be called directly.
revoke execute on function public.handle_user_phone() from public, anon, authenticated;
-- RLS helpers: only signed-in users need them (they only reveal the caller's own role / client id).
revoke execute on function public.is_coach() from public, anon;
revoke execute on function public.my_client_id() from public, anon;
grant execute on function public.is_coach() to authenticated;
grant execute on function public.my_client_id() to authenticated;
