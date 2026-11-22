// Widget "Spesa veloce" per l'app Android HTTP Shortcuts (scorciatoia di tipo "Scripting").
// Chiede importo, descrizione e categoria e manda la spesa al ponte Google Apps Script.
// Indirizzo e chiave NON sono scritti qui: stanno in due variabili di HTTP Shortcuts
// chiamate ponte_url e ponte_chiave (vedi widget/ISTRUZIONI.md).

const url = getVariable("ponte_url").trim();
const chiave = getVariable("ponte_chiave").trim();

function ponte(azione, dati) {
  const r = sendHttpRequest(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ key: chiave, action: azione, data: dati })
  });
  if (r.status !== "success") {
    showDialog(
      (r.status === "networkError" ? "Manca la connessione." : "Il ponte ha risposto con un errore (" + r.response.statusCode + ").") +
      "\n\nLa spesa NON è stata salvata. Usa la scorciatoia \"Nuova spesa\" dell'app: salva anche senza rete e invia dopo.",
      "Spesa non salvata");
    abort();
  }
  let j;
  try { j = JSON.parse(r.response.body); } catch (e) { j = { ok: false, errore: "risposta non leggibile" }; }
  if (!j.ok) { showDialog("Il ponte ha risposto: " + j.errore + "\n\nLa spesa NON è stata salvata.", "Spesa non salvata"); abort(); }
  return j;
}

// 1. Categorie dal foglio, dalla più usata (così l'elenco si aggiorna da solo)
const cat = ponte("categoriePerWidget", {});

// 2. Importo (accetta anche la virgola)
let importo = promptNumber("Importo in euro");
if (importo === null) abort();
if (isNaN(importo) || importo <= 0) { showToast("Importo non valido"); abort(); }
importo = Math.round(importo * 100) / 100;

// 3. Descrizione
const descrizione = prompt("Descrizione (es. bar pineta, pizza, 30L)");
if (descrizione === null) abort();

// 4. Categoria: la prima voce lascia scegliere all'app (spesa "da verificare")
const scelte = { "__dopo": "❓ Scegli dopo (la propone l'app)" };
cat.categorie.forEach(c => { scelte[c.id] = c.etichetta; });
const categoria = showSelection(scelte, importo.toFixed(2).replace(".", ",") + "€ " + descrizione);
if (categoria === null) abort();

// 5. Invio
const oggi = new Date();
const data = oggi.getFullYear() + "-" + String(oggi.getMonth() + 1).padStart(2, "0") + "-" + String(oggi.getDate()).padStart(2, "0");
const esito = ponte("aggiungiMovimento", {
  id: "w-" + uuidv4(),
  data: data,
  descrizione: descrizione.trim(),
  categoria: categoria === "__dopo" ? "" : categoria,
  importo: importo,
  origine: "widget"
});
showToast(esito.messaggio || "Spesa salvata");
