
/* =====================================================================
   v39 · aposta mínima da casa + mercados combinados no «Boletim do Zé»
   ===================================================================== */
/* ---------- Aposta mínima (a casa do utilizador não aceita menos) ---------- */
const MIN_KEY = 'ze_minstake';
function minStake() { const v = Number(lsGet(MIN_KEY, 0.25)); return v > 0 ? v : 0.25; }
function setMinStake(v) { const n = parseFloat(String(v).replace(',', '.')); if (!(n > 0 && n < 50)) { toast('Valor inválido.'); return; } lsSet(MIN_KEY, +n.toFixed(2)); toast(`💶 Aposta mínima: ${n.toFixed(2)} €. O Zé nunca propõe menos do que isto.`); try { renderConfig(); } catch (e) {} }
const _addBetV39 = addBet;
addBet = function (bet, who) {
  const mn = minStake();
  if (bet && Number(bet.stake) > 0 && Number(bet.stake) < mn - 1e-9) {
    if (who === 'ze') {
      const b = loadBank();
      if (b.ze < mn) { toast(`🤖 O Zé não tem ${mn.toFixed(2)} € para a aposta mínima.`); return false; }
      bet.note = (bet.note ? bet.note + ' · ' : '') + `stake subida de ${Number(bet.stake).toFixed(2)} para o mínimo da casa (${mn.toFixed(2)} €)`;
      bet.stake = mn;
    } else {
      alert(`A tua casa não aceita apostas abaixo de ${mn.toFixed(2)} €. (Muda o mínimo em Definições, se mudares de casa.)`);
      return false;
    }
  }
  return _addBetV39(bet, who);
};
const _zeDecideV39 = zeDecide;
zeDecide = function (m, odds, bankAvail) {
  const d = _zeDecideV39(m, odds, bankAvail), mn = minStake();
  if (d.pick && d.stake < mn) {
    if (d.capLeft >= mn && bankAvail >= mn && mn <= (bankAvail + 0) * 0.06) { d.stake = mn; d.minRaised = true; }
    else { d.minSkip = d.pick; d.pick = null; d.stake = 0; }
  }
  return d;
};
const _zeProposalsV39 = zeProposals;
zeProposals = function () {
  const pr = _zeProposalsV39(), mn = minStake(), bank = loadBank().you;
  if (pr && pr.singles) pr.singles = pr.singles.filter(l => bank * 0.06 >= mn).map(l => (l.stake < mn ? { ...l, stake: mn, minRaised: true } : l));
  return pr;
};
const _renderConfigV39 = renderConfig;
renderConfig = function () {
  _renderConfigV39();
  try {
    if (document.getElementById('cfgMinStake')) { document.getElementById('cfgMinStake').value = minStake().toFixed(2); return; }
    const host = document.getElementById('cfgProfileZe'); if (!host) return;
    const panel = host.closest('.panel');
    panel.insertAdjacentHTML('beforebegin', `<div class="panel"><div class="panel-h"><span>💶 A tua casa de apostas</span></div><div class="panel-b" style="font-size:.86rem;">
      <label class="lbl">Aposta mínima (€)<input id="cfgMinStake" class="inp" type="number" inputmode="decimal" step="0.05" min="0.05" value="${minStake().toFixed(2)}" style="width:110px;"></label>
      <button class="btn btn-sm" onclick="setMinStake(document.getElementById('cfgMinStake').value)">Guardar</button>
      <div class="hint" style="margin-top:6px;">O Zé nunca propõe nem regista apostas abaixo disto. Se a conta (Kelly) der menos, ele sobe para o mínimo — mas só se isso não passar 6% da banca; senão, não entra.</div></div></div>`);
  } catch (e) {}
};

/* ---------- Mercados combinados («Ambas marcam e mais de 2.5») ---------- */
function selCanon(sel) {
  const s = normTxt(sel);
  let m;
  if ((m = s.match(/\b(yes|sim|ambas marcam)\b.*?\b(and|e|\+)\s*(over|mais de|mais)\s*(\d)[.,]5/))) return `Ambas marcam e mais de ${m[4]}.5 golos`;
  if ((m = s.match(/\b(yes|sim|ambas marcam)\b.*?\b(and|e|\+)\s*(under|menos de|menos)\s*(\d)[.,]5/))) return `Ambas marcam e menos de ${m[4]}.5 golos`;
  if ((m = s.match(/\b(no|nao)\b.*?\b(and|e|\+)\s*(over|mais de|mais)\s*(\d)[.,]5/))) return `Não marcam ambas e mais de ${m[4]}.5 golos`;
  if ((m = s.match(/\b(no|nao)\b.*?\b(and|e|\+)\s*(under|menos de|menos)\s*(\d)[.,]5/))) return `Não marcam ambas e menos de ${m[4]}.5 golos`;
  return sel;
}
const _legCodeV39 = legCode;
legCode = function (l) {
  const s = normTxt((l.sel || '') + ' ' + (l.market || ''));
  const bt = /ambas|btts|both/.test(s), ou = s.match(/(mais de|over|under|menos de)\s*\+?\s*(\d)[.,]5/);
  if (bt && ou) return `${/\b(nao|no)\b/.test(s) ? 'BTTS_N' : 'BTTS'}&${/under|menos/.test(ou[1]) ? 'U' : 'O'}${ou[2]}.5`;
  if (/handicap|hcp/.test(s) || NON_GOAL.test(s) || DNB.test(s)) return null;   // estes ficam pelo texto, não se misturam
  return _legCodeV39(l);
};
const _poolAddV39 = poolAdd;
poolAdd = function (evLegs, source) { return _poolAddV39((evLegs || []).map(l => ({ ...l, sel: selCanon(l.sel || '') })), source); };
/* a probabilidade de cada seleção guardada é recalculada com o modelo de agora (e com o mercado certo) */
const _poolScoreV39 = poolScore;
poolScore = function (e) {
  const r = _poolScoreV39(e);
  try {
    if (e.home && e.away && e.sel && e.sport !== 'nba' && e.sport !== 'basket') {
      const ev = legEval({ home: e.home, away: e.away, sel: e.sel, odd: e.odd });
      if (ev && ev.m && /modelo/.test(ev.src || '') && ev.p > 0) { e.p = ev.p; e.pModel = ev.p; e.src = ev.src; }
    }
  } catch (x) {}
  return r;
};
legLi = (function (prev) { return function (l) { return prev({ ...l, sel: selPT(l.sel || '') === String(l.sel || '').split(/\s+[—-]\s+/)[0].slice(0, 40) ? l.sel : selPT(l.sel) }).replace(/ na <b>Boletim( inglês)?<\/b>/, ' no boletim'); }; })(legLi);
zeDecidirUI = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    const d = dueloAtual && dueloAtual.decision, el = document.getElementById('zeDecision');
    if (d && el && d.minSkip) el.insertAdjacentHTML('beforeend', `<div class="muted" style="font-size:.8rem;margin-top:6px;">💶 Entrava em <b>${esc(d.minSkip.label)}</b>, mas a minha conta dava menos que a aposta mínima da tua casa (${minStake().toFixed(2)} €) e subir era arriscar demais para a banca. Passo.</div>`);
    if (d && el && d.minRaised) el.insertAdjacentHTML('beforeend', `<div class="muted" style="font-size:.8rem;margin-top:6px;">💶 A conta dava menos, mas subi para a aposta mínima da tua casa (${minStake().toFixed(2)} €).</div>`);
    return r;
  };
})(zeDecidirUI);
