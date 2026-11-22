/* Calcoli dell'app "Le mie spese" (identici al prototipo approvato da Denis).
   Nessun accesso alla pagina: si possono provare anche con Node (vedi test/). */
"use strict";
/* ===== Costanti ===== */
const GROUPS = [
  { id: "nec", n: "Spese necessarie", cls: "gnec" },
  { id: "ext", n: "Spese extra", cls: "gext" },
  { id: "inv", n: "Investimenti", cls: "ginv" },
  { id: "tax", n: "Imposte e contributi", cls: "gtax" },
  { id: "ent", n: "Entrate", cls: "gent" },
  { id: "cre", n: "Crediti", cls: "" },
  { id: "esc", n: "Esclusi dai conteggi", cls: "" }
];
const GDEF = { nec: { e: "🧾", col: "#e8a800" }, ext: { e: "🎈", col: "#e03131" }, inv: { e: "📈", col: "#1c7ed6" }, tax: { e: "🏛️", col: "#868e96" }, ent: { e: "💶", col: "#2f9e44" }, cre: { e: "🤝", col: "#7048e8" }, esc: { e: "🚫", col: "#ced4da" } };
/* Emoji e colori delle categorie (rosso extra, giallo necessarie, grigio imposte, blu investimenti e formazione, verde entrate) */
const META = {
  casa: ["🏠", "#f2b705"], spesa: ["🛒", "#e8a800"], salute: ["💊", "#d4a017"], cura: ["💇", "#f5c542"], carb: ["⛽", "#c99a00"], auto: ["🚗", "#e0a100"],
  pedaggi: ["🛣️", "#b8860b"], tel: ["📱", "#ffcf33"], vestiti: ["👕", "#d9a400"], animali: ["🐾", "#e6c35c"], sport: ["🏋️", "#f0ad00"], assic: ["🛡️", "#c7a03a"],
  risto: ["🍕", "#e03131"], zona: ["📍", "#c92a2a"], viaggi: ["✈️", "#f03e3e"], regali: ["🎁", "#fa5252"], abbon: ["📺", "#b02525"], formaz: ["📚", "#1c7ed6"],
  brico: ["🔨", "#ff6b6b"], benef: ["💝", "#d6336c"], altre: ["📦", "#a61e4d"],
  merc: ["📈", "#1971c2"], oro: ["🪙", "#339af0"], cripto: ["💎", "#1864ab"], airbnb: ["🏡", "#4dabf7"], prof: ["💼", "#e6b800"],
  tasse: ["🏛️", "#868e96"],
  stip: ["💶", "#2f9e44"], extra: ["💰", "#37b24d"], mance: ["💵", "#2b8a3e"], royal: ["🎵", "#51cf66"], altrent: ["➕", "#40c057"],
  cred: ["🤝", "#e8590c"], offerto: ["🎉", "#f06595"], noconta: ["🚫", "#adb5bd"]
};
const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const MESI3 = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const FREQ = { 1: "Ogni mese", 2: "Ogni 2 mesi", 3: "Ogni 3 mesi", 6: "Ogni 6 mesi", 12: "Ogni anno" };
const PAT_TIPI = [
  { id: "liq", n: "Liquidità (a)", lato: "att" }, { id: "ill", n: "Beni non liquidi (b)", lato: "att" }, { id: "cap", n: "Beni personali (c)", lato: "att" },
  { id: "pb", n: "Debiti a breve (d)", lato: "pas" }, { id: "pl", n: "Debiti a lungo termine (e)", lato: "pas" }, { id: "pc", n: "Debiti per beni personali (f)", lato: "pas" }
];

/* ===== Utilità ===== */
const pad = n => String(n).padStart(2, "0");
const isoDate = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const todayISO = () => isoDate(new Date());
const daysIn = (y, m) => new Date(y, m, 0).getDate();
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const r2 = x => Math.round(x * 100) / 100;
function eur(x, dec) {
  if (x == null || isNaN(x)) return "-";
  const d = dec == null ? 2 : dec;
  return x.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d }) + "€";
}
const eur0 = x => eur(x, 0);
const sgn = x => x < -0.004 ? "neg" : x > 0.004 ? "pos" : "";
function parseNum(v) { if (v == null) return NaN; const s = String(v).trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."); return s === "" ? NaN : Number(s); }
function fmtDay(iso) { const d = new Date(iso + "T12:00:00"); return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }); }
function fmtShort(iso) { const [y, m, d] = iso.split("-"); return d + "/" + m + "/" + y; }
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
const gname = g => (GROUPS.find(x => x.id === g) || { n: "" }).n;

/* ===== Stato (riempito da dati.js) ===== */
let S = null;
function applyMeta(c) { const m = META[c.id]; if (m) { c.e = m[0]; c.col = m[1]; } else { c.e = c.e || GDEF[c.g].e; c.col = c.col || GDEF[c.g].col; } return c; }
/* Descrizioni uniformate: varianti e errori di battitura diventano un'unica voce */
const CANON = {
  "pineta": "Bar Pineta", "bar pineta": "Bar Pineta", "caffe pineta": "Bar Pineta",
  "caffe": "Caffè", "caffe fino": "Caffè Fino", "minuscoli": "Bar Minuscoli", "caffe minuscoli": "Bar Minuscoli",
  "pizza": "Pizza", "ricarica cell": "Ricarica cellulare", "ricarica telefono": "Ricarica cellulare", "ricarica tim": "Ricarica cellulare",
  "prime": "Amazon Prime", "amazon prime": "Amazon Prime", "vkey": "Vikey", "vikey": "Vikey", "stipendio": "Stipendio",
  "autostrada": "Autostrada", "pedaggio": "Autostrada", "autostrada milini": "Autostrada Milini", "autostrada x milini": "Autostrada Milini", "autostrada per milini": "Autostrada Milini",
  "gpl": "GPL", "beneficienza": "Beneficenza", "dechatlon": "Decathlon", "mercato finanziario": "Mercato finanziario"
};
function canonDesc(t, c) {
  const n = norm(t);
  if (c === "carb" || (!c && LIT.test(t || ""))) { if (/\bgpl\b/.test(n)) return "GPL"; if (!n || n === "benzina" || n === "l" || n === "l benzina") return "Benzina"; }
  return CANON[n] || null;
}

/* ===== Indici e categorie ===== */
let CACHE = {};
function invalidate() { CACHE = {}; }
function catMap() { if (!CACHE.cm) { CACHE.cm = {}; S.cats.forEach(c => CACHE.cm[c.id] = c); } return CACHE.cm; }
function cat(id) { return catMap()[id]; }
function catName(id) { if (!id || id === "__nc") return "Senza categoria"; const c = cat(id); return c ? c.n : "Categoria eliminata"; }
function catEmo(id) { if (!id || id === "__nc") return "❓"; const c = cat(id); return c ? c.e : "❓"; }
function catLab(id) { return catEmo(id) + " " + catName(id); }
function catCol(id) { const c = cat(id); return c ? c.col : "#adb5bd"; }
function grpOf(id) { if (!id || id === "__nc") return "nc"; const c = cat(id); return c ? c.g : "nc"; }
function catsOf(g) { return S.cats.filter(c => c.g === g); }
function sortMovs() { S.movs.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : ((b.r ? 1 : 0) - (a.r ? 1 : 0))); }
function years() { const ys = new Set(S.movs.map(m => +m.d.slice(0, 4))); ys.add(new Date().getFullYear()); return [...ys].sort(); }
/* ===== Smistamento nel tempo =====
   - Percentuali "standard": in Impostazioni con chiavi smist_dal_aaaa-mm ("id:percentuale:correzione;..."),
     valgono da quel mese in poi. Se non ce n'è nessuna valgono quelle della scheda Conti.
   - Percentuali di un solo mese: chiave smist_mese_aaaa-mm (stesso formato), modificate dalla schermata Mese.
   - La scheda Conti tiene nomi, conto spese / conto imposte e le percentuali standard più recenti. */
const ymOf = (y, mo) => y + "-" + pad(mo);
function parseSmist(s) { const r = {}; String(s || "").split(";").forEach(x => { const [id, p, f] = x.split(":"); if (id) r[id] = { p: parseNum(p) || 0, fix: parseNum(f) || 0 }; }); return r; }
function serSmist(m) { return Object.keys(m).map(id => id + ":" + r2(+m[id].p || 0) + ":" + r2(+m[id].fix || 0)).join(";"); }
function smistConti() { const r = {}; S.acc.forEach(a => r[a.id] = { p: +a.p || 0, fix: +a.fix || 0 }); return r; }
function versioniSmist() { return Object.keys(S.imp).filter(k => /^smist_dal_\d{4}-\d{2}$/.test(k) && S.imp[k]).map(k => k.slice(10)).sort(); }
function smistStd(ym) { const v = versioniSmist().filter(x => x <= ym).pop(); return v ? parseSmist(S.imp["smist_dal_" + v]) : smistConti(); }
function smistPersonalizzato(y, mo) { return !!S.imp["smist_mese_" + ymOf(y, mo)]; }
function smistMese(y, mo) { const k = "smist_mese_" + ymOf(y, mo); return S.imp[k] ? parseSmist(S.imp[k]) : smistStd(ymOf(y, mo)); }
/* Conti con le percentuali in vigore in quel mese (senza mese: quelle della scheda Conti) */
function contiDelMese(y, mo) { if (!y) return S.acc; const m = smistMese(y, mo); return S.acc.map(a => Object.assign({}, a, m[a.id] || { p: 0, fix: 0 })); }
function spendAcc(y, mo) { const L = contiDelMese(y, mo); return L.find(a => a.spesa) || L[0]; }
function taxAcc(y, mo) { return contiDelMese(y, mo).find(a => a.tasse); }
function taxP(y, mo) { const t = taxAcc(y, mo); return (t ? +t.p : 30) / 100; }
/* Obiettivi di spesa per anno: chiave obiettivi_aaaa ("id:valore,..."); se manca valgono quelli della scheda Categorie */
function objFor(y) {
  const s = S.imp["obiettivi_" + y]; const base = S.objBase || S.obj || {};
  if (!s) return Object.assign({}, base);
  const r = {}; s.split(",").forEach(x => { const [id, v] = x.split(":"); const n = parseNum(v); if (id && n > 0) r[id] = n; }); return r;
}
const serObj = o => Object.keys(o).filter(k => o[k] > 0).sort().map(k => k + ":" + r2(o[k])).join(",");
const LORDO = () => (S.imp.mostra_lordo || "SI") !== "NO";
/* Impostazioni per anno (scheda Impostazioni del foglio) */
function impNum(k) { const v = parseNum(S.imp[k]); return isNaN(v) ? null : v; }
/* Ogni anno riparte da zero: bilancio di partenza di gennaio e imposte già accantonate si scrivono a mano (di partenza 0) */
function ripAnno(y) { return impNum("riporto_iniziale_" + y) || 0; }
function taxIni(y) { return impNum("imposte_accantonate_inizio_" + y) || 0; }
/* Patrimonio di un anno: voci e obiettivo */
function patFor(y) { return { anno: y, obiettivo: impNum("obiettivo_patrimonio_" + y) || 0, voci: S.patRows.filter(v => +v.anno === +y) }; }

/* Quote di una spesa: la mia parte nella sua categoria, il resto in Cose offerte o Crediti.
   Un credito restituito (saldato) non conta più come spesa. */
function contrib(m) {
  const c = m.c || "__nc";
  if (c === "noconta") return [];
  if (c === "cred" && m.ok && !m.sh) return [];
  if (!m.sh || grpOf(c) === "ent") return [[c, m.a]];
  const out = [[c, m.sh.mia]]; const rest = r2(m.a - m.sh.mia);
  if (rest > 0 && !(m.sh.tipo === "cred" && m.sh.ok)) out.push([m.sh.tipo === "reg" ? (cat("offerto") ? "offerto" : cat("regali") ? "regali" : c) : "cred", rest]);
  return out;
}

/* Riepilogo di un mese */
/* Entrate tassate: su queste (e solo su queste) si accantona la percentuale del conto imposte.
   Si scelgono in Altro, Categorie; di partenza Stipendio fisso ed Extra lavoro tassato. */
function tassate() { return (S.imp.categorie_tassate != null ? S.imp.categorie_tassate : "stip,extratax").split(",").map(x => x.trim()).filter(Boolean); }
function isTassata(id) { return tassate().includes(id); }
/* Entrate NON tassate: la percentuale del conto imposte non va accantonata ma si ripartisce sugli altri conti
   come sceglie Denis in Altro, Smistamento (impostazione "ripartizione_non_tassate", es. "risparmi:20,spese:10").
   Se non è indicata, va tutta sul conto "conto_entrate_non_tassate" (o sul primo conto di risparmio). */
function contoNonTassate() { const id = S.imp.conto_entrate_non_tassate; const a = S.acc.find(x => x.id === id && !x.tasse); return a || S.acc.find(x => !x.tasse && !x.spesa) || S.acc.find(x => !x.tasse); }
function ripNonTassate(tpPct) {
  const r = {}; const s = S.imp.ripartizione_non_tassate;
  if (s != null && s !== "") { s.split(",").forEach(p => { const [id, v] = p.split(":"); const n = parseNum(v); if (id && n > 0) r[id.trim()] = n; }); return r; }
  const t = taxAcc(), d = contoNonTassate(); if (t && d) r[d.id] = tpPct != null ? tpPct : (+t.p || 0); return r;
}
/* a = conto (con le percentuali del mese); tpPct = percentuale del conto imposte in quel mese */
function pctNonTassate(a, tpPct) { if (a.tasse) return 0; return (+a.p || 0) + (ripNonTassate(tpPct)[a.id] || 0); }
function emptyAgg() { return { cat: {}, catS: {}, nec: 0, ext: 0, nc: 0, inv: 0, tax: 0, cre: 0, ent: 0, stip: 0, entExtra: 0, entTax: 0, entExtraTax: 0, taxAcc: 0, straord: 0, spese: 0, n: 0, ncCount: 0, movs: [] }; }
function monthAgg(y, mo) {
  const k = "m" + y + "-" + mo; if (CACHE[k]) return CACHE[k];
  const pre = y + "-" + pad(mo);
  const A = emptyAgg();
  for (const m of S.movs) {
    if (!m.d.startsWith(pre)) continue;
    A.movs.push(m);
    if (m.c === "noconta") continue;
    A.n++;
    if (!m.c) A.ncCount++;
    for (const [c, amt] of contrib(m)) {
      const g = grpOf(c);
      if (g === "ent") {
        A.ent += amt; if (c === "stip") A.stip += amt; else A.entExtra += amt; A.cat[c] = (A.cat[c] || 0) + amt;
        if (isTassata(c)) { A.entTax += amt; if (c !== "stip") A.entExtraTax += amt; }
        continue;
      }
      if (g === "cre") { A.cre += amt; A.cat[c] = (A.cat[c] || 0) + amt; continue; }
      if (g === "inv" || g === "tax") { A[g] += amt; A.cat[c] = (A.cat[c] || 0) + amt; continue; }
      if (m.s) { A.straord += amt; A.catS[c] = (A.catS[c] || 0) + amt; continue; }
      A.cat[c] = (A.cat[c] || 0) + amt; A[g] += amt;
    }
  }
  A.spese = A.nec + A.ext + A.nc;
  A.y = y; A.mo = mo;
  A.taxAcc = A.entTax * taxP(y, mo); // imposte accantonate sulle entrate tassate del mese (per risultato e tabelle)
  CACHE[k] = A; return A;
}
function catAmt(A, c, inclS) { return (A.cat[c] || 0) + (inclS ? (A.catS[c] || 0) : 0); }
function yearAgg(y) {
  const k = "y" + y; if (CACHE[k]) return CACHE[k];
  const Y = emptyAgg(); Y.months = [];
  for (let m = 1; m <= 12; m++) {
    const A = monthAgg(y, m); Y.months.push(A);
    for (const c in A.cat) Y.cat[c] = (Y.cat[c] || 0) + A.cat[c];
    for (const c in A.catS) Y.catS[c] = (Y.catS[c] || 0) + A.catS[c];
    ["nec", "ext", "nc", "inv", "tax", "ent", "stip", "entExtra", "entTax", "entExtraTax", "taxAcc", "straord", "spese", "cre", "n", "ncCount"].forEach(f => Y[f] += A[f]);
  }
  Y.nMesi = Y.months.filter(a => a.n > 0).length || 1;
  CACHE[k] = Y; return Y;
}

/* Budget mese per mese: soldi del mese (quota spese dello stipendio + quota spese delle entrate extra del mese prima) e saldo dei mesi precedenti */
function firstYear() { return Math.min.apply(null, years()); }
function budgetYear(y) {
  const k = "b" + y; if (CACHE[k]) return CACHE[k];
  let rip = ripAnno(y); // ogni anno riparte dal suo bilancio di partenza (di solito 0)
  const now = new Date(); const res = [];
  for (let mo = 1; mo <= 12; mo++) {
    const fut = y > now.getFullYear() || (y === now.getFullYear() && mo > now.getMonth() + 1);
    if (fut) { res.push(null); continue; }
    const A = monthAgg(y, mo);
    // Percentuali in vigore in questo mese (standard o personalizzate)
    const L = contiDelMese(y, mo); const sp = L.find(a => a.spesa) || L[0]; const ta = L.find(a => a.tasse);
    const p = (sp ? +sp.p : 0) / 100, fix = sp ? +sp.fix || 0 : 0; const tpPct = ta ? +ta.p || 0 : 30; const tp = tpPct / 100;
    const prev = mo > 1 ? monthAgg(y, mo - 1) : (y - 1 >= firstYear() ? monthAgg(y - 1, 12) : { entExtra: 0, entExtraTax: 0 });
    const base = A.stip > 0 ? A.stip * p + fix : 0;
    // Entrate extra del mese prima: le tassate con la percentuale normale, le non tassate con quella "senza imposte"
    const pNT = sp ? pctNonTassate(sp, tpPct) / 100 : 0;
    const qExtra = prev.entExtraTax * p + (prev.entExtra - prev.entExtraTax) * pNT;
    const mese = base + qExtra;
    const disp = mese + rip;
    const saldo = disp - A.spese;
    // Imposte da accantonare: solo sulle entrate tassate (stipendio del mese + extra tassati del mese prima)
    const accTax = (isTassata("stip") ? A.stip : 0) * tp + prev.entExtraTax * tp;
    // avanzo = quanto resta sul conto spese a fine mese (quota del mese meno spese del mese): va spostato sul conto degli avanzi
    res.push({ mo, base, qExtra, mese, rip, disp, spese: A.spese, saldo, avanzo: mese - A.spese, personalizzato: smistPersonalizzato(y, mo), extraPrev: prev.entExtra, accTax, versTax: A.tax });
    rip = saldo;
  }
  CACHE[k] = res; return res;
}

/* Colori rispetto all'obiettivo (soglie scelte da Denis) */
function stato(p) {
  if (p < 50) return { c: "var(--s-ok)", l: "Ottimo" };
  if (p < 80) return { c: "var(--s-bene)", l: "Bene" };
  if (p < 95) return { c: "var(--s-att)", l: "Attenzione" };
  if (p < 100) return { c: "var(--s-lim)", l: "Al limite" };
  if (p <= 120) return { c: "var(--s-lim)", l: "Sforato" };
  return { c: "var(--s-fuori)", l: "Fuori controllo" };
}
/* Colori rispetto al ritmo del mese: speso in proporzione ai giorni passati */
function statoRitmo(spent, budget, frac) {
  if (budget <= 0) return { c: spent > 0 ? "var(--s-fuori)" : "var(--s-ok)", l: spent > 0 ? "Nessun budget" : "Ottimo", i: spent > 0 ? 999 : 0 };
  const i = spent / (budget * Math.max(frac, 0.05)) * 100;
  if (i <= 80) return { c: "var(--s-ok)", l: frac < 1 ? "Sotto il ritmo" : "Ottimo", i };
  if (i <= 95) return { c: "var(--s-bene)", l: "In linea", i };
  if (i <= 105) return { c: "var(--s-att)", l: "Al limite", i };
  if (i <= 120) return { c: "var(--s-lim)", l: frac < 1 ? "Sopra il ritmo" : "Sforato", i };
  return { c: "var(--s-fuori)", l: "Fuori controllo", i };
}
/* Barra: se sei oltre il 100% la scala si allarga, così si vede di quanto sei fuori.
   La lineetta indica dove dovresti essere (oggi, oppure il 100% se non c'è un ritmo): bianca sopra la parte colorata, scura sul fondo. */
function barCol(p, col, tick, h) {
  p = Math.max(0, p || 0);
  const scale = Math.max(100, p);
  const ref = tick != null ? tick : (p > 100 ? 100 : null);
  const w = p / scale * 100;
  let em = "";
  if (ref != null) { const x = Math.min(100, ref / scale * 100); em = `<em style="left:calc(${x.toFixed(1)}% - 1px);background:${w >= x ? "#ffffff" : "var(--ink)"};opacity:${w >= x ? 1 : .55}" title="${tick != null ? "dove dovresti essere oggi" : "limite dell'obiettivo"}"></em>`; }
  return `<div class="bar"${h ? ` style="height:${h}px"` : ""}><i style="width:${w.toFixed(1)}%;background:${col}"></i>${em}</div>`;
}
function barHTML(p, tick) { return barCol(p, stato(p).c, tick); }
function pillHTML(p) { const st = stato(p); return `<span class="pill" style="background:${st.c}">${Math.round(p)}% ${st.l}</span>`; }
function pillSt(st, txt) { return `<span class="pill" style="background:${st.c}">${txt ? txt + " " : ""}${st.l}</span>`; }
function monthFrac(y, mo) { const n = new Date(); if (y === n.getFullYear() && mo === n.getMonth() + 1) return n.getDate() / daysIn(y, mo); if (y > n.getFullYear() || (y === n.getFullYear() && mo > n.getMonth() + 1)) return 0; return 1; }

/* ===== Categoria suggerita dalla descrizione ===== */
const LIT = /(\d+(?:[.,]\d+)?)\s*l\b/i;
function norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\d+([.,]\d+)?\s*l\b/g, " ").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim(); }
function model() {
  if (CACHE.model) return CACHE.model;
  const ex = {}, tok = {}, descs = {};
  for (const m of S.movs) {
    if (!m.c) continue;
    const n = norm(m.t); if (!n) continue;
    (ex[n] = ex[n] || {})[m.c] = (ex[n][m.c] || 0) + 1;
    for (const t of n.split(" ")) if (t.length >= 3) (tok[t] = tok[t] || {})[m.c] = (tok[t][m.c] || 0) + 1;
    const d = descs[n] || (descs[n] = { t: m.t.trim(), n: 0, c: {} }); d.n++; d.t = m.t.trim(); d.c[m.c] = (d.c[m.c] || 0) + 1;
  }
  CACHE.model = { ex, tok, descs }; return CACHE.model;
}
/* Spese frequenti: descrizioni comparse almeno 5 volte negli ultimi 12 mesi, con la categoria più usata */
function frequent(tipo) {
  const k = "fq" + tipo; if (CACHE[k]) return CACHE[k];
  const okG = OKG(tipo); const lim = new Date(); lim.setFullYear(lim.getFullYear() - 1); const from = isoDate(lim);
  const G = {};
  for (const m of S.movs) {
    if (m.d < from || !m.c || !okG.includes(grpOf(m.c))) continue;
    const n = norm(m.t) || (m.c === "carb" ? "benzina" : ""); if (!n) continue;
    const g = G[n] || (G[n] = { t: m.t.trim(), n: 0, c: {} }); g.n++; g.t = m.t.trim(); g.c[m.c] = (g.c[m.c] || 0) + 1;
  }
  CACHE[k] = Object.values(G).filter(g => g.n >= 5).sort((a, b) => b.n - a.n).map(g => ({ t: g.t, c: topKey(g.c), n: g.n }));
  return CACHE[k];
}
function topKey(o) { let b = null, v = -1; for (const k in o) if (o[k] > v) { v = o[k]; b = k; } return b; }
const OKG = tipo => tipo === "ent" ? ["ent"] : ["nec", "ext", "inv", "tax", "esc"];
function suggestCat(desc, tipo) {
  const okG = OKG(tipo);
  const filt = o => { const r = {}; for (const k in o) if (okG.includes(grpOf(k))) r[k] = o[k]; return r; };
  if (tipo !== "ent" && (LIT.test(desc) || /\b(gpl|benz|benzina|diesel|gasolio)\b/.test(norm(desc))) && cat("carb")) return "carb";
  const M = model(); const n = norm(desc); if (!n) return null;
  const sc = {};
  if (M.ex[n]) { const f = filt(M.ex[n]); for (const c in f) sc[c] = f[c] * 3; }
  for (const t of n.split(" ")) {
    if (t.length < 3) continue;
    let o = M.tok[t];
    if (!o) { const k = Object.keys(M.tok).find(x => x.startsWith(t) && t.length >= 4); if (k) o = M.tok[k]; }
    if (!o) continue;
    const f = filt(o); const tot = Object.values(f).reduce((a, b) => a + b, 0);
    for (const c in f) sc[c] = (sc[c] || 0) + f[c] / tot;
  }
  return topKey(sc);
}
function descSuggestions(q, tipo) {
  const n = norm(q); if (n.length < 2) return [];
  const okG = OKG(tipo); const M = model();
  return Object.entries(M.descs).filter(([k, d]) => k.includes(n) && okG.includes(grpOf(topKey(d.c))) && k !== n)
    .sort((a, b) => (b[0].startsWith(n) - a[0].startsWith(n)) || b[1].n - a[1].n).slice(0, 5).map(([k, d]) => ({ t: d.t, c: topKey(d.c), n: d.n }));
}


/* ===== Crediti e debiti ===== */
function allCred() {
  const out = S.cred.map(c => Object.assign({ src: "man" }, c));
  for (const m of S.movs) if (m.c === "cred" && !m.sh) out.push({ id: "mv_" + m.id, mov: m.id, tipo: "credito", chi: m.chi || "Senza nome", a: m.a, mot: m.t, d: m.d, ok: !!m.ok, src: "mov" });
  for (const m of S.movs) if (m.sh && m.sh.tipo === "cred" && m.a - m.sh.mia > 0) out.push({ id: "mv_" + m.id, mov: m.id, tipo: "credito", chi: m.sh.chi || "Senza nome", a: r2(m.a - m.sh.mia), mot: m.t, d: m.d, ok: !!m.sh.ok, src: "mov" });
  return out.sort((a, b) => a.d < b.d ? 1 : -1);
}

/* ===== Carburante ===== */
function fuelStats(y) {
  const fm = S.movs.filter(m => m.c === "carb" && (!y || m.d.startsWith(String(y))));
  const tot = fm.reduce((s, m) => s + m.a, 0);
  const withL = fm.filter(m => m.l > 0);
  const lit = withL.reduce((s, m) => s + m.l, 0), spL = withL.reduce((s, m) => s + m.a, 0);
  const km = S.km.slice().sort((a, b) => a.d < b.d ? -1 : 1);
  let kml = null, kmTot = null;
  if (km.length >= 2) {
    const a = km[0], b = km[km.length - 1];
    const l = S.movs.filter(m => m.c === "carb" && m.l > 0 && m.d > a.d && m.d <= b.d).reduce((s, m) => s + m.l, 0);
    kmTot = b.km - a.km; if (l > 0) kml = kmTot / l;
  }
  const per = {};
  for (const t of ["benzina", "gpl"]) { const f = fm.filter(m => (m.ft || "benzina") === t); const fl = f.filter(m => m.l > 0); const l = fl.reduce((s, m) => s + m.l, 0); per[t] = { tot: f.reduce((s, m) => s + m.a, 0), lit: l, prezzo: l > 0 ? fl.reduce((s, m) => s + m.a, 0) / l : null, n: f.length }; }
  let eKm = null;
  if (km.length >= 2 && kmTot > 0) { const a = km[0], b = km[km.length - 1]; eKm = S.movs.filter(m => m.c === "carb" && m.d > a.d && m.d <= b.d).reduce((s, m) => s + m.a, 0) / kmTot; }
  return { tot, lit, prezzo: lit > 0 ? spL / lit : null, n: fm.length, nL: withL.length, kml, kmTot, km, per, eKm };
}
function kmDue() { if (!cat("carb")) return false; const km = S.km.slice().sort((a, b) => a.d < b.d ? -1 : 1); const last = km[km.length - 1]; if (!last) return true; return (Date.now() - new Date(last.d + "T12:00:00").getTime()) / 864e5 > 90; }

/* ===== Risultato, imposte, quote dell'anno, patrimonio ===== */
function resultOf(A) {
  const lordo = LORDO(), tp = taxP();
  return A.ent - A.taxAcc - A.spese - (UI.tS ? A.straord : 0) - (UI.tI ? A.inv : 0);
}
function taxFund(y) {
  const B = budgetYear(y); let acc = 0, vers = 0; const rows = [];
  let saldo = taxIni(y);
  B.forEach((b, i) => { if (!b) return; acc += b.accTax; vers += b.versTax; saldo += b.accTax - b.versTax; rows.push({ mo: i + 1, acc: b.accTax, vers: b.versTax, saldo }); });
  return { acc, vers, saldo, rows };
}
/* Spese da inizio anno rispetto alla somma delle quote spese dei mesi */
function yearQuota(y) {
  const bs = budgetYear(y).filter(Boolean); if (!bs.length) return null;
  const q = bs.reduce((s, b) => s + b.mese, 0), sp = bs.reduce((s, b) => s + b.spese, 0);
  const last = bs[bs.length - 1]; const fr = monthFrac(y, last.mo); const exp = q - last.mese * (1 - fr);
  const st = statoRitmo(sp, q, q > 0 ? exp / q : 1); const p = q > 0 ? sp / q * 100 : 0;
  return { q, sp, fr, exp, st, p, tick: fr < 1 && q > 0 ? exp / q * 100 : null };
}
function patTot(fld, voci) {
  const t = {}; PAT_TIPI.forEach(x => t[x.id] = 0);
  for (const v of voci) { const val = v[fld]; if (val != null && val !== "" && !isNaN(val)) t[v.t] += +val; }
  t.att = t.liq + t.ill + t.cap; t.pas = t.pb + t.pl + t.pc; t.net = t.att - t.pas; return t;
}
/* Patrimonio: stima di oggi (o valore vero se è compilata la colonna di fine anno) e indici */
function patStima(y) {
  const P = patFor(y); const I = patTot("ini", P.voci); const hasFin = P.voci.some(v => v.fin != null && v.fin !== ""); const F = patTot("fin", P.voci);
  const Y = yearAgg(y); const tp = taxP();
  const tasseStim = Y.taxAcc;
  const spCons = Y.spese + Y.straord;
  const stima = I.net + Y.ent - spCons - tasseStim;
  const att = hasFin ? F.net : stima;
  const pr = P.obiettivo > I.net ? (att - I.net) / (P.obiettivo - I.net) * 100 : 0;
  const n = Y.nMesi; const Bauto = (Y.cat.royal || 0) / n; const Aatt = (Y.ent / n) - Bauto;
  const C = (Y.spese / n) + tasseStim / n;
  const liq = hasFin ? F.liq : I.liq; const net = hasFin ? F.net : I.net;
  return { P, I, F, hasFin, Y, tp, tasseStim, spCons, stima, att, pr, n, Bauto, Aatt, C, liq, net };
}
