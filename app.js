(() => {
"use strict";

/* =====================================================================
   Gaceta Survival · lógica del sitio (Supabase + Discord)
   ===================================================================== */

const CATS = [
  {id:"eventos", name:"Eventos"},
  {id:"construcciones", name:"Construcciones"},
  {id:"comercio", name:"Comercio"},
  {id:"logros", name:"Logros"},
  {id:"novedades", name:"Novedades"},
  {id:"historias", name:"Historias de la comunidad"},
  {id:"reportes", name:"Reportes del servidor"},
];
const catName = id => (CATS.find(c=>c.id===id)||{name:"Sin categoría"}).name;
const STATUS = {pendiente:"Pendiente", info:"Info solicitada", rechazada:"Rechazada", publicada:"Publicada", resuelta:"Resuelta", retirada:"Retirada"};
const VER = {confirmado:"Confirmado", testimonio:"Testimonio"};
const REQ = {correccion:"Corrección", retiro:"Retiro", otro:"Consulta"};
const IMG_TYPES = ["image/png","image/jpeg","image/webp","image/gif"];

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const el = (tag, attrs={}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return n;
};
const fmtDate = s => { if(!s) return ""; const d = new Date(s.length===10? s+"T12:00:00": s); return isNaN(d)? "" : d.toLocaleDateString("es", {day:"numeric", month:"long", year:"numeric"}); };
const fmtDT = s => { const d=new Date(s); return isNaN(d)? "" : d.toLocaleString("es",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); };
const nowISO = () => new Date().toISOString();
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)));
const safeUrl = u => { try { const x = new URL(u); return (x.protocol==="https:"||x.protocol==="http:") ? x.href : null; } catch { return null; } };
const extOf = (type) => ({"image/png":"png","image/jpeg":"jpg","image/webp":"webp","image/gif":"gif"})[type] || "img";
let toastT;
const toast = msg => { const t=$("#toast"); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true, 3600); };
const errMsg = (e, fallback) => (e && e.message && !/fetch/i.test(e.message)) ? e.message : fallback;

/* ---------- Supabase ---------- */
const cfg = window.GACETA_CONFIG || {};
const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && !cfg.supabaseUrl.includes("TU-PROYECTO") && window.supabase);
const sb = configured ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
  auth: { flowType:"pkce", persistSession:true, autoRefreshToken:true, detectSessionInUrl:true },
}) : null;
if (!configured) $("#configBar").hidden = false;

const coverUrl = path => path && sb ? sb.storage.from("portadas").getPublicUrl(path).data.publicUrl : null;
const signedCache = new Map();
async function evidenceUrl(path){
  if (signedCache.has(path)) return signedCache.get(path);
  const p = sb.storage.from("evidencias").createSignedUrl(path, 3600).then(r => r.error ? null : r.data.signedUrl);
  signedCache.set(path, p); return p;
}
function evidenceImg(path, alt){
  const img = el("img",{alt: alt||"Captura enviada", loading:"lazy"});
  evidenceUrl(path).then(u => { if (u) img.src = u; });
  return img;
}

/* ---------- portadas abstractas (si no hay imagen) ---------- */
const PAL = {
  eventos:["#f2c94c","#d9a520","#a8781a","#fff2b0","#6b4a12"],
  construcciones:["#c49464","#8a5a2b","#6a4220","#e7c9a6","#4d2f15"],
  comercio:["#3fbf75","#1f8a52","#17663d","#8be0b0","#0e4428"],
  logros:["#6fe0f0","#2fb8cf","#1b7f95","#c8f6fb","#125566"],
  novedades:["#e5564a","#b23a2f","#7d241d","#f59a90","#541510"],
  historias:["#b88ae0","#8a5cc0","#6a3fa0","#dcc2f5","#432466"],
  reportes:["#9aa3ab","#7a838c","#56606a","#c3cad0","#383f46"],
};
function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
const coverCache = new Map();
function abstractCover(cat, seed){
  const key = cat+"|"+seed; if (coverCache.has(key)) return coverCache.get(key);
  const W=640,H=360,c=document.createElement("canvas"); c.width=W; c.height=H;
  const g=c.getContext("2d"); const p=PAL[cat]||PAL.reportes; let s=hash(seed)||1;
  const rnd=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};
  const bg=g.createLinearGradient(0,0,W,H); bg.addColorStop(0,p[2]); bg.addColorStop(1,p[4]);
  g.fillStyle=bg; g.fillRect(0,0,W,H);
  const n=3+Math.floor(rnd()*3);
  for(let i=0;i<n;i++){
    g.globalAlpha=.18+rnd()*.22; g.fillStyle=[p[0],p[3],p[1]][i%3];
    g.beginPath(); g.arc(rnd()*W, rnd()*H, 60+rnd()*180, 0, Math.PI*2); g.fill();
  }
  g.globalAlpha=.12; g.fillStyle="#ffffff";
  const y0=H*(.55+rnd()*.25); g.beginPath(); g.moveTo(0,y0); g.lineTo(W,y0-80-rnd()*80); g.lineTo(W,H); g.lineTo(0,H); g.fill();
  g.globalAlpha=1;
  const url=c.toDataURL("image/jpeg",.85); coverCache.set(key,url); return url;
}
function coverEl(n){
  const box = el("div",{class:"cover"});
  const img = el("img",{alt:"", loading:"lazy"});
  const fallback = () => { img.src = abstractCover(n.category, n.id||n.title); img.alt=""; };
  const u = coverUrl(n.image_path);
  if (u){ img.src=u; img.alt="Imagen de la noticia"; img.onerror = () => { img.onerror=null; fallback(); }; }
  else fallback();
  box.append(img);
  if (n.video_url) box.append(el("span",{class:"badge"},"▶ Incluye video"));
  return box;
}
function catChip(id){ return el("span",{class:"chip", style:`color:var(--c-${id})`}, el("span",{class:"sq"}), catName(id)); }
function verChip(v){ return v? el("span",{class:"chip v-"+v, title: v==="confirmado"?"Verificado por moderación con evidencias":"Relato del remitente, sin verificación completa"}, VER[v]) : null; }

/* ---------- estado ---------- */
const S = {
  session:null, uid:null, isMod:false,
  news:[], newsLoaded:false, newsError:null,
  mine:[], mineLoaded:false,
  subs:[], subsLoaded:false,
  site:{contact_text:""},
  filter:{q:"", from:"", to:"", cats:new Set()},
  modTab:"pendiente", modSel:null, modMode:"view",
  draftLinks:[], draftImgs:[],
};
try { const d = JSON.parse(localStorage.getItem("gaceta-filter")||"null"); if (d){ S.filter.q=d.q||""; S.filter.cats=new Set(d.cats||[]); } } catch {}
const saveFilter = () => { try { localStorage.setItem("gaceta-filter", JSON.stringify({q:S.filter.q, cats:[...S.filter.cats]})); } catch {} };

/* ---------- carga de datos ---------- */
async function loadNews(){
  if (!sb) { S.newsLoaded=true; return; }
  const {data, error} = await sb.from("news").select("*").order("published_at",{ascending:false}).limit(500);
  S.newsError = error ? error.message : null;
  if (!error) S.news = data;
  S.newsLoaded = true;
}
async function loadSite(){
  if (!sb) return;
  const {data} = await sb.from("site_config").select("contact_text").eq("id",1).maybeSingle();
  if (data) S.site = data;
}
async function loadMine(){
  if (!sb || !S.uid){ S.mine=[]; S.mineLoaded=true; return; }
  const {data, error} = await sb.from("submissions").select("*").eq("user_id", S.uid).order("created_at",{ascending:false});
  if (!error) S.mine = data; S.mineLoaded = true;
}
async function loadModSubs(){
  if (!sb || !S.isMod){ S.subs=[]; return; }
  const {data, error} = await sb.from("submissions").select("*").order("updated_at",{ascending:false}).limit(500);
  if (!error) S.subs = data; S.subsLoaded = true;
}
async function refreshAll(){
  await Promise.all([loadNews(), loadSite(), loadMine(), loadModSubs()]);
  render();
}
async function setSession(session){
  S.session = session; S.uid = session ? session.user.id : null; S.isMod = false;
  if (session){
    const {data} = await sb.rpc("is_mod");
    S.isMod = data === true;
  }
  S.mineLoaded=false; S.subsLoaded=false;
  renderAuth();
  await refreshAll();
}

/* ---------- sesión con Discord ---------- */
function displayName(u){
  const m = (u && u.user_metadata) || {};
  return m.custom_claims && m.custom_claims.global_name || m.full_name || m.name || m.user_name || "Jugador";
}
function renderAuth(){
  const box=$("#authBox"); box.textContent="";
  if (!sb) return;
  if (!S.session){
    box.append(el("button",{class:"btn discord sm", type:"button", onclick:signIn}, "Entrar con Discord"));
    return;
  }
  const u=S.session.user, avatar=(u.user_metadata||{}).avatar_url;
  if (avatar && safeUrl(avatar)) box.append(el("img",{src:avatar, alt:""}));
  box.append(el("span",{}, displayName(u)), el("button",{class:"btn ghost sm", type:"button", onclick:async()=>{ await sb.auth.signOut(); toast("Sesión cerrada"); }}, "Salir"));
}
async function signIn(){
  const redirectTo = location.origin + location.pathname;
  try { sessionStorage.setItem("gaceta-return", location.hash||""); } catch {}
  const {error} = await sb.auth.signInWithOAuth({provider:"discord", options:{redirectTo, scopes:"identify"}});
  if (error) toast("No se pudo iniciar sesión: "+error.message);
}

/* ---------- rutas ---------- */
const VIEWS = ["portada","noticia","enviar","mis-envios","normas","moderacion"];
function route(){
  const h = (location.hash||"").slice(1) || "portada";
  let view = h, articleId = null;
  if (h.startsWith("n-")) { view = "noticia"; articleId = h.slice(2); }
  if (h === "contacto") view = "normas";
  if (!VIEWS.includes(view)) view = "portada";
  for (const v of VIEWS) $("#v-"+v).hidden = v !== view;
  document.querySelectorAll("[data-nav]").forEach(a => a.removeAttribute("aria-current"));
  const nav = document.querySelector(`[data-nav="${view==="noticia"?"portada":view}"]`); if (nav) nav.setAttribute("aria-current","page");
  S.view = view; S.articleId = articleId;
  render();
  if (h === "contacto") $("#contacto").scrollIntoView(); else window.scrollTo(0,0);
}
window.addEventListener("hashchange", route);

/* ---------- portada ---------- */
function renderCatbar(){
  const bar = $("#catbar"); bar.textContent="";
  bar.append(el("button",{class:"catbtn", type:"button", "aria-pressed": String(S.filter.cats.size===0), onclick:()=>{S.filter.cats.clear(); saveFilter(); render();}}, "Todas"));
  for (const c of CATS){
    bar.append(el("button",{class:"catbtn", type:"button", "aria-pressed": String(S.filter.cats.has(c.id)), onclick:()=>{ S.filter.cats.has(c.id)? S.filter.cats.delete(c.id) : S.filter.cats.add(c.id); saveFilter(); render(); }},
      el("span",{class:"sq", style:`background:var(--c-${c.id})`}), c.name));
  }
}
function visibleNews(){
  const f = S.filter, q = f.q.trim().toLowerCase();
  return S.news.filter(n => {
    if (f.cats.size && !f.cats.has(n.category)) return false;
    const d = (n.event_date || n.published_at || "").slice(0,10);
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
    if (q){ const hay = [n.title,n.summary,n.body,n.author,catName(n.category)].join(" ").toLowerCase(); if (!q.split(/\s+/).every(w=>hay.includes(w))) return false; }
    return true;
  });
}
function metaRow(n){
  return el("div",{class:"meta"},
    n.event_date ? el("span",{}, "Ocurrió: "+fmtDate(n.event_date)) : null,
    el("span",{}, "Publicado: "+fmtDate(n.published_at)),
    el("span",{}, "Por: "+(n.author||"Remitente anónimo")));
}
function chipsRow(n){ return el("div",{class:"row"}, catChip(n.category), verChip(n.verification), n.demo? el("span",{class:"chip demo"},"Demostración"):null); }
function cardEl(n, feature){
  const go = () => location.hash = "n-"+n.id;
  if (feature){
    return el("button",{class:"feature", type:"button", onclick:go},
      coverEl(n), el("div",{class:"body"}, chipsRow(n), el("h3",{},n.title), el("p",{},n.summary), metaRow(n)));
  }
  return el("button",{class:"card", type:"button", onclick:go},
    coverEl(n), el("div",{class:"body"}, chipsRow(n), el("h3",{},n.title), el("p",{class:"small"},n.summary), metaRow(n)));
}
function renderPortada(){
  renderCatbar();
  const fq=$("#fq"); if (document.activeElement!==fq) fq.value=S.filter.q;
  const list=$("#newsList"); list.textContent="";
  const status=$("#newsStatus");
  status.textContent = !S.newsLoaded ? "Cargando publicaciones…" : S.newsError ? "No se pudieron cargar las publicaciones. Recarga la página en un momento." : "";
  if (!S.newsLoaded) return;
  if (!S.news.length){
    list.append(el("div",{class:"empty"}, el("h3",{},"Todavía no hay noticias publicadas"), el("p",{class:"muted"},"Cuando moderación apruebe el primer envío, aparecerá aquí."), el("p",{style:"margin-top:12px"}, el("a",{class:"btn primary", href:"#enviar"},"Enviar la primera noticia"))));
    return;
  }
  const items = visibleNews();
  if (!items.length){
    list.append(el("div",{class:"empty"}, el("h3",{},"Sin resultados"), el("p",{class:"muted"},"Ninguna noticia coincide con estos filtros. Prueba con otras palabras o limpia los filtros.")));
    return;
  }
  const filtered = S.filter.q || S.filter.from || S.filter.to || S.filter.cats.size;
  if (!filtered){
    list.append(cardEl(items[0], true));
    if (items.length>1){ const g=el("div",{class:"grid"}); items.slice(1).forEach(n=>g.append(cardEl(n))); list.append(g); }
  } else {
    list.append(el("p",{class:"small muted"}, items.length===1? "1 noticia encontrada" : items.length+" noticias encontradas"));
    const g=el("div",{class:"grid"}); items.forEach(n=>g.append(cardEl(n))); list.append(g);
  }
}
$("#fq").addEventListener("input", e=>{ S.filter.q=e.target.value; saveFilter(); renderPortada(); });
$("#ffrom").addEventListener("change", e=>{ S.filter.from=e.target.value; renderPortada(); });
$("#fto").addEventListener("change", e=>{ S.filter.to=e.target.value; renderPortada(); });
$("#fclear").addEventListener("click", ()=>{ S.filter={q:"",from:"",to:"",cats:new Set()}; $("#ffrom").value=""; $("#fto").value=""; saveFilter(); renderPortada(); });

/* ---------- artículo ---------- */
function renderArticle(){
  const box=$("#articleBox"); box.textContent="";
  const n = S.news.find(x=>x.id===S.articleId);
  if (!n){ box.append(el("div",{class:"empty"}, el("h3",{}, S.newsLoaded? "Esta publicación no existe o fue retirada" : "Cargando…"))); return; }
  document.title = n.title + " · Gaceta Survival";
  const inner = el("div",{class:"inner"},
    chipsRow(n), el("h2",{},n.title), metaRow(n),
    n.demo ? el("div",{class:"callout demo"}, el("strong",{},"Contenido de demostración"), "Esta publicación es un ejemplo para mostrar el formato de la gaceta. No describe hechos reales del servidor.") : null,
    el("p",{style:"font-size:1.1rem;font-weight:700"}, n.summary),
    el("div",{class:"prose"}, n.body||""),
    n.verification==="confirmado"
      ? el("div",{class:"callout ok"}, el("strong",{},"Información confirmada"), n.verification_note || "Moderación revisó evidencias que respaldan los hechos descritos.")
      : el("div",{class:"callout warn"}, el("strong",{},"Testimonio"), n.verification_note || "Esta noticia se basa en el relato del remitente. Moderación no pudo confirmar todos los detalles con evidencias."),
    n.correction ? el("div",{class:"callout info"}, el("strong",{},"Corrección"), n.correction, n.updated_at? el("div",{class:"small muted"}, "Actualizado: "+fmtDate(n.updated_at)) : null) : null,
  );
  const video = safeUrl(n.video_url||"");
  if (video) inner.append(el("p",{}, el("a",{class:"btn", href:video, target:"_blank", rel:"noopener noreferrer"},"▶ Ver el video")));
  const links = (n.links||[]).map(safeUrl).filter(Boolean);
  if (links.length) inner.append(el("div",{class:"stack"}, el("h3",{},"Evidencias y fuentes"), el("ul",{}, links.map(u=>el("li",{}, el("a",{href:u, target:"_blank", rel:"noopener noreferrer"}, u))))));
  inner.append(el("p",{class:"small muted"}, "¿Ves un error o esta publicación te afecta? ",
    el("a",{href:"#contacto", onclick:()=>{ S.prefillNews = n.id; }}, "Solicita una corrección o su retiro"), "."));
  if (S.isMod) inner.append(el("div",{class:"row"}, el("button",{class:"btn sm", type:"button", onclick:()=>{ S.modTab="publicadas"; S.modSel="news:"+n.id; S.modMode="edit"; location.hash="moderacion"; }}, "Editar en moderación")));
  box.append(el("article",{class:"full"}, coverEl(n), inner));
}

/* ---------- acceso ---------- */
function writeGate(target){
  target.textContent="";
  if (!sb){ target.append(el("div",{class:"callout warn"}, el("strong",{},"Sitio sin configurar"), "Falta conectar la base de datos en config.js.")); return false; }
  if (!S.session){
    target.append(el("div",{class:"callout info"}, el("strong",{},"Entra para participar"), "Usamos tu cuenta de Discord solo para saber quién envía y poder responderte. No publicamos tu usuario de Discord.",
      el("div",{style:"margin-top:10px"}, el("button",{class:"btn discord", type:"button", onclick:signIn}, "Entrar con Discord"))));
    return false;
  }
  return true;
}

/* ---------- enviar noticia ---------- */
function fillCatSelect(sel, withEmpty){
  sel.textContent=""; if (withEmpty) sel.append(el("option",{value:""},"Elige una categoría"));
  CATS.forEach(c=>sel.append(el("option",{value:c.id},c.name)));
}
fillCatSelect($("#s-cat"), true);
$("#s-date").max = new Date().toISOString().slice(0,10);

function renderSendForm(){
  const ok = writeGate($("#sendGate"));
  $("#sendForm").hidden = !ok;
  const ul=$("#s-links"); ul.textContent="";
  S.draftLinks.forEach((u,i)=> ul.append(el("li",{}, el("a",{href:u,target:"_blank",rel:"noopener noreferrer"},u)," ", el("button",{class:"btn ghost sm", type:"button", onclick:()=>{S.draftLinks.splice(i,1); renderSendForm();}}, "Quitar"))));
  const th=$("#s-thumbs"); th.textContent="";
  S.draftImgs.forEach((a,i)=> th.append(el("div",{class:"thumb"}, el("img",{src:a.preview, alt:a.name}),
    el("button",{class:"x", type:"button", "aria-label":"Quitar captura", onclick:()=>{ sb.storage.from("evidencias").remove([a.path]).catch(()=>{}); URL.revokeObjectURL(a.preview); S.draftImgs.splice(i,1); renderSendForm(); }}, "✕"))));
}
$("#s-addlink").addEventListener("click", ()=>{
  const u = safeUrl($("#s-link").value.trim());
  if (!u){ toast("Escribe un enlace válido que empiece por https://"); return; }
  if (S.draftLinks.length>=8){ toast("Máximo 8 enlaces"); return; }
  S.draftLinks.push(u); $("#s-link").value=""; renderSendForm();
});
$("#s-files").addEventListener("change", async e=>{
  const files=[...e.target.files]; e.target.value="";
  for (const f of files){
    if (S.draftImgs.length>=6){ toast("Máximo 6 capturas por envío"); break; }
    if (!IMG_TYPES.includes(f.type)){ toast(f.name+": solo PNG, JPG, WEBP o GIF"); continue; }
    if (f.size > 10*1024*1024){ toast(f.name+" supera 10 MB"); continue; }
    const path = `${S.uid}/${uuid()}.${extOf(f.type)}`;
    toast("Subiendo "+f.name+"…");
    const {error} = await sb.storage.from("evidencias").upload(path, f, {contentType:f.type, upsert:false});
    if (error){ toast("No se pudo subir "+f.name+": "+error.message); continue; }
    S.draftImgs.push({path, name:f.name, preview:URL.createObjectURL(f)}); renderSendForm(); toast("Captura subida");
  }
});
$("#sendForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const err=$("#s-error"); err.hidden=true;
  const v = {
    title:$("#s-title").value.trim(), category:$("#s-cat").value, approx_date:$("#s-date").value||null,
    description:$("#s-desc").value.trim(), ign:$("#s-ign").value.trim(), anonymous:$("#s-anon").checked,
    contact:$("#s-contact").value.trim(), mentions_others:$("#s-mentions").checked,
  };
  const problems=[];
  if (!v.title) problems.push("Escribe un título sugerido.");
  if (!v.category) problems.push("Elige una categoría.");
  if (!v.approx_date) problems.push("Indica la fecha aproximada.");
  if (v.description.length<30) problems.push("Describe lo ocurrido con al menos 30 caracteres.");
  if (!v.ign) problems.push("Escribe tu nombre dentro del juego.");
  if (v.anonymous && !v.contact) problems.push("Si publicas sin nombre, deja un contacto privado para que moderación pueda verificar.");
  if (!$("#s-accept").checked) problems.push("Confirma que lo enviado es auténtico y respeta las normas.");
  if (problems.length){ err.textContent=""; err.append(el("strong",{},"Revisa estos puntos"), el("ul",{}, problems.map(p=>el("li",{},p)))); err.hidden=false; return; }
  const btn=$("#s-submit"); btn.disabled=true;
  const {error} = await sb.from("submissions").insert({
    kind:"noticia", ...v, user_id:S.uid, links:[...S.draftLinks], images:S.draftImgs.map(a=>a.path),
  });
  btn.disabled=false;
  if (error){
    err.textContent=""; err.append(el("strong",{},"No se pudo enviar"), /row-level security/i.test(error.message) ? "Alcanzaste el límite de 10 envíos por día o tu sesión expiró. Vuelve a intentarlo más tarde." : "Hubo un problema de conexión. Tu texto sigue en el formulario: inténtalo de nuevo."); err.hidden=false;
    return;
  }
  $("#sendForm").reset(); S.draftImgs.forEach(a=>URL.revokeObjectURL(a.preview)); S.draftLinks=[]; S.draftImgs=[];
  toast("Enviado. Queda pendiente de revisión.");
  await Promise.all([loadMine(), loadModSubs()]);
  location.hash="mis-envios";
});

/* ---------- solicitudes de corrección / retiro ---------- */
function renderReqForm(){
  const alt=$("#contactAlt"); alt.textContent="";
  alt.append(el("div",{class:"callout"}, el("strong",{},"Contacto alternativo"), S.site.contact_text ? S.site.contact_text : "El equipo moderador aún no ha indicado un contacto alternativo. Usa el formulario de abajo."));
  const ok = writeGate($("#reqGate"));
  $("#reqForm").hidden = !ok;
  const sel=$("#r-news"), cur = S.prefillNews || sel.value;
  sel.textContent=""; sel.append(el("option",{value:""},"No se refiere a una publicación"));
  S.news.forEach(n=>sel.append(el("option",{value:n.id}, n.title)));
  if (cur) sel.value=cur; S.prefillNews=null;
}
$("#reqForm").addEventListener("submit", async e=>{
  e.preventDefault(); const err=$("#r-error"); err.hidden=true;
  const desc=$("#r-desc").value.trim();
  if (desc.length<15){ err.textContent="Explica tu solicitud con al menos 15 caracteres."; err.hidden=false; return; }
  const type=$("#r-type").value, newsId=$("#r-news").value, n=S.news.find(x=>x.id===newsId);
  const {error} = await sb.from("submissions").insert({
    kind:"solicitud", user_id:S.uid, request_type:type, news_id:newsId||null, news_title:n? n.title:null,
    title: REQ[type] + (n? ": "+n.title : ""), description:desc, ign:$("#r-ign").value.trim(), contact:$("#r-contact").value.trim(),
  });
  if (error){ err.textContent = /row-level security/i.test(error.message) ? "Alcanzaste el límite de envíos por día o tu sesión expiró." : "No se pudo enviar. Revisa tu conexión e inténtalo de nuevo."; err.hidden=false; return; }
  $("#reqForm").reset(); toast("Solicitud enviada al equipo moderador.");
  await Promise.all([loadMine(), loadModSubs()]);
  location.hash="mis-envios";
});

/* ---------- mis envíos ---------- */
function threadEl(thread){
  if (!thread || !thread.length) return null;
  return el("div",{class:"thread"}, thread.map(m=>el("div",{class:"msg"+(m.from==="moderacion"?" mod":"")},
    el("div",{class:"small muted"}, (m.from==="moderacion"?"Moderación":"Remitente")+" · "+fmtDT(m.at)), el("div",{class:"prose"},m.text))));
}
function renderMine(){
  const box=$("#mineList"); box.textContent="";
  if (!writeGate(box)) return;
  const idBox = el("div",{class:"callout small"}, "Tu ID de usuario (solo si te van a nombrar moderador): ", el("code",{}, S.uid), " ",
    el("button",{class:"btn ghost sm", type:"button", onclick:async()=>{ try{ await navigator.clipboard.writeText(S.uid); toast("ID copiado"); } catch { toast("Selecciona el ID y cópialo"); } }}, "Copiar"));
  if (!S.mineLoaded){ box.append(el("p",{class:"muted"},"Cargando tus envíos…")); return; }
  if (!S.mine.length){
    box.append(el("div",{class:"empty"}, el("h3",{},"Aún no has enviado nada"), el("p",{class:"muted"},"Cuando envíes una noticia o una solicitud, verás aquí su estado."), el("p",{style:"margin-top:12px"}, el("a",{class:"btn primary",href:"#enviar"},"Enviar una noticia"))), idBox);
    return;
  }
  S.mine.forEach(s=>{
    const card=el("div",{class:"formcard"},
      el("div",{class:"row"}, el("span",{class:"chip s-"+s.status}, STATUS[s.status]||s.status), s.kind==="noticia"? catChip(s.category) : el("span",{class:"chip"},"Solicitud"), el("span",{class:"small muted"}, "Enviado: "+fmtDT(s.created_at))),
      el("h3",{}, s.title),
      el("p",{class:"prose small"}, s.description),
      s.status==="publicada" && s.published_news_id ? el("p",{}, el("a",{href:"#n-"+s.published_news_id},"Ver la publicación")) : null,
      threadEl(s.thread));
    if (s.status==="info"){
      const id="reply-"+s.id, ta=el("textarea",{id, placeholder:"Responde a moderación con la información que te pidieron."});
      card.append(el("div",{class:"field"}, el("label",{for:id},"Tu respuesta"), ta),
        el("div",{class:"row"}, el("button",{class:"btn primary", type:"button", onclick:async e=>{
          const txt=ta.value.trim(); if (!txt){ toast("Escribe tu respuesta"); return; }
          e.target.disabled=true;
          const {error} = await sb.rpc("reply_submission", {sub_id:s.id, reply:txt});
          if (error){ toast(errMsg(error,"No se pudo enviar la respuesta")); e.target.disabled=false; return; }
          toast("Respuesta enviada"); await loadMine(); render();
        }}, "Enviar respuesta")));
    }
    box.append(card);
  });
  box.append(idBox);
}

/* ---------- moderación ---------- */
const MODTABS = [
  {id:"pendiente", name:"Pendientes", f:s=>s.kind==="noticia" && s.status==="pendiente"},
  {id:"info", name:"Info solicitada", f:s=>s.kind==="noticia" && s.status==="info"},
  {id:"solicitudes", name:"Correcciones y retiros", f:s=>s.kind==="solicitud" && (s.status==="pendiente"||s.status==="info")},
  {id:"historial", name:"Historial", f:s=>["publicada","rechazada","resuelta","retirada"].includes(s.status)},
  {id:"publicadas", name:"Publicadas", f:null},
  {id:"ajustes", name:"Contacto", f:null},
];
function updateModCount(){
  const n = S.subs.filter(s=>s.status==="pendiente").length;
  const c=$("#modCount"); c.hidden = !n; c.textContent=n;
}
function renderMod(){
  const gate=$("#modGate"); gate.textContent="";
  if (!S.isMod){ $("#modBody").hidden=true; gate.append(el("div",{class:"callout info"}, el("strong",{},"Solo para moderación"), "Este panel está disponible para el equipo moderador de la gaceta.")); return; }
  $("#modBody").hidden=false;
  const tabs=$("#modTabs"); tabs.textContent="";
  MODTABS.forEach(t=>{
    const count = t.f ? S.subs.filter(t.f).length : (t.id==="publicadas"? S.news.length : null);
    tabs.append(el("button",{type:"button", role:"tab", "aria-selected":String(S.modTab===t.id), onclick:()=>{S.modTab=t.id; S.modSel=null; S.modMode="view"; renderMod();}}, t.name + (count!=null? ` (${count})` : "")));
  });
  const q=$("#modQueue"), d=$("#modDetail"); q.textContent=""; d.textContent="";
  if (S.modTab==="ajustes"){ q.hidden=true; d.append(settingsPanel()); return; }
  q.hidden=false;
  if (S.modTab==="publicadas"){
    if (!S.news.length) q.append(el("div",{class:"empty small"},"No hay publicaciones."));
    S.news.forEach(n=>q.append(el("button",{class:"qitem", type:"button", "aria-current":String(S.modSel==="news:"+n.id), onclick:()=>{S.modSel="news:"+n.id; S.modMode="view"; renderMod();}},
      el("div",{class:"row"}, catChip(n.category), n.demo? el("span",{class:"chip demo"},"Demo"):null), el("b",{},n.title), el("span",{class:"small muted"}, fmtDate(n.published_at)))));
    const sel = S.modSel && S.modSel.startsWith("news:") ? S.news.find(n=>"news:"+n.id===S.modSel) : null;
    d.append(sel ? (S.modMode==="edit" ? editorPanel({news:sel}) : newsPanel(sel)) : el("div",{class:"empty"},"Elige una publicación para editarla o retirarla."));
    return;
  }
  const tab=MODTABS.find(t=>t.id===S.modTab), items=S.subs.filter(tab.f);
  if (!S.subsLoaded) q.append(el("p",{class:"muted"},"Cargando envíos…"));
  else if (!items.length) q.append(el("div",{class:"empty small"},"Nada por aquí."));
  items.forEach(s=>q.append(el("button",{class:"qitem", type:"button", "aria-current":String(S.modSel===s.id), onclick:()=>{S.modSel=s.id; S.modMode="view"; renderMod();}},
    el("div",{class:"row"}, el("span",{class:"chip s-"+s.status}, STATUS[s.status]), s.kind==="noticia"? catChip(s.category) : el("span",{class:"chip"}, REQ[s.request_type]||"Solicitud"), s.mentions_others? el("span",{class:"chip v-testimonio"},"Menciona jugadores"):null),
    el("b",{}, s.title), el("span",{class:"small muted"}, (s.ign||"Sin nick")+" · "+fmtDT(s.updated_at)))));
  const sel = S.subs.find(s=>s.id===S.modSel);
  if (!sel){ d.append(el("div",{class:"empty"},"Elige un envío de la lista para revisarlo.")); return; }
  d.append(S.modMode==="edit" ? editorPanel({sub:sel}) : subPanel(sel));
}
async function modUpdate(s, patch, okMsg){
  const {error} = await sb.from("submissions").update({...patch, updated_at:nowISO()}).eq("id", s.id);
  if (error){ toast(errMsg(error,"No se pudo guardar. Inténtalo de nuevo.")); return false; }
  toast(okMsg); await loadModSubs(); render(); return true;
}
function evidenceEl(s){
  const wrap=el("div",{class:"stack"});
  const ims=s.images||[];
  if (ims.length) wrap.append(el("div",{class:"thumbs"}, ims.map(p=>{
    const a=el("a",{class:"thumb", target:"_blank", rel:"noopener"}, evidenceImg(p));
    evidenceUrl(p).then(u=>{ if(u) a.href=u; }); return a;
  })));
  const links=(s.links||[]).map(safeUrl).filter(Boolean);
  if (links.length) wrap.append(el("ul",{class:"small"}, links.map(u=>el("li",{}, el("a",{href:u,target:"_blank",rel:"noopener noreferrer"},u)))));
  if (!ims.length && !links.length) wrap.append(el("p",{class:"small muted"},"Sin evidencias adjuntas."));
  return wrap;
}
function subPanel(s){
  const p=el("div",{class:"detail"});
  p.append(el("div",{class:"row"}, el("span",{class:"chip s-"+s.status}, STATUS[s.status]), s.kind==="noticia"? catChip(s.category) : el("span",{class:"chip"},"Solicitud")), el("h3",{}, s.title));
  const kv=el("dl",{class:"kv"});
  const add=(k,v)=>{ if (v) kv.append(el("dt",{},k), el("dd",{},v)); };
  add("Nick en el juego", s.ign||"—");
  if (s.kind==="noticia") add("Publicar como", s.anonymous? "Remitente anónimo (lo pidió)" : s.ign);
  add("Contacto privado", s.contact||"No indicó");
  add("Fecha aproximada", fmtDate(s.approx_date));
  if (s.kind==="solicitud") add("Tipo", REQ[s.request_type]);
  if (s.news_id) kv.append(el("dt",{},"Publicación"), el("dd",{}, el("a",{href:"#n-"+s.news_id}, s.news_title||"Ver")));
  add("Enviado", fmtDT(s.created_at));
  p.append(kv, el("div",{class:"stack"}, el("b",{},"Descripción"), el("div",{class:"prose"}, s.description)));
  if (s.kind==="noticia"){
    p.append(el("div",{class:"stack"}, el("b",{},"Evidencias"), evidenceEl(s)));
    if (s.mentions_others) p.append(el("div",{class:"callout warn"}, el("strong",{},"Menciona a otros jugadores"), "Comprueba que las menciones sean respetuosas y necesarias, y que no haya acusaciones sin pruebas ni datos personales."));
  }
  const th=threadEl(s.thread); if (th) p.append(el("b",{},"Conversación"), th);
  if (["publicada","rechazada","resuelta","retirada"].includes(s.status)){ p.append(el("p",{class:"small muted"}, "Este envío ya está cerrado.")); return p; }

  const note=el("textarea",{id:"mod-note", placeholder:"Mensaje para el remitente (lo verá en “Mis envíos”)."});
  p.append(el("div",{class:"field"}, el("label",{for:"mod-note"},"Mensaje al remitente"), note));
  const msg = () => note.value.trim();
  const push = (status, text) => ({status, thread:[...(s.thread||[]), {from:"moderacion", text, at:nowISO()}]});
  const acts=el("div",{class:"row"});
  if (s.kind==="noticia") acts.append(el("button",{class:"btn primary", type:"button", onclick:()=>{S.modMode="edit"; renderMod();}}, "Editar y publicar"));
  acts.append(el("button",{class:"btn", type:"button", onclick:()=>{ if(!msg()){toast("Escribe qué información necesitas"); note.focus(); return;} modUpdate(s, push("info", msg()), "Se pidió más información al remitente"); }}, "Pedir más información"));
  if (s.kind==="solicitud") acts.append(el("button",{class:"btn primary", type:"button", onclick:()=>modUpdate(s, push("resuelta", msg()||"Solicitud atendida."), "Solicitud marcada como resuelta")}, "Marcar como resuelta"));
  acts.append(el("button",{class:"btn danger", type:"button", onclick:()=>{ if(!msg()){toast("Indica el motivo del rechazo"); note.focus(); return;} modUpdate(s, push("rechazada", msg()), "Envío rechazado"); }}, "Rechazar"));
  p.append(acts);
  if (s.kind==="solicitud" && s.news_id && S.news.some(n=>n.id===s.news_id)) p.append(el("p",{class:"small"}, "Para corregir o retirar la publicación, ábrela en ",
    el("button",{class:"btn ghost sm", type:"button", onclick:()=>{S.modTab="publicadas"; S.modSel="news:"+s.news_id; S.modMode="view"; renderMod();}}, "Publicadas"), "."));
  return p;
}
function newsPanel(n){
  const p=el("div",{class:"detail"});
  p.append(chipsRow(n), el("h3",{},n.title), metaRow(n), el("p",{},n.summary));
  const confirmBox=el("div",{class:"confirm", hidden:true},
    el("b",{},"¿Retirar esta publicación?"),
    el("span",{class:"small"},"Se eliminará de la gaceta para todos. No se puede deshacer."),
    el("div",{class:"row"},
      el("button",{class:"btn danger", type:"button", onclick:async()=>{
        const {error} = await sb.from("news").delete().eq("id", n.id);
        if (error){ toast(errMsg(error,"No se pudo retirar")); return; }
        if (n.image_path) sb.storage.from("portadas").remove([n.image_path]).catch(()=>{});
        if (n.source_submission) await sb.from("submissions").update({status:"retirada", updated_at:nowISO()}).eq("id", n.source_submission);
        S.modSel=null; toast("Publicación retirada"); await refreshAll();
      }}, "Sí, retirar"),
      el("button",{class:"btn", type:"button", onclick:()=>{confirmBox.hidden=true;}}, "Cancelar")));
  p.append(el("div",{class:"row"},
    el("a",{class:"btn", href:"#n-"+n.id},"Ver"),
    el("button",{class:"btn primary", type:"button", onclick:()=>{S.modMode="edit"; renderMod();}}, "Editar o corregir"),
    el("button",{class:"btn danger", type:"button", onclick:()=>{confirmBox.hidden=false;}}, "Retirar")), confirmBox);
  return p;
}
async function copyEvidenceToCover(evPath, newsId){
  const {data:blob, error} = await sb.storage.from("evidencias").download(evPath);
  if (error) throw error;
  const type = blob.type && IMG_TYPES.includes(blob.type) ? blob.type : "image/jpeg";
  const path = `${newsId}/${uuid()}.${extOf(type)}`;
  const up = await sb.storage.from("portadas").upload(path, blob, {contentType:type, upsert:false});
  if (up.error) throw up.error;
  return path;
}
function editorPanel({sub, news}){
  const src = sub || null;
  const base = news || {
    title:sub.title, summary:"", body:sub.description, category:sub.category, event_date:sub.approx_date,
    author: sub.anonymous ? "Remitente anónimo" : sub.ign, verification:"testimonio", verification_note:"",
    image_path:null, video_url:"", links:[...(sub.links||[])], mentions_others:sub.mentions_others,
  };
  const p=el("form",{class:"detail", novalidate:true});
  p.append(el("h3",{}, news? "Editar publicación" : "Editar antes de publicar"));
  if (src && src.anonymous) p.append(el("div",{class:"callout info"}, el("strong",{},"El remitente pidió anonimato"), "Publica como “Remitente anónimo”. No uses su nick en el texto."));
  const f = (id,label,node,hint) => el("div",{class:"field"}, el("label",{for:id},label), node, hint? el("span",{class:"hint"},hint):null);
  const iTitle=el("input",{type:"text", id:"e-title", maxlength:"160"}); iTitle.value=base.title||"";
  const iSum=el("textarea",{id:"e-sum", maxlength:"400", style:"min-height:70px"}); iSum.value=base.summary||"";
  const iBody=el("textarea",{id:"e-body", maxlength:"10000", style:"min-height:200px"}); iBody.value=base.body||"";
  const iCat=el("select",{id:"e-cat"}); fillCatSelect(iCat,false); iCat.value=base.category||"eventos";
  const iDate=el("input",{type:"date", id:"e-date"}); iDate.value=base.event_date||"";
  const iAuthor=el("input",{type:"text", id:"e-author", maxlength:"60"}); iAuthor.value=base.author||"";
  const iVer=el("select",{id:"e-ver"}, el("option",{value:"confirmado"},"Confirmado: hay evidencias que lo respaldan"), el("option",{value:"testimonio"},"Testimonio: relato sin verificación completa")); iVer.value=base.verification||"testimonio";
  const iVerNote=el("input",{type:"text", id:"e-vernote", maxlength:"300", placeholder:"Ej.: Se revisaron dos capturas y un video del evento."}); iVerNote.value=base.verification_note||"";
  p.append(f("e-title","Título",iTitle), f("e-sum","Resumen",iSum,"Una o dos frases que aparecen en la portada."), f("e-body","Texto de la noticia",iBody,"Presenta los hechos con tono neutral. Separa lo confirmado de lo que cuentan los testigos. Quita datos personales."));
  p.append(el("div",{class:"two"}, f("e-cat","Categoría",iCat), f("e-date","Fecha del hecho",iDate)));
  p.append(el("div",{class:"two"}, f("e-ver","Estado de la información",iVer), f("e-author","Autor o fuente",iAuthor, src&&src.anonymous? "Debe ser “Remitente anónimo”." : null)));
  p.append(f("e-vernote","Nota de verificación (pública)",iVerNote));

  // portada: "keep" (actual), null (sin imagen) o ruta de evidencia
  // Al editar una noticia ya publicada, también se ofrecen las capturas del envío original.
  const origin = src || (news && news.source_submission ? S.subs.find(s=>s.id===news.source_submission) : null);
  const evid = origin ? (origin.images||[]) : [];
  let cover = news ? (news.image_path ? "keep" : null) : (evid[0] || null);
  let upFile = null, upPreview = null;
  {
    const th=el("div",{class:"thumbs"});
    const draw=()=>{
      th.textContent="";
      th.append(el("button",{type:"button", class:"thumb"+(cover===null?" sel":""), onclick:()=>{cover=null; draw();}}, el("span",{class:"small", style:"display:grid;place-items:center;height:100%"},"Sin imagen")));
      if (news && news.image_path) th.append(el("button",{type:"button", class:"thumb"+(cover==="keep"?" sel":""), onclick:()=>{cover="keep"; draw();}, "aria-label":"Mantener imagen actual"}, el("img",{src:coverUrl(news.image_path), alt:""})));
      evid.forEach(path=>th.append(el("button",{type:"button", class:"thumb"+(cover===path?" sel":""), onclick:()=>{cover=path; draw();}, "aria-label":"Usar como portada"}, evidenceImg(path,""))));
      if (upFile) th.append(el("button",{type:"button", class:"thumb"+(cover==="upload"?" sel":""), onclick:()=>{cover="upload"; draw();}, "aria-label":"Usar imagen subida"}, el("img",{src:upPreview, alt:""})));
    };
    const fileIn=el("input",{type:"file", id:"e-cover-file", accept:IMG_TYPES.join(","), hidden:true, onchange:e=>{
      const f=e.target.files[0]; e.target.value="";
      if (!f) return;
      if (!IMG_TYPES.includes(f.type)){ toast("Solo PNG, JPG, WEBP o GIF"); return; }
      if (f.size > 10*1024*1024){ toast("La imagen supera 10 MB"); return; }
      if (upPreview) URL.revokeObjectURL(upPreview);
      upFile=f; upPreview=URL.createObjectURL(f); cover="upload"; draw();
    }});
    draw();
    p.append(el("div",{class:"field"}, el("span",{class:"lbl"},"Imagen de portada"), th,
      el("div",{class:"row"}, el("label",{class:"btn sm", for:"e-cover-file"},"Subir otra imagen"), fileIn),
      evid.length ? null : el("span",{class:"hint"}, origin ? "El envío original no tiene capturas guardadas." : "No se encontró el envío original de esta noticia."),
      el("span",{class:"hint"},"Pulsa una imagen para usarla como portada (la elegida tiene borde de color). Se vuelve pública al guardar. Sin imagen se usa una portada abstracta según la categoría.")));
  }
  const allLinks=[...new Set([...(base.links||[]), ...(src? src.links||[] : []), ...(base.video_url? [base.video_url]:[])])].map(safeUrl).filter(Boolean);
  const iVideo=el("select",{id:"e-video"}, el("option",{value:""},"Sin video"), allLinks.map(u=>el("option",{value:u},u))); iVideo.value = base.video_url||"";
  if (allLinks.length) p.append(f("e-video","Video destacado",iVideo));
  const linkChecks = allLinks.map((u,i)=>{ const c=el("input",{type:"checkbox", id:"e-l"+i}); c.checked=(base.links||[]).includes(u); return {u,c}; });
  if (linkChecks.length) p.append(el("div",{class:"field"}, el("span",{class:"lbl"},"Enlaces públicos como evidencia"), linkChecks.map(({u,c},i)=>el("label",{class:"check small", for:"e-l"+i}, c, el("span",{style:"overflow-wrap:anywhere"},u))), el("span",{class:"hint"},"Publica solo enlaces que no expongan datos personales.")));
  let iCorr=null;
  if (news){ iCorr=el("input",{type:"text", id:"e-corr", maxlength:"300", placeholder:"Ej.: Se corrigió la fecha del evento."}); iCorr.value=news.correction||""; p.append(f("e-corr","Nota de corrección (pública, opcional)",iCorr)); }
  const needs2 = !!base.mentions_others;
  const chk1=el("input",{type:"checkbox", id:"e-c1"}), chk2=el("input",{type:"checkbox", id:"e-c2"});
  p.append(el("div",{class:"callout"}, el("strong",{},"Comprobaciones"),
    el("label",{class:"check small", for:"e-c1"}, chk1, el("span",{},"El texto no incluye datos personales, conversaciones privadas, insultos ni acusaciones sin pruebas.")),
    needs2 ? el("label",{class:"check small", for:"e-c2"}, chk2, el("span",{},"Revisé que las menciones a otros jugadores sean respetuosas y necesarias.")) : null));
  const errBox=el("div",{class:"callout warn", hidden:true});
  const save=el("button",{class:"btn primary", type:"submit"}, news? "Guardar cambios" : "Aprobar y publicar");
  p.append(errBox, el("div",{class:"row"}, save, el("button",{class:"btn ghost", type:"button", onclick:()=>{S.modMode="view"; renderMod();}}, "Cancelar")));

  p.addEventListener("submit", async e=>{
    e.preventDefault(); errBox.hidden=true;
    const probs=[];
    if (!iTitle.value.trim()) probs.push("Falta el título.");
    if (!iSum.value.trim()) probs.push("Falta el resumen.");
    if (!iBody.value.trim()) probs.push("Falta el texto.");
    if (!chk1.checked) probs.push("Confirma la comprobación de contenido.");
    if (needs2 && !chk2.checked) probs.push("Confirma la revisión de menciones a otros jugadores.");
    if (src && src.anonymous && src.ign && iAuthor.value.trim().toLowerCase()===src.ign.toLowerCase()) probs.push("El remitente pidió anonimato: no publiques su nick como autor.");
    if (probs.length){ errBox.textContent=""; errBox.append(el("ul",{}, probs.map(x=>el("li",{},x)))); errBox.hidden=false; return; }
    save.disabled=true;
    const t=nowISO();
    const newsId = news ? news.id : uuid();
    try{
      let image_path = news ? news.image_path : null;
      if (cover === null) image_path = null;
      else if (cover === "upload"){
        const path = `${newsId}/${uuid()}.${extOf(upFile.type)}`;
        const up = await sb.storage.from("portadas").upload(path, upFile, {contentType:upFile.type, upsert:false});
        if (up.error) throw up.error;
        image_path = path;
      }
      else if (cover !== "keep") image_path = await copyEvidenceToCover(cover, newsId);
      const row = {
        title:iTitle.value.trim(), summary:iSum.value.trim(), body:iBody.value.trim(), category:iCat.value, event_date:iDate.value||null,
        author:iAuthor.value.trim()||"Remitente anónimo", verification:iVer.value, verification_note:iVerNote.value.trim(),
        image_path, video_url:iVideo.value||null, links:linkChecks.filter(x=>x.c.checked).map(x=>x.u), mentions_others:needs2,
      };
      if (news){
        const corr = iCorr.value.trim()||null;
        row.correction = corr;
        row.updated_at = corr && corr!==news.correction ? t : news.updated_at;
        const {error} = await sb.from("news").update(row).eq("id", news.id);
        if (error) throw error;
        if (news.image_path && news.image_path!==image_path) sb.storage.from("portadas").remove([news.image_path]).catch(()=>{});
        toast("Publicación actualizada");
      } else {
        const {error} = await sb.from("news").insert({...row, id:newsId, demo:false, source_submission:src.id, published_at:t});
        if (error) throw error;
        const up = await sb.from("submissions").update({status:"publicada", published_news_id:newsId, updated_at:t,
          thread:[...(src.thread||[]), {from:"moderacion", text:"Tu noticia fue aprobada y publicada. ¡Gracias por contribuir!", at:t}]}).eq("id", src.id);
        if (up.error) throw up.error;
        toast("Noticia publicada");
      }
      S.modMode="view"; await refreshAll();
    } catch(ex){
      errBox.textContent="No se pudo guardar: "+errMsg(ex,"revisa tu conexión e inténtalo de nuevo."); errBox.hidden=false; save.disabled=false;
    }
  });
  return p;
}
function settingsPanel(){
  const p=el("form",{class:"detail", novalidate:true});
  const ta=el("textarea",{id:"set-contact", maxlength:"400", style:"min-height:80px", placeholder:"Ej.: Escríbenos al canal #gaceta del Discord de la comunidad."}); ta.value=S.site.contact_text||"";
  p.append(el("h3",{},"Contacto alternativo"), el("p",{class:"small muted"},"Se muestra en “Normas y contacto” junto al formulario. No pongas datos personales."),
    el("div",{class:"field"}, el("label",{for:"set-contact"},"Texto de contacto"), ta),
    el("div",{class:"row"}, el("button",{class:"btn primary", type:"submit"},"Guardar")));
  p.addEventListener("submit", async e=>{ e.preventDefault();
    const {error} = await sb.from("site_config").update({contact_text:ta.value.trim()}).eq("id",1);
    if (error) toast(errMsg(error,"No se pudo guardar")); else { S.site.contact_text=ta.value.trim(); toast("Contacto guardado"); } });
  return p;
}

/* ---------- render ---------- */
function render(){
  if (S.view!=="noticia") document.title = "Gaceta Survival MineLatino";
  $("#navMod").hidden = !S.isMod;
  if (S.view==="portada") renderPortada();
  else if (S.view==="noticia") renderArticle();
  else if (S.view==="enviar") renderSendForm();
  else if (S.view==="mis-envios") renderMine();
  else if (S.view==="normas") renderReqForm();
  else if (S.view==="moderacion") renderMod();
  updateModCount();
}

/* ---------- arranque ---------- */
async function boot(){
  route();
  if (!sb){ S.newsLoaded=true; render(); return; }
  const {data} = await sb.auth.getSession();
  // tras volver de Discord, regresa a la sección donde estaba la persona
  try { const back = sessionStorage.getItem("gaceta-return"); if (back && data.session){ sessionStorage.removeItem("gaceta-return"); if (back!==location.hash) location.hash = back; } } catch {}
  if (location.search.includes("code=")) history.replaceState(null, "", location.pathname + location.hash);
  await setSession(data.session);
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
      if ((session && session.user.id) !== S.uid) setSession(session);
    }
  });
  // datos frescos al volver a la pestaña
  document.addEventListener("visibilitychange", () => { if (!document.hidden && S.modMode!=="edit") refreshAll(); });
}
boot();
})();
