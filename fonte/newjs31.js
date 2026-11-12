
/* =====================================================================
   v44 · versão de telemóvel, online
   - boneco do utilizador dentro da bola (os ombros saíam do círculo)
   - odds de verdade: Bet365 + DraftKings (ESPN), com dupla hipótese, over/under e marcadores
   - o Zé compara as odds com o modelo e diz onde há valor; botão «procurar odds outra vez»
   - barra de navegação em baixo no telemóvel (polegar), cabeçalho mais limpo
   ===================================================================== */

/* ---------- 1) boneco dentro da bola ---------- */
let HF_N = 0;
humanFace = (function (prev) {
  return function (size, cls) {
    const u = userProfile();
    if (u.photo) return prev(size, cls);
    size = size || 48;
    const id = 'hfc' + (++HF_N);
    const ini = (u.name || 'TU').trim().split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase() || 'TU';
    return `<svg class="${cls || ''}" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="${esc(u.name || 'Tu')}" style="flex-shrink:0;">
  <defs><clipPath id="${id}"><circle cx="60" cy="60" r="56.5"/></clipPath></defs>
  <circle cx="60" cy="60" r="58" fill="#163a66"/>
  <g clip-path="url(#${id})">
    <circle cx="60" cy="47" r="20" fill="#9fc3ee"/>
    <path d="M14 124 C16 92 38 74 60 74 C82 74 104 92 106 124 Z" fill="#9fc3ee"/>
    <text x="60" y="103" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="17" fill="#163a66">${esc(ini)}</text>
  </g>
  <circle cx="60" cy="60" r="57.5" fill="none" stroke="#5aa9ff" stroke-width="3"/>
</svg>`;
  };
})(humanFace);

/* ---------- 2) odds das casas (ESPN «core»: Bet365 + DraftKings) ---------- */
const ODDS_MEM = new Map();
function fracOdd(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (/^\d+\/\d+$/.test(s)) { const [a, b] = s.split('/').map(Number); return b ? 1 + a / b : null; }
  if (/^evs?$/i.test(s)) return 2;
  const n = parseFloat(s); return n > 1 ? n : null;
}
async function coreOdds(code, ev, force) {
  const key = code + '|' + ev, c = ODDS_MEM.get(key);
  if (!force && c && Date.now() - c.t < 10 * 60e3) return c.books;
  const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 7000);
  let j = null;
  try {
    const r = await fetch(`https://sports.core.api.espn.com/v2/sports/soccer/leagues/${code}/events/${ev}/competitions/${ev}/odds`, { signal: ctrl.signal, cache: 'no-store' });
    j = r.ok ? await r.json() : null;
  } finally { clearTimeout(tm); }
  const books = [];
  ((j && j.items) || []).forEach(it => {
    const name = ((it.provider && it.provider.name) || 'casa').replace(/^Bet 365$/i, 'Bet365');
    if (/live/i.test(name)) return;                      // odds ao vivo mudam a cada minuto: não servem para decidir antes
    const T = (it.bettingOdds && it.bettingOdds.teamOdds) || {};
    const g = k => fracOdd(T[k] && T[k].value);
    const o = {};
    if (Object.keys(T).length) {
      o['1'] = g('preMatchFullTimeResultHome'); o.X = g('preMatchFullTimeResultDraw'); o['2'] = g('preMatchFullTimeResultAway');
      o['1X'] = g('preMatchDoubleChanceHomeOrDraw'); o.X2 = g('preMatchDoubleChanceDrawOrAway'); o['12'] = g('preMatchDoubleChanceHomeOrAway');
      const line = parseFloat(T.preMatchOverUnderHandicap && T.preMatchOverUnderHandicap.value);
      if (line > 0) { o['O' + line] = g('preMatchGoalLineOver'); o['U' + line] = g('preMatchGoalLineUnder'); }
    }
    if (!(o['1'] && o.X && o['2'])) { o['1'] = sideOdd(it.homeTeamOdds); o.X = sideOdd(it.drawOdds); o['2'] = sideOdd(it.awayTeamOdds); }
    const ou = Number(it.overUnder), oo = sideOdd(it.overOdds), uo = sideOdd(it.underOdds);
    if (ou > 0 && oo > 1 && uo > 1 && !o['O' + ou]) { o['O' + ou] = oo; o['U' + ou] = uo; }
    Object.keys(o).forEach(k => { if (!(o[k] > 1)) delete o[k]; else o[k] = +o[k].toFixed(3); });
    if (!(o['1'] && o.X && o['2'])) return;
    const po = (it.bettingOdds && it.bettingOdds.playerOdds) || {};
    const scorers = (po.preMatchAnyTimeGoalScorer || []).map(p => ({ name: p.player, odd: fracOdd(p.value) })).filter(p => p.name && p.odd > 1).sort((a, b) => a.odd - b.odd);
    const bk = { provider: name, odds: o, scorers };
    // v63: abertura/fecho (quando a casa as dá) — para ver se a odd está a fugir e medir o CLV
    try {
      const ml = x => x && x.moneyLine && x.moneyLine.decimal > 1 ? +x.moneyLine.decimal : null, H = it.homeTeamOdds || {}, A = it.awayTeamOdds || {};
      const tot = s2 => it[s2] && it[s2].over && it[s2].under && it[s2].over.decimal > 1 ? { o: +it[s2].over.decimal, u: +it[s2].under.decimal } : null;
      if (H.open || it.open) bk.oc = { line: Number(it.overUnder) || null, oh: ml(H.open), oa: ml(A.open), ch: ml(H.close) || ml(H.current), ca: ml(A.close) || ml(A.current), ot: tot('open'), ct: tot('close') || tot('current') };
    } catch (e) {}
    books.push(bk);
  });
  // Bet365 primeiro (é a referência europeia; a DraftKings é americana)
  books.sort((a, b) => (/365/.test(b.provider) ? 1 : 0) - (/365/.test(a.provider) ? 1 : 0));
  ODDS_MEM.set(key, { t: Date.now(), books });
  return books;
}
function marketFromBook(b) {
  const o = b.odds, s = 1 / o['1'] + 1 / o.X + 1 / o['2'];
  const out = { provider: b.provider, odds: { ...o }, p1: (1 / o['1']) / s, pX: (1 / o.X) / s, p2: (1 / o['2']) / s, margin: s - 1 };
  if (o['O2.5'] && o['U2.5']) { const t = 1 / o['O2.5'] + 1 / o['U2.5']; out.pO25 = (1 / o['O2.5']) / t; }
  // v50: qualquer linha de golos (2.75, 3.5, 3…) — escolhe a mais equilibrada
  let best = null;
  Object.keys(o).forEach(k => { const g = /^O(\d+(?:\.\d+)?)$/.exec(k); if (!g || !(o['U' + g[1]] > 1)) return; const t = 1 / o[k] + 1 / o['U' + g[1]], p = (1 / o[k]) / t; if (!best || Math.abs(p - 0.5) < Math.abs(best.p - 0.5)) best = { line: +g[1], p }; });
  if (best) out.ou = best;
  return out;
}
async function oddsInto(st, m, force) {
  if (!st || !m || !m.espn || !m.espn.ev) return false;
  const books = await coreOdds(m.espn.code, m.espn.ev, force);
  st.oddsTried = Date.now();
  if (!books.length) return false;
  st.books = books;
  st.market = marketFromBook(books[0]);
  st.scorerOdds = (books.find(b => b.scorers.length) || { scorers: [] }).scorers;
  st.scorerBook = (books.find(b => b.scorers.length) || {}).provider || '';
  try { MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear(); } catch (e) {}
  return true;
}
zeStudy = (function (prev) {
  return async function (m, status) {
    const st = await prev.apply(this, arguments);
    try {
      if (st && !st.offline && m.espn && m.espn.ev && !(st.books && st.oddsTried && Date.now() - st.oddsTried < 10 * 60e3)) {
        status && status('💶 Odds das casas (Bet365, DraftKings)…');
        await oddsInto(st, m);
      }
    } catch (e) {}
    return st;
  };
})(zeStudy);

const ODD_KEYS = ['1', 'X', '2', '1X', 'X2', '12', 'O1.5', 'U1.5', 'O2.5', 'U2.5', 'O3.5', 'U3.5'];
const ODD_LBL = k => ({ '1': '1', X: 'X', '2': '2', '1X': '1X', X2: 'X2', '12': '12' })[k] || (k[0] === 'O' ? 'Mais ' : 'Menos ') + k.slice(1);
function nameMatch(a, b) {
  const A = normTxt(a).split(' ').filter(Boolean), B = normTxt(b).split(' ').filter(Boolean);
  if (!A.length || !B.length) return false;
  return A[A.length - 1] === B[B.length - 1] && (A.length === 1 || B.length === 1 || A[0][0] === B[0][0]);
}
/** onde as odds pagam mais do que a probabilidade do Zé */
function oddsValue(m) {
  const st = studyFor(m); if (!st || !st.books || !st.books.length) return [];
  let r; try { r = modelo(m); } catch (e) { return []; }
  const out = [];
  st.books.forEach(b => Object.entries(b.odds).forEach(([k, o]) => { const p = r.mk[k]; if (p == null || !(o > 1)) return; out.push({ k, o, p, ev: p * o - 1, book: b.provider }); }));
  // melhor odd de cada mercado
  const best = {}; out.forEach(x => { if (!best[x.k] || x.o > best[x.k].o) best[x.k] = x; });
  return Object.values(best).sort((a, b) => b.ev - a.ev);
}
function scorerValue(m) {
  const st = studyFor(m); if (!st || !st.scorerOdds || !st.scorerOdds.length) return [];
  const board = st.board || (typeof boardFor === 'function' && boardFor(m));
  const all = board ? board.home.concat(board.away) : [];
  return st.scorerOdds.slice(0, 40).map(s => { const p = all.find(x => nameMatch(x.name, s.name)); return { ...s, p: p ? p.prob : null, team: p ? p.team : '', status: p ? p.status : null, ev: p ? p.prob * s.odd - 1 : null }; });
}
function oddsHTML(m) {
  const st = studyFor(m); if (!st || st.offline) return '';
  if (!st.books || !st.books.length) {
    return `<div class="reason" style="margin-top:8px;"><div class="rz-head">💶 Odds</div><div class="muted">${st.oddsTried ? 'As casas ainda não publicaram odds para este jogo (ou a ESPN não as tem).' : 'Ainda não fui buscar odds.'}</div>
      <div class="acts" style="margin-top:6px;"><button class="btn btn-sm" onclick="oddsRetry(this)">🔎 Procurar odds outra vez</button></div></div>`;
  }
  const extra = [...new Set(st.books.flatMap(b => Object.keys(b.odds)))].filter(k => !ODD_KEYS.includes(k)).sort();
  const keys = ODD_KEYS.concat(extra).filter(k => st.books.some(b => b.odds[k]));
  const table = `<div style="overflow-x:auto;"><table class="odds-t"><tr><th></th>${keys.map(k => `<th>${ODD_LBL(k)}</th>`).join('')}</tr>${st.books.map(b => `<tr><td><b>${esc(b.provider)}</b></td>${keys.map(k => `<td>${b.odds[k] ? b.odds[k].toFixed(2) : '–'}</td>`).join('')}</tr>`).join('')}</table></div>`;
  const val = oddsValue(m);
  // as mesmas regras do Zé no duelo: odds altas exigem mais margem, nada acima de 6.00 nem abaixo de 20% de probabilidade
  const good = val.filter(x => x.ev > zeEdgeFor(0.03, x.o) && x.o <= 6 && x.p >= 0.2).slice(0, 3);
  const longs = val.filter(x => x.ev > 0.03 && !good.includes(x) && (x.o > 6 || x.p < 0.2)).slice(0, 2);
  const vtxt = good.length
    ? good.map(x => `✅ <b>${esc(marketName(x.k, m))}</b> @ ${x.o.toFixed(2)} (${esc(x.book)}) — eu dou ${pct(x.p)}, a odd justa seria ${(1 / x.p).toFixed(2)} → <b>+${Math.round(x.ev * 100)}%</b>`).join('<br>')
    : `Nenhuma destas odds paga mais do que eu acho justo — aqui não aposto.`;
  const ltxt = longs.length ? `<div class="muted" style="margin-top:4px;font-size:.8rem;">⚠️ ${longs.map(x => `${esc(marketName(x.k, m))} @ ${x.o.toFixed(2)}`).join(' · ')}: parece valor, mas é zebra (odd alta / pouca probabilidade) — as casas raramente erram tanto. Não conta como valor.</div>` : '';
  const sc = scorerValue(m).filter(x => x.status !== 'fora' && x.status !== 'lesão').slice(0, 8);
  const stxt = sc.length ? `<div style="margin-top:8px;"><b>⚽ Marcador a qualquer momento</b> <span class="muted">(${esc(st.scorerBook)})</span><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px;">${sc.map(x => `<span class="spill ${x.ev != null && x.ev >= 0.05 ? 'win' : 'void'}" title="${x.p != null ? 'eu dou ' + pct(x.p) : 'sem dados do jogador'}">${esc(x.name)} ${x.odd.toFixed(2)}${x.p != null ? ` · ${pct(x.p)}` : ''}</span>`).join('')}</div><div class="muted" style="font-size:.74rem;margin-top:3px;">A verde: a odd paga mais do que a minha probabilidade de ele marcar.</div></div>` : '';
  return `<div class="reason" style="margin-top:8px;"><div class="rz-head">💶 Odds das casas <span class="muted" style="font-weight:400;font-size:.75rem;">antes do jogo · podem mudar</span></div>${table}
    <div style="margin-top:6px;font-size:.86rem;line-height:1.45;">${vtxt}</div>${ltxt}${stxt}
    <div class="acts" style="margin-top:6px;"><button class="btn btn-sm" onclick="oddsRetry(this)">🔄 Atualizar odds</button></div>
    <div class="muted" style="font-size:.72rem;margin-top:4px;">A tua casa (Betano, Placard…) pode ter odds diferentes — confirma antes de apostar.</div></div>`;
}
reasoningHTML = (function (prev) { return function (m) { let h = prev(m); try { h += oddsHTML(m); } catch (e) { console.warn(e); } return h; }; })(reasoningHTML);
async function oddsRetry(btn) {
  const m = (btn && btn.closest('#dueloBox') && typeof dueloAtual !== 'undefined' && dueloAtual && dueloAtual.m) || window._modalMatch || (typeof zeLastMatch !== 'undefined' && zeLastMatch);
  if (!m) return;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ A procurar…'; }
  let st = studyFor(m);
  try {
    if (!st) st = await zeStudy(m);
    const ok = await oddsInto(st, m, true);
    toast(ok ? `💶 Odds de ${st.books.map(b => b.provider).join(' + ')}` : '💶 Ainda sem odds publicadas para este jogo.');
  } catch (e) { toast('💶 Não consegui ligar às odds agora.'); }
  const box = (btn && btn.closest('#studyBox, #dueloStudy')) || document.getElementById('studyBox');
  if (box) box.innerHTML = reasoningHTML(m); else if (btn) { btn.disabled = false; btn.textContent = '🔄 Atualizar odds'; }
  try { prefillMarketOdds(m); } catch (e) {}
}
/* chat: «odds benfica», «marcadores porto» */
zeTalk = (function (prev) {
  return function (raw, opts) {
    const q = normTxt(raw);
    if (/\b(odds?|cotac\w*|quanto paga)\b/.test(q) && !(typeof parseThreeOdds === "function" && parseThreeOdds(String(raw)))) {
      const teams = teamsMentioned(expandAliases(q));
      const m = teams.length ? resolveFocus(expandAliases(q), teams) : (typeof zeLastMatch !== 'undefined' && zeLastMatch);
      if (m && m.espn) {
        zeLastMatch = m;
        const show = () => { const st = studyFor(m); return { mood: 'pensativo', html: `<b>${esc(m.home)} vs ${esc(m.away)}</b>` + (st && st.books && st.books.length ? oddsHTML(m) : '<div class="muted">Ainda não há odds publicadas para este jogo.</div>') }; };
        if (studyFor(m) && studyFor(m).oddsTried) return show();
        return { mood: 'pensativo', html: `Vou ver as odds do <b>${esc(m.home)} vs ${esc(m.away)}</b> nas casas… 💶`, later: async () => { const st = await zeStudy(m).catch(() => null); if (st && !st.oddsTried) await oddsInto(st, m).catch(() => null); return show(); } };
      }
    }
    return prev(raw, opts);
  };
})(zeTalk);

/* ---------- 3) telemóvel: barra em baixo + cabeçalho limpo ---------- */
(function mobileShell() {
  const css = document.createElement('style');
  css.textContent = `
.odds-t { border-collapse: collapse; font-size: .8rem; width: 100%; min-width: 280px; }
.odds-t th, .odds-t td { padding: 4px 6px; text-align: center; border-bottom: 1px solid var(--line2); white-space: nowrap; }
.odds-t th { color: var(--muted); font-weight: 600; }
.odds-t td:first-child { text-align: left; }
#mNav { display: none; }
#mMore { display: none; }
@media (max-width: 760px) {
  .fm-nav { display: none; }
  .hdr-title .sub { display: none; }
  .hdr-title .club { font-size: .98rem; white-space: nowrap; letter-spacing: 0; }
  .btn-continue small { max-width: 96px; }
  .crest { width: 34px; height: 34px; }
  .hdr-ico { width: 40px; height: 40px; font-size: 1.25rem; }
  .btn-install { display: none !important; }
  body { padding-bottom: calc(66px + env(safe-area-inset-bottom)); }
  #mNav { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 800; background: rgba(14,8,26,.97); border-top: 1px solid var(--line2);
    padding: 4px 4px calc(4px + env(safe-area-inset-bottom)); }
  #mNav button { flex: 1; background: none; border: 0; color: var(--muted); font: 600 .66rem/1.1 inherit; padding: 6px 0 4px; display: flex; flex-direction: column; align-items: center; gap: 3px; position: relative; min-height: 50px; }
  #mNav button .i { font-size: 1.3rem; line-height: 1; }
  #mNav button.on { color: var(--lime); }
  #mNav button .nb { position: absolute; top: 2px; left: 55%; background: #ff4d6d; color: #fff; border-radius: 9px; font-size: .6rem; padding: 1px 5px; }
  #mNav button .nb:empty { display: none; }
  #mMore.open { display: block; position: fixed; inset: 0; z-index: 850; background: rgba(0,0,0,.55); }
  #mMore .sheet { position: absolute; left: 0; right: 0; bottom: 0; background: var(--bg2, #160d27); border-radius: 16px 16px 0 0; padding: 12px 12px calc(16px + env(safe-area-inset-bottom)); border-top: 1px solid var(--line2); }
  #mMore .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  #mMore .grid button { background: var(--tile, #271c42); border: 1px solid var(--line2); color: var(--text); border-radius: 12px; padding: 12px 4px; font: 600 .78rem inherit; display: flex; flex-direction: column; align-items: center; gap: 5px; }
  #mMore .grid button .i { font-size: 1.4rem; }
  #zeBubble { bottom: calc(76px + env(safe-area-inset-bottom)) !important; }
  #toast { bottom: calc(80px + env(safe-area-inset-bottom)) !important; }
}`;
  document.head.appendChild(css);
  const nav = document.createElement('nav'); nav.id = 'mNav'; nav.setAttribute('aria-label', 'Navegação');
  const items = [['portal', '🏠', 'Início'], ['dia', '⚽', 'Jogos'], ['duelo', '⚔️', 'Duelo'], ['ze', '🤖', 'Zé'], ['mais', '☰', 'Mais']];
  nav.innerHTML = items.map(([v, i, t]) => `<button type="button" data-m="${v}"><span class="i">${i}</span>${t}<span class="nb" id="mnb_${v}"></span></button>`).join('');
  document.body.appendChild(nav);
  const more = document.createElement('div'); more.id = 'mMore';
  more.innerHTML = `<div class="sheet"><div class="grid">
    <button data-g="jogos"><span class="i">📅</span>Calendário</button>
    <button data-g="scout"><span class="i">🔭</span>Scouting</button>
    <button data-g="banca"><span class="i">💶</span>Finanças</button>
    <button data-a="boletim"><span class="i">📸</span>Boletim</button>
    <button data-a="refresh"><span class="i">📡</span>Atualizar</button>
    <button data-a="search"><span class="i">🔎</span>Pesquisar</button>
    <button data-g="config"><span class="i">⚙️</span>Definições</button>
    <button data-a="install" id="mInstall"><span class="i">📲</span>Instalar</button>
    <button data-a="close"><span class="i">✕</span>Fechar</button></div></div>`;
  document.body.appendChild(more);
  const close = () => more.classList.remove('open');
  more.addEventListener('click', e => {
    if (e.target === more) return close();
    const b = e.target.closest('button'); if (!b) return;
    close();
    if (b.dataset.g) return fmGo(b.dataset.g);
    const a = b.dataset.a;
    if (a === 'refresh') atualizarTudo();
    if (a === 'search') { toggleSearch(); setTimeout(() => { const i = document.getElementById('searchInput'); if (i) i.focus(); }, 60); }
    if (a === 'install') instalarApp();
    if (a === 'boletim') { fmGo('banca'); try { wlSetTab('registar'); } catch (e) {} try { window.scrollTo(0, 0); } catch (e) {} }
  });
  nav.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.m === 'mais') { more.classList.toggle('open'); return; }
    close(); fmGo(b.dataset.m);
  });
  const mark = v => {
    const main = ['portal', 'dia', 'duelo', 'ze'].includes(v) ? v : 'mais';
    nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === main));
    const bi = document.getElementById('badgeInbox'), bd = document.getElementById('badgeDuelo');
    document.getElementById('mnb_portal').textContent = bi ? bi.textContent : '';
    document.getElementById('mnb_duelo').textContent = bd ? bd.textContent : '';
    const inst = document.getElementById('mInstall'), hb = document.getElementById('btnInstallApp');
    if (inst) inst.style.display = hb && getComputedStyle(hb).display === 'none' && !window.deferredPrompt ? 'none' : '';
  };
  fmGo = (function (prev) {
    return function (view, fromHistory) {
      const r = prev.apply(this, arguments);
      try { mark(currentView || view); if (window.matchMedia('(max-width: 760px)').matches && !fromHistory) window.scrollTo({ top: 0 }); } catch (e) {}
      return r;
    };
  })(fmGo);
  try { mark(currentView || 'portal'); } catch (e) {}
  // os números (badges) mudam quando o portal/duelo se redesenham: acompanha-os
  ['renderPortal', 'renderBanca', 'renderInbox'].forEach(fn => { if (typeof window[fn] === 'function') { const p = window[fn]; window[fn] = function () { const r = p.apply(this, arguments); try { mark(currentView); } catch (e) {} return r; }; } });
})();
/* textos que ainda falavam em «offline» */
(function () {
  const p = document.querySelector('#view-ze .screen-head p, #view-ze p');
  if (p && /offline/i.test(p.textContent)) p.textContent = 'Online · resultados, odds, notícias e mercado ao vivo + o dossiê.';
})();

/* ---------- 4) calendário: só jogos confirmados pela ESPN ----------
   O dossiê original tinha jogos «previstos» (alguns inventados: Bayern–Benfica, Real Madrid–Milan a 4 nov…).
   Num aparelho novo (ex.: telemóvel) a verificação ainda não tinha corrido e esses jogos apareciam como verdadeiros.
   Agora: um jogo do dossiê só entra na app depois de a ESPN o confirmar (data certa) ou de o dar como jogado.
   Os outros saem da lista (não aparecem no calendário, portal, duelo, Match Day nem no chat). */
const CAL_PENDING_TXT = '⏳ Por confirmar no calendário oficial';
const calTrusted = m => m.calSt === 'ok' || m.calSt === 'moved' || m.calSt === 'played';
function calGate() {
  if (typeof CAL_STATIC === 'undefined') return 0;
  CAL_STATIC.forEach(m => { if (!m.calSt) { m.calSt = 'pending'; m.calNote = CAL_PENDING_TXT; if (!m.aviso) m.aviso = CAL_PENDING_TXT; } });
  let n = 0, add = 0;
  if (CAL_SHOW_ALL) CAL_STATIC.forEach(m => { if (/missing|dup|unknown/.test(m.calSt || '') && !matches.includes(m)) { matches.push(m); add++; } });
  for (let k = matches.length - 1; k >= 0; k--) { const m = matches[k]; if (CAL_STATIC.includes(m) && !calTrusted(m) && !(CAL_SHOW_ALL && m.calSt !== 'pending')) { matches.splice(k, 1); n++; } }
  // v56b: só limpa as contas guardadas se a lista mudou (antes limpava em cada abertura do Calendário → tudo recalculado)
  if (n || add) { try { MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear(); } catch (e) {} }
  return n;
}
function calUngate() { CAL_STATIC.forEach(m => { if (!matches.includes(m)) matches.push(m); if (m.calSt === 'pending') { delete m.calSt; delete m.calNote; if (m.aviso === CAL_PENDING_TXT) m.aviso = m._orig.aviso || null; } }); }
calApply = (function (prev) { return function () { calUngate(); const r = prev.apply(this, arguments); calGate(); return r; }; })(calApply);
calVerify = (function (prev) { return async function () { try { return await prev.apply(this, arguments); } finally { calGate(); } }; })(calVerify);   // durante a verificação os jogos por confirmar continuam escondidos
renderCalendar = (function (prev) {
  return function () {
    calGate();
    const r = prev.apply(this, arguments);
    try {
      const bar = document.getElementById('calCheck');
      const pend = CAL_STATIC.filter(m => m.calSt === 'pending').length;
      if (bar && !document.getElementById('calPendNote')) bar.insertAdjacentHTML('afterbegin', `<div id="calPendNote" style="font-size:.82rem;margin-bottom:6px;">📡 Os jogos vêm do <b>calendário oficial (ESPN)</b>.${pend ? ` ⏳ ${pend} jogos do dossiê antigo ainda não foram confirmados — ficam escondidos até a ESPN os confirmar.` : ''}</div>`);
    } catch (e) {}
    return r;
  };
})(renderCalendar);
/* o «Continuar» e o duelo só escolhem jogos verdadeiros (e o próprio jogo, não uma cópia) */
pickDueloMatch = function () {
  const L = matches.filter(m => !m.past && !m.aviso).map(m => { const d = parseDayLabel(m.date); return { m, d: d ? daysFromToday(d) : 999 }; }).filter(x => x.d >= 0);
  let list = L.filter(x => x.d === 0);
  if (!list.length) list = L.filter(x => x.d <= 7);
  if (!list.length) list = L.filter(x => x.d <= 21);
  if (!list.length) return null;
  return list.sort((a, b) => (a.d - b.d) || (scoreMatch(b.m) - scoreMatch(a.m)))[0].m;
};
calGate();
/* num aparelho sem verificação feita, verificar logo a seguir ao primeiro «Atualizar» (sem esperar 20 s nem 3 dias) */
atualizarTudo = (function (prev) {
  return async function (opts) {
    const r = await prev.apply(this, arguments);
    try {
      const F = lsGet(CALFIX_KEY, null);
      if ((!F || !F.items) && !window.__calRunning && !(typeof espnCooling === 'function' && espnCooling()) && lsGet(LIVE_KEY, null)) {
        window.__calRunning = true;
        setTimeout(async () => {
          try { await calVerify(); applyLive(lsGet(LIVE_KEY, null)); renderCalendar(); if (currentView === 'portal') renderPortal(); updateContinue(); toast('📅 Calendário confirmado com a ESPN.'); }
          catch (e) { console.warn(e); } finally { window.__calRunning = false; }
        }, 1500);
      }
    } catch (e) {}
    return r;
  };
})(atualizarTudo);
try { updateContinue(); } catch (e) {}

/* ---------- 5) sempre fresco: ao abrir a app (ou voltar a ela) atualiza sozinha se os dados tiverem mais de 20 min ---------- */
(function autoFresh() {
  if (/jsdom/i.test(navigator.userAgent || '')) return;
  const stale = () => { const L = lsGet(LIVE_KEY, null); return !L || !L.generatedAt || Date.now() - new Date(L.generatedAt).getTime() > 20 * 60e3; };
  const go = () => { if (navigator.onLine === false || !stale() || (typeof espnCooling === 'function' && espnCooling()) || (typeof atualizarBusy !== 'undefined' && atualizarBusy)) return; atualizarTudo({ quiet: true }).catch(() => {}); };
  setTimeout(go, 1200);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(go, 600); });
  window.addEventListener('online', () => setTimeout(go, 800));
})();
(function () { const b = document.querySelector('.hdr-ico'); if (b && b.textContent.trim() === '⌕') b.textContent = '🔎'; })();
