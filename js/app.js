/* Interfaccia dell'app "Le mie spese": schermate, moduli, finestre, grafici. */
"use strict";
/* ===== Navigazione ===== */
const UI = { tab: "ins", y: new Date().getFullYear(), mo: new Date().getMonth() + 1, inclS: false, showInv: false, lineL: true, lineN: true, lineQ: true, tS: true, tI: false, altro: null, open: {}, f: { mo: String(new Date().getMonth() + 1), c: "", q: "" }, form: null };
let charts = [];
function killCharts() { charts.forEach(c => { try { c.destroy(); } catch (e) { } }); charts = []; }
function go(tab, sub) { UI.tab = tab; if (tab === "altro") UI.altro = sub || null; render(); window.scrollTo(0, 0); }
document.getElementById("nav").addEventListener("click", e => { const b = e.target.closest("button[data-tab]"); if (b) go(b.dataset.tab); });

let LEGS = [];
function legBtn(t) { LEGS.push(t); return `<button type="button" class="legbtn" data-act="leg" data-k="${LEGS.length - 1}" aria-label="Legenda" title="Legenda">?</button>`; }
function render() {
  killCharts(); LEGS = [];
  const v = document.getElementById("view");
  // Primo avvio: niente collegamento al foglio. Oppure collegato ma dati non ancora arrivati.
  const nav = document.getElementById("nav");
  if (!leggiCfg()) { nav.hidden = true; document.getElementById("ttl").textContent = "Le mie spese"; v.innerHTML = viewCollega(); return; }
  if (!S) { nav.hidden = true; v.innerHTML = `<section class="card"><h2>Caricamento dei dati...</h2><div class="small muted">Sto leggendo il tuo Google Foglio. La prima volta può volerci qualche secondo.</div><div id="loadErr" class="small neg"></div></section>`; return; }
  nav.hidden = false;
  if (S.objAnno !== UI.y) { S.obj = objFor(UI.y); S.objAnno = UI.y; } // obiettivi dell'anno che si sta guardando
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.tab === UI.tab));
  const ttl = { ins: "Le mie spese", mov: "Movimenti", mese: "Analisi del mese", anno: "Analisi dell'anno", altro: "Altro" }[UI.tab];
  document.getElementById("ttl").textContent = ttl;
  // Se una schermata si blocca, invece di non fare niente mostra l'errore (da comunicare a chi mantiene l'app)
  try {
    if (UI.tab === "ins") v.innerHTML = viewIns();
    else if (UI.tab === "mov") v.innerHTML = viewMov();
    else if (UI.tab === "mese") v.innerHTML = viewMese();
    else if (UI.tab === "anno") v.innerHTML = viewAnno();
    else v.innerHTML = viewAltro();
    afterRender();
  } catch (e) {
    v.innerHTML = `<section class="banner warn"><b>Questa schermata non si è aperta per un errore.</b><div class="small">Versione ${VERSIONE_APP}. Errore: ${esc(e && e.message ? e.message : String(e))}</div><div class="tiny" style="overflow-wrap:anywhere">${esc(String(e && e.stack || "").split("\n").slice(0, 3).join(" · "))}</div><div class="small">Le altre schermate funzionano: puoi tornare indietro con la barra in basso.</div></section>`;
  }
}

/* ===== Modulo di inserimento (usato anche per modificare) ===== */
function newForm(m) {
  if (m) {
    const g = grpOf(m.c);
    return { id: m.id, tipo: g === "ent" ? "ent" : "spe", a: String(m.a).replace(".", ","), t: m.t, c: m.c || "", d: m.d, n: m.n || "", s: !!m.s, l: m.l ? String(m.l).replace(".", ",") : "", sh: !!m.sh, mia: m.sh ? String(m.sh.mia).replace(".", ",") : "", shT: m.sh ? m.sh.tipo : "cred", chi: m.sh ? m.sh.chi || "" : (m.chi || ""), ft: m.ft || "", manual: true, r: m.r };
  }
  return { id: null, tipo: "spe", a: "", t: "", c: "", d: todayISO(), n: "", s: false, l: "", sh: false, mia: "", shT: "cred", chi: "", manual: false };
}
/* Quante volte è stata usata ogni categoria: serve a mettere in cima le più scelte */
function catUse() { if (!CACHE.use) { CACHE.use = {}; S.movs.forEach(m => { if (m.c) CACHE.use[m.c] = (CACHE.use[m.c] || 0) + 1; }); } return CACHE.use; }
function catOptions(tipo, sel, noNew) {
  const gs = OKG(tipo); const U = catUse();
  let h = `<option value="">Scegli la categoria</option>`;
  for (const g of gs) {
    const cs = catsOf(g).filter(c => !c.off || c.id === sel).sort((a, b) => (U[b.id] || 0) - (U[a.id] || 0)); if (!cs.length) continue;
    h += `<optgroup label="${esc(gname(g))}">` + cs.map(c => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(c.e + " " + c.n)}</option>`).join("") + `</optgroup>`;
  }
  return h + (noNew ? "" : `<option value="__new">+ Nuova categoria...</option>`);
}
function formHTML(F, pfx) {
  const people = [...new Set(allCred().map(c => c.chi))];
  const isCarb = F.c === "carb";
  return `
  <div class="seg" role="group" aria-label="Tipo di movimento">
    <button type="button" data-act="ftipo" data-v="spe" class="${F.tipo === "spe" ? "on" : ""}">Spesa</button>
    <button type="button" data-act="ftipo" data-v="ent" class="${F.tipo === "ent" ? "on" : ""}">Entrata</button>
  </div>
  <label for="${pfx}a">Importo
    <input id="${pfx}a" class="amount num" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(F.a)}" data-f="a"></label>
  <label for="${pfx}t">Descrizione
    <input id="${pfx}t" autocomplete="off" placeholder="${F.tipo === "ent" ? "es. stipendio, provvigione" : "es. bar pineta, pizza, 30L"}" value="${esc(F.t)}" data-f="t"></label>
  <div id="${pfx}sug"></div>
  <label for="${pfx}c">Categoria
    <select id="${pfx}c" data-f="c">${catOptions(F.tipo, F.c)}</select></label>
  <div id="${pfx}hint" class="hint" aria-live="polite">${F.hint || ""}</div>
  ${isCarb ? `<div class="seg" role="group" aria-label="Tipo di carburante"><button type="button" data-act="fft" data-v="benzina" class="${(F.ft || "benzina") === "benzina" ? "on" : ""}">⛽ Benzina</button><button type="button" data-act="fft" data-v="gpl" class="${F.ft === "gpl" ? "on" : ""}">🔵 GPL</button></div>` : ""}
  <div class="grid2">
    <label for="${pfx}d">Data<input id="${pfx}d" type="date" value="${esc(F.d)}" data-f="d"></label>
    ${isCarb ? `<label for="${pfx}l">Litri<input id="${pfx}l" inputmode="decimal" placeholder="es. 30,5" value="${esc(F.l)}" data-f="l"></label>` : F.c === "cred" ? `<label for="${pfx}chi2">Chi me li deve<input id="${pfx}chi2" list="${pfx}ppl2" value="${esc(F.chi)}" data-f="chi" placeholder="nome"></label><datalist id="${pfx}ppl2">${people.map(p => `<option value="${esc(p)}">`).join("")}</datalist>` : "<div></div>"}
  </div>
  <details ${F.s || F.sh || F.n ? "open" : ""}><summary>Altre opzioni</summary>
    <div class="stack" style="padding-top:8px">
      <label for="${pfx}n">Nota<input id="${pfx}n" value="${esc(F.n)}" data-f="n" placeholder="facoltativa"></label>
      ${F.tipo === "spe" ? `
      <label class="chk" for="${pfx}s"><input type="checkbox" id="${pfx}s" data-f="s" ${F.s ? "checked" : ""}>Spesa straordinaria (es. auto, corso): esclusa dal budget del mese</label>
      <label class="chk" for="${pfx}sh"><input type="checkbox" id="${pfx}sh" data-f="sh" ${F.sh ? "checked" : ""}>Spesa divisa con altri</label>
      ${F.sh ? `<div class="stack" style="padding-left:28px">
        <label for="${pfx}mia">La mia quota<input id="${pfx}mia" inputmode="decimal" placeholder="0,00" value="${esc(F.mia)}" data-f="mia"></label>
        <div class="tiny muted">La parte degli altri:</div>
        <label class="chk"><input type="radio" name="${pfx}shT" data-f="shT" value="cred" ${F.shT === "cred" ? "checked" : ""}>Me la devono restituire (credito)</label>
        <label class="chk"><input type="radio" name="${pfx}shT" data-f="shT" value="reg" ${F.shT === "reg" ? "checked" : ""}>L'ho offerta io (va in Cose offerte)</label>
        ${F.shT === "cred" ? `<label for="${pfx}chi">Chi me li deve<input id="${pfx}chi" list="${pfx}ppl" value="${esc(F.chi)}" data-f="chi" placeholder="nome"></label><datalist id="${pfx}ppl">${people.map(p => `<option value="${esc(p)}">`).join("")}</datalist>` : ""}
      </div>` : ""}` : ""}
    </div>
  </details>
  <div id="${pfx}err" class="small neg" aria-live="polite"></div>
  <button type="button" class="pri wide" data-act="fsave">${F.id ? "Salva modifiche" : (F.tipo === "ent" ? "Salva entrata" : "Salva spesa")}</button>
  ${F.id ? `<button type="button" class="danger wide" data-act="fdel">Elimina movimento</button>` : ""}`;
}
let FCTX = null;
function bindForm(root, F, pfx, onSaved) {
  FCTX = { F, pfx, root, onSaved };
  if (root._bound) return; root._bound = true;
  root.addEventListener("input", formInput);
  root.addEventListener("change", formInput);
  root.addEventListener("click", formClick);
}
function rerenderForm() {
  const { F, pfx, root } = FCTX; const box = root.querySelector("[data-formbox]");
  const act = document.activeElement && document.activeElement.id;
  box.innerHTML = formHTML(F, pfx);
  if (act) { const el = document.getElementById(act); if (el) { el.focus(); if (el.setSelectionRange && el.type !== "date" && el.value) try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { } } }
}
function formInput(e) {
  if (!FCTX) return; const el = e.target; const f = el.dataset && el.dataset.f; if (!f) return;
  const F = FCTX.F;
  if (el.type === "checkbox") { F[f] = el.checked; if (e.type === "change") rerenderForm(); return; }
  if (el.type === "radio") { F[f] = el.value; if (e.type === "change") rerenderForm(); return; }
  if (f === "c") {
    if (e.type !== "change") return;
    if (el.value === "__new") { el.value = F.c || ""; openNewCat(F.tipo === "ent" ? "ent" : "ext", id => { F.c = id; F.manual = true; rerenderForm(); }); return; }
    const was = F.c; F.c = el.value; F.manual = true; F.hint = "";
    document.getElementById(FCTX.pfx + "hint").textContent = "";
    if ((was === "carb") !== (F.c === "carb") || (was === "cred") !== (F.c === "cred")) rerenderForm();
    return;
  }
  F[f] = el.value;
  if (f === "t" && e.type === "input") {
    const sug = descSuggestions(F.t, F.tipo);
    const box = document.getElementById(FCTX.pfx + "sug");
    box.innerHTML = sug.length ? `<div class="sug">${sug.map(s => `<button type="button" data-act="fpick" data-t="${esc(s.t)}" data-c="${esc(s.c)}"><span>${esc(s.t)}</span><span class="tiny muted">${esc(catLab(s.c))}</span></button>`).join("")}</div>` : "";
    if (!F.manual) {
      const c = suggestCat(F.t, F.tipo);
      if (c && c !== F.c) {
        const wasCarb = F.c === "carb"; F.c = c;
        F.hint = "Categoria suggerita dalle tue spese precedenti: controlla e salva";
        document.getElementById(FCTX.pfx + "c").value = c; document.getElementById(FCTX.pfx + "hint").textContent = F.hint;
        if (wasCarb !== (c === "carb") || c === "cred") rerenderForm();
      }
      if (c === "carb") { const g = /\bgpl\b/i.test(F.t) ? "gpl" : /benz/i.test(F.t) ? "benzina" : null; if (g && g !== F.ft) { F.ft = g; rerenderForm(); } }
      if (c && LIT.test(F.t) && !F.l) { F.l = F.t.match(LIT)[1]; const li = document.getElementById(FCTX.pfx + "l"); if (li) li.value = F.l; }
    }
  }
}
function formClick(e) {
  if (!FCTX) return; const b = e.target.closest("[data-act]"); if (!b) return; const F = FCTX.F;
  const act = b.dataset.act;
  if (act === "ftipo") { if (F.tipo !== b.dataset.v) { F.tipo = b.dataset.v; F.c = ""; F.manual = false; F.hint = ""; F.s = false; F.sh = false; rerenderForm(); } }
  else if (act === "fpick") { F.t = b.dataset.t; F.c = b.dataset.c; F.manual = true; F.hint = ""; if (LIT.test(F.t)) F.l = F.t.match(LIT)[1]; rerenderForm(); const a = document.getElementById(FCTX.pfx + "a"); if (a && !F.a) a.focus(); }
  else if (act === "fft") { const was = F.ft || "benzina"; F.ft = b.dataset.v; const nm = { benzina: "Benzina", gpl: "GPL" }; if (!F.t.trim() || F.t.trim() === nm[was]) F.t = nm[F.ft]; rerenderForm(); }
  else if (act === "fsave") saveForm();
  else if (act === "fdel") askDelete(F.id);
}
function saveForm() {
  const { F, pfx } = FCTX; const err = document.getElementById(pfx + "err");
  const a = parseNum(F.a);
  if (!(a > 0)) { err.textContent = "Scrivi un importo maggiore di zero."; document.getElementById(pfx + "a").focus(); return; }
  if (!F.t.trim()) { err.textContent = "Scrivi una breve descrizione."; document.getElementById(pfx + "t").focus(); return; }
  if (!F.c) { err.textContent = "Scegli una categoria."; document.getElementById(pfx + "c").focus(); return; }
  if (!F.d) { err.textContent = "Scegli la data."; return; }
  const m = F.id ? S.movs.find(x => x.id === F.id) : { id: uid() };
  m.a = r2(a); m.t = canonDesc(F.t.trim(), F.c) || F.t.trim(); m.c = F.c; m.d = F.d;
  delete m.dv; // salvato dall'app = verificato
  if (F.n.trim()) m.n = F.n.trim(); else delete m.n;
  if (F.tipo === "spe" && F.s) m.s = 1; else delete m.s;
  const l = parseNum(F.l); if (F.c === "carb" && l > 0) m.l = r2(l); else delete m.l;
  if (F.c === "carb") m.ft = F.ft || (/gpl/i.test(F.t) ? "gpl" : "benzina"); else delete m.ft;
  if (F.tipo === "spe" && F.sh) {
    const mia = parseNum(F.mia);
    if (!(mia >= 0) || mia > a) { err.textContent = "La tua quota deve essere tra 0 e l'importo totale."; return; }
    if (F.shT === "cred" && !F.chi.trim()) { err.textContent = "Scrivi il nome di chi ti deve i soldi."; return; }
    m.sh = { mia: r2(mia), tipo: F.shT, chi: F.shT === "cred" ? F.chi.trim() : "", ok: m.sh ? !!m.sh.ok : false };
  } else delete m.sh;
  if (F.c === "cred" && !F.sh) { if (!F.chi.trim()) { err.textContent = "Scrivi il nome di chi ti deve i soldi."; return; } m.chi = F.chi.trim(); } else delete m.chi;
  if (!F.id) S.movs.push(m);
  sortMovs(); persist();
  toast(F.id ? "Modifiche salvate" : (F.tipo === "ent" ? "Entrata salvata" : "Spesa salvata"));
  FCTX.onSaved && FCTX.onSaved();
}

/* ===== Vista: Inserisci ===== */
function viewIns() {
  const now = new Date(); const y = now.getFullYear(), mo = now.getMonth() + 1;
  const B = budgetYear(y)[mo - 1]; const A = monthAgg(y, mo);
  const frac = now.getDate() / daysIn(y, mo);
  const mese = B ? B.mese : 0; const st = statoRitmo(A.spese, mese, frac);
  const pM = mese > 0 ? A.spese / mese * 100 : (A.spese > 0 ? 100 : 0);
  const ncTot = S.movs.filter(m => !m.c).length;
  const dvTot = S.movs.filter(m => m.dv).length;
  const coda = codaLunghezza();
  const recent = S.movs.filter(m => m.d <= todayISO()).slice(-6).reverse();
  UI.form = UI.form || newForm();
  return `
  <section class="card" id="insbox"><div class="stack" data-formbox>${formHTML(UI.form, "i_")}</div></section>
  <section class="card">
    <div class="row between"><h2>${MESI[mo - 1]} ${legBtn(`Quota spese del mese (senza i mesi precedenti). La linea indica il giorno ${now.getDate()} su ${daysIn(y, mo)}: a questo punto del mese avresti potuto spendere circa ${eur0(mese * frac)}.`)}</h2><span class="pill" style="background:${st.c}">${Math.round(pM)}% del mese</span></div>
    <div class="tiles3">
      <div><span>Spesi</span><b>${eur(A.spese)}</b></div>
      <div><span>Rimanenti</span><b class="${sgn(mese - A.spese)}">${eur(mese - A.spese)}</b></div>
      <div><span>Quota mese</span><b>${eur(mese)}</b></div>
    </div>
    ${barCol(pM, st.c, frac * 100, 14)}
    ${yearQuotaHTML(y, true)}
  </section>
  <section class="card">
    <h2>Con il saldo dei mesi precedenti</h2>
    <div class="kv">
      <span>Bilancio mesi precedenti</span><b class="${sgn(B ? B.rip : 0)}">${eur(B ? B.rip : 0)}</b>
      <span>Quota spese del mese corrente</span><b>${eur(B ? B.mese : 0)}</b>
      <span>Bilancio compreso mese corrente</span><b class="${sgn(B ? B.disp : 0)}">${eur(B ? B.disp : 0)}</b>
      <span>Potenziale spesa del mese rimanente</span><b class="${sgn(B ? B.saldo : 0)}">${eur(B ? B.saldo : 0)}</b>
    </div>
  </section>
  ${dvTot ? `<section class="banner warn"><div><b>${dvTot} ${dvTot === 1 ? "spesa da verificare" : "spese da verificare"}.</b> Inserite dal widget senza scegliere la categoria: l'app ne ha proposta una. Aprile, controlla e salva.</div><div><button data-act="godv">Verificale</button></div></section>` : ""}
  ${coda ? `<section class="banner"><div><b>${coda} ${coda === 1 ? "modifica in attesa" : "modifiche in attesa"} di invio al foglio.</b> Sono salvate su questo dispositivo e partono da sole appena c'è connessione.</div><div><button data-act="retry">Riprova adesso</button></div></section>` : ""}
  ${ncTot ? `<section class="banner warn"><div><b>${ncTot} movimenti senza categoria.</b> Contano nelle spese ma non nelle analisi per categoria. Se sono spese da non contare (es. vacanza con amici da saldare insieme) assegna la categoria "Non conteggiato".</div><div><button data-act="gonc">Classificali</button></div></section>` : ""}
  ${kmDue() ? `<section class="banner"><b>Sono passati più di 3 mesi dall'ultima lettura dei km dell'auto.</b><div class="row"><input id="kmq" inputmode="numeric" placeholder="km del contachilometri" style="flex:1"><button class="pri" data-act="kmsave">Salva km</button></div></section>` : ""}
  <section class="card"><div class="row between"><h2>Ultimi movimenti</h2><button class="ghost" data-act="gomov">Vedi tutti</button></div>
    <div class="list">${recent.map(itemHTML).join("")}</div></section>`;
}
function itemHTML(m) {
  const g = grpOf(m.c); const ent = g === "ent";
  const badges = [];
  if (!m.c) badges.push(`<span class="badge warn">senza categoria</span>`);
  if (m.c === "noconta") badges.push(`<span class="badge">non conteggiato</span>`);
  if (m.s) badges.push(`<span class="badge">straordinaria</span>`);
  if (m.r) badges.push(`<span class="badge">ricorrente</span>`);
  if (m.sh) badges.push(`<span class="badge">divisa, mia ${eur(m.sh.mia)}</span>`);
  if ((m.sh && m.sh.tipo === "cred" && m.sh.ok) || (!m.sh && m.c === "cred" && m.ok)) badges.push(`<span class="badge">credito saldato</span>`);
  if (m.dv) badges.push(`<span class="badge warn">da verificare</span>`);
  if (m.c === "carb") badges.push(`<span class="badge">${m.ft === "gpl" ? "GPL" : "Benzina"}${m.l ? " " + String(m.l).replace(".", ",") + " L" : ""}</span>`);
  else if (m.l) badges.push(`<span class="badge">${String(m.l).replace(".", ",")} L</span>`);
  return `<div class="item" data-act="edit" data-id="${m.id}" role="button" tabindex="0">
    <div class="t"><span class="emo" aria-hidden="true">${catEmo(m.c)}</span> ${esc(m.t || "(senza descrizione)")}</div>
    <div class="a ${ent ? "pos" : ""} ${m.c === "noconta" ? "muted" : ""}">${ent ? "+" : "-"}${eur(m.a)}</div>
    <div class="m">${esc(catName(m.c))} · ${fmtShort(m.d)} ${badges.join("")}</div>
  </div>`;
}

/* ===== Vista: Movimenti ===== */
function viewMov() {
  const f = UI.f; const y = UI.y; const rng = f.from || f.to;
  let L = S.movs;
  if (f.c === "__dv") L = L.filter(m => m.dv); // da verificare: tutti gli anni
  else if (rng) { if (f.from) L = L.filter(m => m.d >= f.from); if (f.to) L = L.filter(m => m.d <= f.to); }
  else { L = L.filter(m => m.d.startsWith(String(y))); if (f.mo) L = L.filter(m => +m.d.slice(5, 7) === +f.mo); }
  if (f.c && f.c !== "__dv") L = L.filter(m => (m.c || "__nc") === f.c);
  if (f.q) { const q = norm(f.q); L = L.filter(m => norm(m.t + " " + (m.n || "")).includes(q)); }
  const cnt = L.filter(m => m.c !== "noconta");
  const sp = cnt.filter(m => grpOf(m.c) !== "ent").reduce((s, m) => s + m.a, 0), en = cnt.filter(m => grpOf(m.c) === "ent").reduce((s, m) => s + m.a, 0);
  L = L.slice().reverse();
  let h = "", last = "";
  for (const m of L) { if (m.d !== last) { h += `<div class="dayh">${fmtDay(m.d)}</div>`; last = m.d; } h += itemHTML(m); }
  return `
  <section class="card">
    <div class="grid2">
      <label for="fy">Anno<select id="fy" data-flt="y" ${rng ? "disabled" : ""}>${years().map(x => `<option ${x === y ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      <label for="fm">Mese<select id="fm" data-flt="mo" ${rng ? "disabled" : ""}><option value="">Tutto l'anno</option>${MESI.map((n, i) => `<option value="${i + 1}" ${+f.mo === i + 1 ? "selected" : ""}>${n}</option>`).join("")}</select></label>
    </div>
    <div class="grid2">
      <label for="ffrom">Dal giorno<input id="ffrom" type="date" data-flt="from" value="${esc(f.from || "")}"></label>
      <label for="fto">Al giorno<input id="fto" type="date" data-flt="to" value="${esc(f.to || "")}"></label>
    </div>
    ${rng ? `<div class="row between small"><span class="muted">Stai vedendo il periodo scelto: anno e mese sono ignorati.</span><button class="ghost" data-act="clrrng">Azzera date</button></div>` : ""}
    <label for="fc">Categoria<select id="fc" data-flt="c"><option value="">Tutte</option><option value="__nc" ${f.c === "__nc" ? "selected" : ""}>❓ Senza categoria</option><option value="__dv" ${f.c === "__dv" ? "selected" : ""}>⚠️ Da verificare (tutti gli anni)</option>${GROUPS.filter(g => g.id !== "cre").map(g => `<optgroup label="${esc(g.n)}">${catsOf(g.id).map(c => `<option value="${c.id}" ${f.c === c.id ? "selected" : ""}>${esc(c.e + " " + c.n)}</option>`).join("")}</optgroup>`).join("")}</select></label>
    <label for="fq">Cerca<input id="fq" data-flt="q" value="${esc(f.q)}" placeholder="descrizione o nota"></label>
    <div class="row between small"><span class="muted">${L.length} movimenti</span><span>Uscite <b class="num">${eur(sp)}</b> · Entrate <b class="num pos">${eur(en)}</b></span></div>
  </section>
  <section class="card"><div class="list">${h || `<div class="muted small">Nessun movimento con questi filtri.</div>`}</div></section>`;
}

/* ===== Riga obiettivo: nome sopra, barra, numeri sotto ===== */
function objRow(c, v, o, tick, y, mo) {
  const p = o > 0 ? v / o * 100 : 999;
  return `<div class="objrow" data-act="catdet" data-c="${c.id}" data-y="${y}" data-mo="${mo || ""}" role="button" tabindex="0">
    <div class="hd"><span class="small"><span class="emo">${c.e}</span> ${esc(c.n)}</span>${o ? pillHTML(p) : `<span class="badge">nessun obiettivo</span>`}</div>
    ${o ? barHTML(p, tick) : ""}
    <div class="nums"><span>Spesi <b>${eur(v)}</b></span><span>${o ? `${v <= o ? "Restano " + eur0(o - v) : "Oltre di " + eur0(v - o)} · obiettivo ${eur0(o)}` : ""}</span></div>
  </div>`;
}

/* ===== Vista: Mese ===== */
function viewMese() {
  const y = UI.y, mo = UI.mo, inclS = UI.inclS;
  const A = monthAgg(y, mo); const B = budgetYear(y)[mo - 1];
  const frac = monthFrac(y, mo); const tick = frac > 0 && frac < 1 ? frac * 100 : null;
  const rows = S.cats.filter(c => (c.g === "nec" || c.g === "ext")).map(c => ({ c, v: catAmt(A, c.id, inclS), o: S.obj[c.id] || 0 }));
  const spent = rows.filter(r => r.v > 0).sort((a, b) => (b.o ? b.v / b.o : 9) - (a.o ? a.v / a.o : 9));
  const zero = rows.filter(r => r.v === 0 && r.o > 0);
  const totO = S.cats.filter(c => c.g === "nec" || c.g === "ext").reduce((s, c) => s + (S.obj[c.id] || 0), 0);
  const totV = A.spese + (inclS ? A.straord : 0); const pT = totO ? totV / totO * 100 : 0;
  const straordL = A.movs.filter(m => m.s && m.c !== "noconta");
  let budget = `<div class="muted small">Il mese non è ancora iniziato.</div>`;
  if (B) {
    const st = statoRitmo(B.spese, B.mese, frac); const pM = B.mese > 0 ? B.spese / B.mese * 100 : 100;
    budget = `
      <div class="row between"><h2>Quota spese del mese ${legBtn(`${spendAcc(y, mo).p}% dello stipendio fisso (${eur(B.base)}) + ${spendAcc(y, mo).p}% delle entrate extra di ${MESI[(mo + 10) % 12]} (${eur(B.qExtra)}). Non tiene conto dei mesi precedenti.`)}</h2><span class="pill" style="background:${st.c}">${Math.round(pM)}% del mese</span></div>
      <div class="kv"><span>Quota spese mese ${MESI[mo - 1]}</span><b>${eur(B.mese)}</b><span>Spese ${MESI[mo - 1]}</span><b>${eur(B.spese)}</b><span>${B.mese - B.spese >= 0 ? "Restano" : "Sforamento del mese"}</span><b class="${sgn(B.mese - B.spese)}">${eur(B.mese - B.spese)}</b></div>
      ${barCol(pM, st.c, tick, 14)}
      `;
  }
  return `
  ${monthPicker()}
  <section class="card">${budget}</section>
  ${B ? `<section class="card"><h2>Con il saldo dei mesi precedenti ${legBtn(`Il bilancio di fine mese passa al mese dopo: se è positivo si somma, se è negativo si scala.`)}</h2>
    <div class="kv"><span>Quota spese mese ${MESI[mo - 1]}</span><b>${eur(B.mese)}</b><span>Bilancio mesi precedenti</span><b class="${sgn(B.rip)}">${eur(B.rip)}</b><span>Bilancio compreso mese corrente</span><b class="${sgn(B.disp)}">${eur(B.disp)}</b><span>Spese ${MESI[mo - 1]}</span><b>${eur(B.spese)}</b><span>Bilancio fine mese</span><b class="${sgn(B.saldo)}">${eur(B.saldo)}</b></div>
    </section>` : ""}
  ${B ? avanzoHTML(y, mo, B) : ""}
  <label class="chk card" style="flex-direction:row" for="inclS"><input type="checkbox" id="inclS" data-act="inclS" ${inclS ? "checked" : ""}>Includi le spese straordinarie in obiettivi e grafici${A.straord ? ` (questo mese ${eur(A.straord)})` : ""}</label>
  <section class="card"><h2>Dove sono finiti i soldi e obiettivi ${legBtn(`Barra = quanto hai speso nel mese e quota sul totale delle spese. A destra = quanto hai usato dell'obiettivo mensile, con i colori verde, giallo, arancione, rosso e nero${tick != null ? "; la linea indica il punto del mese" : ""}. Tocca una categoria per vedere le spese.`)}</h2>
    <div class="stack" style="gap:0">${totV > 0 ? mergedRows(A, y, inclS, tick, totV, mo) : `<div class="muted small">Nessuna spesa in questo mese.</div>`}</div>
    ${totO ? `<div class="totline"><b class="small">Totale spese necessarie + extra</b><div class="row" style="flex-wrap:nowrap;gap:10px"><div style="width:30%;flex:none">${barHTML(pT, tick)}</div><span class="small num" style="flex:1">${eur(totV)} su ${eur0(totO)}</span>${pillHTML(pT)}</div></div>` : ""}
    <button class="ghost" data-act="goobj" style="align-self:flex-start">Modifica obiettivi</button>
  </section>
  <section class="card"><h2>Tabella del mese</h2>${genTable([A], { obj: true, y, mo })}</section>
  ${straordL.length ? `<section class="card"><h2>Spese straordinarie</h2><div class="list">${straordL.map(itemHTML).join("")}</div></section>` : ""}
  ${pagellaHTML(y, mo)}
  ${smistHTML(y, mo)}`;
}
function monthPicker() {
  return `<section class="card"><div class="row between">
    <button data-act="mprev" aria-label="Mese precedente">‹</button>
    <h2>${MESI[UI.mo - 1]} ${UI.y}</h2>
    <button data-act="mnext" aria-label="Mese successivo">›</button></div></section>`;
}

/* ===== Tabella generale (mese o anno) =====
   cols: elenco di riepiloghi (un mese, oppure 12 mesi + totale + media).
   Le spunte decidono se straordinarie e investimenti entrano nel risultato. */
function tableToggles(lt) {
  return `<div class="row" style="gap:6px 16px">${legBtn(lt)}<label class="chk" for="tS"><input type="checkbox" id="tS" data-act="tS" ${UI.tS ? "checked" : ""}>Conta le spese straordinarie</label><label class="chk" for="tI"><input type="checkbox" id="tI" data-act="tI" ${UI.tI ? "checked" : ""}>Conta gli investimenti</label></div>`;
}
function genTable(cols, opt) {
  const lordo = LORDO(), tp = taxP();
  const yearMode = cols.length > 1; const div = opt.div || [];
  const v = (i, x) => div[i] ? x / div[i] : x;
  const objCol = !yearMode && opt.obj;
  const dmo = yearMode ? "" : opt.mo;
  const head = yearMode ? MESI3.map(m => `<th class="n">${m}</th>`).join("") + `<th class="n">Totale</th><th class="n">Media</th>` : `<th class="n">Importo</th>${objCol ? `<th class="n">Obiettivo</th>` : ""}`;
  const fmt = x => yearMode ? eur0(x) : eur(x);
  const cell = vals => vals.map(x => `<td class="n">${Math.abs(x) > 0.004 ? fmt(x) : ""}</td>`).join("");
  const oc = x => objCol ? `<td class="n">${x || ""}</td>` : "";
  const any = vals => vals.some(x => Math.abs(x) > 0.004);
  const parts = [lordo ? "entrate lorde meno imposte accantonate" : "entrate nette", "meno spese necessarie, extra e senza categoria"];
  if (UI.tS) parts.push("meno spese straordinarie"); if (UI.tI) parts.push("meno investimenti");
  const legT = `Risultato = ${parts.join(", ")}. Tocca un gruppo per aprire o chiudere le categorie, tocca una categoria per vedere le spese. Le spese "Non conteggiato" sono escluse.`;
  let h = tableToggles(legT) + `<div class="tblwrap"><table><thead><tr><th class="sticky">Voce</th>${head}</tr></thead><tbody>`;
  const grpRow = (id, label, cls, vals, extra) => `<tr class="g grp ${cls} ${UI.open[id] ? "open" : ""}" data-act="tog" data-g="${id}"><td class="sticky">${esc(label)}</td>${cell(vals)}${oc(extra)}</tr>`;
  const catRow = (c, vals, objV) => `<tr class="sub click" data-act="catdet" data-c="${c}" data-y="${opt.y}" data-mo="${dmo}"><td class="sticky">${esc(catLab(c))}</td>${cell(vals)}${oc(objV ? eur0(objV) : "")}</tr>`;
  const sumObj = gs => eur0(S.cats.filter(c => gs.includes(c.g)).reduce((s, c) => s + (S.obj[c.id] || 0), 0));
  // spese necessarie ed extra (senza straordinarie)
  const totSp = cols.map(() => 0);
  for (const g of ["nec", "ext"]) {
    const cs = catsOf(g); const vals = cols.map((A, i) => v(i, cs.reduce((s, c) => s + (A.cat[c.id] || 0), 0)));
    vals.forEach((x, i) => totSp[i] += x);
    h += grpRow(g, gname(g), "g" + g, vals, sumObj([g]));
    if (UI.open[g]) cs.forEach(c => { const cv = cols.map((A, i) => v(i, A.cat[c.id] || 0)); if (any(cv)) h += catRow(c.id, cv, S.obj[c.id]); });
  }
  const ncV = cols.map((A, i) => v(i, A.cat.__nc || 0));
  if (any(ncV)) { ncV.forEach((x, i) => totSp[i] += x); h += `<tr class="g click" data-act="catdet" data-c="__nc" data-y="${opt.y}" data-mo="${dmo}"><td class="sticky">❓ Senza categoria</td>${cell(ncV)}${oc("")}</tr>`; }
  h += `<tr class="g tot"><td class="sticky">Totale spese necessarie + extra</td>${cell(totSp)}${oc(sumObj(["nec", "ext"]))}</tr>`;
  // straordinarie
  if (UI.tS) {
    const strV = cols.map((A, i) => v(i, A.straord));
    h += grpRow("str", "Spese straordinarie", "gstr", strV);
    if (UI.open.str) S.cats.filter(c => c.g === "nec" || c.g === "ext").concat([{ id: "__nc" }]).forEach(c => { const cv = cols.map((A, i) => v(i, A.catS[c.id] || 0)); if (any(cv)) h += catRow(c.id, cv, 0).replace('data-act="catdet"', 'data-act="catdet" data-s="1"'); });
  }
  // investimenti
  if (UI.tI) {
    const invV = cols.map((A, i) => v(i, A.inv));
    h += grpRow("inv", "Investimenti (liquidità messa da parte)", "ginv", invV);
    if (UI.open.inv) catsOf("inv").forEach(c => { const cv = cols.map((A, i) => v(i, A.cat[c.id] || 0)); if (any(cv)) h += catRow(c.id, cv, 0); });
  }
  // imposte (solo con lordo)
  if (lordo) {
    const accV = cols.map((A, i) => v(i, A.taxAcc));
    h += grpRow("tax", gname("tax") + " (accantonate sulle entrate tassate)", "gtax", accV);
    if (UI.open.tax) {
      h += `<tr class="sub"><td class="sticky">Accantonate sulle entrate</td>${cell(accV)}${oc("")}</tr>`;
      h += `<tr class="sub info click" data-act="catdet" data-c="tasse" data-y="${opt.y}" data-mo="${dmo}"><td class="sticky">Versate nel periodo (informativo)</td>${cell(cols.map((A, i) => v(i, A.tax)))}${oc("")}</tr>`;
    }
  }
  // crediti (informativo)
  const creV = cols.map((A, i) => v(i, A.cre));
  if (any(creV)) h += `<tr class="sub info click" data-act="catdet" data-c="cred" data-y="${opt.y}" data-mo="${dmo}"><td class="sticky">🤝 Crediti verso altri (informativo)</td>${cell(creV)}${oc("")}</tr>`;
  // entrate
  const k = lordo ? 1 : (1 - tp);
  // Entrate nette: le entrate tassate perdono la percentuale delle imposte, le altre restano intere
  const netCat = (A, c) => A.months ? A.months.reduce((s, M) => s + netCat(M, c), 0) : (A.cat[c] || 0) * (lordo || !isTassata(c) ? 1 : 1 - taxP(A.y, A.mo));
  const entV = cols.map((A, i) => v(i, lordo ? A.ent : A.ent - A.taxAcc));
  h += grpRow("ent", lordo ? "Entrate lorde" : "Entrate nette (tolte le imposte sulle entrate tassate)", "gent", entV);
  if (UI.open.ent) catsOf("ent").forEach(c => { const cv = cols.map((A, i) => v(i, netCat(A, c.id))); if (any(cv)) h += catRow(c.id, cv, 0); });
  // risultato
  const res = cols.map((A, i) => v(i, resultOf(A)));
  h += `<tr class="gres"><td class="sticky">Risultato: profitto o perdita</td>${res.map(x => `<td class="n ${sgn(x)}">${fmt(x)}</td>`).join("")}${oc("")}</tr>`;
  h += `</tbody></table></div>`;
  return h;
}

function smistHTML(y, mo) {
  const A = monthAgg(y, mo); const prev = mo > 1 ? monthAgg(y, mo - 1) : monthAgg(y - 1, 12);
  const L = contiDelMese(y, mo); const tpPct = (L.find(a => a.tasse) || { p: 30 }).p; const pers = smistPersonalizzato(y, mo);
  const sumP = r2(L.reduce((s, a) => s + (+a.p || 0), 0));
  const exT = prev.entExtraTax, exNT = prev.entExtra - prev.entExtraTax;
  const rows = L.map(a => {
    const st = A.stip > 0 ? A.stip * a.p / 100 + (+a.fix || 0) : 0; const t = exT * a.p / 100; const nt = exNT * pctNonTassate(a, tpPct) / 100;
    return `<tr><td>${esc(a.n)}</td><td class="n">${a.p}%${a.fix ? ` ${a.fix > 0 ? "+" : ""}${eur0(a.fix)}` : ""}${pctNonTassate(a, tpPct) !== +a.p ? `<br><span class="tiny muted">${pctNonTassate(a, tpPct)}% non tassate</span>` : ""}</td><td class="n">${eur(st)}</td><td class="n">${eur(t)}</td><td class="n">${eur(nt)}</td><td class="n"><b>${eur(st + t + nt)}</b></td></tr>`;
  }).join("");
  return `<section class="card"><h2>Dove bonificare i soldi ${legBtn(`Lo stipendio fisso (lordo) si divide subito. Le altre entrate del mese si sommano e si dividono il mese dopo. Sulle entrate non tassate non si accantonano imposte: la quota del conto imposte si divide sugli altri conti come hai scelto in Altro, Smistamento.`)}</h2>
    ${sumP !== 100 ? `<div class="banner warn">Le percentuali sommano ${sumP}% invece di 100%. Correggile${pers ? " con \"Modifica le percentuali di questo mese\"" : " in Altro, Smistamento"}.</div>` : ""}
    <div class="row between small">${pers ? `<span class="badge warn">percentuali personalizzate per questo mese</span>` : `<span class="muted">Percentuali standard dello smistamento</span>`}<button class="ghost" data-act="smistmese" data-y="${y}" data-mo="${mo}">Modifica le percentuali di questo mese</button></div>
    <div class="tblwrap"><table><thead><tr><th>Conto</th><th class="n">Regola</th><th class="n">Stipendio fisso<br>${eur(A.stip)}</th><th class="n">Extra tassati di ${MESI3[(mo + 10) % 12]}<br>${eur(exT)}</th><th class="n">Extra non tassati di ${MESI3[(mo + 10) % 12]}<br>${eur(exNT)}</th><th class="n">Totale</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${A.entExtra ? `<div class="banner">Entrate extra di ${MESI[mo - 1]} da dividere a ${MESI[mo % 12]}: <b class="num">${eur(A.entExtra)}</b> (tassate ${eur(A.entExtraTax)}, non tassate ${eur(A.entExtra - A.entExtraTax)})</div>` : ""}
  </section>`;
}

/* ===== Pagella di fine mese ===== */
function pagellaHTML(y, mo) {
  const A = monthAgg(y, mo); const B = budgetYear(y)[mo - 1]; if (!B || A.n === 0) return "";
  const now = new Date(); const isCur = y === now.getFullYear() && mo === now.getMonth() + 1;
  const over = [], good = [];
  for (const c of S.cats.filter(c => c.g === "nec" || c.g === "ext")) {
    const o = S.obj[c.id] || 0, v = A.cat[c.id] || 0; if (!o) continue;
    const p = v / o * 100; if (p >= 100) over.push({ c, v, o, p }); else if (p < 50 && v > 0) good.push({ c, v, o, p });
  }
  over.sort((a, b) => (b.v - b.o) - (a.v - a.o));
  const prevM = []; for (let m = 1; m < mo; m++) { const X = monthAgg(y, m); if (X.n) prevM.push(X.spese); }
  const frac = isCur ? now.getDate() / daysIn(y, mo) : 1;
  const media = prevM.length ? prevM.reduce((a, b) => a + b, 0) / prevM.length * frac : null;
  const saldoMese = B.mese - B.spese;
  let voto, col;
  if (saldoMese >= 0 && over.length === 0) { voto = "Ottimo"; col = "var(--s-ok)"; }
  else if (saldoMese >= 0) { voto = "Buono, con qualche sforamento"; col = "var(--s-bene)"; }
  else if (saldoMese > -0.1 * Math.max(B.mese, 1)) { voto = "Da migliorare"; col = "var(--s-att)"; }
  else { voto = "Fuori budget"; col = "var(--s-lim)"; }
  const tips = [];
  if (saldoMese < 0) tips.push(`Hai speso ${eur(-saldoMese)} più dei soldi del mese: verranno scalati dal budget dei mesi successivi.`);
  if (B.rip < 0) tips.push(`Ti porti dietro un debito di ${eur(-B.rip)} dai mesi precedenti: per recuperarlo in 3 mesi dovresti spendere circa ${eur0(-B.rip / 3)} in meno al mese.`);
  if (over[0]) { const x = over[0]; tips.push(`La voce da sistemare per prima è ${x.c.n}: ${eur(x.v)} su ${eur0(x.o)}. Per rientrare servono circa ${eur0(x.v - x.o)} in meno, cioè ${eur0((x.v - x.o) / 4.3)} a settimana.`); }
  const ext = catsOf("ext").map(c => ({ c, v: A.cat[c.id] || 0 })).sort((a, b) => b.v - a.v)[0];
  if (ext && ext.v > 0 && A.spese > 0) tips.push(`Tra le spese extra pesa di più ${ext.c.n} (${eur(ext.v)}, ${Math.round(ext.v / A.spese * 100)}% delle spese del mese). Un tetto settimanale di ${eur0((S.obj[ext.c.id] || ext.v) / 4.3)} ti aiuta a tenerla sotto controllo.`);
  if (media != null && A.spese > media * 1.15) tips.push(`Hai speso il ${Math.round((A.spese / media - 1) * 100)}% in più della tua media dei mesi precedenti${isCur ? " alla stessa data" : ""} (${eur(media)}).`);
  if (media != null && A.spese < media * 0.85) tips.push(`Hai speso il ${Math.round((1 - A.spese / media) * 100)}% in meno della tua media${isCur ? " alla stessa data" : ""} (${eur(media)}): buon lavoro.`);
  if (A.ncCount) tips.push(`${A.ncCount} movimenti senza categoria: classificali per avere analisi corrette.`);
  if (A.straord) tips.push(`Spese straordinarie del mese: ${eur(A.straord)}, escluse dal budget. Verifica di averle coperte con i risparmi.`);
  return `<section class="card">
    <div class="row between"><h2>Pagella di ${MESI[mo - 1]}</h2>${isCur ? `<span class="badge">provvisoria</span>` : ""}</div>
    <div class="voto" style="color:${col}">${voto}</div>
    ${good.length ? `<div><b class="small">Bene</b><ul class="clean small">${good.slice(0, 4).map(g => `<li>${g.c.e} ${esc(g.c.n)}: ${eur(g.v)} su ${eur0(g.o)}</li>`).join("")}</ul></div>` : ""}
    ${over.length ? `<div><b class="small">Sforamenti</b><ul class="clean small">${over.map(g => `<li>${g.c.e} ${esc(g.c.n)}: ${eur(g.v)} su ${eur0(g.o)} (+${eur(g.v - g.o)})</li>`).join("")}</ul></div>` : ""}
    ${tips.length ? `<div><b class="small">Consigli</b><ul class="clean small">${tips.slice(0, 4).map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
  </section>`;
}

/* ===== Vista: Anno ===== */
function viewAnno() {
  const y = UI.y, inclS = UI.inclS, lordo = LORDO(), tp = taxP(); const Y = yearAgg(y); const B = budgetYear(y);
  const now = new Date(); const curY = y === now.getFullYear();
  const passed = curY ? (now.getMonth() + now.getDate() / daysIn(y, now.getMonth() + 1)) / 12 * 100 : null;
  const rows = S.cats.filter(c => c.g === "nec" || c.g === "ext").map(c => ({ c, v: catAmt(Y, c.id, inclS), o: (S.obj[c.id] || 0) * 12 })).filter(r => r.v > 0 || r.o > 0);
  rows.sort((a, b) => (b.o ? b.v / b.o : 9) - (a.o ? a.v / a.o : 9));
  const objH = rows.map(r => objRow(r.c, r.v, r.o, passed, y, "")).join("");
  const totO = S.cats.filter(c => c.g === "nec" || c.g === "ext").reduce((s, c) => s + (S.obj[c.id] || 0), 0) * 12;
  const totV = Y.spese + (inclS ? Y.straord : 0); const pT = totO ? totV / totO * 100 : 0;
  const proie = curY && passed > 0 ? totV / (passed / 100) : null;
  const entShow = lordo ? Y.ent : Y.ent - Y.taxAcc;
  const ris = resultOf(Y);
  const fondo = taxFund(y);
  return `
  <section class="card"><div class="row between"><button data-act="yprev" aria-label="Anno precedente">‹</button><h2>${y}</h2><button data-act="ynext" aria-label="Anno successivo">›</button></div></section>
  <div class="seg" role="group" aria-label="Entrate lorde o nette">
    <button type="button" data-act="annolordo" data-v="SI" class="${lordo ? "on" : ""}">Entrate lorde</button>
    <button type="button" data-act="annolordo" data-v="NO" class="${!lordo ? "on" : ""}">Entrate nette</button>
  </div>
  <div class="tiles">
    <div class="tile"><span>${lordo ? "Entrate lorde" : "Entrate nette"}</span><b class="pos">${eur0(entShow)}</b>${Y.ent - Y.entTax > 0.004 ? `<span class="det">Tassate ${eur0(lordo ? Y.entTax : Y.entTax - Y.taxAcc)}</span><span class="det">Non tassate ${eur0(Y.ent - Y.entTax)}</span>` : ""}</div>
    <div class="tile"><span>Spese necessarie + extra</span><b>${eur0(Y.spese)}</b>
      <span class="det">Necessarie ${eur0(Y.nec)}</span><span class="det">Extra ${eur0(Y.ext)}</span>${Y.nc ? `<span class="det">Senza categoria ${eur0(Y.nc)}</span>` : ""}</div>
    <div class="tile"><span>Straordinarie</span><b>${eur0(Y.straord)}</b></div>
    <div class="tile"><span>Investimenti (liquidità messa da parte)</span><b>${eur0(Y.inv)}</b></div>
    ${lordo ? `<div class="tile"><span>Imposte accantonate (sulle entrate tassate)</span><b>${eur0(Y.taxAcc)}</b></div>
    <div class="tile"><span>Imposte già pagate nell'anno</span><b>${eur0(Y.tax)}</b><span class="det">Pagate con i soldi accantonati: non si tolgono di nuovo dal risultato</span></div>` : ""}
    <div class="tile"><span>Profitto o perdita dell'anno</span><b class="${sgn(ris)}">${eur0(ris)}</b>
      <label class="chk det" for="pS"><input type="checkbox" id="pS" data-act="tS" ${UI.tS ? "checked" : ""}>Togli le straordinarie</label>
      <label class="chk det" for="pI"><input type="checkbox" id="pI" data-act="tI" ${UI.tI ? "checked" : ""}>Togli gli investimenti</label>
      <span class="det">${lordo ? "Entrate lorde − imposte accantonate" : "Entrate nette"} − spese${UI.tS ? " − straordinarie" : ""}${UI.tI ? " − investimenti" : ""}</span></div>
  </div>
  <label class="chk card" style="flex-direction:row" for="inclS"><input type="checkbox" id="inclS" data-act="inclS" ${inclS ? "checked" : ""}>Includi le spese straordinarie in obiettivi e grafici</label>
  <section class="card"><h2>Entrate e spese mese per mese ${legBtn(`Entrate nette = lorde meno il ${Math.round(tp * 100)}% accantonato per imposte sulle sole entrate tassate (stipendio fisso ed extra lavoro tassato). Quota spese prevista = soldi destinati alle spese di ogni mese, senza i mesi precedenti: se le barre gialle e rosse la superano, quel mese hai sforato.`)}</h2>
    <div class="row" style="gap:6px 16px">
      <label class="chk" for="lineL"><input type="checkbox" id="lineL" data-act="lineL" ${UI.lineL ? "checked" : ""}>Entrate lorde</label>
      <label class="chk" for="lineN"><input type="checkbox" id="lineN" data-act="lineN" ${UI.lineN ? "checked" : ""}>Entrate nette</label>
      <label class="chk" for="lineQ"><input type="checkbox" id="lineQ" data-act="lineQ" ${UI.lineQ ? "checked" : ""}>Quota spese prevista</label>
      <label class="chk" for="showInv"><input type="checkbox" id="showInv" data-act="showInv" ${UI.showInv ? "checked" : ""}>Investimenti</label>
    </div>
    <div class="chart tall"><canvas id="chYear" aria-label="Entrate e spese per mese"></canvas></div>
    </section>
  <section class="card"><h2>Dove sono finiti i soldi e obiettivi ${legBtn(`Barra = quanto hai speso nell'anno e quota sul totale delle spese. A destra = quanto hai usato dell'obiettivo annuo (mensile per 12), con i colori verde, giallo, arancione, rosso e nero${passed != null ? "; la linea indica la parte di anno già trascorsa" : ""}. Tocca una categoria per vedere le spese.`)}</h2>
    <div class="objrow" style="cursor:default">
      <div class="hd"><b>Totale spese necessarie + extra</b>${totO ? pillHTML(pT) : ""}</div>
      ${totO ? barHTML(pT, passed) : ""}
      <div class="nums"><span>Spesi <b>${eur0(totV)}</b></span><span>Obiettivo annuo <b>${eur0(totO)}</b></span></div>
      ${proie ? `<div class="small muted">Di questo passo a fine anno arrivi a circa <b>${eur0(proie)}</b>, ${proie <= totO ? "dentro l'obiettivo di " + eur0(totO - proie) : "oltre l'obiettivo di " + eur0(proie - totO)}.</div>` : ""}
    </div>
    <div class="stack" style="gap:0">${mergedRows(Y, y, inclS, passed, totV)}</div>
    </section>
  <section class="card"><h2>Budget mese per mese ${legBtn(`La barra confronta le spese necessarie, extra e senza categoria dell'anno con la somma delle quote di stipendio ed entrate extra destinate alle spese di ogni mese (senza riporto iniziale). La linea indica dove dovresti essere oggi. Colori: verde sotto il ritmo, giallo in linea, arancione al limite, rosso sopra, nero oltre il 120% del ritmo.`)}</h2>
    ${yearQuotaHTML(y, false)}
    <div class="tblwrap"><table><thead><tr><th>Mese</th><th class="n">Quota spese del mese</th><th class="n">Bilancio mesi precedenti</th><th class="n">Bilancio compreso mese corrente</th><th class="n">Spese del mese</th><th class="n">Bilancio fine mese</th><th class="n">Avanzo del mese</th><th class="n">${esc(nomeAvanzi())} prevista</th></tr></thead><tbody>
    ${B.map((b, i) => b ? `<tr><td>${MESI[i]}</td><td class="n">${eur(b.mese)}</td><td class="n ${sgn(b.rip)}">${eur(b.rip)}</td><td class="n ${sgn(b.disp)}">${eur(b.disp)}</td><td class="n">${eur(b.spese)}</td><td class="n ${sgn(b.saldo)}">${eur(b.saldo)}</td><td class="n ${sgn(b.avanzo)}">${eur(b.avanzo)}</td><td class="n ${sgn(b.prep)}">${eur(b.prep)}</td></tr>` : "").join("")}
  </tbody></table></div></section>
  ${lordo ? `<section class="card"><div class="row between"><h2>Imposte e contributi</h2><button class="ghost" data-act="sub2" data-v="tax">Dettaglio</button></div>
    <div class="kv"><span>Già accantonato a inizio anno</span><b>${eur0(taxIni(y))}</b><span>Accantonato nell'anno</span><b>${eur0(fondo.acc)}</b><span>Versato nell'anno</span><b>${eur0(fondo.vers)}</b><span>Fondo imposte oggi</span><b>${eur0(fondo.saldo)}</b></div></section>` : ""}
  <section class="card"><h2>Tabella generale</h2>${genTable(Y.months.concat([Y, Y]), { y, div: Array(12).fill(0).concat([0, Y.nMesi]) })}</section>`;
}

/* Grafico a barre delle spese per categoria, con a destra il consumo dell'obiettivo annuo */
function mergedRows(Y, y, inclS, passed, totV, mo) {
  const mult = mo ? 1 : 12;
  const rows = S.cats.filter(c => c.g === "nec" || c.g === "ext").map(c => ({ c, v: catAmt(Y, c.id, inclS), o: (S.obj[c.id] || 0) * mult })).filter(r => r.v > 0);
  const nc = catAmt(Y, "__nc", inclS); if (nc) rows.push({ c: { id: "__nc", e: "❓", n: "Senza categoria", col: "#adb5bd" }, v: nc, o: 0 });
  rows.sort((a, b) => b.v - a.v);
  const tot = totV || 1; const max = Math.max(1, ...rows.map(r => r.v));
  const head = `<div class="crow head"><span>Categoria</span><span>Speso ${mo ? "nel mese" : "nell'anno"} e quota sul totale</span><span style="text-align:right">Obiettivo usato</span></div>`;
  return head + rows.map(r => {
    const w = r.v / max * 100; const lab = (mo ? eur(r.v) : eur0(r.v)) + " · " + Math.round(r.v / tot * 100) + "%"; const inside = w > 58;
    const p = r.o > 0 ? r.v / r.o * 100 : null; const st = p != null ? stato(p) : null;
    return `<div class="crow" data-act="catdet" data-c="${r.c.id}" data-y="${y}" data-mo="${mo || ""}" role="button" tabindex="0" title="${esc(r.c.n)}">
      <span class="cn"><span class="emo">${r.c.e}</span> ${esc(r.c.n)}</span>
      <span class="cb"><i style="width:${w.toFixed(1)}%;background:${r.c.col}"></i><span style="${inside ? `right:${(100 - w + 1.5).toFixed(1)}%;color:#fff` : `left:calc(${w.toFixed(1)}% + 6px);color:var(--ink)`}">${lab}</span></span>
      <span class="co">${p != null ? `<b style="color:${st.c}">${Math.round(p)}%</b>${barCol(p, st.c, passed)}` : `<b class="muted" style="font-weight:400">nessuno</b>`}</span>
    </div>`;
  }).join("");
}

function yearQuotaHTML(y, compact) {
  const Q = yearQuota(y); if (!Q) return "";
  if (compact) return `<div class="totline"><div class="row between"><b class="small">Da inizio anno</b>${pillSt(Q.st, Math.round(Q.p) + "%")}</div>${barCol(Q.p, Q.st.c, Q.tick, 10)}<div class="nums small"><span>Spese <b>${eur0(Q.sp)}</b></span><span>Quote spese <b>${eur0(Q.q)}</b></span><span class="${sgn(Q.q - Q.sp)}"><b>${Q.q - Q.sp >= 0 ? "+" : ""}${eur0(Q.q - Q.sp)}</b></span></div></div>`;
  return `<div class="objrow" style="cursor:default"><div class="hd"><b>Quote spese dell'anno e spese effettive</b>${pillSt(Q.st, Math.round(Q.p) + "%")}</div>${barCol(Q.p, Q.st.c, Q.tick, 14)}<div class="nums"><span>Spese effettive <b>${eur0(Q.sp)}</b></span><span>Somma quote spese <b>${eur0(Q.q)}</b></span></div><div class="kv small"><span>${Q.sp <= Q.q ? "Hai speso meno delle quote di" : "Hai speso più delle quote di"}</span><b class="${sgn(Q.q - Q.sp)}">${eur0(Math.abs(Q.q - Q.sp))}</b></div></div>`;
}

/* ===== Dettaglio di una categoria nel periodo ===== */
function openCatDetail(c, y, mo, onlyS) {
  const pre = mo ? y + "-" + pad(+mo) : String(y);
  const L = [];
  for (const m of S.movs) {
    if (!m.d.startsWith(pre) || m.c === "noconta") continue;
    if (c === "__str") { if (m.s) for (const [cc, a] of contrib(m)) if (["nec", "ext", "nc"].includes(grpOf(cc))) L.push({ m, a }); continue; }
    for (const [cc, a] of contrib(m)) { if (cc !== c) continue; const sp = ["nec", "ext", "nc"].includes(grpOf(cc)); if (onlyS ? (m.s && sp) : (UI.inclS || !m.s || !sp)) L.push({ m, a }); }
  }
  const tot = L.reduce((s, x) => s + x.a, 0);
  const title = c === "__str" ? "Spese straordinarie" : catLab(c) + (onlyS ? " (straordinarie)" : "");
  const per = mo ? MESI[+mo - 1] + " " + y : "Anno " + y;
  const o = (S.obj[c] || 0) * (mo ? 1 : 12);
  const byDesc = {}; L.forEach(x => { const k = norm(x.m.t) || "-"; (byDesc[k] = byDesc[k] || { t: x.m.t, a: 0, n: 0 }); byDesc[k].a += x.a; byDesc[k].n++; });
  const topD = Object.values(byDesc).sort((a, b) => b.a - a.a).slice(0, 5);
  modal(`<div class="row between"><h2>${esc(title)}</h2><button class="ghost" data-x="1">Chiudi</button></div>
    <div class="small muted">${per}${!UI.inclS && c !== "__str" && !onlyS ? ", senza straordinarie" : ""}</div>
    <div class="tiles"><div class="tile"><span>Totale</span><b>${eur(tot)}</b></div><div class="tile"><span>Movimenti</span><b>${L.length}</b></div><div class="tile"><span>Media per spesa</span><b>${eur(L.length ? tot / L.length : 0)}</b></div>${o ? `<div class="tile"><span>Obiettivo</span><b>${eur0(o)}</b></div>` : ""}</div>
    ${o ? barHTML(tot / o * 100) : ""}
    ${topD.length > 1 ? `<div class="card"><b class="small">Le voci che pesano di più</b><div class="kv small">${topD.map(d => `<span>${esc(d.t)} (${d.n})</span><b>${eur(d.a)}</b>`).join("")}</div></div>` : ""}
    <div class="card"><div class="list">${L.slice().reverse().map(x => itemHTML(x.m).replace(`>-${eur(x.m.a)}<`, `>-${eur(x.a)}<`)).join("") || `<div class="muted small">Nessuna spesa.</div>`}</div></div>`,
    sh => sh.addEventListener("click", e => { const it = e.target.closest(".item[data-act=edit]"); if (it) { closeModal(); openEdit(it.dataset.id); } }));
}

/* ===== Vista: Altro ===== */
function viewAltro() {
  const s = UI.altro;
  if (!s) return annoHTML() + `<div class="menu">
    ${[["obj", "Obiettivi di spesa", "Tetto mensile per categoria"], ["smist", "Smistamento", "Percentuali sui conti"], ["ric", "Spese ricorrenti", "Abbonamenti, assicurazioni"], ["tax", "Imposte e contributi", "Accantonamenti e versamenti"], ["pat", "Patrimonio", "Inizio e fine anno, indici"], ["cred", "Crediti e debiti", "Chi ti deve e chi devi"], ["carb", "Carburante", "Prezzo al litro, km al litro"], ["cat", "Categorie", "Aggiungi, rinomina, colori"], ["dati", "Impostazioni e dati", "Lordo o netto, collegamento"]].map(x => `<button data-act="sub" data-v="${x[0]}"><b>${x[1]}</b><span>${x[2]}</span></button>`).join("")}
  </div><div class="tiny muted" style="text-align:center">Versione dell&#39;app: ${VERSIONE_APP}</div>`;
  const back = `<button class="ghost" data-act="sub" data-v="" style="align-self:flex-start">‹ Altro</button>`;
  return back + ({ obj: subObj, smist: subSmist, ric: subRic, tax: subTax, pat: subPat, cred: subCred, carb: subCarb, cat: subCat, dati: subDati }[s])();
}
/* Mesi chiusi usati per la media: quelli dell'anno in corso; a gennaio quelli dell'anno prima */
function avgMonths() {
  const now = new Date(); let y = now.getFullYear(), last = now.getMonth();
  if (last === 0) { y--; last = 12; }
  const out = []; for (let m = 1; m <= last; m++) { const A = monthAgg(y, m); if (A.n) out.push(A); }
  return { y, months: out };
}
function avgCat(id) { const M = avgMonths().months; return M.length ? M.reduce((s, A) => s + (A.cat[id] || 0), 0) / M.length : 0; }
/* Obiettivo proposto: media mensile più 10%, arrotondata alla decina superiore */
function propObj(id) { const a = avgCat(id); return a > 0 ? Math.ceil(a * 1.1 / 10) * 10 : 0; }
function subObj() {
  const am = avgMonths();
  let h = `<section class="card"><h2>Obiettivi di spesa mensili</h2><div class="small muted">Il tetto massimo che vuoi rispettare ogni mese. Nell'anno vale per 12. La media è calcolata sui mesi chiusi del ${am.y} (${am.months.length}).</div>
    <button data-act="objprop" style="align-self:flex-start">Proponi dalla media</button>`;
  for (const g of ["nec", "ext"]) {
    h += `<h3>${esc(gname(g))}</h3><div class="tblwrap"><table><thead><tr><th>Categoria</th><th class="n">Media mensile</th><th class="n">Obiettivo</th></tr></thead><tbody>`;
    h += catsOf(g).map(c => `<tr><td>${c.e} ${esc(c.n)}</td><td class="n muted">${eur0(avgCat(c.id))}</td><td class="n"><input style="width:96px;text-align:right" inputmode="decimal" data-obj="${c.id}" value="${S.obj[c.id] || ""}" aria-label="Obiettivo ${esc(c.n)}"></td></tr>`).join("");
    const tot = catsOf(g).reduce((s, c) => s + (S.obj[c.id] || 0), 0);
    h += `<tr class="tot"><td>Totale</td><td></td><td class="n">${eur0(tot)}</td></tr></tbody></table></div>`;
  }
  const all = S.cats.filter(c => c.g === "nec" || c.g === "ext").reduce((s, c) => s + (S.obj[c.id] || 0), 0);
  const spA = spendAcc(); const Y = yearAgg(new Date().getFullYear()); const stipMed = (Y.cat.stip || 0) / Y.nMesi;
  h += `<div class="banner">Somma degli obiettivi: <b class="num">${eur0(all)}</b> al mese (${eur0(all * 12)} all'anno). Con lo stipendio fisso medio (${eur0(stipMed)}) il conto spese riceve circa <b class="num">${eur0(stipMed * spA.p / 100)}</b> al mese.</div></section>`;
  return h;
}
/* Mese da cui valgono le percentuali standard cambiate oggi: il mese dopo (o gennaio dell'anno scelto, se è più avanti) */
function meseEffetto() { const n = new Date(); let y = n.getFullYear(), mo = n.getMonth() + 2; if (mo > 12) { mo = 1; y++; } const e = ymOf(y, mo), j = UI.y + "-01"; return j > e ? j : e; }
function nomeYm(ym) { const [y, m] = ym.split("-"); return MESI[+m - 1] + " " + y; }
function nomeAvanzi() { return S.imp.nome_conto_avanzi || "Prepagata"; }
function descSmist(m) { return S.acc.map(a => esc(a.n) + " " + String((m[a.id] || { p: 0 }).p).replace(".", ",") + "%" + ((m[a.id] || {}).fix ? " " + ((m[a.id].fix > 0 ? "+" : "") + eur0(m[a.id].fix)) : "")).join(" · "); }
/* Cambia una percentuale standard da meseEffetto() in poi, senza toccare i mesi già passati */
function cambiaStandard(id, k, v) {
  const eff = meseEffetto();
  if (!versioniSmist().length) S.imp["smist_dal_" + firstYear() + "-01"] = serSmist(smistConti()); // fotografia di com'era finora
  const m = smistStd(eff); S.acc.forEach(a => { if (!m[a.id]) m[a.id] = { p: 0, fix: 0 }; });
  m[id][k] = v; S.imp["smist_dal_" + eff] = serSmist(m);
  if (versioniSmist().pop() === eff) { const a = S.acc.find(x => x.id === id); if (a) a[k] = v; } // la scheda Conti tiene le più recenti
  toast("Nuove percentuali da " + nomeYm(eff) + ": i mesi prima restano come erano");
}
function subSmist() {
  const eff = meseEffetto(); const std = smistStd(eff); const passato = UI.y < new Date().getFullYear();
  const pv = a => std[a.id] || { p: 0, fix: 0 };
  const sum = r2(S.acc.reduce((s, a) => s + (+pv(a).p || 0), 0));
  const vers = versioniSmist(); const pers = Object.keys(S.imp).filter(k => /^smist_mese_\d{4}-\d{2}$/.test(k) && S.imp[k]).map(k => k.slice(11)).sort();
  const dis = passato ? "disabled" : "";
  return `<section class="card"><h2>Smistamento ${UI.y}: percentuali standard</h2>
    <div class="small muted">Percentuale di ogni entrata da bonificare su ciascun conto, ogni mese. La correzione fissa vale solo sullo stipendio. Il conto spese decide quanto puoi spendere, il conto imposte quanto accantoni.</div>
    <div class="banner ${passato ? "warn" : ""} small">${passato ? `Il ${UI.y} è passato: le percentuali standard non si cambiano più. Per correggere un mese usa la schermata Mese, riquadro "Dove bonificare i soldi".` : `Se cambi le percentuali valgono da <b>${nomeYm(eff)}</b>: i mesi precedenti restano come erano. Per cambiare un solo mese usa la schermata Mese, riquadro "Dove bonificare i soldi".`}</div>
    <div class="tblwrap"><table><thead><tr><th>Conto</th><th class="n">%</th><th class="n">Correzione €</th><th>Spese</th><th>Imposte</th><th></th></tr></thead><tbody>
    ${S.acc.map(a => `<tr><td><input value="${esc(a.n)}" data-acc="${a.id}" data-k="n" aria-label="Nome conto" style="min-width:150px"></td><td class="n"><input style="width:70px;text-align:right" inputmode="decimal" value="${pv(a).p}" data-acc="${a.id}" data-k="p" aria-label="Percentuale" ${dis}></td><td class="n"><input style="width:84px;text-align:right" inputmode="decimal" value="${pv(a).fix || 0}" data-acc="${a.id}" data-k="fix" aria-label="Correzione fissa" ${dis}></td><td><input type="radio" name="spacc" data-acc="${a.id}" data-k="spesa" ${a.spesa ? "checked" : ""} aria-label="Conto per le spese"></td><td><input type="radio" name="taxacc" data-acc="${a.id}" data-k="tasse" ${a.tasse ? "checked" : ""} aria-label="Conto per le imposte"></td><td><button class="ghost danger" data-act="accdel" data-id="${a.id}" aria-label="Elimina conto">Elimina</button></td></tr>`).join("")}
    </tbody></table></div>
    <div class="row between"><b class="${sum === 100 ? "pos" : "neg"}">Totale ${String(sum).replace(".", ",")}%</b><button data-act="accadd">+ Aggiungi conto</button></div>
    <label for="ripIni">Bilancio di partenza di gennaio ${UI.y} (ogni anno riparte da qui; di solito 0)<input id="ripIni" inputmode="decimal" value="${ripAnno(UI.y)}" data-k="ripIni"></label>
    <label for="nomeAv">Dove sposti a fine mese quello che avanza sul conto spese<input id="nomeAv" value="${esc(nomeAvanzi())}" data-k="nomeAv" placeholder="es. Prepagata"></label>
    <label for="prepIni">Saldo di ${esc(nomeAvanzi())} a inizio ${UI.y} (non cambia il budget: serve a calcolare il saldo previsto)<input id="prepIni" inputmode="decimal" value="${prepIni(UI.y)}" data-k="prepIni"></label>
  </section>
  ${vers.length || pers.length ? `<section class="card"><h2>Storico delle percentuali</h2>
    ${vers.length ? `<div class="list">${vers.map(v => `<div class="item" style="cursor:default"><div class="t">Da ${nomeYm(v)}</div><div class="m">${descSmist(parseSmist(S.imp["smist_dal_" + v]))}</div></div>`).join("")}</div>` : ""}
    ${pers.length ? `<b class="small">Mesi personalizzati</b><div class="list">${pers.map(v => `<div class="item" data-act="smistmese" data-y="${v.slice(0, 4)}" data-mo="${+v.slice(5)}" role="button" tabindex="0"><div class="t">${nomeYm(v)}</div><div class="m">${descSmist(parseSmist(S.imp["smist_mese_" + v]))}</div></div>`).join("")}</div>` : ""}
  </section>` : ""}
  <section class="card"><h2>Entrate non tassate</h2>
    <div class="small muted">Sulle entrate non tassate (es. extra lavoro non tassato, mance, royalties, altre entrate) non si accantonano imposte. Il ${taxAcc() ? taxAcc().p : 0}% che andrebbe sul conto imposte lo dividi qui sugli altri conti, come vuoi. Quali entrate sono tassate lo scegli in Altro, Categorie.</div>
    ${(() => { const tp = taxAcc() ? +taxAcc().p || 0 : 0; const r = ripNonTassate(); const tot = Object.values(r).reduce((s, x) => s + x, 0);
      return `<div class="tblwrap"><table><thead><tr><th>Conto</th><th class="n">Normale</th><th class="n">+ quota imposte</th><th class="n">Su 100€ non tassati</th></tr></thead><tbody>${S.acc.map(a => a.tasse
        ? `<tr><td>${esc(a.n)}</td><td class="n">${a.p}%</td><td class="n muted">-</td><td class="n">${eur(0)}</td></tr>`
        : `<tr><td>${esc(a.n)}</td><td class="n">${a.p}%</td><td class="n"><input style="width:70px;text-align:right" inputmode="decimal" value="${r[a.id] || ""}" placeholder="0" data-ntr="${a.id}" aria-label="Quota imposte su ${esc(a.n)}">%</td><td class="n">${eur(pctNonTassate(a))}</td></tr>`).join("")}</tbody></table></div>
      <div class="row between"><b class="${Math.abs(tot - tp) < 0.001 ? "pos" : "neg"}">Quota imposte ripartita: ${String(r2(tot)).replace(".", ",")}% su ${tp}%</b></div>
      ${Math.abs(tot - tp) < 0.001 ? "" : `<div class="banner warn">La quota ripartita deve essere ${tp}%: ${tot < tp ? "mancano " + String(r2(tp - tot)).replace(".", ",") + " punti, che restano non assegnati" : "hai assegnato " + String(r2(tot - tp)).replace(".", ",") + " punti in più"}.</div>`}`; })()}
  </section>`;
}

/* ===== Avanzo del conto spese a fine mese ===== */
function avanzoHTML(y, mo, B) {
  const now = new Date(); const inCorso = y === now.getFullYear() && mo === now.getMonth() + 1; const nome = esc(nomeAvanzi());
  return `<section class="card"><h2>Fine mese: avanzo del conto spese ${legBtn(`Ogni fine mese quello che resta sul conto spese (quota del mese meno spese del mese) va spostato su ${nome}, così il conto spese riparte da zero. Restano comunque soldi per le spese: il bilancio passa al mese dopo. Se hai speso più della quota, la differenza la prendi da ${nome}. Il saldo previsto parte da quello di inizio anno (Altro, Smistamento) e somma gli avanzi di ogni mese, togliendo gli sforamenti: confrontalo con il saldo vero della carta.`)}</h2>
    <div class="kv">
      <span>${inCorso ? "Rimasto finora" : "Rimasto"} sul conto spese (quota − spese del mese)</span><b class="${sgn(B.avanzo)}">${eur(B.avanzo)}</b>
      <span><b>${B.avanzo >= 0 ? "Da spostare su " + nome : "Da prendere da " + nome + " per coprire"}</b></span><b>${eur(Math.abs(B.avanzo))}</b>
      <span>Saldo previsto su ${nome} ${inCorso ? "oggi" : "a fine mese"} (dopo lo spostamento)</span><b class="${sgn(B.prep)}">${eur(B.prep)}</b>
    </div>
    ${inCorso ? `<div class="small muted">Mese in corso: il numero definitivo lo vedi a fine mese.</div>` : ""}
  </section>`;
}

/* ===== Percentuali di un solo mese ===== */
function openSmistMese(y, mo) {
  const L = contiDelMese(y, mo); const ym = ymOf(y, mo); const pers = smistPersonalizzato(y, mo);
  modal(`<div class="row between"><h2>Percentuali di ${MESI[mo - 1]} ${y}</h2><button class="ghost" data-x="1">Chiudi</button></div>
    <div class="small muted">Valgono solo per questo mese: le percentuali standard e gli altri mesi non cambiano.${pers ? " Ora sono personalizzate." : " Ora sono quelle standard."}</div>
    <div class="tblwrap"><table><thead><tr><th>Conto</th><th class="n">%</th><th class="n">Correzione €</th></tr></thead><tbody>
    ${L.map(a => `<tr><td>${esc(a.n)}${a.spesa ? ' <span class="badge">spese</span>' : ""}${a.tasse ? ' <span class="badge">imposte</span>' : ""}</td><td class="n"><input style="width:70px;text-align:right" inputmode="decimal" id="smp_${a.id}" value="${a.p}"></td><td class="n"><input style="width:84px;text-align:right" inputmode="decimal" id="smf_${a.id}" value="${a.fix || 0}"></td></tr>`).join("")}
    </tbody></table></div>
    <div id="smTot" class="small"></div>
    <button class="pri wide" id="smSave">Salva per ${MESI[mo - 1]}</button>
    ${pers ? `<button class="wide" id="smReset">Torna alle percentuali standard</button>` : ""}`, sh => {
    const leggi = () => { const m = {}; L.forEach(a => { const p = parseNum(sh.querySelector("#smp_" + a.id).value), f = parseNum(sh.querySelector("#smf_" + a.id).value); m[a.id] = { p: isNaN(p) ? 0 : p, fix: isNaN(f) ? 0 : f }; }); return m; };
    const tot = () => { const s = r2(Object.values(leggi()).reduce((x, v) => x + v.p, 0)); const el = sh.querySelector("#smTot"); el.textContent = "Totale " + String(s).replace(".", ",") + "%" + (s === 100 ? "" : " (dovrebbe essere 100%)"); el.className = "small " + (s === 100 ? "pos" : "neg"); };
    sh.addEventListener("input", tot); tot();
    sh.querySelector("#smSave").addEventListener("click", () => { S.imp["smist_mese_" + ym] = serSmist(leggi()); persist(); closeModal(); render(); toast("Percentuali di " + MESI[mo - 1] + " salvate"); });
    const r = sh.querySelector("#smReset"); if (r) r.addEventListener("click", () => { S.imp["smist_mese_" + ym] = ""; persist(); closeModal(); render(); toast(MESI[mo - 1] + ": tornano le percentuali standard"); });
  });
}

/* ===== Anno da analizzare e anno nuovo ===== */
function anniDisponibili() {
  const s = new Set(years()); s.add(annoPredefinito());
  Object.keys(S.imp).forEach(k => { const m = /^(?:obiettivi|riporto_iniziale|imposte_accantonate_inizio|obiettivo_patrimonio)_(\d{4})$/.exec(k) || /^smist_dal_(\d{4})-01$/.exec(k); if (m && S.imp[k] !== "") s.add(+m[1]); });
  S.patRows.forEach(v => s.add(+v.anno));
  return [...s].sort();
}
function annoHTML() {
  const ap = annoPredefinito(); const anni = anniDisponibili(); const nuovo = Math.max(...anni) + 1;
  return `<section class="card"><h2>Anno da analizzare</h2>
    <div class="row" style="flex-wrap:nowrap"><select id="annoPred" data-k="annoPred" aria-label="Anno da analizzare" style="flex:1;font-family:var(--font-display);font-size:20px;font-weight:700">${anni.map(x => `<option ${x === ap ? "selected" : ""}>${x}</option>`).join("")}</select>
    <button class="pri" data-act="creaanno" style="flex:none">+ Crea il ${nuovo}</button></div>
    <div class="small muted">L'anno scelto si apre in Movimenti, Mese, Anno, Smistamento, Obiettivi, Imposte e Patrimonio. Ogni anno ha le sue percentuali di smistamento e i suoi obiettivi, e riparte da zero.</div></section>`;
}
function copiaPatrimonio(y) {
  const prev = patFor(y - 1); if (patFor(y).voci.length || !prev.voci.length) return;
  prev.voci.forEach(v => S.patRows.push({ anno: y, id: uid(), n: v.n, t: v.t, ini: (v.fin != null && v.fin !== "") ? v.fin : v.ini, fin: null }));
  if (prev.obiettivo && impNum("obiettivo_patrimonio_" + y) == null) S.imp["obiettivo_patrimonio_" + y] = String(prev.obiettivo);
}
function creaAnno() {
  const n = Math.max(...anniDisponibili()) + 1; const p = n - 1;
  confirmBox(`Creo il ${n}? Copio dal ${p} le percentuali di smistamento e gli obiettivi di spesa (poi li puoi cambiare), creo le voci del patrimonio partendo dai valori di fine ${p}, metto a 0 il bilancio di partenza e le imposte già accantonate, e il saldo previsto di ${esc(nomeAvanzi())} a fine ${p} diventa quello di inizio ${n}. Il ${n} diventa l'anno da analizzare.`, "Crea il " + n, () => {
    if (!versioniSmist().length) S.imp["smist_dal_" + firstYear() + "-01"] = serSmist(smistConti());
    if (!S.imp["smist_dal_" + n + "-01"]) S.imp["smist_dal_" + n + "-01"] = serSmist(smistStd(p + "-12"));
    if (!S.imp["obiettivi_" + n]) S.imp["obiettivi_" + n] = serObj(objFor(p));
    if (S.imp["riporto_iniziale_" + n] == null) S.imp["riporto_iniziale_" + n] = "0";
    if (S.imp["imposte_accantonate_inizio_" + n] == null) S.imp["imposte_accantonate_inizio_" + n] = "0";
    if (S.imp["prepagata_inizio_" + n] == null) { const bp = budgetYear(p).filter(Boolean).pop(); S.imp["prepagata_inizio_" + n] = String(r2(bp ? bp.prep : prepIni(p))); }
    copiaPatrimonio(n);
    S.imp.anno_predefinito = String(n); UI.y = n; UI.mo = 1;
    persist(); render(); toast("Creato il " + n);
  });
}
function subRic() {
  const nextOf = r => { const t = todayISO(); let [y, m] = r.from.split("-").map(Number); let g = 0; while (g++ < 600) { const ym = y + "-" + pad(m); if (r.to && ym > r.to) return null; const d = ym + "-01"; if (d > t) return d; m += +r.freq || 1; while (m > 12) { m -= 12; y++; } } return null; };
  const tot = S.ric.reduce((s, r) => s + r.a / (+r.freq || 1), 0);
  return `<section class="card"><h2>Spese ricorrenti</h2>
    <div class="small muted">Vengono inserite da sole il primo giorno del mese, così compaiono come prime spese del mese. Puoi correggerle o eliminarle dall'elenco movimenti.</div>
    <div class="banner">Costo medio delle ricorrenti: <b class="num">${eur(tot)}</b> al mese, <b class="num">${eur(tot * 12)}</b> all'anno.</div>
    <div class="list">${S.ric.map(r => { const n = nextOf(r); return `<div class="item" data-act="ricedit" data-id="${r.id}" role="button" tabindex="0"><div class="t"><span class="emo">${catEmo(r.c)}</span> ${esc(r.t)}</div><div class="a">${eur(r.a)}</div><div class="m">${esc(catName(r.c))} · ${FREQ[r.freq]} · dal ${r.from.split("-").reverse().join("/")}${r.to ? " al " + r.to.split("-").reverse().join("/") : ""} · ${n ? "prossima " + fmtShort(n) : "terminata"}</div></div>`; }).join("") || `<div class="muted small">Nessuna spesa ricorrente.</div>`}</div>
    <button class="pri" data-act="ricedit" data-id="">+ Nuova spesa ricorrente</button></section>`;
}
function subTax() {
  const y = UI.y; const F = taxFund(y); const tp = taxP();
  return `<section class="card"><h2>Imposte e contributi ${y}</h2>
    <div class="small muted">Lo stipendio fisso è lordo: ogni mese accantoni il ${Math.round(tp * 100)}% sul conto imposte (${esc((taxAcc() || { n: "conto imposte" }).n)}), sullo stipendio fisso e sulle entrate extra tassate del mese prima (non sulle entrate non tassate: quali sono lo scegli in Altro, Categorie). I versamenti sono le spese con categoria "Imposte e contributi versati".</div>
    <label for="taxIni">Soldi già accantonati per imposte e contributi a inizio anno<input id="taxIni" inputmode="decimal" value="${impNum("imposte_accantonate_inizio_" + y) ?? ""}" placeholder="0" data-k="taxIni"></label>
    <div class="tiles"><div class="tile"><span>Accantonato nell'anno</span><b>${eur0(F.acc)}</b></div><div class="tile"><span>Versato nell'anno</span><b>${eur0(F.vers)}</b></div><div class="tile"><span>Fondo imposte oggi</span><b class="${F.saldo < 0 ? "neg" : ""}">${eur0(F.saldo)}</b></div></div>
    <div class="tblwrap"><table><thead><tr><th>Mese</th><th class="n">Accantonato</th><th class="n">Versato</th><th class="n">Fondo</th></tr></thead><tbody>
      <tr><td class="muted">Inizio anno</td><td></td><td></td><td class="n">${eur(taxIni(y))}</td></tr>
      ${F.rows.map(r => `<tr class="click" data-act="catdet" data-c="tasse" data-y="${y}" data-mo="${r.mo}"><td>${MESI[r.mo - 1]}</td><td class="n">${eur(r.acc)}</td><td class="n">${r.vers ? eur(r.vers) : ""}</td><td class="n ${r.saldo < 0 ? "neg" : ""}">${eur(r.saldo)}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="small muted">Il fondo è una stima: confrontalo ogni tanto con il saldo reale del conto imposte.</div></section>`;
}
function subPat() {
  const y = UI.y;
  const yPick = `<section class="card"><div class="row between"><button data-act="yprev" aria-label="Anno precedente">‹</button><h2>Patrimonio ${y}</h2><button data-act="ynext" aria-label="Anno successivo">›</button></div></section>`;
  if (!patFor(y).voci.length) {
    const prev = patFor(y - 1);
    return yPick + `<section class="card"><h2>Nessuna voce per il ${y}</h2>
      <div class="small muted">${prev.voci.length ? `Posso creare le voci del ${y} copiando quelle del ${y - 1}: il valore di fine ${y - 1} diventa l'inizio del ${y} (dove la fine anno non è compilata uso l'inizio anno). Anche l'obiettivo viene copiato, poi puoi cambiarlo.` : "Non ci sono voci nemmeno per l'anno prima."}</div>
      ${prev.voci.length ? `<button class="pri" data-act="patnewyear">Crea le voci del ${y}</button>` : `<button data-act="patadd0">+ Aggiungi la prima voce</button>`}</section>`;
  }
  const { P, I, F, hasFin, Y, tp, tasseStim, spCons, att, pr, n, Bauto, Aatt, C, liq, net } = patStima(y);
  const prCol = pr >= 100 ? "var(--s-ok)" : pr >= 60 ? "var(--s-bene)" : pr >= 30 ? "var(--s-att)" : "var(--s-lim)";
  const idx = [
    ["Cash flow mensile", "Entrate meno uscite correnti (spese e imposte accantonate)", eur0(Aatt + Bauto - C)],
    ["Libertà finanziaria", "Entrate automatiche (royalties) meno uscite correnti", eur0(Bauto - C)],
    ["Libertà finanziaria %", "Quanto delle uscite coprono le entrate automatiche", (C > 0 ? (Bauto / C * 100).toFixed(1) : "0") + "%"],
    ["Capacità di risparmio", "Parte delle entrate che non spendi", ((1 - C / Math.max(1, Aatt + Bauto)) * 100).toFixed(1) + "%"],
    ["Liquidità immediata", "Quanti mesi vivi con la liquidità senza lavorare", C - Bauto > 0 ? (liq / (C - Bauto)).toFixed(1) + " mesi (" + Math.round(liq / (C - Bauto) * 4.33) + " settimane)" : "-"],
    ["Liquidità generale", "Mesi coperti dall'intero patrimonio netto", C - Bauto > 0 ? (net / (C - Bauto)).toFixed(1) + " mesi" : "-"]
  ];
  let tbl = "";
  for (const lato of ["att", "pas"]) {
    tbl += `<tr class="g"><td>${lato === "att" ? "Attività" : "Passività"}</td><td class="n">Inizio anno</td><td class="n">Fine anno</td><td class="n">Variazione</td></tr>`;
    for (const tp2 of PAT_TIPI.filter(x => x.lato === lato)) {
      for (const v of P.voci.filter(v => v.t === tp2.id)) {
        const d = (v.fin != null && v.fin !== "") ? v.fin - v.ini : null;
        tbl += `<tr><td><input value="${esc(v.n)}" data-pat="${v.id}" data-k="n" aria-label="Voce" style="min-width:120px"></td><td class="n"><input style="width:86px;text-align:right" inputmode="decimal" value="${v.ini ?? ""}" data-pat="${v.id}" data-k="ini" aria-label="Inizio anno"></td><td class="n"><input style="width:86px;text-align:right" inputmode="decimal" value="${v.fin ?? ""}" data-pat="${v.id}" data-k="fin" aria-label="Fine anno"></td><td class="n ${d < 0 ? "neg" : d > 0 ? "pos" : ""}">${d == null ? "" : eur0(d)}</td></tr>`;
      }
      tbl += `<tr><td class="muted">Totale ${esc(tp2.n)}</td><td class="n">${eur0(I[tp2.id])}</td><td class="n">${hasFin ? eur0(F[tp2.id]) : ""}</td><td class="n">${hasFin ? eur0(F[tp2.id] - I[tp2.id]) : ""}</td></tr>`;
    }
  }
  tbl += `<tr class="tot"><td>Patrimonio netto</td><td class="n">${eur0(I.net)}</td><td class="n">${hasFin ? eur0(F.net) : ""}</td><td class="n">${hasFin ? eur0(F.net - I.net) : ""}</td></tr>`;
  return yPick + `<section class="card"><h2>Obiettivo patrimonio ${y}</h2>
      <div class="tiles"><div class="tile"><span>Inizio anno</span><b>${eur0(I.net)}</b></div><div class="tile"><span>${hasFin ? "Fine anno" : "Stima di oggi"}</span><b>${eur0(att)}</b></div><div class="tile"><span>Obiettivo</span><b>${eur0(P.obiettivo)}</b></div></div>
      ${barCol(pr, prCol, null, 14)}
      <div class="small">${Math.round(pr)}% del percorso tra inizio anno e obiettivo. Mancano <b class="num">${eur0(Math.max(0, P.obiettivo - att))}</b>.</div>
      ${!hasFin ? `<div class="small muted">Stima = patrimonio di inizio anno + entrate lorde (${eur0(Y.ent)}) meno spese necessarie, extra e straordinarie (${eur0(spCons)}) meno imposte accantonate al ${Math.round(tp * 100)}% sulle entrate tassate (${eur0(tasseStim)}). Investimenti e oro restano nel patrimonio. Il valore vero lo vedi quando compili la colonna di fine anno.</div>` : ""}
      <label for="patObj">Obiettivo di fine anno<input id="patObj" inputmode="decimal" value="${P.obiettivo}" data-k="patObj"></label>
    </section>
    <section class="card"><h2>Indici finanziari</h2><div class="small muted">Medie mensili di ${y} (${n} mesi), liquidità ${hasFin ? "di fine" : "di inizio"} anno.</div>
      <div class="tblwrap"><table><tbody>${idx.map(i => `<tr><td><b>${i[0]}</b><div class="tiny muted" style="white-space:normal">${i[1]}</div></td><td class="n"><b>${i[2]}</b></td></tr>`).join("")}</tbody></table></div></section>
    <section class="card"><h2>Stato patrimoniale</h2><div class="small muted">Compili tu i saldi al 1° gennaio e al 31 dicembre. Scorri la tabella a destra per la colonna di fine anno.</div>
      <div class="tblwrap"><table><tbody>${tbl}</tbody></table></div>
      <div class="row"><select id="patNewT" aria-label="Tipo di voce">${PAT_TIPI.map(t => `<option value="${t.id}">${esc(t.n)}</option>`).join("")}</select><button data-act="patadd">+ Aggiungi voce</button></div>
    </section>`;
}
function subCred() {
  const L = allCred(); const open = L.filter(c => !c.ok);
  const per = {}; open.forEach(c => { const k = c.chi + "|" + c.tipo; per[k] = (per[k] || 0) + c.a; });
  const totC = open.filter(c => c.tipo === "credito").reduce((s, c) => s + c.a, 0), totD = open.filter(c => c.tipo === "debito").reduce((s, c) => s + c.a, 0);
  const li = c => `<div class="item" style="cursor:default"><div class="t">${esc(c.chi)} <span class="tiny muted">· ${esc(c.mot)}</span></div><div class="a ${c.tipo === "credito" ? "pos" : "neg"}">${eur(c.a)}</div><div class="m">${fmtShort(c.d)} · ${c.src === "mov" ? "da spesa divisa" : "inserito a mano"} <button class="ghost" data-act="credok" data-id="${c.id}">${c.ok ? "Riapri" : "Segna come saldato"}</button>${c.src === "man" ? `<button class="ghost danger" data-act="creddel" data-id="${c.id}">Elimina</button>` : ""}</div></div>`;
  return `<div class="tiles"><div class="tile"><span>Mi devono</span><b class="pos">${eur(totC)}</b></div><div class="tile"><span>Devo io</span><b class="neg">${eur(totD)}</b></div></div>
  <section class="card"><h2>Per persona</h2>${Object.keys(per).length ? `<div class="tblwrap"><table><tbody>${Object.entries(per).map(([k, v]) => { const [chi, t] = k.split("|"); return `<tr><td>${esc(chi)}</td><td>${t === "credito" ? "mi deve" : "gli devo"}</td><td class="n ${t === "credito" ? "pos" : "neg"}">${eur(v)}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="muted small">Tutto saldato.</div>`}</section>
  <section class="card"><h2>Aperti</h2><div class="list">${open.map(li).join("") || `<div class="muted small">Nessuno.</div>`}</div></section>
  <section class="card"><h2>Aggiungi a mano</h2>
    <div class="seg"><button type="button" data-act="crt" data-v="credito" class="${(UI.crt || "credito") === "credito" ? "on" : ""}">Mi devono</button><button type="button" data-act="crt" data-v="debito" class="${UI.crt === "debito" ? "on" : ""}">Devo io</button></div>
    <div class="grid2"><label for="crChi">Persona<input id="crChi"></label><label for="crA">Importo<input id="crA" inputmode="decimal"></label></div>
    <label for="crMot">Motivo<input id="crMot"></label><div id="crErr" class="small neg"></div>
    <button class="pri" data-act="credadd">Aggiungi</button></section>
  ${L.filter(c => c.ok).length ? `<section class="card"><h2>Saldati</h2><div class="list">${L.filter(c => c.ok).map(li).join("")}</div></section>` : ""}`;
}
function subCarb() {
  const y = new Date().getFullYear(); const F = fuelStats(y); const fmtL = x => x.toLocaleString("it-IT", { maximumFractionDigits: 1 });
  return `<div class="tiles"><div class="tile"><span>Carburante ${y}</span><b>${eur0(F.tot)}</b></div><div class="tile"><span>Costo al km</span><b>${F.eKm ? eur(F.eKm, 3) : "-"}</b></div><div class="tile"><span>Km al litro (benzina + GPL)</span><b>${F.kml ? fmtL(F.kml) : "-"}</b></div></div>
  <section class="card"><h2>Benzina e GPL ${legBtn(`Prezzo al litro calcolato solo sui rifornimenti con i litri inseriti. I km al litro e il costo al km servono almeno due letture del contachilometri: l'app te le chiede ogni 3 mesi. Con l'auto bifuel i km al litro mescolano benzina e GPL, per questo è più utile il costo al km.`)}</h2>
    <div class="tblwrap"><table><thead><tr><th></th><th class="n">Spesa</th><th class="n">Litri</th><th class="n">Prezzo al litro</th><th class="n">Rifornimenti</th></tr></thead><tbody>
    ${[["benzina", "Benzina"], ["gpl", "GPL"]].map(([k, n]) => `<tr><td>${n}</td><td class="n">${eur0(F.per[k].tot)}</td><td class="n">${fmtL(F.per[k].lit)}</td><td class="n">${F.per[k].prezzo ? eur(F.per[k].prezzo, 3) : "-"}</td><td class="n">${F.per[k].n}</td></tr>`).join("")}
    </tbody></table></div></section>
  <section class="card"><h2>Letture contachilometri</h2>
    <div class="tblwrap"><table><thead><tr><th>Data</th><th class="n">Km</th><th>Nota</th><th></th></tr></thead><tbody>${F.km.map(k => `<tr><td>${fmtShort(k.d)}</td><td class="n">${k.km.toLocaleString("it-IT")}</td><td>${esc(k.n || "")}</td><td><button class="ghost danger" data-act="kmdel" data-i="${S.km.indexOf(k)}">Elimina</button></td></tr>`).join("")}</tbody></table></div>
    <div class="grid2"><label for="kmD">Data<input id="kmD" type="date" value="${todayISO()}"></label><label for="kmV">Km<input id="kmV" inputmode="numeric"></label></div>
    <button class="pri" data-act="kmadd">Aggiungi lettura</button></section>`;
}
function subCat() {
  return GROUPS.filter(g => g.id !== "cre").map(g => `<section class="card"><h2>${esc(g.n)}</h2>
    ${g.id === "ent" ? `<div class="small muted">Spunta "tassata" sulle entrate su cui si accantonano le imposte (${taxAcc() ? taxAcc().p : 0}%). Sulle altre non si accantona nulla.</div>` : ""}
    ${g.id === "esc" ? `<div class="small muted">Le spese con questa categoria restano nell'elenco movimenti ma non entrano in budget, tabelle e grafici.</div>` : ""}
    ${catsOf(g.id).map(c => { const n = S.movs.filter(m => m.c === c.id).length; return `<div class="row" style="flex-wrap:nowrap"><input value="${esc(c.e)}" data-cat="${c.id}" data-k="e" aria-label="Emoji" style="width:52px;text-align:center;padding:6px"><input type="color" value="${c.col}" data-cat="${c.id}" data-k="col" aria-label="Colore" style="width:44px;padding:2px;flex:none"><input value="${esc(c.n)}" data-cat="${c.id}" data-k="n" aria-label="Nome categoria" style="flex:1;min-width:0"><span class="tiny muted" style="width:46px;flex:none">${n} mov.</span>${g.id === "ent" ? `<label class="chk tiny" style="flex:none;gap:4px"><input type="checkbox" data-tax="${c.id}" ${isTassata(c.id) ? "checked" : ""} aria-label="${esc(c.n)} tassata">tassata</label>` : ""}${c.id === "noconta" ? "" : `<button class="ghost danger" data-act="catdel" data-id="${c.id}" aria-label="Elimina ${esc(c.n)}">✕</button>`}</div>`; }).join("")}
    ${g.id === "esc" ? "" : `<button data-act="catadd" data-g="${g.id}" style="align-self:flex-start">+ Nuova categoria</button>`}</section>`).join("");
}
function subDati() {
  const lordo = LORDO(); const cfg = leggiCfg() || {}; const n = codaLunghezza();
  return `  <section class="card"><h2>Stipendio lordo o netto</h2>
    <label class="chk"><input type="radio" name="lordo" data-k="lordo" value="1" ${lordo ? "checked" : ""}>Mostra le entrate lorde e indica le imposte accantonate</label>
    <label class="chk"><input type="radio" name="lordo" data-k="lordo" value="0" ${!lordo ? "checked" : ""}>Mostra le entrate nette (tolto il ${Math.round(taxP() * 100)}%) e nascondi le imposte</label>
    <div class="small muted">Vale per grafici e tabelle di mese e anno.</div></section>
  <section class="card"><h2>Collegamento al Google Foglio</h2>
    <div class="kv small"><span>Ponte</span><b style="font-weight:400;overflow-wrap:anywhere">${esc(mascheraUrl(cfg.url || ""))}</b><span>Ultimo aggiornamento dal foglio</span><b style="font-weight:400">${S.agg ? new Date(S.agg).toLocaleString("it-IT") : "mai"}</b><span>Modifiche in attesa di invio</span><b>${n}</b></div>
    <div class="row"><button data-act="refresh">Aggiorna dal foglio</button>${n ? `<button data-act="retry">Riprova invio</button>` : ""}</div>
    ${ultimoErrore() ? `<div class="banner warn small">Ultimo errore: ${esc(ultimoErrore())}</div>${n ? `<button class="ghost danger" data-act="dropq" style="align-self:flex-start">Scarta le modifiche in attesa</button>` : ""}` : ""}
    <button class="danger" data-act="unlink" style="align-self:flex-start">Scollega questo dispositivo</button>
    <div class="small muted">Scollegando, da questo dispositivo vengono cancellati indirizzo, chiave e copia dei dati. Il Google Foglio non viene toccato.</div></section>
  <section class="card"><h2>Copia dei dati</h2><div class="small muted">Copia tutti i movimenti in formato tabella (incollabile in Excel o Google Fogli). Per una copia di sicurezza completa usa il Google Foglio: File, Crea una copia.</div><button data-act="copycsv">Copia movimenti</button></section>
  <div class="tiny muted" style="text-align:center">Le mie spese · versione ${VERSIONE_APP}</div>`;
}

/* ===== Primo avvio: collegamento al Google Foglio ===== */
function viewCollega() {
  return `<section class="card"><h2>Collega i tuoi dati</h2>
    <div class="small muted">I dati stanno nel tuo Google Foglio "App spese Denis". Inserisci l'indirizzo dell'App web del ponte (finisce con /exec) e la chiave segreta. Restano salvati solo su questo dispositivo.</div>
    <label for="cUrl">Indirizzo dell'App web<input id="cUrl" inputmode="url" autocomplete="off" placeholder="https://script.google.com/macros/s/.../exec"></label>
    <label for="cKey">Chiave segreta<input id="cKey" type="password" autocomplete="off" placeholder="64 caratteri"></label>
    <div id="cErr" class="small neg" aria-live="polite"></div>
    <button class="pri wide" data-act="clink">Prova collegamento</button></section>`;
}

/* ===== Grafici ===== */
const barLabels = {
  id: "barLabels",
  afterDatasetsDraw(ch, args, opts) {
    const { ctx } = ch; const ds = ch.data.datasets[0]; const meta = ch.getDatasetMeta(0); const tot = opts.total || 1;
    ctx.save(); ctx.font = "600 12px " + cssVar("--font-body"); ctx.textBaseline = "middle";
    meta.data.forEach((bar, i) => {
      const v = ds.data[i]; const txt = eur0(v) + " · " + Math.round(v / tot * 100) + "%";
      const w = ctx.measureText(txt).width; const inside = bar.x - bar.base > w + 12;
      ctx.fillStyle = inside ? "#ffffff" : cssVar("--ink"); ctx.textAlign = inside ? "right" : "left";
      ctx.fillText(txt, inside ? bar.x - 6 : bar.x + 6, bar.y);
    });
    ctx.restore();
  }
};
function catBarChart(el, items, y, mo) {
  const ink = cssVar("--ink"), line = cssVar("--line");
  const tot = items.reduce((s, i) => s + i.v, 0); const max = items.length ? items[0].v : 1;
  el.parentElement.style.height = Math.max(160, items.length * 30 + 40) + "px";
  return new Chart(el, {
    type: "bar", data: { labels: items.map(i => i.e + " " + i.n), datasets: [{ data: items.map(i => r2(i.v)), backgroundColor: items.map(i => i.col), borderRadius: 5 }] },
    plugins: [barLabels],
    options: {
      indexAxis: "y", maintainAspectRatio: false, layout: { padding: { right: 8 } },
      onClick: (e, els) => { if (els.length) openCatDetail(items[els[0].index].id, y, mo); },
      onHover: (e, els) => { e.native.target.style.cursor = els.length ? "pointer" : "default"; },
      plugins: { legend: { display: false }, barLabels: { total: tot }, tooltip: { callbacks: { label: c => eur(c.raw) + " (" + Math.round(c.raw / tot * 100) + "%)" } } },
      scales: { x: { display: false, max: max * 1.45, grid: { display: false } }, y: { grid: { display: false }, ticks: { color: ink } } }
    }
  });
}
function catItems(A) {
  const items = S.cats.filter(c => c.g === "nec" || c.g === "ext").map(c => ({ id: c.id, e: c.e, n: c.n, v: catAmt(A, c.id, UI.inclS), col: c.col })).filter(x => x.v > 0);
  const nc = catAmt(A, "__nc", UI.inclS); if (nc) items.push({ id: "__nc", e: "❓", n: "Senza categoria", v: nc, col: "#adb5bd" });
  return items.sort((a, b) => b.v - a.v);
}
function afterRender() {
  if (UI.tab === "ins") bindForm(document.getElementById("insbox"), UI.form, "i_", () => { UI.form = newForm(); render(); });
  if (!window.Chart) return;
  const muted = cssVar("--muted"), line = cssVar("--line");
  Chart.defaults.color = muted; Chart.defaults.font.family = cssVar("--font-body"); Chart.defaults.borderColor = line;
  if (UI.tab === "mese") {
    const el = document.getElementById("chMonth"); if (el) charts.push(catBarChart(el, catItems(monthAgg(UI.y, UI.mo)), UI.y, UI.mo));
  }
  if (UI.tab === "anno") {
    const Y = yearAgg(UI.y); const lordo = LORDO(), tp = taxP();
    const el = document.getElementById("chYear");
    const lastM = Y.months.reduce((l, a, i) => a.n ? i : l, -1);
    const cut = (arr) => arr.map((x, i) => i <= lastM ? x : null);
    const ds = [
      { type: "bar", label: "Necessarie", data: cut(Y.months.map(a => r2(a.nec))), backgroundColor: "#f2b705", stack: "s", borderRadius: 3 },
      { type: "bar", label: "Extra", data: cut(Y.months.map(a => r2(a.ext + a.nc))), backgroundColor: "#e03131", stack: "s", borderRadius: 3 }
    ];
    if (UI.inclS) ds.push({ type: "bar", label: "Straordinarie", data: cut(Y.months.map(a => r2(a.straord))), backgroundColor: "#ae3ec9", stack: "s", borderRadius: 3 });
    if (UI.showInv) ds.push({ type: "bar", label: "Investimenti", data: cut(Y.months.map(a => r2(a.inv))), backgroundColor: "#1c7ed6", stack: "s", borderRadius: 3 });
    const BY = budgetYear(UI.y);
    ds.push({ type: "line", label: "Quota spese prevista", data: cut(BY.map(b => b ? r2(b.mese) : null)), borderColor: cssVar("--ink"), backgroundColor: cssVar("--ink"), borderWidth: 2, stepped: "middle", stack: "quota", pointRadius: 0, hidden: !UI.lineQ });
    ds.push({ type: "line", label: "Entrate lorde", data: cut(Y.months.map(a => r2(a.ent))), borderColor: "#2b8a3e", backgroundColor: "#2b8a3e", stack: "lorde", tension: .3, pointRadius: 3, hidden: !UI.lineL });
    ds.push({ type: "line", label: "Entrate nette", data: cut(Y.months.map(a => r2(a.ent - a.taxAcc))), borderColor: "#69db7c", backgroundColor: "#69db7c", borderDash: [6, 4], stack: "nette", tension: .3, pointRadius: 3, hidden: !UI.lineN });
    charts.push(new Chart(el, { data: { labels: MESI3, datasets: ds }, options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ": " + eur(c.raw) } } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: line }, ticks: { callback: v => v.toLocaleString("it-IT") + "€" } } } } }));
    const e2 = document.getElementById("chYearCat"); if (e2) charts.push(catBarChart(e2, catItems(Y), UI.y, ""));
  }
}

/* ===== Azioni ===== */
document.getElementById("view").addEventListener("click", e => {
  const b = e.target.closest("[data-act]"); if (!b) return; const a = b.dataset.act;
  if (b.closest("[data-formbox]")) return;
  if (a === "edit") openEdit(b.dataset.id);
  else if (a === "catdet") openCatDetail(b.dataset.c, +b.dataset.y, b.dataset.mo, b.dataset.s === "1");
  else if (a === "leg") { modal(`<div class="row between"><h2>Legenda</h2><button class="ghost" data-x="1">Chiudi</button></div><div class="small">${LEGS[+b.dataset.k] || ""}</div>`); }
  else if (a === "clrrng") { UI.f.from = ""; UI.f.to = ""; render(); }
  else if (a === "ysort") { UI.ySort = b.dataset.v; const sy = window.scrollY; render(); window.scrollTo(0, sy); }
  else if (a === "tog") { UI.open[b.dataset.g] = !UI.open[b.dataset.g]; const sy = window.scrollY; render(); window.scrollTo(0, sy); }
  else if (a === "gomov") { UI.f = { mo: "", c: "", q: "" }; go("mov"); }
  else if (a === "gonc") { UI.f = { mo: "", c: "__nc", q: "" }; UI.y = years()[years().length - 1]; go("mov"); }
  else if (a === "annolordo") { S.imp.mostra_lordo = b.dataset.v; persist(); const sy = window.scrollY; render(); window.scrollTo(0, sy); }
  else if (a === "creaanno") creaAnno();
  else if (a === "smistmese") openSmistMese(+b.dataset.y, +b.dataset.mo);
  else if (a === "godv") { UI.f = { mo: "", c: "__dv", q: "" }; go("mov"); }
  else if (a === "retry") { invia(true); }
  else if (a === "refresh") { aggiornaDalFoglio(true); }
  else if (a === "dropq") confirmBox("Scarto le modifiche non ancora arrivate al foglio? Dopo ricarico i dati dal foglio: quello che non era stato inviato si perde.", "Scarta", () => { svuotaCoda(); aggiornaDalFoglio(true); });
  else if (a === "unlink") confirmBox("Scollego questo dispositivo? Indirizzo, chiave e copia dei dati vengono cancellati da qui. Il Google Foglio non viene toccato." + (codaLunghezza() ? " Attenzione: ci sono " + codaLunghezza() + " modifiche non ancora inviate, che andranno perse." : ""), "Scollega", () => { scollega(); render(); });
  else if (a === "clink") collegaDispositivo();
  else if (a === "objprop") {
    const cs = S.cats.filter(c => c.g === "nec" || c.g === "ext").filter(c => propObj(c.id) > 0);
    if (!cs.length) { toast("Non ci sono ancora mesi chiusi per calcolare la media"); return; }
    confirmBox(`Imposto gli obiettivi di ${cs.length} categorie alla media mensile più 10%, arrotondata alla decina? Le categorie senza spese mantengono l'obiettivo attuale.`, "Imposta", () => { cs.forEach(c => S.obj[c.id] = propObj(c.id)); persist(); render(); toast("Obiettivi aggiornati"); });
  }
  else if (a === "patnewyear") {
    const y = UI.y; const prev = patFor(y - 1);
    prev.voci.forEach(v => S.patRows.push({ anno: y, id: uid(), n: v.n, t: v.t, ini: (v.fin != null && v.fin !== "") ? v.fin : v.ini, fin: null }));
    if (prev.obiettivo && impNum("obiettivo_patrimonio_" + y) == null) S.imp["obiettivo_patrimonio_" + y] = String(prev.obiettivo);
    persist(); render(); toast("Voci del " + y + " create");
  }
  else if (a === "patadd0") { S.patRows.push({ anno: UI.y, id: uid(), n: "Nuova voce", t: "liq", ini: 0, fin: null }); persist(); render(); }
  else if (a === "goobj") go("altro", "obj");
  else if (a === "sub2") go("altro", b.dataset.v);
  else if (a === "mprev") { UI.mo--; if (UI.mo < 1) { UI.mo = 12; UI.y--; } render(); }
  else if (a === "mnext") { UI.mo++; if (UI.mo > 12) { UI.mo = 1; UI.y++; } render(); }
  else if (a === "yprev") { UI.y--; render(); } else if (a === "ynext") { UI.y++; render(); }
  else if (a === "sub") { UI.altro = b.dataset.v || null; render(); window.scrollTo(0, 0); }
  else if (a === "kmsave" || a === "kmadd") {
    const v = parseNum((document.getElementById(a === "kmsave" ? "kmq" : "kmV") || {}).value);
    if (!(v > 0)) { toast("Scrivi i km del contachilometri"); return; }
    S.km.push({ d: a === "kmadd" ? document.getElementById("kmD").value || todayISO() : todayISO(), km: Math.round(v) }); persist(); toast("Km salvati"); render();
  }
  else if (a === "kmdel") { S.km.splice(+b.dataset.i, 1); persist(); render(); }
  else if (a === "accadd") { S.acc.push({ id: uid(), n: "Nuovo conto", p: 0, fix: 0 }); persist(); render(); }
  else if (a === "accdel") { if (S.acc.length <= 1) return; const was = S.acc.find(x => x.id === b.dataset.id); S.acc = S.acc.filter(x => x.id !== b.dataset.id); if (was && was.spesa) S.acc[0].spesa = true; persist(); render(); }
  else if (a === "ricedit") openRic(b.dataset.id);
  else if (a === "patadd") { S.patRows.push({ anno: UI.y, id: uid(), n: "Nuova voce", t: document.getElementById("patNewT").value, ini: 0, fin: null }); persist(); render(); }
  else if (a === "crt") { UI.crt = b.dataset.v; render(); }
  else if (a === "credadd") {
    const chi = document.getElementById("crChi").value.trim(), am = parseNum(document.getElementById("crA").value), mot = document.getElementById("crMot").value.trim();
    if (!chi || !(am > 0)) { document.getElementById("crErr").textContent = "Scrivi la persona e un importo maggiore di zero."; return; }
    S.cred.push({ id: uid(), tipo: UI.crt || "credito", chi, a: r2(am), mot, d: todayISO(), ok: false }); persist(); toast("Aggiunto"); render();
  }
  else if (a === "credok") {
    const id = b.dataset.id;
    let avviso = "";
    if (id.startsWith("mv_")) {
      const m = S.movs.find(x => x.id === id.slice(3));
      if (m && m.sh) m.sh.ok = !m.sh.ok; else if (m) m.ok = !m.ok;
      // Un credito restituito non conta più come spesa nel mese in cui era stato anticipato
      if (m) avviso = ((m.sh ? m.sh.ok : m.ok) ? "Credito saldato: " : "Credito riaperto: ") + "cambiano i conti di " + MESI[+m.d.slice(5, 7) - 1] + " " + m.d.slice(0, 4);
    }
    else { const c = S.cred.find(x => x.id === id); if (c) c.ok = !c.ok; }
    persist(); render(); if (avviso) toast(avviso);
  }
  else if (a === "creddel") { S.cred = S.cred.filter(x => x.id !== b.dataset.id); persist(); render(); }
  else if (a === "catadd") openNewCat(b.dataset.g, () => render());
  else if (a === "catdel") {
    const id = b.dataset.id; const n = S.movs.filter(m => m.c === id).length;
    const del = () => { S.movs.forEach(m => { if (m.c === id) m.c = null; }); S.ric.forEach(r => { if (r.c === id) r.c = ""; }); S.cats = S.cats.filter(c => c.id !== id); delete S.obj[id]; persist(); render(); };
    if (n) confirmBox(`La categoria ha ${n} movimenti. Eliminandola diventano "senza categoria". Procedo?`, "Elimina", del); else del();
  }
  else if (a === "copycsv") {
    const rows = [["Data", "Descrizione", "Categoria", "Gruppo", "Importo", "Mia quota", "Straordinaria", "Litri", "Nota"]].concat(S.movs.map(m => [fmtShort(m.d), m.t, catName(m.c), gname(grpOf(m.c)), String(m.a).replace(".", ","), m.sh ? String(m.sh.mia).replace(".", ",") : "", m.s ? "sì" : "", m.l ? String(m.l).replace(".", ",") : "", m.n || ""]));
    const txt = rows.map(r => r.map(x => String(x).replace(/\t|\n/g, " ")).join("\t")).join("\n");
    navigator.clipboard.writeText(txt).then(() => toast("Copiati " + S.movs.length + " movimenti"), () => toast("Copia non riuscita in questo browser"));
  }
});
document.getElementById("view").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches("[data-act][role=button]")) e.target.click(); });
document.getElementById("view").addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.act === "inclS") { UI.inclS = el.checked; invalidate(); render(); return; }
  if (["showInv", "lineL", "lineN", "lineQ", "tS", "tI"].includes(el.dataset.act)) { UI[el.dataset.act] = el.checked; const sy = window.scrollY; render(); window.scrollTo(0, sy); return; }
  if (el.dataset.flt) { const k = el.dataset.flt; if (k === "y") UI.y = +el.value; else UI.f[k] = el.value; render(); return; }
  if (el.dataset.obj) { const v = parseNum(el.value); if (isNaN(v) || v <= 0) delete S.obj[el.dataset.obj]; else S.obj[el.dataset.obj] = r2(v); persist(); render(); return; }
  if (el.dataset.acc) {
    const acc = S.acc.find(x => x.id === el.dataset.acc); const k = el.dataset.k;
    if (k === "spesa") S.acc.forEach(x => x.spesa = x.id === acc.id);
    else if (k === "tasse") S.acc.forEach(x => x.tasse = x.id === acc.id);
    else if (k === "n") acc.n = el.value.trim() || acc.n; else { const v = parseNum(el.value); cambiaStandard(acc.id, k, isNaN(v) ? 0 : v); }
    persist(); render(); return;
  }
  if (el.dataset.ntr) {
    const r = ripNonTassate(); const v = parseNum(el.value); if (v > 0) r[el.dataset.ntr] = r2(v); else delete r[el.dataset.ntr];
    S.imp.ripartizione_non_tassate = Object.keys(r).filter(id => S.acc.some(a => a.id === id && !a.tasse)).map(id => id + ":" + r[id]).join(",") || "nessuna:0";
    persist(); const sy = window.scrollY; render(); window.scrollTo(0, sy); return;
  }
  if (el.dataset.tax) { const set = new Set(tassate()); if (el.checked) set.add(el.dataset.tax); else set.delete(el.dataset.tax); S.imp.categorie_tassate = [...set].join(","); persist(); render(); toast("Imposte ricalcolate"); return; }
  if (el.dataset.k === "prepIni") { const v = parseNum(el.value); S.imp["prepagata_inizio_" + UI.y] = String(isNaN(v) ? 0 : r2(v)); persist(); render(); return; }
  if (el.dataset.k === "nomeAv") { S.imp.nome_conto_avanzi = el.value.trim(); persist(); render(); return; }
  if (el.dataset.k === "lordo") { S.imp.mostra_lordo = el.value === "1" ? "SI" : "NO"; persist(); render(); return; }
  if (el.dataset.k === "annoPred") { S.imp.anno_predefinito = String(el.value); UI.y = +el.value; persist(); render(); toast("Anno da analizzare: " + el.value); return; }
  if (el.dataset.k === "ripIni") { const v = parseNum(el.value); S.imp["riporto_iniziale_" + UI.y] = String(isNaN(v) ? 0 : v); persist(); render(); return; }
  if (el.dataset.k === "taxIni") { const v = parseNum(el.value); const k = "imposte_accantonate_inizio_" + UI.y; if (isNaN(v)) delete S.imp[k]; else S.imp[k] = String(v); persist(); render(); return; }
  if (el.dataset.k === "patObj") { const v = parseNum(el.value); if (v > 0) S.imp["obiettivo_patrimonio_" + UI.y] = String(v); persist(); render(); return; }
  if (el.dataset.pat) { const v = S.patRows.find(x => x.id === el.dataset.pat); const k = el.dataset.k; if (k === "n") v.n = el.value.trim() || v.n; else { const n = parseNum(el.value); v[k] = isNaN(n) ? (k === "fin" ? null : 0) : n; } persist(); render(); return; }
  if (el.dataset.cat) { const c = S.cats.find(x => x.id === el.dataset.cat); const k = el.dataset.k; if (k === "n") c.n = el.value.trim() || c.n; else if (k === "e") c.e = el.value.trim() || c.e; else c.col = el.value; persist(); render(); return; }
});
document.getElementById("view").addEventListener("input", e => { if (e.target.dataset.flt === "q") { UI.f.q = e.target.value; clearTimeout(UI.qt); UI.qt = setTimeout(() => { const pos = e.target.selectionStart; render(); const q = document.getElementById("fq"); q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) { } }, 300); } });

/* ===== Finestre ===== */
function modal(html, onReady) {
  const m = document.getElementById("modal");
  m.innerHTML = `<div class="modal" data-close="1"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  m.querySelector(".modal").addEventListener("click", e => { if (e.target.dataset.close || e.target.closest("[data-x]")) closeModal(); });
  onReady && onReady(m.querySelector(".sheet"));
}
function closeModal() { document.getElementById("modal").innerHTML = ""; if (UI.tab === "ins" && UI.form) { const ib = document.getElementById("insbox"); if (ib) bindForm(ib, UI.form, "i_", () => { UI.form = newForm(); render(); }); } }
function openEdit(id) {
  const m = S.movs.find(x => x.id === id); if (!m) return;
  const F = newForm(m);
  modal(`<div class="row between"><h2>Modifica movimento</h2><button class="ghost" data-x="1">Chiudi</button></div>${m.r ? `<div class="small muted">Inserito in automatico da una spesa ricorrente.</div>` : ""}<div class="stack" data-formbox>${formHTML(F, "e_")}</div>`,
    sh => bindForm(sh, F, "e_", () => { closeModal(); render(); }));
}
function askDelete(id) {
  confirmBox("Elimino questo movimento?", "Elimina", () => { S.movs = S.movs.filter(x => x.id !== id); persist(); closeModal(); render(); toast("Movimento eliminato"); });
}
function confirmBox(msg, ok, fn) {
  const holder = document.createElement("div");
  holder.innerHTML = `<div class="modal"><div class="sheet" role="alertdialog" aria-modal="true"><div>${esc(msg)}</div><div class="grid2"><button data-no="1">Annulla</button><button class="pri" data-yes="1">${esc(ok)}</button></div></div></div>`;
  document.body.appendChild(holder);
  holder.addEventListener("click", e => { if (e.target.dataset.yes) { holder.remove(); fn(); } else if (e.target.dataset.no || e.target.classList.contains("modal")) holder.remove(); });
}
function openNewCat(g, cb) {
  const holder = document.createElement("div");
  holder.innerHTML = `<div class="modal"><div class="sheet"><h2>Nuova categoria</h2>
    <div class="grid2"><label for="ncE2">Emoji<input id="ncE2" value="${GDEF[g] ? GDEF[g].e : "🏷️"}"></label><label for="ncG">Gruppo<select id="ncG">${GROUPS.filter(x => x.id !== "cre" && x.id !== "esc").map(x => `<option value="${x.id}" ${x.id === g ? "selected" : ""}>${esc(x.n)}</option>`).join("")}</select></label></div>
    <label for="ncN">Nome<input id="ncN"></label>
    <label for="ncO">Obiettivo mensile (facoltativo)<input id="ncO" inputmode="decimal"></label>
    <div id="ncE" class="small neg"></div>
    <div class="grid2"><button data-no="1">Annulla</button><button class="pri" data-yes="1">Crea</button></div></div></div>`;
  document.body.appendChild(holder); holder.querySelector("#ncN").focus();
  holder.addEventListener("click", e => {
    if (e.target.dataset.no || e.target.classList.contains("modal")) { holder.remove(); return; }
    if (!e.target.dataset.yes) return;
    const n = holder.querySelector("#ncN").value.trim(); if (!n) { holder.querySelector("#ncE").textContent = "Scrivi il nome della categoria."; return; }
    if (S.cats.some(c => c.n.toLowerCase() === n.toLowerCase())) { holder.querySelector("#ncE").textContent = "Esiste già una categoria con questo nome."; return; }
    const id = uid(); const gg = holder.querySelector("#ncG").value;
    S.cats.push({ id, n, g: gg, e: holder.querySelector("#ncE2").value.trim() || GDEF[gg].e, col: GDEF[gg].col });
    const o = parseNum(holder.querySelector("#ncO").value); if (o > 0) S.obj[id] = o;
    persist(); holder.remove(); toast("Categoria creata"); cb && cb(id);
  });
}
function openRic(id) {
  const r = id ? Object.assign({}, S.ric.find(x => x.id === id)) : { id: "", t: "", c: "", a: "", freq: 1, from: todayISO().slice(0, 7), to: "" };
  modal(`<div class="row between"><h2>${id ? "Modifica" : "Nuova"} spesa ricorrente</h2><button class="ghost" data-x="1">Chiudi</button></div>
    <label for="rT">Descrizione<input id="rT" value="${esc(r.t)}" placeholder="es. Amazon Prime"></label>
    <div class="grid2"><label for="rA">Importo<input id="rA" inputmode="decimal" value="${esc(String(r.a).replace(".", ","))}"></label>
    <label for="rC">Categoria<select id="rC">${catOptions("spe", r.c, true)}</select></label></div>
    <div class="grid2"><label for="rF">Ogni quanto<select id="rF">${Object.entries(FREQ).map(([k, v]) => `<option value="${k}" ${+k === +r.freq ? "selected" : ""}>${v}</option>`).join("")}</select></label><div></div></div>
    <div class="grid2"><label for="rFrom">Dal mese<input id="rFrom" type="month" value="${r.from}"></label><label for="rTo">Fino al mese (facoltativo)<input id="rTo" type="month" value="${r.to || ""}"></label></div>
    <div class="small muted">La spesa viene inserita il primo giorno di ogni mese previsto. Se il mese di partenza è già passato, l'app inserisce subito anche quelle arretrate.</div>
    <div id="rE" class="small neg"></div>
    <button class="pri wide" id="rSave">Salva</button>${id ? `<button class="danger wide" id="rDel">Elimina spesa ricorrente</button>` : ""}`, sh => {
    sh.querySelector("#rSave").addEventListener("click", () => {
      const t = sh.querySelector("#rT").value.trim(), a = parseNum(sh.querySelector("#rA").value), c = sh.querySelector("#rC").value, f = +sh.querySelector("#rF").value, from = sh.querySelector("#rFrom").value, to = sh.querySelector("#rTo").value;
      const E = sh.querySelector("#rE");
      if (!t) return E.textContent = "Scrivi la descrizione."; if (!(a > 0)) return E.textContent = "Scrivi un importo maggiore di zero."; if (!c) return E.textContent = "Scegli la categoria."; if (!from) return E.textContent = "Scegli il mese di partenza."; if (to && to < from) return E.textContent = "Il mese finale viene prima di quello di partenza.";
      const obj = { id: id || uid(), t, a: r2(a), c, freq: f, from, to };
      if (id) S.ric[S.ric.findIndex(x => x.id === id)] = obj; else S.ric.push(obj);
      persist(); closeModal(); render(); // il ponte inserisce subito anche le ricorrenze arretrate
    });
    const del = sh.querySelector("#rDel"); if (del) del.addEventListener("click", () => confirmBox("Elimino la spesa ricorrente? Le spese già inserite restano nei movimenti.", "Elimina", () => { S.ric = S.ric.filter(x => x.id !== id); persist(); closeModal(); render(); }));
  });
}
let toastT = null;
function toast(msg) { let t = document.querySelector(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); } t.textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 3200); }

/* ===== Avvio ===== */
function annoPredefinito() { const v = parseInt(S && S.imp.anno_predefinito, 10); return v > 2000 ? v : new Date().getFullYear(); }

/* Primo avvio: prova il collegamento e, se va, salva indirizzo e chiave su questo dispositivo */
async function collegaDispositivo() {
  const url = document.getElementById("cUrl").value.trim(), key = document.getElementById("cKey").value.trim();
  const E = document.getElementById("cErr");
  // Il secondo indirizzo ammesso serve solo per le prove sul computer (strumenti/server-locale.js --finto)
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url) && !/^http:\/\/localhost:\d+\/finto\/exec$/.test(url)) { E.textContent = "L'indirizzo deve iniziare con https://script.google.com/macros/s/ e finire con /exec."; return; }
  if (key.length < 32) { E.textContent = "La chiave è troppo corta: copiala per intero."; return; }
  E.textContent = ""; const btn = document.querySelector("[data-act=clink]"); btn.disabled = true; btn.textContent = "Collegamento in corso...";
  try {
    const dati = await chiamaPonte("tutto", {}, { url, key });
    salvaCfg({ url, key }); applicaDalFoglio(dati); STATO = "ok"; aggiornaIndicatore();
    UI.y = annoPredefinito(); UI.tab = "ins"; render(); toast("Collegato al tuo Google Foglio");
  } catch (err) {
    E.textContent = err.rete ? "Non riesco a raggiungere il ponte: controlla la connessione e l'indirizzo." : "Il ponte ha risposto: " + err.message;
    btn.disabled = false; btn.textContent = "Prova collegamento";
  }
}

/* Scorciatoia "Nuova spesa" (index.html#nuova): apre il modulo e mette il cursore sull'importo */
function apriNuova() {
  if (location.hash !== "#nuova" || !S) return;
  UI.tab = "ins"; UI.form = newForm(); render();
  const a = document.getElementById("i_a"); if (a) a.focus();
  history.replaceState(null, "", location.pathname);
}

function avvia() {
  S = caricaCache();
  if (S) UI.y = annoPredefinito();
  render(); aggiornaIndicatore();
  apriNuova();
  if (!leggiCfg()) return;
  // Prima invia le modifiche rimaste in coda, poi aggiorna dal foglio
  invia().then(() => aggiornaDalFoglio()).then(apriNuova);
}
document.getElementById("sync").addEventListener("click", () => { if (codaLunghezza() || ultimoErrore()) invia(true); });
window.addEventListener("online", () => invia());
window.addEventListener("hashchange", apriNuova);
// Quando si torna sull'app (es. dopo un'ora) aggiorna i dati dal foglio
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && leggiCfg() && S && Date.now() - (S.agg || 0) > 5 * 60 * 1000) invia().then(() => aggiornaDalFoglio()); });

/* Service worker: app disponibile anche senza rete, e avviso quando c'è una versione nuova */
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").then(reg => {
    const avvisa = w => {
      const b = document.getElementById("update"); b.hidden = false;
      b.onclick = () => { b.textContent = "Aggiornamento..."; w.postMessage("aggiorna"); };
    };
    if (reg.waiting && navigator.serviceWorker.controller) avvisa(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) avvisa(w); });
    });
    setInterval(() => reg.update().catch(() => { }), 60 * 60 * 1000);
  }).catch(() => { });
  // Ricarica solo quando una versione nuova prende il posto di quella vecchia (non alla primissima installazione)
  const cera = !!navigator.serviceWorker.controller; let ricaricato = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (cera && !ricaricato) { ricaricato = true; location.reload(); } });
}

avvia();

