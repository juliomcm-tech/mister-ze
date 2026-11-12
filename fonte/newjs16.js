
/* =====================================================================
   v31 · revisão a fundo (análise de código + simulação da jornada)
   ===================================================================== */

/* «Sporting CP», «Athletic», «Real» … nomes só com palavras genéricas também contam */
teamScore = function (name, normText) {
  let s = 0, distinct = 0, gen = 0;
  const tk = teamTokens(name);
  tk.forEach(t => {
    if (new RegExp('(^| )' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( |$)').test(normText)) {
      if (TEAM_GENERIC.has(t)) { s += 1; gen++; } else { s += 2; distinct++; }
    }
  });
  if (distinct) return s;
  return tk.length && tk.every(t => TEAM_GENERIC.has(t)) && gen === tk.length ? s : 0;
};

/* Foto do perfil: só imagem verdadeira (um backup alterado não consegue meter código) */
const _humanFaceV31 = humanFace;
humanFace = function (size, cls) {
  const u = userProfile();
  if (u.photo && !/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u.photo)) { u.photo = ''; lsSet(USER_KEY, u); }
  return _humanFaceV31(size, cls);
};

/* Atualizar nunca fica «preso»: se algo rebentar a meio, liberta o botão */
const _atualizarTudoV31 = atualizarTudo;
atualizarTudo = async function (opts) {
  try { return await _atualizarTudoV31(opts); }
  catch (e) {
    console.error(e);
    atualizarBusy = false;
    setHTML('liveStatus', `❌ Erro a processar os dados (${esc(e && e.message || e)}). Tenta outra vez.`);
  }
};

/* Zebras: quanto maior a odd, mais valor o Zé exige (o modelo erra mais nos azarões).
   odd ≤ 2.5 → EV mínimo normal · odd 4 → +2.3 pp · odd 6 → +5.3 pp */
function zeEdgeFor(minEdge, odd) { return minEdge + 0.015 * Math.max(0, odd - 2.5); }
const _zeDecideV31 = zeDecide;
zeDecide = function (m, odds, bankAvail) {
  const d = _zeDecideV31(m, odds, bankAvail);
  d.rows.forEach(x => { if (x.odd) { x.minEdge = zeEdgeFor(d.minEdge, x.odd); x.need = (1 + x.minEdge) / x.p; } });
  const cands = d.rows.filter(x => x.odd && x.ev > x.minEdge && x.odd <= 6 && x.p >= 0.2).sort((a, b) => b.kelly - a.kelly);
  const pick = cands[0] || null;
  if (!pick) { d.longshotSkip = d.pick || null; d.pick = null; d.stake = 0; return d; }
  if (d.pick && pick.k === d.pick.k) return d;
  // escolha mudou: recalcula a stake com as mesmas regras (Kelly ¼, tetos 5%/8%/15%, drawdown)
  const b = loadBank();
  const onMatch = b.zeBets.filter(x => x.status === 'open' && x.match === m.home + ' vs ' + m.away);
  let f = Math.min(0.05, pick.kelly * 0.25) * d.cal.mult * d.ddMult * (onMatch.length ? 0.5 : 1);
  let stake = Math.min(Math.max(0.1, r2(bankAvail * f)), d.capLeft, r2(bankAvail));
  d.pick = stake >= 0.1 ? pick : null; d.stake = d.pick ? stake : 0;
  return d;
};
const _zePropV31 = zePropose;
zePropose = function (m, label, pModel, odd, extra) {
  odd = Number(odd);
  if (odd > 2.5 && pModel > 0) {
    const base = 0.03 + zeCalib().extraEdge, need = zeEdgeFor(base, odd);
    const p = 0.75 * pModel + 0.25 * (1 / odd), ev = p * odd - 1;
    if (ev >= base && ev < need && !zeHasSame(m.home + ' vs ' + m.away, label))
      return `🦓 <b>${esc(label)} @ ${odd.toFixed(2)}</b>: dou-lhe ${pct(p)} → valor +${(ev * 100).toFixed(1)}%. Parece bom, mas numa zebra a esta odd o modelo engana-se mais — exijo +${(need * 100).toFixed(1)}%. Só entro a <b>≥ ${((1 + need) / p).toFixed(2)}</b>.`;
  }
  return _zePropV31(m, label, pModel, odd, extra);
};
const _zeDecidirUIV31 = zeDecidirUI;
zeDecidirUI = function () {
  const r = _zeDecidirUIV31.apply(this, arguments);
  const d = dueloAtual && dueloAtual.decision;
  if (d && !d.pick && d.longshotSkip) {
    const s = d.longshotSkip, el = document.getElementById('zeDecision');
    if (el) el.insertAdjacentHTML('beforeend', `<div class="muted" style="font-size:.8rem;margin-top:6px;">🦓 Quase entrava em <b>${esc(s.label)} @ ${s.odd.toFixed(2)}</b> (+${(s.ev * 100).toFixed(1)}%), mas numa zebra exijo +${(s.minEdge * 100).toFixed(1)}%: só a <b>≥ ${s.need.toFixed(2)}</b>.</div>`);
  }
  return r;
};

/* Ao abrir um jogo, o balão do Zé sai da frente (a mensagem fica no chat) */
const _openModalV31 = openModal;
openModal = function () {
  const zb = document.getElementById('zeBubble'); if (zb) zb.classList.remove('show');
  return _openModalV31.apply(this, arguments);
};
