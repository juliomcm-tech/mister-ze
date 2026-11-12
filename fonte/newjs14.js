/* =====================================================================
   v29 · O Zé lê os títulos dos jornais (Google Notícias PT)
   Só títulos + fonte + link (nunca o artigo). Deteta sinais (lesões,
   castigos, poupanças, treinador, motivação) e PEDE confirmação.
   ===================================================================== */
async function fetchText(url) {
  let best = lsGet('ze_proxy_idx', 0), lastErr = null;
  const order = [best].concat([0, 1, 2].filter(i => i !== best));
  for (const i of order) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(PROXIES[i](url), { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const txt = await r.text();
      if (!/<rss|<feed|<item/i.test(txt)) throw new Error('resposta sem notícias');
      return txt;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('sem ligação');
}
function cleanTeamQ(n) { return String(n).replace(/\b(FC|SL|SC|CF|AC|AFC|CD|UD|SAD)\b\.?/gi, '').replace(/\s+/g, ' ').trim(); }
function parseRSS(xml) {
  let doc;
  try { doc = new DOMParser().parseFromString(xml, 'text/xml'); } catch (e) { return []; }
  return [...doc.querySelectorAll('item')].map(it => {
    const g = s => { const el = it.querySelector(s); return el ? el.textContent.trim() : ''; };
    let title = g('title'), source = g('source');
    const m = title.match(/^(.*)\s+[-–]\s+([^-–]{2,40})$/);
    if (m) { title = m[1].trim(); source = source || m[2].trim(); }
    return { title, source: source || 'Notícia', link: g('link'), date: g('pubDate') };
  }).filter(x => x.title && x.link && /^https?:\/\//.test(x.link));
}
const NEWS_SIGNALS = [
  { k: 'out', re: /\b(lesao|lesionad|lesionou|rotura|entorse|fratura|operad|baixa|fora do jogo|fora da convocatoria|nao convocad|nao recupera|falha o jogo|falha a partida|ausencia|ausente)/, label: '🚑 Possível ausência' },
  { k: 'doubt', re: /\b(em duvida|duvida|incerto|condicionad|limitad|tocado|queixas)/, label: '❓ Em dúvida' },
  { k: 'susp', re: /\b(castigad|suspens|expuls|cartao vermelho|amarelos)/, label: '🟥 Castigo' },
  { k: 'back', re: /\b(regressa|recuperad|volta aos convocados|apto|disponivel|de volta)/, label: '✅ Regresso' },
  { k: 'rot', re: /\b(poupa|poupar|poupanca|rotacao|gestao de esforco|titulares no banco|equipa alternativa|segundas linhas)/, label: '🔄 Poupança' },
  { k: 'coach', re: /\b(treinador|tecnico|despedid|demitid|chicotada|interino|novo treinador|saida do treinador)/, label: '🧑‍💼 Treinador' },
  { k: 'motiv', re: /\b(decisiv|final|titulo|despromocao|manutencao|derbi|derby|classico|lider|liderança)/, label: '🔥 Motivação' }
];
function newsSignals(m, items) {
  const b = boardFor(m) || (studyFor(m) && studyFor(m).board);
  const players = b ? b.home.map(p => ({ ...p, side: 'h' })).concat(b.away.map(p => ({ ...p, side: 'a' })))
    : playersOf(m.home).map(p => ({ ...p, side: 'h' })).concat(playersOf(m.away).map(p => ({ ...p, side: 'a' })));
  const out = [];
  items.forEach((it, i) => {
    const t = normTxt(it.title);
    const sigs = NEWS_SIGNALS.filter(s => s.re.test(t));
    if (!sigs.length) return;
    const pl = players.find(p => {
      const sur = normTxt(p.name).split(' ').filter(x => x.length >= 5);
      return sur.some(s => new RegExp('(^| )' + s + '( |$)').test(t));
    }) || null;
    const team = teamScore(m.home, t) > 0 ? 'h' : teamScore(m.away, t) > 0 ? 'a' : (pl ? pl.side : null);
    sigs.forEach(s => {
      if ((s.k === 'out' || s.k === 'doubt' || s.k === 'susp' || s.k === 'back') && !pl) return; // sem jogador identificado não serve
      if ((s.k === 'rot' || s.k === 'coach' || s.k === 'motiv') && !team) return;
      out.push({ i, k: s.k, label: s.label, player: pl ? pl.name : null, side: pl ? pl.side : team });
    });
  });
  const seen = new Set();
  return out.filter(s => { const key = s.k + '|' + (s.player || s.side); if (seen.has(key)) return false; seen.add(key); return true; });
}
async function zeNews(m) {
  const H = cleanTeamQ(m.home), A = cleanTeamQ(m.away);
  const qs = [`"${H}" "${A}"`, `"${H}" (lesão OR castigo OR convocados OR poupar OR treinador)`, `"${A}" (lesão OR castigo OR convocados OR treinador)`];
  const res = await Promise.all(qs.map(q => fetchText(`https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:4d')}&hl=pt-PT&gl=PT&ceid=PT:pt-150`).then(parseRSS).catch(() => null)));
  if (res.every(x => x == null)) throw new Error('sem acesso às notícias');
  const seen = new Set(), items = [];
  res.flat().filter(Boolean).forEach(x => { const k = normTxt(x.title).slice(0, 80); if (!seen.has(k)) { seen.add(k); items.push(x); } });
  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  const recent = items.filter(x => !x.date || Date.now() - new Date(x.date).getTime() < 5 * 864e5).slice(0, 12);
  return { t: Date.now(), items: recent, signals: newsSignals(m, recent) };
}

/* ---------- Integração no estudo ---------- */
const _zeStudyV28 = zeStudy;
zeStudy = async function (m, status) {
  const st = await _zeStudyV28(m, status);
  if (navigator.onLine === false) return st;
  try { (status || (() => {}))('📰 A ler os títulos dos jornais…'); st.news = await zeNews(m); }
  catch (e) { st.news = { t: Date.now(), items: [], signals: [], err: e.message }; }
  STUDY[mKey(m)] = st;
  return st;
};
function agoTxt(d) {
  const t = new Date(d).getTime(); if (!t) return '';
  const h = Math.round((Date.now() - t) / 3600e3);
  return h < 1 ? 'agora' : h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}
function newsHTML(m) {
  const st = studyFor(m);
  if (!st || !st.news) return '';
  const n = st.news, idx = matchIndex(m);
  if (n.err) return `<div class="needs"><div class="rz-head">📰 Jornais</div><span class="muted">Não consegui ler as notícias agora (${esc(n.err)}). Se leste algo, diz-me: «Pavlidis lesionado», «Benfica vai poupar».</span></div>`;
  if (!n.items.length) return `<div class="needs"><div class="rz-head">📰 Jornais</div><span class="muted">Nada de relevante nos títulos dos últimos dias.</span></div>`;
  const nt = notesFor(m) || { out: [], rot: [] };
  const done = s => (s.k === 'out' || s.k === 'susp' || s.k === 'doubt') ? nt.out.some(o => normTxt(o.name).startsWith(normTxt(s.player || ''))) : s.k === 'rot' ? nt.rot.includes(s.side) : false;
  const ign = st.newsIgnored || [];
  const sig = n.signals.filter(s => !ign.includes(s.k + '|' + (s.player || s.side)));
  const act = (s, j) => {
    const it = n.items[s.i];
    const who = s.player ? `<b>${esc(s.player)}</b>` : `<b>${esc(s.side === 'h' ? m.home : m.away)}</b>`;
    let btn = '';
    if ((s.k === 'out' || s.k === 'susp' || s.k === 'doubt') && !done(s)) btn = `<button class="mini l" onclick="newsApply(${idx},${j},'out')">${s.k === 'doubt' ? 'Considerar em dúvida' : 'Marcar fora'}</button>`;
    if (s.k === 'rot' && !done(s)) btn = `<button class="mini l" onclick="newsApply(${idx},${j},'rot')">Vai poupar</button>`;
    if (s.k === 'back') btn = `<button class="mini w" onclick="newsApply(${idx},${j},'back')">Conta com ele</button>`;
    return `<div class="need">${s.label}: ${who} — <a href="${esc(it.link)}" target="_blank" rel="noopener">«${esc(it.title)}»</a> <span class="muted">(${esc(it.source)}, ${agoTxt(it.date)})</span>
      <div class="acts" style="margin-top:4px;">${done(s) ? '<span class="spill win">✔ já considerado</span>' : btn}<button class="mini x" onclick="newsApply(${idx},${j},'ignore')">Ignorar</button></div></div>`;
  };
  const others = n.items.filter((x, i) => !sig.some(s => s.i === i)).slice(0, 4);
  return `<div class="needs news"><div class="rz-head">📰 Nos jornais (últimos dias)</div>
    ${sig.length ? `<div class="muted" style="margin-bottom:4px;">Encontrei isto nos títulos. Confirma antes de eu usar — título não é certeza:</div>${sig.map((s, j) => act(s, n.signals.indexOf(s))).join('')}` : '<div class="muted">Nos títulos não há lesões, castigos ou poupanças destas equipas.</div>'}
    ${others.length ? `<details style="margin-top:6px;"><summary class="muted" style="cursor:pointer;">Outros títulos (${others.length})</summary>${others.map(x => `<div class="need">• <a href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.title)}</a> <span class="muted">(${esc(x.source)}, ${agoTxt(x.date)})</span></div>`).join('')}</details>` : ''}
    <div class="muted" style="font-size:.72rem;margin-top:6px;">Só leio os títulos e mostro o link — o artigo é do jornal.</div></div>`;
}
function newsApply(idx, j, what) {
  const m = matches[idx]; if (!m) return;
  const st = studyFor(m); if (!st || !st.news) return;
  const s = st.news.signals[j]; if (!s) return;
  if (what === 'ignore') { st.newsIgnored = (st.newsIgnored || []).concat(s.k + '|' + (s.player || s.side)); }
  else if (what === 'out' && s.player) {
    const b = boardFor(m) || st.board;
    const p = b ? (s.side === 'h' ? b.home : b.away).find(x => x.name === s.player) : null;
    const doubt = s.k === 'doubt';
    const share = p ? p.share : (doubt ? 0.15 : null);
    noteSet(m, n => { if (!n.out.some(o => normTxt(o.name) === normTxt(s.player))) n.out.push({ name: s.player + (doubt ? ' (em dúvida)' : ''), side: s.side, share: share != null ? (doubt ? share * 0.5 : share) : null, rank: p ? p.rank : 1 }); });
    toast(doubt ? `📝 ${s.player} em dúvida — conto com metade do risco.` : `📝 ${s.player} marcado como fora.`);
  } else if (what === 'rot' && s.side) {
    noteSet(m, n => { if (!n.rot.includes(s.side)) n.rot.push(s.side); });
    toast('📝 Poupança registada.');
  } else if (what === 'back' && s.player) {
    noteSet(m, n => { n.out = n.out.filter(o => normTxt(o.name) !== normTxt(s.player)); });
    toast(`✅ Conto com ${s.player}.`);
  }
  ['studyBox', 'dueloStudy'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = reasoningHTML(m); });
  const last = [...document.querySelectorAll('#chatLog .reason')].pop();
  if (last && last.parentNode) last.parentNode.innerHTML = reasoningHTML(m);
}
const _reasoningHTMLV28 = reasoningHTML;
reasoningHTML = function (m) { return _reasoningHTMLV28(m) + newsHTML(m); };

/* ---------- O Zé conta o que leu ---------- */
const _zeNeedsV28 = zeNeeds;
zeNeeds = function (m) {
  const n = _zeNeedsV28(m);
  const st = studyFor(m);
  if (st && st.news && !st.news.err) n.unshift({ t: st.news.signals.length ? `Li ${st.news.items.length} títulos e há ${st.news.signals.length} sinal(is) para confirmares (em baixo).` : `Li ${st.news.items.length} títulos — nada de alarmante.`, ex: '', act: '' });
  return n.slice(0, 5);
};
const _zeTalkV28 = zeTalk;
zeTalk = function (raw, opts) {
  const q = zeNorm(raw);
  if (/(noticias|jornais|o que dizem|imprensa|ultimas novidades|novidades d)/.test(q)) {
    const teams = teamsMentioned(q);
    const m = teams.length ? resolveFocus(q, teams) : (zeLastMatch || pickDueloMatch());
    if (m) {
      zeLastMatch = m;
      if (navigator.onLine === false) return { mood: 'pensativo', html: 'Sem internet não consigo ler os jornais. Se leste alguma coisa, conta-me: «Pavlidis lesionado», «Benfica vai poupar».' };
      return { mood: 'pensativo', html: `Vou ver o que dizem os jornais sobre <b>${esc(m.home)} vs ${esc(m.away)}</b>… 📰`, later: async () => { await zeStudy(m).catch(() => null); return { mood: 'feliz', html: reasoningHTML(m) }; } };
    }
  }
  return _zeTalkV28(raw, opts);
};
