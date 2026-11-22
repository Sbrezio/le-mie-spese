# Il ponte Google (Apps Script)

`Codice.gs` è il programma che collega l'app e il widget al Google Foglio "App spese Denis".
Non contiene né la chiave segreta né l'indirizzo del foglio.

## Installazione (una volta sola)
1. Apri il foglio "App spese Denis", menu **Estensioni** → **Apps Script**.
2. Cancella tutto il contenuto di `Codice.gs` e incolla il contenuto di questo file `Codice.gs`. Salva (Ctrl+S).
3. Esegui `preparaFoglio`: crea le schede. Alla prima esecuzione Google chiede l'autorizzazione e mostra
   "Google non ha verificato questa app": è normale per uno script personale. Clicca **Avanzate** e poi
   **Vai a ... (non sicuro)**, poi **Consenti**.
4. Esegui `impostaChiave`: nel registro compare la chiave segreta. Conservala in un posto sicuro.
5. Esegui `installaAttivatore`: ogni mattina tra le 6 e le 7 verranno inserite le spese ricorrenti.
6. **Esegui il deployment** → **Nuovo deployment** → tipo **App web**, "Esegui come: **Me**",
   "Chi ha accesso: **Chiunque**". Copia l'indirizzo che finisce con `/exec`.

## Aggiornare il codice
Incolla il nuovo `Codice.gs`, salva, poi **Esegui il deployment** → **Gestisci deployment** → matita →
Versione: **Nuova versione** → **Esegui il deployment**. Così l'indirizzo `/exec` resta lo stesso.

## Provare il collegamento
Da PowerShell, nella cartella del progetto:

```
powershell -ExecutionPolicy Bypass -File apps-script\prova-ponte.ps1
```

## Cambiare la chiave
Esegui `nuovaChiave`, poi reinserisci la nuova chiave nell'app (su ogni dispositivo) e nel widget.

## Come parlano app e ponte
Richiesta POST con corpo JSON `{ key, action, data }` e intestazione `Content-Type: text/plain;charset=utf-8`.
Azioni: `tutto`, `aggiungiMovimento`, `modificaMovimento`, `eliminaMovimento`, `salvaCategorie`, `salvaConti`,
`salvaRicorrenti`, `salvaCrediti`, `salvaPatrimonio`, `salvaKm`, `salvaImpostazioni`, `categoriePerWidget`.
I campi dei movimenti hanno gli stessi nomi delle colonne della scheda `Movimenti`.
