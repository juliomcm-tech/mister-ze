/* =====================================================================
   v64 · ⏱️ só os 90 minutos · ☁️ robô na nuvem
   ===================================================================== */
/* ---------- ⏱️ jogos com prolongamento / penáltis: as casas pagam pelo resultado aos 90 minutos ----------
   A ESPN dá o resultado final com o prolongamento (STATUS_FINAL_AET / STATUS_FINAL_PEN) e a lista de golos
   com o minuto. Guardamos em «fullTime» o resultado aos 90' (é o que conta para as apostas) e à parte o resto. */
function espn90(ev, n) {
  const c = ev.competitions[0], stn = String((((c.status || ev.status || {}).type) || {}).name || '');
  if (!/AET|PEN/i.test(stn)) return;
  const H = c.competitors.find(x => x.homeAway === 'home'), A = c.competitors.find(x => x.homeAway === 'away');
  const fh = n.score.fullTime.home, fa = n.score.fullTime.away;
  const G = (c.details || []).filter(d => d.scoringPlay && !d.shootout);
  const min = d => { const m = /^(\d+)'/.exec((d.clock && d.clock.displayValue) || ''); return m ? +m[1] : (d.clock && d.clock.value != null ? Math.ceil(d.clock.value / 60) : null); };
  const side = (d, flip) => { const t = String(d.team && d.team.id); let s = t === String(H.team.id) ? 'h' : t === String(A.team.id) ? 'a' : null; if (s && flip && d.ownGoal) s = s === 'h' ? 'a' : 'h'; return s; };
  n.score.duration = /PEN/i.test(stn) ? 'PEN' : 'AET';
  if (n.score.duration === 'PEN') n.score.penalties = { home: scoreVal(H.shootoutScore), away: scoreVal(A.shootoutScore) };
  n.score.afterET = { home: fh, away: fa };
  // marcadores: só os dos 90 minutos (os penáltis do desempate nunca contam)
  n.scorers = G.filter(d => !d.ownGoal && (min(d) == null || min(d) <= 90)).flatMap(d => (d.athletesInvolved || []).map(a => a.displayName || a.shortName || '')).filter(Boolean);
  if (fh + fa === 0) return;                                   // 0-0 no fim do prolongamento = 0-0 aos 90'
  let flip = null;
  for (const f of [false, true]) { if (G.filter(d => side(d, f) === 'h').length === fh && G.filter(d => side(d, f) === 'a').length === fa) { flip = f; break; } }
  if (flip === null || G.some(d => min(d) == null)) { n.score.unsure90 = true; return; }   // lista de golos incompleta: fica o resultado final e o aviso
  const R = G.filter(d => min(d) <= 90);
  n.score.fullTime = { home: R.filter(d => side(d, flip) === 'h').length, away: R.filter(d => side(d, flip) === 'a').length };
}
normalizeEspn = (function (prev) {
  return function (ev) {
    const n = prev.apply(this, arguments);
    try { if (n && n.status === 'FINISHED' && n.sport !== 'nba' && n.score.fullTime.home != null) espn90(ev, n); } catch (e) {}
    return n;
  };
})(normalizeEspn);
/* reserva football-data.org: «regularTime» é o resultado aos 90' */
function fix90(payload) {
  try {
    ((payload && payload.matches) || []).forEach(x => {
      const s = x && x.score; if (!s || s.afterET || !s.regularTime || s.regularTime.home == null) return;
      if (/EXTRA|PENALT/i.test(String(s.duration || ''))) { s.afterET = s.fullTime; s.fullTime = { home: s.regularTime.home, away: s.regularTime.away }; }
    });
  } catch (e) {}
  return payload;
}
applyLive = (function (prev) { return function (payload) { fix90(payload); return prev.apply(this, arguments); }; })(applyLive);
settleFromResults = (function (prev) { return function (payload) { fix90(payload); return prev.apply(this, arguments); }; })(settleFromResults);
/** texto curto para mostrar ao lado do resultado: «a.p. 2-1» / «g.p. 5-3» */
function etNote(x) {
  try {
    const s = x && x.score; if (!s || !s.duration) return '';
    const et = s.afterET ? `${s.afterET.home}-${s.afterET.away}` : '';
    if (s.duration === 'PEN') return `g.p.${s.penalties && s.penalties.home != null ? ' ' + s.penalties.home + '-' + s.penalties.away : ''}`;
    return et ? `a.p. ${et}` : 'a.p.';
  } catch (e) { return ''; }
}
function etLabel(x) { const n = etNote(x); return !n ? '' : x.score.unsure90 ? ' · com prolongamento' : ` · aos 90' (${n})`; }

/* =====================================================================
   ☁️ Robô na nuvem
   Um robô (GitHub Actions) corre esta mesma app sem ecrã, de 15 em 15 minutos, e publica:
   - live.json   → jogos, resultados e classificações (o «Atualizar» lê isto em vez de fazer ~20 pedidos à ESPN)
   - piloto.json → o piloto automático a correr 24 h, igual para toda a gente
   - robo.json   → estado da última corrida
   Se o robô estiver parado ou atrasado, tudo funciona como antes (direto à ESPN).
   ===================================================================== */
const ROBO_BASE = 'https://raw.githubusercontent.com/juliomcm-tech/mister-ze/dados/';
const ROBO_CFG_KEY = 'ze_robo_cfg_v1', CLOUD_KEY = 'ze_cloud_piloto_v1', AUTO_MODE_KEY = 'ze_auto_mode_v1';
function roboOn() { try { return !window.__ROBO && !window.__ZE_LAB && !/jsdom/i.test(navigator.userAgent || '') && navigator.onLine !== false && !(lsGet(ROBO_CFG_KEY, {}) || {}).off; } catch (e) { return false; } }
async function roboGet(file, ms) {
  const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), ms || 7000);
  try {
    const r = await fetch(ROBO_BASE + file + '?t=' + Math.floor(Date.now() / 120000), { signal: ctrl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(tm); }
}
const hhmm = t => new Date(t).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

/* ---------- 1) «Atualizar» a partir do robô ---------- */
let ROBO_FEED = null, ROBO_FEED_USED = false, ROBO_BUSY = false, ROBO_APPLIED = null, ROBO_LOUD_AT = 0, ROBO_WHY = '';
function roboFeedOk(P, opts) {
  if (!P || !Array.isArray(P.matches) || !P.matches.length || !P.generatedAt) return 'ficheiro vazio';
  const now = Date.now(), age = now - new Date(P.generatedAt).getTime();
  if (!(age >= -5 * 60e3)) return 'data estranha';
  // há jogos a decorrer (ou a começar)? então os dados têm de ser bem frescos
  const vivo = P.matches.some(x => { if (x.status === 'IN_PLAY' || x.status === 'PAUSED') return true; if (x.status !== 'TIMED') return false; const d = new Date(x.utcDate).getTime() - now; return d < 5 * 60e3 && d > -2.5 * 3600e3; });
  if (age > (vivo ? 16 : 50) * 60e3) return `dados do robô com ${Math.round(age / 60e3)} min${vivo ? ' e há jogos a decorrer' : ''}`;
  if (!opts.quiet && now - ROBO_LOUD_AT < 90e3) return 'pediste outra vez: fui diretamente à ESPN';
  return '';
}
atualizarTudo = (function (prev) {
  return async function (opts) {
    opts = opts || {};
    if (ROBO_BUSY || opts.direto || !roboOn()) return prev.apply(this, arguments);
    ROBO_BUSY = true; let F = null, cd = 0;
    try {
      try { const P = await roboGet('live.json', 7000); ROBO_WHY = roboFeedOk(P, opts); if (!ROBO_WHY) F = P; } catch (e) { ROBO_WHY = 'não consegui ler o ficheiro do robô'; }
      if (F && opts.quiet && ROBO_APPLIED === F.generatedAt) return;          // já tenho exatamente estes dados: nada a fazer
      if (!F) return await prev.apply(this, arguments);
      ROBO_FEED = F;
      try { cd = ESPN_COOLDOWN; ESPN_COOLDOWN = 0; } catch (e) {}              // a pausa da ESPN não interessa: não lhe vamos pedir nada
      const r = await prev.apply(this, arguments);
      try {
        const P2 = lsGet(LIVE_KEY, null);
        if (P2 && Array.isArray(P2.matches) && ROBO_FEED_USED) {
          P2.generatedAt = F.generatedAt; P2.source = 'robô na nuvem'; lsSet(LIVE_KEY, P2); ROBO_APPLIED = F.generatedAt;
          if (!opts.quiet) ROBO_LOUD_AT = Date.now();
          const st = document.getElementById('liveStatus');
          if (st && /✅/.test(st.textContent)) st.insertAdjacentHTML('beforeend', `<br><span class="muted" style="font-size:.8rem;">☁️ Dados do robô na nuvem (${hhmm(F.generatedAt)}). Carrega outra vez em «Atualizar» para ir diretamente à ESPN.</span>`);
          try { renderUpdateInfo(); } catch (e) {}
        }
      } catch (e) {}
      return r;
    } finally {
      ROBO_FEED = null; ROBO_FEED_USED = false; ROBO_BUSY = false;
      try { if (cd) ESPN_COOLDOWN = Math.max(ESPN_COOLDOWN, cd); } catch (e) {}
      setTimeout(() => cloudRefresh().catch(() => {}), 800);
    }
  };
})(atualizarTudo);
fetchLeaguesParallel = (function (prev) {
  return async function (codes, from, to, status) {
    const F = ROBO_FEED; if (!F) return prev.apply(this, arguments);
    status && status('☁️ A ler os dados do robô…');
    const have = new Set((F.robo && F.robo.ligas) || []), miss = (codes || []).filter(c => !have.has(c));
    const all = F.matches.slice(); ROBO_FEED_USED = true;
    let extra = { all: [], ok: 0, lastErr: null, skipped: 0 };
    if (miss.length) { try { extra = await prev.call(this, miss, from, to, status); } catch (e) { extra.lastErr = e; } }   // ligas que o robô não segue (ex.: de uma aposta tua): essas vêm da ESPN
    const ids = new Set(all.map(x => String(x.id)));
    (extra.all || []).forEach(x => { if (!ids.has(String(x.id))) all.push(x); });
    return { all, ok: (codes || []).length - miss.length + (extra.ok || 0) || 1, lastErr: null, skipped: extra.skipped || 0 };
  };
})(fetchLeaguesParallel);
fetchJSON = (function (prev) {
  return function (url) {
    try {
      const F = ROBO_FEED, m = F && /\/soccer\/([a-z0-9._]+)\/standings(?:$|\?)/.exec(String(url));
      if (m && F.standings && F.standings[m[1]]) return Promise.resolve({ __robo: F.standings[m[1]] });
    } catch (e) {}
    return prev.apply(this, arguments);
  };
})(fetchJSON);
espnStandings = (function (prev) { return function (j) { if (j && j.__robo) return j.__robo; return prev.apply(this, arguments); }; })(espnStandings);

/* ---------- 2) piloto na nuvem ---------- */
let CLOUD = null, CLOUD_MODE_SEEN = null, CLOUD_TRIED = false, ROBO_SAUDE = null, AUTO_FORCE_LOCAL = 0, CLOUD_AT = 0;
try { const c = lsGet(CLOUD_KEY, null); if (c && c.carteiras && c.carteiras.ouro) CLOUD = c; } catch (e) {}
function cloudOk() { return !!(CLOUD && CLOUD.carteiras && CLOUD.carteiras.ouro) && roboOn(); }
/* o robô deu sinal de vida nas últimas 3 horas? se não, quem aposta volta a ser o piloto deste telemóvel */
function cloudAlive() { const t = Math.max(CLOUD && CLOUD.at ? Date.parse(CLOUD.at) : 0, ROBO_SAUDE && ROBO_SAUDE.at ? Date.parse(ROBO_SAUDE.at) : 0); return Date.now() - t < 3 * 3600e3; }
function autoMode() { if (AUTO_FORCE_LOCAL || !cloudOk()) return 'local'; if (lsGet(AUTO_MODE_KEY, null) === 'local') return 'local'; return cloudAlive() ? 'nuvem' : 'local'; }
async function cloudRefresh(force) {
  if (!roboOn()) return false;
  if (!force && Date.now() - CLOUD_AT < 4 * 60e3) return false;
  CLOUD_AT = Date.now();
  let ch = false;
  try {
    const [p, s] = await Promise.all([roboGet('piloto.json', 8000).catch(() => null), roboGet('robo.json', 8000).catch(() => null)]);
    CLOUD_TRIED = true;
    if (s && s.at) ROBO_SAUDE = s;
    if (p && p.carteiras && p.carteiras.ouro && (!CLOUD || CLOUD.at !== p.at || CLOUD.parcial)) {
      const was = autoMode(); CLOUD = p; ch = true;
      // cópia pequena para a app arrancar já em modo nuvem (as contas completas chegam uns segundos depois)
      try { const lite = Object.assign({}, p, { parcial: 1, carteiras: {} }); Object.keys(p.carteiras).forEach(w => { lite.carteiras[w] = Object.assign({}, p.carteiras[w], { bets: (p.carteiras[w].bets || []).slice(0, 120) }); }); lsSet(CLOUD_KEY, lite); } catch (e) {}
      if (was !== autoMode() || autoMode() === 'nuvem') cloudRepaint();
    } else if (CLOUD && CLOUD_MODE_SEEN !== autoMode()) cloudRepaint();
    CLOUD_MODE_SEEN = autoMode();
  } catch (e) { CLOUD_TRIED = true; }
  return ch;
}
function cloudRepaint() {
  try { AUTO_ALL_MEMO = null; } catch (e) {}
  try { if (currentView === 'config') renderConfig(); else if (currentView === 'stats') renderZeStats(); else if (currentView === 'portal') renderPortal(); } catch (e) {}
}
function autoModeSet(m) {
  if (m !== 'local' && !cloudAlive()) { lsSet(AUTO_MODE_KEY, 'nuvem'); cloudRepaint(); toast('☁️ O robô na nuvem está parado. Quando voltar, o piloto da nuvem aparece aqui sozinho.'); return; }
  lsSet(AUTO_MODE_KEY, m === 'local' ? 'local' : 'nuvem');
  cloudRepaint();
  toast(m === 'local' ? '📱 A mostrar o piloto deste telemóvel (só corre com a app aberta).' : '☁️ A mostrar o piloto na nuvem (corre 24 h, igual para todos).');
  if (m === 'local') setTimeout(() => { try { zeAutoRun().catch(() => {}); } catch (e) {} }, 800);
}
const _autoLoadLocal = autoLoad;
autoLoad = function (w) {
  w = w || 'ouro';
  if (autoMode() === 'nuvem' && AUTO_W[w]) {
    const c = CLOUD.carteiras[w] || {};
    return Object.assign({ start: 1000, bank: 1000, perDay: AUTO_W[w].perDay, since: CLOUD.desde || null }, c, { w, on: true, cloud: true, bets: c.bets || [], topups: c.topups || [] });
  }
  return _autoLoadLocal(w);
};
autoSave = (function (prev) { return function (a) { if (a && a.cloud) return; return prev.apply(this, arguments); }; })(autoSave);
/* as apostas do piloto do telemóvel que ficaram em aberto continuam a ser conferidas, mesmo a ver a nuvem */
autoGrade = (function (prev) { return function () { AUTO_FORCE_LOCAL++; try { return prev.apply(this, arguments); } finally { AUTO_FORCE_LOCAL--; } }; })(autoGrade);
zeAutoRun = (function (prev) {
  return async function () {
    if (roboOn() && !CLOUD_TRIED) { try { await cloudRefresh(true); } catch (e) {} }
    if (autoMode() === 'nuvem') return 0;                                    // na nuvem quem aposta é o robô
    return prev.apply(this, arguments);
  };
})(zeAutoRun);
autoCatchUp = (function (prev) { return async function () { if (autoMode() === 'nuvem') return 0; return prev.apply(this, arguments); }; })(autoCatchUp);
autoClvFill = (function (prev) { return async function () { if (autoMode() === 'nuvem') return 0; return prev.apply(this, arguments); }; })(autoClvFill);
autoAllBets = (function (prev) {
  let memo = null;
  return function () {
    if (autoMode() !== 'nuvem') return prev.apply(this, arguments);
    if (memo && memo.at === CLOUD.at && memo.p === !!CLOUD.parcial) return memo.r;
    const r = Object.keys(AUTO_W).flatMap(w => autoLoad(w).bets.map(x => Object.assign({ w }, x)));
    memo = { at: CLOUD.at, p: !!CLOUD.parcial, r }; return r;
  };
})(autoAllBets);
['autoToggle', 'autoSetPerDay', 'autoReset', 'autoTopUp'].forEach(fn => {
  const prev = window[fn]; if (typeof prev !== 'function') return;
  window[fn] = function () { if (autoMode() === 'nuvem') { toast('☁️ Na nuvem as carteiras são geridas pelo robô. Para mexer nas tuas, muda para «📱 Neste telemóvel».'); return; } return prev.apply(this, arguments); };
});
function roboAgeTxt(t) { const m = Math.round((Date.now() - new Date(t).getTime()) / 60e3); return m < 1 ? 'agora mesmo' : m < 60 ? `há ${m} min` : m < 48 * 60 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} dias`; }
function roboState() {
  const s = ROBO_SAUDE; if (!s || !s.at) return { i: '⚪', t: 'ainda sem notícias do robô', late: true };
  const m = (Date.now() - new Date(s.at).getTime()) / 60e3;
  if (m > 180) return { i: '🔴', t: `parado ${roboAgeTxt(s.at)} — a app vai diretamente à ESPN, como antes`, late: true };
  if (!s.ok) return { i: '🟡', t: `última corrida ${roboAgeTxt(s.at)}, com falhas na ESPN`, late: m > 45 };
  return { i: m <= 45 ? '🟢' : '🟡', t: `última corrida ${roboAgeTxt(s.at)}${m > 45 ? ' (atrasado)' : ''}`, late: m > 45 };
}
function autoSwitchHTML() {
  const m = autoMode(), b = (k, lab) => `<button class="btn btn-sm ${m === k ? 'btn-lime' : ''}" onclick="autoModeSet('${k}')">${lab}</button>`;
  const dead = !cloudAlive() && lsGet(AUTO_MODE_KEY, null) !== 'local';
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">${b('nuvem', '☁️ Na nuvem')}${b('local', '📱 Neste telemóvel')}</div>${dead ? `<div class="hint" style="margin-bottom:10px;">⚠️ O robô na nuvem está parado${ROBO_SAUDE && ROBO_SAUDE.at ? ` (última corrida ${roboAgeTxt(ROBO_SAUDE.at)})` : ''}. Enquanto não voltar, quem aposta é o piloto deste telemóvel.</div>` : ''}`;
}
autoPanelHTML = (function (prev) {
  return function () {
    if (!cloudOk()) return prev.apply(this, arguments);
    if (autoMode() !== 'nuvem') return prev.apply(this, arguments).replace('<div class="panel-b">', '<div class="panel-b">' + autoSwitchHTML());
    const all = autoAllBets().slice().sort((x, y) => Date.parse(y.at) - Date.parse(x.at)), open = all.filter(x => x.st === 'open'), dec = all.filter(x => x.st !== 'open');
    const rs = roboState(), cap = (CLOUD.carteiras.ouro || {}).start || 1000, n = Object.keys(AUTO_W).filter(w => CLOUD.carteiras[w]).length;
    const days = CLOUD.desde ? Math.max(1, Math.round((Date.now() - Date.parse(CLOUD.desde)) / 864e5)) : 0;
    return `<div class="panel" id="autoPanel"><div class="panel-h"><span>🤖 Zé em piloto automático</span><span class="muted">☁️ na nuvem</span></div><div class="panel-b">
      ${autoSwitchHTML()}
      <div class="hint" style="margin-bottom:10px;">O piloto corre <b>na nuvem, de 15 em 15 minutos, mesmo com o telemóvel desligado</b>, e é igual para toda a gente que usa a app. São <b>${n} estratégias lado a lado</b>, cada uma com ${cap.toFixed(0)} € virtuais: ${Object.keys(AUTO_W).map(w => `<b>${AUTO_W[w].name}</b> (${AUTO_W[w].desc})`).join(', ')}. O valor de cada aposta é sempre o Zé que decide (Kelly ¼ com valor, 1% sem valor, nunca mais de 15% em jogo) e só aposta em jogos que estudou a sério.</div>
      <div class="zst-row" style="margin-bottom:8px;"><span>${rs.i} Robô</span><span class="muted" style="text-align:right;">${esc(rs.t)}</span></div>
      ${autoTableHTML()}
      ${open.length ? `<div class="rx-h">Em jogo agora (${open.length})</div>${open.slice(0, 12).map(autoRowHTML).join('')}` : ''}
      ${dec.length ? `<div class="rx-h">Últimas decididas</div>${dec.slice(0, 8).map(autoRowHTML).join('')}` : ''}
      ${!all.length ? '<div class="muted" style="font-size:.8rem;margin-top:8px;">Ainda sem apostas: o piloto só aposta a menos de 30 horas do jogo.</div>' : ''}
      <div class="muted" style="font-size:.72rem;margin-top:8px;">${CLOUD.desde ? `A correr desde ${new Date(CLOUD.desde).toLocaleDateString('pt-PT')} (${days} dia${days === 1 ? '' : 's'}). ` : ''}Dinheiro virtual. As apostas do piloto aparecem nas caixas dos jogos (🤖) e no Início.</div>
    </div></div>`;
  };
})(autoPanelHTML);

/* ---------- 3) estado do robô: Definições e Saúde dos dados ---------- */
function roboToggle(on) {
  const c = lsGet(ROBO_CFG_KEY, {}) || {}; c.off = !on; lsSet(ROBO_CFG_KEY, c);
  toast(on ? '☁️ Robô ligado: o «Atualizar» lê os dados da nuvem.' : '☁️ Robô desligado neste telemóvel: tudo vem diretamente da ESPN, como antes.');
  if (on) cloudRefresh(true).catch(() => {}).then(() => { try { renderConfig(); } catch (e) {} });
  try { renderConfig(); } catch (e) {}
}
function roboPanelHTML() {
  const off = !!(lsGet(ROBO_CFG_KEY, {}) || {}).off, s = ROBO_SAUDE, rs = roboState();
  const runs = (s && s.corridas) || [], d24 = runs.filter(r => Date.now() - new Date(r[0]).getTime() < 864e5), bad = d24.filter(r => !r[1]).length;
  return `<div class="panel" id="roboPanel"><div class="panel-h"><span>☁️ Robô na nuvem</span><span class="muted">${off ? '⚪ desligado aqui' : rs.i}</span></div><div class="panel-b">
    <div class="hint" style="margin-bottom:8px;">Um robô vai buscar os jogos, os resultados e as odds de 15 em 15 minutos, mesmo com o telemóvel desligado, e corre o piloto automático. A app lê esses dados em vez de pedir tudo à ESPN — menos «pausas» e tudo mais rápido. Se o robô falhar, a app volta sozinha à ESPN.</div>
    ${off ? '' : `<div class="zst-row"><span>${rs.i} Estado</span><span class="muted" style="text-align:right;">${esc(rs.t)}</span></div>
    ${s ? `<div class="zst-row"><span>Última corrida</span><span class="muted" style="text-align:right;">${s.jogos ? `${s.jogos.porJogar} jogos por jogar · ${s.jogos.resultados} resultados · ${s.jogos.ligas} ligas` : '—'}${s.odds ? ` · odds de ${s.odds.seguidos} jogos` : ''}</span></div>
    ${d24.length ? `<div class="zst-row"><span>Últimas 24 h</span><span class="muted" style="text-align:right;">${d24.length} corrida${d24.length === 1 ? '' : 's'}${bad ? ` · ${bad} com falhas` : ' · todas bem'}</span></div>` : ''}` : ''}
    ${ROBO_WHY && !rs.late ? `<div class="muted" style="font-size:.74rem;margin-top:4px;">No último «Atualizar» fui diretamente à ESPN: ${esc(ROBO_WHY)}.</div>` : ''}`}
    <div style="margin-top:10px;"><button class="btn btn-sm" onclick="roboToggle(${off ? 'true' : 'false'})">${off ? '▶ Voltar a usar o robô' : '⏸ Não usar o robô neste telemóvel'}</button></div>
  </div></div>`;
}
renderConfig = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      if (/jsdom/i.test(navigator.userAgent || '') || window.__ROBO) return r;
      const old = document.getElementById('roboPanel'), html = roboPanelHTML();
      if (old) old.outerHTML = html; else { const ap = document.getElementById('autoPanel'); if (ap) ap.insertAdjacentHTML('afterend', html); }
    } catch (e) { console.warn(e); }
    return r;
  };
})(renderConfig);
zeHealthHTML = (function (prev) {
  return function () {
    let h = prev.apply(this, arguments);
    try { if (roboOn() || ROBO_SAUDE) { const rs = roboState(); h = h.replace('<div class="panel-b">', `<div class="panel-b"><div class="zst-row"><span>${rs.i} Robô na nuvem</span><span class="muted" style="text-align:right;">${esc(rs.t)}</span></div>`); } } catch (e) {}
    return h;
  };
})(zeHealthHTML);
zeLogText = (function (prev) { return function () { let t = prev.apply(this, arguments); try { const s = ROBO_SAUDE; t = t.replace(/\n(erros:)/, `\nrobo: ${roboOn() ? 'on' : 'off'} ${s ? roboAgeTxt(s.at) + (s.ok ? ' ok' : ' falhas') : 'sem dados'} · piloto ${autoMode()}${ROBO_WHY ? ' · ' + ROBO_WHY : ''}\n$1`); } catch (e) {} return t; }; })(zeLogText);
/* arranque: lê já o piloto da nuvem; depois, de 10 em 10 minutos com a app à vista */
if (!/jsdom/i.test(navigator.userAgent || '') && !window.__ROBO) {
  setTimeout(() => cloudRefresh(true).catch(() => {}), 1500);
  setInterval(() => { try { if (document.visibilityState === 'visible') cloudRefresh().catch(() => {}); } catch (e) {} }, 10 * 60e3);
}
try { ZE_RULES.log.push({ ver: ZE_RULES.ver, d: '2026-11-10', txt: 'Sem mudança nas regras de escolha. As apostas passam a ser conferidas pelo resultado aos 90 minutos (como nas casas de apostas) e o piloto passa a correr na nuvem, com carteiras de 1000 € virtuais.' }); } catch (e) {}
