/**
 * Importazione dei movimenti 2026 dal vecchio foglio di Denis.
 * Il vecchio foglio viene SOLO LETTO, mai modificato.
 *
 * Si usa dal menu "App spese" del foglio (compare dopo aver ricaricato la pagina):
 * 1. "Giro di prova importazione": crea la scheda "ProvaImportazione" con tutte le spese convertite
 *    e mostra un riepilogo. Nella scheda si possono correggere categoria, descrizione, data, importo,
 *    scrivere SI in "straordinaria" e NO in "importa" per le righe da saltare.
 * 2. "Importa nel foglio": copia in Movimenti le righe della scheda ProvaImportazione con importa = SI.
 *
 * L'indirizzo del vecchio foglio non è scritto qui: si incolla la prima volta e resta nelle
 * Proprietà dello script (VECCHIO_FOGLIO).
 */

var PROVA = 'ProvaImportazione';
var PROVA_COLONNE = ['riga_vecchia', 'importa', 'data', 'descrizione', 'categoria', 'importo', 'straordinaria',
  'litri', 'carburante', 'nota', 'problemi', 'descrizione_originale', 'categoria_vecchia'];

/* Tabella di conversione: se la categoria vecchia contiene il testo → categoria nuova (o regola) */
var CONVERSIONE = [
  ['svago', 'risto'], // prima di "cibo": "Svago / Cibo" va in Ristoranti e bar
  ['benzina', 'carb'], ['trasporti', 'TRASPORTI'], ['sanita', 'salute'], ['cura personale', 'cura'],
  ['altre spese', 'ALTRE'], ['tax', 'TAX'], ['casa', 'casa'], ['cibo', 'spesa'], ['sport', 'sport'],
  ['telefono', 'tel'], ['vestiti', 'vestiti'], ['animali', 'animali'], ['svago', 'risto'],
  ['abbonamenti', 'abbon'], ['viaggi', 'viaggi'], ['regali', 'regali'], ['bricolaige', 'brico'],
  ['bricolage', 'brico'], ['cult', 'formaz'], ['zona', 'zona'], ['cripto', 'cripto'], ['airbnb', 'airbnb'],
  ['finanz', 'merc'], ['altri investimenti', 'oro'], ['stip', 'stip'], ['extra lavoro', 'extra'],
  ['altre entrate', 'altrent'], ['mance', 'mance'], ['royalties', 'royal']
];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('App spese')
    .addItem('1. Giro di prova importazione 2026', 'giroDiProva')
    .addItem('2. Importa nel foglio', 'importa2026')
    .addSeparator()
    .addItem('Cambia indirizzo del vecchio foglio', 'cambiaVecchioFoglio')
    .addToUi();
}

function cambiaVecchioFoglio() {
  PropertiesService.getScriptProperties().deleteProperty('VECCHIO_FOGLIO');
  idVecchioFoglio_();
}

/** Restituisce l'id del vecchio foglio; la prima volta lo chiede. */
function idVecchioFoglio_() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty('VECCHIO_FOGLIO');
  if (id) return id;
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Vecchio foglio', 'Incolla il link del vecchio foglio delle spese 2026:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) throw new Error('Importazione annullata');
  var m = /\/d\/([a-zA-Z0-9_-]{20,})/.exec(r.getResponseText()) || /^([a-zA-Z0-9_-]{20,})$/.exec(r.getResponseText().trim());
  if (!m) throw new Error('Non riconosco il link: deve contenere /d/...');
  p.setProperty('VECCHIO_FOGLIO', m[1]);
  return m[1];
}

/** Converte la categoria vecchia nella nuova, applicando le regole speciali. */
function categoriaNuova_(vecchia, descrizione) {
  var v = normalizza_(vecchia);
  if (!v) return { id: '', ok: true };
  var d = normalizza_(descrizione);
  for (var i = 0; i < CONVERSIONE.length; i++) {
    if (v.indexOf(CONVERSIONE[i][0]) < 0) continue;
    var c = CONVERSIONE[i][1];
    if (c === 'TRASPORTI') {
      if (/autostrada|pedaggio|bus|pullman|parcheggio/.test(d)) c = 'pedaggi';
      else if (LITRI.test(descrizione || '')) c = 'carb';
      else c = 'auto';
    } else if (c === 'ALTRE') {
      c = /benefic/.test(d) ? 'benef' : /assicuraz/.test(d) ? 'assic' : 'altre';
    } else if (c === 'TAX') {
      c = /contribut/.test(d) ? 'tasse' : 'prof';
    }
    return { id: c, ok: true };
  }
  return { id: '', ok: false };
}

/** Legge il vecchio foglio e prepara le righe convertite. */
function leggiVecchio_() {
  var vecchio = SpreadsheetApp.openById(idVecchioFoglio_());
  var sh = vecchio.getSheetByName('Lista Movimenti');
  if (!sh) {
    throw new Error('Nel vecchio foglio non trovo la scheda "Lista Movimenti". Schede presenti: ' +
      vecchio.getSheets().map(function (s) { return s.getName(); }).join(', '));
  }
  var fuso = vecchio.getSpreadsheetTimeZone();
  var n = sh.getLastRow() - 1;
  if (n < 1) return { righe: [], segnaposto: 0 };
  var valori = sh.getRange(2, 1, n, 6).getValues();
  var testi = sh.getRange(2, 1, n, 6).getDisplayValues();

  var righe = [], segnaposto = 0, ultimaData = '';
  for (var i = 0; i < n; i++) {
    var v = valori[i], t = testi[i], problemi = [], nota = String(v[5] || '').trim();
    var desc = String(v[0] || '').trim(), catVecchia = String(v[1] || '').trim();
    if (desc === 'Nome' && catVecchia === 'Categoria') continue; // riga delle intestazioni

    // Importo: numero, oppure orario (Excel trasforma 3,50 in 03:50)
    var importo, grezzo = v[2];
    if (grezzo instanceof Date) {
      var o = /^(\d{1,2})[:.](\d{2})/.exec(t[2]);
      importo = o ? Number(o[1]) + Number(o[2]) / 100 : NaN;
      problemi.push('importo salvato come orario (' + t[2] + ')');
      nota = (nota ? nota + ' - ' : '') + 'importo da verificare';
    } else {
      importo = numero_(grezzo);
    }
    if (grezzo === '' || grezzo == null || importo === 0) { segnaposto++; continue; } // righe segnaposto

    // Data
    var data = '';
    if (v[3] instanceof Date) data = Utilities.formatDate(v[3], fuso, 'yyyy-MM-dd');
    else {
      var dm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(t[3]).trim());
      if (dm) data = dm[3] + '-' + ('0' + dm[2]).slice(-2) + '-' + ('0' + dm[1]).slice(-2);
    }
    if (!data) { data = ultimaData; problemi.push('data mancante: usata quella della riga sopra'); }
    else ultimaData = data;

    var cat = categoriaNuova_(catVecchia, desc);
    if (!cat.ok) problemi.push('categoria "' + catVecchia + '" non riconosciuta');

    var litri = '', carb = '';
    if (cat.id === 'carb') {
      litri = litriDa_(desc) || '';
      carb = /gpl/i.test(desc) ? 'gpl' : 'benzina';
    }
    var nuovaDesc = descrizioneUniforme_(desc, cat.id) || desc;

    var importa = 'SI';
    if (isNaN(importo)) { problemi.push('importo non leggibile: ' + t[2]); importa = 'NO'; }
    else if (importo < 0) { problemi.push('importo negativo'); importa = 'NO'; }
    if (!data) { problemi.push('nessuna data'); importa = 'NO'; }
    else if (data.slice(0, 4) !== '2026') { problemi.push('data non del 2026'); importa = 'NO'; }

    righe.push({
      riga_vecchia: i + 2, importa: importa, data: data, descrizione: nuovaDesc, categoria: cat.id,
      importo: isNaN(importo) ? '' : Math.round(importo * 100) / 100, straordinaria: '',
      litri: litri, carburante: carb, nota: nota, problemi: problemi.join('; '),
      descrizione_originale: desc, categoria_vecchia: catVecchia
    });
  }
  return { righe: righe, segnaposto: segnaposto };
}

/** Giro di prova: scrive la scheda ProvaImportazione e mostra il riepilogo. Non tocca Movimenti. */
function giroDiProva() {
  var dati = leggiVecchio_();
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(PROVA) || ss.insertSheet(PROVA);
  sh.clear();
  sh.getRange(1, 1, 1, PROVA_COLONNE.length).setValues([PROVA_COLONNE]).setFontWeight('bold');
  sh.setFrozenRows(1);
  if (dati.righe.length) {
    var r = sh.getRange(2, 1, dati.righe.length, PROVA_COLONNE.length);
    r.setNumberFormat('@');
    sh.getRange(2, 6, dati.righe.length, 1).setNumberFormat('0.00');
    r.setValues(dati.righe.map(function (o) { return PROVA_COLONNE.map(function (k) { return o[k]; }); }));
    // Evidenzia: giallo le righe con problemi, azzurro le spese sopra 500€
    dati.righe.forEach(function (o, i) {
      if (o.problemi) sh.getRange(i + 2, 1, 1, PROVA_COLONNE.length).setBackground('#fff3bf');
      else if (o.importo > 500) sh.getRange(i + 2, 1, 1, PROVA_COLONNE.length).setBackground('#d0ebff');
    });
  }
  sh.autoResizeColumns(1, PROVA_COLONNE.length);
  mostraRiepilogo_(dati, 'Giro di prova (niente è stato ancora importato)');
}

/** Riepilogo in una finestra: totali, conversione delle categorie, problemi, spese sopra 500€. */
function mostraRiepilogo_(dati, titolo) {
  var nomi = {};
  leggi_('Categorie').forEach(function (c) { nomi[c.id] = c.emoji + ' ' + c.nome; });
  var daImp = dati.righe.filter(function (r) { return r.importa === 'SI'; });
  var conv = {}, perCat = {};
  dati.righe.forEach(function (r) {
    var k = (r.categoria_vecchia || '(vuota)') + ' → ' + (r.categoria ? nomi[r.categoria] || r.categoria : 'Senza categoria');
    conv[k] = (conv[k] || 0) + 1;
  });
  daImp.forEach(function (r) {
    var k = r.categoria ? nomi[r.categoria] || r.categoria : 'Senza categoria';
    perCat[k] = perCat[k] || { n: 0, t: 0 };
    perCat[k].n++; perCat[k].t += Number(r.importo) || 0;
  });
  var problemi = dati.righe.filter(function (r) { return r.problemi; });
  var grandi = dati.righe.filter(function (r) { return Number(r.importo) > 500; });
  var e = function (s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
  var dataIt = function (s) { var p = String(s).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; };

  var h = '<div style="font-family:Arial,sans-serif;font-size:13px">';
  h += '<p><b>Movimenti trovati: ' + dati.righe.length + '</b> · da importare: <b>' + daImp.length + '</b> · righe segnaposto saltate: ' + dati.segnaposto + '</p>';
  h += '<h3>Totali per categoria nuova</h3><table border="1" cellpadding="3" style="border-collapse:collapse">';
  Object.keys(perCat).sort().forEach(function (k) { h += '<tr><td>' + e(k) + '</td><td align="right">' + perCat[k].n + '</td><td align="right">' + euro_(perCat[k].t) + '</td></tr>'; });
  h += '</table><h3>Conversione delle categorie</h3><table border="1" cellpadding="3" style="border-collapse:collapse">';
  Object.keys(conv).sort().forEach(function (k) { h += '<tr><td>' + e(k) + '</td><td align="right">' + conv[k] + '</td></tr>'; });
  h += '</table><h3>Righe con problemi (' + problemi.length + ', in giallo nella scheda)</h3><ul>';
  problemi.forEach(function (r) { h += '<li>Riga ' + r.riga_vecchia + ' · ' + dataIt(r.data) + ' · ' + e(r.descrizione_originale) + ' · ' + e(r.importo) + ' → ' + e(r.problemi) + '</li>'; });
  h += '</ul><h3>Spese sopra 500€ (' + grandi.length + ', in azzurro): quali sono straordinarie?</h3><ul>';
  grandi.forEach(function (r) { h += '<li>' + dataIt(r.data) + ' · ' + e(r.descrizione) + ' · ' + euro_(Number(r.importo)) + '</li>'; });
  h += '</ul></div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(h).setWidth(760).setHeight(560), titolo);
}

/** Importa in Movimenti le righe della scheda ProvaImportazione con importa = SI. */
function importa2026() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(PROVA);
  if (!sh || sh.getLastRow() < 2) { ui.alert('Prima fai il giro di prova (menu App spese, voce 1).'); return; }
  if (leggi_('Movimenti').some(function (m) { return m.origine === 'import'; })) {
    ui.alert('L\'importazione è già stata fatta: nella scheda Movimenti ci sono già movimenti importati. Non importo di nuovo per evitare doppioni.');
    return;
  }

  var valori = sh.getRange(2, 1, sh.getLastRow() - 1, PROVA_COLONNE.length).getValues();
  var categorie = leggi_('Categorie');
  var ora = adesso_(), righe = [], errori = [];
  valori.forEach(function (v) {
    var o = {};
    PROVA_COLONNE.forEach(function (k, i) { o[k] = v[i] instanceof Date ? Utilities.formatDate(v[i], FUSO, 'yyyy-MM-dd') : v[i]; });
    if (String(o.importa).toUpperCase() !== 'SI') return;
    var m = {
      id: 'imp2026-' + o.riga_vecchia, data: String(o.data), descrizione: String(o.descrizione),
      categoria: risolviCategoria_(o.categoria, categorie), importo: o.importo,
      straordinaria: String(o.straordinaria).toUpperCase() === 'SI' ? 'SI' : '',
      litri: o.litri, carburante: String(o.carburante || ''), nota: String(o.nota || ''),
      origine: 'import', creato_il: ora, modificato_il: ora
    };
    try { validaMovimento_(m, categorie); righe.push(oggettoInRiga_('Movimenti', m)); }
    catch (err) { errori.push('Riga vecchia ' + o.riga_vecchia + ': ' + err.message); }
  });

  if (errori.length) {
    ui.alert('Non ho importato niente: correggi queste righe nella scheda ' + PROVA + ' e riprova.\n\n' + errori.slice(0, 20).join('\n'));
    return;
  }
  var ok = ui.alert('Importazione', 'Sto per importare ' + righe.length + ' movimenti nella scheda Movimenti. Procedo?', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { scriviRighe_('Movimenti', righe, true); } finally { lock.releaseLock(); }
  var straord = righe.filter(function (r) { return r[SCHEDE.Movimenti.indexOf('straordinaria')] === 'SI'; }).length;
  ui.alert('Fatto: importati ' + righe.length + ' movimenti (' + straord + ' straordinari). La scheda ' + PROVA + ' puoi tenerla per controllo o cancellarla.');
}
