/* =====================================================================
   v60 · 💰 Recarregar banca (sem fechar a época)
   O montante entra nas duas bancas (tua e do Zé) e também no «capital investido» de cada um:
   - se estavas a perder, continuas a ver a perda (a recarga não esconde o prejuízo);
   - se estavas a ganhar, a banca simplesmente cresce — o lucro continua a ser só o que ganhaste.
   O ROI passa a ser (banca − capital) ÷ capital. Cada recarga fica registada.
   ===================================================================== */
function recarregarBanca() {
  const el = document.getElementById('cfgTopUp');
  const a = Math.round(parseFloat(String((el && el.value) || '').replace(',', '.')) * 100) / 100;
  if (!(a > 0)) { toast('Mete o montante a recarregar (ex. 20).'); if (el) el.focus(); return; }
  const b = loadBank();
  const resY = b.you + openStake(b.bets) - b.startYou, resZ = b.ze + openStake(b.zeBets) - b.startZe;
  if (!confirm(`Recarregar ${a.toFixed(2)} € na tua banca e na do Zé?\n\nTu: ${b.you.toFixed(2)} → ${(b.you + a).toFixed(2)} € (resultado até agora ${resY >= 0 ? '+' : ''}${resY.toFixed(2)} € fica igual)\nZé: ${b.ze.toFixed(2)} → ${(b.ze + a).toFixed(2)} € (resultado ${resZ >= 0 ? '+' : ''}${resZ.toFixed(2)} € fica igual)`)) return;
  b.topups = b.topups || [];
  b.topups.push({ at: new Date().toISOString(), amount: a, youBefore: b.you, zeBefore: b.ze, resYou: +resY.toFixed(2), resZe: +resZ.toFixed(2) });
  b.you = r2(b.you + a); b.ze = r2(b.ze + a);
  b.startYou = r2(b.startYou + a); b.startZe = r2(b.startZe + a); b.start = b.startYou;
  b.zePeak = Math.max(b.zePeak || 0, b.ze);
  saveBank(b);
  if (el) el.value = '';
  try { renderBanca(); } catch (e) {}
  try { renderConfig(); } catch (e) {}
  toast(`💰 Recarregado ${a.toFixed(2)} € · ${pname()} ${b.you.toFixed(2)} € · Zé ${b.ze.toFixed(2)} €`);
}
/* a recarga fica na época atual; ao começar nova época passa para o histórico */
novaEpoca = (function (prev) {
  return function () {
    const b0 = loadBank(), tops = (b0.topups || []).slice();
    const r = prev.apply(this, arguments);
    try {
      const b = loadBank();
      if (tops.length && b.season === b0.season + 1 && b.seasons[0] && b.seasons[0].n === b0.season) { b.seasons[0].topups = tops.reduce((s, t) => s + t.amount, 0); b.topups = []; saveBank(b); }
    } catch (e) {}
    return r;
  };
})(novaEpoca);
renderConfig = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const b = loadBank(), T = b.topups || [], el = document.getElementById('cfgSeasonNow');
      if (el && T.length && !el.querySelector('.cfg-tops')) {
        const tot = T.reduce((s, t) => s + t.amount, 0);
        el.innerHTML = el.innerHTML.replace('Tu começaste com', 'Capital: tu').replace('· Zé com', '· Zé');
        el.insertAdjacentHTML('beforeend', `<div class="cfg-tops" style="margin-top:4px;">💰 Inclui <b>+${tot.toFixed(2)} €</b> de recargas (${T.length} vez${T.length > 1 ? 'es' : ''}) — o ROI conta com isto, por isso não fica inflacionado.</div>`);
      }
    } catch (e) {}
    return r;
  };
})(renderConfig);

/* ---------- 🤖 o Zé também aposta o boletim seguro ---------- */
function safeZeBet() {
  const S = safeSel(); if (!S.length) { toast('Escolhe pelo menos uma seleção.'); return; }
  if (S.some(x => !(x.od > 1))) { toast('Falta a odd de alguma seleção (mete a da tua casa).'); return; }
  const O = S.reduce((a, x) => a * x.od, 1), P = S.reduce((a, x) => a * x.c.p, 1);
  if (O < ZE_MIN_ODD) { toast(`🤖 Passo: odd total ${O.toFixed(2)} — abaixo de ${ZE_MIN_ODD.toFixed(2)} o Zé não aposta. Junta mais um jogo.`); return; }
  const b = loadBank();
  const key = S.map(x => x.c.m.home + '|' + x.c.key).sort().join(',');
  if (b.zeBets.some(z => z.safeKey === key && Date.now() - Date.parse(z.at || 0) < 2 * 864e5)) { toast('🤖 Já apostei este boletim.'); return; }
  // o valor é sempre decidido pelo Zé (gestão de banca dele), nunca pelo campo do utilizador
  const ev0 = P * O - 1, kelly = ev0 > 0 ? (P * O - 1) / (O - 1) : 0;
  const exposure = openStake(b.zeBets), capLeft = Math.max(0, r2((b.ze + exposure) * 0.15 - exposure));
  let stake = kelly > 0 ? r2(b.ze * Math.min(0.05, kelly * 0.25)) : 0, how = kelly > 0 ? `Kelly ¼ (${(Math.min(0.05, kelly * 0.25) * 100).toFixed(1)}% da banca)` : '';
  if (stake < chStake()) { stake = chStake(); how = 'stake mínima (1% da banca: aposta pela probabilidade, não pelo valor)'; }
  stake = r2(Math.min(stake, capLeft, b.ze));
  if (!(b.ze > 0)) { toast('🤖 Estou sem banca — recarrega em Definições.'); return; }
  if (stake < 0.1) { toast('🤖 Passo: já tenho 15% da banca em jogo — espero pelos resultados.'); return; }
  const leg = x => ({ home: x.c.m.home, away: x.c.m.away, sel: marketName(x.c.key, x.c.m), odd: +x.od.toFixed(2), market: x.c.key });
  const ev = ev0;
  const ok = addBet({ match: S.length === 1 ? `${S[0].c.m.home} vs ${S[0].c.m.away}` : `Boletim seguro do Zé (${S.length} jogos)`, pick: S.length === 1 ? marketName(S[0].c.key, S[0].c.m) : 'Múltipla segura', odd: +O.toFixed(2), stake, legs: S.map(leg), source: 'boletim-seguro-ze', safeKey: key, pUsed: +P.toFixed(3), zeCompare: `Boletim seguro · prob ${pct(P)} · odd ${O.toFixed(2)} · EV ${(ev * 100).toFixed(1)}% · ${how}` }, 'ze');
  if (ok) { toast(`🤖 Aposto ${stake.toFixed(2)} € no boletim seguro (odd ${O.toFixed(2)}, eu dou ${pct(P)}) — ${how}.`); try { renderBanca(); } catch (e) {} try { updateContinue(); } catch (e) {} }
}
safeSum = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const el = document.getElementById('ssSum'); if (!el || el.querySelector('.ss-ze')) return r;
      const row = el.querySelector('div[style*="flex"]'); if (!row) return r;
      row.insertAdjacentHTML('beforeend', `<button class="btn ss-ze" onclick="safeZeBet()">🤖 O Zé aposta</button>`);
      el.insertAdjacentHTML('beforeend', `<div class="muted" style="font-size:.74rem;margin-top:4px;">«O Zé aposta» põe o Zé a apostar este boletim (múltipla). <b>O valor é sempre ele que decide</b>, pela gestão de banca dele: Kelly ¼ quando há valor, 1% da banca quando não há, e nunca mais de 15% da banca em jogo. Abaixo de odd ${ZE_MIN_ODD.toFixed(2)} ele passa.</div>`);
    } catch (e) {}
    return r;
  };
})(safeSum);
