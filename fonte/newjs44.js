/* =====================================================================
   v53 · coerência + boletim seguro + log
   1) «Aposta lógica» igual em todo o lado: vem do modelo atual (com odds), não da tabela crua de quando o jogo entrou
   2) «Verificar» (Análise do dia) com cartões limpos e o texto atualizado
   3) 🛡️ Boletim seguro do Zé: as seleções mais seguras do dia, juntas enquanto o boletim inteiro passa dos 70%
      (cada seleção fica registada para estatística, como análise individual)
   4) 🧪 Log curto para afinar o Zé (números agregados + erros da app), para copiar e colar
   ===================================================================== */
const SAFE_KEY = 'ze_safe_slip_v1', ERR_KEY = 'ze_err_v1';
(function () {
  const css = `
.vc-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px;}
.vc-top{font-size:.76rem;color:var(--muted);margin-bottom:6px;}
.vc-teams{font-weight:800;font-size:1rem;margin-bottom:8px;}
.vc-bet{font-size:.88rem;color:#86efac;background:rgba(74,222,128,.1);border-radius:8px;padding:7px 10px;margin-bottom:8px;}
.vc-btns{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;}
.vc-btns a{font-size:.72rem;padding:8px 4px;background:var(--tile);border:1px solid var(--line2);border-radius:8px;color:var(--text);text-decoration:none;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ss-leg{display:grid;grid-template-columns:26px 1fr auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line);}
.ss-leg:last-child{border-bottom:0}
.ss-leg input[type=checkbox]{width:20px;height:20px;accent-color:var(--lime);}
.ss-leg .od{width:66px;}
.ss-sum{position:sticky;bottom:calc(70px + env(safe-area-inset-bottom));background:var(--panel);border:1px solid var(--lime);border-radius:12px;padding:10px 12px;margin-top:10px;font-size:.88rem;box-shadow:0 6px 16px rgba(0,0,0,.4);}
`;
  try { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); } catch (e) {}
})();

/* ---------- erros da app (só os últimos 15, curtos) ---------- */
(function () {
  const push = (msg) => { try { const L = lsGet(ERR_KEY, []); L.push({ t: Date.now(), v: typeof APP_VER !== 'undefined' ? APP_VER : '?', m: String(msg || '').slice(0, 140) }); while (L.length > 15) L.shift(); lsSet(ERR_KEY, L); } catch (e) {} };
  window.addEventListener('error', e => push(e.message + (e.lineno ? ' @' + e.lineno : '')));
  window.addEventListener('unhandledrejection', e => { const r = e.reason; const m = r && (r.message || r) || ''; if (/abort|Failed to fetch|NetworkError|timeout|HTTP \d/i.test(String(m))) return; push('promise: ' + m); });
})();

/* ---------- 1) aposta lógica do modelo atual ---------- */
const SHORT_K = { '1': '1', 'X': 'X', '2': '2', '1X': '1X', 'X2': 'X2', '12': '12', 'O0.5': '+0.5', 'O1.5': '+1.5', 'O2.5': '+2.5', 'O3.5': '+3.5', 'U2.5': '−2.5', 'U3.5': '−3.5', 'U4.5': '−4.5', 'BTTS': 'Ambas', 'BTTS_N': 'Ambas não' };
function zeLogical(m) {
  try { const b = matchBestMarket(m); if (b) return { k: b.k, p: b.p, short: SHORT_K[b.k] || b.k, label: marketName(b.k, m) }; } catch (e) {}
  try { const r = modelo(m), f = favOf(r.mk); return { k: f, p: r.mk[f], short: f, label: marketName(f, m), fallback: true }; } catch (e) { return null; }
}
deriveBet = (function (prev) {
  return function (m) {
    if (m && m.live && !m.past) {
      const z = zeLogical(m);
      if (z && !z.fallback) { m.prob = '~' + Math.round(z.p * 100) + '%'; return `${z.label} (${pct(z.p)}, justa ${fairOdd(z.p)})`; }
    }
    return prev.apply(this, arguments);
  };
})(deriveBet);
(function () {
  const mn = marketName;
  marketName = function (k, m) {
    const H = m ? m.home : 'Casa', A = m ? m.away : 'Fora';
    const extra = { '12': `${H} ou ${A} (sem empate)`, 'O0.5': 'Mais de 0.5 golos', 'U3.5': 'Menos de 3.5 golos', 'U4.5': 'Menos de 4.5 golos' };
    return extra[k] || mn(k, m);
  };
})();

/* ---------- 2) «Verificar»: cartões limpos ---------- */
verificarAtualizacoes = function () {
  const box = document.getElementById('dayResult'); if (!box) return;
  box.classList.add('show');
  const now = Date.now();
  const list = matches.map((m, i) => ({ m, i, k: kickOf(m) })).filter(x => x.k && !x.m.past && !x.m.aviso && x.k.getTime() > now - 2 * 3600e3 && x.k.getTime() < now + 10 * 864e5).sort((a, b) => a.k - b.k).slice(0, 40);
  const cards = list.map(({ m, i }) => {
    const q = encodeURIComponent(m.home + ' vs ' + m.away), qRef = encodeURIComponent(m.home + ' ' + m.away + ' árbitro nomeado');
    return `<div class="vc-card" data-i="${i}"><div class="vc-top">${esc(m.league || '')} · ${esc(m.date || '')}${m.kickoff ? ' · ' + esc(m.kickoff) : ''}</div>
      <div class="vc-teams" onclick="openMatchIdx(${i})">${esc(m.home)} vs ${esc(m.away)}</div>
      <div class="vc-bet">💡 <b>Aposta lógica:</b> ${deriveBet(m)}</div>
      <div class="vc-btns"><a target="_blank" rel="noopener" href="https://www.google.com/search?q=${qRef}">🔎 Árbitro</a><a target="_blank" rel="noopener" href="https://www.google.com/search?q=${q}+antevisão+OR+preview">📊 Forma</a><a target="_blank" rel="noopener" href="https://www.flashscore.pt/">⚡ Live</a><a target="_blank" rel="noopener" href="https://www.google.com/search?q=meteorologia+${encodeURIComponent(m.home)}">🌤 Meteo</a></div></div>`;
  }).join('');
  box.innerHTML = `<h3>🔄 Verificar antes de apostar</h3>
    <div class="day-meta">${new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })} · ${list.length} jogos dos próximos 10 dias, por dia e hora. A aposta lógica vem do modelo do Zé (com as odds, quando já as tem).</div>
    <div class="hint" style="margin-bottom:12px;">Checklist rápida: árbitro nomeado · lesões de última hora · meteo (chuva/vento). Os onzes saem ~1h antes — o Zé avisa se tiveres aposta aberta.</div>
    ${cards || '<div class="muted">Sem jogos nos próximos dias.</div>'}`;
};

/* ---------- 3) boletim seguro do Zé ---------- */
const SAFE_KEYS = ['1X', 'X2', '12', 'O1.5', 'U3.5', '1', '2'];   // sem «mais de 0.5» e «menos de 4.5»: quase sempre certos mas a odd não existe (1.02–1.05)
const SAFE_MIN_LEG = 0.85, SAFE_MIN_SLIP = 0.70;
function safeCandidates(hours) {
  const now = Date.now();
  return matches.map((m, i) => ({ m, i, k: kickOf(m) })).filter(x => x.m.live && x.m.espn && !x.m.past && !x.m.aviso && x.k && x.k.getTime() > now + 10 * 60e3 && x.k.getTime() < now + (hours || 36) * 3600e3)
    .map(x => {
      let r; try { r = modelo(x.m); } catch (e) { return null; }
      const b = SAFE_KEYS.map(k => ({ k, p: r.mk[k] })).filter(o => o.p != null).sort((a, c) => c.p - a.p)[0];
      if (!b || b.p < 0.8) return null;
      const st = studyFor(x.m), bo = st && st.books && st.books[0] && st.books[0].odds && st.books[0].odds[b.k];
      return { ...x, key: b.k, p: b.p, odd: bo > 1 ? bo : null, est: !(bo > 1) };
    }).filter(Boolean).sort((a, b) => b.p - a.p);
}
let SAFE_CUR = null;
function zeSafeSlip() {
  const box = document.getElementById('dayResult'); if (!box) return;
  box.classList.add('show'); setTimeout(() => { try { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }, 60);
  const C = safeCandidates(36);
  if (!C.length) { box.innerHTML = `<h3>🛡️ Boletim seguro do Zé</h3><div class="muted">Nas próximas 36 horas não há nenhuma seleção com 80% ou mais. Volta mais tarde (ou depois de 📡 Atualizar).</div>${safeStatsHTML()}`; return; }
  let P = 1; const pick = new Set();
  C.forEach((c, i) => { if (c.p >= SAFE_MIN_LEG && (i === 0 || P * c.p >= SAFE_MIN_SLIP)) { P *= c.p; pick.add(i); } });
  if (!pick.size) pick.add(0);
  SAFE_CUR = C;
  box.innerHTML = `<h3>🛡️ Boletim seguro do Zé</h3>
    <div class="day-meta">As seleções mais seguras das próximas 36 horas, sem olhar à odd. O Zé junta-as enquanto o boletim inteiro fica acima de ${Math.round(SAFE_MIN_SLIP * 100)}% (cada uma com pelo menos ${Math.round(SAFE_MIN_LEG * 100)}%). <b>Seguro não é certo</b>: num boletim de 70%, 3 em cada 10 falham.</div>
    <div class="panel"><div class="panel-b" id="ssLegs">${C.map((c, i) => `<div class="ss-leg"><input type="checkbox" ${pick.has(i) ? 'checked' : ''} data-i="${i}" onchange="safeSum()">
      <div><b>${esc(marketName(c.key, c.m))}</b><div class="muted" style="font-size:.78rem;">${esc(c.m.home)} vs ${esc(c.m.away)} · ${esc(c.m.date)} ${esc(c.m.kickoff || '')} · ${esc(c.m.league || '')}</div><div style="font-size:.78rem;">Zé: <b style="color:var(--lime)">${pct(c.p)}</b> · justa ${fairOdd(c.p)}</div></div>
      <input class="inp od" type="number" inputmode="decimal" step="0.01" min="1.01" value="${(c.odd || Math.max(1.01, 0.95 / c.p)).toFixed(2)}" title="${c.est ? 'odd estimada — mete a da tua casa' : 'odd Bet365'}" oninput="safeSum()"></div>`).join('')}</div></div>
    <div class="muted" style="font-size:.76rem;margin-top:4px;">As odds com fundo são estimadas quando a casa ainda não as deu — mete as da tua casa antes de registar.</div>
    <div class="ss-sum" id="ssSum"></div>${safeStatsHTML()}`;
  box.querySelectorAll('#ssLegs .od').forEach((el, i) => { if (C[i].est) el.style.background = 'rgba(255,194,51,.12)'; });
  safeSum();
  safeLogSave(C.filter((_, i) => pick.has(i)));
}
function safeSel() {
  const out = [];
  document.querySelectorAll('#ssLegs .ss-leg').forEach(row => { const cb = row.querySelector('input[type=checkbox]'); if (!cb || !cb.checked) return; const c = SAFE_CUR[+cb.dataset.i]; const od = parseFloat(String(row.querySelector('.od').value).replace(',', '.')) || 0; out.push({ c, od }); });
  return out;
}
function safeSum() {
  const el = document.getElementById('ssSum'); if (!el || !SAFE_CUR) return;
  const S = safeSel(); const P = S.reduce((a, x) => a * x.c.p, 1), O = S.reduce((a, x) => a * (x.od > 1 ? x.od : 1), 1);
  el.innerHTML = S.length ? `<b>${S.length} seleç${S.length === 1 ? 'ão' : 'ões'}</b> · o Zé dá <b style="color:var(--lime)">${pct(P)}</b> ao boletim inteiro · odd ${O.toFixed(2)}
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:8px;"><label class="lbl">Valor (€)<input id="ssStake" class="inp" type="number" inputmode="decimal" min="0.1" step="0.1" placeholder="ex. 2" style="width:90px;"></label>
    <button class="btn btn-primary" onclick="safeRegister(true)">Registar como múltipla</button>${S.length > 1 ? '<button class="btn" onclick="safeRegister(false)">Registar cada uma (simples)</button>' : ''}</div>` : 'Escolhe pelo menos uma seleção.';
}
function safeRegister(multi) {
  const S = safeSel(); if (!S.length) return;
  const stake = parseFloat(String((document.getElementById('ssStake') || {}).value || '').replace(',', '.'));
  if (!(stake > 0)) { toast('Mete o valor primeiro.'); return; }
  if (S.some(x => !(x.od > 1))) { toast('Falta a odd de alguma seleção.'); return; }
  const leg = x => ({ home: x.c.m.home, away: x.c.m.away, sel: marketName(x.c.key, x.c.m), odd: +x.od.toFixed(2), market: x.c.key });
  let n = 0;
  if (multi) { const O = S.reduce((a, x) => a * x.od, 1); if (addBet({ match: S.length === 1 ? `${S[0].c.m.home} vs ${S[0].c.m.away}` : `Boletim seguro do Zé (${S.length} jogos)`, pick: S.length === 1 ? marketName(S[0].c.key, S[0].c.m) : 'Múltipla segura', odd: +O.toFixed(2), stake, legs: S.map(leg), source: 'boletim-seguro' }, 'you')) n = 1; }
  else S.forEach(x => { if (addBet({ match: `${x.c.m.home} vs ${x.c.m.away}`, pick: marketName(x.c.key, x.c.m), odd: +x.od.toFixed(2), stake, legs: [leg(x)], source: 'boletim-seguro' }, 'you')) n++; });
  if (n) { toast(`✅ ${n} aposta${n > 1 ? 's' : ''} registada${n > 1 ? 's' : ''} na tua banca.`); try { renderBanca(); } catch (e) {} }
}
/* registo para estatística: cada seleção do boletim seguro, uma vez por jogo e mercado */
function safeLog() { return lsGet(SAFE_KEY, { legs: {} }); }
function safeLogSave(list) {
  const L = safeLog(); let ch = false;
  list.forEach(c => { const id = c.m.espn.ev + '|' + c.key; if (L.legs[id]) return; L.legs[id] = { ev: c.m.espn.ev, k: c.key, p: +c.p.toFixed(3), h: c.m.home, a: c.m.away, lg: c.m.league, d: Date.now() }; ch = true; });
  const ids = Object.keys(L.legs); if (ids.length > 400) ids.sort((x, y) => L.legs[x].d - L.legs[y].d).slice(0, ids.length - 400).forEach(id => delete L.legs[id]);
  if (ch) lsSet(SAFE_KEY, L);
}
function safeGrade(payload) {
  const fin = ((payload && payload.matches) || []).filter(x => x.status === 'FINISHED' && x.score && x.score.fullTime && x.score.fullTime.home != null);
  if (!fin.length) return 0;
  const L = safeLog(); let n = 0;
  Object.values(L.legs).forEach(l => { if (l.w != null) return; const e = fin.find(x => String(x.id) === String(l.ev)); if (!e || !MARKET_CONDS[l.k]) return; l.w = MARKET_CONDS[l.k](e.score.fullTime.home, e.score.fullTime.away) ? 1 : 0; l.res = e.score.fullTime.home + '-' + e.score.fullTime.away; n++; });
  if (n) lsSet(SAFE_KEY, L);
  return n;
}
function safeStats() {
  const g = Object.values(safeLog().legs).filter(l => l.w != null);
  return g.length ? { n: g.length, w: g.filter(l => l.w).length, p: g.reduce((a, l) => a + l.p, 0) / g.length } : null;
}
function safeStatsHTML() {
  const s = safeStats();
  return `<div class="hint" style="margin-top:12px;">📊 ${s ? `Seleções seguras do Zé já decididas: <b>${s.w} de ${s.n}</b> certas (${Math.round(100 * s.w / s.n)}%; ele prometia ${Math.round(s.p * 100)}%).` : 'Ainda não há seleções seguras decididas — o Zé guarda cada uma e confere quando o jogo acaba.'}</div>`;
}
applyLive = (function (prev) { return function (payload) { const r = prev.apply(this, arguments); try { safeGrade(payload); } catch (e) {} return r; }; })(applyLive);

/* ---------- 4) log curto para afinar o Zé ---------- */
function zeLogText() {
  const L = [], f3 = x => x == null ? '-' : (+x).toFixed(3), pc = x => x == null ? '-' : Math.round(x * 100) + '%';
  L.push(`ZE-LOG ${typeof APP_VER !== 'undefined' ? APP_VER : '?'} · ${new Date().toISOString().slice(0, 16)}`);
  try {
    const D = diaryLoad(), it = Object.values(D.items), g = it.filter(x => x.res && x.g);
    L.push(`diario: ${it.length} previsões · ${g.length} decididas`);
    const pk = g.filter(x => x.g.pick != null && x.pick);
    if (pk.length) {
      L.push(`segura: ${pk.filter(x => x.g.pick).length}/${pk.length} (${pc(pk.filter(x => x.g.pick).length / pk.length)}) prometia ${pc(pk.reduce((a, x) => a + x.pick.p, 0) / pk.length)}`);
      const bins = [[0.55, 0.65], [0.65, 0.75], [0.75, 0.86]].map(([a, b]) => { const s = pk.filter(x => x.pick.p >= a && x.pick.p < b); return s.length ? `${Math.round(a * 100)}-${Math.round(b * 100)}:${s.filter(x => x.g.pick).length}/${s.length}` : null; }).filter(Boolean);
      if (bins.length) L.push('  por faixa ' + bins.join(' '));
      const mk = {}; pk.forEach(x => { const k = x.pick.k; mk[k] = mk[k] || [0, 0]; mk[k][1]++; if (x.g.pick) mk[k][0]++; });
      L.push('  por mercado ' + Object.entries(mk).map(([k, v]) => `${k}:${v[0]}/${v[1]}`).join(' '));
    }
    const fav = g.filter(x => x.g.fav != null); if (fav.length) L.push(`favorito 1X2: ${fav.filter(x => x.g.fav).length}/${fav.length}`);
    const bz = g.filter(x => x.g.bz != null && x.g.bm != null);
    if (bz.length) {
      L.push(`brier ze ${f3(bz.reduce((a, x) => a + x.g.bz, 0) / bz.length)} casas ${f3(bz.reduce((a, x) => a + x.g.bm, 0) / bz.length)} (n${bz.length})`);
      const byC = {}; bz.forEach(x => { const c = x.code || '?'; (byC[c] = byC[c] || []).push(x); });
      L.push('  por liga ' + Object.entries(byC).map(([c, a]) => `${c}:${f3(a.reduce((s, x) => s + x.g.bz, 0) / a.length)}/${f3(a.reduce((s, x) => s + x.g.bm, 0) / a.length)}n${a.length}`).join(' '));
    }
    const byConf = {}; g.filter(x => x.conf && x.g.fav != null).forEach(x => { (byConf[x.conf] = byConf[x.conf] || [0, 0])[1]++; if (x.g.fav) byConf[x.conf][0]++; });
    if (Object.keys(byConf).length) L.push('confiança (favorito) ' + Object.entries(byConf).map(([k, v]) => `${k}:${v[0]}/${v[1]}`).join(' '));
    const vb = g.filter(x => x.g.value != null); if (vb.length) L.push(`valor: ${vb.length} apostas · ROI ${pc(vb.reduce((a, x) => a + x.g.value, 0) / vb.length)}`);
    const o25 = g.filter(x => x.g.o25 != null); if (o25.length) L.push(`+2.5: real ${pc(o25.filter(x => x.g.o25).length / o25.length)} ze ${pc(o25.reduce((a, x) => a + (x.mk['O2.5'] || 0), 0) / o25.length)}`);
    const dr = g.filter(x => x.res); if (dr.length) { const real = dr.filter(x => { const [i, j] = x.res.split('-').map(Number); return i === j; }).length / dr.length; L.push(`empates: real ${pc(real)} ze ${pc(dr.reduce((a, x) => a + (x.mk.X || 0), 0) / dr.length)}`); }
    const miss = g.filter(x => x.g.fav === 0).map(x => { const f = ['1', 'X', '2'].sort((a, b) => x.mk[b] - x.mk[a])[0]; return { x, p: x.mk[f], f }; }).sort((a, b) => b.p - a.p).slice(0, 5);
    if (miss.length) L.push('falhas grandes: ' + miss.map(o => `${o.x.home}-${o.x.away} ${o.f}${Math.round(o.p * 100)} → ${o.x.res}`).join(' | '));
  } catch (e) { L.push('diario: erro ' + e.message); }
  try { const s = safeStats(); if (s) L.push(`boletim seguro: ${s.w}/${s.n} prometia ${pc(s.p)}`); } catch (e) {}
  try {
    const R = typeof raioX === 'function' ? raioX() : null;
    if (R && R.tot.n) L.push(`tu: ${R.tot.n} fechadas · ROI ${pc(R.tot.pr / Math.max(1, R.tot.st))}${R.clv ? ` · CLV ${pc(R.clv.avg)} (n${R.clv.n})` : ''}`);
    const b = loadBank(), zc = b.zeBets.filter(x => x.status === 'win' || x.status === 'loss');
    if (zc.length) { const st = zc.reduce((a, x) => a + (+x.stake || 0), 0), pr = zc.reduce((a, x) => a + (x.status === 'win' ? x.stake * (x.odd - 1) : -x.stake), 0); L.push(`ze duelo: ${zc.length} fechadas · ROI ${pc(pr / Math.max(1e-9, st))}`); }
  } catch (e) {}
  try { const E = lsGet(ERR_KEY, []); if (E.length) L.push('erros: ' + E.slice(-6).map(e => `${new Date(e.t).toISOString().slice(5, 16)} ${e.v} ${e.m}`).join(' | ')); else L.push('erros: nenhum'); } catch (e) {}
  return L.join('\n');
}
function zeLogCopy() {
  const t = zeLogText();
  const done = () => toast('📋 Log copiado — cola-o na conversa com o Claude.');
  try { navigator.clipboard.writeText(t).then(done, () => { prompt('Copia o log:', t); }); } catch (e) { prompt('Copia o log:', t); }
}
renderConfig = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const grid = document.querySelector('#view-config .cfg-grid'); if (!grid) return r;
      let p = document.getElementById('zeLogPanel');
      if (!p) { p = document.createElement('div'); p.className = 'panel'; p.id = 'zeLogPanel'; grid.appendChild(p); }
      const t = zeLogText();
      p.innerHTML = `<div class="panel-h"><span>🧪 Log para afinar o Zé</span><span class="muted">${t.length} letras</span></div><div class="panel-b">
        <div class="hint" style="margin-bottom:8px;">Resumo curto do que o Zé acertou e falhou (sem nomes nem valores teus, só números agregados) e dos últimos erros da app. Copia e cola na conversa quando quiseres afinar o Zé.</div>
        <pre style="white-space:pre-wrap;font-size:.7rem;max-height:180px;overflow:auto;background:var(--bg2);padding:8px;border-radius:8px;margin:0 0 8px;">${esc(t)}</pre>
        <div class="btn-row"><button class="btn btn-primary" onclick="zeLogCopy()">📋 Copiar log</button></div></div>`;
    } catch (e) {}
    return r;
  };
})(renderConfig);
zeTalk = (function (prev) {
  return function (raw, opts) {
    try {
      const q = normTxt(raw);
      if (/^log\b|\blog do ze\b|log para afinar/.test(q)) return { mood: 'pensativo', html: `🧪 Log para afinar:<pre style="white-space:pre-wrap;font-size:.72rem;">${esc(zeLogText())}</pre><button class="btn btn-sm" onclick="zeLogCopy()">📋 Copiar</button>` };
      if (/boletim seguro|mais seguro do dia|aposta mais segura/.test(q)) { setTimeout(() => { fmGo('dia'); zeSafeSlip(); }, 300); return { mood: 'pensativo', html: '🛡️ Vou montar o boletim mais seguro do dia — abre na Análise do dia.' }; }
    } catch (e) {}
    return prev.apply(this, arguments);
  };
})(zeTalk);
