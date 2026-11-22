/* Collegamento al Google Foglio tramite il ponte Apps Script.
   - Indirizzo e chiave restano solo in questo browser (localStorage).
   - All'apertura si mostra subito l'ultima copia salvata sul dispositivo, poi si aggiorna dal foglio.
   - Ogni modifica (persist) viene confrontata con l'ultima copia inviata: le differenze vanno in una coda
     che parte subito, oppure appena torna la connessione. */
"use strict";

const VERSIONE_APP = "10"; // uguale al numero di VERSIONE in sw.js
const K_CFG = "spese-collegamento", K_DATI = "spese-dati", K_CODA = "spese-coda";

let SNAP = null;      // ultima copia nota del foglio (più le modifiche già in coda), per trovare le differenze
let CODA = [];        // modifiche da inviare: { action, data }
let STATO = "ok";     // ok | invio | attesa | errore | carico
let ERRORE = "";      // ultimo messaggio di errore
let GEN = 0;          // cresce a ogni modifica: serve a ignorare letture del foglio arrivate "vecchie"

/* ===== Collegamento ===== */
function leggiCfg() { try { const c = JSON.parse(localStorage.getItem(K_CFG) || "null"); return c && c.url && c.key ? c : null; } catch (e) { return null; } }
function salvaCfg(c) { try { localStorage.setItem(K_CFG, JSON.stringify(c)); } catch (e) { } }
function scollega() {
  try { [K_CFG, K_DATI, K_CODA].forEach(k => localStorage.removeItem(k)); } catch (e) { }
  S = null; SNAP = null; CODA = []; ERRORE = ""; STATO = "ok"; aggiornaIndicatore();
}
function mascheraUrl(u) { return u.replace(/\/s\/([\w-]{6})[\w-]+([\w-]{4})\/exec$/, "/s/$1...$2/exec"); }

/* Chiamata al ponte. Errore con .rete = true se manca la connessione. */
async function chiamaPonte(action, data, cfg) {
  cfg = cfg || leggiCfg();
  if (!cfg) throw new Error("Dispositivo non collegato");
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 60000) : null;
  let res;
  try {
    // text/plain evita il controllo preliminare CORS che Apps Script non gestisce; il reindirizzamento di Google viene seguito da solo
    res = await fetch(cfg.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ key: cfg.key, action, data }), signal: ctrl ? ctrl.signal : undefined, redirect: "follow" });
  } catch (e) {
    const er = new Error("Connessione assente o troppo lenta"); er.rete = true; throw er;
  } finally { if (timer) clearTimeout(timer); }
  let j;
  try { j = await res.json(); } catch (e) {
    const er = new Error("Il ponte non ha risposto correttamente (codice " + res.status + "). Controlla che sia pubblicato per \"Chiunque\".");
    er.rete = res.status >= 500; throw er;
  }
  if (!j.ok) throw new Error(j.errore || "Errore sconosciuto");
  return j;
}

/* ===== Conversione tra righe del foglio e dati dell'app ===== */
const SI = v => v === true || String(v == null ? "" : v).trim().toUpperCase() === "SI";
const numO = v => { if (v === "" || v == null) return null; const n = typeof v === "number" ? v : parseNum(v); return isNaN(n) ? null : n; };
const txt = v => v == null ? "" : String(v);

function rigaInMov(r) {
  const m = { id: txt(r.id), d: txt(r.data).slice(0, 10), t: txt(r.descrizione), c: r.categoria ? txt(r.categoria) : null, a: numO(r.importo) || 0 };
  if (r.nota) m.n = txt(r.nota);
  if (SI(r.straordinaria)) m.s = 1;
  const l = numO(r.litri); if (l > 0) m.l = l;
  if (m.c === "carb") m.ft = r.carburante === "gpl" ? "gpl" : "benzina";
  if (r.divisa_tipo === "credito" || r.divisa_tipo === "offerto") {
    m.sh = { mia: numO(r.quota_mia) || 0, tipo: r.divisa_tipo === "offerto" ? "reg" : "cred", chi: txt(r.persona), ok: SI(r.credito_saldato) };
  } else {
    if (r.persona) m.chi = txt(r.persona);
    if (SI(r.credito_saldato)) m.ok = true;
  }
  if (r.ricorrente_id) m.r = txt(r.ricorrente_id);
  if (SI(r.da_verificare)) m.dv = 1;
  if (r.origine) m.o = txt(r.origine);
  return m;
}
function movInRiga(m) {
  return {
    id: m.id, data: m.d, descrizione: m.t || "", categoria: m.c || "", importo: m.a,
    quota_mia: m.sh ? m.sh.mia : "", divisa_tipo: m.sh ? (m.sh.tipo === "reg" ? "offerto" : "credito") : "",
    persona: m.sh ? (m.sh.chi || "") : (m.chi || ""), credito_saldato: (m.sh ? m.sh.ok : m.ok) ? "SI" : "",
    straordinaria: m.s ? "SI" : "", litri: m.l || "", carburante: m.c === "carb" ? (m.ft || "benzina") : "",
    nota: m.n || "", ricorrente_id: m.r || "", da_verificare: m.dv ? "SI" : "", origine: m.o || "app"
  };
}
const catInRiga = c => ({ id: c.id, nome: c.n, gruppo: c.g, emoji: c.e || "", colore: c.col || "", obiettivo_mensile: (S.objBase || S.obj)[c.id] || "", attiva: c.off ? "NO" : "SI" });
const contoInRiga = a => ({ id: a.id, nome: a.n, percentuale: +a.p || 0, correzione_fissa: +a.fix || 0, conto_spese: a.spesa ? "SI" : "NO", conto_imposte: a.tasse ? "SI" : "NO" });
const ricInRiga = r => ({ id: r.id, descrizione: r.t, categoria: r.c || "", importo: r.a, ogni_mesi: +r.freq || 1, dal_mese: r.from || "", al_mese: r.to || "" });
const credInRiga = c => ({ id: c.id, tipo: c.tipo, persona: c.chi, importo: c.a, motivo: c.mot || "", data: c.d, saldato: c.ok ? "SI" : "NO" });
const patInRiga = v => ({ anno: +v.anno, id: v.id, voce: v.n, tipo: v.t, inizio_anno: v.ini == null ? "" : v.ini, fine_anno: v.fin == null ? "" : v.fin });
const kmInRiga = k => ({ data: k.d, km: k.km, nota: k.n || "" });

/* Dati del foglio (risposta di "tutto") → stato dell'app */
function daFoglio(j) {
  const s = { cats: [], movs: [], obj: {}, acc: [], ric: [], cred: [], patRows: [], km: [], imp: {}, agg: Date.now() };
  for (const r of j.categorie || []) {
    if (!r.id) continue;
    s.cats.push({ id: txt(r.id), n: txt(r.nome), g: txt(r.gruppo), e: txt(r.emoji), col: txt(r.colore) || "#adb5bd", off: txt(r.attiva).toUpperCase() === "NO" });
    const o = numO(r.obiettivo_mensile); if (o > 0) s.obj[r.id] = o;
  }
  s.objBase = Object.assign({}, s.obj); s.objAnno = null; // obiettivi della scheda Categorie; quelli per anno stanno in Impostazioni
  s.acc = (j.conti || []).filter(r => r.id).map(r => ({ id: txt(r.id), n: txt(r.nome), p: numO(r.percentuale) || 0, fix: numO(r.correzione_fissa) || 0, spesa: SI(r.conto_spese), tasse: SI(r.conto_imposte) }));
  s.ric = (j.ricorrenti || []).filter(r => r.id).map(r => ({ id: txt(r.id), t: txt(r.descrizione), c: txt(r.categoria), a: numO(r.importo) || 0, freq: +r.ogni_mesi || 1, from: txt(r.dal_mese).slice(0, 7), to: txt(r.al_mese).slice(0, 7) }));
  s.cred = (j.crediti || []).filter(r => r.id).map(r => ({ id: txt(r.id), tipo: r.tipo === "debito" ? "debito" : "credito", chi: txt(r.persona), a: numO(r.importo) || 0, mot: txt(r.motivo), d: txt(r.data).slice(0, 10), ok: SI(r.saldato) }));
  s.patRows = (j.patrimonio || []).filter(r => r.id).map(r => ({ anno: +r.anno, id: txt(r.id), n: txt(r.voce), t: txt(r.tipo), ini: numO(r.inizio_anno) || 0, fin: numO(r.fine_anno) }));
  s.km = (j.km || []).filter(r => r.data).map(r => ({ d: txt(r.data).slice(0, 10), km: numO(r.km) || 0, n: txt(r.nota) }));
  const imp = j.impostazioni || {}; Object.keys(imp).forEach(k => s.imp[k] = txt(imp[k]));
  s.movs = (j.movimenti || []).filter(r => r.id && r.data).map(rigaInMov);
  return s;
}

/* Fotografia dei dati in forma di righe, per confrontarla con quella precedente */
function istantanea() {
  const movs = {}; for (const m of S.movs) movs[m.id] = JSON.stringify(movInRiga(m));
  return {
    movs,
    Categorie: JSON.stringify(S.cats.map(catInRiga)),
    Conti: JSON.stringify(S.acc.map(contoInRiga)),
    Ricorrenti: JSON.stringify(S.ric.map(ricInRiga)),
    Crediti: JSON.stringify(S.cred.map(credInRiga)),
    Patrimonio: JSON.stringify(S.patRows.map(patInRiga)),
    Km: JSON.stringify(S.km.map(kmInRiga)),
    imp: Object.assign({}, S.imp)
  };
}

/* ===== Copia sul dispositivo ===== */
function salvaLocale() {
  try { localStorage.setItem(K_DATI, JSON.stringify({ v: 1, S, SNAP })); } catch (e) { }
  salvaCoda();
}
function salvaCoda() { try { localStorage.setItem(K_CODA, JSON.stringify(CODA.map(o => ({ action: o.action, data: o.data })))); } catch (e) { } }
function caricaCache() {
  try {
    CODA = JSON.parse(localStorage.getItem(K_CODA) || "[]");
    const d = JSON.parse(localStorage.getItem(K_DATI) || "null");
    if (!d || !d.S || !d.SNAP) return null;
    SNAP = d.SNAP; S = d.S; if (!S.objBase) S.objBase = Object.assign({}, S.obj); S.objAnno = null; sortMovs(); invalidate(); return S;
  } catch (e) { return null; }
}
function applicaDalFoglio(j) {
  S = daFoglio(j); sortMovs(); invalidate();
  SNAP = istantanea(); salvaLocale();
  if (aggiornaStruttura()) persist(); // le modifiche partono verso il foglio come tutte le altre
}

/* Aggiornamenti una tantum dei dati quando cambia l'app (restituisce true se ha cambiato qualcosa) */
function aggiornaStruttura() {
  let cambiato = false;
  // Novembre 2026: entrate tassate e non tassate
  if (!S.cats.some(c => c.id === "extratax") && S.cats.some(c => c.id === "extra")) {
    const i = S.cats.findIndex(c => c.id === "extra");
    S.cats[i].n = "Extra lavoro non tassato";
    S.cats.splice(i, 0, { id: "extratax", n: "Extra lavoro tassato", g: "ent", e: "🧾", col: "#1b7a35", off: false });
    cambiato = true;
  }
  if (S.imp.categorie_tassate == null) { S.imp.categorie_tassate = "stip,extratax"; cambiato = true; }
  if (S.imp.conto_entrate_non_tassate == null) {
    const r = S.acc.find(a => /rispar/i.test(a.n) && !a.tasse && !a.spesa) || S.acc.find(a => !a.tasse && !a.spesa);
    if (r) { S.imp.conto_entrate_non_tassate = r.id; cambiato = true; }
  }
  if (cambiato) invalidate();
  return cambiato;
}

/* ===== Modifiche: confronto e coda ===== */
/* Chiamata dalle schermate dopo ogni modifica a S */
function persist() {
  invalidate();
  if (!S || !SNAP) return;
  GEN++;
  // Obiettivi modificati nelle schermate: si salvano come obiettivi dell'anno che si sta guardando
  if (S.objAnno && serObj(S.obj) !== serObj(objFor(S.objAnno))) S.imp["obiettivi_" + S.objAnno] = serObj(S.obj);
  const ora = istantanea();
  const nomi = { Categorie: "salvaCategorie", Conti: "salvaConti", Ricorrenti: "salvaRicorrenti", Crediti: "salvaCrediti", Patrimonio: "salvaPatrimonio", Km: "salvaKm" };
  const conv = { Categorie: S.cats.map(catInRiga), Conti: S.acc.map(contoInRiga), Ricorrenti: S.ric.map(ricInRiga), Crediti: S.cred.map(credInRiga), Patrimonio: S.patRows.map(patInRiga), Km: S.km.map(kmInRiga) };
  for (const k of Object.keys(nomi)) if (ora[k] !== SNAP[k]) accoda({ action: nomi[k], data: conv[k] });
  // Impostazioni: solo le chiavi cambiate
  const imp = {};
  for (const k of new Set(Object.keys(ora.imp).concat(Object.keys(SNAP.imp)))) if ((ora.imp[k] || "") !== (SNAP.imp[k] || "")) imp[k] = ora.imp[k] || "";
  if (Object.keys(imp).length) accoda({ action: "salvaImpostazioni", data: imp });
  // Movimenti: aggiunti, modificati, eliminati
  const mod = { aggiungi: [], modifica: [], elimina: [] };
  for (const id in ora.movs) {
    if (!(id in SNAP.movs)) mod.aggiungi.push(JSON.parse(ora.movs[id]));
    else if (ora.movs[id] !== SNAP.movs[id]) mod.modifica.push(JSON.parse(ora.movs[id]));
  }
  for (const id in SNAP.movs) if (!(id in ora.movs)) mod.elimina.push(id);
  if (mod.aggiungi.length || mod.modifica.length || mod.elimina.length) accoda({ action: "salvaModifiche", data: mod });
  // Spese ricorrenti cambiate: il ponte inserisce subito quelle previste (anche arretrate)
  if (ora.Ricorrenti !== SNAP.Ricorrenti) accoda({ action: "inserisciRicorrenti", data: {} });
  SNAP = ora;
  salvaLocale(); aggiornaIndicatore();
  invia();
}

/* Aggiunge alla coda, unendo con l'ultima voce se è dello stesso tipo e non è già in invio */
function accoda(op) {
  const last = CODA[CODA.length - 1];
  if (last && !last.inviando && last.action === op.action) {
    if (op.action === "salvaModifiche") { last.data = unisciModifiche(last.data, op.data); return; }
    if (op.action === "salvaImpostazioni") { Object.assign(last.data, op.data); return; }
    last.data = op.data; return; // salvaX e inserisciRicorrenti: vale l'ultima
  }
  CODA.push(op);
}
function unisciModifiche(a, b) {
  const agg = new Map(a.aggiungi.map(r => [r.id, r])), mod = new Map(a.modifica.map(r => [r.id, r])), eli = new Set(a.elimina);
  for (const r of b.aggiungi) { if (eli.has(r.id)) { eli.delete(r.id); mod.set(r.id, r); } else agg.set(r.id, r); }
  for (const r of b.modifica) { if (agg.has(r.id)) agg.set(r.id, r); else mod.set(r.id, r); }
  for (const id of b.elimina) { if (agg.has(id)) agg.delete(id); else { mod.delete(id); eli.add(id); } }
  return { aggiungi: [...agg.values()], modifica: [...mod.values()], elimina: [...eli] };
}
function codaLunghezza() {
  return CODA.reduce((n, o) => n + (o.action === "salvaModifiche" ? o.data.aggiungi.length + o.data.modifica.length + o.data.elimina.length : o.action === "inserisciRicorrenti" ? 0 : 1), 0);
}
function svuotaCoda() { CODA = []; if (S) SNAP = istantanea(); ERRORE = ""; STATO = "ok"; salvaLocale(); aggiornaIndicatore(); }
function ultimoErrore() { return ERRORE; }

/* Invia la coda, una voce alla volta. Se manca la rete riprova da solo dopo 30 secondi. */
let INVIO = null, RIPROVA = null;
function invia(manuale) {
  if (INVIO) return INVIO;
  if (!leggiCfg() || !CODA.length) { if (STATO !== "carico") STATO = CODA.length ? STATO : "ok"; aggiornaIndicatore(); return Promise.resolve(); }
  clearTimeout(RIPROVA);
  INVIO = (async () => {
    let ricarica = false;
    STATO = "invio"; aggiornaIndicatore();
    while (CODA.length) {
      const op = CODA[0]; op.inviando = true;
      try {
        const r = await chiamaPonte(op.action, op.data);
        CODA.shift(); salvaCoda();
        if (r.errori && r.errori.length) { ERRORE = "Il foglio ha rifiutato alcune modifiche: " + r.errori.join("; "); toast(ERRORE); ricarica = true; }
        else ERRORE = "";
        if (op.action === "inserisciRicorrenti" && r.inserite) ricarica = true;
      } catch (e) {
        op.inviando = false;
        ERRORE = e.message;
        STATO = e.rete ? "attesa" : "errore";
        if (manuale) toast(e.rete ? "Ancora niente connessione: riprovo da solo" : "Errore: " + e.message);
        RIPROVA = setTimeout(() => invia(), e.rete ? 30000 : 120000);
        aggiornaIndicatore();
        return;
      }
    }
    STATO = "ok"; aggiornaIndicatore();
    if (ricarica) { INVIO = null; await aggiornaDalFoglio(); }
  })().finally(() => { INVIO = null; });
  return INVIO;
}

/* Legge tutto dal foglio e aggiorna la copia sul dispositivo (solo se non ci sono modifiche in attesa) */
async function aggiornaDalFoglio(manuale) {
  if (!leggiCfg()) return;
  if (CODA.length) { if (manuale) toast("Prima devono partire le modifiche in attesa"); return; }
  const gen = GEN; const prima = STATO; STATO = "carico"; aggiornaIndicatore();
  try {
    const j = await chiamaPonte("tutto", {});
    if (gen !== GEN || CODA.length) { STATO = CODA.length ? "attesa" : "ok"; aggiornaIndicatore(); return; } // modificato nel frattempo: tengo i dati locali
    const primoCaricamento = !S;
    applicaDalFoglio(j);
    STATO = "ok"; ERRORE = ""; aggiornaIndicatore();
    if (primoCaricamento) UI.y = annoPredefinito();
    // Ridisegna, ma non mentre si sta scrivendo o è aperta una finestra
    const a = document.activeElement; const scrive = a && /INPUT|TEXTAREA|SELECT/.test(a.tagName);
    if (primoCaricamento || (!scrive && !document.getElementById("modal").innerHTML)) render();
    if (manuale) toast("Dati aggiornati dal foglio");
  } catch (e) {
    ERRORE = e.message; STATO = e.rete ? (prima === "ok" ? "offline" : prima) : "errore"; aggiornaIndicatore();
    const le = document.getElementById("loadErr");
    if (le) le.textContent = (e.rete ? "Non riesco a raggiungere il foglio: controlla la connessione. " : "Errore: " + e.message + " ") + "Riprovo tra poco.";
    if (!S) setTimeout(() => aggiornaDalFoglio(), 15000);
    if (manuale) toast(e.rete ? "Nessuna connessione: restano i dati salvati sul dispositivo" : "Errore: " + e.message);
  }
}

/* Indicatore in alto a destra */
function aggiornaIndicatore() {
  const el = document.getElementById("sync"); if (!el) return;
  const n = codaLunghezza();
  let cls = "", t;
  if (!leggiCfg()) t = "Non collegato";
  else if (STATO === "errore") { cls = "errore"; t = "Errore: tocca per riprovare"; }
  else if (STATO === "invio") t = "Invio in corso";
  else if (n || STATO === "attesa") { cls = "attesa"; t = "In attesa di connessione (" + n + ")"; }
  else if (STATO === "carico") t = "Aggiornamento...";
  else if (STATO === "offline") { cls = "attesa"; t = "Senza connessione"; }
  else { cls = "cloud"; t = "Salvato"; }
  el.className = "sync " + cls; el.querySelector("span").textContent = t;
  el.title = ERRORE || "";
}
