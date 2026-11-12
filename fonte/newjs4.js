/* =====================================================================
   v16 · Resultados automáticos, OCR em 2 passes, Zé com seguimento
   ===================================================================== */

/* ---------- OCR: 2.º passe só com texto branco (odds em caixas coloridas) ---------- */
function prepImageWhite(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(2.2, Math.max(1, 1400 / img.width));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      let sum = 0;
      for (let k = 0; k < d.data.length; k += 4) {
        const r = d.data[k], g = d.data[k + 1], b = d.data[k + 2];
        sum += 0.299 * r + 0.587 * g + 0.114 * b;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const v = (mx > 200 && mx - mn < 45) ? 0 : 255;
        d.data[k] = d.data[k + 1] = d.data[k + 2] = v;
      }
      ctx.putImageData(d, 0, 0);
      URL.revokeObjectURL(url);
      res({ canvas: c, dark: sum / (d.data.length / 4) < 110 });
    };
    img.onerror = () => rej(new Error('imagem inválida'));
    img.src = url;
  });
}
/** Junta o passe normal (picks) com o passe branco (odds) — apps de tips */
function mergeTwoPass(a, b) {
  b.legs.forEach(lb => {
    const same = a.legs.find(la => la.home && lb.home && teamScore(la.home, normTxt(lb.home)) > 0 && (!la.away || !lb.away || teamScore(la.away, normTxt(lb.away)) > 0));
    if (same) {
      if (!same.odd && lb.odd) same.odd = lb.odd;
      if (!same.sport && lb.sport) same.sport = lb.sport;
    } else if (lb.home && lb.away) a.legs.push({ ...lb, sel: lb.sel || '' });
  });
  return a;
}
async function ocrFiles(files, status) {
  const slip = { legs: [], totalOdd: null, boost: 0, stake: null, declared: null, text: '' };
  const w = await getOcrWorker(m => {
    if (m.status === 'recognizing text') status(`A ler… ${Math.round(m.progress * 100)}%`);
    else if (/loading|initializ/.test(m.status)) status('A preparar o leitor (1.ª vez demora um pouco)…');
  });
  for (let n = 0; n < files.length; n++) {
    status(`Imagem ${n + 1}/${files.length}…`);
    const canvas = await prepImage(files[n]);
    const { data } = await w.recognize(canvas);
    let one = parseSlip(data.text);
    slip.text += '\n' + data.text;
    const wp = await prepImageWhite(files[n]);
    if (wp.dark || one.legs.some(l => !l.odd)) {
      status(`Imagem ${n + 1}: 2.ª leitura (odds)…`);
      const r2 = await w.recognize(wp.canvas);
      slip.text += '\n' + r2.data.text;
      one = mergeTwoPass(one, parseSlip(r2.data.text));
    }
    mergeSlip(slip, one);
  }
  return slip;
}

/* ---------- Fontes de dados: ESPN público (sem token) ---------- */
const ESPN_LEAGUES = {
  'por.1': 'Liga Portugal', 'por.2': 'Liga Portugal 2', 'eng.1': 'Premier League', 'eng.2': 'Championship',
  'esp.1': 'La Liga', 'ita.1': 'Serie A', 'ger.1': 'Bundesliga', 'fra.1': 'Ligue 1', 'ned.1': 'Eredivisie',
  'den.1': 'Superliga Dinamarca', 'uefa.champions': 'Champions', 'uefa.europa': 'Liga Europa'
};
const PROXIES = [
  u => u,
  u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
  u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u)
];
async function fetchJSON(url) {
  let best = lsGet('ze_proxy_idx', 0), lastErr = null;
  const order = [best].concat([0, 1, 2].filter(i => i !== best));
  for (const i of order) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(PROXIES[i](url), { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (i !== best) lsSet('ze_proxy_idx', i);
      return j;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('sem ligação');
}
function ymd(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
function scoreVal(x) { return x == null ? null : typeof x === 'object' ? Number(x.value != null ? x.value : x.displayValue) : Number(x); }
function normalizeEspn(ev, code, leagueName) {
  const c = ev.competitions && ev.competitions[0];
  if (!c || !c.competitors) return null;
  const H = c.competitors.find(x => x.homeAway === 'home'), A = c.competitors.find(x => x.homeAway === 'away');
  if (!H || !A || !H.team || !A.team) return null;
  const st = ((c.status || ev.status || {}).type) || {};
  // v53d: adiado/cancelado/abandonado vem como «post» sem estar acabado — não é resultado (antes aparecia como 0-0)
  const off = /POSTPON|CANCEL|ABANDON|SUSPEND|FORFEIT|DELAY/i.test(String(st.name || '') + ' ' + String(st.description || ''));
  const done = !off && !!(st.completed || st.state === 'post');
  const scorers = (c.details || []).filter(d => (d.scoringPlay || /goal/i.test((d.type && d.type.text) || '')) && !d.ownGoal)
    .flatMap(d => (d.athletesInvolved || []).map(a => a.displayName || a.shortName || '')).filter(Boolean);
  const tm = t => ({ id: String(t.id), name: t.displayName || t.name, shortName: t.shortDisplayName || t.displayName || t.name, abbr: t.abbreviation || '', color: t.color || '', alt: t.alternateColor || '' });
  return {
    id: String(ev.id), status: off ? 'POSTPONED' : done ? 'FINISHED' : st.state === 'in' ? 'IN_PLAY' : 'TIMED', utcDate: ev.date,
    competition: { code, name: leagueName }, homeTeam: tm(H.team), awayTeam: tm(A.team),
    score: { fullTime: { home: done ? scoreVal(H.score) : null, away: done ? scoreVal(A.score) : null } },
    scorers, sport: code === 'nba' ? 'nba' : 'soccer'
  };
}
function espnStandings(j) {
  const entries = [];
  const walk = o => { if (!o) return; if (o.standings && o.standings.entries) entries.push(...o.standings.entries); (o.children || []).forEach(walk); };
  walk(j);
  if (!entries.length) return null;
  return [{
    type: 'TOTAL', table: entries.map(e => {
      const S = n => { const s = (e.stats || []).find(x => x.name === n || x.type === n); return s ? Number(s.value) || 0 : 0; };
      return { team: { id: String(e.team.id), name: e.team.displayName }, playedGames: S('gamesPlayed'), goalsFor: S('pointsFor'), goalsAgainst: S('pointsAgainst'), points: S('points') };
    })
  }];
}

/* ---------- Liquidação automática ---------- */
const MARKET_CONDS = {
  '1': (i, j) => i > j, 'X': (i, j) => i === j, '2': (i, j) => i < j, '1X': (i, j) => i >= j, 'X2': (i, j) => i <= j, '12': (i, j) => i !== j,
  'O0.5': (i, j) => i + j > 0.5, 'O1.5': (i, j) => i + j > 1.5, 'O2.5': (i, j) => i + j > 2.5, 'U2.5': (i, j) => i + j < 2.5, 'O3.5': (i, j) => i + j > 3.5, 'U3.5': (i, j) => i + j < 3.5,
  'BTTS': (i, j) => i > 0 && j > 0, 'BTTS_N': (i, j) => i === 0 || j === 0
};
function legFromBet(bet) {
  const parts = String(bet.match || '').split(/\s+vs\.?\s+/i);
  if (parts.length < 2) return null;
  return { home: parts[0].trim(), away: parts[1].trim(), sel: bet.pick, market: bet.market };
}
function evMatchesLeg(e, l) {
  const h = normTxt(e.homeTeam.name + ' ' + e.homeTeam.shortName), a = normTxt(e.awayTeam.name + ' ' + e.awayTeam.shortName);
  const hx = expandAliases(h), ax = expandAliases(a);
  const hOk = l.home ? teamScore(l.home, hx) > 0 || teamScore(e.homeTeam.shortName, normTxt(l.home)) > 0 : true;
  const aOk = l.away ? teamScore(l.away, ax) > 0 || teamScore(e.awayTeam.shortName, normTxt(l.away)) > 0 : true;
  return hOk && aOk && (l.home || l.away);
}
function resolveLeg(l, fin, at) {
  const t0 = at ? new Date(at).getTime() - 12 * 3600e3 : 0;
  const e = fin.find(x => new Date(x.utcDate).getTime() >= t0 && evMatchesLeg(x, l));
  if (!e) return null;
  const hg = e.score.fullTime.home, ag = e.score.fullTime.away;
  if (hg == null || ag == null) return null;
  const score = `${hg}-${ag}`;
  if (l.market === 'scorer' || /\bmarca\b/i.test(l.sel || '')) {
    const nm = normTxt(String(l.sel).replace(/\bmarca\b.*$/i, '')).split(' ').filter(x => x.length >= 3).pop();
    if (!nm || !e.scorers) return null;
    if (!e.scorers.length && hg + ag > 0) return null; // sem lista de marcadores → não decido
    return { win: e.scorers.some(s => normTxt(s).includes(nm)), score, e };
  }
  let conds = l.market && MARKET_CONDS[l.market] ? [MARKET_CONDS[l.market]] : null;
  if (!conds) conds = selConds(l.sel || '', { home: l.home || e.homeTeam.shortName, away: l.away || e.awayTeam.shortName });
  if (!conds) return null;
  return { win: conds.every(f => f(hg, ag)), score, e };
}
function settleFromResults(payload) {
  const fin = (payload.matches || []).filter(x => x.status === 'FINISHED' && x.score && x.score.fullTime && x.score.fullTime.home != null);
  if (!fin.length) return [];
  const b = loadBank();
  const report = [];
  const run = (bet, who) => {
    if (bet.status !== 'open') return;
    const legs = Array.isArray(bet.legs) && bet.legs.length ? bet.legs : [legFromBet(bet)];
    if (!legs[0]) return;
    let loss = false, unresolved = false;
    const res = legs.map(l => { const r = resolveLeg(l, fin, bet.at); if (!r) unresolved = true; else if (!r.win) loss = true; return r; });
    const result = loss ? 'loss' : unresolved ? null : 'win';
    if (!result) return;
    bet.status = result; bet.settledAt = new Date().toISOString(); bet.autoSettled = true;
    bet.finalScores = res.filter(Boolean).map(r => `${r.e.homeTeam.shortName} ${r.score} ${r.e.awayTeam.shortName}`).join(' · ');
    if (result === 'win') { const ret = r2(bet.stake * bet.odd); if (who === 'ze') b.ze = r2(b.ze + ret); else b.you = r2(b.you + ret); }
    if (who === 'ze') b.zePeak = Math.max(b.zePeak || 0, b.ze);
    report.push({ who, bet, result });
  };
  b.bets.forEach(x => run(x, 'you'));
  b.zeBets.forEach(x => run(x, 'ze'));
  if (report.length) {
    saveBank(b);
    report.filter(r => r.who === 'ze').forEach(r => registarResultado(r.bet.match + ' · ' + r.bet.pick, r.result === 'win', 'auto-resultado'));
  }
  return report;
}
function reportHTML(rep) {
  if (!rep.length) return '';
  const line = r => `${r.who === 'ze' ? '🤖' : '👤'} ${r.result === 'win' ? '✅' : '❌'} <b>${esc(r.bet.pick)}</b> @ ${Number(r.bet.odd).toFixed(2)} <span class="muted">(${esc(r.bet.finalScores || r.bet.match)})</span> ${r.result === 'win' ? `+${(r.bet.stake * r.bet.odd - r.bet.stake).toFixed(2)} €` : `−${Number(r.bet.stake).toFixed(2)} €`}`;
  const zeW = rep.filter(r => r.who === 'ze' && r.result === 'win').length, zeL = rep.filter(r => r.who === 'ze' && r.result === 'loss').length;
  const yW = rep.filter(r => r.who === 'you' && r.result === 'win').length, yL = rep.filter(r => r.who === 'you' && r.result === 'loss').length;
  let quip = '';
  if (zeW && yL) quip = 'Eu ganhei, tu perdeste. Hoje a matemática ganhou ao coração. 😏';
  else if (yW && zeL) quip = 'Ok… hoje foste melhor. Guarda o print, que isto não se repete muitas vezes.';
  else if (zeL && !zeW) quip = 'Perdi. Acontece — valor esperado não é garantia. Amanhã volto com a mesma disciplina.';
  else if (yL && !yW) quip = 'Mais um para a coleção. Queres que analise o próximo boletim antes de o fazeres?';
  else if (zeW || yW) quip = 'Dia bom. Não te habitues.';
  return `<b>📊 Resultados liquidados:</b><br>${rep.map(line).join('<br>')}<br><br>${quip}`;
}

/* ---------- Botão «Atualizar»: jogos + resultados + liquidação ---------- */
let atualizarBusy = false;
async function atualizarTudo(opts) {
  opts = opts || {};
  const T = opts.quiet ? () => {} : toast;
  if (atualizarBusy) return;
  atualizarBusy = true;
  const st = t => setHTML('liveStatus', t);
  T('📡 A ir buscar jogos e resultados…');
  st('⏳ A ligar…');
  const now = new Date();
  const from = new Date(now.getTime() - 4 * 864e5), to = new Date(now.getTime() + 4 * 864e5);
  const all = [], standings = {};
  let ok = 0, lastErr = null;
  try {
    for (const [code, name] of Object.entries(ESPN_LEAGUES)) {
      st(`⏳ ${name}…`);
      try {
        const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${ymd(from)}-${ymd(to)}&limit=300`);
        (j.events || []).forEach(ev => { const n = normalizeEspn(ev, code, name); if (n) all.push(n); });
        ok++;
      } catch (e) { lastErr = e; }
    }
    const nbaNeeded = loadBank().bets.concat(loadBank().zeBets).some(x => x.status === 'open' && (x.legs || []).some(l => l.sport === 'nba'));
    if (nbaNeeded) {
      try {
        const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${ymd(from)}-${ymd(to)}&limit=300`);
        (j.events || []).forEach(ev => { const n = normalizeEspn(ev, 'nba', 'NBA'); if (n) all.push(n); });
      } catch (e) { lastErr = e; }
    }
    if (!ok) throw lastErr || new Error('sem resposta');
    const withGames = [...new Set(all.filter(x => x.status === 'TIMED').map(x => x.competition.code))].filter(c => c !== 'nba');
    for (const code of withGames) {
      st(`⏳ Classificação ${ESPN_LEAGUES[code]}…`);
      try { const s = espnStandings(await fetchJSON(`https://site.api.espn.com/apis/v2/sports/soccer/${code}/standings`)); if (s) standings[code] = s; } catch (e) {}
    }
  } catch (e) {
    atualizarBusy = false;
    st(`❌ Não consegui ligar (${esc(e && e.message || e)}). O Zé continua com o dossiê${lsGet(LIVE_KEY, null) ? ' e os últimos dados guardados' : ''}.`);
    T('❌ Sem ligação aos resultados.');
    return;
  }
  const payload = { generatedAt: new Date().toISOString(), source: 'espn', matches: all, standings };
  lsSet(LIVE_KEY, payload);
  const added = applyLive(payload);
  const rep = settleFromResults(payload);
  const fin = all.filter(x => x.status === 'FINISHED').length, up = all.filter(x => x.status === 'TIMED').length;
  st(`✅ ${up} jogos por jogar · ${fin} resultados · ${added} novos no radar · ${rep.length} apostas liquidadas · ${new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`);
  lsSet('ze_last_report', { at: payload.generatedAt, html: reportHTML(rep) });
  renderCalendar(); renderBanca(); renderConfig();
  if (rep.length) {
    if (document.getElementById('chatLog')) addChat('bot', reportHTML(rep), rep.some(r => r.who === 'ze' && r.result === 'win') ? 'gozao' : 'pensativo');
    T(`📊 ${rep.length} aposta${rep.length > 1 ? 's' : ''} liquidada${rep.length > 1 ? 's' : ''} automaticamente.`);
  } else {
    const open = loadBank().bets.concat(loadBank().zeBets).filter(x => x.status === 'open').length;
    T(open ? `✅ Atualizado. ${open} aposta${open > 1 ? 's' : ''} ainda à espera de resultado.` : '✅ Atualizado.');
  }
  atualizarBusy = false;
}
async function atualizarJogos() { await atualizarTudo(); }

/* ---------- Registo de boletim com seleções guardadas (para liquidar sozinho) ---------- */
function slipRegistar() {
  const st = document.getElementById('slipStake');
  const stake = Number(st && st.value) || Number(slipState.stake);
  const c = zeCritiqueSlip(slipState, loadBank().you);
  if (!c.ok) { toast('Sem seleções válidas.'); return; }
  if (!(stake > 0)) { alert('Indica o valor (€) do boletim.'); if (st) st.focus(); return; }
  const legs = slipState.legs.filter(l => Number(l.odd) > 1);
  const match = legs.length > 1 ? `${({ 2: 'Dupla', 3: 'Tripla' })[legs.length] || 'Múltipla ' + legs.length + ' seleções'}${slipState.source && slipState.source !== 'Boletim' ? ' · ' + slipState.source : ''}` : (legs[0].home && legs[0].away ? legs[0].home + ' vs ' + legs[0].away : legs[0].sel);
  if (!addBet({
    match, pick: legs.map(l => l.sel || (l.home + ' vs ' + l.away)).join(' + '), odd: r2(c.payout), stake, source: 'boletim',
    legs: legs.map(l => ({ home: l.home || '', away: l.away || '', sel: l.sel || '', odd: Number(l.odd), sport: l.sport || '' })),
    zeCompare: `Zé: ${pct(c.P)} (1 em ${Math.round(1 / c.P)}) · valor ${(c.EV * 100).toFixed(1)}%`
  }, 'you')) return;
  renderBanca();
  toast('📥 Boletim registado. Carrega em «Atualizar» depois dos jogos e eu liquido sozinho.');
}

/* ---------- Não repetir a mesma aposta ---------- */
function zeHasSame(matchKey, label) {
  const n = normTxt(label);
  return loadBank().zeBets.find(x => x.status === 'open' && x.match === matchKey && normTxt(x.pick) === n) || null;
}

/* ---------- Cruzar boletim com dados online (forma, classificação, jogos reais) ---------- */
const FORM_KEY = 'ze_forms_v1';
async function teamForm(code, id) {
  const cache = lsGet(FORM_KEY, {});
  const k = code + '|' + id;
  if (cache[k] && Date.now() - cache[k].t < 12 * 3600e3) return cache[k].v;
  const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/teams/${id}/schedule`);
  const evs = (j.events || []).map(ev => normalizeEspn(ev, code, '')).filter(x => x && x.status === 'FINISHED')
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate)).slice(0, 5);
  const v = evs.map(x => {
    const home = x.homeTeam.id === String(id);
    const gf = home ? x.score.fullTime.home : x.score.fullTime.away, ga = home ? x.score.fullTime.away : x.score.fullTime.home;
    return { r: gf > ga ? 'V' : gf === ga ? 'E' : 'D', gf, ga, opp: home ? x.awayTeam.shortName : x.homeTeam.shortName, home };
  });
  cache[k] = { t: Date.now(), v };
  lsSet(FORM_KEY, cache);
  return v;
}
async function crossCheckSlip(slip, status) {
  status = status || (() => {});
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const p = lsGet(LIVE_KEY, null);
  const age = p && p.generatedAt ? Date.now() - new Date(p.generatedAt).getTime() : Infinity;
  const legs = (slip.legs || []).filter(l => l.sport !== 'nba');
  if (age > 2 * 3600e3 || legs.some(l => !findMatchForLeg(l))) {
    status('🌐 A cruzar com dados online (jogos, classificações)…');
    try { await atualizarTudo({ quiet: true }); } catch (e) {}
  }
  slip._forms = slip._forms || {};
  for (const l of legs) {
    const m = findMatchForLeg(l);
    if (!m || !m.espn) continue;
    for (const side of ['h', 'a']) {
      const k = m.espn.code + '|' + m.espn[side];
      if (slip._forms[k] !== undefined) continue;
      status(`🌐 Forma de ${side === 'h' ? m.home : m.away}…`);
      try { slip._forms[k] = await teamForm(m.espn.code, m.espn[side]); } catch (e) { slip._forms[k] = null; }
    }
  }
  return true;
}
function formPillsTxt(v) {
  return (v || []).slice().reverse().map(x => `<span class="pill ${x.r === 'V' ? 'v' : x.r === 'D' ? 'd' : 'n'}" title="${esc(x.opp)} ${x.gf}-${x.ga}">${x.r}</span>`).join('');
}
function slipFormLines(slip) {
  if (!slip || !slip._forms) return [];
  const out = [];
  (slip.legs || []).forEach(l => {
    const m = findMatchForLeg(l);
    if (!m || !m.espn) return;
    const fh = slip._forms[m.espn.code + '|' + m.espn.h], fa = slip._forms[m.espn.code + '|' + m.espn.a];
    if (!fh && !fa) return;
    const wins = v => (v || []).filter(x => x.r === 'V').length;
    let warn = '';
    const conds = selConds(l.sel || '', m);
    const backsHome = conds && conds.length === 1 && conds[0](2, 0) && !conds[0](0, 2);
    const backsAway = conds && conds.length === 1 && conds[0](0, 2) && !conds[0](2, 0);
    if (backsHome && fh && fh.length >= 4 && wins(fh) <= 1) warn = ` ⚠️ apostas no ${esc(m.home)}, que só ganhou ${wins(fh)} dos últimos ${fh.length}.`;
    if (backsAway && fa && fa.length >= 4 && wins(fa) <= 1) warn = ` ⚠️ apostas no ${esc(m.away)}, que só ganhou ${wins(fa)} dos últimos ${fa.length}.`;
    if (backsHome && fa && fa.length >= 4 && wins(fa) >= 4) warn = ` ⚠️ cuidado: o ${esc(m.away)} vem de ${wins(fa)} vitórias em ${fa.length}.`;
    out.push(`📈 <b>${esc(m.home)}</b> <span class="form">${formPillsTxt(fh)}</span> vs <b>${esc(m.away)}</b> <span class="form">${formPillsTxt(fa)}</span>${warn}`);
  });
  return out;
}
