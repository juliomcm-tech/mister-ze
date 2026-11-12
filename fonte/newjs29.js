
/* =====================================================================
   v42 · pedir pouco à ESPN (testado online: ~150 pedidos num minuto → ESPN responde 503 e bloqueia uns minutos)
   - Atualizar normal: só as ligas principais + as das tuas apostas abertas
   - 3 pedidos de cada vez, com pequenas pausas
   - se a ESPN começar a recusar, pára logo e espera (em vez de insistir por todas as pontes)
   ===================================================================== */
const CORE_LEAGUES = ['por.1', 'eng.1', 'eng.2', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'ned.1', 'uefa.champions', 'uefa.europa', 'uefa.europa.conf'];
const LEAGUE_HINTS = [
  [/liga portugal 2|segunda liga|liga 2/i, 'por.2'], [/liga portugal|primeira liga|liga betclic/i, 'por.1'], [/ta[cç]a de portugal/i, 'por.taca.portugal'],
  [/premier league(?!.*(ukr|ukraine))/i, 'eng.1'], [/championship/i, 'eng.2'], [/fa cup/i, 'eng.fa'], [/la ?liga 2|segunda/i, 'esp.2'], [/la ?liga/i, 'esp.1'],
  [/serie b(?!.*brazil)/i, 'ita.2'], [/serie a(?!.*brazil)/i, 'ita.1'], [/2\.? bundesliga/i, 'ger.2'], [/bundesliga/i, 'ger.1'], [/ligue 2/i, 'fra.2'], [/ligue 1/i, 'fra.1'],
  [/eerste divisie/i, 'ned.2'], [/eredivisie/i, 'ned.1'], [/champions league|liga dos campe/i, 'uefa.champions'], [/conference/i, 'uefa.europa.conf'], [/europa league|liga europa/i, 'uefa.europa'],
  [/turkey super|s[uü]per lig/i, 'tur.1'], [/ukraine/i, 'ukr.1'], [/brazil serie b|brasileir[aã]o s[eé]rie b/i, 'bra.2'], [/brasileir|brazil serie a/i, 'bra.1'], [/copa do brasil/i, 'bra.copa_do_brazil'],
  [/scotland|premiership/i, 'sco.1'], [/belgium|jupiler|pro league/i, 'bel.1'], [/saudi/i, 'ksa.1'], [/argentin/i, 'arg.1'], [/mls/i, 'usa.1']
];
function leagueCodeFromName(name) { const h = LEAGUE_HINTS.find(([re]) => re.test(String(name || ''))); return h ? h[1] : null; }
/* ---------- travão da ESPN ---------- */
let ESPN_OK_AT = 0, ESPN_FAILS = 0, ESPN_COOLDOWN = 0;
function espnCooling() { return Date.now() < ESPN_COOLDOWN; }
function espnNoteOk() { ESPN_OK_AT = Date.now(); ESPN_FAILS = 0; }
function espnNoteFail() {
  ESPN_FAILS++;
  // a direta funcionava há pouco e agora falham vários seguidos → é a ESPN a pedir calma
  if (ESPN_FAILS >= 4 && Date.now() - ESPN_OK_AT < 10 * 60e3) { ESPN_COOLDOWN = Date.now() + 4 * 60e3; ESPN_FAILS = 0; }
}
const isEspn = u => /site\.api\.espn\.com/.test(u);
rawGet = (function (prev) {
  return async function (url, timeoutMs) {
    if (!isEspn(url)) return prev(url, timeoutMs || 8000);
    if (espnCooling()) { const e = new Error('a ESPN pediu uma pausa'); e.cool = true; throw e; }
    // primeiro, só a ligação direta (rápida); as pontes só se a direta nunca funcionou neste aparelho
    const directKnown = Date.now() - ESPN_OK_AT < 30 * 60e3 || lsGet('ze_bridge', 0) === 0;
    if (directKnown) {
      try {
        const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), timeoutMs || 9000);
        const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' }); clearTimeout(tm);
        const text = await r.text();
        if (r.ok && text) { espnNoteOk(); return { status: r.status, text, bridge: 0 }; }
        if (r.status === 400 || r.status === 404) {
          // o formato por mês/ano é o que a ESPN aceita: se a direta o recusa, o problema é a ligação → experimenta as pontes
          if (/dates=\d{4}(\d{2})?(&|$)/.test(url) && !ESPN_OK_AT) return prev(url, timeoutMs || 9000);
          return { status: r.status, text, bridge: 0 };
        }
        if (r.status === 429 || r.status >= 500) { ESPN_COOLDOWN = Date.now() + 4 * 60e3; const e = new Error('a ESPN pediu uma pausa'); e.cool = true; throw e; }
        throw new Error('HTTP ' + r.status);
      } catch (e) {
        if (e.cool) throw e;
        if (!ESPN_OK_AT) return prev(url, timeoutMs || 9000);       // a direta ainda não funcionou nesta sessão: experimenta as pontes
        espnNoteFail(); if (espnCooling()) { e.cool = true; e.message = 'a ESPN pediu uma pausa'; } throw e;
      }
    }
    const r = await prev(url, timeoutMs || 9000);
    if (r && r.bridge === 0 && r.status < 300) espnNoteOk();
    return r;
  };
})(rawGet);
/* ---------- buscar ligas com calma ---------- */
fetchLeaguesParallel = async function (codes, from, to, status) {
  const all = []; let ok = 0, lastErr = null, skipped = 0;
  for (let i = 0; i < codes.length; i += 3) {
    if (espnCooling()) { skipped += codes.length - i; lastErr = lastErr || new Error('a ESPN pediu uma pausa'); break; }
    const chunk = codes.slice(i, i + 3);
    status && status(`⏳ ${chunk.map(c => ESPN_LEAGUES[c] || (typeof EXTRA_LEAGUES !== 'undefined' && EXTRA_LEAGUES[c]) || c).join(', ')}…`);
    const res = await Promise.all(chunk.map((code, k) => new Promise(r => setTimeout(r, k * 120)).then(() => fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${ymd(from)}-${ymd(to)}&limit=300`)).then(j => ({ code, j })).catch(e => { lastErr = e; return null; })));
    res.forEach(r => { if (!r) return; ok++; (r.j.events || []).forEach(ev => { const n = normalizeEspn(ev, r.code, ESPN_LEAGUES[r.code] || (typeof EXTRA_LEAGUES !== 'undefined' && EXTRA_LEAGUES[r.code]) || r.code); if (n) all.push(n); }); });
    await new Promise(r => setTimeout(r, 150));
  }
  return { all, ok, lastErr, skipped };
};
/* o Atualizar principal pede só as ligas principais + as das apostas abertas + as dos jogos do dossiê */
function refreshLeagues() {
  const set = new Set(CORE_LEAGUES);
  try {
    const b = loadBank();
    b.bets.concat(b.zeBets).filter(x => x.status === 'open').forEach(x => (x.legs || []).forEach(l => { const c = leagueCodeFromName(l.league); if (c) set.add(c); }));
    matches.forEach(m => { if (m.espn && m.espn.code) set.add(m.espn.code); });
  } catch (e) {}
  return [...set].filter(c => c !== 'nba');
}
const _ESPN_ALL = { ...ESPN_LEAGUES };
atualizarTudo = (function (prev) {
  return async function (opts) {
    if (espnCooling()) {
      const s = Math.ceil((ESPN_COOLDOWN - Date.now()) / 1000);
      setHTML('liveStatus', `⏸️ A ESPN pediu uma pausa (demasiados pedidos seguidos). Tenta outra vez daqui a ${s > 60 ? Math.ceil(s / 60) + ' min' : s + ' s'}. Os teus dados estão guardados.`);
      if (!(opts && opts.quiet)) toast('⏸️ A ESPN pediu uma pausa — tenta daqui a uns minutos.');
      return;
    }
    // durante o Atualizar, a lista «ESPN_LEAGUES» fica só com as ligas que interessam
    const keep = new Set(refreshLeagues());
    Object.keys(ESPN_LEAGUES).forEach(k => { if (!keep.has(k)) delete ESPN_LEAGUES[k]; });
    keep.forEach(k => { if (!ESPN_LEAGUES[k]) ESPN_LEAGUES[k] = _ESPN_ALL[k] || (typeof EXTRA_LEAGUES !== 'undefined' && EXTRA_LEAGUES[k]) || k; });
    try { return await prev.apply(this, arguments); }
    finally {
      Object.assign(ESPN_LEAGUES, _ESPN_ALL);
      if (espnCooling()) { const st = document.getElementById('liveStatus'); if (st && !/pausa/.test(st.textContent)) st.insertAdjacentHTML('beforeend', '<br>⏸️ A ESPN pediu uma pausa a meio — o que chegou ficou guardado. Tenta outra vez daqui a uns minutos.'); }
    }
  };
})(atualizarTudo);
/* a procura extra (apostas que não apareceram) só usa as ligas sugeridas pela própria aposta, e no máximo 8 */
if (typeof EXTRA_LEAGUES !== 'undefined') {
  const _EXTRA_ALL = { ...EXTRA_LEAGUES };
  settleSweep = (function (prev) {
    return async function () {
      if (espnCooling()) return null;
      const b = loadBank(), want = new Set();
      b.bets.concat(b.zeBets).filter(x => x.status === 'open').forEach(x => (x.legs || []).forEach(l => { const c = leagueCodeFromName(l.league); if (c) want.add(c); }));
      const pick = Object.keys(_EXTRA_ALL).filter(c => want.has(c));
      const fill = ['por.taca.portugal', 'uefa.europa.conf', 'ita.2', 'esp.2', 'tur.1', 'bra.1', 'sco.1', 'bel.1'].filter(c => !pick.includes(c));
      const use = pick.concat(fill).slice(0, 8);
      Object.keys(EXTRA_LEAGUES).forEach(k => { if (!use.includes(k)) delete EXTRA_LEAGUES[k]; });
      use.forEach(k => { EXTRA_LEAGUES[k] = _EXTRA_ALL[k] || k; });
      try { return await prev(); } finally { Object.keys(_EXTRA_ALL).forEach(k => { EXTRA_LEAGUES[k] = _EXTRA_ALL[k]; }); }
    };
  })(settleSweep);
}
/* as dicas trazem a liga: guarda-a na aposta (ajuda a procurar o resultado na liga certa) */
slipRegistar = (function (prev) {
  return function () {
    const before = new Set(loadBank().bets.map(x => x.id)), src = (slipState && slipState.legs) || [];
    const r = prev.apply(this, arguments);
    try {
      const b = loadBank(), bet = b.bets.find(x => !before.has(x.id));
      if (bet && Array.isArray(bet.legs)) { bet.legs.forEach(l => { const o = src.find(x => normTxt(x.home) === normTxt(l.home) && normTxt(x.away) === normTxt(l.away)); if (o && o.league) l.league = o.league; }); saveBank(b); }
    } catch (e) {}
    return r;
  };
})(slipRegistar);
