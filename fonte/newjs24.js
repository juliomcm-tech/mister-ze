
/* =====================================================================
   v37 · boletins ingleses (Sky Bet, William Hill, Paddy Power, bet365 UK…)
   «Galatasaray v Stuttgart, Today 17:45» + «Yes And Over 2.5 Goals - Both Teams To … 1.50»
   + «Stake: £1.72  Returns: £147.77»; odds decimais ou fracionárias (5/4, EVS)
   ===================================================================== */
const _normTxtV37 = normTxt;
normTxt = function (s) {
  return _normTxtV37(String(s == null ? '' : s).replace(/[øØ]/g, 'o').replace(/[æÆ]/g, 'ae').replace(/ß/g, 'ss').replace(/[łŁ]/g, 'l').replace(/[đĐ]/g, 'd'));
};
Object.assign(TEAM_ALIAS, {
  'inter milan': 'internazionale inter', 'internazionale': 'inter milan inter', 'lask linz': 'lask', 'bodo/glimt': 'bodo glimt', 'bodo glimt': 'bodo/glimt',
  'man utd': 'manchester united', 'atletico madrid': 'atletico de madrid atl madrid', 'bayern munich': 'bayern munchen munique', 'psg': 'paris saint-germain paris sg',
  'wolves': 'wolverhampton wanderers', 'spurs': 'tottenham hotspur', 'sheff utd': 'sheffield united', 'sheff wed': 'sheffield wednesday', 'qpr': 'queens park rangers'
});
/* um alias nunca pode apagar o nome original (senão «Internazionale» deixava de bater consigo próprio) */
Object.keys(TEAM_ALIAS).forEach(k => { const v = TEAM_ALIAS[k]; if (!(' ' + v + ' ').includes(' ' + k + ' ')) TEAM_ALIAS[k] = k + ' ' + v; });

/* odd em qualquer formato → decimal */
function oddAny(s) {
  s = String(s || '').trim();
  if (/^evs?$|^evens$/i.test(s)) return 2;
  let m = s.match(/^(\d{1,3})\/(\d{1,3})$/); if (m) return +(1 + (+m[1]) / (+m[2])).toFixed(3);
  m = s.match(/^(\d{1,3})[.,](\d{1,3})$/); if (m) return +(m[1] + '.' + m[2]);
  return null;
}
const V_FIX = /^[^A-Za-z0-9À-ÿ]*([A-Za-zÀ-ÿ0-9][^,]*?)\s+(?:v|vs\.?|V)\s+([^,]+?)\s*(?:,\s*(.*))?$/;
const V_WHEN = /^(today|tomorrow|tonight|hoje|amanh|mon|tue|wed|thu|fri|sat|sun|\d{1,2}(:\d{2}|\s+[a-z]{3})|\d{1,2}\/\d{1,2})/i;
const V_ODD = /(?:^|\s)(\d{1,3}[.,]\d{2,3}|\d{1,3}\/\d{1,3}|EVS|Evens)\s*$/i;
const V_STOP = /^(bet information|bet info|stake|returns|potential returns|total stake|place bet|cash ?out|bet ref|receipt|your bets|accumulator|treble|double|fourfold|fivefold|\d+[- ]?fold)/i;
function parseVSlip(text) {
  const lines = String(text || '').split(/\n+/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const legs = []; let cur = null;
  const fixtureOf = ln => {
    if (V_ODD.test(ln) && !/,/.test(ln)) return null;
    const m = ln.match(V_FIX); if (!m) return null;
    const when = (m[3] || '').trim();
    if (when && !V_WHEN.test(when)) return null;
    const home = m[1].replace(/^[©®@°•·oO]\s+/, '').trim(), away = m[2].trim();
    if (home.length < 2 || away.length < 2 || /\d[.,]\d{2}$/.test(away)) return null;
    return { home, away, when };
  };
  for (const ln of lines) {
    if (V_STOP.test(ln)) { cur = null; continue; }
    const fx = fixtureOf(ln);
    if (fx) { cur = { home: fx.home, away: fx.away, when: fx.when, sel: '', mk: '', odd: null }; legs.push(cur); continue; }
    if (!cur) continue;
    const om = ln.match(V_ODD);
    if (om && cur.odd == null) {
      const body = ln.slice(0, om.index).replace(/^[©®@°•·]\s*|^[oO]\s+(?=[A-Z])/, '').trim();
      const parts = body.split(/\s+[-–—]\s+/);
      cur.sel = parts[0].trim(); cur.mk = parts.slice(1).join(' ').trim();
      cur.odd = oddAny(om[1]);
    } else if (cur.odd != null && !V_ODD.test(ln) && ln.length < 80) {
      cur.mk = (cur.mk + ' ' + ln).trim();          // «Score and Over/Under 2.5 Goals» continua o nome do mercado
    }
  }
  const ok = legs.filter(l => l.odd > 1 && l.sel);
  if (!ok.length) return null;
  const money = re => { const m = String(text).match(re); return m ? +m[2].replace(',', '.') : null; };
  const stake = money(/(stake|total stake|aposta)\s*:?\s*([£€$]?\s*\d+[.,]\d{2})/i) != null ? +String(text).match(/(stake|total stake|aposta)\s*:?\s*[£€$]?\s*(\d+[.,]\d{2})/i)[2].replace(',', '.') : null;
  const ret = (String(text).match(/(potential returns|returns|ganhos|retorno)\s*:?\s*[£€$]?\s*(\d+[.,]\d{2})/i) || [])[2];
  const returns = ret ? +ret.replace(',', '.') : null;
  const prod = ok.reduce((p, l) => p * l.odd, 1);
  const cur$ = /£/.test(text) ? 'GBP' : /\$/.test(text) ? 'USD' : 'EUR';
  return {
    legs: ok.map(l => ({ home: l.home, away: l.away, sel: l.mk ? `${l.sel} — ${l.mk}` : l.sel, odd: l.odd, market: '', when: l.when })),
    totalOdd: returns && stake ? +(returns / stake).toFixed(2) : +prod.toFixed(2), boost: 0, stake, declared: ok.length, appProb: null,
    text: String(text), source: 'Boletim inglês', currency: cur$, returns, oddCheck: returns && stake ? Math.abs(returns / stake / prod - 1) : null
  };
}
const _parseAnyV37 = parseAny;
parseAny = function (text) {
  const base = _parseAnyV37(text);
  try {
    const v = parseVSlip(text);
    const full = s => (s && s.legs || []).filter(l => Number(l.odd) > 1 && l.home && l.away).length;
    if (v && full(v) > full(base) && full(v) >= Math.min(2, v.legs.length)) {
      v.stake = v.stake || base.stake; v.boost = base.boost || 0;
      return v;
    }
  } catch (e) { console.warn(e); }
  return base;
};
/* as seleções de mercado («Yes And Over 2.5…») não podem ser trocadas por um nome de equipa */
const _snapSelV37 = snapSel;
snapSel = function (l) {
  if (l && /\b(yes|no|over|under|both teams|btts|draw|goals?|and|ambas|mais|menos|empate)\b/i.test(l.sel || '')) return l;
  return _snapSelV37(l);
};
/* o boletim em libras: mostra a conversão */
const _batchHTMLV37 = batchHTML;
batchHTML = function (groups) {
  let h = _batchHTMLV37(groups);
  try {
    const g = (groups || []).find(x => x.currency === 'GBP' && x.stake);
    if (g) h += `<br><span class="muted" style="font-size:.78rem;">💷 Boletim em libras: aposta £${g.stake.toFixed(2)}${g.returns ? ` · retorno £${g.returns.toFixed(2)}` : ''} (≈ ${(g.stake * 1.17).toFixed(2)} €). Na carteira fica o mesmo número (${g.stake.toFixed(2)}); corrige no editor se quiseres em euros.${g.oddCheck != null && g.oddCheck > 0.02 ? ` ⚠️ As odds lidas não batem certo com o retorno (${(g.oddCheck * 100).toFixed(0)}% de diferença) — confirma-as.` : ''}</span>`;
  } catch (e) {}
  return h;
};

/* Juntar leituras: dois jogos diferentes com a mesma seleção e a mesma odd (Galatasaray 1.50 e Barcelona 1.50)
   eram tratados como repetidos e um desaparecia. Agora as equipas contam. */
const legKeyT = l => normTxt(l.home || '') + '|' + normTxt(l.away || '') + '|' + normTxt(l.sel) + '|' + (Number(l.odd) || '');
mergeSlip = function (into, add) {
  (add.legs || []).forEach(l => {
    const hasT = !!(l.home && l.away);
    let ex = hasT ? into.legs.find(x => legKeyT(x) === legKeyT(l)) : null;
    if (!ex) ex = into.legs.find(x => legKey(x) === legKey(l) && (!hasT || !(x.home && x.away)));
    if (!ex) { into.legs.push(l); return; }
    if (!ex.odd && l.odd) ex.odd = l.odd;
    if (l.away && (!ex.away || ex.away.length < 3)) { ex.home = l.home || ex.home; ex.away = l.away; }
  });
  ['totalOdd', 'boost', 'stake', 'declared', 'currency', 'returns', 'oddCheck'].forEach(k => { if (add[k] && !into[k]) into[k] = add[k]; });
  if (add.source && add.source !== 'Boletim' && (!into.source || into.source === 'Boletim')) into.source = add.source;
  return into;
};

/* Nome curto e em português para a aposta registada (o texto completo fica nas seleções, para liquidar) */
function selPT(sel) {
  const s = normTxt(sel);
  let m;
  if ((m = s.match(/\b(yes|sim) (and|e) (over|mais de) (\d)[.,]5/))) return `Ambas marcam + Mais ${m[4]}.5`;
  if ((m = s.match(/\b(yes|sim) (and|e) (under|menos de) (\d)[.,]5/))) return `Ambas marcam + Menos ${m[4]}.5`;
  if ((m = s.match(/\b(no|nao) (and|e) (over|mais de) (\d)[.,]5/))) return `Não marcam ambas + Mais ${m[4]}.5`;
  if ((m = s.match(/\b(no|nao) (and|e) (under|menos de) (\d)[.,]5/))) return `Não marcam ambas + Menos ${m[4]}.5`;
  if ((m = s.match(/^(over|mais de) (\d)[.,]5/))) return `Mais ${m[2]}.5 golos`;
  if ((m = s.match(/^(under|menos de) (\d)[.,]5/))) return `Menos ${m[2]}.5 golos`;
  if (/^(yes|sim)\b.*both teams|both teams to score.*\byes\b/.test(s)) return 'Ambas marcam';
  if (/^(no|nao)\b.*both teams|both teams to score.*\bno\b/.test(s)) return 'Não marcam ambas';
  if (/^draw\b/.test(s)) return 'Empate';
  return String(sel).split(/\s+[—-]\s+/)[0].slice(0, 40);
}
const _slipRegistarV37 = slipRegistar;
slipRegistar = function () {
  const before = new Set(loadBank().bets.map(x => x.id));
  const r = _slipRegistarV37.apply(this, arguments);
  try {
    const b = loadBank(), bet = b.bets.find(x => !before.has(x.id));
    if (bet && Array.isArray(bet.legs) && bet.legs.length) {
      const labels = bet.legs.map(l => selPT(l.sel || ''));
      const same = labels.every(x => x === labels[0]);
      bet.pick = same && bet.legs.length > 1 ? `${bet.legs.length}× ${labels[0]}` : bet.legs.map((l, i) => bet.legs.length > 1 ? `${(l.home || '').split(' ')[0]}: ${labels[i]}` : labels[i]).join(' + ');
      if (slipState && slipState.currency === 'GBP') bet.note = (bet.note ? bet.note + ' · ' : '') + `boletim em libras (£${Number(slipState.stake || bet.stake).toFixed(2)})`;
      saveBank(b); renderBanca();
    }
  } catch (e) { console.warn(e); }
  return r;
};

/* Dérbis: a cidade não identifica a equipa (Manchester, Milão, Madrid…) */
['man', 'utd', 'manchester', 'milan', 'madrid', 'sheffield', 'bristol', 'munich', 'munchen'].forEach(w => TEAM_GENERIC.add(w));
TEAM_ALIAS['inter milan'] = 'internazionale inter';
TEAM_ALIAS['internazionale'] = 'internazionale inter';
TEAM_ALIAS['inter'] = 'inter internazionale';
TEAM_ALIAS['ac milan'] = 'ac milan milan rossoneri';
TEAM_ALIAS['milan'] = 'milan ac milan';
TEAM_ALIAS['manchester city'] = 'manchester city man city';
TEAM_ALIAS['manchester united'] = 'manchester united man united man utd';
/* o texto também é expandido (com cache), para «Manchester City» reconhecer «Man City» e vice-versa */
const EXP_CACHE = new Map();
function expandCached(t) { let v = EXP_CACHE.get(t); if (v == null) { v = expandAliases(t); if (EXP_CACHE.size > 6000) EXP_CACHE.clear(); EXP_CACHE.set(t, v); } return v; }
const _teamScoreV37 = teamScore;
teamScore = function (name, normText) { const a = _teamScoreV37(name, normText); return a > 0 ? a : _teamScoreV37(name, expandCached(String(normText || ''))); };
