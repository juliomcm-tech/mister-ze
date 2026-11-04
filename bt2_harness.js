(async function ZE_LAB2() {
  const NAME = window.__LABNAME || 'x';
  const post = (type, data) => { try { parent.postMessage({ bt2: true, name: NAME, type, data }, '*'); } catch (e) {} };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  window.addEventListener('message', e => {
    const d = e.data; if (!d) return;
    if (d.cmd === '__data') { window.__DATA_IN = d.data; window.__DATA_REPLY = true; return; }
    if (d.cmd && d.id) { let v; try { v = (0, eval)(d.cmd); } catch (err) { v = 'ERR ' + err; } Promise.resolve(v).then(val => post('reply', { id: d.id, val: typeof val === 'string' ? val : JSON.stringify(val) })).catch(err => post('reply', { id: d.id, val: 'ERR ' + err })); }
  });
  try {
    await sleep(2500);
    post('need');
    for (let w = 0; w < 100 && !window.__DATA_REPLY; w++) await sleep(150);
    let DATA = window.__DATA_IN;
    if (!DATA) {
      const LG = ['por.1', 'eng.1', 'eng.2', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'ned.1', 'uefa.champions', 'uefa.europa', 'uefa.europa.conf'];
      const MONTHS = ['202607', '202608', '202609', '202610', '202611'];
      const byId = new Map();
      for (const code of LG) for (const ym of MONTHS) {
        if (!/uefa/.test(code) && ym === '202607') continue;
        try {
          const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${ym}&limit=1000`, { cache: 'no-store' });
          if (r.ok) { const j = await r.json(); (j.events || []).forEach(ev => { const n = normalizeEspn(ev, code, ESPN_LEAGUES[code] || code); if (n && n.status === 'FINISHED' && n.score && n.score.fullTime && n.score.fullTime.home != null) byId.set(n.id, n); }); }
        } catch (e) {}
        post('progress', `jogos ${code} ${ym}: ${byId.size}`);
        await sleep(200);
      }
      DATA = { ALL: [...byId.values()].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate)), ODDS: {} };
    }
    const ALL = DATA.ALL;
    const NOW = Date.UTC(2026, 10, 4);
    const tableBefore = (code, t) => {
      const rows = {};
      ALL.forEach(x => {
        if (x.competition.code !== code || new Date(x.utcDate).getTime() >= t) return;
        const h = x.homeTeam, a = x.awayTeam, hg = x.score.fullTime.home, ag = x.score.fullTime.away;
        const R = (tm) => rows[tm.id] = rows[tm.id] || { team: { id: tm.id, name: tm.name }, playedGames: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
        const rh = R(h), ra = R(a);
        rh.playedGames++; ra.playedGames++; rh.goalsFor += hg; rh.goalsAgainst += ag; ra.goalsFor += ag; ra.goalsAgainst += hg;
        if (hg > ag) rh.points += 3; else if (hg < ag) ra.points += 3; else { rh.points++; ra.points++; }
      });
      return [{ type: 'TOTAL', table: Object.values(rows) }];
    };
    const gamesOf = (id, t, code) => ALL.filter(x => new Date(x.utcDate).getTime() < t && (x.homeTeam.id === id || x.awayTeam.id === id) && (!code || x.competition.code === code));
    const recentFor = (id, t, code) => gamesOf(id, t, code).slice(-10).reverse().map(x => { const home = x.homeTeam.id === id; return { home, gf: home ? x.score.fullTime.home : x.score.fullTime.away, ga: home ? x.score.fullTime.away : x.score.fullTime.home, d: x.utcDate, opp: home ? x.awayTeam.shortName : x.homeTeam.shortName }; });
    const restFor = (id, t) => { const g = gamesOf(id, t); const last = g[g.length - 1]; const nxt = ALL.find(x => new Date(x.utcDate).getTime() > t + 6 * 3600e3 && (x.homeTeam.id === id || x.awayTeam.id === id)); return { since: last ? (t - new Date(last.utcDate).getTime()) / 864e5 : null, until: nxt ? (new Date(nxt.utcDate).getTime() - t) / 864e5 : null }; };
    const DOMC = {}; ALL.forEach(x => { if (/uefa/.test(x.competition.code)) return; [x.homeTeam.id, x.awayTeam.id].forEach(id => { const c = DOMC[id] = DOMC[id] || {}; c[x.competition.code] = (c[x.competition.code] || 0) + 1; }); });
    const domLeague = id => { const c = DOMC[id]; return c ? Object.keys(c).sort((a, b) => c[b] - c[a])[0] : null; };
    const EU = new Set(); ALL.forEach(x => { if (/uefa/.test(x.competition.code)) { EU.add(x.homeTeam.id); EU.add(x.awayTeam.id); } });
    const domMap = {}; Object.keys(DOMC).forEach(id => { domMap[id] = domLeague(id); });
    if (typeof zeEuroSetData === 'function') zeEuroSetData([...EU], domMap);
    const cand = ALL.filter(x => {
      const t = new Date(x.utcDate).getTime(); if (t > NOW) return false;
      const code = x.competition.code;
      if (/uefa/.test(code)) return new Date(x.utcDate) >= new Date('2026-09-10');
      return gamesOf(x.homeTeam.id, t, code).length >= 4 && gamesOf(x.awayTeam.id, t, code).length >= 4;
    });
    const per = {}; const TEST = [];
    cand.slice().reverse().forEach(x => { const c = x.competition.code; per[c] = (per[c] || 0) + 1; if (/uefa/.test(c) || per[c] <= 70) TEST.push(x); });
    post('progress', `jogos: ${ALL.length} · em teste: ${TEST.length}`);
    const ODDS = DATA.ODDS || {};
    let k = 0, fetched = 0;
    for (const x of TEST) {
      if (!ODDS[x.id]) { try { ODDS[x.id] = await coreOdds(x.competition.code, x.id, true); } catch (e) { ODDS[x.id] = []; } fetched++; await sleep(150); }
      if (++k % 50 === 0) post('progress', `odds ${k}/${TEST.length}`);
    }
    DATA.ODDS = ODDS;
    if (!window.__DATA_IN || fetched) post('data', DATA);
    // pré-calcular o que não muda
    const PRE = TEST.map(x => {
      const t = new Date(x.utcDate).getTime(), code = x.competition.code, eu = /uefa/.test(code);
      return { x, t, code, eu, S: computeStrengths(tableBefore(code, t)), recH: recentFor(x.homeTeam.id, t, eu ? null : code), recA: recentFor(x.awayTeam.id, t, eu ? null : code), restH: restFor(x.homeTeam.id, t), restA: restFor(x.awayTeam.id, t), nh: gamesOf(x.homeTeam.id, t, code).length, na: gamesOf(x.awayTeam.id, t, code).length };
    });
    const res3 = (i, j) => [i > j ? 1 : 0, i === j ? 1 : 0, i < j ? 1 : 0];
    const brier = (q, o) => (q[0] - o[0]) ** 2 + (q[1] - o[1]) ** 2 + (q[2] - o[2]) ** 2;
    const agg = (rows, f) => { const v = rows.map(f).filter(z => z != null && isFinite(z)); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(4) : null; };
    const SAFE_K = ['1', '1X', 'O1.5', 'O2.5', 'BTTS', 'U2.5', 'X2', '2'];
    window.__run = function (opts) {
      opts = opts || {};
      if (typeof ZE_TUNE !== 'undefined' && opts.tune) Object.assign(ZE_TUNE, opts.tune);
      if (typeof ZE_FATIGUE_ON !== 'undefined' && opts.fatigue != null) ZE_FATIGUE_ON = opts.fatigue;
      try { MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear(); } catch (e) {}
      const R = [];
      for (const P of PRE) {
        const { x, t, code, eu } = P;
        const lam = lambdasLive(P.S, x.homeTeam.id, x.awayTeam.id); if (!lam) continue;
        const d = new Date(x.utcDate);
        const m = { phase: 'imediato', type: 'best', fav: false, live: true, home: x.homeTeam.shortName || x.homeTeam.name, away: x.awayTeam.shortName || x.awayTeam.name, date: dayLabel(d), league: x.competition.name, lambdas: lam, espn: { h: x.homeTeam.id, a: x.awayTeam.id, code, ev: x.id }, kickoff: '20:00', bet: '—', prob: '~' };
        const key = mKey(m);
        const i = x.score.fullTime.home, j = x.score.fullTime.away, o = res3(i, j);
        const run = (st) => { if (st) STUDY[key] = st; else delete STUDY[key]; MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear(); return modelo(m); };
        const rA = run(null);
        const stB = { t: Date.now(), m: { home: m.home, away: m.away }, sources: [], recentH: P.recH, recentA: P.recA, restH: P.restH, restA: P.restA, allT: Date.now(), oddsTried: Date.now(), books: [] };
        const rB = run(stB);
        const books = ODDS[x.id] || [];
        let rC = null, mkt = null, vb = null;
        if (books.length && !opts.skipC) {
          const stC = { ...stB, t: Date.now() + 1, books, market: marketFromBook(books[0]) };
          rC = run(stC); mkt = stC.market;
          const favM = favOf(rC.mk), favK = favOf({ '1': 1 / books[0].odds['1'], X: 1 / books[0].odds.X, '2': 1 / books[0].odds['2'] });
          const best = {};
          books.forEach(b => Object.entries(b.odds).forEach(([kk, od]) => { const p = rC.mk[kk]; if (p == null || !(od > 1) || !MARKET_CONDS[kk]) return; if (!best[kk] || od > best[kk].o) best[kk] = { k: kk, o: od, p, ev: p * od - 1 }; }));
          const mp = kk => { const bo = books[0].odds; if (OUT_SET[kk]) { const s = 1 / bo['1'] + 1 / bo.X + 1 / bo['2']; return OUT_SET[kk].reduce((a, q) => a + (1 / bo[q]) / s, 0); } const g = /^([OU])(\d+(?:\.\d+)?)$/.exec(kk); if (!g) return null; const ov = bo['O' + g[2]], un = bo['U' + g[2]]; if (!(ov && un)) return null; const tt = 1 / ov + 1 / un; return g[1] === 'O' ? (1 / ov) / tt : (1 / un) / tt; };
          const gate = c => typeof zeValueGate === 'function' ? zeValueGate(c, m).ok : true;
          const ok = Object.values(best).filter(c => c.ev > zeEdgeFor(0.03, c.o) && c.o <= 6 && c.p >= 0.2 && !(mp(c.k) != null && c.p - mp(c.k) > 0.15) && (!isContra(c.k, favM, favK) || c.ev >= CONTRA_EDGE) && gate(c)).sort((a, b) => b.ev - a.ev)[0];
          vb = ok ? { k: ok.k, o: ok.o, p: ok.p, ev: ok.ev, win: MARKET_CONDS[ok.k](i, j) ? 1 : 0 } : null;
        }
        const rS = rC || rB;
        const sb = SAFE_K.map(kk => ({ kk, p: rS.mk[kk] })).filter(z => z.p >= 0.55 && z.p <= 0.85).sort((a, b) => b.p - a.p)[0];
        let safe = null;
        if (sb) { const od = Math.max(0, ...books.map(b => b.odds[sb.kk] || 0)); safe = { k: sb.kk, p: sb.p, win: MARKET_CONDS[sb.kk](i, j) ? 1 : 0, o: od > 1 ? od : null }; }
        const bo = books[0] && books[0].odds;
        R.push({ code, eu, cross: eu && domLeague(x.homeTeam.id) !== domLeague(x.awayTeam.id), de: !eu && (EU.has(x.homeTeam.id) !== EU.has(x.awayTeam.id)) ? (EU.has(x.homeTeam.id) ? 'h' : 'a') : null,
          o, over: i + j > 2.5 ? 1 : 0, goals: i + j, A: [rA.mk['1'], rA.mk.X, rA.mk['2']], B: [rB.mk['1'], rB.mk.X, rB.mk['2']], C: rC ? [rC.mk['1'], rC.mk.X, rC.mk['2']] : null, M: mkt ? [mkt.p1, mkt.pX, mkt.p2] : null,
          oB: rB.mk['O2.5'], oC: rC ? rC.mk['O2.5'] : null, gB: rB.lh + rB.la, conf: rC ? rC.conf : rB.conf, vb, safe, early: P.nh < 6 || P.na < 6,
          margin: bo && bo['1'] && bo.X && bo['2'] ? 1 / bo['1'] + 1 / bo.X + 1 / bo['2'] - 1 : null });
      }
      window.__R = R;
      const block = rows => {
        const wm = rows.filter(r => r.M && r.C);
        const sf = rows.filter(r => r.safe), so = sf.filter(r => r.safe.o), v = rows.filter(r => r.vb);
        return { n: rows.length, nM: wm.length, A: agg(rows, r => brier(r.A, r.o)), B: agg(rows, r => brier(r.B, r.o)), C: agg(wm, r => brier(r.C, r.o)), M: agg(wm, r => brier(r.M, r.o)),
          favB: agg(rows, r => r.o[r.B.indexOf(Math.max(...r.B))]), favC: agg(wm, r => r.o[r.C.indexOf(Math.max(...r.C))]), favM: agg(wm, r => r.o[r.M.indexOf(Math.max(...r.M))]),
          home: agg(rows, r => r.o[0]), pHB: agg(rows, r => r.B[0]), pHC: agg(wm, r => r.C[0]), draw: agg(rows, r => r.o[1]), pXB: agg(rows, r => r.B[1]), pXC: agg(wm, r => r.C[1]), pXM: agg(wm, r => r.M[1]),
          over: agg(rows, r => r.over), pOB: agg(rows, r => r.oB), pOC: agg(wm, r => r.oC), goals: agg(rows, r => r.goals), gB: agg(rows, r => r.gB),
          safeN: sf.length, safeHit: agg(sf, r => r.safe.win), safeP: agg(sf, r => r.safe.p), safeNo: so.length, safeROI: agg(so, r => r.safe.win ? r.safe.o - 1 : -1), safeOdd: agg(so, r => r.safe.o),
          vbN: v.length, vbHit: agg(v, r => r.vb.win), vbROI: agg(v, r => r.vb.win ? r.vb.o - 1 : -1), vbOdd: agg(v, r => r.vb.o), vbP: agg(v, r => r.vb.p),
          margin: agg(rows, r => r.margin), confs: rows.reduce((a, r) => (a[r.conf] = (a[r.conf] || 0) + 1, a), {}) };
      };
      const S = { all: block(R), dom: block(R.filter(r => !r.eu)), eu: block(R.filter(r => r.eu)), cross: block(R.filter(r => r.cross)), euSame: block(R.filter(r => r.eu && !r.cross)),
        domEuro: block(R.filter(r => r.de)), domNone: block(R.filter(r => !r.eu && !r.de)), early: block(R.filter(r => r.early)) };
      window.__S = S;
      return S;
    };
    const S0 = window.__run({});
    post('done', { n: S0.all.n });
  } catch (e) { post('error', String(e && e.stack || e)); }
})();
