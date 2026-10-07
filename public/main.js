"use strict";
/* Connexion + démarrage */
const authEl = document.getElementById("auth");
const appEls = [document.querySelector(".appbar"), document.getElementById("main"), document.getElementById("bottomnav")];
let started = false, mode = "login";

function showApp(on) {
  appEls.forEach(e => { e.hidden = !on; });
  authEl.hidden = on;
}
function authMsg(msg, err) { const s = document.getElementById("authSt"); s.textContent = msg || ""; s.className = "status" + (err ? " err" : ""); }
function setMode(m) {
  mode = m;
  const signup = m === "signup", recover = m === "recover", reset = m === "reset";
  document.getElementById("authTitle").textContent = signup ? "Créer ton compte" : reset ? "Nouveau mot de passe" : recover ? "Mot de passe oublié" : "Se connecter";
  document.getElementById("rowName").hidden = !signup;
  document.getElementById("rowEmail").hidden = reset;
  document.getElementById("rowPass").hidden = recover;
  document.getElementById("authGo").textContent = signup ? "Créer le compte" : reset ? "Enregistrer" : recover ? "Envoyer le lien" : "Entrer";
  document.getElementById("toSignup").hidden = signup || recover || reset;
  document.getElementById("toLogin").hidden = m === "login" || reset;
  document.getElementById("toRecover").hidden = m !== "login";
  document.getElementById("aPass").autocomplete = signup || reset ? "new-password" : "current-password";
  authMsg("");
}
const MSG = {
  "Invalid login credentials": "Email ou mot de passe incorrect.",
  "Email not confirmed": "Confirme d'abord ton email avec le lien reçu.",
  "User already registered": "Ce compte existe déjà. Connecte-toi."
};
const explain = e => MSG[e.message] || (/rate limit/i.test(e.message) ? "Trop d'essais. Réessaie dans quelques minutes." : e.message || "Une erreur est survenue.");

async function submitAuth(ev) {
  ev.preventDefault();
  const email = document.getElementById("aEmail").value.trim(), password = document.getElementById("aPass").value;
  const name = document.getElementById("aName").value.trim();
  const btn = document.getElementById("authGo"); btn.disabled = true; authMsg("…");
  try {
    if (mode === "login") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else if (mode === "signup") {
      if (password.length < 8) throw new Error("8 caractères minimum pour le mot de passe.");
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name: name || email.split("@")[0] } } });
      if (error) throw error;
      if (!data.session) authMsg("Compte créé. Regarde ta boîte mail pour confirmer, puis connecte-toi.");
    } else if (mode === "recover") {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
      if (error) throw error;
      authMsg("Lien envoyé. Ouvre-le depuis cet appareil.");
    } else if (mode === "reset") {
      if (password.length < 8) throw new Error("8 caractères minimum pour le mot de passe.");
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      authMsg("Mot de passe changé.");
      const { data } = await sb.auth.getSession(); if (data.session) start(data.session);
    }
  } catch (e) { authMsg(explain(e), true); }
  btn.disabled = false;
}

async function logout() { await sb.auth.signOut(); location.reload(); }

async function refreshProfiles() {
  const ids = [...new Set([...S.entries.values()].map(e => e.uid).concat([S.uid]))].filter(Boolean);
  if (ids.length) S.profiles = await users.profiles(ids);
}
function sheetBusy() { return $("#dlg").open && document.activeElement && document.activeElement.closest && document.activeElement.closest("#sheet"); }

async function start(session) {
  if (started) return;
  started = true;
  S.db = db; S.user = users; S.uid = session.user.id; S.canWrite = true; S.ready = true;
  showApp(true);
  $("#brandStrip").innerHTML = Object.values(CATS).map(c => `<b style="background:${c.c}"></b>`).join("");
  render();
  db.collection("entries").onSnapshot(async snap => {
    const m = new Map(); snap.docs.forEach(d => { const v = d.data(); if (v && v.uid && v.film) m.set(d.id, v); });
    S.entries = m; await refreshProfiles(); softRender();
    if ($("#dlg").open && draft && byId(draft.film) && !sheetBusy()) renderSheet(byId(draft.film));
  }, () => {});
  db.collection("films").onSnapshot(snap => {
    S.custom = snap.docs.map(d => { const v = d.data() || {}; return { id: d.id, t: String(v.t || "Sans titre"), o: "", y: Number(v.y) || 0, d: String(v.d || ""), c: CATS[v.c] ? v.c : "drame", w: String(v.w || ""), l: "", r: "", n: false, custom: true }; });
    softRender();
  }, () => {});
  db.collection("videos").onSnapshot(snap => {
    S.videos = snap.docs.map(d => d.data() || {}).filter(v => v.film && v.url);
    if (S.view === "passeurs") fillPasseurs();
    if ($("#dlg").open && draft && byId(draft.film) && !sheetBusy()) renderSheet(byId(draft.film));
  }, () => {});
  db.collection("passeurs").onSnapshot(snap => {
    S.passeurs = snap.docs.map(d => d.data() || {}).sort((a, b) => (a.order || 0) - (b.order || 0));
    if (S.view === "passeurs") fillPasseurs();
  }, () => {});
}

async function boot() {
  authEl.querySelector("form").addEventListener("submit", submitAuth);
  document.getElementById("toSignup").onclick = () => setMode("signup");
  document.getElementById("toLogin").onclick = () => setMode("login");
  document.getElementById("toRecover").onclick = () => setMode("recover");
  document.getElementById("authBrand").innerHTML = Object.values(CATS).map(c => `<b style="background:${c.c}"></b>`).join("");
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === "PASSWORD_RECOVERY") { showApp(false); setMode("reset"); }
    else if (ev === "SIGNED_IN" && session && mode !== "reset") start(session);
    else if (ev === "SIGNED_OUT" && started) location.reload();
  });
  const { data } = await sb.auth.getSession();
  if (data.session) start(data.session); else { showApp(false); setMode("login"); }
}
boot();
