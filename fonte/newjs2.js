/* =====================================================================
   v15 · CÉREBRO DO MISTER ZÉ
   Poisson + Dixon-Coles · value (EV) · Kelly ¼ · calibração · épocas
   Boletim por foto (OCR) · dados ao vivo (football-data.org / JSON)
   ===================================================================== */

/* ---------- Médias de golos por liga [casa, fora] ---------- */
const LEAGUE_AVG = {
  'liga portugal': [1.45, 1.10], 'premier': [1.55, 1.25], 'championship': [1.40, 1.10],
  'serie a': [1.45, 1.15], 'bundesliga': [1.75, 1.35], 'la liga': [1.40, 1.05],
  'eredivisie': [1.75, 1.35], 'champions': [1.65, 1.30], 'ligue 1': [1.45, 1.15],
  'segunda': [1.30, 0.95], 'liga 3': [1.35, 1.0], 'liga 2': [1.35, 1.0], 'serie b': [1.30, 1.0]
};
function leagueAvg(league) {
  const L = (league || '').toLowerCase();
  for (const k in LEAGUE_AVG) if (L.includes(k)) return LEAGUE_AVG[k];
  return [1.5, 1.15];
}

/* ---------- Poisson + correção Dixon-Coles (resultados baixos) ---------- */
function poissonArr(l, max) {
  const a = [Math.exp(-l)];
  for (let k = 1; k <= max; k++) a.push(a[k - 1] * l / k);
  return a;
}
function scoreMatrix(lh, la, max, rho) {
  max = max || 10; rho = rho == null ? -0.06 : rho;
  const ph = poissonArr(lh, max), pa = poissonArr(la, max);
  const M = []; let tot = 0;
  for (let i = 0; i <= max; i++) {
    M[i] = [];
    for (let j = 0; j <= max; j++) {
      let p = ph[i] * pa[j];
      if (i === 0 && j === 0) p *= 1 - lh * la * rho;
      else if (i === 0 && j === 1) p *= 1 + lh * rho;
      else if (i === 1 && j === 0) p *= 1 + la * rho;
      else if (i === 1 && j === 1) p *= 1 - rho;
      p = Math.max(p, 0); M[i][j] = p; tot += p;
    }
  }
  for (let i = 0; i <= max; i++) for (let j = 0; j <= max; j++) M[i][j] /= tot;
  return M;
}
function mprob(M, fn) {
  let s = 0;
  for (let i = 0; i < M.length; i++) for (let j = 0; j < M[i].length; j++) if (fn(i, j)) s += M[i][j];
  return s;
}
function marketsFrom(M) {
  const r = {
    '1': mprob(M, (i, j) => i > j), 'X': mprob(M, (i, j) => i === j), '2': mprob(M, (i, j) => i < j),
    'BTTS': mprob(M, (i, j) => i > 0 && j > 0)
  };
  [0.5, 1.5, 2.5, 3.5, 4.5].forEach(l => { r['O' + l] = mprob(M, (i, j) => i + j > l); r['U' + l] = 1 - r['O' + l]; });
  r['1X'] = r['1'] + r['X']; r['X2'] = r['X'] + r['2']; r['12'] = r['1'] + r['2']; r['BTTS_N'] = 1 - r['BTTS'];
  const cs = [];
  for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) cs.push({ s: i + '-' + j, p: M[i][j] });
  cs.sort((a, b) => b.p - a.p);
  r.cs = cs.slice(0, 6);
  return r;
}
function numProb(m) {
  const raw = String(m.prob || '');
  if (/feito/.test(raw)) return null;
  if (/50-50/.test(raw)) return 0.5;
  const nums = raw.match(/\d+/g);
  if (!nums) return null;
  const v = nums.map(Number);
  return (v.length > 1 ? (v[0] + v[1]) / 2 : v[0]) / 100;
}

/* ---------- λ (golos esperados) de cada jogo ---------- */
function lambdasFor(m) {
  if (m.lambdas) return m.lambdas;
  const [ah, aa] = leagueAvg(m.league);
  let T = ah + aa;
  if (m.risk) T += 0.45;
  const p = numProb(m);
  const target = m.type === 'worst' ? '2' : '1';
  let best = null;
  if (p != null) {
    for (let s = -3; s <= 3.001; s += 0.04) {
      const lh = Math.max(0.15, (T + s) / 2), la = Math.max(0.15, (T - s) / 2);
      const M = scoreMatrix(lh, la, 8);
      const pt = target === '1' ? mprob(M, (i, j) => i > j) : mprob(M, (i, j) => i < j);
      const err = Math.abs(pt - p);
      if (!best || err < best.err) best = { lh, la, err };
    }
    return { lh: +best.lh.toFixed(2), la: +best.la.toFixed(2), src: 'dossiê calibrado' };
  }
  const h = getTeamKB(m.home), a = getTeamKB(m.away);
  const rh = (h && h.rating) || 70, ra = (a && a.rating) || 70;
  const s = (rh - ra) / 16 + 0.25;
  return { lh: +Math.max(0.2, (T + s) / 2).toFixed(2), la: +Math.max(0.2, (T - s) / 2).toFixed(2), src: 'ratings' };
}
const MODEL_CACHE = new Map();
function modelo(m) {
  const k = m.home + '|' + m.away + '|' + m.date + '|' + (m.lambdas ? m.lambdas.lh + '/' + m.lambdas.la : '');
  if (MODEL_CACHE.has(k)) return MODEL_CACHE.get(k);
  const L = lambdasFor(m);
  const M = scoreMatrix(L.lh, L.la, 10);
  const r = { lh: L.lh, la: L.la, src: L.src, M, mk: marketsFrom(M) };
  MODEL_CACHE.set(k, r);
  return r;
}
/** Placar mais provável — agora vem do modelo Poisson */
function preverPlacar(m) {
  const r = modelo(m);
  const top = r.mk.cs[0];
  const [hg, ag] = top.s.split('-').map(Number);
  return { hg, ag, label: top.s, diff: +(r.lh - r.la).toFixed(2), p: top.p };
}
const pct = x => (x == null ? '—' : x <= 0 ? '0%' : (x * 100).toFixed(x < 0.001 ? 3 : x < 0.01 ? 2 : x < 0.1 ? 1 : 0) + '%');
const fairOdd = p => (p > 0 ? (1 / p).toFixed(2) : '—');

/* ---------- Mercados que o Zé avalia ---------- */
const ZE_MARKETS = ['1', 'X', '2', '1X', 'X2', 'O1.5', 'O2.5', 'U2.5', 'O3.5', 'BTTS', 'BTTS_N'];
function marketName(k, m) {
  const H = m ? m.home : 'Casa', A = m ? m.away : 'Fora';
  return ({
    '1': `${H} vence`, 'X': 'Empate', '2': `${A} vence`, '1X': `${H} ou empate (1X)`, 'X2': `${A} ou empate (X2)`,
    'O1.5': 'Mais de 1.5 golos', 'O2.5': 'Mais de 2.5 golos', 'U2.5': 'Menos de 2.5 golos', 'O3.5': 'Mais de 3.5 golos',
    'BTTS': 'Ambas marcam — Sim', 'BTTS_N': 'Ambas marcam — Não'
  })[k] || k;
}

/* ---------- Calibração: o Zé aprende com os próprios erros ---------- */
function zeCalib() {
  const b = loadBank();
  const all = b.zeBets.concat(...(b.seasons || []).map(s => s.zeBetsArchive || []));
  const closed = all.filter(x => (x.status === 'win' || x.status === 'loss') && typeof x.pUsed === 'number');
  const n = closed.length;
  if (n < 6) return { n, mult: 1, extraEdge: 0, brier: null, exp: null, hit: null };
  const exp = closed.reduce((s, x) => s + x.pUsed, 0) / n;
  const hit = closed.filter(x => x.status === 'win').length / n;
  const brier = closed.reduce((s, x) => s + Math.pow(x.pUsed - (x.status === 'win' ? 1 : 0), 2), 0) / n;
  const gap = exp - hit;
  let mult = 1, extra = 0;
  if (gap > 0.08) { mult = 0.6; extra = 0.03; }
  else if (gap > 0.04) { mult = 0.8; extra = 0.015; }
  else if (gap < -0.05 && n >= 15) { mult = 1.1; }
  return { n, mult, extraEdge: extra, brier, exp, hit };
}
function zeDrawdown(b) {
  const peak = Math.max(b.zePeak || 0, b.startZe);
  return peak > 0 ? Math.max(0, 1 - (b.ze + openStake(b.zeBets)) / peak) : 0;
}
function openStake(list) { return (list || []).filter(x => x.status === 'open').reduce((s, x) => s + Number(x.stake || 0), 0); }

/** Decisão do Zé: só aposta com valor (EV) e mede a stake com Kelly ¼ */
function zeDecide(m, odds, bankAvail) {
  const r = modelo(m);
  const cal = zeCalib();
  const b = loadBank();
  const dd = zeDrawdown(b);
  const ddMult = dd > 0.4 ? 0.35 : dd > 0.25 ? 0.5 : 1;
  const minEdge = 0.03 + cal.extraEdge + (dd > 0.25 ? 0.02 : 0);
  const rows = ZE_MARKETS.map(k => {
    const o = Number(odds[k]);
    const pModel = r.mk[k];
    const row = { k, label: marketName(k, m), pModel, fair: 1 / pModel, odd: o > 1.01 ? o : null };
    if (row.odd) {
      const p = 0.75 * pModel + 0.25 * (1 / o);          // encolhe para o mercado: humildade
      row.p = p; row.ev = p * o - 1; row.kelly = (p * o - 1) / (o - 1);
      row.need = (1 + minEdge) / p;                     // odd mínima para entrar
    } else {
      row.need = (1 + minEdge) / pModel;
    }
    return row;
  });
  const cands = rows.filter(x => x.odd && x.ev > minEdge && x.odd <= 6 && x.p >= 0.2).sort((a, b) => b.kelly - a.kelly);
  let pick = cands[0] || null, stake = 0;
  const exposure = openStake(b.zeBets);
  const onMatch = b.zeBets.filter(x => x.status === 'open' && x.match === m.home + ' vs ' + m.away);
  const openMatch = onMatch.reduce((s, x) => s + Number(x.stake), 0);
  const capLeft = Math.max(0, Math.min(r2((bankAvail + exposure) * 0.15 - exposure), r2((bankAvail + exposure) * 0.08 - openMatch)));
  if (pick) {
    const f = Math.min(0.05, pick.kelly * 0.25) * cal.mult * ddMult * (onMatch.length ? 0.5 : 1);
    stake = Math.max(0.1, r2(bankAvail * f));
    stake = Math.min(stake, capLeft, r2(bankAvail));
    if (stake < 0.1) pick = null;
  }
  return { r, rows, pick, stake, minEdge, cal, dd, ddMult, capLeft };
}

/* ======================= DUELO v2 ======================= */
function oddsKey(m) { return 'ze_odds_' + normTxt(m.home + '_' + m.away + '_' + m.date); }

function prepararDuelo(idx) {
  try {
    const dv = document.getElementById('view-duelo');
    if (dv && !dv.classList.contains('active')) fmGo('duelo');
    const box = document.getElementById('dueloBox');
    if (!box) return;
    const list = upcoming(10);
    let m = (idx != null && matches[idx]) ? matches[idx] : pickDueloMatch();
    if (!m) {
      box.style.display = 'block';
      box.innerHTML = '<div class="muted">Sem jogos no radar para duelo. Atualiza os dados ao vivo em Definições.</div>';
      return;
    }
    const r = modelo(m);
    const saved = lsGet(oddsKey(m), {});
    dueloAtual = { m, r, decision: null, pick: deriveBet(m) };
    const mi = matchIndex(m);
    const opts = list.map(x => `<option value="${x.i}" ${x.i === mi ? 'selected' : ''}>${esc(x.m.date)} · ${esc(x.m.home)} vs ${esc(x.m.away)}${x.m.live ? ' · API' : ''}</option>`).join('');
    const rows = ZE_MARKETS.map(k => `<tr>
        <td>${esc(marketName(k, m))}</td>
        <td>${pct(r.mk[k])}</td>
        <td class="muted">${fairOdd(r.mk[k])}</td>
        <td><input class="inp oddin" id="odd_${k.replace('.', '_')}" type="number" inputmode="decimal" step="0.01" min="1.01" placeholder="odd" value="${saved[k] || ''}"></td>
      </tr>`).join('');
    const cs = r.mk.cs.slice(0, 4).map(c => `<span class="ptag mid" style="margin-right:4px;">${c.s} · ${pct(c.p)}</span>`).join('');
    box.style.display = 'block';
    box.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
        <div class="eyebrow" style="color:var(--purple)">⚔️ Duelo</div>
        <select class="inp" style="flex:1;min-width:200px;" onchange="prepararDuelo(+this.value)">${opts || `<option>${esc(m.home)} vs ${esc(m.away)}</option>`}</select>
      </div>
      <div style="font-family:var(--cond);font-size:1.35rem;font-weight:800;text-transform:uppercase;">${vsHTML(m.home, m.away, 26)}</div>
      <div class="muted" style="font-size:.82rem;margin-bottom:10px;">${esc(m.league)} · ${esc(m.date)} · golos esperados <b style="color:var(--text)">${r.lh.toFixed(2)} – ${r.la.toFixed(2)}</b> <span class="muted">(${r.src})</span>${m.aviso ? ` · <span style="color:var(--yellow)">⚠️ ${esc(m.aviso)}</span>` : ''}</div>
      <div style="margin-bottom:10px;">${cs}</div>
      <div class="zbox" style="margin-top:0;">
        <div style="font-size:.84rem;margin-bottom:8px;">Mete as <b>odds reais</b> da tua casa de apostas (as que tiveres). O Zé compara com a <b>odd justa</b> do modelo e só entra onde há valor.</div>
        <div style="overflow-x:auto;"><table class="mtable"><thead><tr><th>Mercado</th><th>Prob.</th><th>Justa</th><th>Odd real</th></tr></thead><tbody>${rows}</tbody></table></div>
        <button class="btn btn-lime" style="margin-top:10px;" onclick="zeDecidirUI()">🧠 Zé, decide</button>
      </div>
      <div id="zeDecision"></div>
      <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:14px;">
        <div style="font-size:.78rem;color:var(--muted);margin-bottom:6px;">👤 A tua aposta rival (segue o Zé ou a tua cabeça)</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          <input id="dueloPickYou" class="inp" placeholder="O teu pick" style="flex:1;min-width:140px;">
          <input id="dueloOddYou" class="inp" type="number" inputmode="decimal" step="0.01" placeholder="Odd" style="width:80px;">
          <input id="dueloStakeYou" class="inp" type="number" inputmode="decimal" step="0.1" placeholder="€" style="width:74px;">
          <button class="btn" onclick="confirmarDueloHumano()">Registar-me</button>
        </div>
        <div id="dueloKellyYou" class="muted" style="font-size:.76rem;margin-top:6px;"></div>
      </div>
      <div id="dueloMsg" style="margin-top:10px;font-size:.86rem;color:var(--purple);"></div>`;
    const py = document.getElementById('dueloPickYou');
    if (py) py.value = dueloAtual.pick;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    console.error(err);
    alert('Erro no duelo: ' + (err && err.message ? err.message : err));
  }
}

function zeDecidirUI() {
  if (!dueloAtual) return prepararDuelo();
  const m = dueloAtual.m;
  const odds = {};
  ZE_MARKETS.forEach(k => { const el = document.getElementById('odd_' + k.replace('.', '_')); if (el && Number(el.value) > 1) odds[k] = Number(el.value); });
  lsSet(oddsKey(m), odds);
  if (!Object.keys(odds).length) { toast('Mete pelo menos uma odd real.'); return; }
  const b = loadBank();
  const d = zeDecide(m, odds, b.ze);
  dueloAtual.decision = d;
  const rows = d.rows.filter(x => x.odd).sort((a, b) => b.ev - a.ev).map(x => `<tr>
      <td>${esc(x.label)}</td><td>${x.odd.toFixed(2)}</td><td>${pct(x.p)}</td>
      <td class="${x.ev > d.minEdge ? 'ev-pos' : x.ev > 0 ? '' : 'ev-neg'}">${(x.ev * 100).toFixed(1)}%</td>
    </tr>`).join('');
  const needList = d.rows.filter(x => x.pModel >= 0.3).sort((a, b) => b.pModel - a.pModel).slice(0, 4)
    .map(x => `${esc(x.label)} ≥ <b>${x.need.toFixed(2)}</b>`).join(' · ');
  const calTxt = d.cal.n >= 6
    ? `Calibração: ${d.cal.n} apostas · previa ${pct(d.cal.exp)} · acertou ${pct(d.cal.hit)}${d.cal.mult < 1 ? ' → modo prudente' : ''}`
    : `Calibração: ainda só ${d.cal.n} apostas fechadas (preciso de 6)`;
  let verdict;
  if (d.pick) {
    const p = d.pick;
    verdict = `<div class="speech" style="margin:10px 0 0;border-color:var(--lime);">${zeFace(p.ev > 0.08 ? 'gozao' : 'feliz', 46)}<div>
      <b>Aposto:</b> ${esc(p.label)} @ <b>${p.odd.toFixed(2)}</b><br>
      Prob. estimada ${pct(p.p)} (justa ${fairOdd(p.p)}) · valor <b class="ev-pos">+${(p.ev * 100).toFixed(1)}%</b><br>
      ${loadBank().zeBets.some(x => x.status === 'open' && x.match === m.home + ' vs ' + m.away) ? '<span class="muted">Já tenho aposta neste jogo: esta é extra, com stake a meio (estão correlacionadas) e teto de 8% da banca por jogo.</span><br>' : ''}Stake <b style="color:var(--lime)">${d.stake.toFixed(2)} €</b> = Kelly ¼ (${Math.min(5, p.kelly * 25).toFixed(1)}% da banca)${d.ddMult < 1 ? ' · cortada por drawdown' : ''}${d.cal.mult !== 1 ? ' · ajustada pela calibração' : ''}
      <div style="margin-top:8px;"><button class="btn btn-lime btn-sm" onclick="confirmarDueloZe()">✅ Confirmar aposta do Zé</button></div>
    </div></div>`;
  } else {
    verdict = `<div class="speech" style="margin:10px 0 0;">${zeFace('pensativo', 46)}<div>
      <b>Passo.</b> Nenhuma destas odds tem valor ≥ ${(d.minEdge * 100).toFixed(1)}%. Dinheiro que não perco é dinheiro que te ganho.<br>
      <span class="muted">Só entrava com: ${needList}</span>
      <div style="margin-top:8px;"><button class="btn btn-sm" onclick="zeRegistarPasse()">📝 Registar «Zé passou»</button></div>
    </div></div>`;
  }
  setHTML('zeDecision', `<div class="zbox"><div style="overflow-x:auto;"><table class="mtable"><thead><tr><th>Mercado</th><th>Odd</th><th>Prob. Zé</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="muted" style="font-size:.74rem;margin-top:6px;">EV mínimo ${(d.minEdge * 100).toFixed(1)}% · teto 5% por aposta · exposição máx. 15% · ${calTxt}${d.dd > 0.05 ? ` · drawdown ${pct(d.dd)}` : ''}</div>
    ${verdict}</div>`);
  // sugestão Kelly para o humano
  const bestY = d.rows.filter(x => x.odd && x.ev > 0).sort((a, b) => b.kelly - a.kelly)[0];
  setHTML('dueloKellyYou', bestY
    ? `🧮 Para a tua banca (${b.you.toFixed(2)} €), Kelly ¼ em «${esc(bestY.label)}» seria ${r2(b.you * Math.min(0.05, bestY.kelly * 0.25)).toFixed(2)} €.`
    : '🧮 Pelas odds que meteste, nenhuma aposta tem valor positivo. Se fores na mesma, é por gosto.');
  if (d.pick) { const py = document.getElementById('dueloPickYou'); if (py) py.value = d.pick.label; }
}

function zeRegistarPasse() {
  const b = loadBank();
  b.zePasses = (b.zePasses || 0) + 1;
  saveBank(b);
  toast('📝 Registado: o Zé recusou uma aposta sem valor.');
  renderBanca();
}

function confirmarDueloZe() {
  if (!dueloAtual || !dueloAtual.decision || !dueloAtual.decision.pick) { toast('Primeiro carrega em «Zé, decide».'); return; }
  const d = dueloAtual.decision, p = d.pick, m = dueloAtual.m;
  const keyM = m.home + ' vs ' + m.away;
  if (zeHasSame(keyM, p.label)) { toast('O Zé já tem essa aposta neste jogo — não repete.'); setHTML('dueloMsg', `🙅 Já tenho <b>${esc(p.label)}</b> aqui. Para outra aposta, provoca-me noutro mercado (no chat ou com outras odds).`); return; }
  const bank = loadBank();
  const stake = Math.min(d.stake, bank.ze);
  if (stake < 0.1) { alert('Banca do Zé sem saldo.'); return; }
  const bet = {
    match: keyM, pick: p.label, odd: p.odd, stake: r2(stake), source: 'duelo-ze', market: p.k,
    pModel: +p.pModel.toFixed(4), pUsed: +p.p.toFixed(4), ev: +p.ev.toFixed(4),
    zeCompare: `EV +${(p.ev * 100).toFixed(1)}% · prob ${pct(p.p)} · justa ${fairOdd(p.p)} · Kelly ¼`
  };
  if (!addBet(bet, 'ze')) return;
  setHTML('dueloMsg', `🤖 Fechado: <strong>${esc(p.label)}</strong> @ ${p.odd.toFixed(2)} · <strong>${stake.toFixed(2)} €</strong>. Banca Zé: ${loadBank().ze.toFixed(2)} €.<br><em>“Matemática, chefe. Tu tens palpites, eu tenho distribuições.”</em>`);
  renderBanca();
}

/* ======================= BANCA v2 · épocas ======================= */
function loadBank() {
  let b = null;
  try { b = JSON.parse(localStorage.getItem(BANK_KEY) || 'null'); } catch (e) {}
  if (!b || typeof b.you !== 'number') b = { you: BANK_START, ze: BANK_START, bets: [], zeBets: [], start: BANK_START };
  if (typeof b.startYou !== 'number') b.startYou = (typeof b.start === 'number') ? b.start : BANK_START;
  if (typeof b.startZe !== 'number') b.startZe = (typeof b.start === 'number') ? b.start : BANK_START;
  b.bets = b.bets || []; b.zeBets = b.zeBets || []; b.seasons = b.seasons || [];
  b.season = b.season || 1; b.seasonStart = b.seasonStart || new Date().toISOString();
  b.zePasses = b.zePasses || 0;
  b.zePeak = Math.max(b.zePeak || 0, b.startZe, b.ze);
  b.start = b.startYou;
  return b;
}
function roiOf(cur, start) { return start > 0 ? (cur - start) / start : 0; }
/** Quem lidera: por ROI (justo quando as bancas iniciais são diferentes) */
function duelLeader(b) {
  b = b || loadBank();
  const ry = roiOf(b.you + openStake(b.bets), b.startYou), rz = roiOf(b.ze + openStake(b.zeBets), b.startZe);
  const who = Math.abs(ry - rz) < 0.0005 ? 'tie' : ry > rz ? 'you' : 'ze';
  return { who, ry, rz, handicap: b.startZe < b.startYou ? 'ze' : b.startYou < b.startZe ? 'you' : null };
}
function resetBanca() { novaEpoca(true); }
function novaEpoca(sameStarts) {
  const b = loadBank();
  const sy = sameStarts ? b.startYou : Number(document.getElementById('cfgStartYou').value);
  const sz = sameStarts ? b.startZe : Number(document.getElementById('cfgStartZe').value);
  if (!(sy > 0) || !(sz > 0)) { alert('Bancas iniciais têm de ser > 0.'); return; }
  if (!sameStarts && !confirm(`Fechar a época ${b.season} e começar nova: ${pname()} ${sy.toFixed(2)} € · Zé ${sz.toFixed(2)} €?`)) return;
  const L = duelLeader(b);
  if (b.bets.length || b.zeBets.length || b.you !== b.startYou || b.ze !== b.startZe) {
    b.seasons.unshift({
      n: b.season, from: b.seasonStart, to: new Date().toISOString(),
      startYou: b.startYou, startZe: b.startZe, you: b.you, ze: b.ze,
      roiYou: L.ry, roiZe: L.rz, winner: L.who,
      betsYou: b.bets.length, betsZe: b.zeBets.length,
      winsYou: b.bets.filter(x => x.status === 'win').length, winsZe: b.zeBets.filter(x => x.status === 'win').length,
      passes: b.zePasses,
      zeBetsArchive: b.zeBets.filter(x => typeof x.pUsed === 'number').map(x => ({ status: x.status, pUsed: x.pUsed }))
    });
  }
  saveBank({ you: sy, ze: sz, startYou: sy, startZe: sz, start: sy, bets: [], zeBets: [], seasons: b.seasons.slice(0, 40), season: b.season + 1, seasonStart: new Date().toISOString(), zePasses: 0, zePeak: sz });
  renderBanca(); renderConfig();
  toast(`🏁 Época ${b.season + 1} começou · ${pname()} ${sy.toFixed(2)} € vs Zé ${sz.toFixed(2)} €`);
}

/* ======================= BOLETIM: OCR + PARSER ======================= */
let slipState = { legs: [], totalOdd: null, boost: 0, stake: null, declared: null, text: '' };

function normTxt(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.,+\-/ ]/g, ' ').replace(/\s+/g, ' ').trim();
}
const TEAM_ALIAS = {
  'man city': 'manchester city', 'man united': 'manchester united', 'man utd': 'manchester united',
  'vitoria sc': 'vitoria guimaraes', 'vitoria s.c.': 'vitoria guimaraes', 'fc copenhaga': 'copenhaga kobenhavn copenhagen',
  'inter': 'inter internazionale', 'bayern': 'bayern munchen munique', 'psv': 'psv eindhoven'
};
const TEAM_STOP = new Set(['fc', 'sl', 'sc', 'cf', 'ac', 'ud', 'cd', 'rcd', 'afc', 'sad', 'club', 'clube', 'de', 'da', 'do', 'the', '1913', '1907', '1909', 'sv', 'vfb', 'vfl', 'tsg', 'as', 'ss', 'us', 'fk', 'bk', 'if', 'cp', 'calcio', 'futebol', 'football']);
const TEAM_GENERIC = new Set(['city', 'united', 'real', 'sporting', 'athletic', 'atletico', 'town', 'rovers', 'wanderers', 'hotspur', 'albion', 'county']);
function teamTokens(name) {
  let n = normTxt(name).replace(/\./g, '');
  if (TEAM_ALIAS[n]) n = TEAM_ALIAS[n];
  return n.split(' ').filter(t => t.length >= 3 && !TEAM_STOP.has(t));
}
function teamScore(name, normText) {
  let s = 0, distinct = 0;
  teamTokens(name).forEach(t => {
    if (new RegExp('(^| )' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( |$)').test(normText)) {
      if (TEAM_GENERIC.has(t)) s += 1; else { s += 2; distinct++; }
    }
  });
  return distinct ? s : 0;
}
function expandAliases(t) {
  let out = ' ' + t + ' ';
  Object.keys(TEAM_ALIAS).forEach(k => { if (out.includes(' ' + k.replace(/\./g, '') + ' ')) out += TEAM_ALIAS[k] + ' '; });
  return out.trim();
}
function findMatchForLeg(leg) {
  const t = expandAliases(normTxt([leg.home, leg.away, leg.sel].join(' ')).replace(/\./g, ''));
  let best = null;
  matches.forEach(m => {
    if (m.past || m.aviso) return;
    const dObj = parseDayLabel(m.date);
    const dd = dObj ? daysFromToday(dObj) : 99;
    if (dd < 0 || (!(leg.home && leg.away) && dd > 2)) return;
    const sh = teamScore(m.home, t), sa = teamScore(m.away, t);
    const both = sh > 0 && sa > 0;
    if (leg.home && leg.away ? !both : !(sh || sa)) return;
    const sc = sh + sa + (both ? 3 : 0) + (m.live ? 1 : 0) + (dd <= 1 ? 2 : dd <= 4 ? 1 : 0);
    if (!best || sc > best.sc) best = { m, sc };
  });
  return best ? best.m : null;
}
/** Converte o texto da seleção em condições sobre o placar (i golos casa, j golos fora) */
function selConds(selRaw, m) {
  const s = normTxt(selRaw).replace(/\./g, (x, i, str) => /\d\.\d/.test(str.slice(i - 1, i + 2)) ? '.' : ' ');
  const conds = [];
  const hs = teamScore(m.home, s) > 0, as = teamScore(m.away, s) > 0;
  const ou = s.match(/(mais de|over|acima de|\+)\s*(\d+)[.,]5/);
  if (ou) { const l = +ou[2] + 0.5; conds.push((i, j) => i + j > l); }
  const un = s.match(/(menos de|under|abaixo de)\s*(\d+)[.,]5/);
  if (un) { const l = +un[2] + 0.5; conds.push((i, j) => i + j < l); }
  if (/ambas|btts|ambos marcam|both teams/.test(s)) {
    if (/\b(nao|no)\b/.test(s)) conds.push((i, j) => i === 0 || j === 0); else conds.push((i, j) => i > 0 && j > 0);
  }
  const hc = s.match(/([+-]\d+)[.,]5/);
  if (/\b1x\b/.test(s) || (/(or draw|ou empate)/.test(s) && hs && !as)) conds.push((i, j) => i >= j);
  else if (/\bx2\b/.test(s) || (/(or draw|ou empate)/.test(s) && as)) conds.push((i, j) => i <= j);
  else if (/\b(empate|draw)\b/.test(s) || s === 'x') conds.push((i, j) => i === j);
  else if (hc && (hs || as) && !ou && !un) { const h = parseFloat(hc[1] + '.5'); conds.push(hs ? ((i, j) => i + h > j) : ((i, j) => j + h > i)); }
  else if (hs && !as) conds.push((i, j) => i > j);
  else if (as && !hs) conds.push((i, j) => i < j);
  else if (/^1$|casa vence|home win/.test(s)) conds.push((i, j) => i > j);
  else if (/^2$|fora vence|away win/.test(s)) conds.push((i, j) => i < j);
  return conds.length ? conds : null;
}
function legEval(leg) {
  const odd = Number(leg.odd) || 0;
  const m = leg.sport === 'nba' ? null : findMatchForLeg(leg);
  if (m) {
    const r = modelo(m);
    const c = selConds(leg.sel, m);
    if (c) return { m, p: mprob(r.M, (i, j) => c.every(f => f(i, j))), src: 'modelo' + (m.live ? ' (API)' : '') };
  }
  if (odd > 1) return { m, p: (1 / odd) / 1.055, src: leg.sport === 'nba' ? 'NBA · sem modelo' : 'odd sem margem' };
  return { m, p: null, src: 'sem odd' };
}

const ODD_RE = /(^|\s)(\d{1,3}[.,]\d{2})\s*$/;
const MARKET_RE = /^(resultado final|total de golos|ambas (as equipas )?marcam|dupla hip[oó]tese|hip[oó]tese dupla|dupla chance|total de cantos|cantos|total de cart[oõ]es|cart[oõ]es|resultado corre[c]?to|resultado exato|intervalo\/final|vencedor do jogo|vencedor|golos da equipa|[ií]mpar\/par|handicap|marcador|resultado ao intervalo|1x2|mais\/menos|resultado final \/ total|draw no bet|empate anula)/i;
const DATE_RE = /\d{1,2}\/\d{1,2}\/\d{2,4}.*$/;
function cleanName(s) {
  let t = String(s || '').replace(DATE_RE, '').replace(ODD_RE, '').trim();
  t = t.replace(/^(?:[^A-Za-zÀ-ÿ0-9]+|\d\)\s*|[a-wyz]\s+|[O0Q@]\)?\s+(?=[A-Za-zÀ-ÿ]))+/, '').replace(/[{}\[\]|]/g, ' ').trim();
  let parts = t.split(/\s+/);
  while (parts.length > 1 && /^([^A-Za-zÀ-ÿ0-9]+|[A-Za-zÀ-ÿ&@©®]|\d)$/.test(parts[parts.length - 1]) && !/^(x|1x|x2|12)$/i.test(parts[parts.length - 1])) parts.pop();
  return parts.join(' ').trim();
}
function oddFrom(s) {
  const m = String(s || '').match(ODD_RE);
  return m ? parseFloat(m[2].replace(',', '.')) : null;
}
/** Lê o texto do OCR (Betano, Betclic, apps de tips…) e extrai seleções */
function parseSlip(text) {
  const out = { legs: [], totalOdd: null, boost: 0, stake: null, declared: null };
  const lines = String(text || '').split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const used = new Set();
  lines.forEach((l, i) => {
    let mm;
    if ((mm = l.match(/m\S{0,2}ltipla\s*(\d+)?\s*sele\S*\s*(\d+[.,]\d{2})?/i))) {
      if (mm[1]) out.declared = +mm[1];
      if (mm[2]) out.totalOdd = parseFloat(mm[2].replace(',', '.'));
      used.add(i);
    }
    if ((mm = l.match(/(odds?|cotas?)\s*(total|combinada)?[^\d]{0,6}(\d+[.,]\d{2})/i)) && !out.totalOdd) { out.totalOdd = parseFloat(mm[3].replace(',', '.')); used.add(i); }
    if ((mm = l.match(/extra\s*(\d+(?:[.,]\d+)?)\s*%/i)) || (mm = l.match(/b[oó]nus\s*(\d+(?:[.,]\d+)?)\s*%/i))) { out.boost = parseFloat(mm[1].replace(',', '.')); if (out.boost > 50 && /^\d{3}$/.test(mm[1])) out.boost = out.boost / 10; used.add(i); }
    if ((mm = l.match(/(montante|valor apostado|valor da aposta|aposta total|stake)[^\d]{0,15}(\d+[.,]\d{2})/i))) { out.stake = parseFloat(mm[2].replace(',', '.')); used.add(i); }
    if ((mm = l.match(/^\W*(simples|dupla|tripla|qu[aá]drupla|m[uú]ltipla)\b[^\d]{0,20}(\d+[.,]\d{2})\s*€\s*(\d+[.,]\d{2})?/i))) {
      out.stake = out.stake || parseFloat(mm[2].replace(',', '.'));
      if (mm[3]) out.totalOdd = parseFloat(mm[3].replace(',', '.'));
      out.declared = out.declared || ({ simples: 1, dupla: 2, tripla: 3, 'quádrupla': 4, quadrupla: 4 })[mm[1].toLowerCase()] || null;
      used.add(i);
    }
    if (/cash ?out|ganhos potenciais|^\W*betan/i.test(l)) used.add(i);
    if (/(ganhos?|retorno|pr[eé]mio)/i.test(l)) used.add(i);
  });
  // Formato «casa de apostas»: seleção+odd / mercado / casa / fora
  lines.forEach((l, i) => {
    if (!MARKET_RE.test(l)) return;
    const selLine = lines[i - 1] || '';
    let odd = oddFrom(selLine);
    if (!odd) { const t3 = selLine.match(/\s([1-9])(\d{2})\s*$/); if (t3) odd = parseFloat(t3[1] + '.' + t3[2]); }
    const nearby = [];
    for (let k = i + 1; k <= i + 4 && k < lines.length; k++) {
      if (MARKET_RE.test(lines[k]) || oddFrom(lines[k]) && !DATE_RE.test(lines[k])) break;
      const n = cleanName(lines[k]);
      if (n && ((n.match(/[A-Za-zÀ-ÿ0-9]/g) || []).length / n.length < 0.75 || (n.match(/[A-Za-zÀ-ÿ]/g) || []).length < 3)) continue;
      if (n && n.length >= 3 && !/(link|captura|partilhar|ecr[aã]|\d{1,2}:\d{2}|%)/i.test(n)) nearby.push(n);
      used.add(k);
      if (nearby.length === 2) break;
    }
    if (!odd) { for (let k = i - 2; k <= i + 3; k++) { const o = oddFrom(lines[k]); if (o && /^\s*\d{1,3}[.,]\d{2}\s*$/.test(lines[k] || '') && !used.has(k)) { odd = o; used.add(k); break; } } }
    used.add(i); used.add(i - 1);
    let selTxt = cleanName(selLine).replace(/\s[1-9]\d{2}$/, '');
    if (/ambas/i.test(l) && /^(n[aã]o|no|sim|yes)$/i.test(selTxt)) selTxt = /^(n[aã]o|no)$/i.test(selTxt) ? 'Ambas marcam — Não' : 'Ambas marcam — Sim';
    if (/total de golos|mais\/menos/i.test(l) && /^(mais|menos|over|under)/i.test(selTxt) && !/golos/i.test(selTxt)) selTxt += ' golos';
    out.legs.push({ sel: selTxt, market: l, home: nearby[0] || '', away: nearby[1] || '', odd: odd || '' });
  });
  // Formato «tips»: «Casa - ⏱ - Fora» e na linha seguinte o pick (+ odd)
  lines.forEach((l, i) => {
    if (used.has(i)) return;
    const mm = l.match(/^(.{3,}?)\s+(?:[-–=©®@|]\s*(?:[^\sA-Za-zÀ-ÿ]{1,2}\s*)?){1,3}\s*(.{3,})$/);
    if (!mm || oddFrom(l) || /%|\d{1,2}:\d{2}/.test(l)) return;
    const okName = x => /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'&-]{2,}$/.test(cleanName(x));
    if (!okName(mm[1]) || !okName(mm[2])) return;
    const nxt = lines[i + 1] || '';
    if (!nxt || used.has(i + 1) || /partilhar|link|captura/i.test(nxt)) return;
    const sport = /nba|basket/i.test(lines[i - 1] || '') ? 'nba' : '';
    out.legs.push({ sel: cleanName(nxt), market: '', home: cleanName(mm[1]), away: cleanName(mm[2]), odd: oddFrom(nxt) || '', sport });
    used.add(i); used.add(i + 1);
  });
  { const seen = new Map(); out.legs = out.legs.filter(l => { const k = legKey(l); if (seen.has(k)) { const ex = seen.get(k); if (!ex.away && l.away) { ex.home = l.home; ex.away = l.away; } return false; } seen.set(k, l); return true; }); }
  // Restantes linhas com odd no fim → seleção solta
  lines.forEach((l, i) => {
    if (used.has(i) || DATE_RE.test(l)) return;
    const o = oddFrom(l);
    const name = cleanName(l);
    if (o && o >= 1.01 && o < 100 && name.length >= 3 && !/(total|ganhos|retorno|saldo)/i.test(l)) out.legs.push({ sel: name, market: '', home: '', away: '', odd: o });
  });
  return out;
}
function parseSlipText(msg) {
  const body = String(msg).replace(/^[^:]*?(vou assim|vou por|boletim|m[uú]ltipla|que achas)[^:]*:\s*/i, '');
  const chunks = body.split(/\n|;|\+|,\s+(?=[A-Za-zÀ-ÿ])|(?<=\d[.,]\d{2})\s+e\s+/).map(s => s.trim()).filter(Boolean);
  const p = parseSlip(chunks.join('\n'));
  return p;
}
function legKey(l) { return normTxt(l.sel) + '|' + (Number(l.odd) || ''); }
function mergeSlip(into, add) {
  const keys = new Set(into.legs.map(legKey));
  add.legs.forEach(l => { const k = legKey(l); if (!keys.has(k)) { into.legs.push(l); keys.add(k); } else { const ex = into.legs.find(x => legKey(x) === k); if (ex) { if (!ex.odd && l.odd) ex.odd = l.odd; if (l.away && (!ex.away || ex.away.length < 3)) { ex.home = l.home || ex.home; ex.away = l.away; } } } });
  if (add.totalOdd && !into.totalOdd) into.totalOdd = add.totalOdd;
  if (add.boost && !into.boost) into.boost = add.boost;
  if (add.stake && !into.stake) into.stake = add.stake;
  if (add.declared && !into.declared) into.declared = add.declared;
  return into;
}

function loadScript(src, ms) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    const timer = setTimeout(() => { s.remove(); rej(new Error('sem internet para carregar o leitor (OCR) — tempo esgotado')); }, ms || 20000);
    s.src = src; s.onload = () => { clearTimeout(timer); res(); }; s.onerror = () => { clearTimeout(timer); s.remove(); rej(new Error('sem internet para carregar o leitor (OCR)')); };
    document.head.appendChild(s);
  });
}
async function getOcrWorker(onProgress) {
  window._ocrProgress = onProgress;
  if (window._zeOcr) return window._zeOcr;
  if (navigator.onLine === false && !window.Tesseract) throw new Error('sem internet para carregar o leitor (OCR)');
  if (!window.Tesseract) await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js', 20000);
  const w = await Promise.race([
    Tesseract.createWorker('por+eng', 1, { logger: m => { if (window._ocrProgress) window._ocrProgress(m); } }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('sem internet para carregar o leitor (OCR) — tempo esgotado')), 60000))
  ]);
  await w.setParameters({ tessedit_pageseg_mode: '6' });
  window._zeOcr = w;
  return w;
}
/** Prepara a imagem: escala, cinzento, contraste, inverte se for tema escuro */
function prepImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(2.2, Math.max(1, 1400 / img.width));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      let sum = 0;
      for (let k = 0; k < d.data.length; k += 4) { const g = 0.299 * d.data[k] + 0.587 * d.data[k + 1] + 0.114 * d.data[k + 2]; d.data[k] = g; sum += g; }
      const inv = sum / (d.data.length / 4) < 110;
      for (let k = 0; k < d.data.length; k += 4) {
        let g = d.data[k]; if (inv) g = 255 - g;
        g = Math.max(0, Math.min(255, (g - 128) * 1.35 + 128));
        d.data[k] = d.data[k + 1] = d.data[k + 2] = g;
      }
      ctx.putImageData(d, 0, 0);
      URL.revokeObjectURL(url);
      res(c);
    };
    img.onerror = () => rej(new Error('imagem inválida'));
    img.src = url;
  });
}
async function ocrFiles(files, status) {
  const slip = { legs: [], totalOdd: null, boost: 0, stake: null, declared: null, text: '' };
  const w = await getOcrWorker(m => {
    if (m.status === 'recognizing text') status(`A ler… ${Math.round(m.progress * 100)}%`);
    else if (/loading|initializ/.test(m.status)) status('A preparar o leitor (1.ª vez demora um pouco)…');
  });
  for (let n = 0; n < files.length; n++) {
    status(`Imagem ${n + 1}/${files.length}…`);
    const canvas = await prepImage(files[n]);
    const { data } = await w.recognize(canvas);
    slip.text += '\n' + data.text;
    mergeSlip(slip, parseSlip(data.text));
  }
  return slip;
}

/* ---------- Editor do boletim (Finanças) ---------- */
async function slipLoad(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  const st = t => setText('slipStatus', t);
  const prev = document.getElementById('slipThumbs');
  if (prev) prev.innerHTML = files.map(f => `<img src="${URL.createObjectURL(f)}" alt="boletim">`).join('');
  st('A ler o boletim…');
  try {
    const s = await ocrFiles(files, st);
    slipState = s;
    try { await crossCheckSlip(s, st); } catch (x) { console.warn(x); }
    if (!s.legs.length) slipAddLeg(true);
    st(`Li ${s.legs.length} seleç${s.legs.length === 1 ? 'ão' : 'ões'}${s.declared && s.declared > s.legs.length ? ` de ${s.declared} — carrega também o resto do print` : ''}. Confirma odds e nomes antes da análise.`);
  } catch (e) {
    console.error(e);
    st(/internet|fetch|network|load|carregar/i.test(String(e && e.message)) ? 'Sem internet não consigo ler a imagem. Offline: Galeria → ícone T (extrair texto) → Copiar → cola na caixa acima.' : 'Tropecei a analisar (' + (e && e.message || e) + '). Confirma as seleções abaixo.');
    if (!slipState.legs.length) slipAddLeg(true);
  }
  renderSlipEditor();
  slipCritique();
}
function slipAddLeg(silent) {
  slipState.legs.push({ sel: '', market: '', home: '', away: '', odd: '' });
  if (!silent) renderSlipEditor();
}
function slipDel(i) { slipState.legs.splice(i, 1); renderSlipEditor(); }
function slipSet(i, f, v) { slipState.legs[i][f] = f === 'odd' ? (parseFloat(String(v).replace(',', '.')) || '') : v; updateSlipTotals(); }
function slipProd() { return slipState.legs.reduce((a, l) => a * (Number(l.odd) > 1 ? Number(l.odd) : 1), 1); }
function updateSlipTotals() {
  const prod = slipProd();
  setText('slipProd', prod.toFixed(2));
}
function renderSlipEditor() {
  const ed = document.getElementById('slipEditor');
  if (!ed) return;
  const s = slipState;
  ed.innerHTML = (s.legs.map((l, i) => `<div class="leg">
      <input class="inp lg-m" placeholder="Jogo (Casa vs Fora)" value="${esc(l.home && l.away ? l.home + ' vs ' + l.away : (l.home || ''))}" onchange="slipSetMatch(${i}, this.value)">
      <input class="inp" placeholder="Seleção (ex. Benfica, 1X, Mais de 2.5)" value="${esc(l.sel)}" onchange="slipSet(${i},'sel',this.value)">
      <input class="inp" type="number" inputmode="decimal" step="0.01" placeholder="Odd" value="${l.odd || ''}" ${l.oddDoubt ? 'style="border-color:var(--yellow)" title="Li odds diferentes nas leituras — confirma"' : ''} onchange="slipSet(${i},'odd',this.value); slipState.legs[${i}].oddDoubt=false; this.style.borderColor=''">
      <button class="mini l" onclick="slipDel(${i})" aria-label="Remover">✕</button>
    </div>`).join('') || '<div class="muted">Sem seleções.</div>') +
    `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-top:10px;">
      <label class="lbl">Odd total<input class="inp" id="slipTotal" type="number" inputmode="decimal" step="0.01" value="${s.totalOdd || ''}" placeholder="auto" style="width:96px;" onchange="slipState.totalOdd=parseFloat(this.value)||null"></label>
      <label class="lbl">Bónus %<input class="inp" type="number" inputmode="decimal" step="0.5" value="${s.boost || ''}" placeholder="0" style="width:74px;" onchange="slipState.boost=parseFloat(this.value)||0"></label>
      <label class="lbl">Valor €<input class="inp" id="slipStake" type="number" inputmode="decimal" step="0.1" value="${s.stake || ''}" placeholder="ex. 1" style="width:86px;" onchange="slipState.stake=parseFloat(this.value)||null"></label>
      <div class="muted" style="font-size:.76rem;padding-bottom:8px;">produto das odds: <b id="slipProd" style="color:var(--text)">${slipProd().toFixed(2)}</b></div>
    </div>
    <div class="btn-row" style="margin:10px 0 0;">
      <button class="btn btn-lime" onclick="slipCritique()">🤖 Zé, o que achas?</button>
      <button class="btn" onclick="slipAddLeg()">+ Seleção</button>
      <button class="btn btn-primary" onclick="slipRegistar()">Registar na minha banca</button>
    </div>`;
}
function slipSetMatch(i, v) {
  const parts = String(v).split(/\s+(?:vs|x|-|–)\s+/i);
  slipState.legs[i].home = (parts[0] || '').trim();
  slipState.legs[i].away = (parts[1] || '').trim();
}

/** A crítica do Zé a um boletim */
function zeCritiqueSlip(slip, bankAvail) {
  const legs = (slip.legs || []).filter(l => Number(l.odd) > 1);
  if (!legs.length) return { html: 'Não encontrei odds neste boletim. Mete-as no editor (Finanças) ou escreve tipo <em>Benfica 1.16, Atalanta 1.53</em>.', mood: 'pensativo', ok: false };
  const ev = legs.map(l => { const e = legEval(l); return { ...l, ...e, legEV: e.p != null ? e.p * l.odd - 1 : null }; });
  const n = ev.length;
  const prod = ev.reduce((a, l) => a * Number(l.odd), 1);
  const mismatch = slip.totalOdd > 1 && Math.abs(slip.totalOdd / prod - 1) > 0.03;
  const totalOdd = slip.totalOdd > 1 && !mismatch ? slip.totalOdd : prod;
  const boost = Number(slip.boost) || 0;
  const payout = 1 + (totalOdd - 1) * (1 + boost / 100);
  const P = ev.reduce((a, l) => a * (l.p != null ? l.p : (1 / l.odd) / 1.055), 1);
  const EV = P * payout - 1;
  const oneIn = P > 0 ? Math.round(1 / P) : Infinity;
  const fairTotal = 1 / P;
  const sorted = [...ev].filter(l => l.legEV != null).sort((a, b) => a.legEV - b.legEV);
  const weakest = sorted[0];
  const keep = ev.filter(l => l.legEV != null && l.legEV >= 0);
  const zeVersion = keep.length ? keep : (sorted.length ? [sorted[sorted.length - 1]] : []);
  const zvOdd = zeVersion.reduce((a, l) => a * l.odd, 1), zvP = zeVersion.reduce((a, l) => a * l.p, 1), zvEV = zvP * zvOdd - 1;
  const kelly = EV > 0 ? Math.min(0.05, (P * payout - 1) / (payout - 1) * 0.25) : 0;
  const modelled = ev.filter(l => /modelo/.test(l.src)).length;

  const lines = [];
  if (mismatch || (slip.declared && slip.declared > n)) lines.push(`⚠️ <b>Faltam seleções:</b> ${slip.declared ? `o boletim diz ${slip.declared}, li ${n}` : `li ${n}`}${mismatch ? ` e a odd total do print (${Number(slip.totalOdd).toFixed(2)}) não bate com estas (${prod.toFixed(2)})` : ''}. Analiso só o que li — manda o resto (ou junta os dois prints).`);
  if (n >= 6) lines.push(`🎰 <b>Boletim louco:</b> ${n} seleções. Precisas de acertar <b>todas</b>. Mesmo que cada uma fosse 70%, davas ${(Math.pow(0.7, n) * 100).toFixed(1)}%.`);
  else if (n >= 3) lines.push(`🎲 ${n} seleções: cada perna extra multiplica a margem da casa.`);
  lines.push(`Probabilidade real estimada: <b>${pct(P)}</b> — ganhas <b>1 em cada ${oneIn > 100000 ? '100000+' : oneIn.toLocaleString('pt-PT')}</b> vezes. A odd justa seria <b>${fairTotal > 9999 ? '9999+' : fairTotal.toFixed(2)}</b>; pagam-te <b>${payout.toFixed(2)}</b>${boost ? ` (com bónus ${boost}%)` : ''}.`);
  if (EV >= 0.03) lines.push(`💚 Até tem valor (<b>+${(EV * 100).toFixed(1)}%</b>). Não te habitues.`);
  else if (EV > -0.06) lines.push(`😐 Valor esperado <b>${(EV * 100).toFixed(1)}%</b> — praticamente o imposto da casa.`);
  else lines.push(`💸 Valor esperado <b>${(EV * 100).toFixed(1)}%</b>: por cada 10 € que metes assim, a casa fica com ~${Math.abs(EV * 10).toFixed(2)} € a longo prazo.`);
  ev.filter(l => l.odd >= 4).forEach(l => lines.push(`🎟️ <b>${esc(l.sel)}</b> @ ${l.odd}: é uma lotaria dentro do boletim (${pct(l.p)}).`));
  ev.filter(l => l.legEV != null && l.legEV > 0.04 && /modelo/.test(l.src)).forEach(l => lines.push(`👍 Gosto de <b>${esc(l.sel)}</b>: modelo dá ${pct(l.p)} (justa ${fairOdd(l.p)}) e pagam ${l.odd}.`));
  if (weakest && weakest.legEV < -0.04) lines.push(`✂️ A perna mais fraca é <b>${esc(weakest.sel)}</b> (valor ${(weakest.legEV * 100).toFixed(0)}%). Cortava.`);
  ev.filter(l => l.sport === 'nba').length && lines.push('🏀 Basquetebol está fora do meu dossiê — usei só a odd (menos a margem).');
  ev.filter(l => l.m && l.m.aviso).forEach(l => lines.push(`⚠️ ${esc(l.m.home)} vs ${esc(l.m.away)} está marcado como «${esc(l.m.aviso)}» no dossiê.`));
  const sameMatch = {};
  ev.forEach(l => { if (l.m) { const k = l.m.home + l.m.away; sameMatch[k] = (sameMatch[k] || 0) + 1; } });
  if (Object.values(sameMatch).some(v => v > 1)) lines.push('🔗 Tens duas seleções do mesmo jogo: estão correlacionadas, o cálculo é aproximado.');
  slipFormLines(slip).forEach(x => lines.push(x));
  if (slip.appProb) lines.push(`📱 A app diz ${(slip.appProb * 100).toFixed(2)}% de ganhar; eu calculo <b>${pct(P)}</b>. ${P < slip.appProb * 0.85 ? 'Estão a ser otimistas — e é precisamente o que querem que penses.' : P > slip.appProb * 1.15 ? 'Aqui sou eu o otimista.' : 'Batemos certo, mais ou menos.'}`);
  try {
    lineShopLines(ev).forEach(x => lines.splice(Math.min(lines.length, 3), 0, x));
    poolAdd(ev, slip.source || 'Boletim');
    poolSlip(n, payout, P, EV);
  } catch (x) { console.warn('pool', x); }
  if (modelled < n) lines.push(`<span class="muted">Modelo próprio em ${modelled}/${n} seleções; nas outras uso a odd sem a margem (~5,5%). Liga os dados ao vivo em Definições para cobrir mais jogos.</span>`);

  const zv = zeVersion.length && zeVersion.length < n
    ? `<div class="kv"><span>Versão Zé (${zeVersion.length} sel.)</span><b>${zeVersion.map(l => esc(l.sel)).join(' + ')} · odd ${zvOdd.toFixed(2)} · ${pct(zvP)} · valor ${(zvEV * 100).toFixed(1)}%</b></div>` : '';
  const stakeTxt = kelly > 0
    ? `Com ${bankAvail.toFixed(2)} € de banca eu metia no máximo <b>${r2(bankAvail * kelly).toFixed(2)} €</b> (Kelly ¼).`
    : `Pela matemática: <b>0 €</b>. Se for por diversão, máximo 1% da banca = <b>${r2(bankAvail * 0.01).toFixed(2)} €</b>.`;

  const rows = ev.map(l => `<tr>
      <td>${esc(l.home && l.away ? l.home + ' vs ' + l.away : (l.m ? l.m.home + ' vs ' + l.m.away : '—'))}</td>
      <td>${esc(l.sel)}</td><td>${Number(l.odd).toFixed(2)}</td><td>${pct(l.p)}</td><td>${fairOdd(l.p)}</td>
      <td class="${l.legEV > 0.02 ? 'ev-pos' : l.legEV < -0.02 ? 'ev-neg' : ''}">${l.legEV == null ? '—' : (l.legEV * 100).toFixed(0) + '%'}</td>
      <td class="muted" style="font-size:.7rem;">${l.src}</td></tr>`).join('');

  const mood = EV >= 0.03 ? 'feliz' : (n >= 5 || EV < -0.25) ? 'gozao' : EV > -0.08 ? 'pensativo' : 'chateado';
  const html = `<div style="font-weight:800;margin-bottom:6px;">Análise do boletim (${n} seleç${n === 1 ? 'ão' : 'ões'})</div>
    ${lines.map(x => `<div style="margin-bottom:6px;">${x}</div>`).join('')}
    <div style="overflow-x:auto;margin:8px 0;"><table class="mtable"><thead><tr><th>Jogo</th><th>Seleção</th><th>Odd</th><th>Prob.</th><th>Justa</th><th>Valor</th><th>Fonte</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${zv}
    <div class="kv"><span>Stake</span><b>${stakeTxt}</b></div>
    <div style="margin-top:10px;">${parvoHTML(parvoPicks(ev, 3))}</div>`;
  return { html, mood, ok: true, P, EV, payout, n, totalOdd };
}
function slipCritique() {
  const c = zeCritiqueSlip(slipState, loadBank().you);
  setHTML('slipCritique', `<div class="speech" style="margin:12px 0 0;align-items:flex-start;">${zeFace(c.mood, 48)}<div style="flex:1;min-width:0;">${c.html}</div></div>`);
  slipState._crit = c;
}
function slipRegistar() {
  const st = document.getElementById('slipStake');
  const stake = Number(st && st.value) || Number(slipState.stake);
  const c = zeCritiqueSlip(slipState, loadBank().you);
  if (!c.ok) { toast('Sem seleções válidas.'); return; }
  if (!(stake > 0)) { alert('Indica o valor (€) do boletim.'); if (st) st.focus(); return; }
  const legs = slipState.legs.filter(l => Number(l.odd) > 1);
  const match = legs.length > 1 ? `Múltipla ${legs.length} seleções` : (legs[0].home && legs[0].away ? legs[0].home + ' vs ' + legs[0].away : legs[0].sel);
  if (!addBet({
    match, pick: legs.map(l => l.sel).join(' + '), odd: r2(c.payout), stake, source: 'boletim',
    zeCompare: `Zé: ${pct(c.P)} (1 em ${Math.round(1 / c.P)}) · valor ${(c.EV * 100).toFixed(1)}%`
  }, 'you')) return;
  renderBanca();
  toast('📥 Boletim registado na tua banca.');
}

/* ---------- Boletim no chat do Zé ---------- */
async function zeChatSlip(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  const log = document.getElementById('chatLog');
  const div = document.createElement('div');
  div.className = 'cmsg user';
  div.innerHTML = `<div class="bubble"><div class="slip-thumbs">${files.map(f => `<img src="${URL.createObjectURL(f)}" alt="boletim">`).join('')}</div>Vou assim. Que achas?</div>${humanFace(30)}`;
  log.appendChild(div);
  addChat('bot', '<span id="zeOcrStatus">A ler o boletim… 🧐</span>', 'pensativo');
  log.scrollTop = log.scrollHeight;
  try {
    const s = await ocrFiles(files, t => setText('zeOcrStatus', t));
    slipState = s;
    try { await crossCheckSlip(s, t => setText('zeOcrStatus', t)); } catch (x) { console.warn(x); }
    const c = zeCritiqueSlip(s, loadBank().you);
    const miss = s.declared && s.declared > s.legs.length ? `<div class="muted" style="margin-bottom:6px;">Li ${s.legs.length} de ${s.declared} seleções — manda o resto do print ou corrige no editor.</div>` : '';
    addChat('bot', miss + c.html + `<div class="btn-row" style="margin:8px 0 0;"><button class="btn btn-sm" onclick="fmGo('banca');renderSlipEditor();slipCritique();setTimeout(()=>document.getElementById('boletimPanel').scrollIntoView({behavior:'smooth'}),80)">✏️ Corrigir / registar</button></div>`, c.mood);
  } catch (e) {
    console.error(e);
    const net = /internet|fetch|network|load|carregar/i.test(String(e && e.message));
    addChat('bot', ocrErrorHTML(e, (typeof groups !== 'undefined' && groups) || (typeof slipState !== 'undefined' ? slipState : null)), 'chateado');
    if (!net && slipState && slipState.legs && slipState.legs.length) { try { renderSlipEditor(); } catch (x) {} }
  }
  const inp = document.getElementById('zeSlipFile'); if (inp) inp.value = '';
}

/* enviarChat → ver newjs3 (conversa) */

/* ======================= DADOS AO VIVO ======================= */
const LIVE_KEY = 'ze_live_v1', LIVE_CFG = 'ze_live_cfg_v1';
const FD_COMPS = { PPL: 'Liga Portugal', PL: 'Premier League', ELC: 'Championship', SA: 'Serie A', BL1: 'Bundesliga', PD: 'La Liga', DED: 'Eredivisie', FL1: 'Ligue 1', CL: 'Champions' };
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function isoDay(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

function computeStrengths(standings) {
  const pick = t => (standings || []).find(s => s.type === t);
  const H = pick('HOME'), A = pick('AWAY'), T = pick('TOTAL');
  const rows = s => (s && s.table) || [];
  const S = { h: {}, a: {}, avgH: 1.45, avgA: 1.15, ok: false };
  if (H && A && rows(H).length) {
    let gh = 0, ph = 0, ga = 0, pa = 0;
    rows(H).forEach(r => { gh += r.goalsFor; ph += r.playedGames; });
    rows(A).forEach(r => { ga += r.goalsFor; pa += r.playedGames; });
    if (ph && pa) { S.avgH = gh / ph; S.avgA = ga / pa; }
    const sh = (x, n) => (x * n + 4) / (n + 4);
    rows(H).forEach(r => { const n = r.playedGames || 0; S.h[r.team.id] = { att: sh(n ? (r.goalsFor / n) / S.avgH : 1, n), def: sh(n ? (r.goalsAgainst / n) / S.avgA : 1, n), pts: n ? r.points / n : null }; });
    rows(A).forEach(r => { const n = r.playedGames || 0; S.a[r.team.id] = { att: sh(n ? (r.goalsFor / n) / S.avgA : 1, n), def: sh(n ? (r.goalsAgainst / n) / S.avgH : 1, n), pts: n ? r.points / n : null }; });
    S.ok = true;
  } else if (T && rows(T).length) {
    let g = 0, p = 0;
    rows(T).forEach(r => { g += r.goalsFor; p += r.playedGames; });
    const avg = p ? g / p : 1.35;
    S.avgH = avg * 1.12; S.avgA = avg * 0.9;
    const sh = (x, n) => (x * n + 3) / (n + 3);
    rows(T).forEach(r => { const n = r.playedGames || 0; const v = { att: sh(n ? (r.goalsFor / n) / avg : 1, n), def: sh(n ? (r.goalsAgainst / n) / avg : 1, n), pts: n ? r.points / n : null }; S.h[r.team.id] = v; S.a[r.team.id] = v; });
    S.ok = true;
  }
  return S;
}
function lambdasLive(S, hid, aid) {
  if (!S || !S.ok || !S.h[hid] || !S.a[aid]) return null;
  const lh = Math.min(4, Math.max(0.2, S.avgH * S.h[hid].att * S.a[aid].def));
  const la = Math.min(4, Math.max(0.15, S.avgA * S.a[aid].att * S.h[hid].def));
  return { lh: +lh.toFixed(2), la: +la.toFixed(2), src: 'API casa/fora' };
}
function sameTeams(m, home, away) {
  const t1 = normTxt(home).replace(/\./g, ''), t2 = normTxt(away).replace(/\./g, '');
  return teamScore(m.home, t1) > 0 && teamScore(m.away, t2) > 0;
}
function applyLive(payload) {
  if (!payload || !Array.isArray(payload.matches)) return 0;
  try { rememberTeams(payload); } catch (e) {}
  for (let k = matches.length - 1; k >= 0; k--) if (matches[k].live) matches.splice(k, 1);
  MODEL_CACHE.clear();
  const strengths = {};
  Object.keys(payload.standings || {}).forEach(c => { strengths[c] = computeStrengths(payload.standings[c]); });
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let added = 0;
  payload.matches.forEach(x => {
    if (x && x.status === 'FINISHED' && x.homeTeam && x.awayTeam && x.score && x.score.fullTime && x.score.fullTime.home != null) {
      const done = matches.find(m => !m.live && !m.past && sameTeams(m, x.homeTeam.shortName || x.homeTeam.name, x.awayTeam.shortName || x.awayTeam.name) && Math.abs((parseDayLabel(m.date) || new Date(0)) - new Date(x.utcDate)) < 3 * 864e5);
      if (done) { done.past = true; done.resultado = `${x.score.fullTime.home}-${x.score.fullTime.away}`; done.prob = 'feito'; done.analysis = `JÁ JOGADO (${done.resultado}). ` + done.analysis; }
      return;
    }
    if (!x || !x.homeTeam || !x.awayTeam || !/SCHEDULED|TIMED/.test(x.status || '')) return;
    const d = new Date(x.utcDate);
    const dd = new Date(d); dd.setHours(0, 0, 0, 0);
    const days = Math.round((dd - now) / 864e5);
    if (days < 0 || days > 4) return;
    const comp = (x.competition && x.competition.code) || '';
    const home = x.homeTeam.shortName || x.homeTeam.name, away = x.awayTeam.shortName || x.awayTeam.name;
    const lam = lambdasLive(strengths[comp], x.homeTeam.id, x.awayTeam.id);
    const label = `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`;
    const ex = matches.find(m => !m.live && !m.past && sameTeams(m, home, away));
    if (ex) {
      if (lam) ex.lambdas = lam;
      ex.aviso = null; ex.liveOk = true; ex.espn = { h: String(x.homeTeam.id), a: String(x.awayTeam.id), code: comp, ev: String(x.id || '') };
      ex.kickoff = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      return;
    }
    if (!lam) return;
    const mk = marketsFrom(scoreMatrix(lam.lh, lam.la, 10));
    const sh = strengths[comp];
    const hp = sh.h[x.homeTeam.id] && sh.h[x.homeTeam.id].pts, ap = sh.a[x.awayTeam.id] && sh.a[x.awayTeam.id].pts;
    const homeFav = mk['1'] >= mk['2'];
    const best = ['1', '1X', 'O1.5', 'O2.5', 'BTTS', 'U2.5', 'X2', '2'].map(k => ({ k, p: mk[k] })).filter(o => o.p >= 0.55 && o.p <= 0.8).sort((a, b) => b.p - a.p)[0];
    matches.push({
      phase: 'imediato', type: homeFav ? 'best' : 'worst', fav: false, live: true,
      home, away, date: label, league: FD_COMPS[comp] || (x.competition && x.competition.name) || comp,
      h2h: '—', team: homeFav ? home : away,
      stats: `Casa ${hp != null ? hp.toFixed(2) : '?'} pts/j · Fora ${ap != null ? ap.toFixed(2) : '?'} pts/j`,
      prob: '~' + Math.round((best ? best.p : (homeFav ? mk['1'] : mk['2'])) * 100) + '%',   // a % é a da aposta sugerida (antes mostrava a do favorito)
      analysis: `Modelo com tabelas casa/fora reais: golos esperados ${lam.lh.toFixed(2)}–${lam.la.toFixed(2)}. 1 ${pct(mk['1'])} · X ${pct(mk['X'])} · 2 ${pct(mk['2'])} · Over 2.5 ${pct(mk['O2.5'])} · BTTS ${pct(mk['BTTS'])}.`,
      note: 'Gerado automaticamente pela API — não é escolha do estudo.',
      risk: lam.lh - lam.la > 1.6, lambdas: lam, espn: { h: String(x.homeTeam.id), a: String(x.awayTeam.id), code: comp, ev: String(x.id || '') },
      bet: best ? `${marketName(best.k, { home, away })} (${pct(best.p)}, justa ${fairOdd(best.p)})` : 'Sem mercado claro — só com valor',
      kickoff: d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    });
    added++;
  });
  return added;
}
async function liveRefresh() {
  const cfg = lsGet(LIVE_CFG, {});
  const st = t => setHTML('liveStatus', t);
  st('⏳ A buscar jogos e classificações…');
  let payload;
  try {
    if (cfg.token) {
      const H = { headers: { 'X-Auth-Token': cfg.token } };
      const from = new Date(), to = new Date(Date.now() + 4 * 864e5);
      const mr = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${isoDay(from)}&dateTo=${isoDay(to)}`, H);
      if (!mr.ok) throw new Error('HTTP ' + mr.status + (mr.status === 403 ? ' (token sem acesso)' : mr.status === 429 ? ' (limite de pedidos — espera 1 min)' : ''));
      const mj = await mr.json();
      const codes = [...new Set((mj.matches || []).map(x => x.competition && x.competition.code))].filter(c => FD_COMPS[c]);
      const standings = {};
      for (const c of codes) {
        st(`⏳ Classificação ${FD_COMPS[c]}…`);
        const sr = await fetch(`https://api.football-data.org/v4/competitions/${c}/standings`, H);
        if (sr.ok) standings[c] = (await sr.json()).standings;
      }
      payload = { generatedAt: new Date().toISOString(), matches: mj.matches || [], standings };
    } else {
      st('Cola primeiro o token do football-data.org (opcional — sem ele o Zé usa o dossiê).');
      return;
    }
  } catch (e) {
    const cors = e && e.name === 'TypeError';
    st(`❌ ${esc(e.message)}${cors ? ' — sem rede, ou o browser bloqueou o pedido. Sem problema: o Zé continua offline com o dossiê' + (lsGet(LIVE_KEY, null) ? ' e com os últimos dados guardados' : '') + '.' : ''}`);
    return;
  }
  lsSet(LIVE_KEY, payload);
  const n = applyLive(payload);
  st(`✅ ${payload.matches.length} jogos lidos · ${n} novos no radar · ${Object.keys(payload.standings || {}).length} classificações · ${new Date(payload.generatedAt || Date.now()).toLocaleString('pt-PT')}`);
  renderCalendar(); renderPortal();
}
function liveSaveCfg() {
  const cfg = { token: (document.getElementById('cfgToken').value || '').trim() };
  lsSet(LIVE_CFG, cfg);
  toast('💾 Configuração guardada neste telemóvel.');
}
function liveBoot() {
  const p = lsGet(LIVE_KEY, null);
  if (p && p.generatedAt && Date.now() - new Date(p.generatedAt).getTime() < 3 * 864e5) applyLive(p);
}

/* ======================= DEFINIÇÕES ======================= */
function renderConfig() {
  if (!document.getElementById('cfgStartYou')) return;
  renderProfileCfg();
  const b = loadBank();
  const cfg = lsGet(LIVE_CFG, {});
  document.getElementById('cfgStartYou').value = b.startYou;
  document.getElementById('cfgStartZe').value = b.startZe;
  document.getElementById('cfgToken').value = cfg.token || '';
  { const p = lsGet(LIVE_KEY, null); setHTML('liveCache', p && p.generatedAt ? `💾 Dados guardados de ${new Date(p.generatedAt).toLocaleString('pt-PT')} · ${(p.matches || []).length} jogos${Date.now() - new Date(p.generatedAt).getTime() > 3 * 864e5 ? ' · <b>antigos</b> (já não uso)' : ' · em uso offline'}` : 'Sem dados guardados — o Zé usa só o dossiê.'); }
  setHTML('cfgSeasonNow', `Época <b>${b.season}</b> desde ${new Date(b.seasonStart).toLocaleDateString('pt-PT')} · Tu começaste com <b>${b.startYou.toFixed(2)} €</b> · Zé com <b>${b.startZe.toFixed(2)} €</b>`);
  setHTML('cfgSeasons', b.seasons.length ? b.seasons.map(s => `<div class="bet">
      ${s.winner === 'ze' ? zeFace('gozao', 32) : s.winner === 'you' ? humanFace(32) : zeFace('neutro', 32)}
      <div style="flex:1;"><div class="bm">Época ${s.n} · ${s.winner === 'ze' ? 'ganhou o Zé' : s.winner === 'you' ? 'ganhaste tu' : 'empate'}</div>
      <div class="bp">${esc(pname())} ${s.startYou.toFixed(2)} → ${s.you.toFixed(2)} € (${(s.roiYou * 100).toFixed(1)}%) · Zé ${s.startZe.toFixed(2)} → ${s.ze.toFixed(2)} € (${(s.roiZe * 100).toFixed(1)}%) · ${s.betsYou}/${s.betsZe} apostas${s.passes ? ` · Zé passou ${s.passes}` : ''}</div>
      <div class="bp">${new Date(s.from).toLocaleDateString('pt-PT')} – ${new Date(s.to).toLocaleDateString('pt-PT')}</div></div></div>`).join('')
    : '<div class="empty">Ainda não há épocas fechadas.</div>');
  const cal = zeCalib();
  const L = duelLeader(b);
  setHTML('cfgBrain', `
    <div class="kv"><span>Modelo</span><b>Poisson + Dixon-Coles (placares)</b></div>
    <div class="kv"><span>Decisão</span><b>só aposta com valor ≥ ${((0.03 + cal.extraEdge) * 100).toFixed(1)}%</b></div>
    <div class="kv"><span>Stake</span><b>Kelly ¼ · máx. 5% por aposta · 15% em jogo</b></div>
    <div class="kv"><span>Proteção</span><b>drawdown ${pct(zeDrawdown(b))}${zeDrawdown(b) > 0.25 ? ' → modo defensivo' : ''}</b></div>
    <div class="kv"><span>Calibração</span><b>${cal.n >= 6 ? `${cal.n} apostas · previu ${pct(cal.exp)} · acertou ${pct(cal.hit)} · Brier ${cal.brier.toFixed(3)}` : `${cal.n}/6 apostas para calibrar`}</b></div>
    <div class="kv"><span>Apostas recusadas</span><b>${b.zePasses}</b></div>
    <div class="kv"><span>Líder (ROI)</span><b>${L.who === 'ze' ? 'Zé' : L.who === 'you' ? esc(pname()) : 'Empate'} · ${esc(pname())} ${(L.ry * 100).toFixed(1)}% · Zé ${(L.rz * 100).toFixed(1)}%</b></div>`);
}
function exportBackup() {
  const cfg = lsGet(LIVE_CFG, {});
  const data = { app: 'mister-ze', v: 15, at: new Date().toISOString(), bank: loadBank(), track: loadTrack(), inbox: lsGet(INBOX_KEY, null), liveCfg: {}, live: lsGet(LIVE_KEY, null) };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mister-ze-backup-${isoDay(new Date())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('💾 Backup descarregado.');
}
function importBackup(file) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      if (!d || d.app !== 'mister-ze' || !d.bank) throw new Error('ficheiro não é um backup do Mister Zé');
      if (!confirm('Substituir as bancas e o histórico deste telemóvel pelo backup de ' + new Date(d.at).toLocaleString('pt-PT') + '?')) return;
      saveBank(d.bank); if (d.track) saveTrack(d.track); if (d.inbox) lsSet(INBOX_KEY, d.inbox); if (d.live) { lsSet(LIVE_KEY, d.live); applyLive(d.live); }
      renderBanca(); renderConfig(); toast('✅ Backup importado.');
    } catch (e) { alert('Não consegui importar: ' + e.message); }
  };
  fr.readAsText(file);
}

/* ---------- Blocos de modelo para cartão / Match Day ---------- */
function modelBlock(m) {
  const r = modelo(m);
  const ks = [['1', '1'], ['X', 'X'], ['2', '2'], ['1X', '1X'], ['O1.5', 'Over 1.5'], ['O2.5', 'Over 2.5'], ['O3.5', 'Over 3.5'], ['BTTS', 'Ambas']];
  return `<div class="zbox" style="margin:12px 0;">
    <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--lime);font-weight:800;margin-bottom:6px;">🧠 Modelo do Zé · golos esperados ${r.lh.toFixed(2)}–${r.la.toFixed(2)} <span class="muted" style="text-transform:none;letter-spacing:0;">(${r.src})</span></div>
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;">${ks.map(([k, l]) => `<div style="background:var(--card);border:1px solid var(--border);border-radius:6px;padding:6px;text-align:center;"><div class="muted" style="font-size:.64rem;">${l}</div><div style="font-weight:800;">${pct(r.mk[k])}</div><div class="muted" style="font-size:.66rem;">justa ${fairOdd(r.mk[k])}</div></div>`).join('')}</div>
    <div style="margin-top:8px;font-size:.8rem;">Placares mais prováveis: ${r.mk.cs.slice(0, 4).map(c => `<b>${c.s}</b> ${pct(c.p)}`).join(' · ')}</div>
    ${m.past ? '' : `<button class="btn btn-lime btn-sm" style="margin-top:8px;" onclick="closeModal();prepararDuelo(${matchIndex(m)})">⚔️ Duelo neste jogo</button>`}
  </div>`;
}
function modelLine(m) {
  const r = modelo(m);
  return `<div style="margin-top:8px;padding:8px 10px;background:rgba(200,245,60,.08);border-radius:8px;font-size:.82rem;"><strong style="color:var(--lime)">🧠 Modelo:</strong> 1 ${pct(r.mk['1'])} · X ${pct(r.mk['X'])} · 2 ${pct(r.mk['2'])} · O2.5 ${pct(r.mk['O2.5'])} · Ambas ${pct(r.mk['BTTS'])} · placar ${r.mk.cs[0].s} <span class="muted">(xG ${r.lh.toFixed(2)}–${r.la.toFixed(2)})</span></div>`;
}



/* ---------- Boletim colado (offline: Galeria → extrair texto) ---------- */
async function slipFromPaste() {
  const ta = document.getElementById('slipPaste');
  const txt = (ta && ta.value || '').trim();
  if (!txt) { toast('Cola primeiro o texto do boletim.'); return; }
  const s = /\n/.test(txt) ? parseAny(txt) : parseSlipText(txt);
  s.source = detectSource(txt) === 'Boletim' ? 'Texto colado' : detectSource(txt);
  if (!s.legs.length) { toast('Não encontrei seleções com odd nesse texto.'); return; }
  setText('slipStatus', '🌐 A cruzar com dados online…');
  await crossCheckSlip(s, t => setText('slipStatus', t));
  slipState = s;
  setText('slipStatus', `Li ${s.legs.length} seleç${s.legs.length === 1 ? 'ão' : 'ões'}${s.declared && s.declared > s.legs.length ? ` de ${s.declared} — cola também o resto` : ''}. Confirma e vê a análise.`);
  renderSlipEditor();
  slipCritique();
}

/** Botão «Jogos reais»: só vai à internet quando carregas */
async function atualizarJogos() {
  const cfg = lsGet(LIVE_CFG, {});
  if (!cfg.token) {
    fmGo('config');
    toast('Cola o token do football-data.org e carrega em «Atualizar agora».');
    setTimeout(() => { const t = document.getElementById('cfgToken'); if (t) t.focus(); }, 120);
    return;
  }
  toast('📡 A buscar jogos reais…');
  await liveRefresh();
  const st = document.getElementById('liveStatus');
  toast(st ? st.innerHTML : 'Feito.');
  if (currentView === 'config') renderConfig();
}
