/* =====================================================================
   v22 · CARTEIRAS — contabilidade das duas contas (Tu e Mister Zé)
   Razão (extrato) com saldo corrente, indicadores, evolução do
   património, resultados, resumo mensal, por origem, CSV e impressão.
   ===================================================================== */
const WL_SERIES = { you: '#4c95f0', ze: '#78a414' }; // validado (dark, CVD ok)
const WL_STATUS = { win: '#2fd27a', loss: '#ff4d6a', void: '#7d7299', open: '#ffc233' };
let wlTab = 'resumo', wlPeriod = 'epoca', wlAcc = 'you', wlType = 'tudo', wlQuery = '', wlChartMode = 'eur';

const SOURCE_LABEL = {
  'boletim': 'Boletim (print)', 'chat-ze': 'Desafio no chat', 'duelo-humano': 'Duelo', 'duelo-ze': 'Duelo',
  'manual': 'Registo manual', 'print-betclic': 'Boletim (print)', 'proposta-ze': 'Proposta do Zé', 'ze-shadow': 'Sombra do Zé'
};
function eur(n) { return (Number(n) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
function eurS(n) { const v = Number(n) || 0; return (v > 0.004 ? '+' : v < -0.004 ? '−' : '') + eur(Math.abs(v)); }
function pctS(x) { if (x == null || !isFinite(x)) return '—'; return (x > 0.0004 ? '+' : x < -0.0004 ? '−' : '') + Math.abs(x * 100).toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
function pctP(x) { return x == null || !isFinite(x) ? '—' : (x * 100).toLocaleString('pt-PT', { maximumFractionDigits: 1 }) + '%'; }
function dtFmt(t, withTime) {
  const d = new Date(t);
  if (isNaN(d)) return '—';
  const s = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  return withTime ? s + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : s;
}
function holderName(who) { return who === 'ze' ? 'Mister Zé' : pname(); }
function accNo(who, b) { return `${who === 'ze' ? 'ZE' : 'TU'}-${new Date(b.seasonStart).getFullYear()}-${String(b.season).padStart(3, '0')}`; }
function periodFrom() {
  if (wlPeriod === '7d') return Date.now() - 7 * 864e5;
  if (wlPeriod === '30d') return Date.now() - 30 * 864e5;
  return 0;
}
function betTime(x) { return new Date(x.at || 0).getTime(); }
function setTime(x) { return new Date(x.settledAt || x.at || 0).getTime(); }

/* ---------- Razão (lançamentos) ---------- */
function buildLedger(b, who) {
  const start = who === 'ze' ? b.startZe : b.startYou;
  const P = who === 'ze' ? 'Z' : 'T';
  const list = (who === 'ze' ? b.zeBets : b.bets).slice().sort((a, c) => betTime(a) - betTime(c));
  const ev = [{ t: new Date(b.seasonStart).getTime(), kind: 'abertura', credit: start, debit: 0, desc: `Capital inicial · época ${b.season}`, ord: 0 }];
  list.forEach(x => {
    const stake = Number(x.stake) || 0, odd = Number(x.odd) || 0;
    ev.push({ t: betTime(x), kind: 'aposta', debit: stake, credit: 0, bet: x, ord: 1, desc: `${x.match} · ${x.pick} @ ${odd.toFixed(2)}` });
    if (x.status === 'win') ev.push({ t: setTime(x), kind: 'premio', debit: 0, credit: r2(stake * odd), bet: x, ord: 2, desc: `Prémio · ${x.match}${x.finalScores ? ' (' + x.finalScores + ')' : ''}` });
    if (x.status === 'void' || (x.status === 'cancel' && x.cancelPrev === 'void')) ev.push({ t: setTime(x), kind: 'reembolso', debit: 0, credit: stake, bet: x, ord: 2, desc: `Reembolso (nula) · ${x.match}` });
    if (x.status === 'cancel') {
      if (x.cancelPrev === 'win') ev.push({ t: setTime(x), kind: 'premio', debit: 0, credit: r2(stake * odd), bet: x, ord: 2, desc: `Prémio · ${x.match}` });
      const back = r2(stake - (x.cancelPrev === 'win' ? r2(stake * odd) : x.cancelPrev === 'void' ? stake : 0));
      if (Math.abs(back) >= 0.005) ev.push({ t: new Date(x.cancelledAt || Date.now()).getTime(), kind: 'estorno', debit: back < 0 ? -back : 0, credit: back > 0 ? back : 0, bet: x, ord: 3, desc: `Estorno · registo anulado (não jogada) · ${x.match}` });
    }
  });
  ev.sort((a, c) => a.t - c.t || a.ord - c.ord);
  const seq = {};
  const code = { abertura: 'AB', aposta: 'AP', premio: 'PR', reembolso: 'RE', ajuste: 'AJ', estorno: 'ES' };
  let bal = 0;
  ev.forEach(e => {
    bal = r2(bal + e.credit - e.debit);
    e.bal = bal;
    seq[e.kind] = (seq[e.kind] || 0) + 1;
    e.doc = `${P}-${code[e.kind]}-${String(seq[e.kind]).padStart(4, '0')}`;
  });
  const stored = who === 'ze' ? b.ze : b.you;
  const diff = r2(stored - bal);
  if (Math.abs(diff) >= 0.01) {
    ev.push({ t: Date.now(), kind: 'ajuste', debit: diff < 0 ? -diff : 0, credit: diff > 0 ? diff : 0, desc: 'Ajuste de conciliação (dados de versões anteriores)', ord: 3, bal: r2(stored), doc: `${P}-AJ-0001` });
  }
  return { entries: ev, reconciled: Math.abs(diff) < 0.01, diff };
}

/* ---------- Curva de património (saldo + em jogo) ---------- */
function equityCurve(b, who) {
  const start = who === 'ze' ? b.startZe : b.startYou;
  const pts = [{ t: new Date(b.seasonStart).getTime(), v: start }];
  let v = start;
  (who === 'ze' ? b.zeBets : b.bets).filter(x => x.status === 'win' || x.status === 'loss')
    .sort((a, c) => setTime(a) - setTime(c))
    .forEach(x => { v = r2(v + (x.status === 'win' ? x.stake * x.odd - x.stake : -x.stake)); pts.push({ t: setTime(x), v, bet: x }); });
  pts.push({ t: Date.now(), v });
  return pts;
}
function maxDrawdown(pts) {
  let peak = -Infinity, dd = 0, ddAbs = 0;
  pts.forEach(p => { peak = Math.max(peak, p.v); if (peak > 0) { const d = (peak - p.v) / peak; if (d > dd) { dd = d; ddAbs = peak - p.v; } } });
  return { pct: dd, abs: ddAbs };
}

/* ---------- Indicadores ---------- */
function walletStats(b, who) {
  const from = periodFrom();
  const all = who === 'ze' ? b.zeBets : b.bets;
  const L = all.filter(x => betTime(x) >= from && x.status !== 'cancel');
  const start = who === 'ze' ? b.startZe : b.startYou;
  const cash = who === 'ze' ? b.ze : b.you;
  const open = all.filter(x => x.status === 'open');
  const exposure = open.reduce((s, x) => s + Number(x.stake), 0);
  const equity = r2(cash + exposure);
  const wins = L.filter(x => x.status === 'win'), losses = L.filter(x => x.status === 'loss'), voids = L.filter(x => x.status === 'void');
  const closed = wins.concat(losses);
  const staked = closed.reduce((s, x) => s + Number(x.stake), 0);
  const returns = wins.reduce((s, x) => s + x.stake * x.odd, 0);
  const profit = r2(returns - staked);
  const seq = closed.slice().sort((a, c) => setTime(a) - setTime(c)).map(x => x.status);
  let cur = 0, curK = null, bestW = 0, bestL = 0, run = 0, runK = null;
  seq.forEach(s => { if (s === runK) run++; else { runK = s; run = 1; } if (s === 'win') bestW = Math.max(bestW, run); else bestL = Math.max(bestL, run); });
  if (seq.length) { curK = seq[seq.length - 1]; cur = 0; for (let i = seq.length - 1; i >= 0 && seq[i] === curK; i--) cur++; }
  const evOf = x => typeof (who === 'ze' ? x.ev : x.zeEV) === 'number' ? (who === 'ze' ? x.ev : x.zeEV) : null;
  const withEV = closed.filter(x => evOf(x) != null);
  const expProfit = withEV.reduce((s, x) => s + x.stake * evOf(x), 0);
  const realOnEV = withEV.reduce((s, x) => s + (x.status === 'win' ? x.stake * x.odd - x.stake : -x.stake), 0);
  const allEV = L.filter(x => evOf(x) != null);
  const curve = equityCurve(b, who);
  const dd = maxDrawdown(curve.filter(p => p.t >= from || p === curve[0]));
  const legsN = x => Array.isArray(x.legs) && x.legs.length ? x.legs.length : (/m[uú]ltipla|dupla/i.test(x.match) ? 2 : 1);
  return {
    who, start, cash, exposure, equity, result: r2(equity - start), roiCap: start ? (equity - start) / start : 0,
    n: L.length, nOpen: L.filter(x => x.status === 'open').length, nWin: wins.length, nLoss: losses.length, nVoid: voids.length,
    staked: r2(staked), returns: r2(returns), profit, yield: staked ? profit / staked : null,
    hit: closed.length ? wins.length / closed.length : null, miss: closed.length ? losses.length / closed.length : null,
    avgOdd: L.length ? L.reduce((s, x) => s + Number(x.odd), 0) / L.length : null,
    avgOddWin: wins.length ? wins.reduce((s, x) => s + Number(x.odd), 0) / wins.length : null,
    avgStake: L.length ? L.reduce((s, x) => s + Number(x.stake), 0) / L.length : null,
    bestWin: wins.length ? Math.max(...wins.map(x => x.stake * x.odd - x.stake)) : null,
    worstLoss: losses.length ? Math.max(...losses.map(x => Number(x.stake))) : null,
    streak: curK ? { k: curK, n: cur } : null, bestW, bestL,
    dd, expProfit: withEV.length ? r2(expProfit) : null, luck: withEV.length ? r2(realOnEV - expProfit) : null,
    avgEV: allEV.length ? allEV.reduce((s, x) => s + evOf(x), 0) / allEV.length : null,
    multis: L.filter(x => legsN(x) >= 2).length, singles: L.filter(x => legsN(x) < 2).length,
    passes: who === 'ze' ? b.zePasses || 0 : null, curve
  };
}

/* ---------- Cartões das contas ---------- */
function walletCard(b, s, lead) {
  const who = s.who;
  const face = who === 'ze' ? zeFace(zeMood(b), 40) : humanFace(40);
  const up = s.result >= 0;
  const spark = sparkSVG(s.curve, who);
  return `<article class="wcard ${who}${lead ? ' lead' : ''}" aria-label="Conta de ${esc(holderName(who))}">
    ${lead ? '<div class="wlead">Líder (ROI)</div>' : ''}
    <header class="wc-top">
      ${face}
      <div class="wc-id"><div class="wc-name">${esc(holderName(who))}</div><div class="wc-acc">Conta virtual · ${accNo(who, b)}</div></div>
      <svg class="wc-chip" width="34" height="26" viewBox="0 0 34 26" aria-hidden="true"><rect x=".5" y=".5" width="33" height="25" rx="5" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><path d="M0 9h10M0 17h10M24 9h10M24 17h10M10 0v26M24 0v26M10 13h14" stroke="rgba(255,255,255,.35)"/></svg>
    </header>
    <div class="wc-lbl">Saldo disponível</div>
    <div class="wc-bal num">${eur(s.cash)}</div>
    <div class="wc-spark">${spark}</div>
    <dl class="wc-grid">
      <div><dt>Em jogo</dt><dd class="num">${eur(s.exposure)}</dd></div>
      <div><dt>Património</dt><dd class="num">${eur(s.equity)}</dd></div>
      <div><dt>Resultado</dt><dd class="num ${up ? 'pos' : 'neg'}">${up ? '▲' : '▼'} ${eurS(s.result)}</dd></div>
      <div><dt>ROI</dt><dd class="num ${up ? 'pos' : 'neg'}">${pctS(s.roiCap)}</dd></div>
    </dl>
    <footer class="wc-foot"><span>Capital inicial ${eur(s.start)}</span><span>${s.n} apostas · ${s.nOpen} abertas</span></footer>
  </article>`;
}
function sparkSVG(pts, who) {
  if (!pts || pts.length < 2) return '';
  const W = 260, H = 34;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
  const vs = pts.map(p => p.v), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const X = t => ((t - t0) / ((t1 - t0) || 1)) * (W - 4) + 2, Y = v => H - 3 - ((v - lo) / span) * (H - 6);
  let d = `M${X(pts[0].t).toFixed(1)},${Y(pts[0].v).toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += `H${X(pts[i].t).toFixed(1)}V${Y(pts[i].v).toFixed(1)}`;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="${H}" aria-hidden="true"><path d="${d}" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
}

/* ---------- Tabela comparativa ---------- */
function compareTable(a, z) {
  const better = (va, vz, hiGood) => {
    if (va == null || vz == null || !isFinite(va) || !isFinite(vz) || Math.abs(va - vz) < 1e-9) return '<span class="muted">—</span>';
    const youBetter = hiGood ? va > vz : va < vz;
    return youBetter ? `<span class="adv you">▲ ${esc(holderName('you'))}</span>` : '<span class="adv ze">▲ Zé</span>';
  };
  const row = (label, fa, fz, va, vz, hiGood, hint) => `<tr><th scope="row">${label}${hint ? `<span class="hint-i" title="${esc(hint)}">ⓘ</span>` : ''}</th><td class="num">${fa}</td><td class="num">${fz}</td><td>${hiGood == null ? '' : better(va, vz, hiGood)}</td></tr>`;
  const sec = t => `<tr class="sec"><th colspan="4">${t}</th></tr>`;
  const n2 = x => x == null ? '—' : Number(x).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const st = s => s.streak ? `${s.streak.n} ${s.streak.k === 'win' ? 'V' : 'D'}` : '—';
  return `<table class="ltable cmp">
    <thead><tr><th scope="col">Indicador</th><th scope="col" class="num">${esc(holderName('you'))}</th><th scope="col" class="num">Mister Zé</th><th scope="col">Vantagem</th></tr></thead>
    <tbody>
      ${sec('Posição')}
      ${row('Capital inicial', eur(a.start), eur(z.start), null, null, null)}
      ${row('Saldo disponível', eur(a.cash), eur(z.cash), null, null, null)}
      ${row('Em jogo (exposição)', eur(a.exposure), eur(z.exposure), null, null, null)}
      ${row('Património', eur(a.equity), eur(z.equity), null, null, null)}
      ${row('Resultado acumulado', eurS(a.result), eurS(z.result), a.result, z.result, true)}
      ${row('Rentabilidade (ROI)', pctS(a.roiCap), pctS(z.roiCap), a.roiCap, z.roiCap, true, 'Resultado ÷ capital inicial — é o critério do duelo, justo com bancas diferentes')}
      ${sec('Atividade')}
      ${row('Apostas', a.n, z.n, null, null, null)}
      ${row('Ganhas · perdidas · nulas', `${a.nWin} · ${a.nLoss} · ${a.nVoid}`, `${z.nWin} · ${z.nLoss} · ${z.nVoid}`, null, null, null)}
      ${row('Abertas', a.nOpen, z.nOpen, null, null, null)}
      ${row('Simples · múltiplas', `${a.singles} · ${a.multis}`, `${z.singles} · ${z.multis}`, null, null, null)}
      ${row('Volume apostado (liquidado)', eur(a.staked), eur(z.staked), null, null, null)}
      ${row('Retorno recebido', eur(a.returns), eur(z.returns), null, null, null)}
      ${sec('Desempenho')}
      ${row('Taxa de acerto', pctP(a.hit), pctP(z.hit), a.hit, z.hit, true)}
      ${row('Taxa de falha', pctP(a.miss), pctP(z.miss), a.miss, z.miss, false)}
      ${row('Yield (lucro ÷ volume)', pctS(a.yield), pctS(z.yield), a.yield, z.yield, true, 'Quanto ganhas por cada euro apostado')}
      ${row('Odd média', n2(a.avgOdd), n2(z.avgOdd), null, null, null)}
      ${row('Odd média das ganhas', n2(a.avgOddWin), n2(z.avgOddWin), null, null, null)}
      ${row('Stake média', a.avgStake == null ? '—' : eur(a.avgStake), z.avgStake == null ? '—' : eur(z.avgStake), null, null, null)}
      ${row('Maior lucro numa aposta', a.bestWin == null ? '—' : eurS(a.bestWin), z.bestWin == null ? '—' : eurS(z.bestWin), a.bestWin, z.bestWin, true)}
      ${row('Maior perda numa aposta', a.worstLoss == null ? '—' : eurS(-a.worstLoss), z.worstLoss == null ? '—' : eurS(-z.worstLoss), a.worstLoss, z.worstLoss, false)}
      ${sec('Risco')}
      ${row('Queda máxima (drawdown)', `${pctP(a.dd.pct)} <span class="muted">(${eur(a.dd.abs)})</span>`, `${pctP(z.dd.pct)} <span class="muted">(${eur(z.dd.abs)})</span>`, a.dd.pct, z.dd.pct, false, 'Maior descida desde um máximo do património')}
      ${row('Sequência atual', st(a), st(z), null, null, null)}
      ${row('Melhor série de vitórias', a.bestW, z.bestW, a.bestW, z.bestW, true)}
      ${row('Pior série de derrotas', a.bestL, z.bestL, a.bestL, z.bestL, false)}
      ${sec('Qualidade das decisões')}
      ${row('Valor esperado médio', pctS(a.avgEV), pctS(z.avgEV), a.avgEV, z.avgEV, true, 'Pelas contas do Zé: positivo = a odd pagava mais do que valia')}
      ${row('Lucro esperado', a.expProfit == null ? '—' : eurS(a.expProfit), z.expProfit == null ? '—' : eurS(z.expProfit), null, null, null)}
      ${row('Sorte (real − esperado)', a.luck == null ? '—' : eurS(a.luck), z.luck == null ? '—' : eurS(z.luck), null, null, null, 'Positivo: ganhaste mais do que as probabilidades davam. Tende para zero com o tempo.')}
      ${row('Apostas recusadas por falta de valor', '—', z.passes, null, null, null)}
    </tbody></table>`;
}

/* ---------- Gráfico: evolução do património ---------- */
function equityChart(b) {
  const a = equityCurve(b, 'you'), z = equityCurve(b, 'ze');
  const from = periodFrom();
  const clip = pts => { if (!from) return pts; const before = pts.filter(p => p.t < from).pop(); const inside = pts.filter(p => p.t >= from); return (before ? [{ t: from, v: before.v }] : []).concat(inside); };
  const A = clip(a), Z = clip(z);
  const norm = (pts, start) => wlChartMode === 'pct' ? pts.map(p => ({ ...p, v: start ? (p.v / start - 1) * 100 : 0 })) : pts;
  const SA = norm(A, b.startYou), SZ = norm(Z, b.startZe);
  window._wlChart = { SA, SZ };
  const box = document.getElementById('wlChart');
  if (!box) return;
  const W = Math.max(300, box.clientWidth || 640), H = 240, m = { l: 58, r: 92, t: 14, b: 30 };
  const all = SA.concat(SZ);
  const t0 = Math.min(...all.map(p => p.t)), t1 = Math.max(...all.map(p => p.t), t0 + 3600e3);
  let lo = Math.min(...all.map(p => p.v)), hi = Math.max(...all.map(p => p.v));
  if (wlChartMode === 'pct') { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
  { // escala «redonda» (passos 1-2-2,5-5 × 10^n), como num relatório
    const raw = (hi - lo) / 4, p10 = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p10;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p10;
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  }
  const X = t => m.l + ((t - t0) / (t1 - t0)) * (W - m.l - m.r), Y = v => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
  const yt = [];
  { const raw = (hi - lo) / 4, p10 = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p10; const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p10; for (let v = lo; v <= hi + step / 2; v += step) yt.push(+v.toFixed(6)); }
  const fmtV = v => wlChartMode === 'pct' ? (v > 0.05 ? '+' : '') + v.toLocaleString('pt-PT', { maximumFractionDigits: 1 }) + '%' : v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const path = pts => { let d = `M${X(pts[0].t).toFixed(1)},${Y(pts[0].v).toFixed(1)}`; for (let i = 1; i < pts.length; i++) d += `H${X(pts[i].t).toFixed(1)}V${Y(pts[i].v).toFixed(1)}`; return d; };
  const xt = []; const nX = Math.min(5, Math.max(2, Math.floor((W - m.l - m.r) / 110)));
  for (let i = 0; i <= nX; i++) xt.push(t0 + (t1 - t0) * i / nX);
  const shortRange = (t1 - t0) < 2 * 864e5;
  const xLab = t => { const d = new Date(t); return shortRange ? String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : dtFmt(t).slice(0, 5); };
  const seenX = new Set();
  const xtU = xt.filter(t => { const l = xLab(t); if (seenX.has(l)) return false; seenX.add(l); return true; });
  const lastA = SA[SA.length - 1], lastZ = SZ[SZ.length - 1];
  // rótulos finais: 2 linhas cada (nome + valor) → afastar pelo menos 34px e manter dentro do gráfico
  let ya = Y(lastA.v), yz = Y(lastZ.v);
  const GAP = 34;
  if (Math.abs(ya - yz) < GAP) {
    const mid = (ya + yz) / 2, youTop = lastA.v >= lastZ.v;
    ya = youTop ? mid - GAP / 2 : mid + GAP / 2;
    yz = youTop ? mid + GAP / 2 : mid - GAP / 2;
  }
  const clampY = v => Math.min(H - m.b - 16, Math.max(m.t + 4, v));
  if (ya < yz) { ya = clampY(ya); yz = Math.max(clampY(yz), ya + GAP); } else { yz = clampY(yz); ya = Math.max(clampY(ya), yz + GAP); }
  ya = Math.min(ya, H - m.b + 2); yz = Math.min(yz, H - m.b + 2);
  const base = wlChartMode === 'pct' ? `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--muted2)" stroke-dasharray="3 4"/>` : '';
  const dot = (pts, c) => pts.slice(1, -1).filter(p => p.bet).map(p => `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3.5" fill="${p.bet.status === 'win' ? c : 'var(--card)'}" stroke="${c}" stroke-width="1.6"/>`).join('');
  box.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução do património das duas contas">
    <g font-size="11" fill="var(--muted)">
      ${yt.map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--border)"/><text x="${m.l - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" class="num">${fmtV(v)}</text>`).join('')}
      ${xtU.map(t => `<text x="${X(t).toFixed(1)}" y="${H - 8}" text-anchor="middle">${xLab(t)}</text>`).join('')}
    </g>
    ${base}
    <path d="${path(SA)}" fill="none" stroke="${WL_SERIES.you}" stroke-width="2" stroke-linejoin="round"/>
    <path d="${path(SZ)}" fill="none" stroke="${WL_SERIES.ze}" stroke-width="2" stroke-linejoin="round"${path(SZ) === path(SA) ? ' stroke-dasharray="7 6"' : ''}/>
    ${dot(SA, WL_SERIES.you)}${dot(SZ, WL_SERIES.ze)}
    <circle cx="${X(lastA.t)}" cy="${Y(lastA.v)}" r="4.5" fill="${WL_SERIES.you}" stroke="var(--card)" stroke-width="2"/>
    <circle cx="${X(lastZ.t)}" cy="${Y(lastZ.v)}" r="4.5" fill="${WL_SERIES.ze}" stroke="var(--card)" stroke-width="2"/>
    <g font-size="11.5" font-weight="700" fill="var(--text)">
      <text x="${W - m.r + 10}" y="${(ya + 4).toFixed(1)}">${esc(holderName('you').slice(0, 11))}</text><text x="${W - m.r + 10}" y="${(ya + 17).toFixed(1)}" font-weight="500" fill="var(--muted)" class="num">${fmtV(lastA.v)}</text>
      <text x="${W - m.r + 10}" y="${(yz + 4).toFixed(1)}">Zé</text><text x="${W - m.r + 10}" y="${(yz + 17).toFixed(1)}" font-weight="500" fill="var(--muted)" class="num">${fmtV(lastZ.v)}</text>
    </g>
    <line id="wlX" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" stroke="var(--muted)" stroke-width="1" opacity="0"/>
    <rect id="wlHit" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent" tabindex="0" aria-label="Explorar valores"/>
  </svg><div id="wlTip" class="wtip" role="status" aria-live="polite"></div>`;
  const hit = document.getElementById('wlHit'), xl = document.getElementById('wlX'), tip = document.getElementById('wlTip');
  const at = (pts, t) => { let v = pts[0].v; for (const p of pts) { if (p.t <= t) v = p.v; else break; } return v; };
  const times = [...new Set(SA.concat(SZ).map(p => p.t))].sort((x, y) => x - y);
  const show = t => {
    const x = X(t);
    xl.setAttribute('x1', x); xl.setAttribute('x2', x); xl.setAttribute('opacity', '.6');
    tip.innerHTML = '';
    const h = document.createElement('div'); h.className = 'wtip-h'; h.textContent = dtFmt(t, true); tip.appendChild(h);
    [[holderName('you'), at(SA, t), WL_SERIES.you], ['Mister Zé', at(SZ, t), WL_SERIES.ze]].forEach(([n, v, c]) => {
      const r = document.createElement('div'); r.className = 'wtip-r';
      const k = document.createElement('i'); k.style.background = c;
      const val = document.createElement('b'); val.textContent = fmtV(v); val.className = 'num';
      const lab = document.createElement('span'); lab.textContent = n;
      r.append(k, val, lab); tip.appendChild(r);
    });
    tip.style.opacity = '1';
    const left = Math.min(Math.max(x + 12, 0), W - 170);
    tip.style.left = left + 'px'; tip.style.top = (m.t + 6) + 'px';
  };
  const move = e => {
    const r = hit.getBoundingClientRect();
    const t = t0 + ((e.clientX - r.left) / r.width) * (t1 - t0);
    const near = times.reduce((p, c) => Math.abs(c - t) < Math.abs(p - t) ? c : p, times[0]);
    show(near);
  };
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', () => { xl.setAttribute('opacity', '0'); tip.style.opacity = '0'; });
  let ki = times.length - 1;
  hit.addEventListener('focus', () => show(times[ki]));
  hit.addEventListener('blur', () => { xl.setAttribute('opacity', '0'); tip.style.opacity = '0'; });
  hit.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { ki = Math.max(0, ki - 1); show(times[ki]); e.preventDefault(); } if (e.key === 'ArrowRight') { ki = Math.min(times.length - 1, ki + 1); show(times[ki]); e.preventDefault(); } });
  const tbl = document.getElementById('wlChartTable');
  if (tbl) tbl.innerHTML = `<table class="ltable"><thead><tr><th>Data</th><th class="num">${esc(holderName('you'))}</th><th class="num">Mister Zé</th></tr></thead><tbody>${times.map(t => `<tr><td>${dtFmt(t, true)}</td><td class="num">${fmtV(at(SA, t))}</td><td class="num">${fmtV(at(SZ, t))}</td></tr>`).join('')}</tbody></table>`;
}

/* ---------- Resultados (barra 100%) ---------- */
function outcomeBar(s) {
  const parts = [['win', s.nWin, '✅ Ganhas'], ['loss', s.nLoss, '❌ Perdidas'], ['void', s.nVoid, '↩️ Nulas'], ['open', s.nOpen, '⏳ Abertas']].filter(p => p[1] > 0);
  const tot = parts.reduce((x, p) => x + p[1], 0);
  if (!tot) return `<div class="obar-row"><div class="obar-name">${esc(holderName(s.who))}</div><div class="obar empty">Sem apostas no período</div></div>`;
  return `<div class="obar-row"><div class="obar-name">${esc(holderName(s.who))}</div><div class="obar">${parts.map(([k, n, l]) => {
    const w = n / tot * 100;
    return `<span class="oseg" style="flex:${n} 0 0;background:${WL_STATUS[k]}" title="${l}: ${n} (${w.toFixed(0)}%)" tabindex="0" aria-label="${l}: ${n}">${w >= 12 ? n : ''}</span>`;
  }).join('')}</div><div class="obar-pct num">${pctP(s.hit)} acerto</div></div>`;
}

/* ---------- Resumo mensal e por origem ---------- */
function monthly(b) {
  const rows = [];
  [['you', b.bets], ['ze', b.zeBets]].forEach(([who, L]) => {
    const g = {};
    L.filter(x => x.status === 'win' || x.status === 'loss' || x.status === 'void').forEach(x => {
      const d = new Date(setTime(x)); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const r = g[k] = g[k] || { k, who, n: 0, w: 0, l: 0, staked: 0, ret: 0 };
      r.n++; if (x.status === 'win') { r.w++; r.ret += x.stake * x.odd; r.staked += Number(x.stake); }
      if (x.status === 'loss') { r.l++; r.staked += Number(x.stake); }
    });
    Object.values(g).forEach(r => rows.push(r));
  });
  rows.sort((a, c) => c.k.localeCompare(a.k) || (a.who === 'you' ? -1 : 1));
  if (!rows.length) return '<div class="empty">Ainda não há apostas liquidadas.</div>';
  const mName = k => { const [y, mm] = k.split('-'); return MO[+mm - 1] + ' ' + y; };
  return `<table class="ltable"><thead><tr><th>Mês</th><th>Conta</th><th class="num">Apostas</th><th class="num">Volume</th><th class="num">Retorno</th><th class="num">Resultado</th><th class="num">Yield</th><th class="num">Acerto</th></tr></thead><tbody>${rows.map(r => {
    const p = r.ret - r.staked;
    return `<tr><td>${mName(r.k)}</td><td><i class="key" style="background:${WL_SERIES[r.who]}"></i>${esc(holderName(r.who))}</td><td class="num">${r.n}</td><td class="num">${eur(r.staked)}</td><td class="num">${eur(r.ret)}</td><td class="num ${p >= 0 ? 'pos' : 'neg'}">${eurS(p)}</td><td class="num">${r.staked ? pctS(p / r.staked) : '—'}</td><td class="num">${r.w + r.l ? pctP(r.w / (r.w + r.l)) : '—'}</td></tr>`;
  }).join('')}</tbody></table>`;
}
function bySource(b) {
  const g = {};
  [['you', b.bets], ['ze', b.zeBets]].forEach(([who, L]) => L.filter(x => x.status !== 'cancel').forEach(x => {
    const k = who + '|' + (SOURCE_LABEL[x.source] || 'Outro');
    const r = g[k] = g[k] || { who, src: SOURCE_LABEL[x.source] || 'Outro', n: 0, w: 0, l: 0, staked: 0, ret: 0 };
    r.n++;
    if (x.status === 'win') { r.w++; r.staked += Number(x.stake); r.ret += x.stake * x.odd; }
    if (x.status === 'loss') { r.l++; r.staked += Number(x.stake); }
  }));
  const rows = Object.values(g).sort((a, c) => (a.who === c.who ? c.n - a.n : a.who === 'you' ? -1 : 1));
  if (!rows.length) return '<div class="empty">Sem apostas.</div>';
  return `<table class="ltable"><thead><tr><th>Conta</th><th>Origem</th><th class="num">Apostas</th><th class="num">Acerto</th><th class="num">Resultado</th><th class="num">Yield</th></tr></thead><tbody>${rows.map(r => {
    const p = r.ret - r.staked;
    return `<tr><td><i class="key" style="background:${WL_SERIES[r.who]}"></i>${esc(holderName(r.who))}</td><td>${esc(r.src)}</td><td class="num">${r.n}</td><td class="num">${r.w + r.l ? pctP(r.w / (r.w + r.l)) : '—'}</td><td class="num ${p >= 0 ? 'pos' : 'neg'}">${r.w + r.l ? eurS(p) : '—'}</td><td class="num">${r.staked ? pctS(p / r.staked) : '—'}</td></tr>`;
  }).join('')}</tbody></table>`;
}

/* ---------- Extrato ---------- */
const KIND_LABEL = { abertura: 'Abertura', aposta: 'Aposta', premio: 'Prémio', reembolso: 'Reembolso', ajuste: 'Ajuste', estorno: 'Estorno' };
const STATUS_PILL = { open: ['Aberta', 'open'], win: ['Ganha', 'win'], loss: ['Perdida', 'loss'], void: ['Nula', 'void'], cancel: ['Anulada', 'void'] };
/** estado de cada linha do extrato: a aposta mostra como acabou; o prémio, o reembolso e o estorno também */
function extratoPill(e) {
  if (!e || !e.bet) return null;
  if (e.kind === 'premio') return STATUS_PILL.win;
  if (e.kind === 'reembolso') return STATUS_PILL.void;
  if (e.kind === 'estorno') return STATUS_PILL.cancel;
  return STATUS_PILL[e.bet.status] || ['Por conferir', 'open'];
}
function extratoRows(b) {
  const led = buildLedger(b, wlAcc);
  const from = periodFrom();
  const q = normTxt(wlQuery);
  let rows = led.entries;
  const opening = from ? (rows.filter(e => e.t < from).pop() || { bal: 0 }).bal : 0;
  rows = rows.filter(e => e.t >= from || e.kind === 'abertura' && !from);
  if (wlType !== 'tudo') rows = rows.filter(e => (wlType === 'apostas' ? e.kind === 'aposta' : wlType === 'premios' ? e.kind === 'premio' : e.kind === 'reembolso' || e.kind === 'ajuste' || e.kind === 'estorno'));
  if (q) rows = rows.filter(e => normTxt(e.desc + ' ' + e.doc).includes(q));
  return { led, rows, opening };
}
function renderExtrato() {
  const box = document.getElementById('wlExtratoBody');
  if (!box) return;
  const b = loadBank();
  const { led, rows, opening } = extratoRows(b);
  const deb = rows.reduce((s, e) => s + e.debit, 0), cred = rows.reduce((s, e) => s + e.credit, 0);
  const finalBal = led.entries.length ? led.entries[led.entries.length - 1].bal : 0;
  const per = wlPeriod === 'epoca' ? `Época ${b.season} (desde ${dtFmt(b.seasonStart)})` : wlPeriod === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias';
  setHTML('wlExtratoHead', `
    <div class="stmt-holder">${wlAcc === 'ze' ? zeFace('neutro', 44) : humanFace(44)}<div><div class="stmt-name">${esc(holderName(wlAcc))}</div><div class="muted">Conta virtual ${accNo(wlAcc, b)} · ${per}</div></div>
      <span class="recon ${led.reconciled ? 'ok' : 'warn'}">${led.reconciled ? '✔ Conciliado' : '⚠ Ajuste de ' + eurS(led.diff)}</span></div>
    <dl class="stmt-sum">
      <div><dt>Saldo inicial</dt><dd class="num">${eur(wlPeriod === 'epoca' ? 0 : opening)}</dd></div>
      <div><dt>Créditos</dt><dd class="num pos">${eur(cred)}</dd></div>
      <div><dt>Débitos</dt><dd class="num neg">${eur(deb)}</dd></div>
      <div><dt>Saldo final</dt><dd class="num strong">${eur(finalBal)}</dd></div>
    </dl>`);
  box.innerHTML = rows.length ? `<table class="ltable stmt">
    <thead><tr><th>Data</th><th>Documento</th><th>Descrição</th><th>Estado</th><th class="num">Débito</th><th class="num">Crédito</th><th class="num">Saldo</th></tr></thead>
    <tbody>${rows.slice().reverse().map(e => {
      const pill = extratoPill(e);
      return `<tr class="k-${e.kind}">
        <td data-l="Data" class="nowrap">${dtFmt(e.t, true)}</td>
        <td data-l="Doc." class="doc">${e.doc}</td>
        <td data-l="Descrição" class="desc"><span class="kind">${KIND_LABEL[e.kind]}</span> ${esc(e.desc)}${e.bet && e.bet.autoSettled ? ' <span class="muted">· liquidada automaticamente</span>' : ''}</td>
        <td data-l="Estado">${pill ? `<span class="spill ${pill[1]}">${pill[0]}</span>` : ''}</td>
        <td data-l="Débito" class="num neg">${e.debit ? '−' + eur(e.debit) : ''}</td>
        <td data-l="Crédito" class="num pos">${e.credit ? '+' + eur(e.credit) : ''}</td>
        <td data-l="Saldo" class="num strong">${eur(e.bal)}</td>
      </tr>`;
    }).join('')}</tbody></table>` : '<div class="empty">Sem movimentos com estes filtros.</div>';
}
function extratoCSV() {
  const b = loadBank();
  const { rows } = extratoRows(b);
  const n = x => (Number(x) || 0).toFixed(2).replace('.', ',');
  const lines = [['Data', 'Documento', 'Tipo', 'Descrição', 'Estado', 'Débito', 'Crédito', 'Saldo'].join(';')];
  rows.forEach(e => lines.push([dtFmt(e.t, true), e.doc, KIND_LABEL[e.kind], '"' + String(e.desc).replace(/"/g, '""') + '"', (extratoPill(e) || [''])[0], e.debit ? n(e.debit) : '', e.credit ? n(e.credit) : '', n(e.bal)].join(';')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `extrato-${wlAcc === 'ze' ? 'mister-ze' : normTxt(holderName('you')).replace(/\s+/g, '-') || 'tu'}-${isoDay(new Date())}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('📄 Extrato exportado (abre no Excel).');
}
function extratoPrint() {
  wlSetTab('extrato');
  document.body.classList.add('print-stmt');
  setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('print-stmt'), 400); }, 60);
}

/* ---------- Render principal ---------- */
function wlSetTab(t) {
  wlTab = t;
  document.querySelectorAll('.wl-tab').forEach(x => { const on = x.dataset.t === t; x.classList.toggle('active', on); x.setAttribute('aria-selected', on); });
  document.querySelectorAll('.wl-pane').forEach(x => { x.hidden = x.dataset.t !== t; });
  renderWallet();
}
function wlSet(k, v) {
  if (k === 'period') wlPeriod = v;
  if (k === 'acc') wlAcc = v;
  if (k === 'type') wlType = v;
  if (k === 'mode') wlChartMode = v;
  document.querySelectorAll(`[data-wl="${k}"]`).forEach(x => x.classList.toggle('active', x.dataset.v === v));
  renderWallet();
}
function renderWallet() {
  if (!document.getElementById('wlCards')) return;
  const b = loadBank();
  const a = walletStats(b, 'you'), z = walletStats(b, 'ze');
  const L = duelLeader(b);
  if (wlTab === 'resumo') {
    setHTML('wlCards', walletCard(b, a, L.who === 'you') + walletCard(b, z, L.who === 'ze'));
    setHTML('wlCompare', compareTable(a, z));
    setHTML('wlOutcome', outcomeBar(a) + outcomeBar(z) + `<div class="olegend">${[['win', '✅ Ganhas'], ['loss', '❌ Perdidas'], ['void', '↩️ Nulas'], ['open', '⏳ Abertas']].map(([k, l]) => `<span><i style="background:${WL_STATUS[k]}"></i>${l}</span>`).join('')}</div>`);
    setHTML('wlMonthly', monthly(b));
    setHTML('wlSource', bySource(b));
    setHTML('wlVerdict', zeFace(zeMood(b), 40) + `<div>${personalize(walletVerdict(a, z))}</div>`);
    requestAnimationFrame(() => equityChart(b));
  }
  if (wlTab === 'extrato') renderExtrato();
}
function walletVerdict(a, z) {
  const nm = esc(holderName('you'));
  if (!a.n && !z.n) return `Contas a zero movimentos. Duas carteiras impecáveis — o problema é que dinheiro parado não ganha duelos.`;
  const parts = [];
  const L = a.roiCap > z.roiCap + 0.0005 ? 'you' : z.roiCap > a.roiCap + 0.0005 ? 'ze' : null;
  parts.push(L === 'ze' ? `Relatório de contas: <b>vou à frente</b> (${pctS(z.roiCap)} contra ${pctS(a.roiCap)}).` : L === 'you' ? `Relatório de contas: <b>vais à frente, ${nm}</b> (${pctS(a.roiCap)} contra ${pctS(z.roiCap)}).` : 'Relatório de contas: empate técnico.');
  if (a.luck != null && Math.abs(a.luck) >= 0.5) parts.push(a.luck > 0 ? `Atenção: ${eur(a.luck)} do teu resultado é <b>sorte</b> — as probabilidades não davam isso.` : `Tens ${eur(-a.luck)} de <b>azar</b> acumulado. Se as tuas apostas tiverem valor, isso volta.`);
  if (a.avgEV != null && a.avgEV < -0.08) parts.push(`As tuas apostas pagam em média ${pctS(a.avgEV)} de imposto à casa. O contabilista em mim chora.`);
  if (a.multis > a.singles && a.n >= 3) parts.push(`Fazes mais múltiplas (${a.multis}) do que simples (${a.singles}). É aí que a casa faz o dinheiro dela.`);
  if (z.passes) parts.push(`Recusei ${z.passes} aposta${z.passes > 1 ? 's' : ''} sem valor — não aparecem no extrato, mas é dinheiro que ficou na conta.`);
  return parts.join(' ');
}
const _renderBancaBase = renderBanca;
renderBanca = function () { _renderBancaBase(); try { renderWallet(); } catch (e) { console.error(e); } };
let wlResizeT = null;
window.addEventListener('resize', () => { clearTimeout(wlResizeT); wlResizeT = setTimeout(() => { if (currentView === 'banca' && wlTab === 'resumo') equityChart(loadBank()); }, 150); });
