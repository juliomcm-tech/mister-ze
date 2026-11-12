/* =====================================================================
   v63 · medir melhor para decidir melhor
   1) 📉 4.ª carteira do piloto: só quando a odd da equipa caiu 6%+ desde a abertura (hipótese a testar ao vivo)
      — a ideia inicial «só valor positivo» (prob. × odd ≥ 1) chumbou no teste: 12 apostas em 1 434, 58% certas (prometia 77%)
   2) CLV de TODAS as apostas do piloto (odd apanhada vs odd de fecho)
   3) margem de erro nos números (intervalo) + veredicto só com 100 apostas
   4) regras congeladas, com registo de cada mudança
   5) 🔬 laboratório de fatores (o que foi testado na época 2025/26 e o que cada aposta tinha)
   ===================================================================== */
/* ---------- odd de um mercado a partir das odds de uma casa (real ou derivada, como no piloto) ---------- */
function oddFromBook(o, k, der) {
  try {
    if (!o) return null;
    if (!der && o[k] > 1) return +o[k];
    if (OUT_SET[k] && o['1'] > 1 && o.X > 1 && o['2'] > 1) { const s = OUT_SET[k].reduce((a, j) => a + 1 / o[j], 0); return s > 0 && s < 1 ? 1 / s : null; }
    const g = /^([OU])(\d+)\.5$/.exec(k); if (!g) return null;
    const line = ['2.5', '1.5', '3.5'].find(L => o['O' + L] > 1 && o['U' + L] > 1); if (!line) return null;
    const t = 1 / o['O' + line] + 1 / o['U' + line], pO = (1 / o['O' + line]) / t, nL = Math.floor(+line);
    const cdf = (lam, n) => { let s = 0, term = Math.exp(-lam); for (let i = 0; i <= n; i++) { if (i) term *= lam / i; s += term; } return s; };
    let lo = 0.1, hi = 7;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (1 - cdf(mid, nL) < pO) lo = mid; else hi = mid; }
    const pU = cdf((lo + hi) / 2, +g[2]), p = g[1] === 'O' ? 1 - pU : pU;
    return p > 0.02 && p < 0.98 ? 1 / (p * t) : null;
  } catch (e) { return null; }
}
/* ---------- margem de erro (intervalo de Wilson a 95%) ---------- */
function wilson(w, n) {
  if (!(n > 0)) return null;
  const z = 1.96, p = w / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
function ciTxt(w, n) { const ci = wilson(w, n); return ci ? `entre ${Math.round(ci[0] * 100)}% e ${Math.round(ci[1] * 100)}%` : ''; }

/* ---------- regras congeladas ---------- */
const ZE_RULES = {
  ver: 'R1', since: '2026-11-09',
  log: [
    { ver: 'R1', d: '2026-11-09', txt: 'Regras fixadas depois do teste da época 2025/26 (2 mil jogos, sem ver o futuro). Selo de ouro: probabilidade ≥ 70%, odd 1,25–1,40, casas a concordar (±6 pontos), sem «vitória», «ambas marcam» e «empate», sem Liga Europa/Conference e sem qualificações de seleções. Piloto: 1% da carteira (ou Kelly ¼ até 5% quando há valor), nunca mais de 15% em jogo, nunca abaixo de odd 1,25. Seleções só com odds das casas. Novo: jogos de fim de época em que uma equipa já não joga para nada ficam fora do selo e do piloto (travão provisório); carteira 📉 «Odd a cair» a testar ao vivo.' }
  ]
};
const RULES_SEEN_KEY = 'ze_rules_seen_v1';
(function () { try { const s = lsGet(RULES_SEEN_KEY, null) || {}; if (!s[ZE_RULES.ver]) { s[ZE_RULES.ver] = Date.now(); lsSet(RULES_SEEN_KEY, s); } } catch (e) {} })();
function rulesOf(x) { return x.rv || 'R0'; }

/* ---------- 1) 4.ª carteira: odd a cair (mercado a ir para o lado do Zé) ----------
   Mercado inteiro, duplas hipóteses a ~1,33 em que a odd da equipa caiu 6%+ da abertura ao fecho:
   2025/26: 82% certas (casas davam 72%) em 232 · 2026/27: 81% (73%) em 74. Nas escolhas do Zé: 87% numa época, 68% na outra.
   Promissor mas não provado → corre numa carteira à parte, sem mexer nas outras. */
AUTO_W.cai = { key: 'ze_auto_cai_v1', name: '📉 Odd a cair', desc: 'só quando a odd da equipa já caiu 6% ou mais desde a abertura', perDay: 3, ok: c => !!(c.fx && c.fx.dr != null && c.fx.dr <= -0.06) };
(function () {
  try {
    if (lsGet(AUTO_W.cai.key, null)) return;
    const o = lsGet(AUTO_W.ouro.key, null); if (!o) return;                 // piloto nunca usado: fica com o valor por omissão
    const cap = r2((o.start || 100) + (o.topups || []).reduce((s, t) => s + (t.amount || 0), 0));   // começa com o mesmo capital das outras (comparação justa)
    lsSet(AUTO_W.cai.key, { start: cap, bank: cap, bets: [], topups: [], perDay: AUTO_W.cai.perDay, since: new Date().toISOString() });
  } catch (e) {}
})();

/* ---------- 5a) fatores de cada candidato (ficam gravados na aposta) ---------- */
function zeFactors(m, k) {
  const f = {};
  try {
    const st = studyFor(m); if (!st) return f;
    const side = ['1', '1X'].includes(k) ? 'h' : ['2', 'X2'].includes(k) ? 'a' : /^O/.test(k) ? 'o' : /^U/.test(k) ? 'u' : null;
    const b = (st.books || []).find(x => x.oc), oc = b && b.oc;
    if (oc && side === 'h' && oc.oh && oc.ch) f.dr = +(oc.ch / oc.oh - 1).toFixed(3);
    if (oc && side === 'a' && oc.oa && oc.ca) f.dr = +(oc.ca / oc.oa - 1).toFixed(3);
    if (oc && side === 'o' && oc.ot && oc.ct) f.dr = +(oc.ct.o / oc.ot.o - 1).toFixed(3);
    if (oc && side === 'u' && oc.ot && oc.ct) f.dr = +(oc.ct.u / oc.ot.u - 1).toFixed(3);
    const rp = side === 'h' ? st.restH : side === 'a' ? st.restA : null, ro = side === 'h' ? st.restA : side === 'a' ? st.restH : null;
    if (rp && rp.since != null) f.rs = +(+rp.since).toFixed(1);
    if (ro && ro.since != null) f.ro = +(+ro.since).toFixed(1);
    if (side) f.sd = side;
  } catch (e) {}
  return f;
}
autoCands = (function (prev) { return function () { const C = prev.apply(this, arguments); C.forEach(c => { try { c.fx = zeFactors(c.m, c.k2); } catch (e) {} }); return C; }; })(autoCands);

/* ---------- 2) CLV de todas as apostas do piloto: odd de fecho da mesma casa, depois do jogo ---------- */
let ACLV_AT = 0, ACLV_RUN = false;
async function autoClvFill(force) {
  if (ACLV_RUN || /jsdom/i.test(navigator.userAgent || '') || window.__ZE_LAB || navigator.onLine === false) return 0;
  if (!force && Date.now() - ACLV_AT < 20 * 60e3) return 0;
  if (typeof espnCooling === 'function' && espnCooling()) return 0;
  const now = Date.now(), want = {};
  Object.keys(AUTO_W).forEach(w => autoLoad(w).bets.forEach(x => { if (x.cl === undefined && x.code && x.ev && x.ko < now - 2.5 * 3600e3 && x.ko > now - 12 * 864e5) want[x.ev] = x.code; }));
  const evs = Object.keys(want).slice(0, 5); if (!evs.length) return 0;
  ACLV_RUN = true; ACLV_AT = now; let n = 0;
  try {
    for (const ev of evs) {
      let books = null; try { books = await coreOdds(want[ev], ev, true); } catch (e) { continue; }
      const b = books && books[0];
      Object.keys(AUTO_W).forEach(w => {
        const a = autoLoad(w); let ch = false;
        a.bets.forEach(x => { if (x.ev !== ev || x.cl !== undefined) return; const c = !b ? null : x.od ? oddFromBook(b.odds, x.k, true) : (b.odds[x.k] > 1 ? +b.odds[x.k] : null); x.cl = c > 1 ? +c.toFixed(3) : null; ch = true; n++; });
        if (ch) autoSave(a);
      });
      if (typeof espnCooling === 'function' && espnCooling()) break;
      await new Promise(r => setTimeout(r, 500));
    }
  } finally { ACLV_RUN = false; }
  if (n) { try { if (currentView === 'stats') renderZeStats(); if (currentView === 'config') renderConfig(); } catch (e) {} }
  return n;
}
autoClv = (function (prev) { return function (x) { if (x.cl > 1 && x.o > 1) return x.o / x.cl - 1; return prev.apply(this, arguments); }; })(autoClv);
setTimeout(() => autoClvFill().catch(() => {}), 60000);
applyLive = (function (prev) { return function () { const r = prev.apply(this, arguments); setTimeout(() => autoClvFill().catch(() => {}), 35000); return r; }; })(applyLive);

/* ---------- 3) números com margem de erro + veredicto ---------- */
const AUTO_VERDICT_N = 100;
autoStats = (function (prev) {
  return function (a) {
    a = a || autoLoad();
    const s = prev.call(this, a);
    // o veredicto só conta apostas feitas com as regras atuais
    const cur = a.bets.filter(x => rulesOf(x) === ZE_RULES.ver), old = a.bets.length - cur.length;
    const dec = cur.filter(x => x.st === 'win' || x.st === 'loss'), w = dec.filter(x => x.st === 'win').length;
    const prom = dec.length ? dec.reduce((t, x) => t + x.p, 0) / dec.length : null, ci = wilson(w, dec.length);
    const clv = cur.map(autoClv).filter(v => v != null), clvAvg = clv.length ? clv.reduce((t, v) => t + v, 0) / clv.length : null;
    const staked = dec.reduce((t, x) => t + x.stake, 0), profit = dec.reduce((t, x) => t + (x.ret || 0) - x.stake, 0);
    let verdict;
    if (dec.length < 30) verdict = `⏳ ainda cedo (${dec.length}/${AUTO_VERDICT_N} apostas)`;
    else if (dec.length < AUTO_VERDICT_N) verdict = `⏳ a formar-se (${dec.length}/${AUTO_VERDICT_N})`;
    else if (prom > ci[1]) verdict = '❌ promete mais do que acerta';
    else if (prom < ci[0]) verdict = '✅ acerta mais do que promete';
    else verdict = '✅ cumpre o que promete';
    if (dec.length >= AUTO_VERDICT_N && clv.length >= 30) verdict += clvAvg > 0.005 ? ' · 📈 apanha odds melhores do que o fecho' : clvAvg < -0.005 ? ' · 📉 apanha odds piores do que o fecho' : ' · odds iguais ao fecho';
    return Object.assign(s, { cur: { n: dec.length, w, hit: dec.length ? w / dec.length : null, prom, ci, clv: clvAvg, clvN: clv.length, yield: staked ? profit / staked : null }, oldRules: old, verdict });
  };
})(autoStats);
autoTableHTML = function () {
  const pc = v => (v * 100).toFixed(1).replace('.', ',') + '%', sg = v => (v >= 0 ? '+' : '') + pc(v);
  const rows = Object.keys(AUTO_W).map(w => {
    const a = autoLoad(w), s = autoStats(a), c = s.cur;
    return `<div class="auto-card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;"><b>${AUTO_W[w].name}</b><span><b>${s.value.toFixed(2)} €</b> <b class="${s.roi >= 0 ? 'rx-pos' : 'rx-neg'}">${sg(s.roi)}</b></span></div>
      <div class="muted" style="font-size:.7rem;">${AUTO_W[w].desc} · até ${a.perDay}/dia${s.open ? ` · ${s.open} em jogo` : ''}</div>
      ${c.n ? `<div style="font-size:.8rem;margin-top:4px;">Certas <b>${c.w}/${c.n} · ${Math.round(c.hit * 100)}%</b> <span class="muted">(${ciTxt(c.w, c.n)}) · prometia ${Math.round(c.prom * 100)}%</span></div>
      <div style="font-size:.8rem;">Retorno <b class="${c.yield >= 0 ? 'rx-pos' : 'rx-neg'}">${sg(c.yield)}</b>${c.clv != null ? ` · CLV <b class="${c.clv >= 0 ? 'rx-pos' : 'rx-neg'}">${sg(c.clv)}</b> <span class="muted">(em ${c.clvN})</span>` : ' · <span class="muted">CLV: à espera das odds de fecho</span>'}</div>` : ''}
      <div style="font-size:.76rem;margin-top:3px;">${s.verdict}${s.oldRules ? ` <span class="muted">· ${s.oldRules} aposta${s.oldRules === 1 ? '' : 's'} de regras anteriores fora destas contas</span>` : ''}</div></div>`;
  }).join('');
  return `${rows}
    <div class="muted" style="font-size:.72rem;margin-top:6px;line-height:1.5;">📏 <b>Como ler:</b> «entre X% e Y%» é a margem de erro — com poucas apostas os números abanam muito, por isso o veredicto só sai com ${AUTO_VERDICT_N} apostas decididas. <b>CLV</b> = a odd que o Zé apanhou contra a odd final da casa antes do jogo: positivo quer dizer que apanhou melhor preço do que o fecho (o melhor sinal de vantagem real, mesmo numa semana má).</div>
    <details style="margin-top:6px;"><summary class="muted" style="font-size:.74rem;cursor:pointer;">📌 Regras congeladas desde ${new Date(ZE_RULES.since).toLocaleDateString('pt-PT')} (${ZE_RULES.ver}) — só mudam com teste</summary>${ZE_RULES.log.map(l => `<div class="muted" style="font-size:.72rem;margin-top:4px;line-height:1.5;"><b>${l.ver} · ${new Date(l.d).toLocaleDateString('pt-PT')}</b> — ${esc(l.txt)}</div>`).join('')}</details>`;
};

(function () { try { const css = document.createElement('style'); css.textContent = '.auto-card{padding:9px 10px;margin:6px 0;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09)}'; document.head.appendChild(css); } catch (e) {} })();

/* ---------- 5b) fim de época sem nada em jogo ----------
   Época 2025/26 (sem ver o futuro): nas últimas 6 jornadas, quando uma das equipas já não podia chegar ao 6.º lugar
   nem descer, as escolhas do Zé acertaram 55% (prometiam 71%) em 44 jogos. Poucos jogos → travão provisório. */
let DEAD_MEMO = null;
function zeStandingsRaw() {
  const v = (typeof LS_VER !== 'undefined' && LS_VER[LIVE_KEY]) || 0;
  if (DEAD_MEMO && DEAD_MEMO.v === v && Date.now() - DEAD_MEMO.t < 5 * 60e3) return DEAD_MEMO.s;
  let s = {}; try { const P = lsGet(LIVE_KEY, null); s = (P && P.standings) || {}; } catch (e) {}
  DEAD_MEMO = { v, t: Date.now(), s }; return s;
}
function zeDeadRubber(m) {
  try {
    if (!m || !m.espn || !m.espn.code || /uefa|fifa|taca|copa|cup|pokal|coupe|coppa/i.test(m.espn.code)) return null;
    const st = zeStandingsRaw()[m.espn.code], tb = st && (st.find(x => x.type === 'TOTAL') || st[0]), T = tb && tb.table; if (!T || T.length < 12) return null;
    const S = T.slice().sort((a, b) => b.points - a.points), n = S.length, R = 2 * (n - 1), p6 = S[5].points, pRel = S[n - 3].points;
    const one = id => { const me = S.find(r => String(r.team.id) === String(id)); if (!me) return false; const rem = R - me.playedGames; if (rem < 1 || rem > 6) return false; return me.points + 3 * rem < p6 && me.points - pRel > 3 * rem; };
    const h = one(m.espn.h), a = one(m.espn.a);
    return h || a ? { h, a } : null;
  } catch (e) { return null; }
}
zeSelo = (function (prev) {
  return function (m) {
    const r = prev.apply(this, arguments);
    try { if (r && zeDeadRubber(m)) { r.bad = (r.bad || []).concat('🏖️ fim de época: uma das equipas já não joga para nada (na época passada estes jogos falharam muito)'); r.grade = null; } } catch (e) {}
    return r;
  };
})(zeSelo);
autoCands = (function (prev) { return function () { return prev.apply(this, arguments).filter(c => !zeDeadRubber(c.m)); }; })(autoCands);
intlNote = (function (prev) {
  return function (m) {
    let h = prev.apply(this, arguments);
    try { const d = !m.past && zeDeadRubber(m); if (d) h += `<div class="muted" style="font-size:.72rem;margin-top:4px;">🏖️ Fim de época: ${d.h && d.a ? 'as duas equipas já não jogam' : (d.h ? esc(m.home) : esc(m.away)) + ' já não joga'} para nada — o piloto fica de fora e não há Selo de ouro.</div>`; } catch (e) {}
    return h;
  };
})(intlNote);

/* ---------- 5c) 🔬 laboratório de fatores: o que foi testado e o que deu ---------- */
const ZE_FACTOR_LAB = {
  when: '2026-11-09', base: '2 200 jogos de 2025/26 e 703 de 2026/27 (10 ligas), com as odds da altura e sem o Zé ver o futuro',
  rows: [
    ['✅', 'Selo de ouro', '2025/26 (época que o selo nunca tinha visto): 76% certas, prometia 72%. Retorno +0,1% com selo contra −3,7% sem selo (527 e 907 apostas). 2026/27: +1,8% contra −8,6%.', 'Confirma-se: o selo separa as melhores apostas.'],
    ['❌', '«Só valor positivo» (probabilidade × odd ≥ 1)', 'Só 12 apostas em 1 434; 58% certas quando prometia 77%.', 'Chumbou: quando o Zé discorda das casas, quem se engana é o Zé. Não entrou.'],
    ['❌', 'Aposta de «vitória» simples', 'Retorno −7% (casa) e −11% (fora).', 'Confirmado: continua fora do selo.'],
    ['➖', 'Dias de descanso (2+ dias a menos do que o adversário)', '70% contra 74% numa época, 82% na outra.', 'Sem efeito: as casas já contam com isso.'],
    ['➖', 'Europa a seguir / vem da Europa', '73% e 71% contra 74% sem Europa.', 'Sem efeito (confirma o teste das poupanças).'],
    ['➖', 'Dérbi', '75% contra 74% (só 20 jogos).', 'Sem efeito visível.'],
    ['➖', 'Fim de semana / meio da semana · casa / fora', '74% contra 74% · 73% contra 74%.', 'Sem efeito.'],
    ['➖', 'Liga «má»', 'A pior de 2025/26 (Premier League, 63%) está normal em 2026/27 (75%); as piores desta época estavam normais na passada.', 'É sobretudo sorte: não se foge de ligas, o travão automático chega.'],
    ['➖', 'Odd a subir 6%+ desde a abertura («a fugir»)', '76% numa época e 81% na outra (prometia 71%).', 'Não é sinal para fugir, ao contrário do que se esperava.'],
    ['⚠️', 'Fim de época sem nada em jogo', '55% certas quando prometia 71% (44 jogos).', 'Travão provisório: fora do selo e do piloto. Poucos jogos — rever em maio.'],
    ['🔎', 'Odd da equipa a cair 6%+ desde a abertura', 'Mercado inteiro (duplas hipóteses a ~1,33): 82% contra 72% das casas em 232 jogos (2025/26) e 81% contra 73% em 74 (2026/27). Nas escolhas do Zé: 87% numa época, 68% na outra.', 'Promissor mas não provado: corre na carteira 📉 «Odd a cair» até termos 100 apostas.']
  ]
};
function zeFactorLabHTML() {
  const L = ZE_FACTOR_LAB;
  // o que as apostas do piloto já mostram, por movimento da odd
  let live = '';
  try {
    const seen = {}, B = autoAllBets().filter(x => (x.st === 'win' || x.st === 'loss') && x.f && x.f.dr != null && !seen[x.ev + x.k] && (seen[x.ev + x.k] = 1));
    const bk = [['caiu 6%+', x => x.f.dr <= -0.06], ['mexeu pouco', x => Math.abs(x.f.dr) < 0.06], ['subiu 6%+', x => x.f.dr >= 0.06]];
    if (B.length >= 5) live = `<div class="rx-h">Ao vivo: apostas do piloto pelo movimento da odd</div>${bk.map(([lab, f]) => { const X = B.filter(f), w = X.filter(x => x.st === 'win').length; return `<div class="zst-row"><span>${lab}</span><span>${X.length ? `<b>${w}/${X.length}</b> <span class="muted">(${ciTxt(w, X.length)})</span>` : '—'}</span></div>`; }).join('')}`;
  } catch (e) {}
  return `<div class="panel" id="factorLab"><div class="panel-h"><span>🔬 Laboratório de fatores</span><span class="muted">${new Date(L.when).toLocaleDateString('pt-PT')}</span></div><div class="panel-b">
    <div class="hint" style="margin-bottom:8px;">A pergunta de cada teste: <b>quando este fator existe, o Zé e as casas falham mais do que prometem?</b> Se não, o fator não interessa, por boa que seja a história. Base: ${L.base}.</div>
    <details><summary style="cursor:pointer;font-size:.84rem;"><b>${L.rows.length} fatores testados</b> — ✅ ${L.rows.filter(r => r[0] === '✅').length} confirmado · 🔎 ${L.rows.filter(r => r[0] === '🔎').length} promissor · ⚠️ ${L.rows.filter(r => r[0] === '⚠️').length} provisório · ➖ ${L.rows.filter(r => r[0] === '➖').length} sem efeito · ❌ ${L.rows.filter(r => r[0] === '❌').length} chumbados</summary>
    ${L.rows.map(r => `<div style="margin-top:8px;font-size:.8rem;line-height:1.45;"><b>${r[0]} ${esc(r[1])}</b><br><span class="muted">${esc(r[2])}</span><br>${esc(r[3])}</div>`).join('')}</details>
    ${live}
  </div></div>`;
}
renderZeStats = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try { const box = document.getElementById('zeStatsBox'); if (box && !document.getElementById('factorLab')) box.insertAdjacentHTML('beforeend', zeFactorLabHTML()); } catch (e) {}
    return r;
  };
})(renderZeStats);
