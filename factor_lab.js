(async function FLAB() {
  const post = (type, data) => { window.__FLMSG = type + ': ' + String(data).slice(0, 200); };
  const sleep = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });   // sem temporizadores (separadores em segundo plano travam-nos)
  try {
    const LG = window.__FL_LG, UEFA = ['uefa.champions', 'uefa.europa', 'uefa.europa.conf'], MONTHS = window.__FL_MONTHS, CAP = window.__FL_CAP || 110, END = window.__FL_END;
    const byId = new Map();
    for (const code of LG.concat(UEFA)) for (const ym of MONTHS) {
      try {
        const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${ym}&limit=1000`, { cache: 'no-store' });
        if (r.ok) { const j = await r.json(); (j.events || []).forEach(ev => { const n = normalizeEspn(ev, code, ESPN_LEAGUES[code] || code); if (n && n.status === 'FINISHED' && n.score && n.score.fullTime && n.score.fullTime.home != null) byId.set(n.id, n); }); }
      } catch (e) {}
      post('progress', `jogos ${code} ${ym}: ${byId.size}`);
      await sleep(150);
    }
    const ALL = [...byId.values()].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
    ALL.forEach(x => { x._t = new Date(x.utcDate).getTime(); });
    const TG = {}; ALL.forEach(x => { [x.homeTeam.id, x.awayTeam.id].forEach(id => (TG[id] = TG[id] || []).push(x)); });
    const gamesOf = (id, t, code) => (TG[id] || []).filter(x => x._t < t && (!code || x.competition.code === code));
    const tableBefore = (code, t) => {
      const rows = {};
      ALL.forEach(x => {
        if (x.competition.code !== code || x._t >= t) return;
        const h = x.homeTeam, a = x.awayTeam, hg = x.score.fullTime.home, ag = x.score.fullTime.away;
        const R = tm => rows[tm.id] = rows[tm.id] || { team: { id: tm.id, name: tm.name }, playedGames: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
        const rh = R(h), ra = R(a);
        rh.playedGames++; ra.playedGames++; rh.goalsFor += hg; rh.goalsAgainst += ag; ra.goalsFor += ag; ra.goalsAgainst += hg;
        if (hg > ag) rh.points += 3; else if (hg < ag) ra.points += 3; else { rh.points++; ra.points++; }
      });
      return [{ type: 'TOTAL', table: Object.values(rows) }];
    };
    const recentFor = (id, t, code) => gamesOf(id, t, code).slice(-10).reverse().map(x => { const home = x.homeTeam.id === id; return { home, gf: home ? x.score.fullTime.home : x.score.fullTime.away, ga: home ? x.score.fullTime.away : x.score.fullTime.home, d: x.utcDate, opp: home ? x.awayTeam.shortName : x.homeTeam.shortName }; });
    const restFor = (id, t) => { const g = gamesOf(id, t); const last = g[g.length - 1]; const nxt = (TG[id] || []).find(x => x._t > t + 6 * 3600e3); return { since: last ? (t - last._t) / 864e5 : null, until: nxt ? (nxt._t - t) / 864e5 : null }; };
    const euroNear = (id, t, before, after) => (TG[id] || []).some(x => /uefa/.test(x.competition.code) && ((x._t > t + 3600e3 && x._t - t < after * 864e5) || (x._t < t - 3600e3 && t - x._t < before * 864e5) ));
    const euroNext = (id, t) => (TG[id] || []).some(x => /uefa/.test(x.competition.code) && x._t > t + 3600e3 && x._t - t < 4.5 * 864e5);
    const euroPrev = (id, t) => (TG[id] || []).some(x => /uefa/.test(x.competition.code) && x._t < t - 3600e3 && t - x._t < 3.5 * 864e5);
    const DOMC = {}; ALL.forEach(x => { if (/uefa/.test(x.competition.code)) return; [x.homeTeam.id, x.awayTeam.id].forEach(id => { const c = DOMC[id] = DOMC[id] || {}; c[x.competition.code] = (c[x.competition.code] || 0) + 1; }); });
    const domLeague = id => { const c = DOMC[id]; return c ? Object.keys(c).sort((a, b) => c[b] - c[a])[0] : null; };
    const EU = new Set(); ALL.forEach(x => { if (/uefa/.test(x.competition.code)) { EU.add(x.homeTeam.id); EU.add(x.awayTeam.id); } });
    const domMap = {}; Object.keys(DOMC).forEach(id => { domMap[id] = domLeague(id); });
    if (typeof zeEuroSetData === 'function') zeEuroSetData([...EU], domMap);
    // nº de equipas por liga (para «jogo sem nada em jogo»)
    const NT = {}; ALL.forEach(x => { if (/uefa/.test(x.competition.code)) return; const s = NT[x.competition.code] = NT[x.competition.code] || new Set(); s.add(x.homeTeam.id); s.add(x.awayTeam.id); });
    const cand = ALL.filter(x => !/uefa/.test(x.competition.code) && x._t < END && gamesOf(x.homeTeam.id, x._t, x.competition.code).length >= 4 && gamesOf(x.awayTeam.id, x._t, x.competition.code).length >= 4);
    const per = {}; const TEST = [];
    cand.slice().reverse().forEach(x => { const c = x.competition.code; per[c] = (per[c] || 0) + 1; if (per[c] <= CAP) TEST.push(x); });
    post('progress', `jogos ${ALL.length} · em teste ${TEST.length}`);
    // odds (casa principal) + abertura/fecho da DraftKings
    const ODDS = window.__FL_ODDS = window.__FL_ODDS || {}, OC = window.__FL_OC = window.__FL_OC || {};
    const dec = x => x && x.moneyLine ? (x.moneyLine.decimal || null) : null;
    let k = 0;
    for (const x of TEST) {
      k++;
      if (ODDS[x.id]) continue;
      let j = null;
      try { const r = await fetch(`https://sports.core.api.espn.com/v2/sports/soccer/leagues/${x.competition.code}/events/${x.id}/competitions/${x.id}/odds`, { cache: 'no-store' }); j = r.ok ? await r.json() : null; } catch (e) {}
      const books = [];
      ((j && j.items) || []).forEach(it => {
        const name = ((it.provider && it.provider.name) || 'casa').replace(/^Bet 365$/i, 'Bet365'); if (/live/i.test(name)) return;
        const T = (it.bettingOdds && it.bettingOdds.teamOdds) || {}; const g = kk => fracOdd(T[kk] && T[kk].value); const o = {};
        if (Object.keys(T).length) {
          o['1'] = g('preMatchFullTimeResultHome'); o.X = g('preMatchFullTimeResultDraw'); o['2'] = g('preMatchFullTimeResultAway');
          o['1X'] = g('preMatchDoubleChanceHomeOrDraw'); o.X2 = g('preMatchDoubleChanceDrawOrAway'); o['12'] = g('preMatchDoubleChanceHomeOrAway');
          const line = parseFloat(T.preMatchOverUnderHandicap && T.preMatchOverUnderHandicap.value); if (line > 0) { o['O' + line] = g('preMatchGoalLineOver'); o['U' + line] = g('preMatchGoalLineUnder'); }
        }
        if (!(o['1'] && o.X && o['2'])) { o['1'] = sideOdd(it.homeTeamOdds); o.X = sideOdd(it.drawOdds); o['2'] = sideOdd(it.awayTeamOdds); }
        const ou = Number(it.overUnder), oo = sideOdd(it.overOdds), uo = sideOdd(it.underOdds); if (ou > 0 && oo > 1 && uo > 1 && !o['O' + ou]) { o['O' + ou] = oo; o['U' + ou] = uo; }
        Object.keys(o).forEach(kk => { if (!(o[kk] > 1)) delete o[kk]; else o[kk] = +o[kk].toFixed(3); });
        if (!(o['1'] && o.X && o['2'])) return;
        books.push({ provider: name, odds: o, scorers: [] });
        if (it.homeTeamOdds && it.homeTeamOdds.open && !OC[x.id]) {
          const tot = s => it[s] && it[s].over && it[s].under ? { o: it[s].over.decimal, u: it[s].under.decimal } : null;
          OC[x.id] = { line: Number(it.overUnder) || null, oh: dec(it.homeTeamOdds.open), oa: dec(it.awayTeamOdds && it.awayTeamOdds.open), ch: dec(it.homeTeamOdds.close), ca: dec(it.awayTeamOdds && it.awayTeamOdds.close), ot: tot('open'), ct: tot('close') };
        }
      });
      books.sort((a, b) => (/365/.test(b.provider) ? 1 : 0) - (/365/.test(a.provider) ? 1 : 0));
      ODDS[x.id] = books;
      if (k % 25 === 0) post('progress', `odds ${k}/${TEST.length}`);
      await sleep(120);
    }
    post('progress', 'a decidir…');
    // ---- decidir jogo a jogo, por ordem de data (o histórico só tem o passado) ----
    try { localStorage.removeItem(ZARCH_KEY); } catch (e) {}
    const A = { v: 1, rows: {} };
    const DERBY = [['Benfica', 'Sporting'], ['Benfica', 'Porto'], ['Sporting', 'Porto'], ['Arsenal', 'Tottenham'], ['Liverpool', 'Everton'], ['Manchester United', 'Manchester City'], ['Real Madrid', 'Atl'], ['Barcelona', 'Espanyol'], ['Sevilla', 'Betis'], ['Milan', 'Inter'], ['Roma', 'Lazio'], ['Juventus', 'Torino'], ['Genoa', 'Sampdoria'], ['Ajax', 'Feyenoord'], ['Ajax', 'PSV'], ['Feyenoord', 'PSV'], ['Marseille', 'Paris'], ['Lyon', 'Saint-'], ['Dortmund', 'Schalke'], ['Hamburg', 'St. Pauli'], ['Bayern', 'Dortmund'], ['Newcastle', 'Sunderland'], ['Chelsea', 'Arsenal'], ['Chelsea', 'Tottenham'], ['Athletic', 'Real Sociedad'], ['Valencia', 'Villarreal'], ['Napoli', 'Roma'], ['Braga', 'Guimar']];
    const isDerby = (h, a) => DERBY.some(([p, q]) => (h.includes(p) && a.includes(q)) || (h.includes(q) && a.includes(p)));
    const nothing = (code, t, id) => {
      const T = tableBefore(code, t)[0].table.slice().sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));
      const n = NT[code] ? NT[code].size : T.length, R = 2 * (n - 1), me = T.find(r => String(r.team.id) === String(id)); if (!me) return null;
      const rem = R - me.playedGames; if (rem > 6 || rem < 1) return false;
      const p6 = T[5] ? T[5].points : 99, relIdx = n - 3, pRel = T[relIdx] ? T[relIdx].points : 0;
      return me.points + 3 * rem < p6 && me.points - pRel > 3 * rem;
    };
    const rows = [];
    const ord = TEST.slice().sort((a, b) => a._t - b._t);
    for (const x of ord) {
      const t = x._t, code = x.competition.code;
      const S = computeStrengths(tableBefore(code, t));
      const lam = lambdasLive(S, x.homeTeam.id, x.awayTeam.id); if (!lam) continue;
      const books = ODDS[x.id] || []; if (!books.length) continue;
      const d = new Date(x.utcDate);
      const m = { phase: 'imediato', type: 'best', fav: false, live: true, home: x.homeTeam.shortName || x.homeTeam.name, away: x.awayTeam.shortName || x.awayTeam.name, date: dayLabel(d), league: x.competition.name, lambdas: lam, espn: { h: x.homeTeam.id, a: x.awayTeam.id, code, ev: x.id }, kickoff: '20:00', bet: '—', prob: '~' };
      const key = mKey(m), i = x.score.fullTime.home, j = x.score.fullTime.away;
      const restH = restFor(x.homeTeam.id, t), restA = restFor(x.awayTeam.id, t);
      STUDY[key] = { t: Date.now(), m: { home: m.home, away: m.away }, sources: [], recentH: recentFor(x.homeTeam.id, t, code), recentA: recentFor(x.awayTeam.id, t, code), restH, restA, allT: Date.now(), oddsTried: Date.now(), books, market: marketFromBook(books[0]) };
      MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear();
      let z = null, rc = null; try { z = zeLogical(m); rc = modelo(m); } catch (e) {}
      if (!z) { delete STUDY[key]; continue; }
      const o0 = books[0].odds[z.k];
      const c = { m, i: 0, k2: z.k, p: z.p, odd: o0 > 1 ? o0 : null, cat: z.p >= 0.75 ? 'segura' : 'dia', score: 1 };
      let c2 = null; try { c2 = chFixMinOdd(c); } catch (e) { c2 = null; }
      let s = null; if (c2) { ZBRAKE_MEM = null; try { s = zeSelo(m, c2.k2, c2.p, c2.odd); } catch (e) { s = null; } }
      let q = null; try { q = c2 ? seloMktProb(m, c2.k2) : null; } catch (e) {}
      // aposta de valor (como no laboratório anterior)
      let vb = null;
      try {
        const favM = favOf(rc.mk), favK = favOf({ '1': 1 / books[0].odds['1'], X: 1 / books[0].odds.X, '2': 1 / books[0].odds['2'] });
        const best = {};
        books.forEach(b => Object.entries(b.odds).forEach(([kk, od]) => { const p = rc.mk[kk]; if (p == null || !(od > 1) || !MARKET_CONDS[kk]) return; if (!best[kk] || od > best[kk].o) best[kk] = { k: kk, o: od, p, ev: p * od - 1 }; }));
        const gate = cc => typeof zeValueGate === 'function' ? zeValueGate(cc, m).ok : true;
        const ok = Object.values(best).filter(cc => cc.ev > zeEdgeFor(0.03, cc.o) && cc.o <= 6 && cc.o >= ZE_MIN_ODD && cc.p >= 0.2 && (!isContra(cc.k, favM, favK) || cc.ev >= CONTRA_EDGE) && gate(cc)).sort((a, b) => b.ev - a.ev)[0];
        if (ok) vb = { k: ok.k, o: ok.o, p: ok.p, w: MARKET_CONDS[ok.k](i, j) ? 1 : 0 };
      } catch (e) {}
      const kk = c2 ? c2.k2 : null;
      const side = !kk ? null : ['1', '1X'].includes(kk) ? 'h' : ['2', 'X2'].includes(kk) ? 'a' : /^O/.test(kk) ? 'o' : /^U/.test(kk) ? 'u' : null;
      const oc = OC[x.id] || null;
      let drift = null, oddOpen = null;
      if (oc && side === 'h' && oc.oh && oc.ch) drift = oc.ch / oc.oh - 1;
      if (oc && side === 'a' && oc.oa && oc.ca) drift = oc.ca / oc.oa - 1;
      if (oc && side === 'o' && oc.ot && oc.ct && kk === 'O' + oc.line) { drift = oc.ct.o / oc.ot.o - 1; oddOpen = oc.ot.o; }
      if (oc && side === 'u' && oc.ot && oc.ct && kk === 'U' + oc.line) { drift = oc.ct.u / oc.ot.u - 1; oddOpen = oc.ot.u; }
      if (drift != null && c2 && c2.odd > 1 && oddOpen == null) oddOpen = +(c2.odd * (1 + 0)).toFixed(3) / (1 + drift);   // aproximação: a odd da escolha mexe-se como a do lado
      const pid = side === 'h' ? x.homeTeam.id : side === 'a' ? x.awayTeam.id : null, oid = side === 'h' ? x.awayTeam.id : side === 'a' ? x.homeTeam.id : null;
      const rp = side === 'h' ? restH : side === 'a' ? restA : null, ro = side === 'h' ? restA : side === 'a' ? restH : null;
      rows.push({ d: x.utcDate.slice(0, 10), code, k: kk, lk: z.k, p: c2 ? c2.p : z.p, lp: z.p, odd: c2 ? c2.odd : null, q, oddDer: !!(c2 && c2.oddDer), grade: c2 ? (s && s.grade) || 'nenhum' : 'excluido',
        win: kk && MARKET_CONDS[kk] ? (MARKET_CONDS[kk](i, j) ? 1 : 0) : null, lwin: MARKET_CONDS[z.k](i, j) ? 1 : 0, vb,
        f: { drift, oddOpen, side, restP: rp && rp.since, restO: ro && ro.since, untilP: rp && rp.until, euroNextP: pid ? euroNext(pid, t) : null, euroPrevP: pid ? euroPrev(pid, t) : null, euroNextO: oid ? euroNext(oid, t) : null,
          nothingP: pid ? nothing(code, t, pid) : null, nothingO: oid ? nothing(code, t, oid) : null, derby: isDerby(x.homeTeam.name || '', x.awayTeam.name || ''), wk: [0, 6].includes(d.getUTCDay()) } });
      A.rows['bt|' + x.id] = { t: 'aposta', d: x.utcDate.slice(0, 10), lg: x.competition.name, c: code, j: m.home + ' vs ' + m.away, k: z.k, s: '', p: z.p, w: MARKET_CONDS[z.k](i, j) ? 1 : 0, r: i + '-' + j };
      try { localStorage.setItem(ZARCH_KEY, JSON.stringify(A)); } catch (e) {}
      delete STUDY[key];
      if (rows.length % 40 === 0) { post('progress', 'decididos ' + rows.length + '/' + ord.length); await sleep(); }
    }
    window.__FL = rows;
    post('done', rows.length);
  } catch (e) { post('error', String(e && e.stack || e)); }
})()
