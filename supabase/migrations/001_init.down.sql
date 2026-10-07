drop table if exists public.docs;
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.touch_updated_at();
drop table if exists public.profiles;
