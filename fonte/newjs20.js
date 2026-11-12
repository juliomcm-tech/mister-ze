
/* =====================================================================
   v34 · liquidação que não deixa apostas penduradas
   - boletim registado DEPOIS do jogo (print de ontem) também fecha
   - «Atualizar» feito dias depois: vai buscar resultados desde a aposta aberta mais antiga (até 30 dias)
   - ligas e taças extra (Liga Conferência, Serie B, Taças, Turquia, Brasil…) só quando há apostas por fechar
   - nomes em português dos boletins (Atl. Madrid, Bayern Munique, PSG, Marselha…)
   - o Zé diz, aposta a aposta, porque é que não fechou — e deixa-te fechar à mão
   ===================================================================== */
Object.assign(TEAM_ALIAS, {
  'psg': 'paris saint-germain paris sg', 'paris sg': 'paris saint-germain', 'paris saint germain': 'paris saint-germain',
  'atl madrid': 'atletico madrid', 'atletico de madrid': 'atletico madrid', 'at madrid': 'atletico madrid',
  'inter milao': 'internazionale inter', 'inter de milao': 'internazionale inter', 'bayern munique': 'bayern munich munchen',
  'spurs': 'tottenham hotspur', 'wolves': 'wolverhampton wanderers', 'newcastle utd': 'newcastle united', 'nottm forest': 'nottingham forest',
  'marselha': 'marseille olympique marseille', 'lyon': 'lyon olympique lyonnais', 'napoles': 'napoli', 'juve': 'juventus',
  'leverkusen': 'bayer leverkusen', 'bvb': 'borussia dortmund', 'brugge': 'club brugge', 'sporting lisboa': 'sporting cp', 'sporting clube de portugal': 'sporting cp',
  'estrela': 'estrela amadora', 'vitoria guimaraes': 'vitoria sc vitoria guimaraes'
});
const EXTRA_LEAGUES = {
  'uefa.europa.conf': 'Liga Conferência', 'por.taca.portugal': 'Taça de Portugal', 'ita.2': 'Serie B', 'esp.2': 'LaLiga 2', 'ger.2': '2. Bundesliga', 'fra.2': 'Ligue 2',
  'sco.1': 'Escócia', 'bel.1': 'Bélgica', 'tur.1': 'Turquia', 'gre.1': 'Grécia', 'sui.1': 'Suíça', 'aut.1': 'Áustria', 'ksa.1': 'Arábia Saudita',
  'bra.1': 'Brasileirão', 'arg.1': 'Argentina', 'usa.1': 'MLS', 'mex.1': 'México',
  'eng.fa': 'Taça de Inglaterra', 'eng.league_cup': 'Taça da Liga inglesa', 'esp.copa_del_rey': 'Taça do Rei', 'ita.coppa_italia': 'Taça de Itália', 'ger.dfb_pokal': 'Taça da Alemanha', 'fra.coupe_de_france': 'Taça de França',
  'uefa.nations': 'Liga das Nações', 'fifa.worldq.uefa': 'Qualificação Mundial (UEFA)', 'fifa.friendly': 'Particulares'
};

/* ---------- Mercados que o resultado NÃO decide: cantos, cartões, remates… ---------- */
const NON_GOAL = /(canto|corner|cartao|cartoes|card|amarelo|vermelho|booking|remate|shot|chute|falta|foul|fora de jogo|fora-de-jogo|offside|assistenc|assist|defesa|save|lancamento|throw|pontape de baliza|goal kick|substitu|penalti assinal|var\b|posse|possession|1a parte|1.a parte|primeira parte|1st half|first half|intervalo|half time|ht\b|2a parte|segunda parte|2nd half|minuto|minute)/;
const _selCondsV34 = selConds;
selConds = function (selRaw, m) {
  if (NON_GOAL.test(normTxt(selRaw))) return null;
  return _selCondsV34(selRaw, m);
};

/* ---------- Que jogo é o desta aposta? ---------- */
let SETTLE_CTX = null;   // todos os jogos do pacote (também os por jogar) — para não fechar com o jogo errado
const _resolveLegV34 = resolveLeg;
resolveLeg = function (l, fin, at) {
  const atT = at ? new Date(at).getTime() : Date.now();
  const cands = fin.filter(x => evMatchesLeg(x, l)).map(x => ({ x, t: new Date(x.utcDate).getTime() })).filter(c => c.t >= atT - 6 * 864e5);
  if (!cands.length) return null;
  const after = cands.filter(c => c.t >= atT - 12 * 3600e3).sort((a, b) => a.t - b.t)[0];
  let pick = after;
  if (!pick) {
    // boletim registado depois do jogo: aceito o jogo anterior, MAS só se não houver outro igual ainda por jogar
    const pending = (SETTLE_CTX || []).some(x => x.status !== 'FINISHED' && new Date(x.utcDate).getTime() >= atT - 12 * 3600e3 && evMatchesLeg(x, l));
    if (pending) return null;
    pick = cands.sort((a, b) => b.t - a.t)[0];
  }
  return _resolveLegV34(l, [pick.x], 0);
};
const _settleFromResultsV34 = settleFromResults;
settleFromResults = function (payload) {
  SETTLE_CTX = (payload && payload.matches) || [];
  try { return _settleFromResultsV34(payload); } finally { SETTLE_CTX = null; }
};

/* ---------- Varrimento extra depois do «Atualizar» ---------- */
let SWEEP = { t: 0, key: '', all: [] };
async function settleSweep() {
  const b = loadBank(), now = Date.now();
  const open = b.bets.map(x => ({ x, who: 'you' })).concat(b.zeBets.map(x => ({ x, who: 'ze' }))).filter(o => o.x.status === 'open');
  if (!open.length || navigator.onLine === false) return null;
  const live = lsGet(LIVE_KEY, null);
  if (!live || !Array.isArray(live.matches)) return null;
  // só vale a pena ir a outras ligas/dias para apostas cujo jogo NÃO veio no «Atualizar» normal
  const legsOf = x => Array.isArray(x.legs) && x.legs.length ? x.legs : [legFromBet(x)];
  const missing = open.filter(o => legsOf(o.x).some(l => l && !live.matches.some(e => evMatchesLeg(e, l))));
  if (!missing.length) return null;
  const oldest = Math.min(...missing.map(o => new Date(o.x.at || now).getTime()));
  const key = missing.map(o => o.x.id).sort().join(',');
  if (SWEEP.key === key && now - SWEEP.t < 20 * 60e3) return { rep: [], cached: true };
  const from = new Date(Math.max(oldest - 864e5, now - 30 * 864e5)), to = new Date(now + 864e5);
  const deep = oldest < now - 3.5 * 864e5;
  const codes = (deep ? Object.keys(ESPN_LEAGUES) : []).concat(Object.keys(EXTRA_LEAGUES));
  const names = { ...ESPN_LEAGUES, ...EXTRA_LEAGUES };
  const st = document.getElementById('liveStatus'), base = st ? st.innerHTML : '';
  const all = [];
  for (let i = 0; i < codes.length; i += 6) {
    const chunk = codes.slice(i, i + 6);
    if (st) st.innerHTML = base + `<br>🔎 A procurar resultados de ${missing.length} aposta${missing.length > 1 ? 's' : ''} aberta${missing.length > 1 ? 's' : ''}${deep ? ' (desde ' + from.toLocaleDateString('pt-PT') + ')' : ''}: ${chunk.map(c => names[c]).join(', ')}…`;
    const res = await Promise.all(chunk.map(code => fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${ymd(from)}-${ymd(to)}&limit=400`).then(j => ({ code, j })).catch(() => null)));
    res.forEach(r => { if (!r) return; (r.j.events || []).forEach(ev => { const n = normalizeEspn(ev, r.code, names[r.code]); if (n) all.push(n); }); });
  }
  SWEEP = { t: now, key, all };
  const rep = settleFromResults({ matches: all.concat(live.matches) });
  if (st) st.innerHTML = base + (rep.length ? `<br>🔎 +${rep.length} aposta${rep.length > 1 ? 's' : ''} liquidada${rep.length > 1 ? 's' : ''} com resultados de outras ligas/dias.` : '');
  return { rep, all };
}
const _atualizarTudoV34 = atualizarTudo;
atualizarTudo = async function (opts) {
  const r = await _atualizarTudoV34(opts);
  try {
    const s = await settleSweep();
    if (s && s.rep && s.rep.length) {
      renderBanca(); try { renderCalendar(); } catch (e) {}
      if (document.getElementById('chatLog')) addChat('bot', reportHTML(s.rep), s.rep.some(x => x.who === 'ze' && x.result === 'win') ? 'gozao' : 'pensativo');
      if (!(opts && opts.quiet)) toast(`📊 Mais ${s.rep.length} aposta${s.rep.length > 1 ? 's' : ''} liquidada${s.rep.length > 1 ? 's' : ''}.`);
    }
    const stuck = openDiag().filter(d => d.stuck);
    if (stuck.length && !(opts && opts.quiet)) {
      lsSet('ze_stuck_seen', stuck.map(d => d.bet.id).join(','));
      setTimeout(() => toast(`⚠️ ${stuck.length} aposta${stuck.length > 1 ? 's' : ''} que não consigo fechar sozinho — pergunta ao Zé «porque não fechou».`), 1800);
    }
  } catch (e) { console.error(e); }
  return r;
};

/* ---------- Diagnóstico: porque é que esta aposta não fechou? ---------- */
function legDiag(l, bet, pool) {
  if (!l || (!l.home && !l.away)) return { k: 'teams', txt: 'não sei de que jogo é esta seleção (faltam os clubes)' };
  const name = `${l.home || '?'} vs ${l.away || '?'}`;
  const atT = new Date(bet.at || Date.now()).getTime();
  const evs = pool.filter(x => evMatchesLeg(x, l)).map(x => ({ x, t: new Date(x.utcDate).getTime() }));
  const ev = ((evs.filter(c => c.t >= atT - 12 * 3600e3).sort((a, b) => a.t - b.t)[0]) || (evs.filter(c => c.t >= atT - 6 * 864e5).sort((a, b) => b.t - a.t)[0]) || {}).x;
  if (!ev) return { k: 'notfound', txt: `não encontro «${name}» em nenhuma das ${Object.keys(ESPN_LEAGUES).length + Object.keys(EXTRA_LEAGUES).length} ligas/taças que leio (nome diferente? liga que não sigo?)` };
  const when = new Date(ev.utcDate).toLocaleString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  if (ev.status !== 'FINISHED') return { k: 'pending', txt: `${ev.homeTeam.shortName} vs ${ev.awayTeam.shortName} ainda não acabou (${when})` };
  const r = _resolveLegV34(l, [ev], 0);
  const sc = `${ev.homeTeam.shortName} ${ev.score.fullTime.home}-${ev.score.fullTime.away} ${ev.awayTeam.shortName}`;
  if (r) return { k: r.win ? 'won' : 'lost', txt: `${sc} → ${r.win ? 'ganha' : 'perdida'}`, ev };
  if (l.market === 'scorer' || /\bmarca\b/i.test(l.sel || '')) return { k: 'manual', txt: `${sc}: não tenho a lista de marcadores deste jogo` };
  return { k: 'manual', txt: `${sc}: «${l.sel}» não dá para validar só pelo resultado (cantos, cartões, handicap asiático…)` };
}
function openDiag() {
  const b = loadBank(), now = Date.now();
  const live = lsGet(LIVE_KEY, null);
  const pool = ((live && live.matches) || []).concat(SWEEP.all || []);
  const out = [];
  [['you', b.bets], ['ze', b.zeBets]].forEach(([who, L]) => L.filter(x => x.status === 'open').forEach(bet => {
    const legs = Array.isArray(bet.legs) && bet.legs.length ? bet.legs : [legFromBet(bet)];
    const ds = legs.map(l => legDiag(l, bet, pool));
    const age = now - new Date(bet.at || now).getTime();
    const stuck = ds.some(d => d.k === 'manual' || d.k === 'teams') || (ds.some(d => d.k === 'notfound') && age > 36 * 3600e3);
    out.push({ who, bet, ds, stuck });
  }));
  return out;
}
function openDiagHTML() {
  const D = openDiag();
  if (!D.length) return '✅ Não há apostas abertas. Está tudo fechado.';
  const live = lsGet(LIVE_KEY, null);
  const head = live ? `<span class="muted">Últimos dados: ${new Date(live.generatedAt).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.</span>` : '<span class="muted">Ainda não carregaste em 📡 Atualizar — sem isso não tenho resultados nenhuns.</span>';
  const ic = { won: '✅', lost: '❌', pending: '⏳', notfound: '❓', manual: '✋', teams: '❓' };
  return `<b>🔍 Apostas abertas (${D.length})</b> ${head}<br>${D.map(({ who, bet, ds, stuck }) => `<div class="need" style="margin-top:6px;">${who === 'ze' ? '🤖' : '👤'} <b>${esc(bet.pick)}</b> @ ${Number(bet.odd).toFixed(2)} · ${Number(bet.stake).toFixed(2)} € <span class="muted">(${esc(bet.match || '')})</span>
    ${ds.map(d => `<div style="font-size:.82rem;">${ic[d.k] || '•'} ${esc(d.txt)}</div>`).join('')}
    ${stuck || ds.every(d => d.k === 'won' || d.k === 'lost') ? `<div class="acts" style="margin-top:4px;"><span class="muted" style="font-size:.76rem;">Fecha à mão:</span> <button class="mini w" onclick="settleBet('${bet.id}','win','${who}');this.closest('.need').remove()">Ganhou</button><button class="mini l" onclick="settleBet('${bet.id}','loss','${who}');this.closest('.need').remove()">Perdeu</button><button class="mini v" onclick="settleBet('${bet.id}','void','${who}');this.closest('.need').remove()">Nula</button></div>` : ''}</div>`).join('')}
    <div class="muted" style="font-size:.74rem;margin-top:6px;">⏳ = ainda não acabou · ❓ = não encontro o jogo · ✋ = mercado que só tu podes confirmar. Ao carregar em 📡 Atualizar, o Zé vai buscar resultados até 30 dias para trás e também a taças e outras ligas.</div>`;
}
const _zeTalkV34b = zeTalk;
zeTalk = function (raw, opts) {
  const q = zeNorm(raw);
  if (/(porque nao fech|nao fechou|nao liquid|apostas (abertas|pendentes|por fechar)|pendentes|validar apostas|fechar apostas|nao atualiz)/.test(q)) {
    return { mood: 'pensativo', html: openDiagHTML() };
  }
  return _zeTalkV34b(raw, opts);
};
