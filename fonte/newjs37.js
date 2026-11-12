/* =====================================================================
   v50 · o que a simulação de 540 jogos ensinou
   1) Com odds, confiar quase tudo nas casas: 90% em jogos europeus entre ligas diferentes, 85% no resto
   2) Prémio de qualidade para quem joga na Europa, nos jogos da liga
   3) Jogos europeus entre ligas diferentes: força relativa das ligas
   4) Golos nos jogos europeus um pouco acima
   5) «Valor» mais apertado: só ligas nacionais, odd ≤ 2,20 e valor ≤ 20%
   6) Marcadores puxados para as odds de marcador das casas
   7) Época passada carregada sozinha (arranque de época) e equipas europeias atualizadas sozinhas
   8) Margem das casas (o «IVA») à vista
   ===================================================================== */
const EURO_KEY = 'ze_euro_v1';
const ZE_TUNE = { euroQ: 0.25, leagueK: 1, euGoals: 1.1, wCross: 0.1, wDom: 0.15, valMaxOdd: 2.2, valMaxEv: 0.20 };   // afinado na simulação de 540 jogos (4 nov 2026)
const LEAGUE_COEF = { 'eng.1': 1, 'esp.1': 0.97, 'ita.1': 0.95, 'ger.1': 0.95, 'fra.1': 0.9, 'ned.1': 0.85, 'por.1': 0.85, 'bel.1': 0.8, 'tur.1': 0.79, 'eng.2': 0.78, 'sco.1': 0.74, 'aut.1': 0.74, 'cze.1': 0.74, 'gre.1': 0.74, 'den.1': 0.73, 'sui.1': 0.73, 'nor.1': 0.72, 'swe.1': 0.7 };
const LEAGUE_COEF_UNKNOWN = 0.72;
const EURO = (() => { const d = lsGet(EURO_KEY, null) || {}; return { ids: new Set((d.ids || []).map(String)), dom: d.dom || {}, t: d.t || 0 }; })();
let DOM_IDX = null, DOM_IDX_T = 0;
function zeCachesClear() { DOM_IDX = null; try { MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear(); } catch (e) {} }
/** para a simulação: lista de equipas europeias e liga de cada uma */
function zeEuroSetData(ids, dom) { EURO.ids = new Set((ids || []).map(String)); EURO.dom = dom || {}; zeCachesClear(); }
function domIndex() {
  if (DOM_IDX && Date.now() - DOM_IDX_T < 600e3) return DOM_IDX;
  const ix = new Map();
  Object.entries(EURO.dom || {}).forEach(([id, c]) => { if (c) ix.set(String(id), c); });
  try { const L = lsGet(LIVE_KEY, null); Object.entries((L && L.standings) || {}).forEach(([c, S]) => { if (/uefa|nba/.test(c)) return; ((S && S[0] && S[0].table) || []).forEach(r => { const id = String((r.team && r.team.id) || ''); if (id && !ix.has(id)) ix.set(id, c); }); }); } catch (e) {}
  try { const P = prof(); Object.keys(P.teams || {}).forEach(k => { const i = k.indexOf('|'), c = k.slice(0, i), id = k.slice(i + 1); if (!/uefa|nba/.test(c) && id && !ix.has(id)) ix.set(id, c); }); } catch (e) {}
  DOM_IDX = ix; DOM_IDX_T = Date.now();
  return ix;
}
function domOf(id) { return id == null ? null : domIndex().get(String(id)) || null; }
function isEuroTeam(id) { return id != null && EURO.ids.has(String(id)); }
function coefOf(code) { return code && LEAGUE_COEF[code] != null ? LEAGUE_COEF[code] : LEAGUE_COEF_UNKNOWN; }
/** contexto do jogo: europeu? entre ligas diferentes? uma equipa europeia contra uma que não é? */
function matchCtx(m) {
  const e = m && m.espn; if (!e || !e.code || !e.h || !e.a) return null;
  const eu = /^uefa/.test(e.code);
  if (eu) {
    const dh = domOf(e.h), da = domOf(e.a);
    return { eu: true, cross: !dh || !da || dh !== da, dh, da, coefH: coefOf(dh), coefA: coefOf(da), domEuro: null };
  }
  const eh = isEuroTeam(e.h), ea = isEuroTeam(e.a);
  return { eu: false, cross: false, domEuro: eh && !ea ? 'h' : ea && !eh ? 'a' : null };
}

/* ---------- golos esperados: qualidade, nível das ligas, golos na Europa ---------- */
const Q_NOTE = new Map();
lambdasFor = (function (prev) {
  return function (m) {
    const b = prev(m);
    try {
      const c = matchCtx(m); if (!c) return b;
      let lh = b.lh, la = b.la; const notes = [];
      if (c.domEuro && ZE_TUNE.euroQ > 0) {
        const q = ZE_TUNE.euroQ;
        if (c.domEuro === 'h') { lh *= 1 + q; la *= 1 - q / 2; } else { la *= 1 + q; lh *= 1 - q / 2; }
        notes.push(`${esc(c.domEuro === 'h' ? m.home : m.away)} joga na Europa e o adversário não → prémio de qualidade (a tabela não mostra o plantel)`);
      }
      if (c.eu && c.cross && ZE_TUNE.leagueK > 0 && Math.abs(c.coefH - c.coefA) > 0.005) {
        const r = Math.pow(c.coefH / c.coefA, ZE_TUNE.leagueK);
        lh *= r; la /= r;
        const nm = d => d ? (ESPN_LEAGUES[d] || (typeof EXTRA_LEAGUES !== 'undefined' && EXTRA_LEAGUES[d]) || d) : 'liga mais fraca';
        notes.push(`ligas diferentes (${esc(nm(c.dh))} vs ${esc(nm(c.da))}) → ${c.coefH > c.coefA ? esc(m.home) : esc(m.away)} vem de uma liga mais forte`);
      }
      if (c.eu && ZE_TUNE.euGoals !== 1) { lh *= ZE_TUNE.euGoals; la *= ZE_TUNE.euGoals; notes.push(`jogos europeus têm mais golos do que a média (+${Math.round((ZE_TUNE.euGoals - 1) * 100)}%)`); }
      if (!notes.length) { Q_NOTE.delete(mKey(m)); return b; }
      const out = { ...b, lh: +clamp(lh, 0.15, 4.5).toFixed(2), la: +clamp(la, 0.12, 4.2).toFixed(2) };
      Q_NOTE.set(mKey(m), { notes, before: [b.lh, b.la], after: [out.lh, out.la] });
      return out;
    } catch (e) { return b; }
  };
})(lambdasFor);

/* ---------- confiança no mercado por tipo de jogo ---------- */
let CUR_CTX = null;
const _learnWeightsV49 = learnWeights;
learnWeights = function () {
  const W = _learnWeightsV49();
  try {
    let w = CUR_CTX && CUR_CTX.eu && CUR_CTX.cross ? ZE_TUNE.wCross : ZE_TUNE.wDom, earned = false;
    // se o diário mostrar que o Zé bate as casas em ≥40 jogos, ganha mais peso (até 50%)
    const P = typeof diaryPro === 'function' ? diaryPro() : null;
    if (P && P.vs && P.vs.n >= 40 && P.vs.bz < P.vs.bm) { w = Math.min(0.5, w + 0.1); earned = true; }
    return { ...W, wModel: w, wEarned: earned };
  } catch (e) { return W; }
};
modelo = (function (prev) {
  return function (m) {
    const saved = CUR_CTX;
    CUR_CTX = matchCtx(m);
    try {
      const r = prev.apply(this, arguments);
      if (!r || !r.trace || r._v50) return r;
      const out = { ...r, _v50: true, trace: r.trace.map(t => t.k === 'Mercado' ? { ...t, txt: t.txt.replace(' (aprendido)', '').replace(/confio (\d+)% no mercado/, (s, n) => `confio ${n}% nas casas${CUR_CTX && CUR_CTX.eu && CUR_CTX.cross ? ' (jogo entre ligas diferentes)' : ''} <span class="muted">— testado em 540 jogos: as casas erram menos do que eu</span>`) } : t) };
      const q = Q_NOTE.get(mKey(m));
      if (q) out.trace.splice(1, 0, { k: 'Qualidade', txt: `${q.notes.join(' · ')} → <b>${q.after[0].toFixed(2)}–${q.after[1].toFixed(2)}</b>` });
      return out;
    } finally { CUR_CTX = saved; }
  };
})(modelo);

/* ---------- «valor» mais apertado ---------- */
const GATE_WHY = { eu: 'jogo europeu', odd: 'odd acima de 2,20', ev: 'valor demasiado grande para ser verdade' };
function zeValueGate(x, m) {
  const c = matchCtx(m);
  if (c && c.eu) return { ok: false, why: GATE_WHY.eu };
  if (x.o > ZE_TUNE.valMaxOdd) return { ok: false, why: GATE_WHY.odd };
  if (x.ev > ZE_TUNE.valMaxEv) return { ok: false, why: GATE_WHY.ev };
  return { ok: true };
}
oddsValue = (function (prev) {
  return function (m) {
    return prev(m).map(x => { if (!(x.ev > 0.029)) return x; const g = zeValueGate(x, m); return g.ok ? x : { ...x, ev: 0.029, ev0: x.ev, gate: g.why }; });
  };
})(oddsValue);
oddsHTML = (function (prev) {
  return function (m) {
    let h = prev(m);
    try {
      const st = studyFor(m);
      const g = oddsValue(m).filter(x => x.gate && x.ev0 > zeEdgeFor(0.03, x.o)).sort((a, b) => b.ev0 - a.ev0)[0];
      const mg = st && st.books ? st.books.filter(b => b.odds['1'] && b.odds.X && b.odds['2']).map(b => `${esc(b.provider)} ${((1 / b.odds['1'] + 1 / b.odds.X + 1 / b.odds['2'] - 1) * 100).toFixed(1).replace('.', ',')}%`) : [];
      const add = (g ? `<div class="muted" style="margin-top:4px;font-size:.8rem;">🔒 <b>${esc(marketName(g.k, m))}</b> @ ${g.o.toFixed(2)} dava +${Math.round(g.ev0 * 100)}% pelas minhas contas, mas é ${esc(g.gate)}: na simulação de 540 jogos, apostas assim perderam dinheiro. Sem valor provado.</div>` : '')
        + (mg.length ? `<div class="muted" style="margin-top:4px;font-size:.78rem;">💸 Margem das casas no 1X2 (o «IVA» delas): ${mg.join(' · ')}</div>` : '');
      if (add) { const i = h.indexOf('<div class="acts" style="margin-top:6px;">'); h = i > 0 ? h.slice(0, i) + add + h.slice(i) : h + add; }
    } catch (e) {}
    return h;
  };
})(oddsHTML);
zeDecide = (function (prev) {
  return function (m, odds, bankAvail) {
    let d = prev(m, odds, bankAvail);
    try {
      const keep = { rows: d.rows, favM: d.favM, favK: d.favK, contraSkip: d.contraSkip, doubtSkip: d.doubtSkip };
      const o = { ...odds }; let gated = null, guard = 0;
      const chk = p => zeValueGate({ k: p.k, o: p.odd, p: p.p, ev: p.ev }, m);
      while (d.pick && !chk(d.pick).ok && guard++ < 8) {
        gated = gated || { ...d.pick, why: chk(d.pick).why };
        delete o[d.pick.k];
        if (!Object.keys(o).filter(k => o[k] > 1).length) { d = { ...d, pick: null, stake: 0 }; break; }
        d = prev(m, o, bankAvail);
      }
      Object.assign(d, keep);
      (d.rows || []).forEach(x => { if (x.odd && x.ev > 0) { const g = zeValueGate({ k: x.k, o: x.odd, p: x.p, ev: x.ev }, m); if (!g.ok) x.gate = g.why; } });
      if (gated) d.gateSkip = gated;
    } catch (e) { console.warn(e); }
    return d;
  };
})(zeDecide);
zeDecidirUI = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const d = dueloAtual && dueloAtual.decision, el = document.getElementById('zeDecision');
      if (!d || !el) return r;
      el.querySelectorAll('table.mtable tbody tr').forEach(tr => {
        const lab = (tr.cells[0] && tr.cells[0].textContent || '').trim(), x = (d.rows || []).find(y => y.odd && y.label === lab);
        if (!x || !x.gate || !(x.ev > d.minEdge) || /zebra|discordo|contra o favorito/.test(tr.cells[3] ? tr.cells[3].textContent : '')) return;
        const c = tr.cells[3]; if (!c) return; c.className = ''; c.style.color = 'var(--muted)'; c.innerHTML += '<br><span style="font-size:.68rem;">🔒 sem valor provado</span>';
      });
      if (d.gateSkip) {
        const box = [...el.querySelectorAll('.reason')].find(b => /Porquê/.test(b.textContent));
        const line = `🔒 ${esc(d.gateSkip.label)} @ ${d.gateSkip.odd.toFixed(2)} dava +${(d.gateSkip.ev * 100).toFixed(1)}%, mas é ${esc(d.gateSkip.why)}. Na simulação de 540 jogos, apostas assim perderam dinheiro — não conta como valor.`;
        if (box) box.lastElementChild.insertAdjacentHTML('beforeend', '<br>' + line);
        if (!d.pick) el.querySelectorAll('.speech').forEach(sp => { sp.innerHTML = sp.innerHTML.replace(/Nenhuma destas odds tem valor ≥ [\d.]+%\./, 'Nenhuma destas odds tem valor provado (vê o «Porquê?» em baixo).'); });
      }
    } catch (e) { console.warn(e); }
    return r;
  };
})(zeDecidirUI);

/* ---------- marcadores puxados para as odds das casas ---------- */
function blendScorers(board, so) {
  if (!board || !so || !so.length) return board;
  [board.home, board.away].forEach(list => {
    (list || []).forEach(p => {
      const base = p.probZe != null ? p.probZe : p.prob;
      const o = so.find(x => nameMatch(p.name, x.name));
      if (!o || !(o.odd > 1) || p.status === 'fora' || p.status === 'lesão' || p.status === 'suplente') { if (p.probZe != null) { p.prob = p.probZe; delete p.mkt; } return; }
      const pm = Math.min(0.9, 0.85 / o.odd);   // as odds de marcador têm ~15% de margem
      p.probZe = base; p.mkt = pm; p.prob = 0.4 * base + 0.6 * pm;
    });
    (list || []).sort((a, b) => b.prob - a.prob);
  });
  board.mktBlend = true;
  return board;
}
zeStudy = (function (prev) {
  return async function (m, status) {
    const st = await prev.apply(this, arguments);
    try {
      if (st && st.scorerOdds && st.scorerOdds.length) {
        blendScorers(st.board, st.scorerOdds);
        const k = typeof boardKey === 'function' && boardKey(m);
        if (k && BOARD_MEM[k] && BOARD_MEM[k] !== st.board) blendScorers(BOARD_MEM[k], st.scorerOdds);
      }
    } catch (e) {}
    return st;
  };
})(zeStudy);

/* ---------- equipas europeias e época passada, sozinhas ---------- */
async function zeEuroRefresh(force) {
  if (!force && EURO.t && Date.now() - EURO.t < 6 * 864e5 && EURO.ids.size >= 40) return false;
  const ids = new Set(EURO.ids);
  for (const code of ['uefa.champions', 'uefa.europa', 'uefa.europa.conf']) {
    try {
      const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/teams`);
      ((((j.sports || [])[0] || {}).leagues || [])[0] || { teams: [] }).teams.forEach(t => { const id = t && t.team && t.team.id; if (id) ids.add(String(id)); });
    } catch (e) {}
  }
  try { const L = lsGet(LIVE_KEY, null); ((L && L.matches) || []).forEach(x => { if (x && x.competition && /^uefa/.test(x.competition.code || '')) { if (x.homeTeam) ids.add(String(x.homeTeam.id)); if (x.awayTeam) ids.add(String(x.awayTeam.id)); } }); } catch (e) {}
  if (ids.size < 20) return false;
  EURO.ids = ids; EURO.t = Date.now();
  lsSet(EURO_KEY, { ids: [...ids], t: EURO.t });
  zeCachesClear();
  return true;
}
async function zePrevSeasonAuto() {
  try {
    const P = prof(), now = new Date();
    const seasonStart = new Date(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1, 6, 1);
    if (P.prevLoadedAt && new Date(P.prevLoadedAt) >= seasonStart) return false;
    await profLoadPrevSeason();
    zeCachesClear();
    return true;
  } catch (e) { return false; }
}
atualizarTudo = (function (prev) {
  return async function () {
    const r = await prev.apply(this, arguments);
    if (navigator.onLine !== false && !window.__ZE_LAB) setTimeout(() => { zeEuroRefresh().catch(() => {}).then(() => zePrevSeasonAuto()).catch(() => {}); }, 4000);
    return r;
  };
})(atualizarTudo);
