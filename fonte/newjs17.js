
/* =====================================================================
   v32 · a época toda e a seguinte
   - datas: o dia da semana decide o ano («Dom 27 Dez» em janeiro = dezembro passado)
   - o dossiê de 2026 nunca volta a aparecer em 2027
   - perfis das equipas: casa/fora, estabilidade, subida/queda, época passada, promovidos
   - transferências (vendas/compras) ditas no chat entram no modelo e vão perdendo peso
   - viragem de época automática (julho) + «Carregar época passada»
   ===================================================================== */

/* ---------- Datas: o dia da semana diz o ano ---------- */
/* Os jogos do dossiê pertencem à época 2026/27 (ago→jul), mesmo quando o dia da semana do dossiê não bate certo */
const DOSSIER_Y0 = 2026;
const STATIC_DAYS = new Map();
matches.forEach(m => {
  if (m.live) return;
  const s = normTxt(m.date), mm = s.match(/(\d{1,2})\s*(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/);
  if (mm) { const mo = monthsMap[mm[2]]; STATIC_DAYS.set(s, new Date(mo >= 6 ? DOSSIER_Y0 : DOSSIER_Y0 + 1, mo, +mm[1]).getTime()); }
});
const WD_NORM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
parseDayLabel = function (dateStr) {
  const s = normTxt(dateStr);
  const m = s.match(/(\d{1,2})\s*(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/);
  if (!m) return null;
  const day = parseInt(m[1], 10), month = monthsMap[m[2]];
  const ym = s.match(/\b(20\d\d)\b/);
  if (ym) return new Date(+ym[1], month, day);
  if (STATIC_DAYS.has(s)) return new Date(STATIC_DAYS.get(s));   // jogo do dossiê: fica na época do dossiê
  const wd = WD_NORM.findIndex(w => new RegExp('(^| )' + w + '( |$)').test(s));
  const now = new Date(), y = now.getFullYear();
  let cands = [y - 1, y, y + 1].map(yy => new Date(yy, month, day));
  if (wd >= 0) {
    const ok = [y - 2, y - 1, y, y + 1].map(yy => new Date(yy, month, day)).filter(d => d.getDay() === wd);
    if (ok.length) cands = ok;
  }
  return cands.sort((a, b) => Math.abs(a - now) - Math.abs(b - now))[0];
};

/* ---------- Jogos do dossiê só se juntam ao jogo real da MESMA data ---------- */
const _applyLiveV32 = applyLive;
applyLive = function (payload) {
  const hidden = [];
  if (payload && Array.isArray(payload.matches)) {
    const evs = payload.matches.filter(x => x && x.homeTeam && x.awayTeam && x.utcDate);
    matches.forEach(m => {
      if (m.live || m.past) return;
      const d = parseDayLabel(m.date);
      const twin = d && evs.some(x => Math.abs(new Date(x.utcDate) - d) < 1.6 * 864e5 && sameTeams(m, x.homeTeam.shortName || x.homeTeam.name, x.awayTeam.shortName || x.awayTeam.name));
      if (!twin) { hidden.push(m); m.past = true; }
    });
  }
  let r;
  try { r = _applyLiveV32(payload); } finally { hidden.forEach(m => { m.past = false; }); }
  try { profIngestPayload(payload); } catch (e) { console.error(e); }
  return r;
};

/* ---------- Memória cheia: arruma caches e tenta outra vez ---------- */
function storagePrune(aggressive) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const del = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (/^(acc:[a-z0-9]+:)?ze_odds_/.test(k)) { const d = parseDayLabel(k.replace(/^(acc:[a-z0-9]+:)?ze_odds_/, '').replace(/_/g, ' ')); if (!d || d < today - 7 * 864e5) del.push(k); }
  }
  del.forEach(k => (window.__rawDel ? window.__rawDel(k) : localStorage.removeItem(k)));
  if (aggressive) { ['ze_recent_v1', 'ze_players_v2', 'ze_live_v1'].forEach(k => localStorage.removeItem(k)); const P = lsGet(PRED_KEY, {}); const ks = Object.keys(P).sort((a, b) => P[a].t - P[b].t); ks.slice(0, Math.floor(ks.length / 2)).forEach(k => delete P[k]); try { localStorage.setItem(PRED_KEY, JSON.stringify(P)); } catch (e) {} }
  return del.length;
}
let _quotaWarned = false;
lsSet = function (k, v) {
  const s = JSON.stringify(v);
  try { localStorage.setItem(k, s); return true; } catch (e) {}
  storagePrune(true);
  try { localStorage.setItem(k, s); return true; } catch (e) {
    if (!_quotaWarned) { _quotaWarned = true; try { toast('⚠️ Memória do browser cheia — faz um backup em Definições.'); } catch (x) {} }
    return false;
  }
};

/* =====================================================================
   PERFIS DAS EQUIPAS
   ===================================================================== */
const PROF_KEY = 'ze_teams_v1';
const CAL_YEAR = /^(fin|nor|swe|bra|arg|usa|jpn|chn|irl|isl)\./;
function seasonOf(date, code) {
  const d = new Date(date), y = d.getFullYear();
  if (CAL_YEAR.test(code || '')) return String(y);
  return d.getMonth() >= 6 ? `${y}/${String(y + 1).slice(2)}` : `${y - 1}/${String(y).slice(2)}`;
}
function profLoad() { const P = lsGet(PROF_KEY, null); return P && P.v === 1 ? P : { v: 1, teams: {}, names: {}, leagues: {}, season: null }; }
let PROF = null;
function prof() { return PROF || (PROF = profLoad()); }
function profSave() { lsSet(PROF_KEY, prof()); MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear(); try { ZE_NOTE_CACHE.clear(); } catch (e) {} }
const zeroSide = () => ({ n: 0, gf: 0, ga: 0, pts: 0 });

function profTeam(code, id, name) {
  const P = prof(), k = code + '|' + id;
  if (!P.teams[k]) P.teams[k] = { k, code, id: String(id), name, cur: null, prev: null, squad: [] };
  if (name) { P.teams[k].name = P.teams[k].name || name; P.names[normTxt(name)] = k; }
  return P.teams[k];
}
/** Fecha a época de uma liga: guarda os números como «época passada» de cada equipa */
function profRollLeague(code, newSeason) {
  const P = prof();
  const L = P.leagues[code] = P.leagues[code] || {};
  if (L.season === newSeason) return;
  const old = Object.values(P.teams).filter(t => t.code === code && t.cur && t.cur.season !== newSeason);
  const avg = profLeagueAvg(code, true);
  const ids = [];
  old.forEach(t => {
    const c = t.cur, n = c.H.n + c.A.n;
    if (n >= 8) { t.prev = { season: c.season, src: 'jogos que o Zé viu', H: c.H, A: c.A, avgH: avg.h, avgA: avg.a }; ids.push(t.id); }
    t.cur = null;
    t.squad = (t.squad || []).filter(s => s.season === newSeason);   // transferências do defeso ficam
  });
  if (ids.length >= 8) { L.prevTeams = ids; L.prevSeason = old.find(t => t.prev).prev.season; }
  L.season = newSeason;
}
function profAdd(code, team, opp, home, gf, ga, date) {
  const s = seasonOf(date, code);
  const t = profTeam(code, team.id, team.shortName || team.name);
  if (t.cur && t.cur.season !== s) {
    if (new Date(date) < new Date(t.cur.last || 0)) return;          // jogo antigo da época passada
    profRollLeague(code, s);
    if (t.cur && t.cur.season !== s) {   // equipa que não estava na liga quando a época fechou
      if (t.cur.H.n + t.cur.A.n >= 8) { const a = profLeagueAvg(code, true); t.prev = { season: t.cur.season, src: 'jogos que o Zé viu', H: t.cur.H, A: t.cur.A, avgH: a.h, avgA: a.a }; }
      t.cur = null;
    }
  }
  if (!t.cur) t.cur = { season: s, H: zeroSide(), A: zeroSide(), last: null, form: [] };
  if (t.cur.last && new Date(date) <= new Date(t.cur.last)) return;  // já contado
  const S = home ? t.cur.H : t.cur.A;
  S.n++; S.gf += gf; S.ga += ga; S.pts += gf > ga ? 3 : gf === ga ? 1 : 0;
  t.cur.last = date;
  t.cur.form.unshift([home ? 1 : 0, gf, ga]); t.cur.form = t.cur.form.slice(0, 10);
  const P = prof(); P.leagues[code] = P.leagues[code] || {}; if (!P.leagues[code].season) P.leagues[code].season = s;
}
function profIngest(list, code) {
  const fin = (list || []).filter(x => x && x.status === 'FINISHED' && x.score && x.score.fullTime && x.score.fullTime.home != null && x.homeTeam && x.awayTeam)
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  fin.forEach(x => {
    const c = code || (x.competition && x.competition.code) || '';
    if (!c || c === 'nba' || /uefa|fifa|conmebol|concacaf/.test(c)) return;   // taças europeias não contam para o perfil da liga
    const hg = x.score.fullTime.home, ag = x.score.fullTime.away;
    profAdd(c, x.homeTeam, x.awayTeam, true, hg, ag, x.utcDate);
    profAdd(c, x.awayTeam, x.homeTeam, false, ag, hg, x.utcDate);
  });
  return fin.length;
}
function profIngestPayload(payload) {
  if (!payload || !payload.matches) return;
  const n = profIngest(payload.matches);
  // equipas da tabela atual que não estavam na época passada = promovidas
  Object.keys(payload.standings || {}).forEach(code => {
    const T = (payload.standings[code] || []).find(s => s.type === 'TOTAL');
    if (!T) return;
    const L = prof().leagues[code] = prof().leagues[code] || {};
    L.now = T.table.map(r => String(r.team.id));
    T.table.forEach(r => profTeam(code, r.team.id, r.team.name));
  });
  profSeasonCheck();
  profSave();
  return n;
}
/** Viragem de época global: a aprendizagem antiga passa a valer metade */
function profSeasonCheck() {
  const P = prof(), s = seasonOf(new Date(), '');
  if (!P.season) { P.season = s; return; }
  if (P.season === s) return;
  P.season = s;
  const L = learnLoad();
  const half = o => { Object.keys(o).forEach(k => { if (typeof o[k] === 'number' && k !== 'v') o[k] = o[k] * 0.5; else if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) half(o[k]); }); };
  half(L); lsSet(LEARN_KEY, L);
  P.rolledAt = new Date().toISOString();
}

/* médias de golos da liga (casa/fora) a partir dos perfis */
function profLeagueAvg(code, useCur) {
  let gh = 0, nh = 0, ga = 0, na = 0;
  Object.values(prof().teams).forEach(t => { if (t.code !== code || !t.cur) return; gh += t.cur.H.gf; nh += t.cur.H.n; ga += t.cur.A.gf; na += t.cur.A.n; });
  if (nh >= 20 && na >= 20) return { h: gh / nh, a: ga / na, n: nh };
  const prevs = Object.values(prof().teams).filter(t => t.code === code && t.prev && t.prev.avgH);
  if (prevs.length) return { h: prevs[0].prev.avgH, a: prevs[0].prev.avgA, n: 0 };
  return { h: 1.45, a: 1.15, n: 0 };
}

/* ---------- Encontrar o perfil de uma equipa ---------- */
function profFind(name, code, id) {
  const P = prof();
  if (code && id && P.teams[code + '|' + id]) return P.teams[code + '|' + id];
  const n = normTxt(name);
  if (P.names[n] && P.teams[P.names[n]]) return P.teams[P.names[n]];
  const ex = expandAliases(n.replace(/\./g, ''));
  let best = null;
  Object.values(P.teams).forEach(t => { const sc = teamScore(t.name, ex) + teamScore(name, expandAliases(normTxt(t.name))); if (teamScore(t.name, ex) > 0 && teamScore(name, expandAliases(normTxt(t.name))) > 0 && (!best || sc > best.sc)) best = { t, sc }; });
  return best ? best.t : null;
}

/* ---------- Transferências / força do plantel ---------- */
function squadDelta(t) {
  const list = (t && t.squad) || [];
  const raw = clamp(list.reduce((s, x) => s + x.v, 0), -0.2, 0.2);
  const n = t && t.cur ? t.cur.H.n + t.cur.A.n : 0;
  return { raw, eff: raw * Math.max(0, 1 - n / 12), list };   // ao fim de ~12 jogos os resultados reais já contam a história
}

/* ---------- O perfil propriamente dito ---------- */
function teamProfile(t) {
  if (!t) return null;
  const avg = profLeagueAvg(t.code);
  const c = t.cur || { H: zeroSide(), A: zeroSide(), form: [] };
  const L = prof().leagues[t.code] || {};
  // prior: época passada (regride 1/3 para a média) · promovido · média
  let prior = { ah: 1, dh: 1, aa: 1, da: 1, src: 'sem histórico (média da liga)' };
  if (t.prev && (t.prev.H.n + t.prev.A.n) >= 8) {
    const p = t.prev, r = x => 1 + (x - 1) * 0.67;
    const pah = p.H.n ? (p.H.gf / p.H.n) / p.avgH : 1, pdh = p.H.n ? (p.H.ga / p.H.n) / p.avgA : 1;
    const paa = p.A.n ? (p.A.gf / p.A.n) / p.avgA : 1, pda = p.A.n ? (p.A.ga / p.A.n) / p.avgH : 1;
    prior = { ah: r(pah), dh: r(pdh), aa: r(paa), da: r(pda), src: `época ${p.season} (${p.src})`, ppgH: p.H.n ? p.H.pts / p.H.n : null, ppgA: p.A.n ? p.A.pts / p.A.n : null };
  } else if (L.prevTeams && L.prevTeams.length >= 8 && !L.prevTeams.includes(t.id) && L.season && L.prevSeason && L.season !== L.prevSeason) {
    prior = { ah: 0.85, dh: 1.15, aa: 0.8, da: 1.2, src: 'promovido (não estava na liga na época passada)', promoted: true };
  }
  const sq = squadDelta(t);
  const f = 1 + sq.eff;
  prior.ah *= f; prior.aa *= f; prior.dh /= f; prior.da /= f;
  const K = 6, sh = (obs, n, p) => (obs * n + p * K) / (n + K);
  const H = c.H, A = c.A;
  const ah = sh(H.n ? (H.gf / H.n) / avg.h : 1, H.n, prior.ah), dh = sh(H.n ? (H.ga / H.n) / avg.a : 1, H.n, prior.dh);
  const aa = sh(A.n ? (A.gf / A.n) / avg.a : 1, A.n, prior.aa), da = sh(A.n ? (A.ga / A.n) / avg.h : 1, A.n, prior.da);
  const ppgH = H.n ? H.pts / H.n : null, ppgA = A.n ? A.pts / A.n : null, n = H.n + A.n;
  const tags = [];
  if (H.n >= 4 && ppgH >= 2.2 && (ppgA == null || ppgH - ppgA >= 0.7)) tags.push('🏟️ forte em casa');
  if (H.n >= 4 && ppgH <= 1.0) tags.push('🏚️ fraco em casa');
  if (A.n >= 4 && ppgA >= 2.0) tags.push('✈️ forte fora');
  if (A.n >= 4 && ppgA <= 0.9) tags.push('🧳 fraco fora');
  const fm = c.form || [];
  if (fm.length >= 6) {
    const gd = fm.map(x => x[1] - x[2]), mu = gd.reduce((a, b) => a + b, 0) / gd.length;
    const sd = Math.sqrt(gd.reduce((a, b) => a + (b - mu) ** 2, 0) / gd.length);
    if (sd <= 1.15) tags.push('🧱 estável'); else if (sd >= 2) tags.push('🎢 irregular');
    const pts = x => x[1] > x[2] ? 3 : x[1] === x[2] ? 1 : 0;
    const p5 = fm.slice(0, 5).reduce((a, x) => a + pts(x), 0) / 5, pAll = n ? (H.pts + A.pts) / n : p5;
    if (n >= 8 && p5 - pAll >= 0.6) tags.push('📈 em subida'); else if (n >= 8 && p5 - pAll <= -0.6) tags.push('📉 em queda');
  } else if (n < 4 && prior.src !== 'sem histórico (média da liga)') tags.push('🌱 início de época: conta muito a época passada');
  if (prior.promoted) tags.push('🆙 promovido');
  if (sq.raw <= -0.05) tags.push('📤 perdeu jogadores'); else if (sq.raw >= 0.05) tags.push('📥 reforçou-se');
  return { t, avg, H, A, n, ppgH, ppgA, ah, dh, aa, da, prior, sq, tags, form: fm };
}

/* ---------- Entra no modelo ---------- */
const PROF_NOTE = new Map();
let PROF_W_SCALE = 1;   // 0 = desliga os perfis (só para testes A/B)
const _lambdasForV32 = lambdasFor;
lambdasFor = function (m) {
  const base = _lambdasForV32(m);
  try {
    const code = m.espn && m.espn.code;
    const th = profFind(m.home, code, m.espn && m.espn.h), ta = profFind(m.away, code, m.espn && m.espn.a);
    if (!th || !ta || th.code !== ta.code) { PROF_NOTE.delete(mKey(m)); return base; }
    const ph = teamProfile(th), pa = teamProfile(ta);
    const known = x => x.n >= 3 || x.prior.src !== 'sem histórico (média da liga)';
    if (!known(ph) || !known(pa)) { PROF_NOTE.delete(mKey(m)); return base; }
    const avg = ph.avg;
    const lhP = avg.h * ph.ah * pa.da, laP = avg.a * pa.aa * ph.dh;
    const nMin = Math.min(ph.n, pa.n);
    const fromDossier = base.src === 'dossiê calibrado' || base.src === 'ratings';
    // peso afinado por simulação: no arranque a época passada vale ouro; a meio a tabela já sabe o mesmo
    const w = fromDossier ? (nMin >= 6 ? 0.2 : 0.1) : (nMin < 4 ? 0.75 : nMin < 8 ? 0.55 : nMin < 14 ? 0.3 : 0.18);
    const wS = w * PROF_W_SCALE; if (!(wS > 0)) { PROF_NOTE.delete(mKey(m)); return base; }
    const lh = clamp(Math.pow(base.lh, 1 - wS) * Math.pow(lhP, wS), 0.15, 4.2), la = clamp(Math.pow(base.la, 1 - wS) * Math.pow(laP, wS), 0.12, 4);
    PROF_NOTE.set(mKey(m), { ph, pa, w: wS, lhP, laP, before: [base.lh, base.la], after: [lh, la] });
    return { lh: +lh.toFixed(2), la: +la.toFixed(2), src: base.src };
  } catch (e) { return base; }
};

/* ---------- O calendário completo de cada equipa alimenta o perfil ---------- */
teamRecent = async function (code, id) {
  const cache = lsGet(RECENT_KEY, {});
  const k = code + '|' + id;
  if (cache[k] && Date.now() - cache[k].t < 12 * 3600e3) return cache[k].v;
  const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/teams/${id}/schedule`);
  const all = (j.events || []).map(ev => normalizeEspn(ev, code, '')).filter(x => x && x.status === 'FINISHED');
  try { if (profIngest(all, code)) profSave(); } catch (e) {}
  const v = all.sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate)).slice(0, 10)
    .map(x => { const home = x.homeTeam.id === String(id); return { home, gf: home ? x.score.fullTime.home : x.score.fullTime.away, ga: home ? x.score.fullTime.away : x.score.fullTime.home, d: x.utcDate, opp: home ? x.awayTeam.shortName : x.homeTeam.shortName }; });
  cache[k] = { t: Date.now(), v };
  const keys = Object.keys(cache); if (keys.length > 80) delete cache[keys[0]];
  lsSet(RECENT_KEY, cache);
  return v;
};

/* ---------- Época passada a partir das tabelas finais (botão) ---------- */
async function profLoadPrevSeason(status) {
  status = status || (() => {});
  const now = new Date(), P = prof();
  let ok = 0, fail = 0;
  const codes = Object.keys(ESPN_LEAGUES).filter(c => !/uefa|nba/.test(c));
  for (const code of codes) {
    const cur = seasonOf(now, code);
    const y = CAL_YEAR.test(code) ? now.getFullYear() - 1 : (now.getMonth() >= 6 ? now.getFullYear() - 1 : now.getFullYear() - 2);
    status(`⏳ ${ESPN_LEAGUES[code]} ${CAL_YEAR.test(code) ? y : y + '/' + String(y + 1).slice(2)}…`);
    try {
      const j = await fetchJSON(`https://site.api.espn.com/apis/v2/sports/soccer/${code}/standings?season=${y}`);
      const S = espnStandings(j); const T = S && S[0] && S[0].table;
      if (!T || T.length < 8) { fail++; continue; }
      const gp = T.reduce((s, r) => s + r.playedGames, 0), gf = T.reduce((s, r) => s + r.goalsFor, 0);
      const avgT = gp ? gf / gp : 1.3, avgH = avgT * 1.12, avgA = avgT * 0.88;
      const seasonTxt = CAL_YEAR.test(code) ? String(y) : `${y}/${String(y + 1).slice(2)}`;
      T.forEach(r => {
        const t = profTeam(code, r.team.id, r.team.name);
        if (t.prev && t.prev.season === seasonTxt && t.prev.src === 'jogos que o Zé viu' && t.prev.H.n + t.prev.A.n >= 20) return;  // já tem melhor
        const n = r.playedGames || 0, hn = Math.round(n / 2), an = n - hn;
        const gfR = n ? r.goalsFor / n : avgT, gaR = n ? r.goalsAgainst / n : avgT, ppg = n ? r.points / n : 1.35;
        t.prev = { season: seasonTxt, src: 'tabela final', avgH, avgA,
          H: { n: hn, gf: gfR * 1.12 * hn, ga: gaR * 0.88 * hn, pts: Math.min(3, ppg * 1.15) * hn },
          A: { n: an, gf: gfR * 0.88 * an, ga: gaR * 1.12 * an, pts: Math.max(0, ppg * 0.85) * an } };
      });
      const L = P.leagues[code] = P.leagues[code] || {};
      L.prevTeams = T.map(r => String(r.team.id)); L.prevSeason = seasonTxt; L.season = L.season || cur;
      ok++;
    } catch (e) { fail++; }
  }
  P.prevLoadedAt = new Date().toISOString();
  profSave();
  return { ok, fail };
}
async function profPrevUI(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '⏳ A carregar…'; }
  const st = t => setHTML('cfgTeamsStatus', t);
  const r = await profLoadPrevSeason(st).catch(e => ({ ok: 0, fail: 1, err: e.message }));
  st(r.ok ? `✅ Época passada carregada em ${r.ok} liga${r.ok > 1 ? 's' : ''}${r.fail ? ` (${r.fail} sem dados)` : ''}. No arranque da época, o Zé parte daqui e vai corrigindo com os jogos reais.` : `❌ Não consegui carregar as tabelas (${esc(r.err || 'sem resposta')}).`);
  if (btn) { btn.disabled = false; btn.textContent = '📥 Carregar época passada'; }
  try { renderTeamsPanel(); } catch (e) {}
}

/* ---------- Mostrar ---------- */
const f1 = x => x == null ? '—' : x.toFixed(1), f2 = x => x == null ? '—' : x.toFixed(2);
function profileLine(p, side) {
  if (!p) return '';
  const S = side === 'h' ? p.H : p.A, ppg = side === 'h' ? p.ppgH : p.ppgA;
  const where = side === 'h' ? '🏟️ em casa' : '🧳 fora';
  const form = (p.form || []).slice(0, 5).map(x => x[1] > x[2] ? 'V' : x[1] === x[2] ? 'E' : 'D').join('');
  return `<b>${esc(p.t.name)}</b> ${where}: ${S.n ? `${f2(ppg)} pts/j · marca ${f1(S.gf / S.n)} · sofre ${f1(S.ga / S.n)} (${S.n} j)` : 'ainda sem jogos'}${form ? ` · últimos: ${form}` : ''}
    ${p.tags.length ? `<div style="margin-top:2px;">${p.tags.map(x => `<span class="ptag mid" style="margin:2px 4px 0 0;display:inline-block;">${esc(x)}</span>`).join('')}</div>` : ''}
    <div class="muted" style="font-size:.74rem;">Ponto de partida: ${esc(p.prior.src)}${p.sq.list.length ? ` · plantel: ${p.sq.list.map(s => esc(s.txt)).join('; ')} (${p.sq.raw > 0 ? '+' : ''}${Math.round(p.sq.raw * 100)}%${p.sq.eff !== p.sq.raw ? `, agora vale ${p.sq.eff > 0 ? '+' : ''}${Math.round(p.sq.eff * 100)}%` : ''})` : ''}</div>`;
}
function profileBlock(m) {
  const pn = PROF_NOTE.get(mKey(m));
  if (!pn) { modelo(m); }
  const q = PROF_NOTE.get(mKey(m));
  if (!q) return '';
  const d = (a, b) => { const x = b - a; return Math.abs(x) < 0.02 ? '=' : (x > 0 ? '+' : '') + x.toFixed(2); };
  return `<div class="needs" style="border-color:var(--line2);"><div class="rz-head">🧬 Perfil das equipas (época ${esc((q.ph.t.cur && q.ph.t.cur.season) || prof().season || '')})</div>
    <div class="need">${profileLine(q.ph, 'h')}</div>
    <div class="need">${profileLine(q.pa, 'a')}</div>
    <div class="muted" style="font-size:.76rem;margin-top:4px;">Pelo perfil casa/fora: ${q.lhP.toFixed(2)}–${q.laP.toFixed(2)} golos. Conta ${Math.round(q.w * 100)}% → golos esperados ${q.before[0].toFixed(2)}–${q.before[1].toFixed(2)} passam a ${q.after[0].toFixed(2)}–${q.after[1].toFixed(2)} (${d(q.before[0], q.after[0])} / ${d(q.before[1], q.after[1])}).</div></div>`;
}
const _reasoningHTMLV32 = reasoningHTML;
reasoningHTML = function (m) { let h = _reasoningHTMLV32(m); try { h += profileBlock(m); } catch (e) {} return h; };

function profRank(kind) {
  const list = Object.values(prof().teams).filter(t => t.cur && t.cur.H.n + t.cur.A.n >= 6).map(teamProfile);
  const by = {
    casa: { f: p => p.H.n >= 4 ? p.ppgH : -1, t: '🏟️ Mais fortes em casa', v: p => `${f2(p.ppgH)} pts/j em casa (${p.H.n} j) · fora ${f2(p.ppgA)}` },
    fora: { f: p => p.A.n >= 4 ? -p.ppgA : -9, t: '🧳 Mais fracas fora', v: p => `${f2(p.ppgA)} pts/j fora (${p.A.n} j) · em casa ${f2(p.ppgH)}` },
    estaveis: { f: p => { const fm = p.form; if (fm.length < 6) return -9; const gd = fm.map(x => x[1] - x[2]), mu = gd.reduce((a, b) => a + b, 0) / gd.length; return -Math.sqrt(gd.reduce((a, b) => a + (b - mu) ** 2, 0) / gd.length); }, t: '🧱 Mais estáveis', v: p => p.tags.filter(x => /estável|subida|queda/.test(x)).join(' ') || '—' },
    subida: { f: p => p.tags.includes('📈 em subida') ? 1 : p.tags.includes('📉 em queda') ? -1 : 0, t: '📈 Em subida / 📉 em queda', v: p => p.tags.filter(x => /subida|queda/.test(x)).join(' ') || 'normal' }
  }[kind];
  if (!by) return '';
  const top = list.map(p => ({ p, s: by.f(p) })).filter(x => x.s > -9).sort((a, b) => b.s - a.s);
  const rows = (kind === 'subida' ? top.filter(x => x.s !== 0) : top).slice(0, 8);
  if (!rows.length) return `${by.t}: ainda não tenho jogos suficientes. Carrega em <b>📡 Atualizar</b> e estuda jogos — cada jogo estudado traz o calendário completo das duas equipas.`;
  return `<b>${by.t}</b><br>${rows.map((x, i) => `${i + 1}. <b>${esc(x.p.t.name)}</b> <span class="muted">(${esc(ESPN_LEAGUES[x.p.t.code] || x.p.t.code)})</span> — ${by.v(x.p)}`).join('<br>')}`;
}
function renderTeamsPanel() {
  const el = document.getElementById('cfgTeams'); if (!el) return;
  const P = prof(), T = Object.values(P.teams);
  const withCur = T.filter(t => t.cur && t.cur.H.n + t.cur.A.n > 0).length, withPrev = T.filter(t => t.prev).length;
  const leagues = [...new Set(T.filter(t => t.cur).map(t => t.code))].map(c => ESPN_LEAGUES[c] || c);
  el.innerHTML = `<div style="font-size:.86rem;line-height:1.55;">Época <b>${esc(P.season || seasonOf(new Date(), ''))}</b> · ${withCur} equipas com jogos desta época · ${withPrev} com a época passada${leagues.length ? `<br><span class="muted">${leagues.map(esc).join(' · ')}</span>` : ''}</div>
    <div class="hint" style="margin:8px 0;">O Zé guarda, para cada equipa, os jogos <b>em casa</b> e <b>fora</b>, a estabilidade e a tendência. Quando chega julho, a época fecha sozinha: os números passam a «época passada» (encolhidos 1/3 para a média, porque os plantéis mudam), os promovidos começam mais fracos e as vendas/compras que lhe disseres contam no arranque e vão perdendo peso até ao 12.º jogo.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-sm" onclick="profPrevUI(this)">📥 Carregar época passada</button>
    <button class="btn btn-sm" onclick="fmGo('ze');zeAsk('fortes em casa')">🏟️ Fortes em casa</button><button class="btn btn-sm" onclick="fmGo('ze');zeAsk('fracos fora')">🧳 Fracos fora</button><button class="btn btn-sm" onclick="fmGo('ze');zeAsk('equipas estáveis')">🧱 Estáveis</button></div>
    <div id="cfgTeamsStatus" class="hint" style="margin-top:8px;">${P.prevLoadedAt ? `Época passada carregada a ${new Date(P.prevLoadedAt).toLocaleDateString('pt-PT')}.` : 'Dica: no arranque de cada época (agosto), carrega a época passada — assim o Zé não começa às cegas.'}</div>`;
}
const _renderConfigV32 = renderConfig;
renderConfig = function () { _renderConfigV32(); try { renderTeamsPanel(); } catch (e) {} };

/* ---------- Chat: perfis, rankings e transferências ---------- */
function profTeamsInText(q) {
  const out = teamsMentioned(q).slice();
  Object.values(prof().teams).forEach(t => { if (teamScore(t.name, q) > 0 && !out.some(x => teamScore(x, normTxt(t.name)) > 0 || teamScore(t.name, normTxt(x)) > 0)) out.push(t.name); });
  return out;
}
function playerFromRaw(raw, teams) {
  const tw = new Set(teams.flatMap(n => normTxt(n).split(' ').concat(teamTokens(n))));
  const words = String(raw).split(/[\s,.;:!?«»"'()]+/).filter(Boolean);
  const seq = []; let cur = [];
  words.forEach(w => { const nw = normTxt(w); const ok = /^[A-ZÀ-ÝŁŚŻ][\wÀ-ÿ'-]{1,}$/.test(w) && !/^[A-Z]{2,4}$/.test(w) && !TEAM_STOP.has(nw) && !tw.has(nw) && !HEAD_STOP.has(nw) && !nw.split('-').some(x => HEAD_STOP.has(x)); if (ok) cur.push(w); else { if (cur.length) seq.push(cur); cur = []; } });
  if (cur.length) seq.push(cur);
  const s = seq.find(x => x.length <= 3);
  return s ? s.join(' ') : null;
}
const SALE_RE = /\b(vendeu|vende|vendido|perdeu|perde o|saiu|sai do|sai da|deixou|deixa o|deixa a|foi para|transferid|emprestad|abandonou)/;
const BUY_RE = /\b(contratou|contrata|comprou|compra|reforcou|reforca|reforco|assinou|chegou|chega ao|chega a|novo jogador|foi buscar)/;
const _zeTalkV32 = zeTalk;
zeTalk = function (raw, opts) {
  const q = zeNorm(raw);
  if (/(fortes? em casa|fracos? fora|equipas? estaveis|mais estaveis|em subida|em queda)/.test(q) && !/aposta/.test(q)) {
    const k = /casa/.test(q) ? 'casa' : /fora/.test(q) ? 'fora' : /estave/.test(q) ? 'estaveis' : 'subida';
    return { mood: 'pensativo', html: profRank(k) };
  }
  const teams = profTeamsInText(q);
  if (/(perfil|como (esta|anda|joga)|em casa e fora)/.test(q) && teams.length) {
    const t = profFind(teams[0]);
    if (!t) return { mood: 'pensativo', html: `Ainda não tenho jogos do <b>${esc(teams[0])}</b> esta época. Carrega em <b>📡 Atualizar</b> ou estuda um jogo dele.` };
    const p = teamProfile(t);
    return { mood: 'pensativo', html: `🧬 ${profileLine(p, 'h')}<br>${profileLine(p, 'a').replace(/^<b>[^<]*<\/b>/, '<b>' + esc(t.name) + '</b>')}` };
  }
  if (/(esquece|apaga|limpa).*(transferenc|vendas|compras|reforcos|plantel)/.test(q) && teams.length) {
    const t = profFind(teams[0]); if (t) { t.squad = []; profSave(); }
    return { mood: 'feliz', html: `🧹 Apaguei as transferências do <b>${esc(teams[0])}</b>.` };
  }
  // compras e vendas com nome/valor tratam-se no módulo do mercado (v33); aqui só «mais forte / mais fraco»
  const sale = false, buy = false, stronger = /(mais forte|esta melhor|reforcad|plantel melhor)/.test(q), weaker = /(mais fraco|enfraquec|esta pior|desmantelad|plantel pior)/.test(q);
  if ((stronger || weaker) && teams.length && !/aposta|odd|@/.test(q)) {
    const team = teams[0];
    // «X saiu do Benfica para o Porto» → venda do Benfica, compra do Porto
    const pl = playerFromRaw(raw, teams);
    let code = null; const mm = matches.find(m => m.espn && (teamScore(m.home, normTxt(team)) > 0 || teamScore(m.away, normTxt(team)) > 0));
    if (mm) code = mm.espn.code;
    let t = profFind(team, code);
    if (!t) { const any = Object.values(prof().teams).find(x => teamScore(x.name, normTxt(team)) > 0); t = any || profTeam(code || 'manual', normTxt(team), team); }
    const b = mm ? (boardFor(mm) || (studyFor(mm) && studyFor(mm).board)) : null;
    const star = pl && b ? b.home.concat(b.away).find(p => nameHit(pl, p.name) != null && p.share >= 0.2) : null;
    const season = seasonOf(new Date(), t.code);
    let v, txt;
    if (stronger || weaker) { v = stronger ? 0.06 : -0.06; txt = stronger ? 'plantel mais forte' : 'plantel mais fraco'; }
    else if (sale && !buy) { v = star ? -0.08 : -0.04; txt = `saiu ${pl || 'um jogador'}${star ? ` (${Math.round(star.share * 100)}% dos golos)` : ''}`; }
    else { v = 0.04; txt = `chegou ${pl || 'um reforço'}`; }
    if ((t.squad || []).some(s => s.txt === txt && s.season === season)) return { mood: 'pensativo', html: `Já tinha isso registado no <b>${esc(t.name)}</b>: ${esc(txt)}.` };
    t.squad = (t.squad || []).concat({ txt, v, season, at: new Date().toISOString() });
    // o outro clube na frase (compra/venda espelhada)
    let mirror = '';
    if (teams[1] && pl && sale) { const t2 = profFind(teams[1]); if (t2) { t2.squad = (t2.squad || []).concat({ txt: `chegou ${pl}`, v: 0.04, season, at: new Date().toISOString() }); mirror = ` E no <b>${esc(t2.name)}</b> conto como reforço (+4%).`; } }
    profSave();
    const sq = squadDelta(t);
    return { mood: v < 0 ? 'pensativo' : 'feliz', html: `📝 Registei no <b>${esc(t.name)}</b>: ${esc(txt)} → ${v > 0 ? '+' : ''}${Math.round(v * 100)}% de força (total ${sq.raw > 0 ? '+' : ''}${Math.round(sq.raw * 100)}%).${mirror}<br><span class="muted">Conta muito no arranque e vai perdendo peso: ao 12.º jogo da época já mandam os resultados reais. Para apagar: «esquece transferências do ${esc(t.name)}».</span>` };
  }
  return _zeTalkV32(raw, opts);
};
