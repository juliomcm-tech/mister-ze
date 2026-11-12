
/* =====================================================================
   v34 · YouTube: Fabrizio Romano (e outros canais que quiseres)
   - usa o feed RSS público que o próprio YouTube dá a cada canal (grátis, sem chave)
   - só títulos + link do vídeo, como nos jornais
   - «HERE WE GO» / oficial = negócio fechado → botão para registar; o resto é rumor (só para ler)
   ===================================================================== */
const YT_KEY = 'ze_yt_v1';
const YT_DEFAULT = [{ id: 'UCX1em-uaFMS02Rrk_Bowyng', name: 'Fabrizio Romano' }];
function ytChannels() { const c = lsGet(YT_KEY, null); return c && Array.isArray(c.channels) && c.channels.length ? c.channels : YT_DEFAULT; }
function parseAtom(xml) {
  let doc; try { doc = new DOMParser().parseFromString(xml, 'text/xml'); } catch (e) { return []; }
  const chan = (doc.querySelector('feed > title') || {}).textContent || 'YouTube';
  return [...doc.querySelectorAll('entry')].map(e => {
    const g = s => { const el = e.querySelector(s); return el ? el.textContent.trim() : ''; };
    const ln = e.querySelector('link[rel="alternate"]') || e.querySelector('link');
    return { title: g('title'), link: ln ? ln.getAttribute('href') : '', date: g('published') || g('updated'), source: chan.trim(), flag: '📺', yt: true };
  }).filter(x => x.title && /^https:\/\/(www\.)?youtube\.com\//.test(x.link));
}
let YT_CACHE = { t: 0, items: [], err: null };
async function ytFetch(force) {
  if (!force && YT_CACHE.items.length && Date.now() - YT_CACHE.t < 30 * 60e3) return YT_CACHE.items;
  const res = await Promise.all(ytChannels().map(c => fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(c.id)}`).then(parseAtom).catch(e => { YT_CACHE.err = e.message; return []; })));
  const items = res.flat().sort((a, b) => new Date(b.date) - new Date(a.date));
  if (items.length) { YT_CACHE = { t: Date.now(), items, err: null }; }
  return items;
}

/* ---------- Ler um título de mercado: quem compra, quem vende, fechado ou rumor ---------- */
['here', 'we', 'go', 'breaking', 'exclusive', 'official', 'done', 'deal', 'confirmed', 'medical', 'agreement', 'talks', 'update', 'news', 'transfer', 'shorts', 'why', 'how', 'what', 'who', 'will', 'set', 'close', 'closer', 'plan', 'big', 'huge'].forEach(w => HEAD_STOP.add(w));
const DEAL_DONE = /(here we go|oficial|official|confirmed|confirmado|done deal|completes|completed|signs|signed|assina|assinou|medical completed|contrato assinado)/;
function readDeal(title) {
  const t = normTxt(title).replace(/[.,!?:;|]/g, ' ').replace(/\s+/g, ' ');
  const clubs = profTeamsInText(t);
  if (!clubs.length) return null;
  const done = DEAL_DONE.test(t);
  const fee = parseMoney(title);
  const loan = LOAN_RE.test(t);
  let buyer = null, seller = null;
  // «X to Club», «X joins Club», «X é reforço do Club», «X ficha por el Club», «Club sign X», «Club agree deal for X»
  // o clube que aparece PRIMEIRO depois da palavra-chave
  const firstIn = (rest, skip) => { let best = null; clubs.forEach(c => { if (skip && c === skip) return; const pos = Math.min(...teamTokens(c).concat(normTxt(c).split(' ')).map(x => { const m = rest.match(new RegExp('(^| )' + x + '( |$)')); return m ? m.index : 999; })); if (pos < 30 && (!best || pos < best.pos)) best = { c, pos }; }); return best ? best.c : null; };
  const after = re => { const m = t.match(re); if (!m) return null; return firstIn(t.slice(m.index + m[0].length)); };
  buyer = after(/\b(to|joins|join|para o|para a|ao|reforco do|reforco da|ficha por el|ficha por|signs for|moves to|heads to)\b/);
  if (!buyer) { const c0 = clubs.find(c => { const tk = teamTokens(c).find(x => t.includes(x)); if (!tk) return false; const rest = t.slice(t.indexOf(tk) + tk.length, t.indexOf(tk) + tk.length + 40); return /\b(sign|signs|agree|agreed|complete|completes|contrata|contratou|anuncia|announce|land|seal)\b/.test(rest); }); buyer = c0 || null; }
  const fromM = t.match(/\b(from|do|da|del|dal|vom)\s/); if (fromM) seller = firstIn(t.slice(fromM.index + fromM[0].length), buyer);
  if (!seller) seller = clubs.find(c => c !== buyer) || null;
  if (buyer && seller && normTxt(buyer) === normTxt(seller)) seller = null;
  if (!buyer && /\b(leaves|leave|deixa|sai do|sale del|exit)\b/.test(t)) seller = clubs[0];
  const g = guessPlayer(title, { home: buyer || clubs[0], away: seller || clubs[1] || clubs[0] });
  const player = g ? g.name : null;
  return { done, fee, loan, buyer, seller, player, clubs };
}

/* ---------- O Zé junta o YouTube às notícias de cada jogo ---------- */
const _zeNewsV34 = zeNews;
zeNews = async function (m) {
  const n = await _zeNewsV34(m);
  try {
    const yt = await ytFetch();
    const about = x => { const t = expandAliases(normTxt(x.title)); return teamIn(m.home, t) > 0 || teamIn(m.away, t) > 0; };
    const fresh = yt.filter(x => about(x) && Date.now() - new Date(x.date).getTime() < 10 * 864e5).slice(0, 4);
    if (fresh.length && n && Array.isArray(n.items)) {
      n.items = n.items.concat(fresh);
      n.signals = newsSignals(m, n.items);
      n.editions = (n.editions || []).concat('📺');
    }
  } catch (e) {}
  return n;
};
/* nos títulos do YouTube, a direção do negócio vem do próprio título */
const _newsSignalsV34 = newsSignals;
newsSignals = function (m, items) {
  const out = _newsSignalsV34(m, items).filter(s => !(s.k === 'transfer' && items[s.i] && items[s.i].yt));
  items.forEach((it, i) => {
    if (!it.yt) return;
    const d = readDeal(it.title); if (!d || !d.player) return;
    const side = d.buyer && teamIn(m.home, normTxt(d.buyer)) > 0 ? 'h' : d.buyer && teamIn(m.away, normTxt(d.buyer)) > 0 ? 'a' : d.seller && teamIn(m.home, normTxt(d.seller)) > 0 ? 'h' : d.seller && teamIn(m.away, normTxt(d.seller)) > 0 ? 'a' : null;
    if (!side) return;
    out.push({ i, k: 'transfer', label: `${d.done ? '✅ Negócio fechado' : '🗣️ Rumor'}${d.fee ? ` (${d.fee.toFixed(d.fee < 10 ? 1 : 0)} M€)` : ''}`, player: d.player, side, fee: d.fee, rumor: !d.done });
  });
  return out;
};

/* ---------- Painel «📺 Mercado no YouTube» ---------- */
let YT_DEALS = [];
function ytDealsHTML(items, onlyKnown) {
  YT_DEALS = [];
  const rows = items.slice(0, 40).map(it => ({ it, d: readDeal(it.title) })).filter(x => !onlyKnown || x.d).slice(0, 12);
  if (!rows.length) return `<span class="muted">Nos últimos vídeos não vi clubes que o Zé conheça. ${YT_CACHE.err ? `(${esc(YT_CACHE.err)})` : ''}</span>`;
  const ago = x => { try { return agoTxt(x); } catch (e) { return ''; } };
  return rows.map(({ it, d }) => {
    let btn = '';
    if (d && d.done && d.player && (d.buyer || d.seller)) {
      const j = YT_DEALS.push({ it, d }) - 1;
      btn = `<button class="mini l" onclick="ytRegister(${j})">📝 Registar${d.buyer ? ` entrada no ${esc(d.buyer)}` : ` saída do ${esc(d.seller)}`}${d.buyer && d.seller ? ` (e saída do ${esc(d.seller)})` : ''}</button>`;
    }
    const tag = d ? (d.done ? '<span class="spill win">✅ fechado</span>' : '<span class="spill">🗣️ rumor</span>') : '';
    return `<div class="need">${tag} <a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)}</a> <span class="muted">(${esc(it.source)}, ${ago(it.date)})</span>${btn ? `<div class="acts" style="margin-top:4px;">${btn}</div>` : ''}</div>`;
  }).join('');
}
function ytRegister(j) {
  const x = YT_DEALS[j]; if (!x) return;
  const { d } = x;
  const main = d.buyer ? addTransfer(d.buyer, { dir: 'in', player: d.player, fee: d.fee, loan: d.loan, other: d.seller, src: 'youtube' }) : addTransfer(d.seller, { dir: 'out', player: d.player, fee: d.fee, loan: d.loan, src: 'youtube' });
  const mirror = d.buyer && d.seller ? addTransfer(d.seller, { dir: 'out', player: d.player, fee: d.fee, loan: d.loan, other: d.buyer, src: 'youtube' }) : null;
  profSave();
  addChat('bot', transferReply(main, mirror && !mirror.dup ? mirror : null) + (d.fee == null ? '<br><span class="muted">O título não diz o valor. Se souberes, diz «… por 30 milhões».</span>' : ''), 'feliz');
  toast(main.dup ? 'Já estava registada.' : `📝 ${main.t.name}: ${main.txt}`);
}
async function ytPanelLoad(btn) {
  const box = document.getElementById('ytBox'); if (!box) return;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ A ver os vídeos…'; }
  box.innerHTML = '<span class="muted">A ler os últimos vídeos…</span>';
  const items = await ytFetch(true).catch(() => []);
  box.innerHTML = items.length ? ytDealsHTML(items, true) : `<span class="muted">Não consegui ler o YouTube agora${YT_CACHE.err ? ` (${esc(YT_CACHE.err)})` : ''}.</span>`;
  if (btn) { btn.disabled = false; btn.textContent = '📺 Ver mercado no YouTube'; }
}
function ytAddChannel() {
  const v = (document.getElementById('ytNew') || {}).value || '';
  const id = (v.match(/UC[\w-]{22}/) || [])[0];
  if (!id) { toast('Cola o ID do canal (começa por UC…) ou um link youtube.com/channel/UC…'); return; }
  const ch = ytChannels().slice(); if (!ch.some(c => c.id === id)) ch.push({ id, name: 'Canal ' + (ch.length + 1) });
  lsSet(YT_KEY, { channels: ch }); YT_CACHE = { t: 0, items: [], err: null }; renderTeamsPanel(); toast('📺 Canal adicionado.');
}
function ytRemoveChannel(id) { const ch = ytChannels().filter(c => c.id !== id); lsSet(YT_KEY, { channels: ch.length ? ch : YT_DEFAULT }); YT_CACHE = { t: 0, items: [], err: null }; renderTeamsPanel(); }
const _renderTeamsPanelV34 = renderTeamsPanel;
renderTeamsPanel = function () {
  _renderTeamsPanelV34();
  const el = document.getElementById('cfgTeams'); if (!el) return;
  el.insertAdjacentHTML('beforeend', `<div style="margin-top:12px;border-top:1px solid var(--line2);padding-top:10px;">
    <div style="font-size:.86rem;"><b>📺 Mercado no YouTube</b> <span class="muted">— ${ytChannels().map(c => `${esc(c.name)}${c.id !== YT_DEFAULT[0].id ? ` <a href="#" onclick="ytRemoveChannel('${esc(c.id)}');return false;">✕</a>` : ''}`).join(' · ')}</span></div>
    <div class="hint" style="margin:4px 0 8px;">Só títulos e link do vídeo (feed público do YouTube). «HERE WE GO» ou «oficial» = negócio fechado, com botão para registar; o resto é rumor, só para leres.</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;"><button class="btn btn-sm" onclick="ytPanelLoad(this)">📺 Ver mercado no YouTube</button>
    <input id="ytNew" class="inp" placeholder="Outro canal: ID UC… ou link /channel/UC…" style="flex:1;min-width:180px;"><button class="btn btn-sm" onclick="ytAddChannel()">+ Canal</button></div>
    <div id="ytBox" style="margin-top:8px;font-size:.84rem;"></div></div>`);
};

/* ---------- Chat ---------- */
const _zeTalkV34 = zeTalk;
zeTalk = function (raw, opts) {
  const q = zeNorm(raw);
  if (/(romano|here we go|youtube|novidades do mercado|ultimas do mercado|rumores)/.test(q)) {
    if (navigator.onLine === false) return { mood: 'pensativo', html: 'Sem internet não consigo ver o YouTube.' };
    return { mood: 'pensativo', html: 'Vou ver os últimos vídeos de mercado… 📺', later: async () => { const items = await ytFetch(true).catch(() => []); return { mood: 'feliz', html: items.length ? `<b>📺 Últimos vídeos de mercado</b><br>${ytDealsHTML(items, true)}` : `Não consegui ler o YouTube agora${YT_CACHE.err ? ` (${esc(YT_CACHE.err)})` : ''}.` }; } };
  }
  return _zeTalkV34(raw, opts);
};
