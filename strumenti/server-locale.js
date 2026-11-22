/* Server per provare l'app sul computer, senza pubblicarla.
   Uso:  node strumenti/server-locale.js            → app su http://localhost:8080
         node strumenti/server-locale.js --finto    → in più un ponte finto con i dati di esempio del prototipo
   Ponte finto: indirizzo http://localhost:8080/finto/exec  chiave: chiave-di-prova-locale-0123456789abcdef
   Per simulare l'assenza di rete:  http://localhost:8080/finto/rete?spenta=1  (e ?spenta=0 per riaccenderla)
   Il ponte finto serve solo per le prove: i dati restano in memoria e spariscono quando chiudi il server. */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const PORTA = +((process.argv.find(a => a.startsWith("--porta=")) || "").split("=")[1] || process.env.PORT || 8080);
const FINTO = process.argv.includes("--finto");
const CHIAVE = "chiave-di-prova-locale-0123456789abcdef";
const TIPI = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".webmanifest": "application/manifest+json", ".png": "image/png", ".json": "application/json" };

let DB = null, reteSpenta = false, richieste = 0;
function preparaFinto() {
  // Dati di esempio: quelli del prototipo, trasformati nelle righe del foglio con le funzioni dell'app
  const html = fs.readFileSync(path.join(ROOT, "prototipo-app-spese.html"), "utf8");
  const seed = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  const ctx = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/calcoli.js"), "utf8"), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/dati.js"), "utf8"), ctx);
  vm.runInContext(seed.replace("const SEED", "globalThis.SEED"), ctx);
  const SEED = ctx.SEED;
  const meta = { casa: ["🏠", "#f2b705"], spesa: ["🛒", "#e8a800"], salute: ["💊", "#d4a017"], cura: ["💇", "#f5c542"], carb: ["⛽", "#c99a00"], auto: ["🚗", "#e0a100"], pedaggi: ["🛣️", "#b8860b"], tel: ["📱", "#ffcf33"], vestiti: ["👕", "#d9a400"], animali: ["🐾", "#e6c35c"], sport: ["🏋️", "#f0ad00"], assic: ["🛡️", "#c7a03a"], risto: ["🍕", "#e03131"], zona: ["📍", "#c92a2a"], viaggi: ["✈️", "#f03e3e"], regali: ["🎁", "#fa5252"], abbon: ["📺", "#b02525"], formaz: ["📚", "#1c7ed6"], brico: ["🔨", "#ff6b6b"], benef: ["💝", "#d6336c"], altre: ["📦", "#a61e4d"], merc: ["📈", "#1971c2"], oro: ["🪙", "#339af0"], cripto: ["💎", "#1864ab"], airbnb: ["🏡", "#4dabf7"], prof: ["💼", "#e6b800"], tasse: ["🏛️", "#868e96"], stip: ["💶", "#2f9e44"], extra: ["💰", "#37b24d"], mance: ["💵", "#2b8a3e"], royal: ["🎵", "#51cf66"], altrent: ["➕", "#40c057"], cred: ["🤝", "#e8590c"], offerto: ["🎉", "#f06595"], noconta: ["🚫", "#adb5bd"] };
  const gruppo = { tasse: "tax", prof: "nec", cred: "ext" };
  const cats = SEED.cats.map(c => [c[0], c[0] === "tasse" ? "Imposte e contributi versati" : c[1], gruppo[c[0]] || c[2]]).concat([["offerto", "Cose offerte", "ext"], ["noconta", "Non conteggiato", "esc"]]);
  const obj = Object.assign({ prof: 90 }, SEED.obj);
  DB = {
    categorie: cats.map(c => ({ id: c[0], nome: c[1], gruppo: c[2], emoji: meta[c[0]][0], colore: meta[c[0]][1], obiettivo_mensile: obj[c[0]] || "", attiva: "SI" })),
    conti: [["spese", "Conto spese", 29, 0, "SI", "NO"], ["tasse", "Conto tasse", 30, 0, "NO", "SI"], ["risp", "Risparmi", 24, 0, "NO", "NO"], ["inv1", "Investimenti 1", 16, -100, "NO", "NO"], ["inv2", "Investimenti 2", 0, 100, "NO", "NO"], ["benef", "Beneficenza", 1, 0, "NO", "NO"]].map(r => ({ id: r[0], nome: r[1], percentuale: r[2], correzione_fissa: r[3], conto_spese: r[4], conto_imposte: r[5] })),
    ricorrenti: [{ id: "r3", descrizione: "Claude abbonamento", categoria: "abbon", importo: 22, ogni_mesi: 1, dal_mese: "2026-11", al_mese: "" }],
    crediti: [{ id: "c1", tipo: "credito", persona: "Amico di prova", importo: 10, motivo: "prova", data: "2026-01-01", saldato: "NO" }],
    patrimonio: [["p1", "Conto corrente", "liq", 20000], ["p5", "Contanti", "liq", 1000], ["p11", "Auto", "cap", 5000], ["p12", "Tasse da versare", "pb", 4000]].map(r => ({ anno: 2026, id: r[0], voce: r[1], tipo: r[2], inizio_anno: r[3], fine_anno: "" })),
    km: [{ data: "2026-07-05", km: 110800, nota: "acquisto auto" }],
    impostazioni: { mostra_lordo: "SI", anno_predefinito: "2026", riporto_iniziale_2026: "0", imposte_accantonate_inizio_2026: "0", obiettivo_patrimonio_2026: "60000", versione_dati: "1" },
    movimenti: SEED.movs.map(m => { const r = ctx.movInRiga(Object.assign({}, m, { c: m.c || null })); r.origine = "import"; return r; }),
    inserite: {}
  };
  DB.movimenti.push({ id: "w-prova", data: new Date().toISOString().slice(0, 10), descrizione: "Bar Pineta", categoria: "risto", importo: 3.5, da_verificare: "SI", origine: "widget" });
}

function ponte(req) {
  const { key, action, data } = req;
  if (key !== CHIAVE) return { ok: false, errore: "Chiave non valida" };
  const d = data || {};
  if (action === "tutto") return Object.assign({ ok: true }, JSON.parse(JSON.stringify(DB)), { inserite: undefined });
  if (action === "salvaModifiche") {
    const out = { ok: true, aggiunti: 0, modificati: 0, eliminati: 0, errori: [] };
    for (const m of (d.modifica || []).concat(d.aggiungi || [])) {
      if (!(m.importo > 0)) { out.errori.push((m.descrizione || "") + ": importo non valido"); continue; }
      const i = DB.movimenti.findIndex(x => x.id === m.id);
      if (i >= 0) { if ((d.modifica || []).includes(m)) { DB.movimenti[i] = Object.assign({}, DB.movimenti[i], m); out.modificati++; } }
      else { DB.movimenti.push(m); out.aggiunti++; }
    }
    for (const id of d.elimina || []) { const i = DB.movimenti.findIndex(x => x.id === id); if (i >= 0) { DB.movimenti.splice(i, 1); out.eliminati++; } }
    return out;
  }
  if (action === "categoriePerWidget") {
    const uso = {}; DB.movimenti.forEach(m => { if (m.categoria) uso[m.categoria] = (uso[m.categoria] || 0) + 1; });
    const cs = DB.categorie.filter(c => c.attiva !== "NO" && c.gruppo !== "esc").sort((x, y) => (uso[y.id] || 0) - (uso[x.id] || 0));
    return { ok: true, categorie: cs.map(c => ({ id: c.id, etichetta: c.emoji + " " + c.nome })), elenco: cs.map(c => c.emoji + " " + c.nome) };
  }
  if (action === "aggiungiMovimento") { if (!(+d.importo > 0)) return { ok: false, errore: "Importo non valido" }; if (!DB.movimenti.some(x => x.id === d.id)) DB.movimenti.push(Object.assign({ da_verificare: d.categoria ? "" : "SI" }, d)); return { ok: true, messaggio: "Spesa salvata: " + String(Number(d.importo).toFixed(2)).replace(".", ",") + "€ " + d.descrizione }; }
  const schede = { salvaCategorie: "categorie", salvaConti: "conti", salvaRicorrenti: "ricorrenti", salvaCrediti: "crediti", salvaPatrimonio: "patrimonio", salvaKm: "km" };
  if (schede[action]) { DB[schede[action]] = d; return { ok: true, righe: d.length }; }
  if (action === "salvaImpostazioni") { Object.assign(DB.impostazioni, d); return { ok: true }; }
  if (action === "inserisciRicorrenti") {
    const oggi = new Date().toISOString().slice(0, 7); let n = 0;
    for (const r of DB.ricorrenti) {
      let [y, mm] = r.dal_mese.split("-").map(Number);
      for (let g = 0; g < 600; g++) {
        const ym = y + "-" + String(mm).padStart(2, "0"); if (ym > oggi || (r.al_mese && ym > r.al_mese)) break;
        const k = r.id + "|" + ym;
        if (!DB.inserite[k]) { DB.inserite[k] = 1; DB.movimenti.push({ id: "ric-" + r.id + "-" + ym, data: ym + "-01", descrizione: r.descrizione, categoria: r.categoria, importo: +r.importo, ricorrente_id: r.id, origine: "ricorrente" }); n++; }
        mm += +r.ogni_mesi || 1; while (mm > 12) { mm -= 12; y++; }
      }
    }
    return { ok: true, inserite: n };
  }
  return { ok: false, errore: "Azione sconosciuta: " + action };
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (FINTO && url.pathname === "/finto/rete") { reteSpenta = url.searchParams.get("spenta") === "1"; res.end("rete " + (reteSpenta ? "spenta" : "accesa")); return; }
  if (FINTO && url.pathname === "/finto/stato") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ richieste, movimenti: DB.movimenti.length, ids: DB.movimenti.slice(-8).map(m => m.id + " " + m.descrizione + " " + m.importo), impostazioni: DB.impostazioni, ricorrenti: DB.ricorrenti.length })); return; }
  if (FINTO && url.pathname === "/finto/exec") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.method !== "POST") { res.end(JSON.stringify({ ok: true, messaggio: "Ponte finto attivo" })); return; }
    if (reteSpenta) { req.socket.destroy(); return; }
    let body = ""; req.on("data", c => body += c); req.on("end", () => {
      richieste++;
      let r; try { r = ponte(JSON.parse(body)); } catch (e) { r = { ok: false, errore: e.message }; }
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(r));
    });
    return;
  }
  let f = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)));
  if (!f.startsWith(ROOT)) { res.statusCode = 403; res.end(); return; }
  fs.readFile(f, (err, buf) => {
    if (err) { res.statusCode = 404; res.end("Non trovato"); return; }
    res.setHeader("Content-Type", TIPI[path.extname(f)] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.end(buf);
  });
}).listen(PORTA, "127.0.0.1", () => { // solo questo computer: niente accesso dalla rete
  if (FINTO) preparaFinto();
  console.log("App su http://localhost:" + PORTA + (FINTO ? "  (ponte finto: http://localhost:" + PORTA + "/finto/exec)" : ""));
});
