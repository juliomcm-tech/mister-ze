/* =====================================================================
   v55c · rapidez (sem mudar contas)
   Medido no telemóvel simulado (CPU 4× mais lenta, 450 apostas, 120 jogos): entrar no Duelo levava ~4,5 s.
   - 3,2 s eram o Raio-X das tuas apostas, que é calculado mesmo estando escondido (fica em Finanças).
     Agora só se calcula quando abres Finanças, e fica guardado até mudarem as apostas ou os jogos.
   - a procura «que jogo é esta seleção?» repetia-se centenas de vezes: agora fica em memória.
   - os desafios do Zé aparecem a seguir ao ecrã abrir (o ecrã muda logo).
   ===================================================================== */
let MATCH_VER = 0, MATCH_LEN = -1;
function matchVer() { if (matches.length !== MATCH_LEN) { MATCH_LEN = matches.length; MATCH_VER++; } return MATCH_VER; }
applyLive = (function (prev) { return function () { MATCH_VER++; return prev.apply(this, arguments); }; })(applyLive);
const FML_MEM = new Map(); let FML_VER = -1, FML_DAY = '';
findMatchForLeg = (function (prev) {
  return function (leg) {
    if (!leg) return prev.apply(this, arguments);
    const v = matchVer(), day = new Date().toDateString();
    if (v !== FML_VER || day !== FML_DAY) { FML_MEM.clear(); FML_VER = v; FML_DAY = day; }
    const k = (leg.home || '') + '|' + (leg.away || '') + '|' + (leg.sel || '');
    if (FML_MEM.has(k)) return FML_MEM.get(k);
    const r = prev.apply(this, arguments);
    if (FML_MEM.size > 2000) FML_MEM.clear();
    FML_MEM.set(k, r);
    return r;
  };
})(findMatchForLeg);
/* liga de cada seleção para o Raio-X: guardada no aparelho (a liga de um jogo não muda) e no máximo 25 procuras novas de cada vez */
const LEGLG_KEY = 'ze_leg_league_v1';
let RX_MODE = false, RX_BUDGET = 0, RX_LG = null, RX_LG_DIRTY = false;
findMatchForLeg = (function (prev) {
  return function (leg) {
    if (!RX_MODE || !leg) return prev.apply(this, arguments);
    const k = normTxt((leg.home || '') + '|' + (leg.away || '') + '|' + (leg.home && leg.away ? '' : leg.sel || ''));
    const hit = RX_LG[k];
    if (hit && (hit.lg || Date.now() - hit.t < 3 * 864e5)) return hit.lg ? { league: hit.lg } : null;
    if (RX_BUDGET <= 0) return null;
    RX_BUDGET--;
    const m = prev.apply(this, arguments);
    RX_LG[k] = { lg: (m && m.league) || null, t: Date.now() }; RX_LG_DIRTY = true;
    return m;
  };
})(findMatchForLeg);
/* Raio-X: guardado enquanto as apostas e os jogos forem os mesmos */
let RX_MEM = null;
function rxSig() { const b = loadBank(); let h = b.bets.length + ':' + matchVer(); for (const x of b.bets) h += x.id + (x.status || '?')[0] + (x.legs ? x.legs.length : 0) + ','; return h.length + '|' + h.slice(-400) + '|' + b.bets.reduce((s, x) => s + (x.status === 'win' ? 3 : x.status === 'loss' ? 7 : 1), 0); }
raioX = (function (prev) {
  return function () {
    const s = rxSig();
    if (RX_MEM && RX_MEM.s === s && Date.now() - RX_MEM.t < (RX_MEM.partial ? 20e3 : 10 * 60e3)) return RX_MEM.v;
    RX_LG = lsGet(LEGLG_KEY, {}); RX_LG_DIRTY = false; RX_MODE = true; RX_BUDGET = 25;
    let v; try { v = prev.apply(this, arguments); } finally { RX_MODE = false; }
    if (RX_LG_DIRTY) { const ks = Object.keys(RX_LG); if (ks.length > 1500) ks.sort((a, b) => RX_LG[a].t - RX_LG[b].t).slice(0, ks.length - 1500).forEach(x => delete RX_LG[x]); lsSet(LEGLG_KEY, RX_LG); }
    RX_MEM = { s, t: Date.now(), v: v, partial: RX_BUDGET <= 0 }; return v;
  };
})(raioX);
let RX_PENDING = false;
raioXHTML = (function (prev) {
  return function (chat) {
    // escondido (Finanças fechado): não calcula agora; calcula quando o telemóvel estiver livre ou ao abrires Finanças
    if (!chat && typeof currentView !== 'undefined' && currentView !== 'banca' && !(RX_MEM && RX_MEM.s === rxSig())) {
      if (!RX_PENDING) { RX_PENDING = true; const go = () => { RX_PENDING = false; try { const el = document.querySelector('#wlRaioX .panel-b'); if (el) el.innerHTML = prev.call(this, false); } catch (e) {} }; (window.requestIdleCallback || (f => setTimeout(f, 1500)))(go, { timeout: 4000 }); }
      return '<div class="muted">⏳ O Zé está a fazer as contas das tuas apostas…</div>';
    }
    return prev.apply(this, arguments);
  };
})(raioXHTML);
fmGo = (function (prev) { return function (v) { const r = prev.apply(this, arguments); if (v === 'banca') { try { const el = document.querySelector('#wlRaioX .panel-b'); if (el && /⏳/.test(el.textContent)) el.innerHTML = raioXHTML(false); } catch (e) {} } return r; }; })(fmGo);
/* desafios: se ainda não estão calculados, o ecrã abre primeiro e eles aparecem logo a seguir */
zeChallengesToggle = (function (prev) {
  return function (force) {
    const box = document.getElementById('zeChallenges');
    const opening = box && (force != null ? force : box.hidden);
    const hot = CH_MEM && Date.now() - CH_MEM.t < 5 * 60e3 && CH_MEM.key === (36 + '|' + matches.length + '|' + Object.keys(STUDY).length + '|' + matchVer());
    if (!opening || hot || /jsdom/i.test(navigator.userAgent || '')) return prev.apply(this, arguments);
    box.hidden = false;
    box.innerHTML = `<div class="panel-h" style="margin:-14px -14px 12px;"><span>🎯 Desafios do Zé</span><span class="muted">a escolher…</span></div><div class="muted">⏳ O Zé está a ver os jogos de hoje e amanhã…</div>`;
    const args = arguments;
    setTimeout(() => { try { box.hidden = true; prev.apply(this, args); if (typeof chPanelDone === 'function') chPanelDone(box); } catch (e) {} }, 30);
  };
})(zeChallengesToggle);

/* desafios: guardados 5 min (mudam quando há jogos/odds novas) */
zeChallenges = function (hours) {
  const key = (hours || 36) + '|' + matches.length + '|' + Object.keys(STUDY).length + '|' + matchVer();
  if (CH_MEM && CH_MEM.key === key && Date.now() - CH_MEM.t < 5 * 60e3) return CH_MEM.v;
  const v = zeChallengesRaw(hours); CH_MEM = { key, t: Date.now(), v }; return v;
};

/* ---------- regra do duelo: o Zé nunca aposta abaixo de 1.25 ---------- */
const ZE_MIN_ODD = 1.25;
function chOddOf(m, k, p) {
  try { const st = studyFor(m), o = st && st.books && st.books[0] && st.books[0].odds[k]; if (o > 1) return { odd: +o, est: false, book: st.books[0].provider }; } catch (e) {}
  return { odd: p > 0 ? 0.95 / p : 0, est: true, book: null };   // sem odd da casa: estimativa com a margem normal
}
function chFixMinOdd(c) {
  const o = c.odd > 1 ? { odd: +c.odd, est: false } : chOddOf(c.m, c.k2, c.p);
  if (o.odd >= ZE_MIN_ODD) return c;
  // a escolha mais provável paga pouco: procura a seguinte mais provável que pague pelo menos 1.25
  let r = null; try { r = modelo(c.m); } catch (e) {}
  if (!r) return null;
  const alt = ['1', '2', 'O1.5', '1X', 'X2', 'O2.5', 'U3.5', 'BTTS', 'U2.5'].filter(k => k !== c.k2 && r.mk[k] >= 0.6)
    .map(k => ({ k, p: r.mk[k], o: chOddOf(c.m, k, r.mk[k]) })).filter(x => x.o.odd >= ZE_MIN_ODD).sort((a, b) => b.p - a.p)[0];
  if (!alt) return null;
  return Object.assign({}, c, { k2: alt.k, p: alt.p, odd: alt.o.est ? null : alt.o.odd, book: alt.o.book, cat: alt.p >= 0.7 ? 'segura' : 'dia', ev: null, score: (alt.p >= 0.7 ? 1 : 0.5) + alt.p });
}
const _zeChallengesV55 = zeChallenges;
zeChallenges = function (hours) {
  const key = (hours || 36) + '|' + matches.length + '|' + Object.keys(STUDY).length + '|' + matchVer();
  if (CH_MEM && CH_MEM.key === key && Date.now() - CH_MEM.t < 5 * 60e3) return CH_MEM.v;
  const v = zeChallengesRaw(hours).map(c => { try { return chFixMinOdd(c); } catch (e) { return c; } }).filter(Boolean).sort((a, b) => b.score - a.score || a.k - b.k);
  CH_MEM = { key, t: Date.now(), v }; return v;
};
/* em qualquer duelo, odds abaixo de 1.25 não entram na decisão do Zé */
zeDecide = (function (prev) {
  return function (m, odds, bankAvail) {
    const o = {}; let cut = 0;
    Object.keys(odds || {}).forEach(k => { if (+odds[k] >= ZE_MIN_ODD) o[k] = odds[k]; else cut++; });
    if (!Object.keys(o).length) { const d = prev(m, odds, bankAvail); d.pick = null; d.stake = 0; d.lowOdd = true; return d; }
    const d = prev(m, cut ? o : odds, bankAvail);
    if (cut) { d.lowOdd = true; try { const full = prev(m, odds, bankAvail); d.rows = full.rows; } catch (e) {} }
    return d;
  };
})(zeDecide);
zeDecidirUI = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const d = dueloAtual && dueloAtual.decision, el = document.getElementById('zeDecision');
      if (d && el && d.pick && d.pick.odd < ZE_MIN_ODD) {   // desafio com odd baixa: não joga
        d.pick = null; d.stake = 0;
        const sp = el.querySelector('.speech'); if (sp) sp.innerHTML = `${zeFace('pensativo', 46)}<div><b>Passo.</b> A odd é abaixo de ${ZE_MIN_ODD.toFixed(2)} — regra do duelo: o Zé não aposta abaixo de ${ZE_MIN_ODD.toFixed(2)} (arrisca muito para ganhar quase nada).</div>`;
      } else if (d && el && d.lowOdd && !d.pick) {
        el.querySelectorAll('.speech').forEach(sp => sp.insertAdjacentHTML('beforeend', `<div class="muted" style="font-size:.76rem;margin-top:4px;">Odds abaixo de ${ZE_MIN_ODD.toFixed(2)} ficam sempre de fora (regra do duelo).</div>`));
      }
    } catch (e) {}
    return r;
  };
})(zeDecidirUI);

/* ---------- desafio aceite sai da lista ---------- */
const CH_DONE_KEY = 'ze_ch_done_v1';
function chKeyOf(m) { return m ? normTxt(m.home + ' vs ' + m.away) + '|' + (m.date || '') : ''; }
function chIsDone(m, D, zb) {
  try {
    D = D || lsGet(CH_DONE_KEY, {}); zb = zb || loadBank().zeBets;
    const k = chKeyOf(m);
    if (D[k] && Date.now() - D[k] < 4 * 864e5) return true;
    const mk = m.home + ' vs ' + m.away;
    return zb.some(x => x.match === mk && (x.status === 'open' || Date.now() - Date.parse(x.at || 0) < 2 * 864e5));
  } catch (e) { return false; }
}
function chMarkDone(m) {
  try { const D = lsGet(CH_DONE_KEY, {}); D[chKeyOf(m)] = Date.now(); Object.keys(D).forEach(k => { if (Date.now() - D[k] > 5 * 864e5) delete D[k]; }); lsSet(CH_DONE_KEY, D); } catch (e) {}
  CH_MEM = null;
}
zeChallenges = (function (prev) { return function () { const L = prev.apply(this, arguments) || []; if (!L.length) return L; const D = lsGet(CH_DONE_KEY, {}), zb = loadBank().zeBets; return L.filter(c => !chIsDone(c.m, D, zb)); }; })(zeChallenges);
aceitarDesafio = (function (prev) {
  return function (i) {
    const r = prev.apply(this, arguments);
    try { const c = CH_ACCEPTED; if (c && c.m) chMarkDone(c.m); else if (matches[i]) chMarkDone(matches[i]); setTimeout(() => { try { updateContinue(); } catch (e) {} }, 50); } catch (e) {}
    return r;
  };
})(aceitarDesafio);
confirmarDueloZe = (function (prev) { return function () { const r = prev.apply(this, arguments); CH_MEM = null; try { updateContinue(); } catch (e) {} return r; }; })(confirmarDueloZe);
