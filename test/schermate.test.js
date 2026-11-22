/* Prova di tutte le schermate: carica l'app intera con una pagina finta e i dati di esempio del prototipo,
   apre ogni schermata (anno in corso, anno passato e anno nuovo) e controlla che nessuna si blocchi.
   Si lancia con:  node test/schermate.test.js   (serve il file prototipo-app-spese.html nella cartella principale) */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
if (!fs.existsSync(path.join(ROOT, "prototipo-app-spese.html"))) { console.log("Manca prototipo-app-spese.html: prova saltata."); process.exit(0); }

/* Pagina finta: ogni elemento ricorda il suo innerHTML; tutto il resto non fa nulla */
function elemento(id) {
  return { id, innerHTML: "", textContent: "", hidden: false, value: "", dataset: {}, style: {}, className: "",
    classList: { toggle() { }, add() { }, remove() { } }, addEventListener() { }, querySelector: () => elemento(), querySelectorAll: () => [],
    appendChild() { }, remove() { }, focus() { }, setAttribute() { }, scrollIntoView() { }, closest: () => null, contains: () => false };
}
const els = {};
const document = { getElementById: id => els[id] || (els[id] = elemento(id)), querySelector: () => null, querySelectorAll: () => [], createElement: () => elemento(), addEventListener() { }, body: elemento("body"), activeElement: null, visibilityState: "visible" };
const memoria = { "spese-collegamento": JSON.stringify({ url: "http://localhost:1/finto/exec", key: "x".repeat(40) }) };
const ctx = vm.createContext({
  console, Intl, Date, Math, JSON, Object, Array, String, Number, Set, Map, Promise, setTimeout: () => 0, clearTimeout() { }, setInterval: () => 0,
  document, window: { scrollTo() { }, scrollY: 0, addEventListener() { } }, navigator: {}, location: { hash: "", pathname: "/", protocol: "http:" }, history: { replaceState() { } },
  localStorage: { getItem: k => memoria[k] || null, setItem: (k, v) => { memoria[k] = v; }, removeItem: k => { delete memoria[k]; } },
  getComputedStyle: () => ({ getPropertyValue: () => "" }), fetch: () => Promise.reject(new Error("niente rete nella prova")), crypto: require("crypto").webcrypto
});
ctx.window.addEventListener = () => { }; ctx.addEventListener = () => { };
for (const f of ["js/calcoli.js", "js/dati.js", "js/app.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });

/* Dati di esempio: righe del foglio costruite dal prototipo */
const html = fs.readFileSync(path.join(ROOT, "prototipo-app-spese.html"), "utf8");
vm.runInContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1].replace("const SEED", "globalThis.SEED"), ctx);
vm.runInContext(`(() => {
  const cats = SEED.cats.map(c => ({ id: c[0], nome: c[1], gruppo: c[0] === "tasse" ? "tax" : c[0] === "prof" || c[0] === "cred" ? (c[0] === "prof" ? "nec" : "ext") : c[2], emoji: "x", colore: "#888888", obiettivo_mensile: SEED.obj[c[0]] || "", attiva: "SI" }))
    .concat([{ id: "offerto", nome: "Cose offerte", gruppo: "ext" }, { id: "noconta", nome: "Non conteggiato", gruppo: "esc" }]);
  applicaDalFoglio({ categorie: cats,
    conti: [{ id: "a", nome: "Spese", percentuale: 29, correzione_fissa: 0, conto_spese: "SI" }, { id: "b", nome: "Tasse", percentuale: 30, conto_imposte: "SI" }, { id: "c", nome: "Risparmi", percentuale: 41 }],
    ricorrenti: [{ id: "r", descrizione: "Abbonamento", categoria: "abbon", importo: 5, ogni_mesi: 1, dal_mese: "2026-01" }],
    crediti: [{ id: "k", tipo: "credito", persona: "Prova", importo: 5, motivo: "x", data: "2026-01-01", saldato: "NO" }],
    patrimonio: [{ anno: 2026, id: "p", voce: "Conto", tipo: "liq", inizio_anno: 1000, fine_anno: "" }],
    km: [{ data: "2026-01-01", km: 1000 }], impostazioni: { anno_predefinito: "2026" },
    movimenti: SEED.movs.map(m => movInRiga(Object.assign({}, m, { c: m.c || null }))) });
})()`, ctx);

let falliti = 0, riusciti = 0;
const prova = (nome, codice, dove) => {
  try { vm.runInContext(codice, ctx); const h = els[dove || "view"].innerHTML; if (!h || h.length < 50) throw new Error("schermata vuota"); riusciti++; }
  catch (e) { falliti++; console.log("  NO  " + nome + ": " + e.message); }
};
console.log("Apro tutte le schermate");
const anni = [2026, 2025, 2027];
for (const y of anni) {
  for (const t of ["ins", "mov", "mese", "anno"]) prova(`${t} ${y}`, `UI.y = ${y}; UI.mo = 3; go("${t}")`);
  for (const s of ["", "obj", "smist", "ric", "tax", "pat", "cred", "carb", "cat", "dati"]) prova(`altro ${s || "menu"} ${y}`, `UI.y = ${y}; go("altro", "${s}" || null)`);
  for (let mo = 1; mo <= 12; mo++) prova(`mese ${mo}/${y}`, `UI.y = ${y}; UI.mo = ${mo}; go("mese")`);
}
// Lordo e netto, straordinarie e investimenti
for (const l of ["SI", "NO"]) for (const tS of [true, false]) for (const tI of [true, false]) prova(`anno lordo=${l} straord=${tS} inv=${tI}`, `S.imp.mostra_lordo = "${l}"; UI.tS = ${tS}; UI.tI = ${tI}; UI.y = 2026; invalidate(); go("anno")`);
// Finestre: modifica di un movimento, dettaglio di categoria, percentuali del mese
prova("finestra modifica movimento", `go("ins"); openEdit(S.movs[10].id)`, "modal");
prova("finestra dettaglio categoria", `openCatDetail("risto", 2026, 3)`, "modal");
prova("finestra percentuali del mese", `openSmistMese(2026, 3)`, "modal");
prova("primo avvio (collega)", `localStorage.removeItem("spese-collegamento"); render()`);

console.log(falliti ? `FALLITE ${falliti} schermate su ${falliti + riusciti}` : `TUTTE LE ${riusciti} SCHERMATE SI APRONO`);
process.exit(falliti ? 1 : 0);
