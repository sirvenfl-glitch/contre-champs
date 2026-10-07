-- Reprise des données de l'ancienne version (jeton dans le lien). Anciennes tables laissées intactes.
insert into public.docs (collection, id, owner, data)
select 'films', id, null,
  jsonb_strip_nulls(jsonb_build_object('t',title,'y',year,'d',director,'c',cat,'w',why,'l',look,'o',orig,'ts',(extract(epoch from created_at)*1000)::bigint))
from public.films
on conflict do nothing;

insert into public.docs (collection, id, owner, data)
select 'passeurs', id, null, jsonb_build_object('name',name,'pitch',pitch,'url',url,'order',ord)
from public.passeurs
on conflict do nothing;

create table public.legacy_entries (film text primary key, data jsonb not null);
alter table public.legacy_entries enable row level security;
insert into public.legacy_entries (film, data)
select e.film, jsonb_build_object('film',e.film,'status',e.status,'rating',e.rating,'mp',coalesce(e.mp,false),'marque',coalesce(e.marque,''),'note',coalesce(e.note,''),'ts',(extract(epoch from e.updated_at)*1000)::bigint)
from public.entries e join public.members m on m.id = e.member_id and m.is_owner;
