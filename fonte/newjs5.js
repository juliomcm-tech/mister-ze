/* =====================================================================
   v17 · BASE DE JOGADORES + FICHA DO JOGO
   Golos da época por jogador (calculados dos jogos da liga), plantel com
   posições/lesões, onze titular quando sai, nomes com erros de escrita.
   ===================================================================== */
const PLAYERS_KEY = 'ze_players_v2';
const BOARD_MEM = {};

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
/** «prestiani» ≈ «Prestianni», «pavlidis» ≈ «Vangelis Pavlidis» */
function nameHit(q, name) {
  const qt = normTxt(q).split(' ').filter(t => t.length >= 4);
  const nt = normTxt(name).split(' ').filter(t => t.length >= 4);
  let best = 99;
  qt.forEach(a => nt.forEach(b => { const d = lev(a, b); const tol = b.length >= 8 ? 2 : 1; if (d <= tol) best = Math.min(best, d); }));
  return best === 99 ? null : best;
}
function seasonStart() {
  const d = new Date();
  return new Date(d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1, 6, 15);
}
function playersCache() { return lsGet(PLAYERS_KEY, { leagues: {}, rosters: {}, lineups: {} }); }

/** Golos por jogador numa liga, a partir de todos os jogos da época */
async function loadLeagueScorers(code) {
  const c = playersCache();
  const hit = c.leagues[code];
  if (hit && Date.now() - hit.t < 12 * 3600e3) return hit.v;
  const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${ymd(seasonStart())}-${ymd(new Date())}&limit=1000`);
  const teams = {};
  const T = id => (teams[id] = teams[id] || { goals: {}, teamGoals: 0, games: 0 });
  (j.events || []).forEach(ev => {
    const comp = ev.competitions && ev.competitions[0];
    if (!comp) return;
    const st = ((comp.status || ev.status || {}).type) || {};
    if (!(st.completed || st.state === 'post')) return;
    (comp.competitors || []).forEach(cp => { const t = T(String(cp.team.id)); t.games++; t.teamGoals += scoreVal(cp.score) || 0; });
    (comp.details || []).forEach(d => {
      if (!(d.scoringPlay || /goal/i.test((d.type && d.type.text) || '')) || d.ownGoal) return;
      const a = (d.athletesInvolved || [])[0];
      const tid = String((d.team && d.team.id) || (a && a.team && a.team.id) || '');
      if (!a || !tid) return;
      const nm = a.displayName || a.shortName;
      const t = T(tid);
      t.goals[nm] = (t.goals[nm] || 0) + 1;
      if (d.penaltyKick) { t.pens = t.pens || {}; t.pens[nm] = (t.pens[nm] || 0) + 1; }
    });
  });
  c.leagues[code] = { t: Date.now(), v: teams };
  lsSet(PLAYERS_KEY, c);
  return teams;
}
/** Plantel: nomes, posições, lesões */
async function loadRoster(code, teamId) {
  const c = playersCache();
  const k = code + '|' + teamId;
  if (c.rosters[k] && Date.now() - c.rosters[k].t < 24 * 3600e3) return c.rosters[k].v;
  const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/teams/${teamId}/roster`);
  let list = j.athletes || [];
  if (list.length && list[0].items) list = list.flatMap(g => g.items || []);
  const v = list.map(a => ({
    name: a.displayName || a.fullName || a.shortName,
    pos: ((a.position && (a.position.abbreviation || a.position.name)) || '').toUpperCase().slice(0, 1),
    inj: Array.isArray(a.injuries) && a.injuries.length ? (a.injuries[0].status || a.injuries[0].type || 'lesionado') : null
  })).filter(a => a.name);
  c.rosters[k] = { t: Date.now(), v };
  lsSet(PLAYERS_KEY, c);
  return v;
}
/** Ficha do jogo: onze titular e suplentes (sai ~1h antes) */
async function loadLineups(code, eventId) {
  const c = playersCache();
  const k = code + '|' + eventId;
  if (c.lineups[k] && Date.now() - c.lineups[k].t < 20 * 60e3) return c.lineups[k].v;
  const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/summary?event=${eventId}`);
  const v = {};
  (j.rosters || []).forEach(r => {
    const tid = String((r.team && r.team.id) || '');
    const rows = r.roster || [];
    if (!tid || !rows.length) return;
    v[tid] = {
      formation: r.formation || null,
      starters: rows.filter(x => x.starter).map(x => (x.athlete && (x.athlete.displayName || x.athlete.shortName)) || ''),
      bench: rows.filter(x => !x.starter).map(x => (x.athlete && (x.athlete.displayName || x.athlete.shortName)) || ''),
      xi: rows.filter(x => x.starter).map(x => ({ n: (x.athlete && (x.athlete.displayName || x.athlete.shortName)) || '', pos: (x.position && x.position.abbreviation) || '', fp: +x.formationPlace || 0, j: x.jersey || '' }))
    };
  });
  c.lineups[k] = { t: Date.now(), v };
  lsSet(PLAYERS_KEY, c);
  return v;
}

const POS_PRIOR = { F: 0.17, M: 0.07, D: 0.025, G: 0.001 };
/** Junta tudo: jogadores das duas equipas com probabilidade de marcar neste jogo */
function buildBoard(m, scorers, rosters, lineups) {
  const r = modelo(m);
  const side = (tid, lam, teamName) => {
    const sc = (scorers && scorers[tid]) || { goals: {}, teamGoals: 0, games: 0 };
    const ros = (rosters && rosters[tid]) || [];
    const lu = lineups && lineups[tid];
    const names = new Map();
    ros.forEach(p => names.set(normTxt(p.name), { ...p }));
    Object.keys(sc.goals).forEach(n => { const k = normTxt(n); if (!names.has(k)) names.set(k, { name: n, pos: '', inj: null }); });
    const k = 6;
    const tg = Math.max(sc.teamGoals, Object.values(sc.goals).reduce((s, x) => s + x, 0));
    const inLineup = (list, n) => (list || []).some(x => nameHit(n, x) != null && normTxt(x).split(' ').pop() === normTxt(n).split(' ').pop());
    return [...names.values()].map(p => {
      const goals = sc.goals[p.name] || Object.entries(sc.goals).filter(([n]) => normTxt(n) === normTxt(p.name)).reduce((s, [, g]) => s + g, 0);
      const prior = POS_PRIOR[p.pos] != null ? POS_PRIOR[p.pos] : 0.05;
      const share = (goals + prior * k) / (tg + k);
      let status = null, mf = 0.7;
      if (lu && (lu.starters.length || lu.bench.length)) {
        if (inLineup(lu.starters, p.name)) { status = 'titular'; mf = 0.9; }
        else if (inLineup(lu.bench, p.name)) { status = 'suplente'; mf = 0.25; }
        else { status = p.inj ? 'lesão' : 'fora'; mf = 0; }
      } else if (p.inj) { status = 'lesão'; mf = 0.05; }
      else if (goals === 0 && p.pos === 'G') mf = 0.9;
      const prob = 1 - Math.exp(-lam * share * mf);
      return { name: p.name, pos: p.pos, inj: p.inj, goals, pens: (sc.pens && sc.pens[p.name]) || 0, teamGoals: tg, games: sc.games, share, status, prob, team: teamName };
    }).sort((a, b) => b.prob - a.prob);
  };
  return {
    t: Date.now(), lineupKnown: !!(lineups && Object.values(lineups).some(x => x.starters && x.starters.length)),
    formation: lineups ? { h: lineups[m.espn.h] && lineups[m.espn.h].formation, a: lineups[m.espn.a] && lineups[m.espn.a].formation } : {},
    home: side(m.espn.h, r.lh, m.home), away: side(m.espn.a, r.la, m.away)
  };
}
function boardKey(m) { return m && m.espn ? m.espn.code + '|' + m.espn.h + '|' + m.espn.a : null; }
function boardFor(m) { const k = boardKey(m); return k && BOARD_MEM[k] && Date.now() - BOARD_MEM[k].t < 30 * 60e3 ? BOARD_MEM[k] : null; }
async function playerBoard(m) {
  if (!m.espn) {
    try { await atualizarTudo({ quiet: true }); } catch (e) {}
    const again = matches.find(x => x.home === m.home && x.away === m.away && x.date === m.date);
    if (again && again.espn) m.espn = again.espn;
  }
  if (!m.espn) return null;
  const { code, h, a, ev } = m.espn;
  const [scorers, rh, ra, lu] = await Promise.all([
    loadLeagueScorers(code).catch(() => null),
    loadRoster(code, h).catch(() => []),
    loadRoster(code, a).catch(() => []),
    ev ? loadLineups(code, ev).catch(() => null) : Promise.resolve(null)
  ]);
  const b = buildBoard(m, scorers, { [h]: rh, [a]: ra }, lu);
  BOARD_MEM[boardKey(m)] = b;
  return b;
}

/* ---------- Overrides: reconhecer qualquer jogador ---------- */
function playersOf(team) {
  const m = zeLastMatch;
  const b = m && boardFor(m);
  if (b) {
    const isHome = teamScore(m.home, normTxt(team)) > 0 || m.home === team;
    const isAway = teamScore(m.away, normTxt(team)) > 0 || m.away === team;
    if (isHome || isAway) return (isHome ? b.home : b.away).map((p, rank) => ({ ...p, rank, team: isHome ? m.home : m.away }));
  }
  const kb = getTeamKB(team);
  if (!kb || !Array.isArray(kb.marcadores)) return [];
  return kb.marcadores.map((s, rank) => {
    const name = s.split('(')[0].trim();
    const g = (s.match(/~?\s*(\d+)\s*golos?/) || [])[1];
    return { name, rank, goals: g ? +g : null, raw: s, team };
  }).filter(p => p.name && !/^[—-]$/.test(p.name) && !/refer[eê]ncia|linha|ataque/i.test(p.name));
}
function playerMentioned(q, m) {
  const b = boardFor(m);
  const pool = b ? b.home.map(p => ({ ...p, team: m.home })).concat(b.away.map(p => ({ ...p, team: m.away })))
    : playersOf(m.home).concat(playersOf(m.away));
  let best = null;
  pool.forEach((p, i) => {
    const d = nameHit(q, p.name);
    if (d == null) return;
    if (teamScore(m.home, normTxt(p.name)) > 0 || teamScore(m.away, normTxt(p.name)) > 0) return; // «Benfica» não é jogador
    if (!best || d < best.d || (d === best.d && (p.goals || 0) > (best.p.goals || 0))) best = { d, p: { ...p, rank: p.rank != null ? p.rank : i } };
  });
  return best ? best.p : null;
}
function scorerProb(m, p) {
  if (p && typeof p.prob === 'number') return p.prob;
  const r = modelo(m);
  const isHome = p.team === m.home || teamScore(m.home, normTxt(p.team)) > 0;
  const lam = isHome ? r.lh : r.la;
  const share = [0.34, 0.2, 0.14][p.rank] || 0.1;
  return 1 - Math.exp(-lam * share * 0.92);
}
function playerLine(m, p) {
  const pr = scorerProb(m, p);
  const posTxt = { F: 'avançado', M: 'médio', D: 'defesa', G: 'guarda-redes' }[p.pos] || '';
  const st = p.status === 'titular' ? ' · ✅ titular' : p.status === 'suplente' ? ' · 🪑 suplente' : p.status === 'fora' ? ' · ❌ fora da ficha' : p.status === 'lesão' ? ` · 🚑 ${esc(p.inj)}` : '';
  const g = p.goals != null && p.teamGoals ? ` · ${p.goals} golo${p.goals === 1 ? '' : 's'} esta época (de ${p.teamGoals} da equipa${p.pens ? `, ${p.pens} de penálti` : ''})` : p.goals ? ` · ~${p.goals} golos` : '';
  return `<b>${esc(p.name)}</b> <span class="muted">(${esc(p.team || '')}${posTxt ? ', ' + posTxt : ''})</span>${g}${st} → marca: <b>${pct(pr)}</b> · odd justa ${fairOdd(pr)}`;
}
function lineupHTML(m, b) {
  if (!b) return '📋 Ainda não tenho a ficha deste jogo.';
  const fmt = (list, team, form) => {
    const tit = list.filter(p => p.status === 'titular');
    const inj = list.filter(p => p.status === 'lesão' || (p.inj && p.status !== 'titular'));
    return `<b>${esc(team)}</b>${form ? ` (${esc(form)})` : ''}: ${tit.length ? tit.map(p => esc(p.name)).join(', ') : '<span class="muted">onze ainda não saiu</span>'}${inj.length ? `<br><span class="muted">🚑 ${inj.slice(0, 5).map(p => `${esc(p.name)} (${esc(p.inj || 'lesão')})`).join(', ')}</span>` : ''}`;
  };
  return `📋 ${b.lineupKnown ? 'Ficha oficial:' : 'Onzes ainda não publicados (costumam sair ~1h antes). Plantel e lesões:'}<br>${fmt(b.home, m.home, b.formation && b.formation.h)}<br>${fmt(b.away, m.away, b.formation && b.formation.a)}`;
}


