/* =====================================================================
   v51 · marcadores: forma recente e defesa do adversário
   1) Golos de cada jogador nos últimos 5 jogos da equipa (🔥 quando está quente)
   2) Jogos europeus: os golos da liga também contam (antes só via os golos da própria prova europeia)
   3) Defesa do adversário: quantos golos sofre por jogo, comparado com a média da liga (🛡️ vulnerável)
   4) Alertas de marcador no estudo do jogo, no campo e no chat
   Nota: a probabilidade de marcar já conta a defesa adversária (pelos golos esperados da equipa) e,
   quando há odds de marcador, puxa 60% para elas. A forma recente fica como alerta: a «mão quente»
   no futebol é fraca e as casas já a refletem nas odds.
   ===================================================================== */
loadLeagueScorers = async function (code) {
  const c = playersCache();
  const hit = c.leagues[code];
  if (hit && hit.v && hit.v.__v === 2 && Date.now() - hit.t < 12 * 3600e3) return hit.v;
  const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${ymd(seasonStart())}-${ymd(new Date())}&limit=1000`);
  const teams = { __v: 2 };
  const T = id => (teams[id] = teams[id] || { goals: {}, teamGoals: 0, games: 0, dates: [], gd: [] });
  const evs = (j.events || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  evs.forEach(ev => {
    const comp = ev.competitions && ev.competitions[0];
    if (!comp) return;
    const st = ((comp.status || ev.status || {}).type) || {};
    if (!(st.completed || st.state === 'post') || /POSTPON|CANCEL|ABANDON|SUSPEND/i.test(String(st.name || '') + String(st.description || ''))) return;
    (comp.competitors || []).forEach(cp => { const t = T(String(cp.team.id)); t.games++; t.teamGoals += scoreVal(cp.score) || 0; t.dates.push(ev.date); });
    (comp.details || []).forEach(d => {
      if (!(d.scoringPlay || /goal/i.test((d.type && d.type.text) || '')) || d.ownGoal) return;
      const a = (d.athletesInvolved || [])[0];
      const tid = String((d.team && d.team.id) || (a && a.team && a.team.id) || '');
      if (!a || !tid) return;
      const nm = a.displayName || a.shortName;
      const t = T(tid);
      t.goals[nm] = (t.goals[nm] || 0) + 1;
      t.gd.push([nm, ev.date]);
      if (d.penaltyKick) { t.pens = t.pens || {}; t.pens[nm] = (t.pens[nm] || 0) + 1; }
    });
  });
  Object.keys(teams).forEach(id => {
    const t = teams[id]; if (!t || !t.dates) return;
    const last5 = t.dates.slice(-5), from = last5[0];
    t.g5 = {}; t.in5 = {};
    if (from) {
      const games = {};
      t.gd.forEach(([nm, d]) => { if (d >= from) { t.g5[nm] = (t.g5[nm] || 0) + 1; (games[nm] = games[nm] || new Set()).add(d); } });
      Object.keys(games).forEach(nm => { t.in5[nm] = games[nm].size; });
    }
    t.n5 = last5.length;
    delete t.gd; delete t.dates;
  });
  c.leagues[code] = { t: Date.now(), v: teams };
  lsSet(PLAYERS_KEY, c);
  return teams;
};
function mergeScorers(list) {
  const out = { __v: 2 };
  (list || []).filter(Boolean).forEach((S, idx) => Object.keys(S).forEach(id => {
    if (id === '__v') return;
    const s = S[id], o = out[id] = out[id] || { goals: {}, teamGoals: 0, games: 0, g5: {}, in5: {}, n5: 0, pens: {} };
    Object.entries(s.goals || {}).forEach(([n, g]) => { o.goals[n] = (o.goals[n] || 0) + g; });
    Object.entries(s.pens || {}).forEach(([n, g]) => { o.pens[n] = (o.pens[n] || 0) + g; });
    o.teamGoals += s.teamGoals || 0; o.games += s.games || 0;
    // a forma recente vem da liga (mais jogos); a prova europeia só completa
    if ((s.n5 || 0) > o.n5) { o.g5 = { ...(s.g5 || {}) }; o.in5 = { ...(s.in5 || {}) }; o.n5 = s.n5 || 0; }
  }));
  return out;
}
playerBoard = (function (prev) {
  return async function (m) {
    try {
      if (m && m.espn && /^uefa/.test(m.espn.code || '')) {
        const { code, h, a, ev } = m.espn;
        const doms = [...new Set([domOf(h), domOf(a)].filter(Boolean))];
        const [eu, rh, ra, lu, ...dl] = await Promise.all([
          loadLeagueScorers(code).catch(() => null), loadRoster(code, h).catch(() => []), loadRoster(code, a).catch(() => []),
          ev ? loadLineups(code, ev).catch(() => null) : Promise.resolve(null),
          ...doms.map(d => loadLeagueScorers(d).catch(() => null))
        ]);
        const sc = mergeScorers([eu, ...dl]);
        const b = buildBoard(m, sc, { [h]: rh, [a]: ra }, lu);
        b.scoreFrom = doms.length ? 'liga + Europa' : 'Europa';
        BOARD_MEM[boardKey(m)] = b;
        return b;
      }
    } catch (e) { console.warn(e); }
    return prev.apply(this, arguments);
  };
})(playerBoard);
/* a forma de cada jogador entra na ficha */
buildBoard = (function (prev) {
  return function (m, scorers, rosters, lineups) {
    const b = prev(m, scorers, rosters, lineups);
    try {
      [['home', m.espn && m.espn.h], ['away', m.espn && m.espn.a]].forEach(([side, tid]) => {
        const s = scorers && scorers[tid]; if (!s || !s.g5) return;
        (b[side] || []).forEach(p => {
          const k = Object.keys(s.g5).find(n => normTxt(n) === normTxt(p.name)) || Object.keys(s.g5).find(n => nameHit(p.name, n) != null && normTxt(n).split(' ').pop() === normTxt(p.name).split(' ').pop());
          p.g5 = k ? s.g5[k] : 0; p.in5 = k ? (s.in5[k] || 0) : 0; p.n5 = s.n5 || 0;
        });
      });
    } catch (e) {}
    return b;
  };
})(buildBoard);

/* ---------- defesa do adversário ---------- */
function defenceOf(m, side) {
  // side = equipa que DEFENDE ('h' ou 'a'); usa a tabela da liga dessa equipa
  try {
    const id = String(side === 'h' ? m.espn.h : m.espn.a), code = /^uefa/.test(m.espn.code || '') ? domOf(id) : m.espn.code;
    const L = lsGet(LIVE_KEY, null), S = L && L.standings && L.standings[code], T = S && S[0] && S[0].table;
    if (!T || !T.length) return null;
    const row = T.find(r => String(r.team && r.team.id) === id); if (!row || !(row.playedGames >= 4)) return null;
    const gp = T.reduce((s, r) => s + (r.playedGames || 0), 0), ga = T.reduce((s, r) => s + (r.goalsAgainst || 0), 0);
    const avg = gp ? ga / gp : 1.35, mine = row.goalsAgainst / row.playedGames;
    const rank = T.slice().sort((x, y) => (y.goalsAgainst / Math.max(1, y.playedGames)) - (x.goalsAgainst / Math.max(1, x.playedGames))).findIndex(r => r === row) + 1;
    return { ga: mine, avg, ratio: mine / avg, rank, n: T.length, weak: mine >= avg * 1.25 && rank <= Math.ceil(T.length / 3) };
  } catch (e) { return null; }
}
const hotOf = p => p && ((p.g5 || 0) >= 3 || (p.in5 || 0) >= 3);
function scorerAlerts(m) {
  const st = typeof studyFor === 'function' ? studyFor(m) : null;
  const b = (st && st.board) || (typeof boardFor === 'function' && boardFor(m));
  if (!b || !m.espn) return [];
  const out = [];
  [['home', 'a', m.home, m.away], ['away', 'h', m.away, m.home]].forEach(([side, oppSide, team, opp]) => {
    const def = defenceOf(m, oppSide);
    (b[side] || []).filter(p => p.status !== 'fora' && p.status !== 'lesão' && p.status !== 'suplente').forEach(p => {
      const hot = hotOf(p), soft = def && def.weak && p.prob >= 0.25;
      if (!hot && !soft) return;
      out.push({ p, team, opp, def, hot, soft, score: (hot ? 1 : 0) + (soft ? 1 : 0) + p.prob });
    });
  });
  return out.sort((x, y) => y.score - x.score).slice(0, 3);
}
function alertLine(a) {
  const p = a.p, bits = [];
  if (a.hot) bits.push(`🔥 ${p.g5} golo${p.g5 === 1 ? '' : 's'} nos últimos ${p.n5 || 5} jogos${p.in5 ? ` (marcou em ${p.in5})` : ''}`);
  if (a.def && a.def.weak) bits.push(`🛡️ ${esc(a.opp)} sofre ${a.def.ga.toFixed(1).replace('.', ',')} golos/jogo (média da liga ${a.def.avg.toFixed(1).replace('.', ',')}, ${a.def.rank}.ª pior defesa)`);
  return `<b>${esc(p.name)}</b> <span class="muted">(${esc(a.team)})</span> · ${bits.join(' · ')} → marca: <b>${pct(p.prob)}</b> · odd justa ${fairOdd(p.prob)}`;
}
function alertsHTML(m) {
  const A = scorerAlerts(m); if (!A.length) return '';
  return `<div class="reason" style="margin-top:8px;"><div class="rz-head">🎯 Alerta de marcador</div><div style="font-size:.86rem;line-height:1.55;">${A.map(alertLine).join('<br>')}</div>
    <div class="muted" style="font-size:.74rem;margin-top:4px;">A probabilidade já conta a defesa do adversário${A.some(a => a.p.mkt != null) ? ' e as odds de marcador das casas' : ''}. A forma recente é um sinal, não uma garantia.</div></div>`;
}
reasoningHTML = (function (prev) { return function (m) { let h = prev(m); try { h += alertsHTML(m); } catch (e) {} return h; }; })(reasoningHTML);
playerLine = (function (prev) {
  return function (m, p) {
    let h = prev(m, p);
    try {
      if ((p.g5 || 0) >= 2) h += ` · 🔥 ${p.g5} nos últimos ${p.n5 || 5}`;
      const b = boardFor(m) || (studyFor(m) && studyFor(m).board);
      if (b && m.espn) {
        const isHome = (b.home || []).some(x => x.name === p.name);
        const def = defenceOf(m, isHome ? 'a' : 'h');
        if (def && def.weak) h += ` · 🛡️ ${esc(isHome ? m.away : m.home)} sofre ${def.ga.toFixed(1).replace('.', ',')}/jogo`;
      }
    } catch (e) {}
    return h;
  };
})(playerLine);
/* o campo marca quem está quente */
pitchHTML = (function (prev) {
  return function (m) {
    let h = prev(m);
    try {
      const A = scorerAlerts(m);
      if (A.length && h) h = h.replace(/(<div class="zpitch-notes">|<div class="muted" style="font-size:\.72rem;margin-top:4px;">)/, `<div class="zpitch-notes">${A.map(a => '🎯 ' + alertLine(a)).join('<br>')}</div>$1`);
    } catch (e) {}
    return h;
  };
})(pitchHTML);
