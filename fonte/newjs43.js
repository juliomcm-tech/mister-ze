/* =====================================================================
   v52 · o teu lado do jogo (sem mexer no modelo do Zé)
   1) «Estás a bater as casas?» — a tua odd contra a odd final da Bet365 (CLV), aposta a aposta
   2) Raio-X das tuas apostas — onde ganhas e onde perdes (mercado, nº de seleções, odd, liga)
   3) Antes do apito — onzes e odds das tuas apostas abertas (avisa se a estrela fica no banco)
   4) Disciplina — limite semanal de perdas, stake sugerida, aviso de «recuperar»
   5) Cópia semanal automática para o teu Gist (se já tens o token posto)
   ===================================================================== */
const DISC_KEY = 'ze_disc_v1', KICK_KEY = 'ze_kick_alerts_v1';
const eur2 = v => (+v || 0).toFixed(2).replace('.', ',');
(function () {
  const css = `
.rx-t{width:100%;border-collapse:collapse;font-size:.8rem;margin-top:4px;}
.rx-t th,.rx-t td{padding:6px 4px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap;}
.rx-t th:first-child,.rx-t td:first-child{text-align:left;white-space:normal;}
.rx-pos{color:var(--green,#22c55e);font-weight:800}.rx-neg{color:var(--red,#ef4444);font-weight:800}
.rx-h{margin:12px 0 2px;font-size:.74rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;}
.clv-line{font-size:.76rem;margin-top:3px;}
.disc-bar{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);border-radius:12px;padding:10px 12px;margin:0 0 12px;font-size:.84rem;}
.stake-hint{font-size:.78rem;color:var(--muted);margin-top:6px;}
`;
  try { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); } catch (e) {}
})();

/* ---------- comum: «unidades» de uma aposta (cada seleção) ---------- */
function betUnits(bet) {
  if (Array.isArray(bet.legs) && bet.legs.length) return bet.legs.map(l => ({ obj: l, home: l.home, away: l.away, sel: l.sel || bet.pick, odd: Number(l.odd) || (bet.legs.length === 1 ? Number(bet.odd) : 0), sport: l.sport }));
  const l = legFromBet(bet);
  return l ? [{ obj: bet, home: l.home, away: l.away, sel: bet.pick, odd: Number(bet.odd) }] : [];
}
function enrichUnit(u) {
  if (u.sport === 'nba' || (u.obj.ev && u.obj.ko)) return;
  const m = findMatchForLeg({ home: u.home, away: u.away, sel: u.sel });
  if (!m) return;
  if (!u.obj.lg) u.obj.lg = m.league;
  if (m.espn && m.espn.ev) { u.obj.ev = String(m.espn.ev); u.obj.code = m.espn.code; }
  const k = kickOf(m); if (k) u.obj.ko = k.toISOString();
}
function matchByEv(ev) { return ev ? matches.find(m => m.espn && String(m.espn.ev) === String(ev)) : null; }
/** a chave de mercado das casas que corresponde à seleção (ex.: «Benfica ou empate» → «1X») */
function unitKey(u, m, book) {
  const c = selConds(u.sel, m); if (!c || !book) return null;
  const f = (i, j) => c.every(g => g(i, j));
  return Object.keys(book.odds).find(k => {
    const g = MARKET_CONDS[k]; if (!g) return false;
    for (let i = 0; i <= 7; i++) for (let j = 0; j <= 7; j++) if (!!g(i, j) !== !!f(i, j)) return false;
    return true;
  }) || null;
}

/* ---------- 1) CLV: a tua odd contra a odd final ---------- */
async function clvCapture(force) {
  const b = loadBank(), now = Date.now(), jobs = [];
  b.bets.filter(x => x.status === 'open').forEach(bet => betUnits(bet).forEach((u, i) => {
    try { enrichUnit(u); } catch (e) {}
    const ko = Date.parse(u.obj.ko || ''); if (!u.obj.ev || !(ko > now) || ko - now > 36 * 3600e3) return;
    if (!force && u.obj.cl && now - u.obj.cl.t < 25 * 60e3) return;
    jobs.push({ id: bet.id, i, u });
  }));
  if (!jobs.length) { saveBank(b); return 0; }
  const res = [];
  for (const j of jobs.slice(0, 12)) {
    try {
      const books = await coreOdds(j.u.obj.code, j.u.obj.ev, true); if (!books || !books.length) continue;
      const m = matchByEv(j.u.obj.ev) || findMatchForLeg(j.u); if (!m) continue;
      const k = unitKey(j.u, m, books[0]); if (!k) continue;
      const pf = marketP({ books: [books[0]] }, k), close = books[0].odds[k];
      if (!(close > 1) || pf == null) continue;
      res.push({ id: j.id, i: j.i, cl: { k, close, pf: +pf.toFixed(4), book: books[0].provider, t: Date.now() } });
    } catch (e) {}
  }
  const B = loadBank();
  // guardar o que já foi enriquecido + as odds finais
  b.bets.forEach(x => { const y = B.bets.find(z => z.id === x.id); if (!y) return; const ux = betUnits(x), uy = betUnits(y); ux.forEach((u, i) => { if (uy[i]) ['lg', 'ev', 'code', 'ko'].forEach(f => { if (u.obj[f] && !uy[i].obj[f]) uy[i].obj[f] = u.obj[f]; }); }); });
  res.forEach(r => { const bet = B.bets.find(x => x.id === r.id); const u = bet && betUnits(bet)[r.i]; if (u) u.obj.cl = r.cl; });
  saveBank(B);
  return res.length;
}
function betCLV(bet) {
  const U = betUnits(bet); if (!U.length || !U.every(u => u.obj.cl && u.obj.cl.pf)) return null;
  const P = U.reduce((s, u) => s * u.obj.cl.pf, 1), odd = Number(bet.odd);
  if (!(odd > 1)) return null;
  return { clv: P * odd - 1, close: U.length === 1 ? U[0].obj.cl.close : null, book: U[0].obj.cl.book };
}
betItemHTML = (function (prev) {
  return function (bet, who) {
    let h = prev(bet, who);
    try {
      if (who !== 'you') return h;
      const c = betCLV(bet); if (!c) return h;
      const v = Math.round(c.clv * 100);
      const txt = `${v >= 0 ? '📈' : '📉'} ${c.close ? `Odd final ${esc(c.book)} ${c.close.toFixed(2)} · ` : ''}apanhaste <b class="${v >= 0 ? 'rx-pos' : 'rx-neg'}">${v >= 0 ? '+' : ''}${v}%</b> ${v >= 0 ? 'acima' : 'abaixo'} do preço justo final`;
      h = h.replace(/(<div class="acts">)/, `<div class="clv-line">${txt}</div>$1`);
      if (!/clv-line/.test(h)) h = h.replace(/<\/div><\/div>$/, `<div class="clv-line">${txt}</div></div></div>`);
    } catch (e) {}
    return h;
  };
})(betItemHTML);

/* ---------- 2) Raio-X ---------- */
function mktCat(sel) {
  const s = normTxt(sel || '');
  if (/ambas|btts|both teams/.test(s)) return 'Ambas marcam';
  if (/marca|marcador|scorer|anytime|goalscorer/.test(s)) return 'Marcador';
  if (/(mais|menos) de|over|under|acima de|abaixo de|golos|goals/.test(s)) return 'Golos (mais/menos)';
  if (/\b1x\b|\bx2\b|\b12\b|ou empate|or draw|dupla/.test(s)) return 'Dupla hipótese';
  if (/handicap|[+-]\d[.,]5/.test(s)) return 'Handicap';
  if (/\b(empate|draw)\b|^x$/.test(s)) return 'Empate';
  return 'Vitória (1X2)';
}
function rxRows(list, keyFn, order) {
  const G = {};
  list.forEach(x => { const k = keyFn(x); const g = G[k] = G[k] || { k, n: 0, w: 0, st: 0, pr: 0 }; g.n++; g.st += x.stake; g.pr += x.profit; if (x.win) g.w++; });
  let rows = Object.values(G);
  rows = order ? rows.sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k)) : rows.sort((a, b) => b.n - a.n);
  return rows;
}
function raioX() {
  const b = loadBank();
  const closed = b.bets.filter(x => x.status === 'win' || x.status === 'loss').map(x => {
    const stake = Number(x.stake) || 0, odd = Number(x.odd) || 0, win = x.status === 'win';
    const U = betUnits(x), cats = [...new Set(U.map(u => mktCat(u.sel)))];
    const lgs = [...new Set(U.map(u => u.obj.lg || (() => { try { const m = findMatchForLeg(u); return m && m.league; } catch (e) { return null; } })()).filter(Boolean))];
    return { x, stake, odd, win, profit: win ? stake * (odd - 1) : -stake, nl: Math.max(1, U.length), cat: cats.length === 1 ? cats[0] : 'Mista', lg: lgs.length === 1 ? lgs[0] : lgs.length ? 'Várias ligas' : 'Liga desconhecida', clv: betCLV(x) };
  });
  const tot = closed.reduce((a, c) => ({ n: a.n + 1, st: a.st + c.stake, pr: a.pr + c.profit, w: a.w + (c.win ? 1 : 0) }), { n: 0, st: 0, pr: 0, w: 0 });
  const legsK = c => c.nl === 1 ? 'Simples' : c.nl === 2 ? 'Duplas' : c.nl <= 4 ? '3–4 seleções' : '5 ou mais';
  const oddK = c => c.odd < 1.5 ? 'abaixo de 1,50' : c.odd < 2 ? '1,50 – 1,99' : c.odd < 3 ? '2,00 – 2,99' : c.odd < 5 ? '3,00 – 4,99' : '5,00 ou mais';
  const allB = b.bets.filter(x => x.status !== 'cancel').map(betCLV).filter(Boolean);
  return {
    tot, closed,
    byLegs: rxRows(closed, legsK, ['Simples', 'Duplas', '3–4 seleções', '5 ou mais']),
    byOdd: rxRows(closed, oddK, ['abaixo de 1,50', '1,50 – 1,99', '2,00 – 2,99', '3,00 – 4,99', '5,00 ou mais']),
    byCat: rxRows(closed, c => c.cat), byLg: rxRows(closed, c => c.lg).slice(0, 6),
    clv: allB.length ? { n: allB.length, avg: allB.reduce((s, c) => s + c.clv, 0) / allB.length, pos: allB.filter(c => c.clv > 0).length } : null
  };
}
function rxTable(title, rows) {
  if (!rows.length) return '';
  const tr = rows.map(g => { const roi = g.st ? g.pr / g.st : 0; return `<tr><td>${esc(g.k)}</td><td>${g.n}</td><td>${Math.round(100 * g.w / g.n)}%</td><td class="${g.pr >= 0 ? 'rx-pos' : 'rx-neg'}">${g.pr >= 0 ? '+' : ''}${eur2(g.pr)} €</td><td class="${roi >= 0 ? 'rx-pos' : 'rx-neg'}">${roi >= 0 ? '+' : ''}${Math.round(roi * 100)}%</td></tr>`; }).join('');
  return `<div class="rx-h">${esc(title)}</div><div style="overflow-x:auto;"><table class="rx-t"><tr><th></th><th>apostas</th><th>acerto</th><th>lucro</th><th>retorno</th></tr>${tr}</table></div>`;
}
function raioXHTML(chat) {
  const R = raioX();
  if (R.tot.n < 3) return `<div class="muted">🩻 Raio-X: preciso de pelo menos 3 apostas tuas fechadas (tens ${R.tot.n}).</div>${R.clv ? clvSummary(R.clv) : ''}`;
  const roi = R.tot.st ? R.tot.pr / R.tot.st : 0;
  const all = [...R.byLegs, ...R.byOdd, ...R.byCat, ...R.byLg].filter(g => g.n >= 3);
  const best = all.slice().sort((a, b) => b.pr / b.st - a.pr / a.st)[0], worst = all.slice().sort((a, b) => a.pr / a.st - b.pr / b.st)[0];
  const lines = [];
  lines.push(`${R.tot.n} apostas fechadas · acerto ${Math.round(100 * R.tot.w / R.tot.n)}% · lucro <b class="${R.tot.pr >= 0 ? 'rx-pos' : 'rx-neg'}">${R.tot.pr >= 0 ? '+' : ''}${eur2(R.tot.pr)} €</b> (${roi >= 0 ? '+' : ''}${Math.round(roi * 100)}% do que apostaste)`);
  if (best && best.pr > 0) lines.push(`👍 Onde ganhas: <b>${esc(best.k)}</b> (${best.n} apostas, ${best.pr >= 0 ? '+' : ''}${eur2(best.pr)} €)`);
  if (worst && worst.pr < 0 && worst !== best) lines.push(`👎 Onde perdes: <b>${esc(worst.k)}</b> (${worst.n} apostas, ${eur2(worst.pr)} €)`);
  const tables = rxTable('Por nº de seleções', R.byLegs) + rxTable('Por odd', R.byOdd) + rxTable('Por mercado', R.byCat) + rxTable('Por liga', R.byLg);
  return `<div style="font-size:.86rem;line-height:1.55;">${lines.join('<br>')}</div>${R.clv ? clvSummary(R.clv) : ''}
    ${chat ? `<details style="margin-top:6px;"><summary>Ver as tabelas</summary>${tables}</details>` : tables}
    <div class="muted" style="font-size:.74rem;margin-top:6px;">Com poucas apostas os números mudam muito: olha para as tendências, não para cada linha.</div>`;
}
function clvSummary(c) {
  const v = Math.round(c.avg * 100);
  return `<div style="font-size:.86rem;margin-top:6px;">📈 <b>Estás a bater as casas?</b> Em ${c.n} aposta${c.n === 1 ? '' : 's'} com odd final: média <b class="${v >= 0 ? 'rx-pos' : 'rx-neg'}">${v >= 0 ? '+' : ''}${v}%</b> · ${c.pos} de ${c.n} acima do preço final. ${c.n < 20 ? '<span class="muted">(com 30–50 apostas já diz muito)</span>' : v > 0 ? 'Apanhas boas odds — é o melhor sinal de lucro a prazo.' : 'Estás a apostar abaixo do preço final: compara odds antes de apostar.'}</div>`;
}

/* ---------- 3) antes do apito ---------- */
function kickAlerts() { const o = lsGet(KICK_KEY, {}); const now = Date.now(); let ch = false; Object.keys(o).forEach(k => { if (now - o[k].t > 2 * 864e5) { delete o[k]; ch = true; } }); if (ch) lsSet(KICK_KEY, o); return o; }
function kickSave(key, a) { const o = kickAlerts(); if (o[key]) return false; o[key] = { ...a, t: Date.now() }; lsSet(KICK_KEY, o); return true; }
let KICK_BUSY = false;
async function preKickCheck() {
  if (KICK_BUSY || navigator.onLine === false) return 0;
  KICK_BUSY = true; let n = 0;
  try {
    const b = loadBank(), now = Date.now();
    const all = b.bets.filter(x => x.status === 'open').map(x => ['you', x]).concat(b.zeBets.filter(x => x.status === 'open').map(x => ['ze', x]));
    for (const [who, bet] of all) {
      const U = betUnits(bet);
      for (let i = 0; i < U.length; i++) {
        const u = U[i]; try { enrichUnit(u); } catch (e) {}
        const ko = Date.parse(u.obj.ko || ''); if (!u.obj.ev || !(ko - now < 80 * 60e3 && ko - now > -10 * 60e3)) continue;
        const m = matchByEv(u.obj.ev); if (!m || !m.espn) continue;
        const who1 = who === 'ze' ? 'O Zé apostou' : 'Apostaste';
        // onzes
        let board = null; try { board = await playerBoard(m); } catch (e) {}
        if (board && board.lineupKnown) {
          const all2 = (board.home || []).concat(board.away || []);
          const named = all2.find(p => p.name && nameMatch(p.name, u.sel) || (normTxt(u.sel).includes(normTxt(p.name).split(' ').pop()) && normTxt(p.name).split(' ').pop().length >= 5));
          if (named && /marca|scorer|anytime|goal/i.test(normTxt(u.sel)) && (named.status === 'suplente' || named.status === 'fora')) {
            if (kickSave(bet.id + '|' + i + '|player', { who, title: `⚠️ ${named.name} ${named.status === 'suplente' ? 'começa no banco' : 'não está na ficha'}`, body: `${who1} em «${u.sel}» (${m.home} vs ${m.away}). ${named.status === 'suplente' ? 'Conta com ~25 minutos em campo: a probabilidade cai muito.' : 'Sem jogar, a aposta morre (vê se a tua casa a anula).'}` })) n++;
          } else {
            const c = selConds(u.sel, m), side = c ? (c.every(f => f(2, 0)) && !c.every(f => f(0, 2)) ? 'home' : c.every(f => f(0, 2)) && !c.every(f => f(2, 0)) ? 'away' : null) : null;
            const stars = side ? (board[side] || []).filter(p => p.goals >= 3 && (p.status === 'suplente' || p.status === 'fora')) : [];
            if (stars.length && kickSave(bet.id + '|' + i + '|stars', { who, title: `🪑 ${stars.map(p => p.name).join(', ')} fora do onze`, body: `${who1} em «${u.sel}» (${m.home} vs ${m.away}). ${stars.map(p => `${p.name} (${p.goals} golos)`).join(', ')} não ${stars.length > 1 ? 'começam' : 'começa'} a jogar.` })) n++;
          }
        }
        // odds a mexer
        try {
          const books = await coreOdds(m.espn.code, m.espn.ev, true);
          const k = books && books[0] ? unitKey(u, m, books[0]) : null, now2 = k ? books[0].odds[k] : null;
          if (now2 > 1 && u.odd > 1) {
            if (now2 > u.odd * 1.12 && kickSave(bet.id + '|' + i + '|drift', { who, title: `📉 Odd a subir: ${u.sel}`, body: `${who1} a ${u.odd.toFixed(2)} e a ${esc(books[0].provider)} já paga ${now2.toFixed(2)} (${m.home} vs ${m.away}). O mercado está menos confiante — vê se há lesão ou poupança.` })) n++;
            if (now2 < u.odd * 0.9 && kickSave(bet.id + '|' + i + '|steam', { who, title: `📈 Boa odd: ${u.sel}`, body: `${who1} a ${u.odd.toFixed(2)} e agora paga só ${now2.toFixed(2)} (${m.home} vs ${m.away}). Apanhaste a odd antes de cair — bom sinal.` })) n++;
          }
        } catch (e) {}
      }
    }
    if (n) { toast(`⏰ ${n} aviso${n > 1 ? 's' : ''} antes do apito — vê a Caixa de entrada.`); try { renderInbox(); } catch (e) {} }
  } catch (e) { console.warn(e); } finally { KICK_BUSY = false; }
  return n;
}
buildInbox = (function (prev) {
  return function () {
    const msgs = prev.apply(this, arguments);
    try {
      const o = kickAlerts();
      Object.entries(o).filter(([, a]) => Date.now() - a.t < 18 * 3600e3).sort((x, y) => y[1].t - x[1].t).forEach(([k, a]) => {
        msgs.unshift({ id: 'kick|' + k, cat: 'tarefa', mood: 'pensativo', title: a.title, meta: `Antes do apito · ${new Date(a.t).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`, body: `<p>${esc(a.body)}</p>`, actions: [{ label: 'Ver apostas', js: "fmGo('banca');wlSetTab('apostas')" }] });
      });
    } catch (e) {}
    return msgs;
  };
})(buildInbox);
(function kickTimer() {
  if (/jsdom/i.test(navigator.userAgent || '') || window.__ZE_LAB) return;
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    try {
      const b = loadBank(), now = Date.now();
      const soon = b.bets.concat(b.zeBets).some(x => x.status === 'open' && betUnits(x).some(u => { const ko = Date.parse(u.obj.ko || ''); return ko - now < 80 * 60e3 && ko - now > -10 * 60e3; }));
      if (soon) preKickCheck();
    } catch (e) {}
  }, 5 * 60e3);
})();

/* ---------- 4) disciplina ---------- */
function discCfg() { return lsGet(DISC_KEY, { limit: null }); }
function weekStart() { const d = new Date(); d.setHours(0, 0, 0, 0); const wd = (d.getDay() + 6) % 7; return new Date(d.getTime() - wd * 864e5); }
function weekNet() {
  const b = loadBank(), t0 = weekStart().getTime();
  const closed = b.bets.filter(x => (x.status === 'win' || x.status === 'loss') && new Date(x.settledAt || x.at || 0).getTime() >= t0);
  const net = closed.reduce((s, x) => s + (x.status === 'win' ? Number(x.stake) * (Number(x.odd) - 1) : -Number(x.stake)), 0);
  const open = b.bets.filter(x => x.status === 'open').reduce((s, x) => s + Number(x.stake || 0), 0);
  return { net, open, n: closed.length };
}
function discCheck(stake) {
  const out = {}; const cfg = discCfg(), w = weekNet();
  if (cfg.limit > 0) {
    const worst = -w.net + w.open + stake;
    if (-w.net >= cfg.limit) { out.block = true; out.msg = `⛔ Já perdeste ${eur2((-w.net))} € esta semana (o teu limite é ${eur2(cfg.limit)} €). O Zé recomenda parar até segunda. Registar mesmo assim?`; }
    else if (worst > cfg.limit) { out.block = true; out.msg = `⚠️ Esta semana vais em ${w.net >= 0 ? '+' : ''}${eur2(w.net)} € e tens ${eur2(w.open)} € em jogo. Se tudo correr mal, ficas em −${eur2(worst)} € (limite ${eur2(cfg.limit)} €). Registar mesmo assim?`; }
  }
  try {
    const b = loadBank();
    const last = b.bets.filter(x => x.status === 'win' || x.status === 'loss').sort((x, y) => new Date(y.settledAt || y.at) - new Date(x.settledAt || x.at))[0];
    const st = b.bets.filter(x => x.status !== 'cancel').slice(0, 12).map(x => Number(x.stake) || 0).filter(v => v > 0).sort((a, c) => a - c);
    const med = st.length >= 4 ? st[Math.floor(st.length / 2)] : null;
    if (last && last.status === 'loss' && Date.now() - new Date(last.settledAt || last.at).getTime() < 3 * 3600e3 && med && stake >= med * 1.5) out.chase = `🧯 Perdeste há pouco e esta aposta (${eur2(stake)} €) é bem maior do que o costume (${eur2(med)} €). Cuidado com tentar recuperar.`;
  } catch (e) {}
  return out;
}
function stakeSuggest(odd) {
  const bank = loadBank().you; if (!(bank > 0)) return null;
  const pct = odd > 3 ? 0.01 : 0.02;
  return { v: Math.max(0.1, Math.round(bank * pct * 10) / 10), pct };
}
addBet = (function (prev) {
  return function (bet, who) {
    try {
      if (bet && who === 'you') {
        betUnits(bet).forEach(u => { try { enrichUnit(u); } catch (e) {} });
        const d = discCheck(Number(bet.stake) || 0);
        if (d.block && !confirm(d.msg)) return null;
        if (d.chase) setTimeout(() => toast(d.chase), 400);
      }
    } catch (e) {}
    const r = prev.apply(this, arguments);
    if (r && who === 'you' && navigator.onLine !== false && !window.__ZE_LAB && !/jsdom/i.test(navigator.userAgent || '')) setTimeout(() => clvCapture(true).then(n => { if (n) renderBanca(); }).catch(() => {}), 1500);
    return r;
  };
})(addBet);
function discSave() {
  const v = parseFloat(String((document.getElementById('discLimit') || {}).value || '').replace(',', '.'));
  lsSet(DISC_KEY, { limit: v > 0 ? v : null });
  toast(v > 0 ? `🧯 Limite semanal: ${eur2(v)} €.` : '🧯 Sem limite semanal.');
  try { renderConfig(); renderWallet(); } catch (e) {}
}
renderConfig = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const grid = document.querySelector('#view-config .cfg-grid'); if (!grid) return r;
      let p = document.getElementById('discPanel');
      if (!p) { p = document.createElement('div'); p.className = 'panel'; p.id = 'discPanel'; grid.insertBefore(p, grid.firstChild); }
      const cfg = discCfg(), w = weekNet();
      p.innerHTML = `<div class="panel-h"><span>🧯 Disciplina</span><span class="muted">só para ti</span></div><div class="panel-b">
        <label class="lbl" style="margin-bottom:8px;">Limite de perdas por semana (€)<input id="discLimit" class="inp" type="number" inputmode="decimal" min="0" step="1" placeholder="sem limite" value="${cfg.limit || ''}"></label>
        <div class="btn-row" style="margin-bottom:8px;"><button class="btn" onclick="discSave()">💾 Guardar</button></div>
        <div class="hint">Esta semana (desde segunda): <b class="${w.net >= 0 ? 'rx-pos' : 'rx-neg'}">${w.net >= 0 ? '+' : ''}${eur2(w.net)} €</b> em ${w.n} aposta${w.n === 1 ? '' : 's'} fechada${w.n === 1 ? '' : 's'}${w.open ? ` · ${eur2(w.open)} € em jogo` : ''}. Ao chegares ao limite, o Zé pede confirmação antes de registares mais. Avisa também quando parece que estás a tentar recuperar.</div></div>`;
    } catch (e) {}
    return r;
  };
})(renderConfig);

/* ---------- Finanças: raio-x, «estás a bater as casas», disciplina, stake sugerida ---------- */
renderWallet = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const pane = document.querySelector('#view-banca .wl-pane[data-t="resumo"]');
      if (pane) {
        let rx = document.getElementById('wlRaioX');
        if (!rx) { rx = document.createElement('div'); rx.className = 'panel'; rx.id = 'wlRaioX'; pane.appendChild(rx); }
        rx.innerHTML = `<div class="panel-h"><span>🩻 Raio-X das tuas apostas</span><span class="muted">onde ganhas e onde perdes</span></div><div class="panel-b">${raioXHTML(false)}</div>`;
        const cfg = discCfg(), w = weekNet();
        let bar = document.getElementById('discBar');
        const over = cfg.limit > 0 && -w.net >= cfg.limit * 0.8;
        if (over) { if (!bar) { bar = document.createElement('div'); bar.id = 'discBar'; bar.className = 'disc-bar'; pane.insertBefore(bar, pane.firstChild); } bar.innerHTML = `🧯 Esta semana vais em <b>${eur2(w.net)} €</b> — ${-w.net >= cfg.limit ? `<b>chegaste ao teu limite</b> (${eur2(cfg.limit)} €). O Zé recomenda parar até segunda.` : `perto do teu limite (${eur2(cfg.limit)} €).`}`; }
        else if (bar) bar.remove();
      }
      const odd = document.getElementById('betManualOdd'), stake = document.getElementById('betManualStake');
      if (odd && stake && !document.getElementById('stakeHint')) {
        stake.parentNode.insertAdjacentHTML('afterend', '<div id="stakeHint" class="stake-hint"></div>');
        const upd = () => { const s = stakeSuggest(parseFloat(String(odd.value).replace(',', '.')) || 0); const el = document.getElementById('stakeHint'); if (el) el.innerHTML = s ? `💡 Stake sugerida: <b>${eur2(s.v)} €</b> (${Math.round(s.pct * 100)}% da tua banca${s.pct < 0.02 ? ', odd alta' : ''}) <button class="btn btn-sm" type="button" onclick="document.getElementById('betManualStake').value='${s.v.toFixed(2)}'">usar</button>` : ''; };
        odd.addEventListener('input', upd); upd();
      }
    } catch (e) { console.warn(e); }
    return r;
  };
})(renderWallet);

/* ---------- chat: «raio-x», «onde perco», «estou a bater as casas?» ---------- */
zeTalk = (function (prev) {
  return function (raw, opts) {
    try {
      const q = normTxt(raw);
      if (/raio.?x|onde (e que )?(eu )?(ganho|perco)|as minhas apostas|minhas estatisticas|estou a bater as casas|bato as casas|\bclv\b/.test(q)) return { mood: 'pensativo', html: `<b>🩻 Raio-X das tuas apostas</b><br>${raioXHTML(true)}` };
      if (/limite|disciplina|estou a perder muito|parar de apostar/.test(q)) { const w = weekNet(), c = discCfg(); return { mood: 'pensativo', html: `🧯 Esta semana vais em <b>${w.net >= 0 ? '+' : ''}${eur2(w.net)} €</b>${w.open ? ` (+${eur2(w.open)} € em jogo)` : ''}. ${c.limit ? `O teu limite semanal é ${eur2(c.limit)} €.` : 'Não tens limite semanal — podes pôr um em <b>Definições → 🧯 Disciplina</b>.'}` }; }
    } catch (e) {}
    return prev.apply(this, arguments);
  };
})(zeTalk);

/* ---------- 5) cópia semanal automática para o Gist ---------- */
async function gistAutoBackup() {
  try {
    const s = lsGet(SYNC_KEY, {}); if (!s.token) return false;
    if (s.last && Date.now() - new Date(s.last).getTime() < 7 * 864e5) return false;
    const body = { description: 'Mister Zé backup', public: false, files: { 'mister-ze.json': { content: JSON.stringify(buildBackup()) } } };
    const g = s.gist ? await gh('/gists/' + s.gist, { method: 'PATCH', body: JSON.stringify(body) }) : await gh('/gists', { method: 'POST', body: JSON.stringify(body) });
    const s2 = lsGet(SYNC_KEY, {}); s2.gist = g.id; s2.last = new Date().toISOString(); lsSet(SYNC_KEY, s2);
    lsSet('ze_last_backup', Date.now());
    toast('☁️ Cópia semanal guardada no teu Gist.');
    return true;
  } catch (e) { return false; }
}
atualizarTudo = (function (prev) {
  return async function () {
    const r = await prev.apply(this, arguments);
    if (navigator.onLine !== false && !window.__ZE_LAB && !/jsdom/i.test(navigator.userAgent || '')) setTimeout(() => {
      clvCapture().then(n => { if (n) { try { renderBanca(); } catch (e) {} } }).catch(() => {})
        .then(() => preKickCheck()).catch(() => {})
        .then(() => gistAutoBackup()).catch(() => {});
    }, 6000);
    return r;
  };
})(atualizarTudo);
