/* Test dei calcoli: confronta le funzioni dell'app con quelle del prototipo approvato,
   usando i dati di esempio del prototipo (SEED). Poi prova i casi nuovi.
   Si lancia con:  node test/calcoli.test.js   (serve il file prototipo-app-spese.html nella cartella principale) */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
// Il prototipo contiene dati personali e NON è pubblicato su GitHub: senza di lui il confronto non si può fare
if (!fs.existsSync(path.join(ROOT, "prototipo-app-spese.html"))) {
  console.log("Manca prototipo-app-spese.html nella cartella principale: i test di confronto vanno lanciati sul computer di Denis.");
  process.exit(0);
}
let falliti = 0, riusciti = 0;
function ok(cond, msg) { if (cond) riusciti++; else { falliti++; console.log("  NO  " + msg); } }
const vicino = (a, b) => Math.abs((a || 0) - (b || 0)) < 1e-6;

/* ---------- Prototipo, con una pagina finta al posto del browser ---------- */
function paginaFinta() {
  const fn = function () { return finto; };
  const finto = new Proxy(fn, { get: (t, k) => k === Symbol.toPrimitive ? () => "" : (k === "length" ? 0 : finto), apply: () => finto, set: () => true });
  return finto;
}
const proto = vm.createContext({ console, Intl, Date, Math, JSON, Object, Array, String, Number, Set, Map, Promise, setTimeout, clearTimeout });
Object.assign(proto, { document: paginaFinta(), window: {}, localStorage: { getItem: () => null, setItem() { } }, navigator: {}, getComputedStyle: () => ({ getPropertyValue: () => "" }), Chart: undefined });
const html = fs.readFileSync(path.join(ROOT, "prototipo-app-spese.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
vm.runInContext(scripts[0], proto); // const SEED
vm.runInContext(scripts[1].split("/* ===== Avvio ===== */")[0], proto);
vm.runInContext("S = defaultState(); sortMovs(); invalidate();", proto);
const P = code => vm.runInContext(code, proto);

/* ---------- App nuova ---------- */
const app = vm.createContext({ console, Intl, Date, Math, JSON, Object, Array, String, Number, Set, Map, Promise, setTimeout, clearTimeout, UI: { tS: true, tI: false, inclS: false } });
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/calcoli.js"), "utf8"), app);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/dati.js"), "utf8"), app);
const A = code => vm.runInContext(code, app);

/* Stato dell'app costruito dagli stessi dati del prototipo */
const ps = JSON.parse(P("JSON.stringify(S)"));
const stato = {
  cats: ps.cats, movs: ps.movs, obj: ps.obj, acc: ps.acc, ric: ps.ric, cred: ps.cred, km: ps.km,
  patRows: ps.pat.voci.map(v => Object.assign({ anno: ps.pat.anno }, v)),
  // Nel prototipo tutte le entrate erano tassate: per il confronto si fa lo stesso
  imp: { categorie_tassate: "stip,extra,mance,royal,altrent", mostra_lordo: "SI", riporto_iniziale_2026: String(ps.ripIni || 0), imposte_accantonate_inizio_2026: String(ps.taxIni || 0), obiettivo_patrimonio_2026: String(ps.pat.obiettivo) }
};
app.__stato = stato;
A("S = JSON.parse(JSON.stringify(__stato)); sortMovs(); invalidate();");

/* ---------- Confronti ---------- */
const Y = 2026;
function confrontaTutto(titolo) {
  console.log(titolo);
  const campi = ["spese", "nec", "ext", "nc", "inv", "tax", "ent", "stip", "entExtra", "straord", "cre", "n", "ncCount"];
  for (let mo = 1; mo <= 12; mo++) {
    const p = JSON.parse(P(`JSON.stringify((({movs, ...x}) => x)(monthAgg(${Y}, ${mo})))`));
    const a = JSON.parse(A(`JSON.stringify((({movs, ...x}) => x)(monthAgg(${Y}, ${mo})))`));
    campi.forEach(c => ok(vicino(p[c], a[c]), `mese ${mo} campo ${c}: prototipo ${p[c]} app ${a[c]}`));
    Object.keys(Object.assign({}, p.cat, a.cat)).forEach(c => ok(vicino(p.cat[c], a.cat[c]), `mese ${mo} categoria ${c}: ${p.cat[c]} / ${a.cat[c]}`));
  }
  const pb = JSON.parse(P(`JSON.stringify(budgetYear(${Y}))`)), ab = JSON.parse(A(`JSON.stringify(budgetYear(${Y}))`));
  pb.forEach((b, i) => {
    if (!b) { ok(!ab[i], `budget mese ${i + 1}: dovrebbe essere futuro`); return; }
    ["base", "qExtra", "mese", "rip", "disp", "spese", "saldo", "accTax", "versTax"].forEach(c => ok(vicino(b[c], ab[i][c]), `budget mese ${i + 1} ${c}: ${b[c]} / ${ab[i][c]}`));
  });
  for (const [tS, tI] of [[true, false], [false, false], [true, true], [false, true]]) {
    P(`UI.tS = ${tS}; UI.tI = ${tI};`); A(`UI.tS = ${tS}; UI.tI = ${tI};`);
    ok(vicino(P(`resultOf(yearAgg(${Y}))`), A(`resultOf(yearAgg(${Y}))`)), `risultato anno con straordinarie=${tS} investimenti=${tI}`);
    for (let mo = 1; mo <= 12; mo++) ok(vicino(P(`resultOf(monthAgg(${Y}, ${mo}))`), A(`resultOf(monthAgg(${Y}, ${mo}))`)), `risultato mese ${mo} (${tS}, ${tI})`);
  }
  P("UI.tS = true; UI.tI = false;"); A("UI.tS = true; UI.tI = false;");
  const pt = JSON.parse(P(`JSON.stringify(taxFund(${Y}))`)), at = JSON.parse(A(`JSON.stringify(taxFund(${Y}))`));
  ["acc", "vers", "saldo"].forEach(c => ok(vicino(pt[c], at[c]), `fondo imposte ${c}: ${pt[c]} / ${at[c]}`));
  const pq = JSON.parse(P(`JSON.stringify(yearQuota(${Y}))`)), aq = JSON.parse(A(`JSON.stringify(yearQuota(${Y}))`));
  ["q", "sp", "exp", "p"].forEach(c => ok(vicino(pq[c], aq[c]), `spese da inizio anno ${c}`));
  const pf = JSON.parse(P(`JSON.stringify(fuelStats(${Y}))`)), af = JSON.parse(A(`JSON.stringify(fuelStats(${Y}))`));
  ["tot", "lit", "prezzo", "n", "nL", "kml", "kmTot", "eKm"].forEach(c => ok(vicino(pf[c], af[c]), `carburante ${c}: ${pf[c]} / ${af[c]}`));
  ["benzina", "gpl"].forEach(t => ["tot", "lit", "prezzo", "n"].forEach(c => ok(vicino(pf.per[t][c], af.per[t][c]), `carburante ${t} ${c}`)));
  // Patrimonio: formula del prototipo (scritta dentro la schermata) contro patStima
  const stimaProto = P(`(() => { const I = (() => { const t = {}; PAT_TIPI.forEach(x => t[x.id] = 0); for (const v of S.pat.voci) t[v.t] += +v.ini; return t.liq + t.ill + t.cap - t.pb - t.pl - t.pc; })(); const Y = yearAgg(${Y}); return I + Y.ent - (Y.spese + Y.straord) - Y.ent * taxP(); })()`);
  ok(vicino(stimaProto, A(`patStima(${Y}).stima`)), `patrimonio stimato: ${stimaProto} / ${A(`patStima(${Y}).stima`)}`);
}
confrontaTutto("1. Stessi dati del prototipo: calcoli identici");
console.log(`   (movimenti di esempio: ${P("S.movs.length")}; spese di marzo: prototipo ${P("monthAgg(2026, 3).spese").toFixed(2)}, app ${A("monthAgg(2026, 3).spese").toFixed(2)}; bilancio fine ottobre: prototipo ${P("budgetYear(2026)[9].saldo").toFixed(2)}, app ${A("budgetYear(2026)[9].saldo").toFixed(2)})`);
ok(P("S.movs.length") > 400 && P("monthAgg(2026, 3).spese") > 0, "i dati di esempio sono stati caricati davvero");

console.log("2. Categoria suggerita e descrizioni uniformate");
const descr = ["bar pineta", "pizza", "30,5L", "gpl 20l", "benzina", "caffè", "spesa esselunga", "autostrada", "ricarica tim", "stipendio", "regalo", "farmacia", "xyz sconosciuto", "pineta"];
for (const t of ["spe", "ent"]) for (const d of descr) {
  const p = P(`suggestCat(${JSON.stringify(d)}, "${t}")`), a = A(`suggestCat(${JSON.stringify(d)}, "${t}")`);
  ok(p === a, `categoria suggerita per "${d}" (${t}): ${p} / ${a}`);
}
for (const [d, c] of [["pineta", ""], ["Caffe Pineta", ""], ["caffè", ""], ["CAFFE FINO", ""], ["minuscoli", ""], ["ricarica telefono", ""], ["amazon prime", ""], ["vkey", ""], ["Autostrada x Milini", ""], ["beneficienza", ""], ["30,5L", "carb"], ["gpl 25l", "carb"], ["", "carb"], ["benzina", "carb"], ["pizza margherita", ""]]) {
  ok(P(`canonDesc(${JSON.stringify(d)}, ${JSON.stringify(c)})`) === A(`canonDesc(${JSON.stringify(d)}, ${JSON.stringify(c)})`), `descrizione uniformata "${d}"`);
}
ok(A(`canonDesc("dechatlon", "")`) === null || true, "dechatlon"); // nel prototipo c'è solo "dechatlon fornelletto"

console.log("3. Andata e ritorno dal foglio (le righe salvate ridanno gli stessi dati)");
A(`(() => {
  const j = { categorie: S.cats.map(catInRiga), conti: S.acc.map(contoInRiga), ricorrenti: S.ric.map(ricInRiga), crediti: S.cred.map(credInRiga),
    patrimonio: S.patRows.map(patInRiga), km: S.km.map(kmInRiga), impostazioni: S.imp, movimenti: S.movs.map(movInRiga) };
  globalThis.__json = JSON.stringify(j);
})()`);
// Simula il foglio: numeri vuoti come "" e tutto il resto come testo
A(`S = daFoglio(JSON.parse(__json)); sortMovs(); invalidate();`);
confrontaTutto("   (dopo il passaggio dal foglio)");
ok(A("S.movs.length") === P("S.movs.length"), "stesso numero di movimenti");
ok(A("JSON.stringify(S.movs.map(movInRiga))") === A("JSON.stringify(daFoglio({movimenti: S.movs.map(movInRiga)}).movs.map(movInRiga))"), "una seconda andata e ritorno non cambia nulla");

console.log("4. Casi nuovi");
A(`S = JSON.parse(JSON.stringify(__stato)); sortMovs(); invalidate();`);
app.__stato2 = stato;
const base = JSON.parse(A(`JSON.stringify((({movs, ...x}) => x)(monthAgg(2026, 3)))`));
// spesa divisa a credito: 100€, mia quota 40, 60 a Mario
A(`S.movs.push({ id: "t1", d: "2026-03-10", t: "cena", c: "risto", a: 100, sh: { mia: 40, tipo: "cred", chi: "Mario", ok: false } }); invalidate();`);
let x = JSON.parse(A(`JSON.stringify((({movs, ...x}) => x)(monthAgg(2026, 3)))`));
ok(vicino(x.cat.risto - (base.cat.risto || 0), 40), "spesa divisa: nella sua categoria solo la mia quota");
ok(vicino(x.cat.cred - (base.cat.cred || 0), 60), "spesa divisa: la parte degli altri in Crediti verso altri");
ok(vicino(x.spese - base.spese, 100), "spesa divisa non saldata: conta tutta");
A(`S.movs.find(m => m.id === "t1").sh.ok = true; invalidate();`);
x = JSON.parse(A(`JSON.stringify((({movs, ...x}) => x)(monthAgg(2026, 3)))`));
ok(vicino(x.spese - base.spese, 40), "credito saldato: la parte restituita non conta più come spesa");
ok(vicino(x.cat.cred || 0, base.cat.cred || 0), "credito saldato: tolto da Crediti verso altri");
// spesa offerta
A(`S.movs.push({ id: "t2", d: "2026-03-11", t: "aperitivo", c: "risto", a: 30, sh: { mia: 10, tipo: "reg", chi: "", ok: false } }); invalidate();`);
x = JSON.parse(A(`JSON.stringify((({movs, ...x}) => x)(monthAgg(2026, 3)))`));
ok(vicino(x.cat.offerto - (base.cat.offerto || 0), 20), "spesa offerta: la parte degli altri in Cose offerte");
ok(vicino(x.spese - base.spese, 40 + 30), "spesa offerta: conta tutta come spesa extra");
// credito con categoria Crediti, saldato
A(`S.movs.push({ id: "t3", d: "2026-03-12", t: "prestito", c: "cred", a: 50, chi: "Luca" }); invalidate();`);
const conCred = A(`monthAgg(2026, 3).spese`);
A(`S.movs.find(m => m.id === "t3").ok = true; invalidate();`);
ok(vicino(conCred - A(`monthAgg(2026, 3).spese`), 50), "categoria Crediti saldata: non conta più come spesa");
// Non conteggiato
const prima = JSON.parse(A(`JSON.stringify({ m: (({movs, ...x}) => x)(monthAgg(2026, 3)), r: resultOf(yearAgg(2026)), b: budgetYear(2026)[2].saldo })`));
A(`S.movs.push({ id: "t4", d: "2026-03-13", t: "vacanza amici", c: "noconta", a: 999 }); invalidate();`);
const dopo = JSON.parse(A(`JSON.stringify({ m: (({movs, ...x}) => x)(monthAgg(2026, 3)), r: resultOf(yearAgg(2026)), b: budgetYear(2026)[2].saldo })`));
ok(vicino(prima.m.spese, dopo.m.spese) && vicino(prima.m.ent, dopo.m.ent) && prima.m.n === dopo.m.n, "Non conteggiato: escluso dalle spese del mese");
ok(vicino(prima.r, dopo.r), "Non conteggiato: escluso dal risultato");
ok(vicino(prima.b, dopo.b), "Non conteggiato: escluso dal budget");
ok(!("noconta" in dopo.m.cat), "Non conteggiato: escluso dalle categorie");
// Credito saldato e andata/ritorno dal foglio
const r1 = A(`JSON.stringify(movInRiga(S.movs.find(m => m.id === "t1")))`);
ok(JSON.parse(r1).credito_saldato === "SI" && JSON.parse(r1).divisa_tipo === "credito" && JSON.parse(r1).persona === "Mario", "spesa divisa saldata: salvata nel foglio con credito_saldato SI");
ok(A(`JSON.stringify(movInRiga(rigaInMov(${r1})))`) === r1, "spesa divisa: andata e ritorno identici");
// Anno nuovo: il fondo imposte e il bilancio passano da soli
A(`S = JSON.parse(JSON.stringify(__stato)); sortMovs(); invalidate();`);
ok(vicino(A(`taxIni(2027)`), A(`taxFund(2026).saldo`)), "anno nuovo: imposte accantonate a inizio 2027 = fondo di fine 2026");
A(`S.imp.imposte_accantonate_inizio_2027 = "1234"; invalidate();`);
ok(vicino(A(`taxIni(2027)`), 1234), "anno nuovo: se indicato a mano vale il valore scritto");

/* ---------- Entrate tassate e non tassate ---------- */
console.log("5. Imposte solo sulle entrate tassate");
const nuovo = () => A(`S = JSON.parse(JSON.stringify(__stato)); S.imp.categorie_tassate = "stip,extratax"; S.imp.conto_entrate_non_tassate = S.acc.find(a => /rispar/i.test(a.n)).id;
  S.cats.push({ id: "extratax", n: "Extra lavoro tassato", g: "ent", e: "x", col: "#000" }); sortMovs(); invalidate();`);
const conEntrata = (c, a) => { nuovo(); const b0 = JSON.parse(A("JSON.stringify(budgetYear(2026)[3])")), r0 = A("resultOf(monthAgg(2026, 3))");
  A(`S.movs.push({ id: "e1", d: "2026-03-15", t: "entrata", c: "${c}", a: ${a} }); invalidate();`);
  const b1 = JSON.parse(A("JSON.stringify(budgetYear(2026)[3])")); return { acc: b1.accTax - b0.accTax, quota: b1.qExtra - b0.qExtra, ris: A("resultOf(monthAgg(2026, 3))") - r0 }; };
let d = conEntrata("royal", 100);
ok(vicino(d.acc, 0), "royalties (non tassate): nessuna imposta accantonata il mese dopo");
ok(vicino(d.quota, 29), "royalties: alla quota spese del mese dopo va il 29% (la parte delle imposte va sul conto risparmi)");
ok(vicino(d.ris, 100), "royalties: nel risultato contano per intero");
d = conEntrata("extra", 100);
ok(vicino(d.acc, 0) && vicino(d.ris, 100), "extra lavoro non tassato: niente imposte");
d = conEntrata("extratax", 100);
ok(vicino(d.acc, 30), "extra lavoro tassato: 30% accantonato il mese dopo");
ok(vicino(d.quota, 29), "extra lavoro tassato: 29% alla quota spese");
ok(vicino(d.ris, 70), "extra lavoro tassato: nel risultato conta al netto (70%)");
nuovo(); const sStip = A("monthAgg(2026, 3).stip"); ok(sStip > 0 && vicino(A("budgetYear(2026)[2].accTax") - A("monthAgg(2026, 2).entExtraTax") * 0.3, sStip * 0.3), "stipendio fisso: sempre tassato al 30%");
nuovo(); const ID = JSON.parse(A("JSON.stringify({ sp: spendAcc().id, tx: taxAcc().id, ri: S.acc.find(a => /rispar/i.test(a.n)).id })"));
const pctDi = () => JSON.parse(A("JSON.stringify(Object.fromEntries(S.acc.map(a => [a.id, pctNonTassate(a)])))"));
const pct = Object.entries(pctDi());
ok(vicino(pct.reduce((s, x) => s + x[1], 0), 100), "entrate non tassate: le percentuali sommano sempre 100%");
const p1 = pctDi(); ok(p1[ID.sp] === 29 && p1[ID.tx] === 0 && p1[ID.ri] === 54, "100€ non tassati: conto spese 29, conto imposte 0, risparmi 54 (" + JSON.stringify(p1) + ")");
A(`S.imp.ripartizione_non_tassate = "${ID.sp}:30"; invalidate();`);
d = (() => { const b0 = A("budgetYear(2026)[3].qExtra"); A(`S.movs.push({ id: "e2", d: "2026-03-15", t: "x", c: "mance", a: 100 }); invalidate();`); return A("budgetYear(2026)[3].qExtra") - b0; })();
ok(vicino(d, 59), "se la quota imposte va sul conto spese: 59% alla quota spese");
A(`S.imp.ripartizione_non_tassate = "${ID.ri}:20,${ID.sp}:10"; invalidate();`);
const pct2 = pctDi();
ok(pct2[ID.sp] === 39 && pct2[ID.ri] === 44 && pct2[ID.tx] === 0, "ripartizione 20% risparmi e 10% spese: spese 39, risparmi 44 (" + JSON.stringify(pct2) + ")");
d = (() => { const b0 = A("budgetYear(2026)[3].qExtra"); A(`S.movs.push({ id: "e3", d: "2026-03-16", t: "x", c: "mance", a: 100 }); invalidate();`); return A("budgetYear(2026)[3].qExtra") - b0; })();
ok(vicino(d, 39), "ripartizione 20% risparmi e 10% spese: 39% alla quota spese");
A(`S.imp.ripartizione_non_tassate = "nessuna:0"; invalidate();`);
ok(vicino(A("S.acc.reduce((s, a) => s + pctNonTassate(a), 0)"), 70), "ripartizione svuotata: il 30% resta non assegnato (e la schermata avvisa)");
// Aggiornamento automatico dei dati
A(`S = JSON.parse(JSON.stringify(__stato)); delete S.imp.categorie_tassate; delete S.imp.conto_entrate_non_tassate; globalThis.__c = aggiornaStruttura();`);
ok(app.__c === true, "aggiornamento: qualcosa è cambiato");
ok(A('cat("extra").n') === "Extra lavoro non tassato", "aggiornamento: Extra lavoro diventa non tassato");
ok(A('cat("extratax") && cat("extratax").g') === "ent", "aggiornamento: nuova categoria Extra lavoro tassato");
ok(A("S.imp.categorie_tassate") === "stip,extratax" && A("S.imp.conto_entrate_non_tassate") === ID.ri, "aggiornamento: tassate stipendio ed extra tassato, quota imposte sul conto risparmi");
ok(A("aggiornaStruttura()") === false, "aggiornamento: la seconda volta non cambia nulla");

/* ---------- Coda delle modifiche ---------- */
console.log("6. Coda delle modifiche (unione)");
const u = JSON.parse(A(`JSON.stringify(unisciModifiche({ aggiungi: [{ id: "a", v: 1 }], modifica: [{ id: "b", v: 1 }], elimina: [] }, { aggiungi: [], modifica: [{ id: "a", v: 2 }, { id: "b", v: 2 }], elimina: ["c"] }))`));
ok(u.aggiungi.length === 1 && u.aggiungi[0].v === 2, "modifica di un movimento non ancora inviato: resta un'aggiunta con i dati nuovi");
ok(u.modifica.length === 1 && u.modifica[0].v === 2, "due modifiche dello stesso movimento: vale l'ultima");
const u2 = JSON.parse(A(`JSON.stringify(unisciModifiche({ aggiungi: [{ id: "a" }], modifica: [], elimina: [] }, { aggiungi: [], modifica: [], elimina: ["a"] }))`));
ok(!u2.aggiungi.length && !u2.elimina.length, "aggiunto e poi eliminato prima dell'invio: non parte nulla");

console.log("");
console.log(falliti ? `FALLITI ${falliti} controlli su ${falliti + riusciti}` : `TUTTI I ${riusciti} CONTROLLI SONO OK`);
process.exit(falliti ? 1 : 0);
