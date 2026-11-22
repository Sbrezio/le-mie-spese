/**
 * Ponte tra l'app "Le mie spese" e il Google Foglio "App spese Denis".
 *
 * Come funziona, in breve:
 * - L'app e il widget mandano richieste a questo script (pubblicato come "App web").
 * - Ogni richiesta contiene la chiave segreta: senza la chiave giusta non si tocca il foglio.
 * - Lo script legge e scrive le schede del foglio.
 * - Ogni mattina un attivatore inserisce da solo le spese ricorrenti.
 *
 * Funzioni da eseguire a mano dall'editor (menu a tendina in alto, poi "Esegui"):
 * - preparaFoglio()       crea le schede con le intestazioni e i dati di partenza (non cancella nulla)
 * - impostaChiave()       crea la chiave segreta e la mostra nel registro di esecuzione
 * - nuovaChiave()         sostituisce la chiave (i dispositivi collegati andranno ricollegati)
 * - installaAttivatore()  attiva l'inserimento automatico delle ricorrenti ogni mattina
 * - inserisciRicorrenti() inserisce subito le ricorrenti mancanti
 *
 * La chiave NON è scritta qui: sta nelle Proprietà dello script (API_KEY).
 */

/* ===================== Struttura del foglio ===================== */

var SCHEDE = {
  Movimenti: ['id', 'data', 'descrizione', 'categoria', 'importo', 'quota_mia', 'divisa_tipo', 'persona',
    'credito_saldato', 'straordinaria', 'litri', 'carburante', 'nota', 'ricorrente_id', 'da_verificare',
    'origine', 'creato_il', 'modificato_il'],
  Categorie: ['id', 'nome', 'gruppo', 'emoji', 'colore', 'obiettivo_mensile', 'attiva'],
  Conti: ['id', 'nome', 'percentuale', 'correzione_fissa', 'conto_spese', 'conto_imposte'],
  Ricorrenti: ['id', 'descrizione', 'categoria', 'importo', 'ogni_mesi', 'dal_mese', 'al_mese'],
  RicorrentiInserite: ['chiave', 'id_movimento'],
  Crediti: ['id', 'tipo', 'persona', 'importo', 'motivo', 'data', 'saldato'],
  Patrimonio: ['anno', 'id', 'voce', 'tipo', 'inizio_anno', 'fine_anno'],
  Km: ['data', 'km', 'nota'],
  Impostazioni: ['chiave', 'valore']
};

/* Colonne che contengono numeri (le altre sono salvate come testo, così Google non trasforma le date) */
var COLONNE_NUMERI = {
  Movimenti: ['importo', 'quota_mia', 'litri'],
  Categorie: ['obiettivo_mensile'],
  Conti: ['percentuale', 'correzione_fissa'],
  Ricorrenti: ['importo', 'ogni_mesi'],
  Crediti: ['importo'],
  Patrimonio: ['anno', 'inizio_anno', 'fine_anno'],
  Km: ['km']
};

var GRUPPI = ['nec', 'ext', 'inv', 'tax', 'ent', 'esc'];

/* Fuso orario usato per "oggi" e per le date di creazione */
var FUSO = 'Europe/Rome';

/* Categorie iniziali: id, nome, gruppo, emoji, colore, obiettivo mensile (vuoto: si imposta dall'app) */
var CATEGORIE_INIZIALI = [
  ['casa', 'Casa', 'nec', '🏠', '#f2b705', ''],
  ['spesa', 'Spesa alimentare', 'nec', '🛒', '#e8a800', ''],
  ['salute', 'Salute', 'nec', '💊', '#d4a017', ''],
  ['cura', 'Cura personale', 'nec', '💇', '#f5c542', ''],
  ['carb', 'Carburante', 'nec', '⛽', '#c99a00', ''],
  ['auto', 'Auto (manutenzione e assicurazione)', 'nec', '🚗', '#e0a100', ''],
  ['pedaggi', 'Pedaggi e trasporti', 'nec', '🛣️', '#b8860b', ''],
  ['tel', 'Telefono', 'nec', '📱', '#ffcf33', ''],
  ['vestiti', 'Vestiti e lavanderia', 'nec', '👕', '#d9a400', ''],
  ['animali', 'Animali', 'nec', '🐾', '#e6c35c', ''],
  ['sport', 'Sport', 'nec', '🏋️', '#f0ad00', ''],
  ['assic', 'Assicurazioni', 'nec', '🛡️', '#c7a03a', ''],
  ['prof', 'Spese professionali', 'nec', '💼', '#e6b800', ''],
  ['risto', 'Ristoranti e bar', 'ext', '🍕', '#e03131', ''],
  ['zona', 'Zona (attività locali)', 'ext', '📍', '#c92a2a', ''],
  ['viaggi', 'Viaggi e vacanze', 'ext', '✈️', '#f03e3e', ''],
  ['regali', 'Regali', 'ext', '🎁', '#fa5252', ''],
  ['abbon', 'Abbonamenti', 'ext', '📺', '#b02525', ''],
  ['formaz', 'Formazione e libri', 'ext', '📚', '#1c7ed6', ''],
  ['brico', 'Bricolage', 'ext', '🔨', '#ff6b6b', ''],
  ['benef', 'Beneficenza', 'ext', '💝', '#d6336c', ''],
  ['altre', 'Altre spese', 'ext', '📦', '#a61e4d', ''],
  ['cred', 'Crediti verso altri', 'ext', '🤝', '#e8590c', ''],
  ['offerto', 'Cose offerte', 'ext', '🎉', '#f06595', ''],
  ['merc', 'Mercati finanziari', 'inv', '📈', '#1971c2', ''],
  ['oro', 'Oro e altri investimenti', 'inv', '🪙', '#339af0', ''],
  ['cripto', 'Cripto', 'inv', '💎', '#1864ab', ''],
  ['airbnb', 'Airbnb', 'inv', '🏡', '#4dabf7', ''],
  ['tasse', 'Imposte e contributi versati', 'tax', '🏛️', '#868e96', ''],
  ['stip', 'Stipendio fisso', 'ent', '💶', '#2f9e44', ''],
  ['extratax', 'Extra lavoro tassato', 'ent', '🧾', '#1b7a35', ''],
  ['extra', 'Extra lavoro non tassato', 'ent', '💰', '#37b24d', ''],
  ['mance', 'Mance', 'ent', '💵', '#2b8a3e', ''],
  ['royal', 'Royalties', 'ent', '🎵', '#51cf66', ''],
  ['altrent', 'Altre entrate', 'ent', '➕', '#40c057', ''],
  ['noconta', 'Non conteggiato', 'esc', '🚫', '#adb5bd', '']
];

/* Conti iniziali di esempio: id, nome, percentuale, correzione fissa, conto spese, conto imposte.
   Nomi e percentuali veri si impostano dall'app (Altro, Smistamento): qui restano solo valori di esempio. */
var CONTI_INIZIALI = [
  ['spese', 'Conto spese', 30, 0, 'SI', 'NO'],
  ['tasse', 'Conto imposte', 30, 0, 'NO', 'SI'],
  ['risparmi', 'Risparmi', 40, 0, 'NO', 'NO']
];

var IMPOSTAZIONI_INIZIALI = [
  ['categorie_tassate', 'stip,extratax'],
  ['mostra_lordo', 'SI'],
  ['anno_predefinito', '2026'],
  ['riporto_iniziale_2026', '0'],
  ['imposte_accantonate_inizio_2026', '0'],
  ['versione_dati', '1']
];

/* ===================== Funzioni da eseguire a mano ===================== */

/** Crea le schede mancanti con le intestazioni e inserisce i dati di partenza nelle schede vuote. Non cancella nulla. */
function preparaFoglio() {
  var ss = SpreadsheetApp.getActive();
  var create = [];
  Object.keys(SCHEDE).forEach(function (nome) {
    var sh = ss.getSheetByName(nome);
    if (!sh) { sh = ss.insertSheet(nome); create.push(nome); }
    var intest = SCHEDE[nome];
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, intest.length).setValues([intest]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    formattaColonne_(sh, nome);
  });

  if (righe_('Categorie') === 0) scriviRighe_('Categorie', CATEGORIE_INIZIALI.map(function (c) { return c.concat(['SI']); }));
  if (righe_('Conti') === 0) scriviRighe_('Conti', CONTI_INIZIALI);
  if (righe_('Impostazioni') === 0) scriviRighe_('Impostazioni', IMPOSTAZIONI_INIZIALI);

  // Toglie il foglio vuoto che Google crea da solo ("Foglio1" o "Sheet1")
  ['Foglio1', 'Foglio 1', 'Sheet1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  Logger.log('Foglio pronto. Schede create ora: ' + (create.length ? create.join(', ') : 'nessuna (c\'erano già)'));
}

/** Crea la chiave segreta (se non esiste) e la mostra nel registro di esecuzione. */
function impostaChiave() {
  var p = PropertiesService.getScriptProperties();
  var k = p.getProperty('API_KEY');
  if (!k) {
    k = generaChiave_();
    p.setProperty('API_KEY', k);
    Logger.log('Chiave segreta creata.');
  } else {
    Logger.log('La chiave esisteva già (per cambiarla esegui nuovaChiave).');
  }
  Logger.log('CHIAVE: ' + k);
  Logger.log('Copiala e conservala in un posto sicuro (es. un gestore di password). Non pubblicarla mai.');
}

/** Sostituisce la chiave segreta. Dopo bisogna reinserirla nell'app e nel widget. */
function nuovaChiave() {
  var k = generaChiave_();
  PropertiesService.getScriptProperties().setProperty('API_KEY', k);
  Logger.log('Nuova chiave: ' + k);
  Logger.log('La vecchia non funziona più: reinserisci la nuova nell\'app e nel widget.');
}

/** Attiva l'inserimento automatico delle spese ricorrenti ogni giorno tra le 6 e le 7. */
function installaAttivatore() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'inserisciRicorrenti') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('inserisciRicorrenti').timeBased().everyDays(1).atHour(6).create();
  Logger.log('Attivatore installato: le ricorrenti verranno inserite ogni giorno tra le 6 e le 7.');
}

/* ===================== Punto di ingresso dell'App web ===================== */

/** Aprendo l'indirizzo nel browser si vede solo che il ponte è attivo (nessun dato). */
function doGet() {
  return risposta_({ ok: true, messaggio: 'Ponte App spese attivo' });
}

function doPost(e) {
  var richiesta;
  try {
    richiesta = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return risposta_({ ok: false, errore: 'Richiesta non leggibile' });
  }

  var chiave = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!chiave || !richiesta.key || String(richiesta.key) !== chiave) {
    return risposta_({ ok: false, errore: 'Chiave non valida' });
  }

  var azione = richiesta.action;
  var dati = richiesta.data;
  var azioni = {
    tutto: azioneTutto_,
    aggiungiMovimento: azioneAggiungi_,
    modificaMovimento: azioneModifica_,
    eliminaMovimento: azioneElimina_,
    salvaCategorie: function (d) {
      if (!Array.isArray(d) || !d.some(function (c) { return c.id === 'noconta'; })) throw new Error('La categoria "Non conteggiato" non si può eliminare');
      return salvaScheda_('Categorie', d, validaCategoria_);
    },
    salvaConti: function (d) { return salvaScheda_('Conti', d); },
    salvaRicorrenti: function (d) { return salvaScheda_('Ricorrenti', d, validaRicorrente_); },
    salvaCrediti: function (d) { return salvaScheda_('Crediti', d); },
    salvaPatrimonio: function (d) { return salvaScheda_('Patrimonio', d); },
    salvaKm: function (d) { return salvaScheda_('Km', d); },
    salvaImpostazioni: azioneSalvaImpostazioni_,
    salvaModifiche: azioneSalvaModifiche_,
    inserisciRicorrenti: function () { return { inserite: inserisciRicorrenti_() }; },
    categoriePerWidget: azioneCategorieWidget_
  };
  if (!azioni[azione]) return risposta_({ ok: false, errore: 'Azione sconosciuta: ' + azione });

  var scrive = azione !== 'tutto' && azione !== 'categoriePerWidget';
  var lock = LockService.getScriptLock();
  try {
    if (scrive) lock.waitLock(20000);
    var esito = azioni[azione](dati || {});
    esito.ok = true;
    return risposta_(esito);
  } catch (err) {
    return risposta_({ ok: false, errore: String(err && err.message ? err.message : err) });
  } finally {
    if (scrive) lock.releaseLock();
  }
}

/* ===================== Azioni ===================== */

function azioneTutto_(d) {
  var movimenti = leggi_('Movimenti');
  if (d.anni && d.anni.length) {
    var anni = d.anni.map(String);
    movimenti = movimenti.filter(function (m) { return anni.indexOf(String(m.data).slice(0, 4)) >= 0; });
  }
  return {
    categorie: leggi_('Categorie'),
    conti: leggi_('Conti'),
    ricorrenti: leggi_('Ricorrenti'),
    crediti: leggi_('Crediti'),
    patrimonio: leggi_('Patrimonio'),
    km: leggi_('Km'),
    impostazioni: leggiImpostazioni_(),
    movimenti: movimenti
  };
}

function azioneAggiungi_(m) {
  m = m || {};
  if (!m.id) m.id = 'w' + Utilities.getUuid();
  if (trovaRiga_('Movimenti', m.id) > 0) return { duplicato: true, id: m.id, messaggio: 'Già salvata' };

  var categorie = leggi_('Categorie');
  m.categoria = risolviCategoria_(m.categoria, categorie);

  // Dal widget, senza categoria scelta: si propone la più probabile e si segna "da verificare"
  if (!m.categoria && m.origine === 'widget') {
    m.categoria = suggerisciCategoria_(m.descrizione, leggi_('Movimenti'), categorie) || '';
    m.da_verificare = 'SI';
  }
  if (m.categoria === 'carb' && !m.carburante) m.carburante = /gpl/i.test(m.descrizione || '') ? 'gpl' : 'benzina';
  if (m.categoria === 'carb' && !m.litri) { var l = litriDa_(m.descrizione); if (l) m.litri = l; }
  var canon = descrizioneUniforme_(m.descrizione, m.categoria);
  if (canon) m.descrizione = canon;
  if (!m.data) m.data = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd');
  if (!m.origine) m.origine = 'app';

  validaMovimento_(m, categorie);
  var ora = adesso_();
  m.creato_il = m.creato_il || ora;
  m.modificato_il = ora;
  scriviRighe_('Movimenti', [oggettoInRiga_('Movimenti', m)], true);
  return { id: m.id, messaggio: 'Spesa salvata: ' + euro_(numero_(m.importo)) + ' ' + (m.descrizione || '') };
}

function azioneModifica_(m) {
  if (!m || !m.id) throw new Error('Manca l\'id del movimento');
  var riga = trovaRiga_('Movimenti', m.id);
  if (riga < 0) throw new Error('Movimento non trovato');
  var sh = scheda_('Movimenti');
  var intest = SCHEDE.Movimenti;
  var vecchio = rigaInOggetto_('Movimenti', sh.getRange(riga, 1, 1, intest.length).getValues()[0]);
  var nuovo = {};
  intest.forEach(function (k) { nuovo[k] = (k in m) ? m[k] : vecchio[k]; });
  var categorie = leggi_('Categorie');
  nuovo.categoria = risolviCategoria_(nuovo.categoria, categorie);
  validaMovimento_(nuovo, categorie);
  nuovo.creato_il = vecchio.creato_il;
  nuovo.modificato_il = adesso_();
  sh.getRange(riga, 1, 1, intest.length).setValues([oggettoInRiga_('Movimenti', nuovo)]);
  return { id: m.id };
}

function azioneElimina_(d) {
  if (!d || !d.id) throw new Error('Manca l\'id del movimento');
  var riga = trovaRiga_('Movimenti', d.id);
  if (riga > 0) scheda_('Movimenti').deleteRow(riga);
  return { id: d.id, eliminato: riga > 0 };
}

/**
 * Più modifiche ai movimenti in una sola richiesta (usata dall'app, anche per la coda offline).
 * data = { aggiungi: [movimenti], modifica: [movimenti completi], elimina: [id] }
 * - aggiungi con un id già presente: ignorato (era già arrivato, niente doppioni)
 * - modifica di un id che non c'è: viene aggiunto
 * - le righe non valide vengono saltate e segnalate in "errori", le altre vengono salvate
 */
function azioneSalvaModifiche_(d) {
  var sh = scheda_('Movimenti');
  var intest = SCHEDE.Movimenti;
  var categorie = leggi_('Categorie');
  var n = sh.getLastRow() - 1;
  var valori = n > 0 ? sh.getRange(2, 1, n, intest.length).getValues() : [];
  var indice = {};
  valori.forEach(function (r, i) { indice[String(r[0])] = i; });
  var ora = adesso_(), errori = [], nuove = [], cambiate = false, quante = { aggiunti: 0, modificati: 0, eliminati: 0 };

  var prepara = function (m) {
    m.categoria = risolviCategoria_(m.categoria, categorie);
    validaMovimento_(m, categorie);
    if (!m.origine) m.origine = 'app';
  };

  (d.modifica || []).concat(d.aggiungi || []).forEach(function (m, k) {
    var eModifica = k < (d.modifica || []).length;
    try {
      if (!m || !m.id) throw new Error('movimento senza id');
      var i = indice[String(m.id)];
      if (i === -1) return; // già aggiunto in questa stessa richiesta
      if (i != null) {
        if (!eModifica) return; // già presente: era già arrivato
        var vecchio = rigaInOggetto_('Movimenti', valori[i]);
        var nuovo = {};
        intest.forEach(function (c) { nuovo[c] = (c in m) ? m[c] : vecchio[c]; });
        prepara(nuovo);
        nuovo.creato_il = vecchio.creato_il; nuovo.modificato_il = ora;
        valori[i] = oggettoInRiga_('Movimenti', nuovo);
        cambiate = true; quante.modificati++;
      } else {
        prepara(m);
        m.creato_il = ora; m.modificato_il = ora;
        nuove.push(oggettoInRiga_('Movimenti', m));
        indice[String(m.id)] = -1; // evita doppioni nella stessa richiesta
        quante.aggiunti++;
      }
    } catch (err) {
      errori.push((m && m.descrizione ? m.descrizione + ' ' : '') + (m && m.data ? m.data : '') + ': ' + err.message);
    }
  });

  if (cambiate) {
    var r = sh.getRange(2, 1, valori.length, intest.length);
    r.setNumberFormats(valori.map(function () { return intest.map(formatoColonna_.bind(null, 'Movimenti')); }));
    r.setValues(valori);
  }
  // Cancellazioni dal basso verso l'alto, così i numeri di riga restano giusti
  (d.elimina || []).map(function (id) { return indice[String(id)]; })
    .filter(function (i) { return i != null && i >= 0; })
    .sort(function (a, b) { return b - a; })
    .forEach(function (i) { sh.deleteRow(i + 2); quante.eliminati++; });
  if (nuove.length) scriviRighe_('Movimenti', nuove, true);
  quante.errori = errori;
  return quante;
}

/** Sovrascrive tutta la scheda con l'elenco ricevuto (una riga per oggetto). */
function salvaScheda_(nome, elenco, valida) {
  if (!Array.isArray(elenco)) throw new Error('Per ' + nome + ' serve un elenco');
  if (valida) elenco.forEach(valida);
  var sh = scheda_(nome);
  var n = sh.getLastRow();
  if (n > 1) sh.getRange(2, 1, n - 1, SCHEDE[nome].length).clearContent();
  scriviRighe_(nome, elenco.map(function (o) { return oggettoInRiga_(nome, o); }));
  return { righe: elenco.length };
}

/** Accetta { chiave: valore, ... } oppure [{chiave, valore}, ...]. Aggiorna o aggiunge, non cancella le altre chiavi. */
function azioneSalvaImpostazioni_(d) {
  var nuove = {};
  if (Array.isArray(d)) d.forEach(function (r) { nuove[r.chiave] = r.valore; });
  else Object.keys(d).forEach(function (k) { nuove[k] = d[k]; });
  var tutte = leggiImpostazioni_();
  Object.keys(nuove).forEach(function (k) { tutte[k] = nuove[k]; });
  var righe = Object.keys(tutte).map(function (k) { return { chiave: k, valore: tutte[k] == null ? '' : String(tutte[k]) }; });
  return salvaScheda_('Impostazioni', righe);
}

/** Categorie per il widget: "emoji nome", dalla più usata alla meno usata. */
function azioneCategorieWidget_() {
  var conteggio = {};
  leggi_('Movimenti').forEach(function (m) { if (m.categoria) conteggio[m.categoria] = (conteggio[m.categoria] || 0) + 1; });
  var cats = leggi_('Categorie').filter(function (c) {
    return c.attiva !== 'NO' && ['nec', 'ext', 'inv', 'tax', 'ent'].indexOf(c.gruppo) >= 0;
  });
  cats.sort(function (a, b) { return (conteggio[b.id] || 0) - (conteggio[a.id] || 0); });
  var elenco = cats.map(function (c) { return (c.emoji ? c.emoji + ' ' : '') + c.nome; });
  return {
    elenco: elenco,
    categorie: cats.map(function (c) { return { id: c.id, etichetta: (c.emoji ? c.emoji + ' ' : '') + c.nome }; }),
    testo: elenco.join('\n')
  };
}

/* ===================== Spese ricorrenti automatiche ===================== */

/** Inserisce le ricorrenze previste fino al mese corrente (anche gli arretrati), una volta sola ciascuna. */
function inserisciRicorrenti() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var n = inserisciRicorrenti_();
    Logger.log('Ricorrenti inserite: ' + n);
    return n;
  } finally {
    lock.releaseLock();
  }
}

/** Lavoro vero delle ricorrenti (chi la chiama deve avere già il blocco di scrittura). */
function inserisciRicorrenti_() {
  {
    var oggi = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM');
    var fatte = {};
    leggi_('RicorrentiInserite').forEach(function (r) { fatte[r.chiave] = true; });
    var nuoviMov = [], nuoveChiavi = [], ora = adesso_();

    leggi_('Ricorrenti').forEach(function (r) {
      if (!r.id || !r.dal_mese || !(numero_(r.importo) > 0)) return;
      var passo = Math.max(1, parseInt(r.ogni_mesi, 10) || 1);
      var fine = r.al_mese && r.al_mese < oggi ? r.al_mese : oggi;
      var p = String(r.dal_mese).split('-').map(Number), y = p[0], mm = p[1], giri = 0;
      while (giri++ < 600) {
        var ym = y + '-' + ('0' + mm).slice(-2);
        if (ym > fine) break;
        var chiave = r.id + '|' + ym;
        if (!fatte[chiave]) {
          var idMov = 'ric-' + r.id + '-' + ym;
          nuoviMov.push(oggettoInRiga_('Movimenti', {
            id: idMov, data: ym + '-01', descrizione: r.descrizione, categoria: r.categoria,
            importo: numero_(r.importo), ricorrente_id: r.id, origine: 'ricorrente', creato_il: ora, modificato_il: ora
          }));
          nuoveChiavi.push([chiave, idMov]);
          fatte[chiave] = true;
        }
        mm += passo;
        while (mm > 12) { mm -= 12; y++; }
      }
    });

    if (nuoviMov.length) scriviRighe_('Movimenti', nuoviMov, true);
    if (nuoveChiavi.length) scriviRighe_('RicorrentiInserite', nuoveChiavi, true);
    return nuoviMov.length;
  }
}

/* ===================== Controlli sui dati ===================== */

function validaMovimento_(m, categorie) {
  var imp = numero_(m.importo);
  if (!(imp > 0)) throw new Error('Importo non valido: deve essere un numero maggiore di zero');
  m.importo = Math.round(imp * 100) / 100;
  if (!dataValida_(m.data)) throw new Error('Data non valida (serve aaaa-mm-gg): ' + m.data);
  if (m.categoria && !categorie.some(function (c) { return c.id === m.categoria; })) throw new Error('Categoria inesistente: ' + m.categoria);
  if (m.quota_mia !== '' && m.quota_mia != null) {
    var q = numero_(m.quota_mia);
    if (isNaN(q) || q < 0 || q > m.importo) throw new Error('Quota mia non valida');
    m.quota_mia = Math.round(q * 100) / 100;
  }
  if (m.divisa_tipo && ['credito', 'offerto'].indexOf(m.divisa_tipo) < 0) throw new Error('divisa_tipo deve essere credito o offerto');
  if (m.carburante && ['benzina', 'gpl'].indexOf(m.carburante) < 0) throw new Error('carburante deve essere benzina o gpl');
  if (m.litri !== '' && m.litri != null) {
    var l = numero_(m.litri);
    if (isNaN(l) || l < 0) throw new Error('Litri non validi');
    m.litri = l;
  }
  ['credito_saldato', 'straordinaria', 'da_verificare'].forEach(function (k) { m[k] = m[k] === true || m[k] === 'SI' ? 'SI' : ''; });
}

function validaCategoria_(c) {
  if (!c.id || !c.nome) throw new Error('Ogni categoria deve avere id e nome');
  if (GRUPPI.indexOf(c.gruppo) < 0) throw new Error('Gruppo non valido per la categoria ' + c.nome);
}

function validaRicorrente_(r) {
  if (!r.id) throw new Error('Ogni spesa ricorrente deve avere un id');
  if (!(numero_(r.importo) > 0)) throw new Error('Importo non valido per la ricorrente ' + (r.descrizione || r.id));
  if (r.dal_mese && !/^\d{4}-\d{2}$/.test(r.dal_mese)) throw new Error('dal_mese deve essere aaaa-mm');
  if (r.al_mese && !/^\d{4}-\d{2}$/.test(r.al_mese)) throw new Error('al_mese deve essere aaaa-mm');
}

/** Accetta l'id della categoria, il nome, oppure "emoji nome" (come arriva dal widget). */
function risolviCategoria_(v, categorie) {
  if (v == null || v === '') return '';
  v = String(v).trim();
  if (categorie.some(function (c) { return c.id === v; })) return v;
  var n = normalizza_(v);
  var trovata = categorie.filter(function (c) { return normalizza_(c.nome) === n; })[0];
  return trovata ? trovata.id : v; // se non esiste, la validazione darà errore
}

/* ===================== Categoria suggerita e descrizioni uniformate (come nel prototipo) ===================== */

var LITRI = /(\d+(?:[.,]\d+)?)\s*l\b/i;

var DESCRIZIONI_UNIFORMI = {
  'pineta': 'Bar Pineta', 'bar pineta': 'Bar Pineta', 'caffe pineta': 'Bar Pineta',
  'caffe': 'Caffè', 'caffe fino': 'Caffè Fino', 'minuscoli': 'Bar Minuscoli', 'caffe minuscoli': 'Bar Minuscoli',
  'pizza': 'Pizza', 'ricarica cell': 'Ricarica cellulare', 'ricarica telefono': 'Ricarica cellulare', 'ricarica tim': 'Ricarica cellulare',
  'prime': 'Amazon Prime', 'amazon prime': 'Amazon Prime', 'vkey': 'Vikey', 'vikey': 'Vikey', 'stipendio': 'Stipendio',
  'autostrada': 'Autostrada', 'pedaggio': 'Autostrada', 'autostrada milini': 'Autostrada Milini',
  'autostrada x milini': 'Autostrada Milini', 'autostrada per milini': 'Autostrada Milini',
  'gpl': 'GPL', 'beneficienza': 'Beneficenza', 'dechatlon': 'Decathlon'
};

/** Minuscolo, senza accenti, senza litri, senza numeri e simboli. */
function normalizza_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\d+([.,]\d+)?\s*l\b/g, ' ').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function descrizioneUniforme_(t, c) {
  var n = normalizza_(t);
  if (c === 'carb' || (!c && LITRI.test(t || ''))) {
    if (/\bgpl\b/.test(n)) return 'GPL';
    if (!n || n === 'benzina' || n === 'l' || n === 'l benzina') return 'Benzina';
  }
  return DESCRIZIONI_UNIFORMI[n] || null;
}

function litriDa_(t) {
  var m = LITRI.exec(String(t || ''));
  return m ? Number(m[1].replace(',', '.')) : null;
}

/** Stessa logica del prototipo: descrizione identica pesa 3, poi le singole parole. Solo categorie di spesa. */
function suggerisciCategoria_(desc, movimenti, categorie) {
  var gruppoDi = {};
  categorie.forEach(function (c) { gruppoDi[c.id] = c.gruppo; });
  var ok = function (id) { return ['nec', 'ext', 'inv', 'tax', 'esc'].indexOf(gruppoDi[id]) >= 0; };
  var n = normalizza_(desc);
  if ((LITRI.test(desc || '') || /\b(gpl|benz|benzina|diesel|gasolio)\b/.test(n)) && gruppoDi.carb) return 'carb';
  if (!n) return null;

  var esatte = {}, parole = {};
  movimenti.forEach(function (m) {
    if (!m.categoria || !ok(m.categoria)) return;
    var k = normalizza_(m.descrizione);
    if (!k) return;
    (esatte[k] = esatte[k] || {})[m.categoria] = (esatte[k][m.categoria] || 0) + 1;
    k.split(' ').forEach(function (t) {
      if (t.length >= 3) (parole[t] = parole[t] || {})[m.categoria] = (parole[t][m.categoria] || 0) + 1;
    });
  });

  var punti = {};
  if (esatte[n]) Object.keys(esatte[n]).forEach(function (c) { punti[c] = esatte[n][c] * 3; });
  n.split(' ').forEach(function (t) {
    if (t.length < 3) return;
    var o = parole[t];
    if (!o && t.length >= 4) {
      var k = Object.keys(parole).filter(function (x) { return x.indexOf(t) === 0; })[0];
      if (k) o = parole[k];
    }
    if (!o) return;
    var tot = Object.keys(o).reduce(function (a, c) { return a + o[c]; }, 0);
    Object.keys(o).forEach(function (c) { punti[c] = (punti[c] || 0) + o[c] / tot; });
  });

  var migliore = null, v = -1;
  Object.keys(punti).forEach(function (c) { if (punti[c] > v) { v = punti[c]; migliore = c; } });
  return migliore;
}

/* ===================== Lettura e scrittura del foglio ===================== */

function scheda_(nome) {
  var sh = SpreadsheetApp.getActive().getSheetByName(nome);
  if (!sh) throw new Error('Manca la scheda "' + nome + '": esegui preparaFoglio');
  return sh;
}

function righe_(nome) { return Math.max(0, scheda_(nome).getLastRow() - 1); }

/** Legge una scheda come elenco di oggetti { intestazione: valore }. */
function leggi_(nome) {
  var sh = scheda_(nome);
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  var valori = sh.getRange(2, 1, n, SCHEDE[nome].length).getValues();
  return valori
    .filter(function (r) { return r.some(function (v) { return v !== '' && v != null; }); })
    .map(function (r) { return rigaInOggetto_(nome, r); });
}

function leggiImpostazioni_() {
  var o = {};
  leggi_('Impostazioni').forEach(function (r) { if (r.chiave) o[r.chiave] = r.valore; });
  return o;
}

function rigaInOggetto_(nome, r) {
  var o = {};
  SCHEDE[nome].forEach(function (k, i) {
    var v = r[i];
    if (v instanceof Date) v = Utilities.formatDate(v, FUSO, k === 'data' ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm:ss');
    o[k] = v;
  });
  return o;
}

function oggettoInRiga_(nome, o) {
  var numeri = COLONNE_NUMERI[nome] || [];
  return SCHEDE[nome].map(function (k) {
    var v = o[k];
    if (v == null) return '';
    if (numeri.indexOf(k) >= 0) { var x = numero_(v); return isNaN(x) || v === '' ? '' : x; }
    if (v === true) return 'SI';
    if (v === false) return 'NO';
    return String(v);
  });
}

/** Scrive righe in fondo alla scheda (in coda = true) oppure dalla riga 2. */
function scriviRighe_(nome, righe, inCoda) {
  if (!righe.length) return;
  var sh = scheda_(nome);
  var inizio = inCoda ? sh.getLastRow() + 1 : 2;
  var r = sh.getRange(inizio, 1, righe.length, SCHEDE[nome].length);
  // Formato delle celle prima di scrivere, così Google non trasforma le date "aaaa-mm-gg" in date sue
  var formati = SCHEDE[nome].map(formatoColonna_.bind(null, nome));
  r.setNumberFormats(righe.map(function () { return formati; }));
  r.setValues(righe);
}

function formatoColonna_(nome, k) {
  if ((COLONNE_NUMERI[nome] || []).indexOf(k) < 0) return '@';
  return k === 'anno' || k === 'ogni_mesi' || k === 'km' ? '0' : '0.00';
}

/** Numero di riga del movimento con questo id, oppure -1. */
function trovaRiga_(nome, id) {
  var sh = scheda_(nome);
  if (sh.getLastRow() < 2) return -1;
  var c = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
  return c ? c.getRow() : -1;
}

/** Testo per tutte le colonne (le date restano "aaaa-mm-gg"), numeri con due decimali dove servono. */
function formattaColonne_(sh, nome) {
  SCHEDE[nome].forEach(function (k, i) {
    sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat(formatoColonna_(nome, k));
  });
}

/* ===================== Piccoli aiuti ===================== */

function numero_(v) {
  if (typeof v === 'number') return v;
  if (v == null) return NaN;
  var s = String(v).trim().replace(/\s/g, '').replace('€', '');
  if (s === '') return NaN;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  return Number(s);
}

function dataValida_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  var p = String(s).split('-').map(Number);
  var d = new Date(p[0], p[1] - 1, p[2]);
  return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
}

function euro_(x) {
  var s = (Math.round(x * 100) / 100).toFixed(2).split('.');
  return s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1] + '€';
}

function adesso_() { return Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd HH:mm:ss'); }

function generaChiave_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }

function risposta_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
