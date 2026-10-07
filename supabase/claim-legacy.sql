-- À lancer une fois, après l'inscription du propriétaire (remplacer l'email).
-- Rattache les 63 notes de l'ancienne version à son compte.
insert into public.docs (collection, id, owner, data)
select 'entries', u.id::text || '__' || l.film, u.id, l.data || jsonb_build_object('uid', u.id::text)
from public.legacy_entries l
cross join (select id from auth.users where email = 'REMPLACER@EMAIL') u
on conflict do nothing;
