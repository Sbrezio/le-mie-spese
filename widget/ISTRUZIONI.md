# Widget "Spesa veloce" (HTTP Shortcuts, Android)

Pulsante sulla schermata del telefono: chiede importo, descrizione e categoria e manda la spesa al foglio.
Le categorie arrivano ogni volta dal foglio (dalla più usata), quindi si aggiornano da sole.
La prima voce dell'elenco, "Scegli dopo", salva la spesa con la categoria proposta dall'app e l'etichetta "da verificare".

Senza rete il widget avvisa e **non** salva: in quel caso usa la scorciatoia "Nuova spesa" dell'app, che salva e invia dopo.

## Configurazione (una volta sola)
1. Installa **HTTP Shortcuts** dal Play Store.
2. Crea due variabili di tipo **Valore statico / Static variable**:
   - `spese_ponte_url` = indirizzo dell'App web del ponte (finisce con `/exec`)
   - `spese_ponte_chiave` = chiave segreta
3. Crea una scorciatoia di tipo **Scripting** chiamata "Spesa veloce" e incolla nel codice il contenuto di `spesa-veloce.js`.
4. Metti la scorciatoia sulla schermata del telefono come widget.

Il file `spesa-veloce.js` non contiene indirizzi né chiavi. Se cambi la chiave del ponte, aggiorna solo la variabile `spese_ponte_chiave`.
