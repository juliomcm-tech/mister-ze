
/* =====================================================================
   v43 · notícias e YouTube que funcionam online (testado em juliomcm-tech.github.io a 3 nov 2026)
   - Google Notícias e YouTube não deixam o browser ler diretamente; as pontes grátis morreram (corsproxy 401, outras em baixo)
   - rss2json.com lê feeds e devolve com CORS: YouTube ✅; Google Notícias ❌ → as pesquisas passam a Bing Notícias (por país)
   - ligas que a ESPN não tem (ex.: Liga Portugal 2 dá 400) ficam de fora 7 dias, sem mais tentativas
   ===================================================================== */
const RSS2JSON = u => 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(u);
const MKT = { 'PT:pt-150': 'pt-PT', 'GB:en': 'en-GB', 'ES:es': 'es-ES', 'IT:it': 'it-IT', 'DE:de': 'de-DE', 'FR:fr': 'fr-FR', 'NL:nl': 'nl-NL', 'TR:tr': 'tr-TR', 'DK:da': 'da-DK', 'FI:fi': 'fi-FI', 'BE:nl': 'nl-BE', 'BE:fr': 'fr-BE' };
const RSS_CACHE = new Map();
const FOOT_WORD = { pt: 'futebol', en: 'football', es: 'fútbol', it: 'calcio', de: 'Fußball', fr: 'football', nl: 'voetbal', tr: 'futbol', da: 'fodbold', fi: 'jalkapallo' };
const xmlEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function unBing(link) { const m = String(link || '').match(/[?&]url=([^&]+)/); try { return m ? decodeURIComponent(m[1]) : link; } catch (e) { return link; } }
const hostName = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'notícia'; } };
function gnToBing(url) {
  const u = new URL(url);
  const q = (u.searchParams.get('q') || '').replace(/\bwhen:\d+[dhm]\b/g, '').trim();
  const mkt = MKT[u.searchParams.get('ceid') || ''] || 'pt-PT';
  // «Porto», «Braga», «Milan»… também são cidades: a palavra «futebol» na língua da edição tira as notícias da câmara municipal
  const ball = /romano/i.test(q) ? '' : ' ' + (FOOT_WORD[mkt.slice(0, 2)] || 'football');
  return `https://www.bing.com/news/search?q=${encodeURIComponent(q + ball)}&format=rss&mkt=${mkt}&setlang=${mkt.slice(0, 2)}`;
}
async function rssJson(feedUrl) {
  const c = RSS_CACHE.get(feedUrl); if (c && Date.now() - c.t < 15 * 60e3) return c.j;
  const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(RSS2JSON(feedUrl), { signal: ctrl.signal, cache: 'no-store' });
    const j = await r.json();
    if (!r.ok || j.status !== 'ok') throw new Error('feed ' + (j.message || r.status));
    RSS_CACHE.set(feedUrl, { t: Date.now(), j }); return j;
  } finally { clearTimeout(tm); }
}
fetchText = (function (prev) {
  return async function (url) {
    try {
      if (/news\.google\.com\/rss\/search/.test(url)) {
        const j = await rssJson(gnToBing(url));
        // devolve em formato RSS (com « - Fonte» no título), para o resto do Zé ler como sempre
        return '<rss><channel>' + (j.items || []).map(it => { const link = unBing(it.link); const src = it.author || hostName(link); return `<item><title>${xmlEsc(it.title)} - ${xmlEsc(src)}</title><link>${xmlEsc(link)}</link><pubDate>${xmlEsc(it.pubDate ? new Date(it.pubDate.replace(' ', 'T') + 'Z').toUTCString() : '')}</pubDate><source>${xmlEsc(src)}</source></item>`; }).join('') + '</channel></rss>';
      }
      if (/youtube\.com\/feeds\/videos\.xml/.test(url)) {
        const j = await rssJson(url);
        return `<feed><title>${xmlEsc((j.feed && j.feed.title) || 'YouTube')}</title>` + (j.items || []).map(it => `<entry><title>${xmlEsc(it.title)}</title><link rel="alternate" href="${xmlEsc(it.link)}"/><published>${xmlEsc(it.pubDate ? new Date(it.pubDate.replace(' ', 'T') + 'Z').toISOString() : '')}</published></entry>`).join('') + '</feed>';
      }
    } catch (e) { /* cai para o caminho antigo */ }
    return prev(url);
  };
})(fetchText);

/* ---------- ligas que a ESPN não tem ---------- */
const BAD_KEY = 'ze_espn_bad';
function espnBad() { const o = lsGet(BAD_KEY, {}); const now = Date.now(); Object.keys(o).forEach(k => { if (o[k] < now) delete o[k]; }); return o; }
espnScoreboard = (function (prev) {
  return async function (url) {
    const m = url.match(/soccer\/([a-z._0-9]+)\/scoreboard\?dates=(\d{8})-(\d{8})/);
    if (!m) return prev(url);
    if (espnBad()[m[1]]) return { events: [] };
    try { return await espnByMonths(url.replace(/\?.*$/, ''), m[2], m[3]); }
    catch (e) {
      if ((e.status === 400 || e.status === 404) && Date.now() - ESPN_OK_AT < 30 * 60e3) {
        const o = espnBad(); o[m[1]] = Date.now() + 7 * 864e5; lsSet(BAD_KEY, o);   // a ESPN não tem esta liga: não insistir
        return { events: [] };
      }
      if (e.status === 400 || e.status === 404) return prev(url);
      throw e;
    }
  };
})(espnScoreboard);
/* estudo de um jogo: as notícias não podem atrasar tudo (no máximo 12 s) */
zeNews = (function (prev) {
  return function (m) {
    return Promise.race([prev(m), new Promise(res => setTimeout(() => res({ t: Date.now(), items: [], signals: [], editions: [], err: 'as notícias demoraram demasiado' }), 12000))]);
  };
})(zeNews);
