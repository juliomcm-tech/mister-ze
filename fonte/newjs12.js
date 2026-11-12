/* =====================================================================
   v27 · O ZÉ PENSA: estudo do jogo (forma, ficha, mercado, H2H),
   raciocínio visível e aprendizagem com as próprias previsões.
   ===================================================================== */
const STUDY = {};
const RECENT_KEY = 'ze_recent_v1', LEARN_KEY = 'ze_learn_v1', PRED_KEY = 'ze_preds_v1';
function mKey(m) { return normTxt(m.home) + '|' + normTxt(m.away) + '|' + m.date; }
function studyFor(m) { const s = STUDY[mKey(m)]; return s && Date.now() - s.t < 45 * 60e3 ? s : null; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

/* ---------- Matéria-prima ---------- */
function american(x) {
  if (x == null) return null;
  const s = String(x).trim();
  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 1 && Number(s) < 50 && !/^\d{3,}$/.test(s)) return Number(s); // já é decimal
  const v = Number(s.replace('+', ''));
  if (!isFinite(v) || v === 0) return null;
  return v > 0 ? 1 + v / 100 : 1 + 100 / Math.abs(v);
}
function sideOdd(o) {
  if (!o) return null;
  if (typeof o === 'number' || typeof o === 'string') return american(o);
  if (o.odds && (o.odds.value || o.odds.decimal)) return Number(o.odds.decimal || o.odds.value);
  if (o.moneyLine != null) return american(o.moneyLine);
  if (o.current && o.current.moneyLine) return american(o.current.moneyLine.american || o.current.moneyLine.value);
  if (o.close && o.close.moneyLine) return american(o.close.moneyLine.american || o.close.moneyLine.value);
  return null;
}
/** Odds publicadas na ficha (pickcenter/odds) → probabilidades sem margem */
function parseMarket(summary) {
  const items = [].concat(summary.pickcenter || [], summary.odds || []);
  for (const it of items) {
    const h = sideOdd(it.homeTeamOdds), a = sideOdd(it.awayTeamOdds), d = sideOdd(it.drawOdds);
    if (!(h > 1 && a > 1 && d > 1)) continue;
    const s = 1 / h + 1 / d + 1 / a;
    const out = { provider: (it.provider && it.provider.name) || 'casa de apostas', odds: { '1': h, X: d, '2': a }, p1: (1 / h) / s, pX: (1 / d) / s, p2: (1 / a) / s, margin: s - 1 };
    const ou = Number(it.overUnder), oo = sideOdd(it.overOdds), uo = sideOdd(it.underOdds);
    if (ou === 2.5 && oo > 1 && uo > 1) { const t = 1 / oo + 1 / uo; out.pO25 = (1 / oo) / t; out.odds['O2.5'] = oo; out.odds['U2.5'] = uo; }
    return out;
  }
  return null;
}
function parseH2H(summary, m) {
  const blocks = summary.headToHeadGames || [];
  const games = [];
  blocks.forEach(b => (b.events || []).forEach(e => {
    const hs = Number(e.homeTeamScore), as = Number(e.awayTeamScore);
    if (!isFinite(hs) || !isFinite(as)) return;
    games.push({ d: e.gameDate, hId: String(e.homeTeamId || ''), hs, as });
  }));
  if (!games.length) return null;
  const uniq = []; const seen = new Set();
  games.forEach(g => { const k = g.d + g.hs + g.as; if (!seen.has(k)) { seen.add(k); uniq.push(g); } });
  uniq.sort((a, b) => new Date(b.d) - new Date(a.d));
  const last = uniq.slice(0, 6);
  let w = 0, dr = 0, l = 0, goals = 0, btts = 0;
  last.forEach(g => {
    const homeIsH = g.hId === String(m.espn.h);
    const gf = homeIsH ? g.hs : g.as, ga = homeIsH ? g.as : g.hs;
    if (gf > ga) w++; else if (gf === ga) dr++; else l++;
    goals += g.hs + g.as; if (g.hs > 0 && g.as > 0) btts++;
  });
  return { n: last.length, w, d: dr, l, avgGoals: goals / last.length, btts: btts / last.length };
}
async function teamRecent(code, id) {
  const cache = lsGet(RECENT_KEY, {});
  const k = code + '|' + id;
  if (cache[k] && Date.now() - cache[k].t < 12 * 3600e3) return cache[k].v;
  const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/teams/${id}/schedule`);
  const v = (j.events || []).map(ev => normalizeEspn(ev, code, '')).filter(x => x && x.status === 'FINISHED')
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate)).slice(0, 10)
    .map(x => { const home = x.homeTeam.id === String(id); return { home, gf: home ? x.score.fullTime.home : x.score.fullTime.away, ga: home ? x.score.fullTime.away : x.score.fullTime.home, d: x.utcDate, opp: home ? x.awayTeam.shortName : x.homeTeam.shortName }; });
  cache[k] = { t: Date.now(), v };
  const keys = Object.keys(cache); if (keys.length > 80) delete cache[keys[0]];
  lsSet(RECENT_KEY, cache);
  return v;
}

/** Estudo completo de um jogo (só com internet; fica 45 min em memória) */
async function zeStudy(m, status) {
  status = status || (() => {});
  if (!m.espn) {
    status('🌐 A procurar o jogo nos dados de hoje…');
    try { await atualizarTudo({ quiet: true }); } catch (e) {}
    const again = matches.find(x => x.home === m.home && x.away === m.away && x.date === m.date);
    if (again && again.espn) m.espn = again.espn;
  }
  const st = { t: Date.now(), m: { home: m.home, away: m.away }, sources: [] };
  if (!m.espn) { st.offline = true; STUDY[mKey(m)] = st; return st; }
  const { code, h, a, ev } = m.espn;
  status('📈 Forma recente das duas equipas…');
  const [rh, ra, summ] = await Promise.all([
    teamRecent(code, h).catch(() => null),
    teamRecent(code, a).catch(() => null),
    ev ? fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/summary?event=${ev}`).catch(() => null) : Promise.resolve(null)
  ]);
  st.recentH = rh; st.recentA = ra;
  if (summ) {
    st.market = parseMarket(summ);
    st.h2h = parseH2H(summ, m);
  }
  status('📋 Ficha do jogo e marcadores…');
  try { st.board = await playerBoard(m); } catch (e) {}
  STUDY[mKey(m)] = st;
  MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear();
  return st;
}

/* ---------- Mercado → golos esperados equivalentes ---------- */
/* probabilidade «justa» de Mais numa linha de golos: .5 normal; inteira = sem contar o reembolso; .25/.75 = meia-meia (asiática) */
function ouValue(M, L) {
  const v = x => { if (Math.abs(x - Math.round(x)) < 1e-9) { const a = mprob(M, (i, j) => i + j > x), b = mprob(M, (i, j) => i + j < x); return a + b > 0 ? a / (a + b) : 0.5; } return mprob(M, (i, j) => i + j > x); };
  const f = L - Math.floor(L);
  return Math.abs(f - 0.25) < 1e-6 || Math.abs(f - 0.75) < 1e-6 ? (v(L - 0.25) + v(L + 0.25)) / 2 : v(L);
}
function fitLambdas(p1, pX, p2, pO) {
  let best = null;
  for (let lh = 0.2; lh <= 3.6; lh += 0.05) for (let la = 0.15; la <= 3.2; la += 0.05) {
    const M = scoreMatrix(lh, la, 8);
    const q1 = mprob(M, (i, j) => i > j), q2 = mprob(M, (i, j) => i < j), qX = 1 - q1 - q2;
    let err = (q1 - p1) ** 2 + (qX - pX) ** 2 + (q2 - p2) ** 2;
    if (pO != null && typeof pO === 'object') err += 0.7 * (ouValue(M, pO.line) - pO.p) ** 2;
    else if (pO != null) err += 0.7 * (mprob(M, (i, j) => i + j > 2.5) - pO) ** 2;
    if (!best || err < best.err) best = { lh, la, err };
  }
  return best;
}

/* ---------- Aprendizagem ---------- */
function learnLoad() { return lsGet(LEARN_KEY, { v: 1, n: 0, nMkt: 0, bModel: 0, bMkt: 0, bBase: 0, bO25: 0, bBTTS: 0, nO: 0, bins: { '1X2': {}, O25: {}, BTTS: {} }, byLeague: {}, log: [] }); }
function learnWeights() {
  const L = learnLoad();
  const wModel = L.nMkt >= 8 ? clamp((L.bMkt / L.nMkt) / ((L.bModel / L.n) + (L.bMkt / L.nMkt)), 0.25, 0.75) : 0.45;
  const skill = L.n >= 15 ? 1 - (L.bModel / L.n) / (L.bBase / L.n) : null;   // >0 = melhor que «adivinhar a média»
  const k = skill == null ? 1 : skill < 0 ? 0.7 : skill < 0.03 ? 0.85 : 1;  // encolher se for excesso de confiança
  return { wModel, skill, k, L };
}
function shrinkMk(mk, k) {
  if (k >= 0.999) return mk;
  const o = { ...mk };
  const b = [o['1'], o['X'], o['2']].map(p => 1 / 3 + (p - 1 / 3) * k), s = b[0] + b[1] + b[2];
  o['1'] = b[0] / s; o['X'] = b[1] / s; o['2'] = b[2] / s;
  o['1X'] = o['1'] + o['X']; o['X2'] = o['X'] + o['2']; o['12'] = o['1'] + o['2'];
  ['O0.5', 'O1.5', 'O2.5', 'O3.5', 'O4.5', 'BTTS'].forEach(key => { if (o[key] != null) o[key] = 0.5 + (o[key] - 0.5) * k; });
  [0.5, 1.5, 2.5, 3.5, 4.5].forEach(l => { o['U' + l] = 1 - o['O' + l]; });
  o['BTTS_N'] = 1 - o['BTTS'];
  return o;
}
function snapshotPred(m, r) {
  if (m.past || m.aviso) return;
  const d = parseDayLabel(m.date); if (!d) return;
  const days = daysFromToday(d); if (days < 0 || days > 4) return;
  const P = lsGet(PRED_KEY, {});
  const k = mKey(m);
  const st = studyFor(m);
  const row = { t: Date.now(), home: m.home, away: m.away, date: m.date, league: m.league, day: d.toISOString(), p1: +r.mk['1'].toFixed(4), pX: +r.mk['X'].toFixed(4), p2: +r.mk['2'].toFixed(4), pO25: +r.mk['O2.5'].toFixed(4), pBTTS: +r.mk['BTTS'].toFixed(4), mkt: st && st.market ? { p1: +st.market.p1.toFixed(4), pX: +st.market.pX.toFixed(4), p2: +st.market.p2.toFixed(4) } : (P[k] && P[k].mkt) || null };
  const old = P[k];
  if (old && old.done) return;
  if (old && Math.abs(old.p1 - row.p1) < 0.01 && Math.abs(old.pO25 - row.pO25) < 0.01 && (!!old.mkt === !!row.mkt)) return;
  P[k] = row;
  const keys = Object.keys(P); if (keys.length > 300) keys.sort((a, b) => P[a].t - P[b].t).slice(0, keys.length - 300).forEach(x => delete P[x]);
  lsSet(PRED_KEY, P);
}
function learnFromResults(payload) {
  const fin = (payload.matches || []).filter(x => x.status === 'FINISHED' && x.score && x.score.fullTime && x.score.fullTime.home != null);
  if (!fin.length) return 0;
  const P = lsGet(PRED_KEY, {}), L = learnLoad();
  let n = 0;
  Object.keys(P).forEach(k => {
    const p = P[k];
    if (p.done) return;
    const e = fin.find(x => sameTeams({ home: p.home, away: p.away }, x.homeTeam.shortName || x.homeTeam.name, x.awayTeam.shortName || x.awayTeam.name) && Math.abs(new Date(x.utcDate) - new Date(p.day)) < 3 * 864e5);
    if (!e) return;
    const hg = e.score.fullTime.home, ag = e.score.fullTime.away;
    const o = [hg > ag ? 1 : 0, hg === ag ? 1 : 0, hg < ag ? 1 : 0];
    const brier = (q) => (q[0] - o[0]) ** 2 + (q[1] - o[1]) ** 2 + (q[2] - o[2]) ** 2;
    const bm = brier([p.p1, p.pX, p.p2]);
    L.n++; L.bModel += bm; L.bBase += brier([0.45, 0.27, 0.28]);
    if (p.mkt) { L.nMkt++; L.bMkt += brier([p.mkt.p1, p.mkt.pX, p.mkt.p2]); }
    const over = hg + ag > 2.5 ? 1 : 0, btts = hg > 0 && ag > 0 ? 1 : 0;
    L.nO++; L.bO25 += (p.pO25 - over) ** 2; L.bBTTS += (p.pBTTS - btts) ** 2;
    const bin = (mk, q, hit) => { const b = String(Math.min(9, Math.floor(q * 10))); const r = L.bins[mk][b] = L.bins[mk][b] || { n: 0, h: 0, s: 0 }; r.n++; r.h += hit; r.s += q; };
    const fav = [p.p1, p.pX, p.p2].indexOf(Math.max(p.p1, p.pX, p.p2));
    bin('1X2', Math.max(p.p1, p.pX, p.p2), o[fav]); bin('O25', p.pO25, over); bin('BTTS', p.pBTTS, btts);
    const lg = L.byLeague[p.league] = L.byLeague[p.league] || { n: 0, b: 0, hit: 0 };
    lg.n++; lg.b += bm; lg.hit += o[fav];
    L.log.unshift({ k: `${p.home} ${hg}-${ag} ${p.away}`, fav: ['1', 'X', '2'][fav], p: Math.max(p.p1, p.pX, p.p2), hit: o[fav] });
    L.log = L.log.slice(0, 30);
    p.done = true; p.res = `${hg}-${ag}`; n++;
  });
  if (n) { lsSet(PRED_KEY, P); lsSet(LEARN_KEY, L); MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear(); }
  return n;
}

/* ---------- O modelo, agora com estudo + aprendizagem ---------- */
const ZE_MODEL_CACHE = new Map();
const _modeloBaseV26 = modelo;
modelo = function (m) {
  const st = studyFor(m);
  const W = learnWeights();
  const ck = mKey(m) + '|' + (m.lambdas ? m.lambdas.lh + '/' + m.lambdas.la : '') + '|' + (st ? st.t : 0) + '|' + W.L.n + '|' + W.L.nMkt;
  if (ZE_MODEL_CACHE.has(ck)) return ZE_MODEL_CACHE.get(ck);
  const base = _modeloBaseV26(m);
  let lh = base.lh, la = base.la;
  const trace = [{ k: 'Base', txt: `${base.src === 'API casa/fora' ? 'Tabelas casa/fora reais' : base.src === 'dossiê calibrado' ? 'Probabilidade do dossiê' : 'Ratings do dossiê'} → golos esperados <b>${base.lh.toFixed(2)}–${base.la.toFixed(2)}</b>` }];
  const sources = [base.src];
  const [avgH, avgA] = leagueAvg(m.league);
  if (st && st.recentH && st.recentA) {
    const hHome = st.recentH.filter(g => g.home), aAway = st.recentA.filter(g => !g.home);
    const rate = (L, f) => L.length ? L.reduce((s, g) => s + g[f], 0) / L.length : null;
    const sh = (x, n) => (x * n + 5) / (n + 5);
    const attH = sh((rate(hHome, 'gf') ?? avgH) / avgH, hHome.length), defH = sh((rate(hHome, 'ga') ?? avgA) / avgA, hHome.length);
    const attA = sh((rate(aAway, 'gf') ?? avgA) / avgA, aAway.length), defA = sh((rate(aAway, 'ga') ?? avgH) / avgH, aAway.length);
    const lhR = avgH * attH * defA, laR = avgA * attA * defH;
    const nlh = Math.pow(lh, 0.65) * Math.pow(lhR, 0.35), nla = Math.pow(la, 0.65) * Math.pow(laR, 0.35);
    const fmt = (L) => L.slice(0, 5).map(g => g.gf > g.ga ? 'V' : g.gf === g.ga ? 'E' : 'D').join('');
    trace.push({ k: 'Forma', txt: `${esc(m.home)} em casa: ${rate(hHome, 'gf') != null ? rate(hHome, 'gf').toFixed(1) : '—'} marcados / ${rate(hHome, 'ga') != null ? rate(hHome, 'ga').toFixed(1) : '—'} sofridos (${hHome.length} j.) · ${esc(m.away)} fora: ${rate(aAway, 'gf') != null ? rate(aAway, 'gf').toFixed(1) : '—'} / ${rate(aAway, 'ga') != null ? rate(aAway, 'ga').toFixed(1) : '—'} (${aAway.length} j.) · forma ${fmt(st.recentH)} vs ${fmt(st.recentA)} → <b>${nlh.toFixed(2)}–${nla.toFixed(2)}</b> ${arrow(nlh - lh)}${arrow(nla - la)}` });
    lh = nlh; la = nla; sources.push('forma');
  }
  if (st && st.board) {
    const miss = (list) => list.filter(p => p.goals >= 2 && (p.status === 'fora' || p.status === 'lesão')).reduce((s, p) => s + p.share, 0);
    const mh = miss(st.board.home), ma = miss(st.board.away);
    const kh = clamp(1 - 0.6 * mh, 0.7, 1), ka = clamp(1 - 0.6 * ma, 0.7, 1);
    const who = (list) => list.filter(p => p.goals >= 2 && (p.status === 'fora' || p.status === 'lesão')).map(p => `${esc(p.name)} (${p.goals} golos)`).join(', ');
    if (kh < 0.995 || ka < 0.995) {
      trace.push({ k: 'Ausências', txt: `${kh < 0.995 ? `${esc(m.home)} sem ${who(st.board.home)} → −${Math.round((1 - kh) * 100)}% golos` : ''}${kh < 0.995 && ka < 0.995 ? ' · ' : ''}${ka < 0.995 ? `${esc(m.away)} sem ${who(st.board.away)} → −${Math.round((1 - ka) * 100)}% golos` : ''}` });
      lh *= kh; la *= ka;
    } else trace.push({ k: 'Ficha', txt: st.board.lineupKnown ? 'Onzes publicados: os marcadores principais jogam ✓' : 'Onzes ainda não saíram; sem lesões relevantes nos marcadores' });
    sources.push('ficha');
  }
  if (st && st.market) {
    const mk = st.market, fit = fitLambdas(mk.p1, mk.pX, mk.p2, mk.ou || mk.pO25);
    const w = W.wModel;
    const nlh = w * lh + (1 - w) * fit.lh, nla = w * la + (1 - w) * fit.la;
    trace.push({ k: 'Mercado', txt: `${esc(mk.provider)}: 1 ${pct(mk.p1)} · X ${pct(mk.pX)} · 2 ${pct(mk.p2)}${mk.pO25 != null ? ` · Over 2.5 ${pct(mk.pO25)}` : mk.ou ? ` · Mais de ${String(mk.ou.line).replace('.', ',')} ${pct(mk.ou.p)}` : ''} (margem ${(mk.margin * 100).toFixed(1)}%) → confio ${Math.round((1 - w) * 100)}% no mercado${W.L.nMkt >= 8 ? ' (aprendido)' : ''} → <b>${nlh.toFixed(2)}–${nla.toFixed(2)}</b>` });
    lh = nlh; la = nla; sources.push('mercado');
  }
  if (st && st.h2h && st.h2h.n >= 2) {
    const h = st.h2h;
    trace.push({ k: 'Confronto', txt: `Últimos ${h.n}: ${esc(m.home)} ${h.w}V ${h.d}E ${h.l}D · ${h.avgGoals.toFixed(1)} golos/jogo · ambas marcaram em ${Math.round(h.btts * 100)}% <span class="muted">(peso pequeno — plantéis mudam)</span>` });
    const tot = lh + la, adj = clamp(1 + (h.avgGoals - tot) / tot * 0.08 * Math.min(1, h.n / 5), 0.94, 1.06);
    lh *= adj; la *= adj; sources.push('h2h');
  }
  const M = scoreMatrix(lh, la, 10);
  let mk = marketsFrom(M);
  const rawMk = mk;
  if (W.k < 0.999) { mk = shrinkMk(mk, W.k); trace.push({ k: 'Humildade', txt: `As minhas últimas ${W.L.n} previsões foram ${W.skill < 0 ? 'piores' : 'pouco melhores'} do que «adivinhar a média» → encolho a confiança ${Math.round((1 - W.k) * 100)}%` }); }
  const conf = sources.length >= 4 ? 'alta' : sources.length >= 2 ? 'média' : 'baixa';
  const r = { lh: +lh.toFixed(2), la: +la.toFixed(2), src: sources.length > 1 ? 'estudo: ' + sources.join(' + ') : base.src, M, mk, rawMk, trace, conf, studied: !!st, market: st && st.market };
  ZE_MODEL_CACHE.set(ck, r);
  try { snapshotPred(m, r); } catch (e) {}
  return r;
};
function arrow(d) { return Math.abs(d) < 0.04 ? '' : d > 0 ? '↑' : '↓'; }

/* ---------- Raciocínio visível ---------- */
function reasoningHTML(m) {
  const r = modelo(m), st = studyFor(m);
  const best = matchBestMarket(m);
  const lines = r.trace.map(t => `<div class="rz"><span class="rz-k">${t.k}</span><span>${t.txt}</span></div>`).join('');
  let vs = '';
  if (r.market) {
    const gaps = [['1', r.mk['1'], r.market.p1], ['X', r.mk['X'], r.market.pX], ['2', r.mk['2'], r.market.p2]].map(([k, me, mk]) => ({ k, me, mk, d: me - mk })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
    vs = Math.abs(gaps.d) >= 0.04 ? `<div style="margin-top:6px;">⚖️ Onde discordo do mercado: <b>${esc(marketName(gaps.k, m))}</b> — eu ${pct(gaps.me)}, mercado ${pct(gaps.mk)}${gaps.d > 0 ? ' → se a odd for ≥ ' + (1.03 / gaps.me).toFixed(2) + ', há valor.' : ' → aqui o mercado está mais otimista do que eu; fujo.'}</div>`
      : '<div style="margin-top:6px;">⚖️ Concordo com o mercado em quase tudo — aqui não há valor escondido.</div>';
  }
  const offline = st && st.offline ? '<div class="muted" style="margin-bottom:6px;">Sem dados online para este jogo (liga fora da cobertura ou sem internet) — penso só com o dossiê.</div>' : '';
  return `<div class="reason">${offline}<div class="rz-head">🧠 Como pensei <span class="spill ${r.conf === 'alta' ? 'win' : r.conf === 'média' ? 'open' : 'void'}">confiança ${r.conf}</span></div>${lines}
    <div class="rz"><span class="rz-k">Conclusão</span><span>1 <b>${pct(r.mk['1'])}</b> · X <b>${pct(r.mk['X'])}</b> · 2 <b>${pct(r.mk['2'])}</b> · Over 2.5 <b>${pct(r.mk['O2.5'])}</b> · Ambas <b>${pct(r.mk.BTTS)}</b> · placar ${r.mk.cs[0].s}</span></div>
    ${vs}${best ? (() => { const bo = st && st.books ? Math.max(0, ...st.books.map(b => b.odds[best.k] || 0)) : 0, need = 1.03 / best.p; return `<div style="margin-top:6px;">🎯 O mais seguro: <b>${esc(marketName(best.k, m))}</b> (${pct(best.p)}). Só vale a pena com odd ≥ <b>${need.toFixed(2)}</b>${bo > 1 ? (bo >= need ? ` — as casas pagam ${bo.toFixed(2)}: <b>vale</b>.` : ` — as casas pagam só ${bo.toFixed(2)}: <b>não vale</b> (a decisão final está no «Zé, decide», com as odds todas).`) : '.'}</div>`; })() : ''}</div>`;
}
async function studyInModal(btn) {
  const m = window._modalMatch; if (!m) return;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ A estudar…'; }
  const box = document.getElementById('studyBox');
  try { await zeStudy(m, t => { if (box) box.innerHTML = `<div class="muted">${t}</div>`; }); } catch (e) {}
  if (box) box.innerHTML = reasoningHTML(m);
  if (btn) btn.remove();
}

/* ---------- Ligações: Atualizar aprende, duelo estuda, chat explica ---------- */
const _applyLiveV26 = applyLive;
applyLive = function (payload) { const n = _applyLiveV26(payload); try { const k = learnFromResults(payload); if (k) setTimeout(() => toast(`🧠 O Zé avaliou ${k} ${k > 1 ? 'previsões' : 'previsão'} com os resultados reais.`), 900); } catch (e) { console.warn(e); } return n; };
const _openModalV26 = openModal;
openModal = function (m) {
  _openModalV26(m);
  const body = document.getElementById('modal-body');
  if (!body) return;
  const box = document.createElement('div');
  box.id = 'studyBox';
  box.innerHTML = studyFor(m) ? reasoningHTML(m) : `<button class="btn btn-lime btn-sm" onclick="studyInModal(this)">🧠 Estudar a fundo (forma, ficha, mercado)</button> <span class="muted" style="font-size:.76rem;">usa internet</span>`;
  const anchor = body.querySelector('.copy-btn') ? body.querySelector('.copy-btn').parentNode : null;
  if (anchor) body.insertBefore(box, anchor); else body.appendChild(box);
};
const _prepararDueloV26 = prepararDuelo;
prepararDuelo = function (idx) {
  _prepararDueloV26(idx);
  const m = dueloAtual && dueloAtual.m;
  if (!m) return;
  const box = document.getElementById('dueloBox');
  if (!box) return;
  const holder = document.createElement('div');
  holder.id = 'dueloStudy';
  holder.style.marginTop = '10px';
  box.insertBefore(holder, box.querySelector('.zbox'));
  if (studyFor(m)) { holder.innerHTML = reasoningHTML(m); prefillMarketOdds(m); return; }
  if (navigator.onLine === false) { holder.innerHTML = reasoningHTML(m); return; }
  holder.innerHTML = '<div class="muted">🧠 A estudar o jogo antes de decidir…</div>';
  zeStudy(m, t => { const h = document.getElementById('dueloStudy'); if (h) h.innerHTML = `<div class="muted">${t}</div>`; })
    .then(() => { if (dueloAtual && dueloAtual.m === m) _prepararDueloV26(matchIndex(m)) || prepararDueloAfterStudy(m); })
    .catch(() => { const h = document.getElementById('dueloStudy'); if (h) h.innerHTML = reasoningHTML(m); });
};
function prepararDueloAfterStudy(m) {
  const box = document.getElementById('dueloBox'); if (!box) return;
  const holder = document.createElement('div'); holder.id = 'dueloStudy'; holder.style.marginTop = '10px';
  holder.innerHTML = reasoningHTML(m);
  box.insertBefore(holder, box.querySelector('.zbox'));
  prefillMarketOdds(m);
}
function prefillMarketOdds(m) {
  // preenche odds publicadas, se existirem e o utilizador não tiver posto as suas
  const st = studyFor(m);
  if (st && st.market) Object.entries(st.market.odds).forEach(([k, o]) => { const el = document.getElementById('odd_' + k.replace('.', '_')); if (el && !el.value) { el.value = o.toFixed(2); el.title = 'odd publicada (' + st.market.provider + ')'; } });
}
const _zeTalkV26 = zeTalk;
zeTalk = function (raw, opts) {
  const q = normTxt(raw);
  if (/(estuda|analisa a fundo|como pensaste|porque|porquê|raciocinio|justifica|explica-me o jogo|em que te baseias|de onde vem)/.test(q)) {
    const teams = teamsMentioned(expandAliases(q));
    const m = teams.length ? resolveFocus(expandAliases(q), teams) : (zeLastMatch || pickDueloMatch());
    if (m) {
      zeLastMatch = m;
      if (studyFor(m) || navigator.onLine === false) return { mood: 'pensativo', html: reasoningHTML(m) };
      return { mood: 'pensativo', html: `Deixa-me estudar o <b>${esc(m.home)} vs ${esc(m.away)}</b> a fundo… 🧐`, later: async () => { await zeStudy(m).catch(() => null); return { mood: 'feliz', html: reasoningHTML(m) }; } };
    }
  }
  return _zeTalkV26(raw, opts);
};
const _renderConfigV26 = renderConfig;
renderConfig = function () {
  _renderConfigV26();
  const el = document.getElementById('cfgBrain'); if (!el) return;
  const W = learnWeights(), L = W.L;
  const P = lsGet(PRED_KEY, {}); const pending = Object.values(P).filter(p => !p.done).length;
  const hit = L.log.length ? L.log.filter(x => x.hit).length / L.log.length : null;
  const lg = Object.entries(L.byLeague).filter(([, v]) => v.n >= 3).map(([k, v]) => ({ k, h: v.hit / v.n, n: v.n })).sort((a, b) => b.h - a.h);
  el.insertAdjacentHTML('beforeend', `
    <div class="kv"><span>Previsões avaliadas</span><b>${L.n} · ${pending} à espera de resultado</b></div>
    <div class="kv"><span>Acerto do favorito (últimas ${L.log.length})</span><b>${hit == null ? '—' : pct(hit)}</b></div>
    <div class="kv"><span>Qualidade 1X2 (Brier, menor = melhor)</span><b>${L.n ? (L.bModel / L.n).toFixed(3) : '—'}${L.nMkt ? ` · mercado ${(L.bMkt / L.nMkt).toFixed(3)}` : ''}</b></div>
    <div class="kv"><span>Confiança no mercado</span><b>${Math.round((1 - W.wModel) * 100)}%${L.nMkt >= 8 ? ' (aprendida)' : ' (inicial)'}</b></div>
    <div class="kv"><span>Ajuste de humildade</span><b>${W.k < 0.999 ? '−' + Math.round((1 - W.k) * 100) + '%' : 'nenhum'}</b></div>
    ${lg.length ? `<div class="kv"><span>Onde acerto mais</span><b>${lg.slice(0, 3).map(x => `${esc(x.k)} ${pct(x.h)}`).join(' · ')}</b></div>` : ''}
    ${L.log.length ? `<details style="margin-top:6px;"><summary class="muted" style="cursor:pointer;">Últimas previsões avaliadas</summary>${L.log.slice(0, 10).map(x => `<div class="kv"><span>${esc(x.k)}</span><b>${x.hit ? '✅' : '❌'} ${x.fav} ${pct(x.p)}</b></div>`).join('')}</details>` : ''}`);
};
