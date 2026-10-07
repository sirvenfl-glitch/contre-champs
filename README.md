# Contrechamp

Ciné-club : catalogue de classiques à (ré)apprendre, carnet de notes partagé entre amis.

- Front statique dans `public/` (aucun build).
- Auth et données : Supabase (email + mot de passe, session conservée et renouvelée automatiquement).
- Hébergement : Vercel (`outputDirectory: public`).
- Schéma : `supabase/migrations/` (rollback : `001_init.down.sql`).

Les droits sont tenus par les règles RLS de la table `docs` : chacun n'écrit que ses propres notes, films ajoutés et vidéos. La table `passeurs` est en lecture seule depuis l'app.
