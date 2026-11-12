
/* =====================================================================
   v46 · o Zé estuda sozinho e tem um diário de acertos e falhas
   1) Pré-estudo: os jogos das próximas 48 h são estudados em segundo plano (forma, ficha, odds), devagar
   2) Diário: antes de cada jogo fica gravada a «opinião final» do Zé (aposta mais segura, 1X2, golos,
      placar, odds das casas e se havia valor). Quando chega o resultado, corrige: ✅/❌, quanto acertou
      por mercado, por confiança e por liga, e quanto ganharia a seguir as apostas com valor
   3) Lições: se num mercado ele promete mais do que acerta (ex.: «Mais de 1.5» 82% → acerta 65%),
      corrige-se sozinho nesse mercado (devagar, e só com jogos suficientes)
   ===================================================================== */
const DIARY_KEY = 'ze_diary_v1';
function diaryLoad() { const d = lsGet(DIARY_KEY, null); return d && d.v === 1 ? d : { v: 1, items: {} }; }
function diarySave(d) {
  const ks = Object.keys(d.items);
  if (ks.length > 400) ks.sort((a, b) => (d.items[a].kick || '').localeCompare(d.items[b].kick || '')).slice(0, ks.length - 400).forEach(k => delete d.items[k]);
  lsSet(DIARY_KEY, d);
}
function kickOf(m) {
  const d = parseDayLabel(m.date); if (!d) return null;
  const k = new Date(d); const t = /^(\d{1,2}):(\d{2})/.exec(m.kickoff || '');
  if (t) k.setHours(+t[1], +t[2], 0, 0); else k.setHours(20, 0, 0, 0);
  return k;
}
const diaryKey = m => (m.espn && m.espn.ev) ? 'ev' + m.espn.ev : mKey(m);
const PICK_FAMILY = k => /^[OU]\d/.test(k) ? (k[0] === 'O' ? 'Mais de ' : 'Menos de ') + k.slice(1) + ' golos' : k === 'BTTS' ? 'ambas marcam' : k === 'BTTS_N' ? 'ambas marcam — não' : ['1', '2'].includes(k) ? 'vitória' : k === 'X' ? 'empate' : 'dupla hipótese';
const CONF_BAND = p => p >= 0.85 ? '85%+' : p >= 0.75 ? '75–85%' : p >= 0.65 ? '65–75%' : '55–65%';

/* ---------- 1) gravar a opinião final (até ao apito inicial) ---------- */
function diarySnap(m, d) {
  if (!m || m.past || m.aviso || !m.espn) return false;
  const kick = kickOf(m); if (!kick) return false;
  const now = Date.now();
  if (kick.getTime() <= now || kick.getTime() - now > 4 * 864e5) return false;     // só jogos dos próximos 4 dias, e só antes de começar
  let r, best;
  try { r = modelo(m); best = matchBestMarket(m); } catch (e) { return false; }
  if (!r || !r.mk) return false;
  const st = studyFor(m);
  const books = (st && st.books) || [];
  const bestOdd = k => Math.max(0, ...books.map(b => b.odds[k] || 0)) || null;
  let value = null;
  try {
    const v = oddsValue(m).filter(x => x.ev > zeEdgeFor(0.03, x.o) && x.o <= 6 && x.p >= 0.2 && !x.doubt)
      .filter(x => !isContra(x.k, favOf(r.mk), books[0] ? favOf({ '1': 1 / books[0].odds['1'], X: 1 / books[0].odds.X, '2': 1 / books[0].odds['2'] }) : null) || x.ev >= CONTRA_EDGE)[0];
    if (v) value = { k: v.k, odd: +v.o.toFixed(2), p: +v.p.toFixed(3), ev: +v.ev.toFixed(3), book: v.book };
  } catch (e) {}
  const key = diaryKey(m), D = d || diaryLoad(), old = D.items[key];
  if (old && old.res) return false;
  const pick = best ? { k: best.k, label: marketName(best.k, m), p: +best.p.toFixed(3), need: +(1.03 / best.p).toFixed(2), odd: bestOdd(best.k) } : null;
  const row = {
    key, home: m.home, away: m.away, league: m.league, code: m.espn.code, ev: m.espn.ev, kick: kick.toISOString(), t: now,
    pick, mk: Object.fromEntries(['1', 'X', '2', '1X', 'X2', 'O1.5', 'O2.5', 'O3.5', 'BTTS'].map(k => [k, +(r.mk[k] || 0).toFixed(3)])),
    cs: r.mk.cs && r.mk.cs[0] ? r.mk.cs[0].s : null, conf: r.conf || null, studied: !!st, odds1x2: books[0] ? { '1': books[0].odds['1'], X: books[0].odds.X, '2': books[0].odds['2'], book: books[0].provider } : null,
    value,
    // probabilidades antes da correção do diário (para a correção não se «corrigir a si própria»)
    mkRaw: r._dfix ? Object.fromEntries(['O1.5', 'O2.5', 'O3.5', 'BTTS'].map(k => [k, +((r.mk[k] || 0) - (r._dfix[k] || 0)).toFixed(3)])) : null
  };
  const same = o => { const { t, valueFirst, close, ...rest } = o; return JSON.stringify(rest); };
  if (old && same(old) === same(row)) return false;
  D.items[key] = row;
  if (!d) diarySave(D);
  return true;
}
function diarySnapAll() {
  const D = diaryLoad(); let n = 0;
  matches.forEach(m => { try { if (diarySnap(m, D)) n++; } catch (e) {} });
  if (n) diarySave(D);
  return n;
}

/* ---------- 2) corrigir com os resultados ---------- */
function diaryGrade(payload) {
  const fin = ((payload && payload.matches) || []).filter(x => x.status === 'FINISHED' && x.score && x.score.fullTime && x.score.fullTime.home != null);
  if (!fin.length) return 0;
  const D = diaryLoad(); let n = 0;
  Object.values(D.items).forEach(it => {
    if (it.res) return;
    const e = fin.find(x => String(x.id) === String(it.ev)) || fin.find(x => sameTeams({ home: it.home, away: it.away }, x.homeTeam.shortName || x.homeTeam.name, x.awayTeam.shortName || x.awayTeam.name) && Math.abs(new Date(x.utcDate) - new Date(it.kick)) < 2 * 864e5);
    if (!e) return;
    const i = e.score.fullTime.home, j = e.score.fullTime.away;
    const hit = k => MARKET_CONDS[k] ? (MARKET_CONDS[k](i, j) ? 1 : 0) : null;
    it.res = `${i}-${j}`; it.graded = Date.now();
    it.g = {
      pick: it.pick ? hit(it.pick.k) : null,
      fav: hit(['1', 'X', '2'].sort((a, b) => it.mk[b] - it.mk[a])[0]),
      cs: it.cs ? (it.cs === `${i}-${j}` ? 1 : 0) : null,
      o25: hit('O2.5'), btts: hit('BTTS'),
      value: it.value ? (hit(it.value.k) ? +(it.value.odd - 1).toFixed(2) : -1) : null
    };
    n++;
  });
  if (n) { diarySave(D); try { DIARY_FIX_CACHE = null; MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear(); } catch (e) {} }
  return n;
}
applyLive = (function (prev) {
  return function (payload) {
    const r = prev.apply(this, arguments);
    try { const n = diaryGrade(payload); if (n) setTimeout(() => toast(`📒 Diário: corrigi ${n} ${n > 1 ? 'jogos' : 'jogo'} — vê como o Zé se saiu (separador Zé).`), 1800); } catch (e) { console.warn(e); }
    try { diarySnapAll(); } catch (e) {}
    return r;
  };
})(applyLive);

/* ---------- 3) estatísticas e lições ---------- */
function diaryStats() {
  const all = Object.values(diaryLoad().items).filter(x => x.res && x.g);
  const S = { n: all.length, picks: { n: 0, hit: 0, exp: 0 }, fav: { n: 0, hit: 0 }, cs: { n: 0, hit: 0 }, value: { n: 0, profit: 0, hit: 0 }, byFam: {}, byBand: {}, byLeague: {}, last: [] };
  all.sort((a, b) => b.kick.localeCompare(a.kick));
  all.forEach(x => {
    if (x.pick && x.g.pick != null) {
      S.picks.n++; S.picks.hit += x.g.pick; S.picks.exp += x.pick.p;
      const f = PICK_FAMILY(x.pick.k), b = CONF_BAND(x.pick.p), l = x.league || '?';
      [[S.byFam, f], [S.byBand, b], [S.byLeague, l]].forEach(([o, k]) => { const r = o[k] = o[k] || { n: 0, hit: 0, exp: 0 }; r.n++; r.hit += x.g.pick; r.exp += x.pick.p; });
    }
    if (x.g.fav != null) { S.fav.n++; S.fav.hit += x.g.fav; }
    if (x.g.cs != null) { S.cs.n++; S.cs.hit += x.g.cs; }
    if (x.g.value != null) { S.value.n++; S.value.profit += x.g.value; S.value.hit += x.g.value > 0 ? 1 : 0; }
  });
  S.last = all.slice(0, 40);
  return S;
}
function diaryLessons(S) {
  const L = [];
  const judge = (name, r) => {
    if (!r || r.n < 15) return;                                 // com menos de 15 jogos ainda é sorte/azar
    const e = r.exp / r.n, h = r.hit / r.n, d = h - e;
    if (d <= -0.10) L.push({ bad: true, t: `«${name}»: prometo ${pct(e)} e acerto ${pct(h)} (${r.n} jogos) → estou otimista demais aqui. Já me corrijo a baixar.` });
    else if (d >= 0.10) L.push({ bad: false, t: `«${name}»: prometo ${pct(e)} e acerto ${pct(h)} (${r.n} jogos) → aqui sou prudente demais.` });
  };
  Object.entries(S.byFam).forEach(([k, r]) => judge(k, r));
  Object.entries(S.byLeague).forEach(([k, r]) => { if (r.n >= 15 && r.hit / r.n - r.exp / r.n <= -0.12) L.push({ bad: true, t: `Na <b>${esc(k)}</b> falho mais do que devia (${pct(r.hit / r.n)} de acertos para ${pct(r.exp / r.n)} prometidos, ${r.n} jogos) — desconfia de mim nesta liga.` }); });
  if (S.value.n >= 10) L.push({ bad: S.value.profit < 0, t: `Apostas com valor: ${S.value.n} · acertei ${S.value.hit} · saldo ${S.value.profit >= 0 ? '+' : ''}${S.value.profit.toFixed(2)} unidades (1 unidade por aposta) → ${S.value.profit >= 0 ? 'o método está a dar lucro' : 'por agora está a perder — normal em amostras pequenas, mas fico mais exigente'}.` });
  if (!L.length) L.push({ bad: false, t: S.picks.n < 15 ? 'Ainda tenho poucos jogos corrigidos para tirar lições (preciso de 15 por mercado). Cada «Atualizar» depois dos jogos conta.' : 'Nada fora do normal: o que prometo bate certo com o que acerto.' });
  return L;
}
/* correção automática por mercado de golos (Mais/Menos e Ambas marcam): só com 25+ jogos e no máximo ±6 pontos */
let DIARY_FIX_CACHE = null;
function diaryFix() {
  if (DIARY_FIX_CACHE && Date.now() - DIARY_FIX_CACHE.t < 60e3) return DIARY_FIX_CACHE.f;
  const all = Object.values(diaryLoad().items).filter(x => x.res && x.g && x.mk);
  const f = {};
  [['O1.5', (i, j) => i + j > 1.5], ['O2.5', (i, j) => i + j > 2.5], ['O3.5', (i, j) => i + j > 3.5], ['BTTS', (i, j) => i > 0 && j > 0]].forEach(([k, c]) => {
    const pr = x => (x.mkRaw && x.mkRaw[k] != null ? x.mkRaw[k] : x.mk[k]);
    const xs = all.filter(x => pr(x) != null);
    if (xs.length < 25) return;                                // com menos jogos é ruído, não lição
    const exp = xs.reduce((a, x) => a + pr(x), 0) / xs.length;
    const hit = xs.reduce((a, x) => { const [i, j] = x.res.split('-').map(Number); return a + (c(i, j) ? 1 : 0); }, 0) / xs.length;
    const w = Math.min(1, xs.length / 100);                   // confia mais à medida que junta jogos (100 jogos = confiança total)
    f[k] = clamp((hit - exp) * w, -0.06, 0.06);
  });
  DIARY_FIX_CACHE = { t: Date.now(), f };
  return f;
}
modelo = (function (prev) {
  return function (m) {
    const r = prev.apply(this, arguments);
    try {
      const f = diaryFix(); const ks = Object.keys(f).filter(k => Math.abs(f[k]) >= 0.005);
      if (!ks.length || !r || !r.mk || r._dfix) return r;
      const mk = { ...r.mk };
      ks.forEach(k => { if (mk[k] == null) return; mk[k] = clamp(mk[k] + f[k], 0.02, 0.98); });
      [1.5, 2.5, 3.5].forEach(l => { if (mk['O' + l] != null) mk['U' + l] = 1 - mk['O' + l]; });
      if (mk.BTTS != null) mk.BTTS_N = 1 - mk.BTTS;
      const out = { ...r, mk, _dfix: f };
      if (out.trace) out.trace = out.trace.concat([{ k: 'Diário', txt: 'Corrigi com os meus acertos/falhas: ' + ks.map(k => `${marketName(k, m)} ${f[k] > 0 ? '+' : ''}${Math.round(f[k] * 100)} pts`).join(' · ') }]);
      return out;
    } catch (e) { return r; }
  };
})(modelo);

/* ---------- 4) painel «📒 Diário do Zé» ---------- */
function diaryHTML() {
  const S = diaryStats(), pend = Object.values(diaryLoad().items).filter(x => !x.res).sort((a, b) => a.kick.localeCompare(b.kick));
  const rate = (h, n) => n ? `${Math.round(h / n * 100)}%` : '—';
  const head = S.picks.n
    ? `<div class="kv"><span>Aposta mais segura (a do «jogo do dia»)</span><b>${S.picks.hit}/${S.picks.n} · ${rate(S.picks.hit, S.picks.n)} <span class="muted" style="font-weight:400;">(prometia ${rate(S.picks.exp, S.picks.n)})</span></b></div>
       <div class="kv"><span>Favorito do 1X2 ganhou</span><b>${rate(S.fav.hit, S.fav.n)} <span class="muted" style="font-weight:400;">(${S.fav.n} j)</span></b></div>
       <div class="kv"><span>Placar exato</span><b>${S.cs.hit}/${S.cs.n}</b></div>
       <div class="kv"><span>Apostas com valor (1 unidade cada)</span><b>${S.value.n ? `${S.value.hit}/${S.value.n} · ${S.value.profit >= 0 ? '+' : ''}${S.value.profit.toFixed(2)} u` : '—'}</b></div>`
    : '<div class="muted">Ainda não há jogos corrigidos. O Zé grava a opinião antes de cada jogo e corrige quando carregas em 📡 Atualizar depois do apito final.</div>';
  const tbl = (title, o) => { const e = Object.entries(o).filter(([, r]) => r.n).sort((a, b) => b[1].n - a[1].n).slice(0, 8); return e.length ? `<div style="margin-top:8px;"><b>${title}</b>${e.map(([k, r]) => { const d = r.hit / r.n - r.exp / r.n; return `<div class="kv"><span>${esc(k)}</span><b>${r.hit}/${r.n} · ${rate(r.hit, r.n)} <span style="font-weight:400;color:${d <= -0.08 ? 'var(--red, #ff6b6b)' : d >= 0.08 ? 'var(--lime)' : 'var(--muted)'};">(prometia ${rate(r.exp, r.n)})</span></b></div>`; }).join('')}</div>` : ''; };
  const lessons = diaryLessons(S).map(l => `<div style="margin-top:4px;">${l.bad ? '⚠️' : '💡'} ${l.t}</div>`).join('');
  const fix = diaryFix(), fk = Object.keys(fix).filter(k => Math.abs(fix[k]) >= 0.005);
  const last = S.last.slice(0, 15).map(x => `<div style="display:flex;gap:6px;align-items:flex-start;padding:5px 0;border-top:1px solid var(--line2);font-size:.82rem;">
      <span>${x.g.pick == null ? '•' : x.g.pick ? '✅' : '❌'}</span>
      <span style="flex:1;"><b>${esc(x.home)} ${esc(x.res)} ${esc(x.away)}</b> <span class="muted">${esc(x.league || '')}</span><br>
      ${x.pick ? `${esc(x.pick.label)} ${pct(x.pick.p)}` : 'sem aposta segura'}${x.cs ? ` · placar previsto ${esc(x.cs)}${x.g.cs ? ' 🎯' : ''}` : ''}${x.value ? ` · valor: ${esc(marketName(x.value.k, x))} @ ${x.value.odd} ${x.g.value > 0 ? '✅' : '❌'}` : ''}</span></div>`).join('');
  const next = pend.slice(0, 8).map(x => `<div style="font-size:.8rem;padding:3px 0;">⏳ ${esc(x.home)} vs ${esc(x.away)} — ${x.pick ? `${esc(x.pick.label)} ${pct(x.pick.p)}` : 'sem aposta segura'}${x.value ? ` · 💶 valor em ${esc(marketName(x.value.k, x))} @ ${x.value.odd}` : ''}${x.studied ? ' 🧠' : ''}</div>`).join('');
  return `${head}${tbl('Por mercado', S.byFam)}${tbl('Por confiança', S.byBand)}${tbl('Por liga', S.byLeague)}
    <div style="margin-top:10px;"><b>📚 Lições</b>${lessons}${fk.length ? `<div class="muted" style="margin-top:4px;font-size:.8rem;">Correções automáticas em uso: ${fk.map(k => `${k} ${fix[k] > 0 ? '+' : ''}${Math.round(fix[k] * 100)} pts`).join(' · ')}</div>` : ''}</div>
    ${pend.length ? `<div style="margin-top:10px;"><b>🔒 Opiniões gravadas (à espera do resultado)</b>${next}</div>` : ''}
    ${last ? `<div style="margin-top:10px;"><b>Últimos jogos corrigidos</b>${last}</div>` : ''}
    <div class="muted" style="font-size:.74rem;margin-top:8px;">A opinião fica fechada no apito inicial — o Zé não pode «mudar de ideias» depois. ✅/❌ é a aposta mais segura; 🎯 = placar certo; 🧠 = estudado a fundo (forma, ficha, odds).</div>`;
}
function renderDiary() {
  const host = document.getElementById('assistenteBox'); if (!host) return;
  let p = document.getElementById('diaryPanel');
  if (!p) { host.insertAdjacentHTML('afterend', '<div class="panel" id="diaryPanel" style="margin-top:12px;"><div class="panel-h"><span>📒 Diário do Zé — acertos e falhas</span><span class="muted">opinião gravada antes do jogo</span></div><div class="panel-b" id="diaryBox"></div></div>'); p = document.getElementById('diaryPanel'); }
  const b = document.getElementById('diaryBox'); if (b) b.innerHTML = diaryHTML();
}
fmGo = (function (prev) { return function (view) { const r = prev.apply(this, arguments); try { if (view === 'ze') renderDiary(); } catch (e) { console.warn(e); } return r; }; })(fmGo);
zeTalk = (function (prev) {
  return function (raw, opts) {
    const q = normTxt(raw);
    if (/\b(diario|acertos?|falhas?|como (estas|andas) a acertar|taxa de acerto|quantas acertaste|historico de previs|registo)\b/.test(q) && !/aposta (minha|tua)/.test(q)) {
      const S = diaryStats();
      const L = diaryLessons(S).slice(0, 3).map(l => `${l.bad ? '⚠️' : '💡'} ${l.t}`).join('<br>');
      return { mood: S.picks.n && S.picks.hit / S.picks.n >= S.picks.exp / S.picks.n - 0.05 ? 'feliz' : 'pensativo', html: S.picks.n
        ? `📒 <b>Diário</b>: aposta mais segura ${S.picks.hit}/${S.picks.n} (${pct(S.picks.hit / S.picks.n)}, prometia ${pct(S.picks.exp / S.picks.n)}) · favorito ${S.fav.n ? pct(S.fav.hit / S.fav.n) : '—'} · placar exato ${S.cs.hit}/${S.cs.n}${S.value.n ? ` · valor ${S.value.profit >= 0 ? '+' : ''}${S.value.profit.toFixed(2)} u em ${S.value.n}` : ''}.<br>${L}<br><span class="muted">Tens tudo no painel 📒 Diário (separador Zé).</span>`
        : `📒 Ainda não corrigi jogos. Já tenho ${Object.keys(diaryLoad().items).length} opiniões gravadas — depois do apito final carrega em 📡 Atualizar e eu corrijo-me.` };
    }
    return prev(raw, opts);
  };
})(zeTalk);

/* ---------- 5) pré-estudo das próximas 48 h (em segundo plano, com calma) ---------- */
let PRE_RUNNING = false, PRE_NEWS_OFF = false;
zeNews = (function (prev) {
  return function (m) { if (PRE_NEWS_OFF) return Promise.resolve({ t: Date.now(), items: [], signals: [], editions: [], skipped: true }); return prev.apply(this, arguments); };
})(zeNews);
async function preStudy() {
  if (PRE_RUNNING || /jsdom/i.test(navigator.userAgent || '') || navigator.onLine === false) return 0;
  PRE_RUNNING = true; let n = 0;
  try {
    const now = Date.now();
    const list = matches.filter(m => !m.past && !m.aviso && m.espn && m.espn.ev).map(m => ({ m, k: kickOf(m) }))
      .filter(x => x.k && x.k.getTime() > now && x.k.getTime() - now < 48 * 3600e3)
      .sort((a, b) => (scoreMatch(b.m) - scoreMatch(a.m)) || (a.k - b.k)).slice(0, 14);
    for (const { m } of list) {
      if (document.visibilityState === 'hidden') break;
      if (typeof espnCooling === 'function' && espnCooling()) break;
      const st = studyFor(m);
      if (st && st.books != null && Date.now() - st.t < 40 * 60e3) continue;
      PRE_NEWS_OFF = true;
      try { await zeStudy(m); n++; } catch (e) {} finally { PRE_NEWS_OFF = false; }
      const s2 = studyFor(m); if (s2 && s2.news && s2.news.skipped) delete s2.news;     // as notícias lêem-se quando abrires o jogo
      try { diarySnap(m); } catch (e) {}
      await new Promise(r => setTimeout(r, 6000));
    }
    if (n) { try { if (currentView === 'dia' && typeof gerarDia === 'function') gerarDia(); if (currentView === 'portal') renderPortal(); } catch (e) {} }
  } finally { PRE_RUNNING = false; }
  return n;
}
atualizarTudo = (function (prev) {
  return async function (opts) {
    const r = await prev.apply(this, arguments);
    try { diarySnapAll(); } catch (e) {}
    setTimeout(() => { preStudy().then(n => { if (n) { diarySnapAll(); toast(`🧠 O Zé estudou ${n} ${n > 1 ? 'jogos' : 'jogo'} das próximas 48 h (forma, ficha e odds).`); } }).catch(() => {}); }, window.__calRunning ? 30000 : 4000);
    return r;
  };
})(atualizarTudo);
/* jogo estudado em segundo plano: ao abrir, vai buscar as notícias que faltam */
openModal = (function (prev) {
  return function (m) {
    const r = prev.apply(this, arguments);
    try {
      const st = studyFor(m);
      if (st && !st.news && !st.offline) zeNews(m).then(n => { st.news = n; const b = document.getElementById('studyBox'); if (b && window._modalMatch === m) b.innerHTML = reasoningHTML(m); }).catch(() => {});
    } catch (e) {}
    return r;
  };
})(openModal);
/* «jogo do dia»: marca os jogos já estudados a fundo */
setTimeout(() => { try { diarySnapAll(); } catch (e) {} }, 2500);
/* histórico que já existia (previsões guardadas desde a v26): entra no diário para não começar do zero */
(function diaryBackfill() {
  try {
    const P = lsGet(PRED_KEY, {}), D = diaryLoad(); let n = 0;
    Object.entries(P).forEach(([k, p]) => {
      if (!p.done || !p.res || D.items['pred:' + k]) return;
      if (Object.values(D.items).some(x => x.home === p.home && x.away === p.away && Math.abs(new Date(x.kick) - new Date(p.day)) < 2 * 864e5)) return;
      const [i, j] = p.res.split('-').map(Number); if (!isFinite(i) || !isFinite(j)) return;
      const mk = { '1': p.p1, X: p.pX, '2': p.p2, '1X': p.p1 + p.pX, X2: p.pX + p.p2, 'O2.5': p.pO25, 'U2.5': 1 - p.pO25, BTTS: p.pBTTS };
      const best = ['1', '1X', 'O2.5', 'BTTS', 'U2.5', 'X2', '2'].map(kk => ({ k: kk, p: mk[kk] })).filter(o => o.p >= 0.55 && o.p <= 0.85).sort((a, b) => b.p - a.p)[0];
      const hit = kk => (MARKET_CONDS[kk](i, j) ? 1 : 0);
      D.items['pred:' + k] = { key: 'pred:' + k, home: p.home, away: p.away, league: p.league, kick: p.day, t: p.t, backfill: true,
        pick: best ? { k: best.k, label: marketName(best.k, p), p: +best.p.toFixed(3), need: +(1.03 / best.p).toFixed(2) } : null,
        mk: Object.fromEntries(Object.entries(mk).map(([a, b]) => [a, +b.toFixed(3)])), cs: null, res: p.res,
        g: { pick: best ? hit(best.k) : null, fav: hit(['1', 'X', '2'].sort((a, b) => mk[b] - mk[a])[0]), cs: null, o25: hit('O2.5'), btts: hit('BTTS'), value: null } };
      n++;
    });
    if (n) diarySave(D);
  } catch (e) { console.warn(e); }
})();
