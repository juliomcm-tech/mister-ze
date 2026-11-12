
/* =====================================================================
   v45 · testado online (3 nov 2026, 21h30)
   - notícias: o rss2json começou a responder 429 («demasiados feeds novos») → segunda via (r.jina.ai),
     memória de 30 min no aparelho e no máximo 4 pesquisas novas por minuto
   - chat: «como está o duelo» já não abre o perfil do Como; «casa vence» não salta para o Casa Pia;
     «o que achas do derby…» não vira Derby County; perguntas («quem é mais forte X ou Y?») nunca mexem na força das equipas
   - chat novo: classificação de qualquer liga, «transferências benfica», «mercado»
   - a app atualiza-se sozinha quando há versão nova
   ===================================================================== */
const APP_VER = 'v72';

/* ---------- 1) notícias e YouTube sem falhar ---------- */
const FEED_LS = 'ze_feed_cache_v1';
let R2J_COOL = 0, JINA_COOL = 0;
const FEED_BUDGET = { t: 0, n: 0 };
function feedLsGet(u) { try { const c = lsGet(FEED_LS, {})[u]; return c && Date.now() - c.t < 30 * 60e3 ? c.j : null; } catch (e) { return null; } }
function feedLsSet(u, j) {
  try {
    const o = lsGet(FEED_LS, {}); o[u] = { t: Date.now(), j: { status: 'ok', feed: { title: (j.feed && j.feed.title) || '' }, items: (j.items || []).slice(0, 15).map(it => ({ title: it.title, link: it.link, pubDate: it.pubDate, author: it.author || '' })) } };
    const ks = Object.keys(o).sort((a, b) => o[a].t - o[b].t); while (ks.length > 40) delete o[ks.shift()];
    lsSet(FEED_LS, o);
  } catch (e) {}
}
const toR2jDate = d => { const x = new Date(d); return isNaN(x) ? '' : x.toISOString().slice(0, 19).replace('T', ' '); };
async function timedFetch(url, ms, init) {
  const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...(init || {}), signal: ctrl.signal, cache: 'no-store' }); } finally { clearTimeout(tm); }
}
function xmlToItemsRe(xml) {
  const un = t => String(t || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').trim();
  const tag = (b, n) => { const m = b.match(new RegExp('<' + n + '[^>]*>([\\s\\S]*?)</' + n + '>', 'i')); return m ? un(m[1]) : ''; };
  const items = (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []).map(b => ({ title: tag(b, 'title'), link: tag(b, 'link'), pubDate: toR2jDate(tag(b, 'pubDate')), author: tag(b, 'News:Source') || tag(b, 'source') }));
  const entries = items.length ? [] : (xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || []).map(b => ({ title: tag(b, 'title'), link: (b.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || '', pubDate: toR2jDate(tag(b, 'published')), author: '' }));
  return { title: tag(xml, 'title'), items: items.length ? items : entries };
}
function xmlToItems(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) return xmlToItemsRe(xml);   // XML mal formado: lê à mão
  const items = [...doc.getElementsByTagName('item')].map(it => {
    const g = n => { const el = it.getElementsByTagName(n)[0]; return el ? el.textContent.trim() : ''; };
    return { title: g('title'), link: g('link'), pubDate: toR2jDate(g('pubDate')), author: g('News:Source') || g('source') || '' };
  });
  if (items.length) return { title: (doc.getElementsByTagName('title')[0] || {}).textContent || '', items };
  const entries = [...doc.getElementsByTagName('entry')].map(e => {
    const l = e.getElementsByTagName('link')[0];
    return { title: (e.getElementsByTagName('title')[0] || {}).textContent || '', link: l ? l.getAttribute('href') : '', pubDate: toR2jDate((e.getElementsByTagName('published')[0] || {}).textContent || ''), author: '' };
  });
  return { title: (doc.getElementsByTagName('title')[0] || {}).textContent || '', items: entries };
}
rssJson = async function (feedUrl) {
  const m = RSS_CACHE.get(feedUrl); if (m && Date.now() - m.t < 30 * 60e3) return m.j;
  const ls = feedLsGet(feedUrl); if (ls) { RSS_CACHE.set(feedUrl, { t: Date.now(), j: ls }); return ls; }
  // no máximo 6 pesquisas de notícias novas por minuto (o YouTube não conta) (os serviços grátis cortam quem pede muito de seguida)
  if (Date.now() - FEED_BUDGET.t > 60e3) { FEED_BUDGET.t = Date.now(); FEED_BUDGET.n = 0; }
  const yt = /youtube\.com\/feeds/.test(feedUrl);
  if (!yt && FEED_BUDGET.n >= 6) throw new Error('muitas pesquisas seguidas — espera um minuto');
  if (!yt) FEED_BUDGET.n++;
  let j = null, why = '';
  if (Date.now() > R2J_COOL) {
    try {
      const r = await timedFetch(RSS2JSON(feedUrl), 6000);
      const x = await r.json().catch(() => null);
      if (r.ok && x && x.status === 'ok') j = x;
      else { why = (x && x.message) || 'HTTP ' + r.status; if (r.status === 429 || /short period|limit/i.test(why)) R2J_COOL = Date.now() + 10 * 60e3; }
    } catch (e) { why = e.name === 'AbortError' ? 'demorou' : e.message; }
  }
  if (!j && Date.now() > JINA_COOL) {
    try {
      const r = await timedFetch('https://r.jina.ai/' + feedUrl, 8000, { headers: { 'X-Return-Format': 'html' } });
      const txt = await r.text();
      if (r.ok && /<rss|<feed|<item|<entry/i.test(txt)) { const p = xmlToItems(txt); if (p.items.length) j = { status: 'ok', feed: { title: p.title }, items: p.items }; }
      else { if (r.status === 429) JINA_COOL = Date.now() + 5 * 60e3; why = why || 'HTTP ' + r.status; }
    } catch (e) { why = why || e.message; }
  }
  if (!j) throw new Error('feed ' + (why || 'sem resposta'));
  RSS_CACHE.set(feedUrl, { t: Date.now(), j }); feedLsSet(feedUrl, j);
  return j;
};

/* ---------- 2) nomes de equipas que também são palavras ---------- */
['casa', 'pia'].forEach(w => TEAM_GENERIC.add(w));                // «Casa Pia» só com as duas palavras
try { if (typeof EXP_CACHE !== 'undefined' && EXP_CACHE.clear) EXP_CACHE.clear(); } catch (e) {}
const AMBIG_TEAM = n => { const t = normTxt(n).split(' '); return t[0] === 'como' || (t[0] === 'derby' && t.length <= 2); };
function opponentNamed(team, q) {
  return matches.some(m => !m.past && teamInMatch(m, team) && [m.home, m.away].some(o => normTxt(o) !== normTxt(team) && !AMBIG_TEAM(o) && teamScore(o, q) > 0));
}
function ambigOK(team, q, raw) {
  const n = normTxt(team);
  if (/^como/.test(n)) return /\bcomo 1907\b|\bcomo calcio\b/.test(q) || /(^|[^.!?]\s)Como\b/.test(String(raw || '').replace(/^\s*Como\b/, '')) || opponentNamed(team, q);
  if (/^derby/.test(n)) return /\bderby county\b/.test(q) || /\bDerby\b/.test(String(raw || '')) && !/\b(o|um|no|do|grande|este|esse)\s+Derby\b/.test(String(raw || '')) || opponentNamed(team, q);
  return true;
}
let TM_RAW = '';
function ambigFilter(list, q) {
  const plain = list.filter(n => !AMBIG_TEAM(n));
  if (plain.length >= 2) return plain;                 // «o derby Charlton–Bolton»: há duas equipas claras, a palavra «derby» é só uma palavra
  return list.filter(n => !AMBIG_TEAM(n) || ambigOK(n, q, TM_RAW));
}
teamsMentioned = (function (prev) { return function (q) { return ambigFilter(prev(q), q); }; })(teamsMentioned);
profTeamsInText = (function (prev) { return function (q) { return ambigFilter(prev(q), q); }; })(profTeamsInText);

/* ---------- 3) chat: classificação, comparação, transferências, mercado ---------- */
function leagueOfTeam(team) {
  const m = matches.find(x => x.espn && x.espn.code && !/uefa/.test(x.espn.code) && teamInMatch(x, team));
  return m ? m.espn.code : null;
}
function standingsTable(code, focus) {
  const L = lsGet(LIVE_KEY, null), S = L && L.standings && L.standings[code];
  const tb = S && S[0] && S[0].table;
  if (!tb || !tb.length) return null;
  const rows = tb.slice().sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor);
  const fi = focus ? rows.findIndex(r => teamScore(r.team.name, normTxt(focus)) > 0 || teamScore(focus, normTxt(r.team.name)) > 0) : -1;
  const show = rows.map((r, i) => ({ r, i })).filter(x => x.i < 8 || x.i >= rows.length - 3 || Math.abs(x.i - fi) <= 1);
  let last = -1;
  const line = ({ r, i }) => { const gap = i - last > 1 ? '<div class="muted">…</div>' : ''; last = i; const gd = r.goalsFor - r.goalsAgainst;
    return `${gap}<div style="display:flex;gap:6px;${i === fi ? 'color:var(--lime);font-weight:800;' : ''}"><span style="width:22px;text-align:right;">${i + 1}.</span><span style="flex:1;">${esc(r.team.name)}</span><span class="muted">${r.playedGames} j · ${gd > 0 ? '+' : ''}${gd}</span><b style="width:28px;text-align:right;">${r.points}</b></div>`; };
  return `<b>🏆 ${esc(ESPN_LEAGUES[code] || (typeof EXTRA_LEAGUES !== 'undefined' && EXTRA_LEAGUES[code]) || code)}</b><div style="font-size:.84rem;line-height:1.55;margin-top:4px;">${show.map(line).join('')}</div>`;
}
async function standingsFetch(code) {
  const j = await fetchJSON(`https://site.api.espn.com/apis/v2/sports/soccer/${code}/standings`);
  const s = espnStandings(j); if (!s) return false;
  const L = lsGet(LIVE_KEY, null) || { matches: [], standings: {} }; L.standings = L.standings || {}; L.standings[code] = s; lsSet(LIVE_KEY, L);
  return true;
}
function standingRow(name) {
  const L = lsGet(LIVE_KEY, null); if (!L || !L.standings) return null;
  for (const [code, S] of Object.entries(L.standings)) {
    if (/uefa/.test(code)) continue;
    const tb = (S && S[0] && S[0].table) || [];
    const r = tb.find(x => teamScore(x.team.name, normTxt(name)) > 0 || teamScore(name, normTxt(x.team.name)) > 0);
    if (r && r.playedGames) {
      const n = tb.length, avgGF = tb.reduce((a, x) => a + x.goalsFor / Math.max(1, x.playedGames), 0) / n;
      const pos = tb.slice().sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)).indexOf(r) + 1;
      return { code, r, pos, n, att: (r.goalsFor / r.playedGames) / avgGF, def: (r.goalsAgainst / r.playedGames) / avgGF, ppg: r.points / r.playedGames };
    }
  }
  return null;
}
function teamStrength(name) {
  const t = profFind(name);
  const p = t ? teamProfile(t) : null;
  if (!p || !p.n) {
    const s = standingRow(name); if (!s) return null;
    return { p: { t: { name: s.r.team.name, code: s.code }, n: s.r.playedGames, tags: [`${s.pos}.º de ${s.n} na ${ESPN_LEAGUES[s.code] || s.code}`] }, att: s.att, def: s.def, idx: s.att / Math.max(0.2, s.def), ppg: s.ppg, fromTable: true };
  }
  const att = (p.ah + p.aa) / 2, def = (p.dh + p.da) / 2;
  return { p, att, def, idx: att / def, ppg: (p.H.pts + p.A.pts) / p.n };
}
function compareHTML(a, b) {
  const A = teamStrength(a), B = teamStrength(b);
  const f = x => x.toFixed(2);
  const row = (n, S) => S ? `<b>${esc(S.p.t.name)}</b>: ${f(S.ppg)} pts/j em ${S.p.n} jogos · ataque ×${f(S.att)} · defesa ×${f(S.def)} <span class="muted">(1 = média da liga; defesa abaixo de 1 é melhor)</span>${S.p.tags.length ? '<br><span class="muted">' + S.p.tags.join(' · ') + '</span>' : ''}` : `<b>${esc(n)}</b>: ainda não tenho jogos desta época (carrega em 📡 Atualizar ou estuda um jogo dele).`;
  let verdict = '';
  if (A && B) {
    const d = A.idx / B.idx - 1, diffLeague = A.p.t.code !== B.p.t.code;
    verdict = Math.abs(d) < 0.08 ? '⚖️ Estão muito parecidos.' : `👉 Mais forte agora: <b>${esc((d > 0 ? A : B).p.t.name)}</b> (${Math.round(Math.abs(d) * 100)}% melhor no saldo ataque/defesa).`;
    if (diffLeague) verdict += ' <span class="muted">São ligas diferentes: cada um é medido contra a sua liga.</span>';
  }
  const dm = matches.find(m => !m.past && !m.aviso && teamInMatch(m, a) && teamInMatch(m, b));
  let direct = '';
  if (dm) { try { const r = modelo(dm); direct = `<br>🆚 No jogo <b>${esc(dm.home)} vs ${esc(dm.away)}</b> (${esc(dm.date)}): 1 ${pct(r.mk['1'])} · X ${pct(r.mk['X'])} · 2 ${pct(r.mk['2'])}.`; zeLastMatch = dm; } catch (e) {} }
  return `${row(a, A)}<br>${row(b, B)}<br>${verdict}${direct}<br><span class="muted">Só respondi — não mudei nada na força das equipas.</span>`;
}
zeTalk = (function (prev) {
  return function (raw, opts) {
    TM_RAW = String(raw || '');
    const q = normTxt(raw);
    const isQ = /\?\s*$/.test(TM_RAW.trim()) || /^(quem|qual|quais|sera|e que|achas|o que|porque|porque e que|quanto|onde|quando|como e que)\b/.test(q);
    try {
      // classificação / tabela
      if (/\b(classificac\w*|tabela|standings|em que lugar|que lugar|posicao|lider|lideres)\b/.test(q) && !/aposta|odd/.test(q)) {
        const teams = teamsMentioned(expandAliases(q));
        const code = leagueCodeFromName(TM_RAW) || (teams[0] && leagueOfTeam(teams[0]));
        if (code) {
          const h = standingsTable(code, teams[0]);
          if (h) return { mood: 'pensativo', html: h };
          return { mood: 'pensativo', html: 'Vou buscar a classificação… 🏆', later: async () => { const ok = await standingsFetch(code).catch(() => false); return { mood: ok ? 'feliz' : 'pensativo', html: ok ? standingsTable(code, teams[0]) : 'Não consegui a classificação desta liga agora.' }; } };
        }
      }
      // «quem é mais forte X ou Y?» — só responde, não regista nada
      if ((isQ || / ou /.test(q)) && /(mais forte|mais fraco|melhor equipa|quem e melhor|esta melhor|esta pior|quem ganha)/.test(q)) {
        const teams = profTeamsInText(expandAliases(q));
        if (teams.length >= 2) return { mood: 'pensativo', html: compareHTML(teams[0], teams[1]) };
        if (teams.length === 1 && isQ) return { mood: 'pensativo', html: compareHTML(teams[0], teams[0]).split('<br>')[0] + '<br><span class="muted">Diz-me com quem comparar («Benfica ou Porto?»).</span>' };
      }
      // «transferências benfica» (sem «do»)
      const tm = TM_RAW.match(/^\s*((?:as\s+)?(?:transfer[eê]ncias|compras|vendas|contrata[cç][oõ]es|refor[cç]os|saldo))\s+(?!(do|da|de|dos|das)\b)(.+)$/i);
      if (tm) return prev(`${tm[1]} do ${tm[3]}`, opts);
      // «mercado» sozinho → negócios do Fabrizio Romano e dos jornais
      if (/^(o )?mercado( de transferencias)?$|^(ultimas|novidades|noticias) (do )?mercado|^here we go$|^fabrizio( romano)?$/.test(q.replace(/[?!.]+$/, ''))) {
        return { mood: 'pensativo', html: 'Vou ver o que o Fabrizio Romano e os jornais dizem… 📺', later: async () => { const it = await ytFetch().catch(() => []); return { mood: 'feliz', html: `<b>📺 Mercado (Fabrizio Romano + jornais)</b><br>${ytDealsHTML(it || [])}` }; } };
      }
    } catch (e) { console.warn(e); }
    return prev(raw, opts);
  };
})(zeTalk);

/* ---------- 4) odds: quando ainda não há, dizer quando costumam sair ---------- */
oddsHTML = (function (prev) {
  return function (m) {
    let h = prev(m);
    try {
      const st = studyFor(m), d = parseDayLabel(m.date), days = d ? daysFromToday(d) : null;
      if (st && !st.offline && !(st.books && st.books.length) && days != null && days > 6) h = h.replace('As casas ainda não publicaram odds para este jogo (ou a ESPN não as tem).', `O jogo é daqui a ${days} dias — as casas costumam publicar as odds 5 a 7 dias antes. Volta mais perto da data.`);
    } catch (e) {}
    return h;
  };
})(oddsHTML);

/* ---------- 5) versão nova → atualiza sozinha ---------- */
(function autoUpdate() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const had = !!navigator.serviceWorker.controller;
  let done = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had || done) return; done = true;
    const busy = document.querySelector('.modal-overlay.open') || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && document.activeElement.value);
    if (!busy) { try { sessionStorage.setItem('ze_updated', '1'); } catch (e) {} location.reload(); }
    else toast('🆕 Há uma versão nova do Mister Zé — fecha e volta a abrir a app.');
  });
  const check = () => navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setInterval(check, 30 * 60e3);
  try { if (sessionStorage.getItem('ze_updated')) { sessionStorage.removeItem('ze_updated'); setTimeout(() => toast(`🆕 Mister Zé atualizado (${APP_VER}).`), 800); } } catch (e) {}
})();
renderConfig = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const v = document.getElementById('view-config');
      if (v && !document.getElementById('appVer')) v.insertAdjacentHTML('beforeend', `<div id="appVer" class="muted" style="text-align:center;font-size:.75rem;margin:14px 0 4px;">Mister Zé ${APP_VER} · atualiza-se sozinho quando há versão nova</div>`);
    } catch (e) {}
    return r;
  };
})(renderConfig);

/* «odds villarreal» quando o Villarreal não tem jogo por jogar: dizer isso (e não mostrar outro jogo) */
zeTalk = (function (prev) {
  return function (raw, opts) {
    const q = normTxt(raw);
    if (/\b(odds?|cotac\w*|quanto paga)\b/.test(q) && !(typeof parseThreeOdds === 'function' && parseThreeOdds(String(raw)))) {
      TM_RAW = String(raw || '');
      const teams = teamsMentioned(expandAliases(q));
      const rest = q.replace(/\b(odds?|cotac\w*|quanto|paga|as|os|o|a|do|da|de|dos|das|no|na|para|jogo|ver|mostra|quais|qual|sao|e|me|dá|da|das casas|casas|hoje|amanha|dia|deste|desse|este|esse|isto|agora|aqui|ai|melhores|melhor)\b/g, ' ').replace(/[^a-z0-9 ]/g, ' ').trim();
      if (!teams.length && rest.length >= 3) return { mood: 'pensativo', html: `Não encontro «${esc(rest)}» nos próximos jogos. Escreve o nome como aparece no calendário (ex.: «odds benfica»).` };
      if (teams.length && !teams.some(t => upcomingWith(t).length)) {
        const last = matches.filter(m => m.past && teamInMatch(m, teams[0])).pop();
        return { mood: 'pensativo', html: `Não encontro jogo por jogar do <b>${esc(teams[0])}</b> nos próximos dias${last ? ` (o último foi ${esc(last.home)} vs ${esc(last.away)}${last.resultado ? ', ' + esc(last.resultado) : ''})` : ''}. Carrega em 📡 Atualizar se achas que falta algum.` };
      }
    }
    return prev(raw, opts);
  };
})(zeTalk);
/* quando discordo muito das casas, o mais provável é ser eu a errar: não chamo «valor» a isso */
function marketP(st, k) {
  const b = st && st.books && st.books[0]; if (!b) return null;
  const o = b.odds, s = 1 / o['1'] + 1 / o.X + 1 / o['2'], p1 = 1 / o['1'] / s, pX = 1 / o.X / s, p2 = 1 / o['2'] / s;
  const map = { '1': p1, X: pX, '2': p2, '1X': p1 + pX, X2: pX + p2, '12': p1 + p2 };
  if (map[k] != null) return map[k];
  const m = /^([OU])(\d+(?:\.\d+)?)$/.exec(k); if (!m) return null;
  const ov = o['O' + m[2]], un = o['U' + m[2]]; if (!(ov && un)) return null;
  const t = 1 / ov + 1 / un; return m[1] === 'O' ? (1 / ov) / t : (1 / un) / t;
}
oddsValue = (function (prev) {
  return function (m) {
    const st = studyFor(m);
    return prev(m).map(x => { const mp = marketP(st, x.k); const gap = mp != null ? x.p - mp : 0; return gap > 0.15 ? { ...x, ev: Math.min(x.ev, 0.029), doubt: { mp, gap } } : x; });
  };
})(oddsValue);
oddsHTML = (function (prev) {
  return function (m) {
    let h = prev(m);
    try {
      const d = oddsValue(m).filter(x => x.doubt).sort((a, b) => b.doubt.gap - a.doubt.gap)[0];
      if (d) h = h.replace('<div class="acts" style="margin-top:6px;"><button class="btn btn-sm" onclick="oddsRetry(this)">🔄', `<div class="muted" style="margin-top:4px;font-size:.8rem;">🤔 Em <b>${esc(marketName(d.k, m))}</b> eu dou ${pct(d.p)} e as casas ${pct(d.doubt.mp)}. Quando discordo tanto, normalmente sou eu que não sei alguma coisa (lesões, motivação, nível da liga) — não conto isso como valor.</div><div class="acts" style="margin-top:6px;"><button class="btn btn-sm" onclick="oddsRetry(this)">🔄`);
    } catch (e) {}
    return h;
  };
})(oddsHTML);

/* ---------- 6) decisão do Zé coerente e explicada ----------
   Caso real (Viking–Sabah): o estudo dizia «o mais provável é Viking ou empate» e a decisão era «Sabah ou empate».
   As duas coisas estavam certas (a 1.ª é probabilidade, a 2.ª é valor da odd), mas confundiam.
   Agora: apostar CONTRA o favorito (o meu e o das casas) exige +10% de valor, a tabela marca zebras e
   «contra o favorito», e a decisão vem sempre com um «Porquê?» em português simples. */
const OUT_SET = { '1': ['1'], X: ['X'], '2': ['2'], '1X': ['1', 'X'], X2: ['X', '2'], '12': ['1', '2'] };
const CONTRA_EDGE = 0.10;
function favOf(p) { return ['1', 'X', '2'].sort((a, b) => (p[b] || 0) - (p[a] || 0))[0]; }
function marketFav(m, odds) {
  if (odds && odds['1'] > 1 && odds.X > 1 && odds['2'] > 1) return favOf({ '1': 1 / odds['1'], X: 1 / odds.X, '2': 1 / odds['2'] });
  const st = studyFor(m), b = st && st.books && st.books[0];
  return b ? favOf({ '1': 1 / b.odds['1'], X: 1 / b.odds.X, '2': 1 / b.odds['2'] }) : null;
}
function isContra(k, favM, favK) { const s = OUT_SET[k]; if (!s) return false; return !s.includes(favM) && (!favK || !s.includes(favK)); }
zeDecide = (function (prev) {
  return function (m, odds, bankAvail) {
    let d = prev(m, odds, bankAvail);
    try {
      const favM = favOf(d.r.mk), favK = marketFav(m, odds);
      const rows = d.rows;
      rows.forEach(x => { x.contra = x.odd ? isContra(x.k, favM, favK) : false; x.zebra = x.odd ? (x.odd > 6 || x.p < 0.2) : false; });
      // probabilidade das casas (sem margem) para cada mercado: das odds que meteste, ou das publicadas
      const mp = k => {
        const src = odds && odds['1'] > 1 && odds.X > 1 && odds['2'] > 1 ? odds : (() => { const st = studyFor(m), b = st && st.books && st.books[0]; return b ? b.odds : null; })();
        if (!src) return null;
        if (OUT_SET[k] && src['1'] && src.X && src['2']) { const t = 1 / src['1'] + 1 / src.X + 1 / src['2']; return OUT_SET[k].reduce((a, j) => a + (1 / src[j]) / t, 0); }
        const g = /^([OU])(\d+(?:\.\d+)?)$/.exec(k); if (!g) return null;
        const ov = src['O' + g[2]], un = src['U' + g[2]]; if (!(ov > 1 && un > 1)) return null;
        const t = 1 / ov + 1 / un; return g[1] === 'O' ? (1 / ov) / t : (1 / un) / t;
      };
      rows.forEach(x => { if (!x.odd) return; const q = mp(x.k); if (q != null && x.p - q > 0.15) x.doubt = q; });
      const bad = x => (isContra(x.k, favM, favK) && x.ev < CONTRA_EDGE) || (() => { const q = mp(x.k); return q != null && x.p - q > 0.15; })();
      let o = { ...odds }, skip = null, doubt = null, guard = 0;
      while (d.pick && bad(d.pick) && guard++ < 8) {
        const q = mp(d.pick.k);
        if (q != null && d.pick.p - q > 0.15) doubt = doubt || { ...d.pick, mp: q }; else skip = skip || d.pick;
        delete o[d.pick.k];
        if (!Object.keys(o).length) { d = { ...d, pick: null, stake: 0 }; break; }
        d = prev(m, o, bankAvail);
      }
      d.rows = rows; d.favM = favM; d.favK = favK; if (skip) d.contraSkip = skip; if (doubt) d.doubtSkip = doubt;
    } catch (e) { console.warn(e); }
    return d;
  };
})(zeDecide);
zeDecidirUI = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const d = dueloAtual && dueloAtual.decision, el = document.getElementById('zeDecision'), m = dueloAtual && dueloAtual.m;
      if (!d || !el || !m) return r;
      // tabela: marcar o que não conta
      el.querySelectorAll('table.mtable tbody tr').forEach(tr => {
        const lab = (tr.cells[0] && tr.cells[0].textContent || '').trim(), x = d.rows.find(y => y.odd && y.label === lab);
        if (!x || !(x.ev > d.minEdge)) return;
        const tag = x.zebra ? '🦓 zebra' : x.doubt != null ? '🤔 discordo muito das casas' : (x.contra && x.ev < CONTRA_EDGE) ? '↩️ contra o favorito' : '';
        if (tag) { const c = tr.cells[3]; c.className = ''; c.style.color = 'var(--muted)'; c.innerHTML += `<br><span style="font-size:.68rem;">${tag}</span>`; }
      });
      if (!d.pick && (d.contraSkip || d.doubtSkip)) el.querySelectorAll('.speech').forEach(sp => { sp.innerHTML = sp.innerHTML.replace(/Nenhuma destas odds tem valor ≥ [\d.]+%\./, 'Nenhuma destas odds tem valor seguro (vê o «Porquê?» em baixo).'); });
      // porquê
      const nm = k => marketName(k, m), fr = d.rows.find(x => x.k === d.favM);
      const favName = d.favM === 'X' ? 'o empate' : (d.favM === '1' ? m.home : m.away);
      const L = [];
      L.push(`Mais provável: <b>${esc(favName)}</b> (eu ${pct(d.r.mk[d.favM])}${d.favK ? `, casas ${d.favK === d.favM ? 'também' : 'preferem ' + esc(d.favK === 'X' ? 'o empate' : d.favK === '1' ? m.home : m.away)}` : ''}).`);
      if (fr && fr.odd) L.push(fr.ev > 0 ? `${esc(nm(fr.k))} @ ${fr.odd.toFixed(2)} até tem valor (${(fr.ev * 100).toFixed(1)}%).` : `Mas ${esc(nm(fr.k))} @ ${fr.odd.toFixed(2)} paga <b>menos do que vale</b> (pela minha conta a odd justa é ${fairOdd(d.r.mk[fr.k])}) — a longo prazo perde dinheiro.`);
      if (d.pick) {
        const p = d.pick;
        L.push(`Aposto em <b>${esc(p.label)}</b> porque a odd ${p.odd.toFixed(2)} paga mais do que a probabilidade que lhe dou (${pct(p.p)} → justa ${fairOdd(p.p)}). <b>Apostar com valor ≠ apostar em quem ganha</b>: é escolher a odd que, repetida muitas vezes, dá lucro.`);
        if (isContra(p.k, d.favM, d.favK)) L.push(`⚠️ É contra o favorito${p.p < 0.5 ? `: vai falhar mais vezes do que acerta (falha ${pct(1 - p.p)})` : ''}. Só entro porque o valor é alto (+${(p.ev * 100).toFixed(1)}%).`);
        else if (p.p < 0.5) L.push(`ℹ️ Acerta menos de metade das vezes (${pct(p.p)}) — é normal perder esta e ganhar no conjunto.`);
      } else {
        L.push('Por isso <b>não aposto</b>: o favorito paga pouco e as outras odds não têm margem que chegue.');
      }
      if (d.doubtSkip) L.push(`🤔 ${esc(d.doubtSkip.label)} @ ${d.doubtSkip.odd.toFixed(2)}: eu dou ${pct(d.doubtSkip.p)} e as casas ${pct(d.doubtSkip.mp)}. Quando discordo tanto, normalmente sou eu que não sei alguma coisa — não aposto nisso.`);
      if (d.contraSkip) L.push(`↩️ ${esc(d.contraSkip.label)} @ ${d.contraSkip.odd.toFixed(2)} dava +${(d.contraSkip.ev * 100).toFixed(1)}%, mas contra o favorito (o meu e o das casas) exijo +${Math.round(CONTRA_EDGE * 100)}% — o meu modelo engana-se mais aí.`);
      el.insertAdjacentHTML('beforeend', `<div class="reason" style="margin-top:8px;"><div class="rz-head">🧭 Porquê?</div><div style="font-size:.86rem;line-height:1.5;">${L.join('<br>')}</div></div>`);
    } catch (e) { console.warn(e); }
    return r;
  };
})(zeDecidirUI);
