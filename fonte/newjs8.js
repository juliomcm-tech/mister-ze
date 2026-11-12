/* =====================================================================
   v23 · Anular apostas (estorno), registo pelo print, e o Zé a
   comentar a gestão de banca (stake vs regras) — no registo e no fim.
   ===================================================================== */

/* ---------- Balão do Zé (visível em qualquer ecrã) ---------- */
let zeBubbleT = null;
function zeSay(html, mood, keepMs) {
  try { addChat('bot', html, mood || 'pensativo'); } catch (e) {}
  let el = document.getElementById('zeBubble');
  if (!el) {
    el = document.createElement('div');
    el.id = 'zeBubble';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.innerHTML = `${zeFace(mood || 'pensativo', 46)}<div class="zb-txt"><div class="zb-who">Mister Zé</div>${personalize(html)}</div><button class="zb-x" aria-label="Fechar" onclick="this.parentNode.classList.remove('show')">×</button>`;
  el.classList.add('show');
  clearTimeout(zeBubbleT);
  zeBubbleT = setTimeout(() => el.classList.remove('show'), keepMs || 14000);
}

/* ---------- Anular uma aposta tua (não chegaste a jogá-la) ---------- */
function cancelUserBet(id) {
  const b = loadBank();
  const bet = b.bets.find(x => String(x.id) === String(id));
  if (!bet || bet.status === 'cancel') return;
  const stake = Number(bet.stake) || 0, odd = Number(bet.odd) || 0;
  const prev = bet.status;
  const back = r2(stake - (prev === 'win' ? r2(stake * odd) : prev === 'void' ? stake : 0));
  const what = prev === 'open' ? `Devolvo ${eur(stake)} à tua carteira.`
    : prev === 'loss' ? `Estava como perdida: devolvo ${eur(stake)} à tua carteira.`
    : prev === 'win' ? `Estava como ganha: retiro o prémio e fica ${eurS(back)} na carteira.`
    : 'Estava como nula: o saldo não muda.';
  if (!confirm(`Anular «${bet.match} · ${bet.pick}» (${eur(stake)} @ ${odd.toFixed(2)})?\n\n${what}\n\nNo extrato fica um movimento de estorno.`)) return;
  b.you = r2(b.you + back);
  bet.cancelPrev = prev;
  bet.status = 'cancel';
  bet.cancelledAt = new Date().toISOString();
  saveBank(b);
  renderBanca();
  toast(`🗑️ Aposta anulada · ${back >= 0 ? 'devolvidos' : 'retirados'} ${eur(Math.abs(back))}`);
  const quips = ['Fizeste bem em corrigir. Contas limpas, duelo justo.', 'Anulado. Prefiro uma carteira honesta a uma carteira bonita.', 'Ok, essa não conta. Mas eu lembro-me dela. 😏'];
  zeSay(`🗑️ Registo anulado: <b>${esc(bet.pick)}</b>. ${quips[Math.floor(Math.random() * quips.length)]}`, 'neutro', 7000);
}

/* ---------- Gestão de banca: o Zé avalia a stake ---------- */
function stakeVerdict(bet, bankBefore) {
  const stake = Number(bet.stake) || 0, odd = Number(bet.odd) || 0;
  const pctB = bankBefore > 0 ? stake / bankBefore : 1;
  const p = typeof bet.zeP === 'number' ? bet.zeP : null;
  const k = p != null && odd > 1 ? (p * odd - 1) / (odd - 1) : null;
  const kellyMax = k != null ? Math.max(0, Math.min(0.05, k * 0.25)) * bankBefore : null;
  const ruin = stake > 0 ? Math.max(1, Math.floor(bankBefore / stake)) : null;
  return { pctB, kellyMax, ruin, k, p };
}
function zeStakeComment(bet, bankBefore) {
  const v = stakeVerdict(bet, bankBefore);
  const nm = esc(uname());
  const pctTxt = (v.pctB * 100).toLocaleString('pt-PT', { maximumFractionDigits: 0 }) + '%';
  const kTxt = v.kellyMax == null ? '' : v.kellyMax < 0.1 ? ' Pela matemática (Kelly ¼), o certo era <b>0 €</b> — a aposta nem tem valor.' : ` Pela matemática (Kelly ¼), o máximo era <b>${eur(v.kellyMax)}</b>.`;
  const legs = Array.isArray(bet.legs) ? bet.legs.length : 1;
  if (v.pctB > 0.2) {
    return { level: 'louco', mood: 'chateado', html: `🚨 <b>Loucura, ${nm}!</b> Meteste <b>${eur(bet.stake)}</b> — <b>${pctTxt} da tua banca</b> — numa só aposta${legs > 1 ? ` de ${legs} seleções` : ''}. A regra é 1–5%.${kTxt} Com ${v.ruin} perda${v.ruin > 1 ? 's' : ''} seguida${v.ruin > 1 ? 's' : ''} assim, ficas sem banca. Se correr bem, não é talento: é sorte. Eu vou estar a ver. 👀` };
  }
  if (v.pctB > 0.1) {
    return { level: 'alto', mood: 'pensativo', html: `⚠️ <b>${pctTxt} da banca</b> nesta aposta (${eur(bet.stake)}). Está acima das regras (máx. 5%).${kTxt} Não é o fim do mundo, mas se fizeres disto hábito, a variância come-te.` };
  }
  if (v.pctB > 0.05) {
    return { level: 'limite', mood: 'neutro', html: `🟡 ${eur(bet.stake)} = ${pctTxt} da banca. No limite do aceitável.${kTxt}` };
  }
  if (v.k != null && v.k > 0) return { level: 'ok', mood: 'feliz', html: `✅ Stake disciplinada (${pctTxt} da banca) numa aposta com valor. Assim até eu te respeito.` };
  return null;
}
function zeSettleComment(bet, result) {
  const pctB = bet.stakePct || 0;
  if (pctB <= 0.1 || result === 'void') return null;
  const nm = esc(uname());
  const prof = r2(bet.stake * bet.odd - bet.stake);
  if (result === 'win') {
    const p = typeof bet.zeP === 'number' ? bet.zeP : null;
    return { mood: 'pensativo', html: `🍀 Ganhaste ${eurS(prof)} com <b>${Math.round(pctB * 100)}% da banca</b> numa aposta. Parabéns… à sorte${p != null ? ` (dava-lhe ${pct(p)})` : ''}. Matematicamente continua errado — repete isto 10 vezes e conta-me como corre, ${nm}.` };
  }
  return { mood: 'gozao', html: `💥 Lá se foram <b>${eur(bet.stake)}</b> (${Math.round(pctB * 100)}% da banca) de uma vez. Eu avisei. Stake pequena dói pouco; stake louca dói isto.` };
}

/* addBet: avalia a stake das tuas apostas antes de registar */
const _addBetV22 = addBet;
addBet = function (bet, who) {
  let bankBefore = null, cm = null;
  if (who === 'you') {
    try { const ev = evalUserBet(bet); if (ev) Object.assign(bet, ev); } catch (e) {}
    bankBefore = loadBank().you;
    bet.stakePct = bankBefore > 0 ? +(Number(bet.stake) / bankBefore).toFixed(4) : 1;
    try { cm = zeStakeComment(bet, bankBefore); } catch (e) {}
    if (cm && cm.level !== 'ok') bet.zeWarn = cm.level;
  }
  const r = _addBetV22(bet, who);
  if (r && cm) setTimeout(() => zeSay(cm.html, cm.mood), 150);
  return r;
};
/* evalUserBet guarda também a probabilidade do Zé */
const _evalUserBetV22 = evalUserBet;
evalUserBet = function (bet) {
  const r = _evalUserBetV22(bet);
  if (r && typeof r.zeP === 'number') return r;
  return r;
};

/* settleBet / settleFromResults: comentário no fim */
const _settleBetV22 = settleBet;
settleBet = function (id, result, who) {
  const before = (who === 'ze' ? loadBank().zeBets : loadBank().bets).find(x => x.id === id);
  _settleBetV22(id, result, who);
  if (who === 'you' && before && before.status === 'open') {
    const c = zeSettleComment(before, result);
    if (c) setTimeout(() => zeSay(c.html, c.mood), 200);
  }
};
const _settleFromResultsV22 = settleFromResults;
settleFromResults = function (payload) {
  const rep = _settleFromResultsV22(payload);
  rep.filter(r => r.who === 'you').forEach(r => { const c = zeSettleComment(r.bet, r.result); if (c) setTimeout(() => zeSay(c.html, c.mood), 400); });
  return rep;
};

/* ---------- Perfil: disciplina de stake ---------- */
const _zeProfileV22 = zeProfile;
zeProfile = function () {
  const p = _zeProfileV22();
  const L = loadBank().bets.filter(x => x.status !== 'cancel' && typeof x.stakePct === 'number');
  const over = L.filter(x => x.stakePct > 0.1);
  const closed = over.filter(x => x.status === 'win' || x.status === 'loss');
  p.overN = over.length; p.stakeN = L.length;
  p.overWins = closed.filter(x => x.status === 'win').length; p.overLoss = closed.filter(x => x.status === 'loss').length;
  p.avgStakePct = L.length ? L.reduce((s, x) => s + x.stakePct, 0) / L.length : null;
  if (p.n >= 2 && p.overN >= Math.max(1, Math.ceil(p.n * 0.4))) { p.tipo = 'Kamikaze da banca'; p.emoji = '💣'; }
  return p;
};
const _zeProfileHTMLV22 = zeProfileHTML;
zeProfileHTML = function () {
  let h = _zeProfileHTMLV22();
  const p = zeProfile();
  if (p.stakeN) {
    const line = `<br>💼 <b>Gestão de banca:</b> stake média ${(p.avgStakePct * 100).toLocaleString('pt-PT', { maximumFractionDigits: 1 })}% da banca · ${p.overN} aposta${p.overN === 1 ? '' : 's'} acima de 10%${p.overWins + p.overLoss ? ` (${p.overWins} ganhas, ${p.overLoss} perdidas)` : ''}.`;
    const q = p.overN === 0 ? ' Disciplina exemplar. Ainda bem que pelo menos isso aprendeste comigo.'
      : p.overWins > p.overLoss ? ' As loucuras têm corrido bem — isso chama-se sorte, e a sorte não paga renda.'
      : ' As loucuras estão a custar caro. Stake pequena, ' + esc(uname()) + '. Sempre.';
    h += line + `<i>${q}</i>`;
  }
  if (p.tipo === 'Kamikaze da banca') h = h.replace(/<b>Diagnóstico: [^<]*<\/b>/, '<b>Diagnóstico: Kamikaze da banca</b>').replace(/^[^\s<]+\s/, '💣 ');
  return h;
};

/* ---------- Atalhos de registo no separador Apostas ---------- */
function registarPeloPrint() {
  wlSetTab('registar');
  const f = document.getElementById('slipFile');
  if (f) f.click();
}
