drop table if exists public.legacy_entries;
delete from public.docs where collection in ('films','passeurs') and owner is null;
