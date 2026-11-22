# Le mie spese

App web installabile (PWA) per registrare le spese, controllare il budget del mese e analizzare l'anno.
Funziona su telefono Android (installata da Chrome) e su computer (Chrome o Edge), anche senza rete.

## Come è fatta

| Pezzo | Dove | Cosa fa |
|---|---|---|
| App | questo repository, pubblicato con GitHub Pages | schermate, calcoli, coda delle modifiche offline |
| Dati | un Google Foglio privato del proprietario | movimenti, categorie, conti, ricorrenti, crediti, patrimonio, impostazioni |
| Ponte | Google Apps Script collegato al foglio (`apps-script/Codice.gs`) | riceve le richieste, controlla la chiave segreta, legge e scrive il foglio, inserisce ogni mattina le spese ricorrenti |
| Widget | app Android HTTP Shortcuts | inserimento veloce di una spesa dalla schermata del telefono |

Nel repository c'è **solo codice**: nessun dato, nessuna chiave, nessun indirizzo del foglio.
Indirizzo del ponte e chiave si inseriscono nell'app al primo avvio e restano salvati solo nel browser del dispositivo.

## File

- `index.html`, `style.css`: la pagina e il suo aspetto (caratteri Figtree e Sora, verde #0b7350, tema chiaro e scuro).
- `js/calcoli.js`: tutti i calcoli (budget del mese, bilanci, imposte, risultato, patrimonio, carburante, categoria suggerita). Non tocca la pagina.
- `js/dati.js`: collegamento al ponte, copia dei dati sul dispositivo, coda delle modifiche quando manca la rete.
- `js/app.js`: schermate (Inserisci, Movimenti, Mese, Anno, Altro), moduli, finestre, grafici.
- `lib/chart.umd.min.js`: Chart.js 4.4.1, copiato qui per funzionare offline.
- `sw.js`: service worker (app disponibile senza rete). **A ogni pubblicazione aumenta `VERSIONE`.**
- `manifest.webmanifest`, `icons/`: installazione e scorciatoia "Nuova spesa" (`index.html#nuova`).
- `apps-script/`: codice del ponte, importazione dal vecchio foglio, istruzioni e prova del collegamento.
- `test/calcoli.test.js`: controlla che i calcoli diano gli stessi risultati del prototipo approvato.
- `strumenti/server-locale.js`: per provare l'app sul computer, anche con un ponte finto.

Non c'è nessun passaggio di compilazione: HTML, CSS e JavaScript semplici, modificabili con qualsiasi editor.

## Provare sul computer

Serve Node.js. Dalla cartella del progetto:

```
node strumenti/server-locale.js           # app su http://localhost:8080, collegabile al ponte vero
node strumenti/server-locale.js --finto   # in più un ponte finto con dati di esempio
node test/calcoli.test.js                 # test dei calcoli (serve il prototipo, che non è pubblicato)
node test/schermate.test.js               # apre tutte le schermate e controlla che nessuna si blocchi
```

## Pubblicare un aggiornamento

1. Modifica i file.
2. In `sw.js` aumenta il numero in `VERSIONE` (es. `spese-v2` → `spese-v3`).
3. Salva su GitHub (commit e push): GitHub Pages pubblica da solo in un paio di minuti.
4. Sui dispositivi compare "Nuova versione disponibile: tocca per aggiornare".

Se cambi `apps-script/Codice.gs`: incollalo nell'editor Apps Script del foglio, salva, poi
**Esegui il deployment → Gestisci deployment → matita → Versione: Nuova versione → Esegui il deployment**.
