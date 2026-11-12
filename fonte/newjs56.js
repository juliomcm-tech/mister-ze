/* =====================================================================
   v61 · 🤖 Zé em piloto automático
   O Zé aposta sozinho, numa carteira própria (separada do duelo), só nas melhores oportunidades do dia:
   - só 🥇 Selo de ouro (opcional: também apostas de valor), com odd real da casa;
   - no máximo N por dia; nunca duas no mesmo jogo;
   - valor decidido pela gestão de banca do Zé: Kelly ¼ (teto 5%) com valor, 1% sem valor,
     e nunca mais de 15% da carteira em jogo;
   - confere sozinho com os resultados; banca a crescer → apostas maiores (e o contrário).
   Corre quando a app está aberta (uma PWA não corre com o telemóvel fechado): ao abrir, ao Atualizar
   e de 15 em 15 min. Nunca aposta em jogos que já começaram.
   ===================================================================== */
const AUTO_KEY = 'ze_auto_v1';
/* três estratégias a correr lado a lado (cada uma com carteira própria) — no fim vemos qual cresce */
const AUTO_W = {
  ouro:  { key: 'ze_auto_v1',       name: '🥇 Rigoroso', desc: 'só Selo de ouro',                  perDay: 2, ok: c => c.selo && c.selo.grade === 'ouro' },
  valor: { key: 'ze_auto_valor_v1', name: '⚖️ Equilibrado', desc: 'ouro + apostas de valor',        perDay: 3, ok: c => (c.selo && c.selo.grade === 'ouro') || c.cat === 'valor' },
  todos: { key: 'ze_auto_todos_v1', name: '🎯 Desafios', desc: 'os melhores desafios do dia',       perDay: 4, ok: c => true }
};
function autoLoad(w) {
  w = w || 'ouro'; const W = AUTO_W[w];
  const a = lsGet(W.key, null) || {};
  const master = w === 'ouro' ? a : (lsGet(AUTO_W.ouro.key, null) || {});
  return Object.assign({ start: 100, bank: 100, bets: [], topups: [], perDay: W.perDay, since: null }, a, { w, on: !!master.on, bets: a.bets || [], topups: a.topups || [] });
}
function autoSave(a) { const w = a.w || 'ouro'; if (a.bets.length > 1500) a.bets = a.bets.slice(0, 1500); const o = Object.assign({}, a); delete o.w; if (w !== 'ouro') delete o.on; lsSet(AUTO_W[w].key, o); }
function autoOpen(a) { return a.bets.filter(x => x.st === 'open'); }
function autoStakeFor(a, p, o) {
  const exp = autoOpen(a).reduce((s, x) => s + x.stake, 0);
  const capLeft = Math.max(0, r2((a.bank + exp) * 0.15 - exp));
  const ev = p * o - 1, k = ev > 0 ? (p * o - 1) / (o - 1) : 0;
  const mn = typeof minStake === 'function' ? minStake() : 0.1;
  let stake = k > 0 ? r2(a.bank * Math.min(0.05, k * 0.25)) : 0, how = k > 0 ? `Kelly ¼ (${(Math.min(0.05, k * 0.25) * 100).toFixed(1)}%)` : '';
  const one = r2(Math.max(mn, a.bank * 0.01));
  if (stake < one) { stake = one; how = '1% (pela probabilidade)'; }
  stake = r2(Math.min(stake, capLeft, a.bank));
  return { stake, how, ev };
}
let AUTO_RUN = false;
function autoCands() {
  const now = Date.now();
  // o mesmo cérebro dos desafios, mas sem esconder os jogos onde o duelo já apostou (o piloto é independente)
  return zeChallengesRaw(36).map(c => { try { return chFixMinOdd(c); } catch (e) { return c; } }).filter(Boolean)
    .filter(c => c.cat === 'valor' || !zeBraked(c.m, c.k2)).map(c => { if (!c.selo) { try { c.selo = zeSelo(c.m, c.k2, c.p, c.odd); } catch (e) { c.selo = { grade: null }; } } return c; })
    .filter(c => c.m.espn && c.m.espn.ev && c.k && c.k.getTime() > now + 10 * 60e3 && c.k.getTime() < now + 30 * 3600e3 && c.odd > 1 && c.odd >= ZE_MIN_ODD)
    .sort((x, y) => ((y.selo && y.selo.grade === 'ouro') - (x.selo && x.selo.grade === 'ouro')) || (y.p - x.p));
}
async function zeAutoRun(force) {
  if (!autoLoad('ouro').on || AUTO_RUN || window.__ZE_LAB) return 0;
  AUTO_RUN = true; let n = 0;
  try {
    const C = autoCands(), today = isoDay(new Date());
    for (const w of Object.keys(AUTO_W)) {
      const a = autoLoad(w); if (!a.since) a.since = new Date().toISOString();
      let left = Math.max(0, (a.perDay || AUTO_W[w].perDay) - a.bets.filter(x => x.day === today).length), nw = 0;
      for (const c of C.filter(AUTO_W[w].ok)) {
        if (!left) break;
        if (a.bets.some(x => x.ev === String(c.m.espn.ev))) continue;     // um por jogo, para sempre
        const s = autoStakeFor(a, c.p, +c.odd);
        if (s.stake < 0.1) break;
        a.bank = r2(a.bank - s.stake);
        a.bets.unshift({ id: Date.now() + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(), day: today, ev: String(c.m.espn.ev), code: c.m.espn.code,
          h: c.m.home, a: c.m.away, lg: c.m.league || '', ko: c.k.getTime(), k: c.k2, label: marketName(c.k2, c.m), p: +c.p.toFixed(3), o: +(+c.odd).toFixed(2), book: c.book || '', od: c.oddDer ? 1 : 0,
          stake: s.stake, how: s.how, evp: +s.ev.toFixed(3), kind: c.selo && c.selo.grade === 'ouro' ? 'ouro' : c.cat === 'valor' ? 'valor' : 'desafio', st: 'open',
          rv: typeof ZE_RULES !== 'undefined' ? ZE_RULES.ver : undefined, f: c.fx && Object.keys(c.fx).length ? c.fx : undefined });
        left--; nw++;
      }
      if (nw || !lsGet(AUTO_W[w].key, null)) autoSave(a);
      n += nw;
    }
    if (n) { try { if (currentView === 'stats') renderZeStats(); if (currentView === 'config') renderConfig(); if (currentView === 'portal') renderPortal(); } catch (e) {} toast(`🤖 Piloto automático: ${n} aposta${n > 1 ? 's' : ''} nova${n > 1 ? 's' : ''} do Zé.`); }
  } catch (e) { console.warn(e); } finally { AUTO_RUN = false; }
  return n;
}
function autoGrade(payload) { let t = 0; Object.keys(AUTO_W).forEach(w => { t += autoGradeW(payload, w); }); return t; }
function autoGradeW(payload, w) {
  const all = (payload && payload.matches) || []; if (!all.length) return 0;
  const a = autoLoad(w); let n = 0;
  a.bets.forEach(x => {
    if (x.st !== 'open') return;
    const e = all.find(z => String(z.id) === String(x.ev)); if (!e) return;
    if (e.status === 'POSTPONED') { x.st = 'void'; a.bank = r2(a.bank + x.stake); x.ret = x.stake; n++; return; }
    if (e.status !== 'FINISHED' || !e.score || !e.score.fullTime || e.score.fullTime.home == null || !MARKET_CONDS[x.k]) return;
    const win = MARKET_CONDS[x.k](e.score.fullTime.home, e.score.fullTime.away);
    x.st = win ? 'win' : 'loss'; x.res = e.score.fullTime.home + '-' + e.score.fullTime.away; x.ret = win ? r2(x.stake * x.o) : 0; a.bank = r2(a.bank + x.ret); n++;
  });
  if (n) autoSave(a);
  return n;
}
function autoClv(x) { try { const g = goldLog().legs[x.ev + '|' + x.k]; if (g && g.cf > 0) return g.cf * x.o - 1; if (g && g.cl > 1) return x.o / g.cl - 1; } catch (e) {} return null; }
function autoStats(a) {
  a = a || autoLoad();
  const dec = a.bets.filter(x => x.st === 'win' || x.st === 'loss'), w = dec.filter(x => x.st === 'win').length;
  const staked = dec.reduce((s, x) => s + x.stake, 0), profit = dec.reduce((s, x) => s + (x.ret || 0) - x.stake, 0);
  const capital = a.start + a.topups.reduce((s, t) => s + t.amount, 0), open = autoOpen(a).reduce((s, x) => s + x.stake, 0);
  const clv = a.bets.map(autoClv).filter(v => v != null);
  return { n: dec.length, w, hit: dec.length ? w / dec.length : null, prom: dec.length ? dec.reduce((s, x) => s + x.p, 0) / dec.length : null, staked, profit, yield: staked ? profit / staked : null,
    capital, value: a.bank + open, roi: capital ? (a.bank + open - capital) / capital : 0, open: autoOpen(a).length, clv: clv.length ? clv.reduce((s, v) => s + v, 0) / clv.length : null, clvN: clv.length,
    days: a.since ? Math.max(1, Math.round((Date.now() - Date.parse(a.since)) / 864e5)) : 0 };
}
applyLive = (function (prev) { return function (payload) { const r = prev.apply(this, arguments); try { autoGrade(payload); } catch (e) {} setTimeout(() => zeAutoRun().catch(() => {}), 14000); return r; }; })(applyLive);
setTimeout(() => zeAutoRun().catch(() => {}), 20000);
if (!/jsdom/i.test(navigator.userAgent || '')) setInterval(() => { try { if (document.visibilityState === 'visible') zeAutoRun().catch(() => {}); } catch (e) {} }, 15 * 60e3);
/* depois de o Zé ir buscar odds aos desafios, o piloto vê logo se há ouro novo */
seloAutoStudy = (function (prev) { return async function () { const n = await prev.apply(this, arguments); if (n) setTimeout(() => zeAutoRun().catch(() => {}), 1500); return n; }; })(seloAutoStudy);

/* ---------- controlos (Definições) ---------- */
function autoToggle(on) {
  const a = autoLoad('ouro');
  a.on = !!on; if (on && !a.since) a.since = new Date().toISOString();
  const o = Object.assign({}, a); delete o.w; lsSet(AUTO_W.ouro.key, o);
  try { renderConfig(); } catch (e) {}
  toast(on ? `🤖 Piloto automático ligado — ${Object.keys(AUTO_W).length} estratégias a correr lado a lado.` : '🤖 Piloto automático desligado (as apostas abertas continuam a ser conferidas).');
  if (on) setTimeout(() => zeAutoRun(true).catch(() => {}), 500);
}
function autoSetPerDay(w, v) { const a = autoLoad(w), n = parseInt(v, 10); if (n >= 1 && n <= 8) { a.perDay = n; autoSave(a); toast('🤖 Guardado.'); } }
function autoReset() {
  const v = parseFloat(String((document.getElementById('autoStart') || {}).value || '').replace(',', '.'));
  const st = v > 0 ? r2(v) : 100;
  if (!confirm(`Recomeçar as ${Object.keys(AUTO_W).length} carteiras do piloto com ${st.toFixed(2)} € cada? O histórico de apostas do piloto é apagado.`)) return;
  const on = autoLoad('ouro').on;
  Object.keys(AUTO_W).forEach(w => { const old = autoLoad(w); const o = { start: st, bank: st, bets: [], topups: [], perDay: old.perDay, since: new Date().toISOString() }; if (w === 'ouro') o.on = on; lsSet(AUTO_W[w].key, o); });
  try { renderConfig(); } catch (e) {}
}
function autoTopUp() {
  const v = parseFloat(String((document.getElementById('autoStart') || {}).value || '').replace(',', '.'));
  if (!(v > 0)) { toast('Mete o montante no campo.'); return; }
  Object.keys(AUTO_W).forEach(w => { const a = autoLoad(w); a.bank = r2(a.bank + v); a.topups.push({ at: new Date().toISOString(), amount: r2(v) }); autoSave(a); });
  try { renderConfig(); } catch (e) {} toast(`💰 As ${Object.keys(AUTO_W).length} carteiras do piloto foram recarregadas: +${v.toFixed(2)} € cada`);
}
let AUTO_ALL_MEMO = null;
function autoAllBets() {
  const v = Object.values(AUTO_W).map(W => (typeof LS_VER !== 'undefined' && LS_VER[W.key]) || 0).join('|');
  if (AUTO_ALL_MEMO && AUTO_ALL_MEMO.v === v && Date.now() - AUTO_ALL_MEMO.t < 30e3) return AUTO_ALL_MEMO.r;
  const r = Object.keys(AUTO_W).flatMap(w => autoLoad(w).bets.map(x => Object.assign({ w }, x)));
  AUTO_ALL_MEMO = { v, t: Date.now(), r }; return r;
}
function autoRowHTML(x) { return `<div class="zst-row"><span style="font-size:.8rem;">${x.st === 'win' ? '✅' : x.st === 'loss' ? '❌' : x.st === 'void' ? '↩️' : '⏳'} ${esc(x.h)}–${esc(x.a)} · ${esc(x.label)}${x.res ? ` · ${esc(x.res)}` : ''} <span class="muted">${AUTO_W[x.w] ? AUTO_W[x.w].name.split(' ')[0] : ''}</span></span><span class="muted" style="font-size:.78rem;">${x.stake.toFixed(2)} € @ ${x.od ? '≈' : ''}${x.o.toFixed(2)} · ${Math.round(x.p * 100)}%</span></div>`; }
function autoTableHTML() {
  return `<div style="overflow-x:auto;"><table class="rx-t"><tr><th>estratégia</th><th>carteira</th><th>ROI</th><th>certas</th><th>retorno</th><th>CLV</th></tr>${Object.keys(AUTO_W).map(w => { const a = autoLoad(w), s = autoStats(a); return `<tr><td><b>${AUTO_W[w].name}</b><br><span class="muted" style="font-size:.7rem;">${AUTO_W[w].desc} · até ${a.perDay}/dia</span></td><td>${s.value.toFixed(2)} €${s.open ? `<br><span class="muted" style="font-size:.7rem;">${s.open} em jogo</span>` : ''}</td><td class="${s.roi >= 0 ? 'rx-pos' : 'rx-neg'}">${s.roi >= 0 ? '+' : ''}${(s.roi * 100).toFixed(1)}%</td><td>${s.n ? `${s.w}/${s.n}` : '—'}</td><td>${s.yield != null ? (s.yield * 100).toFixed(1) + '%' : '—'}</td><td>${s.clv != null ? (s.clv >= 0 ? '+' : '') + (s.clv * 100).toFixed(1) + '%' : '—'}</td></tr>`; }).join('')}</table></div>`;
}
function autoPanelHTML() {
  const a = autoLoad('ouro'), all = autoAllBets().sort((x, y) => Date.parse(y.at) - Date.parse(x.at)), open = all.filter(x => x.st === 'open');
  const days = a.since ? Math.max(1, Math.round((Date.now() - Date.parse(a.since)) / 864e5)) : 0;
  return `<div class="panel" id="autoPanel"><div class="panel-h"><span>🤖 Zé em piloto automático</span><span class="muted">${a.on ? '🟢 ligado' : '⚪ desligado'}</span></div><div class="panel-b">
    <div class="hint" style="margin-bottom:10px;">O Zé aposta <b>sozinho</b>, em carteiras só dele (não mexem no duelo). Correm <b>${Object.keys(AUTO_W).length} estratégias lado a lado</b>, cada uma com a sua carteira virtual: ${Object.keys(AUTO_W).map(w => `<b>${AUTO_W[w].name}</b> (${AUTO_W[w].desc})`).join(', ')}. O valor de cada aposta é sempre o Zé que decide (Kelly ¼ com valor, 1% sem valor, nunca mais de 15% em jogo). Ao fim de umas semanas vemos qual cresce. Corre sempre que abres a app.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
      <button class="btn ${a.on ? '' : 'btn-lime'}" onclick="autoToggle(${a.on ? 'false' : 'true'})">${a.on ? '⏸ Desligar' : '▶ Ligar piloto automático'}</button>
      ${Object.keys(AUTO_W).map(w => `<label class="lbl" style="font-size:.72rem;">${AUTO_W[w].name.split(' ')[0]} por dia<select class="inp" style="width:62px;" onchange="autoSetPerDay('${w}', this.value)">${[1, 2, 3, 4, 5, 6, 8].map(k => `<option ${k === autoLoad(w).perDay ? 'selected' : ''}>${k}</option>`).join('')}</select></label>`).join('')}
    </div>
    ${autoTableHTML()}
    ${open.length ? `<div class="rx-h">Em jogo agora (${open.length})</div>${open.slice(0, 10).map(autoRowHTML).join('')}` : ''}
    ${all.filter(x => x.st !== 'open').length ? `<div class="rx-h">Últimas decididas</div>${all.filter(x => x.st !== 'open').slice(0, 8).map(autoRowHTML).join('')}` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:10px;">
      <label class="lbl">Montante (€)<input id="autoStart" class="inp" type="number" inputmode="decimal" min="1" step="1" placeholder="100" style="width:100px;"></label>
      <button class="btn btn-sm" onclick="autoTopUp()">💰 Recarregar carteiras</button>
      <button class="btn btn-sm" onclick="autoReset()">🔄 Recomeçar</button>
    </div>
    <div class="muted" style="font-size:.72rem;margin-top:6px;">${a.since ? `A correr desde ${new Date(a.since).toLocaleDateString('pt-PT')} (${days} dia${days === 1 ? '' : 's'}).` : ''} Dinheiro virtual. As apostas do piloto aparecem nas caixas dos jogos (🤖), no Início e no Ao vivo.</div>
  </div></div>`;
}
renderConfig = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const grid = document.querySelector('#view-config .cfg-grid'); if (!grid) return r;
      const old = document.getElementById('autoPanel'); const html = autoPanelHTML();
      if (old) old.outerHTML = html; else grid.insertAdjacentHTML('afterbegin', html);
    } catch (e) { console.warn(e); }
    return r;
  };
})(renderConfig);
renderZeStats = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const box = document.getElementById('zeStatsBox'); if (!box) return r;
      const a = autoLoad('ouro'); if (!a.on && !autoAllBets().length) return r;
      box.insertAdjacentHTML('afterbegin', `<div class="panel"><div class="panel-h"><span>🤖 Piloto automático</span><button class="btn btn-sm" onclick="fmGo('config'); setTimeout(()=>{const p=document.getElementById('autoPanel'); if(p) p.scrollIntoView({behavior:'smooth'});},150)">Abrir</button></div><div class="panel-b">${autoTableHTML()}</div></div>`);
    } catch (e) {}
    return r;
  };
})(renderZeStats);
/* apostas do piloto à vista: caixas dos jogos, Início, Ao vivo */
function autoBetsOf(m) { try { const ev = m && m.espn && String(m.espn.ev); if (!ev) return []; return autoAllBets().filter(x => x.ev === ev); } catch (e) { return []; } }
function autoBadge(m) {
  const L = autoBetsOf(m); if (!L.length) return '';
  const byK = {}; L.forEach(x => { (byK[x.label] = byK[x.label] || []).push(x); });
  return `<div class="auto-badge">🤖 Piloto apostou: ${Object.entries(byK).map(([lab, X]) => `<b>${esc(lab)}</b> @ ${X[0].od ? '≈' : ''}${X[0].o.toFixed(2)} (${X.map(x => AUTO_W[x.w].name.split(' ')[0]).join('')}) ${X[0].st === 'win' ? '✅' : X[0].st === 'loss' ? '❌' : X[0].st === 'void' ? '↩️' : '⏳'}`).join(' · ')}</div>`;
}
zeLogText = (function (prev) { return function () { let t = prev.apply(this, arguments); try { const parts = Object.keys(AUTO_W).map(w => { const a = autoLoad(w), s = autoStats(a); return a.bets.length ? `${w} ${s.value.toFixed(0)}/${s.capital.toFixed(0)} ${s.w}/${s.n} y${s.yield != null ? (s.yield * 100).toFixed(0) : '-'} clv${s.clv != null ? (s.clv * 100).toFixed(1) : '-'}` : ''; }).filter(Boolean); if (parts.length) t = t.replace(/\n(erros:)/, `\npiloto ${autoLoad('ouro').on ? 'on' : 'off'}: ${parts.join(' · ')}\n$1`); } catch (e) {} return t; }; })(zeLogText);
zeTalk = (function (prev) {
  return function (q0) {
    try {
      const q = normTxt(String(q0 || ''));
      if (/piloto|sozinho|autonom|automatic/.test(q) && /(ze|tu|apost|como|quanto|carteira|vai)/.test(q)) {
        const a = autoLoad('ouro');
        setTimeout(() => { fmGo('config'); setTimeout(() => { const p = document.getElementById('autoPanel'); if (p) p.scrollIntoView({ behavior: 'smooth' }); }, 150); }, 400);
        const line = Object.keys(AUTO_W).map(w => { const s = autoStats(autoLoad(w)); return `${AUTO_W[w].name}: ${s.value.toFixed(2)} € (${s.roi >= 0 ? '+' : ''}${(s.roi * 100).toFixed(1)}%)${s.open ? `, ${s.open} em jogo` : ''}`; }).join('<br>');
        return { mood: a.on ? 'gozao' : 'pensativo', html: a.on ? `🤖 Piloto automático:<br>${line}` : '🤖 O piloto automático está desligado. Liga-o em Definições e eu aposto sozinho, com várias estratégias lado a lado.' };
      }
    } catch (e) {}
    return prev.apply(this, arguments);
  };
})(zeTalk);
(function () { try { const css = document.createElement('style'); css.textContent = `.auto-badge{font-size:.76rem;margin:6px 0 2px;padding:6px 8px;border-radius:8px;background:rgba(76,149,240,.14);border:1px solid rgba(76,149,240,.45)}.rv-auto{font-size:.7rem;margin-left:2px}`; document.head.appendChild(css); } catch (e) {} })();
