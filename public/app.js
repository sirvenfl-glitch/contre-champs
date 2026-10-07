"use strict";
const S = {
  db:null,user:null,uid:null,isOwner:false,canWrite:false,ready:false,
  entries:new Map(),custom:[],videos:[],passeurs:[],profiles:{},
  view:"discover",catKey:"",q:"",sort:"score",mark:"",seenFilter:"",cat:"",featIdx:0
};
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=r=>(Math.round(r*100)/100).toString().replace(".",",");
const allFilms=()=>CATALOG.concat(S.custom);
const byId=id=>allFilms().find(f=>f.id===id);
const ekey=(u,f)=>`${u}__${f}`;
const myEntry=fid=>S.uid?S.entries.get(ekey(S.uid,fid)):null;
const filmEntries=fid=>[...S.entries.values()].filter(e=>e.film===fid);
const cat=f=>CATS[f.c]||CATS.drame;
const seen=fid=>{const e=myEntry(fid);return !!(e&&e.status==="vu");};

function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let x=seed||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return ((x>>>0)%10000)/10000;};}

/* Affiches générées : une composition géométrique par film, dérivée de son identifiant */
function motif(f){
  const k=cat(f), R=rng(hash(f.id)), m=hash(f.id+"m")%8, fg=k.f;
  const dk="rgba(0,0,0,.2)", lt="rgba(255,255,255,.22)";
  const cx=70+R()*60, cy=95+R()*40;
  switch(m){
    case 0: return `<rect x="0" y="${150+R()*30}" width="200" height="150" fill="${dk}"/><circle cx="${cx}" cy="${cy}" r="${48+R()*22}" fill="${fg}" opacity=".92"/>`;
    case 1: {const a=R()*80;return `<polygon points="0,${40+a} 200,${a} 200,${70+a} 0,${110+a}" fill="${fg}" opacity=".9"/><polygon points="0,${130+a} 200,${90+a} 200,${104+a} 0,${144+a}" fill="${dk}"/>`;}
    case 2: {let s="";for(let i=0;i<5;i++)s+=`<circle cx="${cx}" cy="${cy}" r="${16+i*16}" fill="none" stroke="${i%2?dk:fg}" stroke-width="7" opacity=".9"/>`;return s;}
    case 3: {let s="";for(let i=0;i<7;i++){const w=40+R()*150;s+=`<rect x="0" y="${24+i*24}" width="${w}" height="14" fill="${i%3===2?dk:fg}" opacity=".9"/>`;}return s;}
    case 4: return `<rect x="${100+R()*40}" y="0" width="120" height="300" fill="${dk}"/><circle cx="${cx}" cy="${cy}" r="${22+R()*18}" fill="${fg}"/><rect x="18" y="${cy+50}" width="80" height="6" fill="${fg}"/>`;
    case 5: {let s="";for(let x=0;x<6;x++)for(let y=0;y<7;y++){const r=2+R()*9;s+=`<circle cx="${22+x*31}" cy="${26+y*27}" r="${r}" fill="${(x+y)%4?fg:dk}" opacity=".85"/>`;}return s;}
    case 6: return `<path d="M20 ${200} A80 80 0 0 1 180 ${200} Z" fill="${fg}" opacity=".9"/><path d="M60 200 A40 40 0 0 1 140 200 Z" fill="${dk}"/><rect x="0" y="0" width="200" height="${40+R()*40}" fill="${lt}"/>`;
    default: return `<polygon points="100,${20+R()*20} ${180},${190} ${20},${190}" fill="${fg}" opacity=".9"/><polygon points="100,${90} 140,190 60,190" fill="${dk}"/>`;
  }
}
function posterHTML(f,opt={}){
  const k=cat(f), len=f.t.length, word=Math.max(...f.t.split(/\s+/).map(w=>w.length));
  const s=Math.min(len<=8?19:len<=14?15:len<=22?12:len<=32?10:8.5, 86/(word*0.5));
  return `<div class="poster" style="--pc:${k.c};--pf:${k.f}" aria-hidden="true">
    <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice">${motif(f)}</svg>
    <div class="top"><span>${f.y||""}</span>${opt.mp?`<span class="ribbon">Chef-d'œuvre</span>`:""}</div>
    <div class="bottom"><div class="pt" style="--s:${s}">${esc(f.t)}</div><div class="pd">${esc(f.d)}</div></div>
  </div>`;
}


function nameFor(uid){ if(uid===S.uid) return "Toi"; return (S.profiles[uid]&&S.profiles[uid].name)||"Un membre"; }
function avatarFor(uid){
  if(S.profiles[uid]&&S.profiles[uid].avatarUrl) return S.profiles[uid].avatarUrl;
  const l=((S.profiles[uid]&&S.profiles[uid].name)||"?").trim().charAt(0).toUpperCase()||"?";
  return "data:image/svg+xml;utf8,"+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='#16181D'/><text x='20' y='27' font-family='Arial' font-weight='700' font-size='18' fill='#FFC914' text-anchor='middle'>${l.replace(/[<>&'"]/g,"?")}</text></svg>`);
}
function scoreOf(e){ if(!e) return -1; if(e.mp) return 6; return typeof e.rating==="number"?e.rating:-0.5; }
function clubScore(fid){
  const es=filmEntries(fid).filter(e=>e.status==="vu"&&(typeof e.rating==="number"||e.mp));
  if(!es.length) return null;
  const v=es.map(e=>e.mp?5:e.rating);
  return {avg:v.reduce((a,b)=>a+b,0)/v.length,n:es.length,mp:es.filter(e=>e.mp).length};
}
const clubMp=fid=>filmEntries(fid).some(e=>e.mp);

/* ---------- ajustement des titres ---------- */
function fitAll(){
  document.querySelectorAll(".pt").forEach(el=>{let s=parseFloat(el.style.getPropertyValue("--s"))||12,n=0;while(el.scrollWidth>el.clientWidth+1&&s>5&&n++<40){s-=.5;el.style.setProperty("--s",s);}});
  document.querySelectorAll(".intro h1,.page-h h1,.feature h2,.head h2").forEach(el=>{el.style.fontSize="";let px=parseFloat(getComputedStyle(el).fontSize),n=0;while(el.scrollWidth>el.clientWidth+1&&px>20&&n++<60){px-=2;el.style.fontSize=px+"px";}});
}
const fit=()=>requestAnimationFrame(fitAll);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit);
addEventListener("resize",fit);

/* ---------- navigation ---------- */
const ICONS={
  discover:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  carnet:'<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  avoir:'<path d="M7 4h10v16l-5-4-5 4z"/>',
  club:'<circle cx="9" cy="9" r="3.2"/><circle cx="16.5" cy="10" r="2.6"/><path d="M3.5 19c.8-3 3-4.6 5.5-4.6S13.7 16 14.5 19"/><path d="M14.5 14.6c2.6-.4 4.8.9 5.6 3.9"/>',
  passeurs:'<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M10.5 9.5v5l4-2.5z"/>'
};
const NAV=[["discover","Découvrir"],["carnet","Mon carnet"],["avoir","À voir"],["club","Le club"],["passeurs","Passeurs"]];
function navRoot(){ return S.view==="cat"?"discover":S.view==="search"?"discover":S.view; }
function renderNav(){
  const r=navRoot();
  $("#topnav").innerHTML=NAV.map(([k,l])=>`<button data-go="${k}" ${r===k?'aria-current="page"':""}>${l}</button>`).join("");
  $("#bottomnav").innerHTML=NAV.map(([k,l])=>`<button data-go="${k}" ${r===k?'aria-current="page"':""}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>${l=="Mon carnet"?"Carnet":l}</button>`).join("");
}
function go(view,key){
  S.view=view; S.catKey=key||""; S.mark=""; S.seenFilter=""; S.cat="";
  if(view!=="search"){S.q="";$("#q").value="";}
  render(); scrollTo({top:0});
}

/* ---------- briques ---------- */
function tileHTML(f,mode){
  const e=myEntry(f.id);
  let left="",sub="";
  if(mode==="club"){
    const c=clubScore(f.id);
    left=c?`<span class="score">${fmt(c.avg)}<small>/5, ${c.n} avis</small></span>`:"";
  } else if(e&&e.status==="vu"){
    left=e.mp?`<span class="mp-tag">Chef-d'œuvre</span>`:(typeof e.rating==="number"?`<span class="score">${fmt(e.rating)}<small>/5</small></span>`:`<span class="state seen">Vu</span>`);
    if(mode==="carnet"&&e.marque) sub=`<div class="mark">${esc(MARKS[e.marque])}</div>`;
  } else if(e&&e.status==="avoir") left=`<span class="state">Dans ta liste</span>`;
  else if(mode==="rail"&&f.n) left=`<span class="state">Récent</span>`;
  const others=filmEntries(f.id).filter(x=>x.uid!==S.uid&&x.status==="vu");
  const faces=others.length?`<span class="faces">${others.slice(0,3).map(x=>`<img alt="" src="${esc(avatarFor(x.uid))}">`).join("")}</span>`:"";
  const line=mode==="reco"&&f.r?`<div class="line">${esc(f.r)}</div>`:"";
  const mp=mode==="club"?clubMp(f.id):!!(e&&e.mp);
  return `<button class="tile" data-open="${esc(f.id)}" aria-label="${esc(f.t)}, ${f.y}">${posterHTML(f,{mp})}<div class="under"><div>${left}${sub}</div>${faces}</div>${line}</button>`;
}
function featured(){
  const pool=[...S.entries.values()].filter(e=>e.status==="vu"&&e.note&&(e.mp||e.marque==="bouleverse")&&byId(e.film)).sort((a,b)=>a.film.localeCompare(b.film)||a.uid.localeCompare(b.uid));
  if(!pool.length) return null;
  return pool[(Math.floor(Date.now()/864e5)+S.featIdx)%pool.length];
}
function featureHTML(){
  const e=featured(); if(!e) return "";
  const f=byId(e.film);
  return `<div class="feature"><div>${posterHTML(f,{mp:e.mp})}</div><div>
    <div class="k">À l'affiche ce soir au club</div>
    <h2>${esc(f.t)}</h2>
    <blockquote>« ${esc(e.note)} »</blockquote>
    <div class="by">${esc(nameFor(e.uid))}, ${e.mp?"chef-d'œuvre":(typeof e.rating==="number"?fmt(e.rating)+"/5":MARKS[e.marque]||"")}</div>
    <div class="acts"><button class="btn" data-open="${esc(f.id)}">Ouvrir la fiche</button><button class="btn ghost" id="nextFeat">Un autre film</button></div>
  </div></div>`;
}
function canonOf(key){ return allFilms().filter(f=>f.c===key).sort((a,b)=>(a.n-b.n)||(a.y-b.y)); }
function shelfHTML(title,tag,films,opts={}){
  if(!films.length) return "";
  return `<section class="shelf"${opts.cc?` style="--cc:${opts.cc}"`:""}>
    <div class="shelf-h"><h2>${opts.cc?"<i></i>":""}${esc(title)}</h2>${opts.key?`<button class="more" data-go="cat" data-key="${opts.key}">Tout voir, ${films.length}</button>`:`<span class="count">${films.length} film${films.length>1?"s":""}</span>`}</div>
    ${tag?`<p class="tag">${esc(tag)}</p>`:""}
    <div class="rail">${films.slice(0,opts.limit||14).map(f=>tileHTML(f,opts.mode||"rail")).join("")}</div>
  </section>`;
}
function noticeHTML(){ return ""; }
function sortList(list,mode){
  const key=f=>mode==="carnet"?scoreOf(myEntry(f.id)):(()=>{const c=clubScore(f.id);return c?c.avg+c.mp*.01:-1;})();
  if(S.sort==="year") list.sort((a,b)=>a.y-b.y);
  else if(S.sort==="title") list.sort((a,b)=>a.t.localeCompare(b.t,"fr"));
  else list.sort((a,b)=>key(b)-key(a)||a.y-b.y);
  return list;
}
const sortSel=()=>`<select class="sort" id="sort" aria-label="Trier"><option value="score"${S.sort==="score"?" selected":""}>Par note</option><option value="year"${S.sort==="year"?" selected":""}>Par année</option><option value="title"${S.sort==="title"?" selected":""}>Par titre</option></select>`;
function catChips(){
  return `<div class="chips"><button class="chip all" aria-pressed="${S.cat===""}" data-cat=""><i></i>Tous genres</button>`+
    Object.entries(CATS).map(([k,v])=>`<button class="chip" style="--cc:${v.c};--cf:${v.f}" aria-pressed="${S.cat===k}" data-cat="${k}"><i></i>${esc(v.l)}</button>`).join("")+`</div>`;
}
const wall=(list,mode,empty)=>`<div class="wall">${list.length?list.map(f=>tileHTML(f,mode)).join(""):`<p class="empty">${esc(empty)}</p>`}</div>`;

/* ---------- écrans ---------- */
function viewDiscover(){
  const recos=allFilms().filter(f=>f.r&&!seen(f.id));
  const total=allFilms().filter(f=>!f.n).length, mine=allFilms().filter(f=>!f.n&&seen(f.id)).length;
  let h=`<div class="intro"><h1>Les classiques</h1><p>${S.uid?`Tu as vu ${mine} des ${total} classiques du ciné-club. `:""}Chaque genre a ses règles. Chaque fiche te dit pourquoi le film compte et quoi regarder de près.</p></div>`;
  h+=noticeHTML()+featureHTML();
  h+=`<section class="shelf"><div class="shelf-h"><h2>Par genre</h2></div><div class="cats">${Object.entries(CATS).map(([k,v])=>{const fs=canonOf(k);const s=fs.filter(f=>seen(f.id)).length;return `<button class="catcard" style="--cc:${v.c};--cf:${v.f}" data-go="cat" data-key="${k}"><b>${esc(v.l)}</b><span>${S.uid?`${s} vus sur ${fs.length}`:`${fs.length} films`}</span></button>`;}).join("")}</div></section>`;
  h+=shelfHTML("Pour toi","Des classiques choisis d'après ce que tu as aimé. Chaque carte dit pourquoi.",recos,{mode:"reco"});
  Object.entries(CATS).forEach(([k,v])=>{ h+=shelfHTML(v.l,v.t,canonOf(k),{cc:v.c,key:k}); });
  return h;
}
function viewCat(){
  const k=S.catKey, v=CATS[k]; if(!v) return viewDiscover();
  let list=canonOf(k);
  const s=list.filter(f=>seen(f.id)).length;
  if(S.seenFilter==="vu") list=list.filter(f=>seen(f.id));
  if(S.seenFilter==="pas") list=list.filter(f=>!seen(f.id));
  return `<div class="page-h" style="--cc:${v.c}"><button class="back" data-go="discover">‹ Découvrir</button><div class="band"></div><h1>${esc(v.l)}</h1><p>${esc(v.t)}</p></div>
    <div class="tools"><div class="pills">${[["","Tous"],["pas","Pas encore vus"],["vu","Vus"]].map(([a,b])=>`<button class="pill" data-seen="${a}" aria-pressed="${S.seenFilter===a}">${b}</button>`).join("")}</div></div>
    <p class="summary">${S.uid?`${s} vus sur ${canonOf(k).length}. `:""}Classés par date : tu suis l'histoire du genre.</p>
    ${wall(list,"cat","Rien dans ce filtre.")}`;
}
function viewSearch(){
  const q=S.q.toLowerCase();
  const list=allFilms().filter(f=>(f.t+" "+f.o+" "+f.d+" "+f.y+" "+cat(f).l).toLowerCase().includes(q)).sort((a,b)=>a.y-b.y);
  return `<div class="page-h"><h1>Recherche</h1><p>${list.length} résultat${list.length>1?"s":""} pour « ${esc(S.q)} »</p></div>${wall(list,"cat","Aucun film ne correspond. Tu peux l'ajouter depuis Mon carnet.")}`;
}
function viewCarnet(){
  if(!S.uid) return `<div class="page-h"><h1>Mon carnet</h1></div>${noticeHTML()||'<p class="notice">Connecte-toi pour avoir ton carnet.</p>'}`;
  const mine=[...S.entries.values()].filter(e=>e.uid===S.uid&&e.status==="vu");
  let list=allFilms().filter(f=>seen(f.id));
  if(S.mark) list=list.filter(f=>myEntry(f.id).marque===S.mark);
  if(S.cat) list=list.filter(f=>f.c===S.cat);
  sortList(list,"carnet");
  return `<div class="page-h"><h1>Mon carnet</h1><p>Ce que tu as vu, noté, et ce que chaque film t'a fait.</p></div>${noticeHTML()}
    <div class="stats"><div class="stat"><b>${mine.length}</b><span>vus</span></div><div class="stat"><b>${mine.filter(e=>e.marque==="bouleverse").length}</b><span>bouleversants</span></div><div class="stat"><b>${mine.filter(e=>e.mp).length}</b><span>chefs-d'œuvre</span></div><div class="stat"><b>${mine.filter(e=>typeof e.rating!=="number"&&!e.mp).length}</b><span>à noter</span></div></div>
    <div class="tools"><div class="pills">${[["","Tout"]].concat(Object.entries(MARKS)).map(([a,b])=>`<button class="pill" data-mark="${a}" aria-pressed="${S.mark===a}">${esc(b)}</button>`).join("")}</div>${sortSel()}${S.canWrite?`<button class="btn" id="addBtn">Ajouter un film</button>`:""}</div>
    ${catChips()}
    ${wall(list,"carnet",S.mark||S.cat?"Aucun film dans ce filtre.":"Ton carnet est vide. Ouvre un classique et donne ta note.")}
    <p class="account">${esc(nameFor(S.uid)==="Toi"?(S.profiles[S.uid]&&S.profiles[S.uid].name)||"":"")} <button type="button" class="clear" id="logout">Se déconnecter</button></p>`;
}
function viewAvoir(){
  let list=allFilms().filter(f=>{const e=myEntry(f.id);return e&&e.status==="avoir";});
  list.sort((a,b)=>a.y-b.y);
  const recos=allFilms().filter(f=>f.r&&!myEntry(f.id));
  return `<div class="page-h"><h1>À voir</h1><p>Ta liste. Ajoute un film depuis sa fiche avec « À voir ».</p></div>${noticeHTML()}
    ${wall(list,"cat","Ta liste est vide pour l'instant.")}
    ${shelfHTML("Idées pour ta liste","Les classiques qui prolongent ce que tu as aimé.",recos,{mode:"reco",limit:20})}`;
}
function viewClub(){
  const rev=[...S.entries.values()].filter(e=>e.status==="vu"&&e.note&&byId(e.film)).sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,8);
  let list=allFilms().filter(f=>filmEntries(f.id).some(e=>e.status==="vu"&&(typeof e.rating==="number"||e.mp)));
  if(S.cat) list=list.filter(f=>f.c===S.cat);
  sortList(list,"club");
  const members=new Set([...S.entries.values()].map(e=>e.uid)).size;
  return `<div class="page-h"><h1>Le club</h1><p>${members} membre${members>1?"s":""} actif${members>1?"s":""}. Les dernières critiques, puis les notes moyennes de tout le monde.</p></div>${noticeHTML()}
    ${rev.length?`<h2 class="sect">Dernières critiques</h2><ul class="reviews">${rev.map(e=>{const f=byId(e.film);return `<li><button class="review" data-open="${esc(f.id)}"><div>${posterHTML(f,{mp:e.mp})}</div><div><span class="who"><img alt="" src="${esc(avatarFor(e.uid))}">${esc(nameFor(e.uid))}${e.mp?", chef-d'œuvre":typeof e.rating==="number"?`, ${fmt(e.rating)}/5`:""}</span><b>${esc(f.t)}</b><p>${esc(e.note)}</p></div></button></li>`;}).join("")}</ul>`:""}
    <h2 class="sect">Le classement du club</h2>
    <div class="tools">${sortSel()}</div>${catChips()}
    ${wall(list,"club","Personne n'a encore rien noté.")}`;
}
function viewPasseurs(){
  return `<div class="page-h"><h1>Les passeurs</h1><p>Les chaînes qui nous apprennent le cinéma, et les vidéos ajoutées sur chaque film.</p></div><div id="passBody"></div>`;
}
function linkEl(href,text){ const a=document.createElement("a");a.href=href;a.target="_blank";a.rel="noopener noreferrer";a.textContent=text;return a; }
function safeYT(u){ try{const x=new URL(u);return x.protocol==="https:"&&/(^|\.)youtube\.com$|^youtu\.be$/.test(x.hostname)?x.href:null;}catch(e){return null;} }
function fillPasseurs(){
  const m=$("#passBody"); if(!m) return; m.innerHTML="";
  const wrap=document.createElement("div"); wrap.className="pass";
  S.passeurs.forEach(p=>{
    const c=document.createElement("div"); c.className="pcard";
    const h=document.createElement("h3"); h.textContent=p.name||"Chaîne";
    const d=document.createElement("p"); d.textContent=p.pitch||"";
    c.append(h,d);
    const u=safeYT(p.url); if(u){const a=linkEl(u,"Voir la chaîne sur YouTube");a.className="btn";c.append(a);}
    wrap.append(c);
  });
  if(!S.passeurs.length){const p=document.createElement("p");p.className="empty";p.textContent="Les chaînes recommandées apparaîtront ici.";m.append(p);} else m.append(wrap);
  const h=document.createElement("h2"); h.className="sect"; h.textContent="Vidéos pour aller plus loin"; m.append(h);
  const vids=S.videos.filter(v=>safeYT(v.url)).sort((a,b)=>(b.ts||0)-(a.ts||0));
  if(!vids.length){const p=document.createElement("p");p.className="empty";p.style.padding="4px 0";p.textContent="Aucune vidéo pour l'instant. Ajoute-en une depuis la fiche d'un film.";m.append(p);return;}
  const ul=document.createElement("ul"); ul.className="vlist";
  vids.forEach(v=>{const f=byId(v.film);const li=document.createElement("li");li.append(linkEl(safeYT(v.url),v.title||"Vidéo YouTube"));const s=document.createElement("span");s.className="f";s.textContent=f?f.t:"";li.append(s);ul.append(li);});
  m.append(ul);
}
function render(){
  renderNav();
  const V={discover:viewDiscover,cat:viewCat,search:viewSearch,carnet:viewCarnet,avoir:viewAvoir,club:viewClub,passeurs:viewPasseurs}[S.view]||viewDiscover;
  $("#main").innerHTML=`<div class="view">${V()}</div>`;
  if(S.view==="passeurs") fillPasseurs();
  fit();
}
function softRender(){ const y=scrollY; renderNav(); const V={discover:viewDiscover,cat:viewCat,search:viewSearch,carnet:viewCarnet,avoir:viewAvoir,club:viewClub,passeurs:viewPasseurs}[S.view]||viewDiscover; $("#main").innerHTML=`<div>${V()}</div>`; if(S.view==="passeurs")fillPasseurs(); fit(); scrollTo({top:y}); }

/* ---------- fiche ---------- */
let draft=null;
function openFilm(fid){
  const f=byId(fid); if(!f) return;
  const e=myEntry(fid);
  draft={film:fid,status:e?e.status:"",rating:e&&typeof e.rating==="number"?e.rating:null,mp:!!(e&&e.mp),marque:e&&e.marque||"",note:e?e.note||"":""};
  renderSheet(f);
  const d=$("#dlg"); if(!d.open) d.showModal();
  $("#sheet").scrollTop=0;
}
function renderSheet(f){
  const k=cat(f);
  const others=filmEntries(f.id).filter(x=>x.uid!==S.uid).sort((a,b)=>scoreOf(b)-scoreOf(a));
  const vids=S.videos.filter(v=>v.film===f.id&&safeYT(v.url));
  const can=S.db&&S.canWrite&&S.uid;
  const mpOk=draft.marque==="bouleverse"||(draft.mp&&!draft.marque);
  $("#sheet").innerHTML=`<div class="grab"></div>
    <div class="head"><div>${posterHTML(f,{mp:!!(myEntry(f.id)&&myEntry(f.id).mp)})}</div><div>
      <h2>${esc(f.t)}</h2>${f.o?`<div class="orig">${esc(f.o)}</div>`:""}
      <div class="meta">${esc(f.d)}, ${f.y}${f.n?". Pas encore un classique":""}</div>
      <button class="catpill" style="--pc:${k.c};--pf:${k.f}" data-go="cat" data-key="${f.c}">${esc(k.l)}</button>
    </div></div>
    ${f.r?`<div class="rec">${esc(f.r)}</div>`:""}
    ${f.w||f.l?`<div class="lesson">${f.w?`<h3>Pourquoi il compte</h3><p>${esc(f.w)}</p>`:""}${f.l?`<h3>À regarder de près</h3><p>${esc(f.l)}</p>`:""}</div>`:""}
    ${can?`<div class="mine"><h3>Ton avis</h3>
      <div class="seg" role="group" aria-label="Statut">
        <button type="button" data-st="vu" aria-pressed="${draft.status==="vu"}">Vu</button>
        <button type="button" data-st="avoir" aria-pressed="${draft.status==="avoir"}">À voir</button>
      </div>
      <div ${draft.status==="vu"?"":"hidden"}>
        <div class="seg" role="group" aria-label="Ce que le film t'a fait">${Object.entries(MARKS).map(([m,l])=>`<button type="button" data-mk="${m}" aria-pressed="${draft.marque===m}">${esc(l)}</button>`).join("")}</div>
        <div class="stepper"><button type="button" data-step="-0.25" aria-label="Baisser la note">−</button><output id="out" aria-live="polite">${draft.rating===null?"Pas noté":fmt(draft.rating)+" / 5"}</output><button type="button" data-step="0.25" aria-label="Monter la note">+</button></div>
        <label class="toggle${mpOk?"":" off"}"><input type="checkbox" id="mp" ${draft.mp&&mpOk?"checked":""} ${mpOk?"":"disabled"}>Chef-d'œuvre</label>
        <div class="hint">Réservé aux films qui t'ont bouleversé.</div>
        <textarea id="note" maxlength="700" placeholder="Ce que le film t'a fait, en quelques lignes">${esc(draft.note)}</textarea>
      </div>
      <div class="actions"><button type="button" class="clear" id="rm" ${myEntry(f.id)?"":"hidden"}>Retirer de mon carnet</button><span class="status" id="st"></span>
        <span style="display:flex;gap:8px"><button type="button" class="btn ghost" id="close">Fermer</button><button type="button" class="btn" id="save">Enregistrer</button></span></div></div>`
    :`<div class="actions"><span></span><button type="button" class="btn ghost" id="close">Fermer</button></div>`}
    <h3>Vidéos pour aller plus loin</h3><ul class="vlist" id="fvids"></ul>
    ${can?`<div><input class="field" id="vUrl" type="url" inputmode="url" placeholder="Lien YouTube"><input class="field" id="vTitle" maxlength="120" placeholder="Titre de la vidéo (facultatif)"><div class="actions"><span class="status" id="vst"></span><button type="button" class="btn ghost" id="vAdd">Ajouter la vidéo</button></div></div>`:""}
    ${others.length?`<h3>Le club</h3><ul class="others" id="others"></ul>`:""}`;
  fit();
  const fv=$("#fvids");
  if(!vids.length){const li=document.createElement("li");li.style.color="var(--muted)";li.textContent="Pas encore de vidéo sur ce film.";fv.append(li);}
  vids.forEach(v=>{const li=document.createElement("li");li.append(linkEl(safeYT(v.url),v.title||"Vidéo YouTube"));fv.append(li);});
  const ul=$("#others");
  if(ul) others.forEach(x=>{
    const li=document.createElement("li");
    const img=document.createElement("img");img.alt="";img.src=avatarFor(x.uid);
    const mid=document.createElement("div");
    const n=document.createElement("div");n.className="n";n.textContent=nameFor(x.uid)+(x.marque?`, ${MARKS[x.marque]||""}`:"");
    const r=document.createElement("div");r.className="r";r.textContent=x.status==="avoir"?"Veut le voir":(x.note||"");
    mid.append(n,r);
    const s=document.createElement("div");s.className="s";
    if(x.status==="vu"){ if(x.mp){s.textContent="Chef-d'œuvre";s.style.cssText="color:var(--gold);font-size:15px;font-family:var(--sans)";} else if(typeof x.rating==="number") s.textContent=fmt(x.rating); }
    li.append(img,mid,s); ul.append(li);
  });
}
const setSt=(id,msg,err)=>{const s=document.getElementById(id);if(s){s.textContent=msg;s.className="status"+(err?" err":"");}};

document.addEventListener("click",ev=>{
  const t=ev.target.closest("[data-open],[data-go],[data-cat],[data-st],[data-mk],[data-mark],[data-seen],[data-step],#close,#save,#rm,#addBtn,#nextFeat,#vAdd,#logout");
  if(!t) return;
  if(t.dataset.open){openFilm(t.dataset.open);return;}
  if(t.dataset.go){ if($("#dlg").open)$("#dlg").close(); go(t.dataset.go,t.dataset.key); return; }
  if(t.dataset.cat!==undefined&&t.classList.contains("chip")){S.cat=t.dataset.cat;softRender();return;}
  if(t.dataset.mark!==undefined){S.mark=t.dataset.mark;softRender();return;}
  if(t.dataset.seen!==undefined){S.seenFilter=t.dataset.seen;softRender();return;}
  if(t.dataset.st){draft.status=t.dataset.st;renderSheet(byId(draft.film));return;}
  if(t.dataset.mk){draft.marque=draft.marque===t.dataset.mk?"":t.dataset.mk;if(draft.marque!=="bouleverse")draft.mp=false;renderSheet(byId(draft.film));return;}
  if(t.dataset.step){const st=parseFloat(t.dataset.step);draft.rating=draft.rating===null?2.5:Math.max(0,Math.min(5,Math.round((draft.rating+st)*4)/4));$("#out").textContent=fmt(draft.rating)+" / 5";return;}
  if(t.id==="close"){$("#dlg").close();return;}
  if(t.id==="save"){saveDraft();return;}
  if(t.id==="rm"){removeEntry();return;}
  if(t.id==="addBtn"){openAdd();return;}
  if(t.id==="nextFeat"){S.featIdx++;softRender();return;}
  if(t.id==="vAdd"){addVideo();return;}
  if(t.id==="logout"){logout();return;}
});
document.addEventListener("change",ev=>{ if(ev.target.id==="mp")draft.mp=ev.target.checked; if(ev.target.id==="sort"){S.sort=ev.target.value;softRender();} });
document.addEventListener("input",ev=>{if(ev.target.id==="note")draft.note=ev.target.value;});
$("#dlg").addEventListener("click",ev=>{if(ev.target===$("#dlg"))$("#dlg").close();});
$("#q").addEventListener("input",ev=>{S.q=ev.target.value.trim(); if(S.q){ if(S.view!=="search"){S.view="search";} softRender(); } else go("discover"); });

async function saveDraft(){
  if(!draft.status){setSt("st","Choisis Vu ou À voir.",true);return;}
  const body={uid:S.uid,film:draft.film,status:draft.status,ts:Date.now()};
  if(draft.status==="vu"){const mp=!!draft.mp&&(draft.marque==="bouleverse"||!draft.marque);body.rating=mp?5:draft.rating;body.mp=mp;body.marque=draft.marque||"";body.note=(draft.note||"").slice(0,700);}
  else{body.rating=null;body.mp=false;body.marque="";body.note="";}
  setSt("st","Enregistrement…");
  try{await S.db.collection("entries").doc(ekey(S.uid,draft.film)).set(body);setSt("st","Enregistré");setTimeout(()=>{if($("#dlg").open)$("#dlg").close();},450);}
  catch(err){ if(err&&err.code==="invalid_argument"){S.canWrite=false;softRender();setSt("st","Tu n'as pas le droit d'écrire dans ce club.",true);} else setSt("st","Échec de l'enregistrement. Réessaie.",true); }
}
async function removeEntry(){ setSt("st","Suppression…"); try{await S.db.collection("entries").doc(ekey(S.uid,draft.film)).delete();$("#dlg").close();}catch(e){setSt("st","Suppression impossible.",true);} }
async function addVideo(){
  const u=safeYT($("#vUrl").value.trim()); const title=$("#vTitle").value.trim().slice(0,120);
  if(!u){setSt("vst","Colle un lien YouTube valide.",true);return;}
  setSt("vst","Ajout…");
  try{await S.db.collection("videos").add({film:draft.film,url:u,title,by:S.uid,ts:Date.now()});setSt("vst","Vidéo ajoutée");$("#vUrl").value="";$("#vTitle").value="";}catch(e){setSt("vst","Ajout impossible.",true);}
}
function openAdd(){
  $("#sheet").innerHTML=`<div class="grab"></div><div class="head" style="grid-template-columns:1fr"><h2>Ajouter un film</h2></div>
    <label class="lbl" for="aT">Titre</label><input class="field" id="aT" maxlength="120" autocomplete="off">
    <label class="lbl" for="aY">Année</label><input class="field" id="aY" inputmode="numeric" maxlength="4">
    <label class="lbl" for="aD">Réalisation</label><input class="field" id="aD" maxlength="120">
    <label class="lbl" for="aC">Genre</label><select class="field" id="aC">${Object.entries(CATS).map(([k,v])=>`<option value="${k}">${esc(v.l)}</option>`).join("")}</select>
    <label class="lbl" for="aW">Pourquoi il compte (facultatif)</label><textarea id="aW" maxlength="400"></textarea>
    <div class="actions"><span class="status" id="st"></span><span style="display:flex;gap:8px"><button type="button" class="btn ghost" id="close">Annuler</button><button type="button" class="btn" id="addSave">Ajouter le film</button></span></div>`;
  if(!$("#dlg").open)$("#dlg").showModal();
  $("#aT").focus(); $("#addSave").onclick=addFilm;
}
async function addFilm(){
  const t=$("#aT").value.trim(),y=parseInt($("#aY").value,10),d=$("#aD").value.trim(),c=$("#aC").value,w=$("#aW").value.trim();
  if(!t){setSt("st","Il manque le titre.",true);return;}
  if(!(y>=1888&&y<=2100)){setSt("st","Année invalide.",true);return;}
  const dup=allFilms().find(f=>f.t.toLowerCase()===t.toLowerCase()&&f.y===y);
  if(dup){openFilm(dup.id);return;}
  const id="u-"+t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40)+"-"+y;
  setSt("st","Ajout…");
  try{
    await S.db.collection("films").doc(id).set({t,y,d:d||"Réalisation inconnue",c,w,by:S.uid,ts:Date.now()});
    S.custom=S.custom.filter(f=>f.id!==id).concat([{id,t,o:"",y,d:d||"Réalisation inconnue",c,w,l:"",r:"",n:false,custom:true}]);
    openFilm(id);
  }catch(e){setSt("st","Ajout impossible.",true);}
}

