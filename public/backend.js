"use strict";
/* Couche d'accès aux données : Supabase (auth + table docs). Session conservée dans le navigateur
   et renouvelée automatiquement : on reste connecté. */
const sb = window.supabase.createClient(window.CONTRECHAMP.url, window.CONTRECHAMP.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "contrechamp-auth" }
});

const PAGE = 1000;
async function fetchAll(name) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from("docs").select("id,data").eq("collection", name)
      .order("id").range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}
const wrapErr = e => { const err = new Error(e.message || "erreur"); err.code = e.code === "42501" ? "invalid_argument" : (e.code || "unknown"); return err; };

const db = {
  collection(name) {
    return {
      onSnapshot(cb, onErr) {
        let busy = false, again = false;
        const load = async () => {
          if (busy) { again = true; return; }
          busy = true;
          try {
            const rows = await fetchAll(name);
            cb({ docs: rows.map(r => ({ id: r.id, data: () => r.data })) });
          } catch (e) { if (onErr) onErr(e); }
          busy = false;
          if (again) { again = false; load(); }
        };
        load();
        sb.channel("docs-" + name)
          .on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: "collection=eq." + name }, load)
          .subscribe();
        document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
      },
      doc(id) {
        return {
          async set(data) {
            const { error } = await sb.from("docs").upsert({ collection: name, id, data }, { onConflict: "collection,id" });
            if (error) throw wrapErr(error);
          },
          async delete() {
            const { error } = await sb.from("docs").delete().eq("collection", name).eq("id", id);
            if (error) throw wrapErr(error);
          }
        };
      },
      add(data) { return this.doc(crypto.randomUUID()).set(data); }
    };
  }
};

const users = {
  async profiles(ids) {
    const { data, error } = await sb.from("profiles").select("id,name,avatar_url").in("id", ids);
    if (error) throw error;
    const out = {};
    data.forEach(p => { out[p.id] = { name: p.name, avatarUrl: p.avatar_url || null }; });
    return out;
  }
};
