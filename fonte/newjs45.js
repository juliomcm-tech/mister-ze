/* =====================================================================
   v53d · desafios do Zé + jogos adiados
   1) 🎯 Desafios do Zé (no Duelo): o Zé mostra as opções do dia já escolhidas — valor (com odds), seguras e
      o jogo do dia. «Aceitar» abre o duelo nesse jogo com as odds das casas e a decisão do Zé feita.
   2) Jogos adiados/cancelados deixam de contar como 0-0: desfaz o que foi decidido com esse 0-0 falso
      (diário, seleções seguras e apostas liquidadas sozinhas).
   ===================================================================== */
/* ---------- 1) desafios ---------- */
let CH_MEM = null;
function zeChallenges(hours) {
  const key = (hours || 36) + '|' + matches.length + '|' + Object.keys(STUDY).length;
  if (CH_MEM && CH_MEM.key === key && Date.now() - CH_MEM.t < 60e3) return CH_MEM.v;
  const v = zeChallengesRaw(hours); CH_MEM = { key, t: Date.now(), v }; return v;
}
function zeChallengesRaw(hours) {
  const now = Date.now(), out = [], seen = new Set();
  const list = matches.map((m, i) => ({ m, i, k: kickOf(m) })).filter(x => x.m.live && x.m.espn && !x.m.past && !x.m.aviso && x.k && x.k.getTime() > now + 5 * 60e3 && x.k.getTime() < now + (hours || 36) * 3600e3);
  // valor (só jogos já estudados com odds; regras da simulação)
  list.forEach(x => {
    const st = studyFor(x.m); if (!st || !st.books || !st.books.length) return;
    let v = null;
    try { v = oddsValue(x.m).filter(o => o.ev > zeEdgeFor(0.03, o.o) && o.o <= 6 && o.p >= 0.2 && !o.doubt && !o.gate).sort((a, b) => b.ev - a.ev)[0]; } catch (e) {}
    if (v) { out.push({ ...x, cat: 'valor', k2: v.k, p: v.p, odd: v.o, book: v.book, ev: v.ev, score: 2 + v.ev }); seen.add(x.i); }
  });
  // seguras (aposta lógica forte)
  list.forEach(x => {
    if (seen.has(x.i)) return;
    const z = zeLogical(x.m); if (!z || z.fallback || z.p < 0.75) return;
    const st = studyFor(x.m), o = st && st.books && st.books[0] && st.books[0].odds[z.k];
    out.push({ ...x, cat: 'segura', k2: z.k, p: z.p, odd: o > 1 ? o : null, book: o > 1 ? st.books[0].provider : null, score: 1 + z.p });
    seen.add(x.i);
  });
  // jogo do dia (favorito mais forte), se ainda não estiver
  try {
    let best = null; list.forEach(x => { if (seen.has(x.i)) return; const r = modelo(x.m), f = favOf(r.mk); if (f !== 'X' && r.mk[f] >= 0.5 && (!best || r.mk[f] > best.p)) best = { ...x, cat: 'dia', k2: f, p: r.mk[f], odd: null, score: 0.5 + r.mk[f] }; });
    if (best) out.push(best);
  } catch (e) {}
  return out.sort((a, b) => b.score - a.score || a.k - b.k).slice(0, 8);
}
const CH_TAG = { valor: ['💶', 'Valor', 'odd acima do que o Zé acha justo'], segura: ['🛡️', 'Segura', 'a aposta mais provável do jogo'], dia: ['⭐', 'Jogo do dia', 'o favorito mais forte'] };
function zeChallengesHTML() {
  const C = zeChallenges(36);
  if (!C.length) return `<div class="muted" style="padding:6px 0;">Hoje o Zé não tem desafios: nas próximas 36 horas não há jogos com aposta segura forte nem valor. Carrega em 📡 Atualizar mais logo.</div>`;
  return C.map((c, n) => {
    const t = CH_TAG[c.cat];
    return `<div class="vc-card ch-card" data-i="${c.i}"><div class="vc-top">${esc(c.m.league || '')} · ${esc(c.m.date || '')}${c.m.kickoff ? ' · ' + esc(c.m.kickoff) : ''}</div>
      <div class="vc-teams" onclick="openMatchIdx(${c.i})">${esc(c.m.home)} vs ${esc(c.m.away)}</div>
      <div class="vc-bet">${t[0]} <b>${t[1]}:</b> ${esc(marketName(c.k2, c.m))} · Zé ${pct(c.p)}${c.odd ? ` · ${esc(c.book || 'casa')} ${(+c.odd).toFixed(2)}` : ` · justa ${fairOdd(c.p)}`}${c.ev ? ` · valor +${Math.round(c.ev * 100)}%` : ''}</div>
      <div class="ch-acts"><button class="btn btn-lime" onclick="aceitarDesafio(${c.i})">⚔️ Aceitar desafio</button><span class="muted" style="font-size:.74rem;">${esc(t[2])}</span></div></div>`;
  }).join('') + `<div class="muted" style="font-size:.74rem;margin-top:4px;">As odds são da Bet365/DraftKings quando o Zé já estudou o jogo. A tua casa pode pagar diferente — confirma antes de apostar.</div>`;
}
function zeChallengesToggle(force) {
  const box = document.getElementById('zeChallenges'); if (!box) return;
  const open = force != null ? force : box.hidden;
  box.hidden = !open;
  const b = document.getElementById('btnChallenges'); if (b) b.textContent = open ? '🎯 Esconder desafios' : '🎯 Desafios do Zé';
  if (open) { box.innerHTML = `<div class="panel-h" style="margin:-14px -14px 12px;"><span>🎯 Desafios do Zé</span><span class="muted">as opções dele para hoje e amanhã</span></div>${zeChallengesHTML()}`; }
}
let DUEL_AUTO = null;
function aceitarDesafio(i) {
  DUEL_AUTO = i;
  zeChallengesToggle(false);
  prepararDuelo(i);
  setTimeout(() => { const el = document.getElementById('dueloBox'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120);
  // se o jogo já estava estudado, as odds já foram preenchidas: decide já
  setTimeout(duelAutoDecide, 400);
}
function duelAutoDecide() {
  if (DUEL_AUTO == null || !dueloAtual || matchIndex(dueloAtual.m) !== DUEL_AUTO) return;
  const filled = [...document.querySelectorAll('#dueloBox .oddin')].some(el => +el.value > 1);
  if (!filled) return;
  DUEL_AUTO = null;
  try { zeDecidirUI(); setTimeout(() => { const d = document.getElementById('zeDecision'); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150); } catch (e) {}
}
prefillMarketOdds = (function (prev) { return function (m) { const r = prev.apply(this, arguments); setTimeout(duelAutoDecide, 50); return r; }; })(prefillMarketOdds);
/* o duelo abre no primeiro desafio (em vez de um jogo qualquer) */
pickDueloMatch = (function (prev) { return function () { try { const c = zeChallenges(36)[0]; if (c) return c.m; } catch (e) {} return prev.apply(this, arguments); }; })(pickDueloMatch);
(function () {
  try {
    const css = document.createElement('style');
    css.textContent = `.ch-acts{display:flex;align-items:center;gap:10px;flex-wrap:wrap;} #zeChallenges{padding:14px;margin-bottom:14px;}`;
    document.head.appendChild(css);
    const view = document.getElementById('view-duelo'); if (!view) return;
    const head = view.querySelector('.screen-head .btn-row');
    if (head && !document.getElementById('btnChallenges')) head.insertAdjacentHTML('afterbegin', '<button class="btn btn-lime" id="btnChallenges" onclick="zeChallengesToggle()">🎯 Desafios do Zé</button>');
    const db = document.getElementById('dueloBox');
    if (db && !document.getElementById('zeChallenges')) db.insertAdjacentHTML('beforebegin', '<div id="zeChallenges" class="panel" hidden></div>');
  } catch (e) {}
})();
fmGo = (function (prev) {
  return function (v) {
    const r = prev.apply(this, arguments);
    // ao entrar no Duelo sem duelo aberto, mostra logo os desafios
    if (v === 'duelo') { try { const db = document.getElementById('dueloBox'); if (!db || db.style.display === 'none' || !db.innerHTML.trim()) zeChallengesToggle(true); } catch (e) {} }
    return r;
  };
})(fmGo);
zeTalk = (function (prev) {
  return function (raw, opts) {
    try { const q = normTxt(raw); if (/desafio|desafia-me|o que apostas hoje|qual e a tua aposta|em que jogo apostas/.test(q)) { setTimeout(() => { fmGo('duelo'); zeChallengesToggle(true); }, 300); const c = zeChallenges(36); return { mood: 'gozao', html: c.length ? `🎯 Hoje desafio-te nisto: <b>${esc(marketName(c[0].k2, c[0].m))}</b> em ${esc(c[0].m.home)} vs ${esc(c[0].m.away)} (${pct(c[0].p)}). Abri a lista no Duelo — tens mais ${c.length - 1}.` : 'Hoje não tenho desafio que valha a pena. Às vezes a melhor aposta é não apostar.' }; } } catch (e) {}
    return prev.apply(this, arguments);
  };
})(zeTalk);

/* ---------- 2) jogos adiados: desfazer o 0-0 falso ---------- */
function undoPostponed(payload) {
  const P = ((payload && payload.matches) || []).filter(x => x && x.status === 'POSTPONED');
  if (!P.length) return 0;
  const ids = new Set(P.map(x => String(x.id))); let n = 0;
  try {
    const D = diaryLoad(); let ch = false;
    Object.values(D.items).forEach(it => { if (it.res && ids.has(String(it.ev))) { delete it.res; delete it.g; delete it.graded; ch = true; n++; } });
    if (ch) { diarySave(D); try { DIARY_FIX_CACHE = null; } catch (e) {} }
  } catch (e) {}
  try {
    const L = safeLog(); let ch = false;
    Object.values(L.legs).forEach(l => { if (l.w != null && ids.has(String(l.ev))) { delete l.w; delete l.res; ch = true; n++; } });
    if (ch) lsSet(SAFE_KEY, L);
  } catch (e) {}
  try {
    const fake = P.map(x => ({ ...x, score: { fullTime: { home: 0, away: 0 } } }));
    const b = loadBank(); let ch = false;
    const fix = (bet, who) => {
      if (!bet.autoSettled || (bet.status !== 'win' && bet.status !== 'loss')) return;
      if (!/\b0-0\b/.test(bet.finalScores || '')) return;
      const legs = Array.isArray(bet.legs) && bet.legs.length ? bet.legs : [legFromBet(bet)];
      if (!legs[0] || !legs.some(l => resolveLeg(l, fake, bet.at))) return;
      if (bet.status === 'win') { const ret = Math.round(bet.stake * bet.odd * 100) / 100; if (who === 'ze') b.ze = Math.round((b.ze - ret) * 100) / 100; else b.you = Math.round((b.you - ret) * 100) / 100; }
      bet.status = 'open'; delete bet.settledAt; delete bet.autoSettled; delete bet.finalScores; bet.note = 'Jogo adiado — voltou a ficar em aberto';
      ch = true; n++;
    };
    b.bets.forEach(x => fix(x, 'you')); b.zeBets.forEach(x => fix(x, 'ze'));
    if (ch) saveBank(b);
  } catch (e) { console.warn(e); }
  if (n) { try { toast(`↩️ ${n} registo${n > 1 ? 's' : ''} desfeito${n > 1 ? 's' : ''}: jogo adiado não é 0-0.`); } catch (e) {} }
  return n;
}
applyLive = (function (prev) { return function (payload) { try { undoPostponed(payload); } catch (e) {} return prev.apply(this, arguments); }; })(applyLive);
