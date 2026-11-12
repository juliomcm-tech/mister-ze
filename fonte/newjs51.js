/* =====================================================================
   v58 · fase 1 (sem custos)
   1) CLV do selo de ouro: perto do apito, o Zé guarda a odd final da casa para cada aposta de ouro.
      CLV = a odd que o selo apanhou vs o preço justo final. CLV positivo de forma consistente é o melhor
      sinal de vantagem real (aparece antes do lucro).
   2) 🩺 Saúde dos dados (nas Estatísticas): ESPN, odds, reserva football-data.org, erros, memória.
   3) Reserva football-data.org: se a ESPN não responder e tiveres o token (grátis) em Definições,
      o Atualizar usa-o para calendário, resultados e tabelas (sem odds nem marcadores).
   ===================================================================== */
function oddsFairProb(o, k) {
  try {
    if (OUT_SET[k] && o['1'] > 1 && o.X > 1 && o['2'] > 1) { const t = 1 / o['1'] + 1 / o.X + 1 / o['2']; return OUT_SET[k].reduce((a, j) => a + (1 / o[j]) / t, 0); }
    const g = /^([OU])(\d+(?:\.\d+)?)$/.exec(k);
    if (g) { const ov = o['O' + g[2]], un = o['U' + g[2]]; if (ov > 1 && un > 1) { const t = 1 / ov + 1 / un; return g[1] === 'O' ? (1 / ov) / t : (1 / un) / t; } }
  } catch (e) {}
  return null;
}
/* o registo do ouro passa a guardar a liga e a hora do jogo (para ir buscar a odd final) */
goldSave = (function (prev) {
  return function (list) {
    const r = prev.apply(this, arguments);
    try {
      const L = goldLog(); let ch = false;
      (list || []).forEach(c => { const id = c.m.espn && c.m.espn.ev + '|' + c.k2, x = id && L.legs[id]; if (!x) return; if (!x.code) { x.code = c.m.espn.code; ch = true; } if (!x.ko && c.k) { x.ko = new Date(c.k).getTime(); ch = true; } });
      if (ch) lsSet(GOLD_KEY, L);
    } catch (e) {}
    return r;
  };
})(goldSave);
let GCLV_RUN = false;
async function goldClvCapture() {
  if (GCLV_RUN || navigator.onLine === false || window.__ZE_LAB) return 0;
  if (typeof espnCooling === 'function' && espnCooling()) return 0;
  const L = goldLog(), now = Date.now();
  const due = Object.entries(L.legs).filter(([, x]) => x.w == null && x.cl == null && x.code && x.ko && now > x.ko - 75 * 60e3 && now < x.ko - 2 * 60e3).slice(0, 6);
  if (!due.length) return 0;
  GCLV_RUN = true; let n = 0;
  try {
    for (const [id, x] of due) {
      try {
        const books = await coreOdds(x.code, x.ev, true);
        const b = books && books[0]; if (!b) continue;
        const L2 = goldLog(), y = L2.legs[id]; if (!y) continue;
        y.cl = b.odds[y.k] > 1 ? +(+b.odds[y.k]).toFixed(2) : null; y.cf = oddsFairProb(b.odds, y.k); y.clAt = Date.now(); y.clBook = b.provider;
        lsSet(GOLD_KEY, L2); n++;
      } catch (e) {}
      await new Promise(r => setTimeout(r, 400));
    }
  } finally { GCLV_RUN = false; }
  return n;
}
function goldClvOf(x) {
  if (!(x.o > 1)) return null;
  if (x.cf > 0) return x.cf * x.o - 1;               // odd apanhada × probabilidade justa final − 1
  if (x.cl > 1) return x.o / x.cl - 1;
  return null;
}
goldStats = (function (prev) {
  return function (from, to) {
    const s = prev.apply(this, arguments);
    try {
      const g = Object.values(goldLog().legs).filter(x => (!from || isoDay(new Date(x.d)) >= from) && (!to || isoDay(new Date(x.d)) <= to)).map(goldClvOf).filter(v => v != null);
      if (s && g.length) { s.clvN = g.length; s.clv = g.reduce((a, v) => a + v, 0) / g.length; s.clvPos = g.filter(v => v > 0).length; }
      else if (!s && g.length) return { n: 0, w: 0, p: 0, no: 0, pr: 0, roi: null, clvN: g.length, clv: g.reduce((a, v) => a + v, 0) / g.length, clvPos: g.filter(v => v > 0).length };
    } catch (e) {}
    return s;
  };
})(goldStats);
renderZeStats = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const [a, b] = zstRange(ZST_PER), s = goldStats(a === '0000' ? null : a, b === '9999' ? null : b);
      const first = document.querySelector('#zeStatsBox .panel .panel-b');
      if (first && s && s.clvN) first.insertAdjacentHTML('afterbegin', `<div class="zst-row"><span>📈 CLV do ouro</span><span><b class="${s.clv >= 0 ? 'rx-pos' : 'rx-neg'}">${s.clv >= 0 ? '+' : ''}${(s.clv * 100).toFixed(1)}%</b> <span class="muted">em ${s.clvN} · ${s.clvPos} acima do preço final</span></span></div>`);
      const box = document.getElementById('zeStatsBox'); if (box) box.insertAdjacentHTML('afterbegin', zeHealthHTML());
    } catch (e) { console.warn(e); }
    return r;
  };
})(renderZeStats);
applyLive = (function (prev) { return function () { const r = prev.apply(this, arguments); setTimeout(() => goldClvCapture().catch(() => {}), 5000); return r; }; })(applyLive);
if (!/jsdom/i.test(navigator.userAgent || '')) setInterval(() => { try { if (document.visibilityState === 'visible') goldClvCapture().catch(() => {}); } catch (e) {} }, 5 * 60e3);
zeLogText = (function (prev) { return function () { let t = prev.apply(this, arguments); try { const s = goldStats(); if (s && s.clvN) t = t.replace(/\n(erros:)/, `\nouro clv: ${(s.clv * 100).toFixed(1)}% n${s.clvN} pos${s.clvPos}\n$1`); } catch (e) {} return t; }; })(zeLogText);

/* ---------- 🩺 saúde dos dados ---------- */
function zeHealth() {
  const H = {};
  try { const P = lsGet(LIVE_KEY, null); H.age = P && P.generatedAt ? Date.now() - new Date(P.generatedAt).getTime() : null; H.src = P && P.source ? P.source : (P && P.matches && P.matches.some(x => /\./.test((x.competition && x.competition.code) || '')) ? 'ESPN' : P ? 'football-data.org' : '—'); } catch (e) {}
  try { H.okAt = typeof ESPN_OK_AT !== 'undefined' ? ESPN_OK_AT : 0; H.cool = typeof espnCooling === 'function' && espnCooling(); H.month = typeof ESPN_RANGE_BAD !== 'undefined' && ESPN_RANGE_BAD; } catch (e) {}
  try { const now = Date.now(); const up = matches.filter(m => m.live && m.espn && !m.past && !m.aviso && kickOf(m) && kickOf(m).getTime() > now && kickOf(m).getTime() < now + 36 * 3600e3); H.up = up.length; H.withOdds = up.filter(m => { const s = studyFor(m); return s && s.books && s.books.length; }).length; } catch (e) {}
  try { H.fdToken = !!(lsGet(LIVE_CFG, {}).token); } catch (e) {}
  try { const E = lsGet(ERR_KEY, []); H.err24 = E.filter(e => Date.now() - e.t < 864e5).length; H.lastErr = E.length ? E[E.length - 1] : null; } catch (e) {}
  try { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += (k.length + (localStorage.getItem(k) || '').length) * 2; } H.bytes = n; } catch (e) {}
  return H;
}
function zeHealthHTML() {
  const H = zeHealth(), ok = '🟢', warn = '🟡', bad = '🔴';
  const ageTxt = H.age == null ? 'nunca' : H.age < 60e3 ? 'agora' : H.age < 3600e3 ? `há ${Math.round(H.age / 60e3)} min` : H.age < 864e5 ? `há ${Math.round(H.age / 3600e3)} h` : `há ${Math.round(H.age / 864e5)} dias`;
  const mb = H.bytes ? H.bytes / 1048576 : 0;
  const rows = [
    [H.age != null && H.age < 3 * 3600e3 ? ok : H.age != null && H.age < 864e5 ? warn : bad, 'Dados', `atualizados ${ageTxt} · fonte ${esc(H.src || '—')}`],
    [H.cool ? bad : H.okAt && Date.now() - H.okAt < 3 * 3600e3 ? ok : warn, 'ESPN', H.cool ? 'pediu uma pausa (volta em ~4 min)' : H.okAt ? `respondeu ${Math.round((Date.now() - H.okAt) / 60e3)} min atrás${H.month ? ' · a pedir mês a mês (a ESPN mudou as regras — já adaptado)' : ''}` : 'ainda não respondeu nesta sessão'],
    [H.up ? (H.withOdds / H.up >= 0.3 ? ok : warn) : warn, 'Odds das casas', H.up ? `${H.withOdds} de ${H.up} jogos das próximas 36 h (o Zé vai buscar as dos desafios sozinho)` : 'sem jogos nas próximas 36 h'],
    [H.fdToken ? ok : warn, 'Reserva', H.fdToken ? 'football-data.org pronta (se a ESPN falhar, uso-a para calendário e tabelas)' : 'sem reserva — põe o token grátis do football-data.org em Definições'],
    [H.err24 ? warn : ok, 'Erros', H.err24 ? `${H.err24} nas últimas 24 h${H.lastErr ? ` · último: ${esc(String(H.lastErr.m || '').slice(0, 60))}` : ''}` : 'nenhum nas últimas 24 h'],
    [mb < 3.5 ? ok : mb < 4.5 ? warn : bad, 'Memória', `${mb.toFixed(1).replace('.', ',')} MB de ~5 MB${mb >= 3.5 ? ' — faz um backup em Definições' : ''}`]
  ];
  return `<div class="panel"><div class="panel-h"><span>🩺 Saúde dos dados</span><button class="btn btn-sm" onclick="fmGo('config'); setTimeout(()=>{const b=document.querySelector('[onclick^=\\'netTest\\']'); if(b) b.scrollIntoView({behavior:'smooth',block:'center'});},150)">Testar ligação</button></div><div class="panel-b">${rows.map(([i, k, v]) => `<div class="zst-row"><span>${i} ${k}</span><span class="muted" style="text-align:right;">${v}</span></div>`).join('')}</div></div>`;
}

/* ---------- reserva football-data.org quando a ESPN falha ---------- */
atualizarTudo = (function (prev) {
  return async function (opts) {
    const before = (() => { try { const P = lsGet(LIVE_KEY, null); return P && P.generatedAt; } catch (e) { return null; } })();
    let r, err = null;
    try { r = await prev.apply(this, arguments); } catch (e) { err = e; }
    try {
      const P = lsGet(LIVE_KEY, null), after = P && P.generatedAt;
      const cfg = lsGet(LIVE_CFG, {});
      if (after === before && cfg.token && navigator.onLine !== false && !window.__ZE_LAB && typeof liveRefresh === 'function') {
        await liveRefresh();
        const P2 = lsGet(LIVE_KEY, null);
        if (P2 && P2.generatedAt !== before) { P2.source = 'football-data.org (reserva)'; lsSet(LIVE_KEY, P2); toast('📡 A ESPN não respondeu — usei a reserva football-data.org (calendário, resultados e tabelas; sem odds).'); }
      }
    } catch (e) {}
    if (err) throw err;
    return r;
  };
})(atualizarTudo);
