/* =====================================================================
   v57 · 🥇 Selo de ouro + limpeza automática
   Selo de ouro = a aposta só passa se TUDO o que o Zé sabe estiver a favor:
     - nesta liga e neste tipo de aposta o Zé acerta o que promete (histórico) — ou ainda não há histórico mau;
     - as casas concordam com ele (quando discorda muito, normalmente é ele que não sabe algo);
     - confiança do modelo não é baixa; probabilidade ≥ 70%; odd entre 1.25 e 2.20;
     - não está no travão automático.
   O selo é guardado e conferido com o resultado: nas Estatísticas vês quanto acerta e o lucro a 1 € por aposta.
   v57d (simulação desta época + da época passada): odd máxima 1.40, sem «vitória» simples nem «ambas marcam»; sem prata.
   ===================================================================== */
function seloMktProb(m, k) {
  try {
    const st = studyFor(m), b = st && st.books && st.books[0]; if (!b) return null;
    const o = b.odds;
    if (OUT_SET[k] && o['1'] > 1 && o.X > 1 && o['2'] > 1) { const t = 1 / o['1'] + 1 / o.X + 1 / o['2']; return OUT_SET[k].reduce((a, j) => a + (1 / o[j]) / t, 0); }
    const g = /^([OU])(\d+(?:\.\d+)?)$/.exec(k);
    if (g) { const ov = o['O' + g[2]], un = o['U' + g[2]]; if (ov > 1 && un > 1) { const t = 1 / ov + 1 / un; return g[1] === 'O' ? (1 / ov) / t : (1 / un) / t; } }
    if (k === 'BTTS' && o.BTTS > 1 && o.BTTS_N > 1) { const t = 1 / o.BTTS + 1 / o.BTTS_N; return (1 / o.BTTS) / t; }
  } catch (e) {}
  return null;
}
function seloHist(m, k) {
  try {
    if (!m.espn) return null;
    const f = PICK_FAMILY(k), rows = Object.values(zarchLoad().rows).filter(r => r.t === 'aposta' && r.c === m.espn.code && PICK_FAMILY(r.k) === f);
    if (rows.length < 8) return { n: rows.length };
    const g = zstAgg(rows); return { n: g.n, w: g.w, hit: g.hit, exp: g.exp, d: g.hit - g.exp };
  } catch (e) { return null; }
}
const SELO_MAX_ODD = 1.40, SELO_NO_FAM = ['vitória', 'ambas marcam', 'ambas marcam — não', 'empate'];
function zeSelo(m, k, p, odd) {
  const why = [], bad = [];
  let pts = 0;
  const h = seloHist(m, k);
  if (h && h.n >= 8) { if (h.d >= -0.03) { pts++; why.push(`✅ nesta liga e tipo acerta o que promete (${h.w}/${h.n})`); } else if (h.d <= -0.08) bad.push(`❌ nesta liga e tipo falha mais do que promete (${h.w}/${h.n})`); }
  const q = seloMktProb(m, k);
  if (q == null) bad.push('sem odds das casas para confirmar');
  else if (Math.abs(p - q) <= 0.06) { pts++; why.push(`🤝 casas concordam (${Math.round(q * 100)}%)`); }
  else if (p - q > 0.12) bad.push(`🤔 discorda das casas (${Math.round(q * 100)}%)`);
  let conf = null; try { conf = modelo(m).conf; } catch (e) {}
  if (conf === 'baixa') bad.push('confiança baixa');
  if (p >= 0.7) { pts++; why.push(`🎯 ${Math.round(p * 100)}%`); }
  const o = odd > 1 ? odd : (q ? 0.95 / q : 0.95 / p);
  if (o < ZE_MIN_ODD) bad.push(`odd baixa (${o.toFixed(2)})`);
  // simulação (547 jogos desta época, sem ver o futuro): ouro com odd até 1.40 acertou 75% (prometia 72%);
  // acima de 1.40 e em «vitória» simples o Zé prometia demais → ficam sem selo
  if (o > SELO_MAX_ODD) bad.push(`odd acima de ${SELO_MAX_ODD.toFixed(2)} (${o.toFixed(2)})`);
  const fam = PICK_FAMILY(k);
  if (SELO_NO_FAM.includes(fam)) bad.push(`«${fam}» — na simulação o Zé promete demais aqui`);
  if (zeBraked(m, k)) bad.push('⛔ no travão automático');
  const grade = !bad.length && pts >= 2 ? 'ouro' : null;   // a «prata» saiu: na simulação não acertava mais do que os jogos sem selo
  return { grade, pts, why, bad, q, odd: o };
}
/* os desafios levam selo; os de ouro passam para a frente (e o «jogo do dia» passa a ser o melhor ouro) */
const GOLD_KEY = 'ze_gold_v1';
function goldLog() { return lsGet(GOLD_KEY, { legs: {} }); }
function goldSave(list) {
  const L = goldLog(); let ch = false;
  list.forEach(c => { if (!c.m.espn || !c.m.espn.ev) return; const id = c.m.espn.ev + '|' + c.k2; if (L.legs[id]) return; L.legs[id] = { ev: String(c.m.espn.ev), k: c.k2, p: +c.p.toFixed(3), o: c.odd > 1 ? +(+c.odd).toFixed(2) : null, h: c.m.home, a: c.m.away, lg: c.m.league || '', d: Date.now() }; ch = true; });
  const ids = Object.keys(L.legs); if (ids.length > 800) ids.sort((a, b) => L.legs[a].d - L.legs[b].d).slice(0, ids.length - 800).forEach(id => delete L.legs[id]);
  if (ch) lsSet(GOLD_KEY, L);
}
zeChallenges = (function (prev) {
  return function () {
    const L = prev.apply(this, arguments) || [];
    L.forEach(c => { if (!c.selo) { try { c.selo = zeSelo(c.m, c.k2, c.p, c.odd); } catch (e) { c.selo = { grade: null, why: [], bad: [] }; } } });
    const rank = c => c.selo && c.selo.grade === 'ouro' ? 1 : 0;
    const out = L.slice().sort((a, b) => rank(b) - rank(a) || (b.p - a.p) || b.score - a.score || a.k - b.k);   // dentro do mesmo selo: o mais provável primeiro (falhar menos)
    try { goldSave(out.filter(c => c.selo && c.selo.grade === 'ouro')); } catch (e) {}
    return out;
  };
})(zeChallenges);
function goldGrade(payload) {
  const fin = ((payload && payload.matches) || []);
  if (!fin.length) return 0;
  const L = goldLog(); let n = 0;
  Object.keys(L.legs).forEach(id => {
    const x = L.legs[id]; if (x.w != null) return;
    const e = fin.find(z => String(z.id) === String(x.ev)); if (!e) return;
    if (e.status === 'POSTPONED') { delete L.legs[id]; n++; return; }
    if (e.status !== 'FINISHED' || !e.score || !e.score.fullTime || e.score.fullTime.home == null || !MARKET_CONDS[x.k]) return;
    x.w = MARKET_CONDS[x.k](e.score.fullTime.home, e.score.fullTime.away) ? 1 : 0; x.res = e.score.fullTime.home + '-' + e.score.fullTime.away; n++;
  });
  if (n) lsSet(GOLD_KEY, L);
  return n;
}
applyLive = (function (prev) { return function (payload) { const r = prev.apply(this, arguments); try { goldGrade(payload); } catch (e) {} return r; }; })(applyLive);
function goldStats(from, to) {
  const g = Object.values(goldLog().legs).filter(x => x.w != null && (!from || isoDay(new Date(x.d)) >= from) && (!to || isoDay(new Date(x.d)) <= to));
  if (!g.length) return null;
  const withOdd = g.filter(x => x.o > 1), pr = withOdd.reduce((s, x) => s + (x.w ? x.o - 1 : -1), 0);
  return { n: g.length, w: g.filter(x => x.w).length, p: g.reduce((s, x) => s + x.p, 0) / g.length, no: withOdd.length, pr, roi: withOdd.length ? pr / withOdd.length : null };
}
/* selo nos cartões dos desafios + filtro «só ouro» */
let CH_GOLD_ONLY = false;
function chPanelDone(box) {
  try {
    box = box || document.getElementById('zeChallenges'); if (!box || box.hidden) return;
    const L = (typeof CH_RENDERED !== 'undefined' && CH_RENDERED.length ? CH_RENDERED : zeChallenges(36));
    box.querySelectorAll('.ch-card[data-i]').forEach(card => {
      if (card.querySelector('.ch-selo')) return;
      const c = L.find(x => String(x.i) === card.dataset.i); if (!c || !c.selo) return;
      const s = c.selo, gold = s.grade === 'ouro', silver = s.grade === 'prata';
      card.classList.toggle('is-gold', gold);
      const line = `<div class="ch-selo ${gold ? 'g' : silver ? 's' : 'n'}">${gold ? '🥇 <b>Selo de ouro</b>' : silver ? '🥈 <b>Prata</b>' : '⚪ <b>Sem selo</b>'} · ${[...s.why, ...s.bad].map(esc).join(' · ')}</div>`;
      const bet = card.querySelector('.vc-bet'); if (bet) bet.insertAdjacentHTML('afterend', line); else card.insertAdjacentHTML('beforeend', line);
    });
    const head = box.querySelector('.panel-h');
    if (head && !head.querySelector('.ch-goldbtn') && box.querySelector('.ch-card')) {
      const nG = box.querySelectorAll('.ch-card.is-gold').length;
      head.insertAdjacentHTML('beforeend', `<button class="btn btn-sm ch-goldbtn" onclick="CH_GOLD_ONLY=!CH_GOLD_ONLY; document.getElementById('zeChallenges').classList.toggle('gold-only', CH_GOLD_ONLY); this.classList.toggle('btn-lime', CH_GOLD_ONLY)">🥇 Só ouro (${nG})</button>`);
      if (CH_GOLD_ONLY) { box.classList.add('gold-only'); head.querySelector('.ch-goldbtn').classList.add('btn-lime'); }
    }
    if (typeof rvEnhance === 'function') rvEnhance(box);
  } catch (e) { console.warn(e); }
}
zeChallengesToggle = (function (prev) { return function () { const r = prev.apply(this, arguments); try { chPanelDone(); } catch (e) {} return r; }; })(zeChallengesToggle);
/* estatísticas: linha do selo de ouro (com lucro a 1 € por aposta) */
renderZeStats = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const [a, b] = zstRange(ZST_PER), s = goldStats(a === '0000' ? null : a, b === '9999' ? null : b);
      const box = document.querySelector('#zeStatsBox .panel .panel-b'); if (!box) return r;
      const row = s && s.n ? `<div class="zst-row"><span>🥇 Selo de ouro</span><span><b style="color:${s.w / s.n >= s.p - 0.03 ? 'var(--lime)' : '#ff7a8f'}">${s.w}/${s.n} · ${Math.round(100 * s.w / s.n)}%</b> <span class="muted">prometia ${Math.round(s.p * 100)}%</span>${s.no ? ` · <b class="${s.pr >= 0 ? 'rx-pos' : 'rx-neg'}">${s.pr >= 0 ? '+' : ''}${eur2(s.pr)} €</b> <span class="muted">a 1 € (${s.no} com odd)</span>` : ''}</span></div>`
        : `<div class="zst-row"><span>🥇 Selo de ouro</span><span class="muted">ainda sem apostas de ouro decididas</span></div>`;
      box.insertAdjacentHTML('afterbegin', row);
    } catch (e) {}
    return r;
  };
})(renderZeStats);
zeLogText = (function (prev) { return function () { let t = prev.apply(this, arguments); try { const s = goldStats(); if (s && s.n) t = t.replace(/\n(erros:)/, `\nouro: ${s.w}/${s.n} p${Math.round(s.p * 100)}${s.no ? ` lucro1€ ${s.pr.toFixed(2)} n${s.no}` : ''}\n$1`); } catch (e) {} return t; }; })(zeLogText);

/* ---------- limpeza automática (o telemóvel guarda dados velhos que já não servem) ---------- */
function zeCleanup() {
  const now = Date.now(), d = 864e5; let freed = 0;
  const trim = (key, maxAge, path) => {
    try {
      const raw = localStorage.getItem(key); if (!raw) return;
      const o = JSON.parse(raw), tgt = path ? o[path] : o; if (!tgt || typeof tgt !== 'object') return;
      let ch = false;
      Object.keys(tgt).forEach(k => { const v = tgt[k]; const t = v && (v.t || v.d); if (t && now - t > maxAge) { delete tgt[k]; ch = true; } });
      if (ch) { const s = JSON.stringify(o); freed += raw.length - s.length; localStorage.setItem(key, s); }
    } catch (e) {}
  };
  try {
    const raw = localStorage.getItem(PLAYERS_KEY);
    if (raw) {
      const c = JSON.parse(raw); let ch = false;
      [['rosters', 30], ['lineups', 4], ['leagues', 20]].forEach(([k, days]) => Object.keys(c[k] || {}).forEach(id => { if (c[k][id] && now - c[k][id].t > days * d) { delete c[k][id]; ch = true; } }));
      if (ch) { const s = JSON.stringify(c); freed += raw.length - s.length; localStorage.setItem(PLAYERS_KEY, s); }
    }
  } catch (e) {}
  trim(RECENT_KEY, 5 * d);
  trim(H2H_KEY, 10 * d);
  trim(LEGLG_KEY, 90 * d);
  try { const L = scoLog(); let ch = false; Object.keys(L.picks).forEach(k => { if (now - (L.picks[k].k || L.picks[k].d || 0) > 60 * d) { delete L.picks[k]; ch = true; } }); if (ch) lsSet(SCO_KEY, L); } catch (e) {}
  try { lsSet('ze_cleanup_at', now); } catch (e) {}
  return freed;
}
setTimeout(() => { try { if (/jsdom/i.test(navigator.userAgent || '')) return; const last = lsGet('ze_cleanup_at', 0); if (Date.now() - last > 864e5) (window.requestIdleCallback || (f => setTimeout(f, 3000)))(() => zeCleanup(), { timeout: 8000 }); } catch (e) {} }, 6000);

(function () {
  try {
    const css = document.createElement('style');
    css.textContent = `.ch-selo{font-size:.76rem;line-height:1.4;margin:6px 0 2px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.05)}
.ch-selo.g{background:linear-gradient(90deg,rgba(255,200,40,.22),rgba(255,200,40,.06));border:1px solid rgba(255,200,40,.45)}
.ch-selo.s{background:rgba(200,210,230,.08);border:1px solid rgba(200,210,230,.25)}
.ch-selo.n{opacity:.75}
.gold-only .ch-card:not(.is-gold){display:none !important}
.ch-goldbtn{margin:0 0 0 auto !important;font-size:.7rem !important;padding:3px 8px !important;min-height:0 !important}
#zeChallenges .panel-h{flex-wrap:wrap;gap:6px}`;
    document.head.appendChild(css);
  } catch (e) {}
})();

/* o selo precisa das odds das casas: o Zé estuda sozinho (em segundo plano) os desafios ainda sem odds — no máximo 5, de 30 em 30 min */
let SELO_STUDY_AT = 0, SELO_STUDY_RUN = false;
async function seloAutoStudy(force) {
  if (SELO_STUDY_RUN || /jsdom/i.test(navigator.userAgent || '') || window.__ZE_LAB || navigator.onLine === false) return 0;
  if (!force && Date.now() - SELO_STUDY_AT < 60 * 60e3) return 0;   // v59: de hora a hora (menos pedidos à ESPN)
  if (typeof espnCooling === 'function' && espnCooling()) return 0;
  SELO_STUDY_RUN = true; SELO_STUDY_AT = Date.now(); let n = 0;
  try {
    const C = zeChallenges(36).filter(c => c.m.espn && c.m.espn.ev && !(studyFor(c.m) && studyFor(c.m).books && studyFor(c.m).books.length) && !(studyFor(c.m) && studyFor(c.m).oddsTried && Date.now() - studyFor(c.m).oddsTried < 3 * 3600e3)).slice(0, 3);
    for (const c of C) {
      try { await zeStudy(c.m); n++; } catch (e) {}
      if (typeof espnCooling === 'function' && espnCooling()) break;
      await new Promise(r => setTimeout(r, 2500));
    }
  } finally { SELO_STUDY_RUN = false; }
  if (n) {
    CH_MEM = null;
    try { const box = document.getElementById('zeChallenges'); if (box && !box.hidden) { box.hidden = true; zeChallengesToggle(true); } } catch (e) {}
    try { if (currentView === 'portal') renderPortal(); updateContinue(); } catch (e) {}
  }
  return n;
}
applyLive = (function (prev) { return function () { const r = prev.apply(this, arguments); setTimeout(() => seloAutoStudy().catch(() => {}), 9000); return r; }; })(applyLive);
setTimeout(() => seloAutoStudy().catch(() => {}), 15000);
