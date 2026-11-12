
/* =====================================================================
   v41 · ESPN mudou (testado online a 3 nov 2026): intervalos de datas «AAAAMMDD-AAAAMMDD» dão 400;
   aceita um dia (AAAAMMDD), um mês (AAAAMM) e um ano (AAAA). Pedimos por mês (ou ano) e filtramos cá.
   ===================================================================== */
const ESPN_MONTH_CACHE = new Map();
/* v59: quanto tempo guardar a resposta de um mês/ano: acabado há mais de 3 dias → 12 h; o mês atual → 90 s */
function espnMonthTTL(k) {
  const now = new Date(), y = +String(k).slice(0, 4), mo = String(k).length >= 6 ? +String(k).slice(4, 6) : 12;
  const end = new Date(y, mo, 1);   // primeiro dia do mês seguinte (ou do ano seguinte)
  return now.getTime() - end.getTime() > 3 * 864e5 ? 12 * 3600e3 : 90e3;
}
async function espnByMonths(base, a, b) {
  const A = ymdParse(a), Bd = ymdParse(b);
  const end = new Date(Bd.getTime() + 864e5);
  const months = [];
  for (let d = new Date(A.getFullYear(), A.getMonth(), 1); d <= Bd; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0'));
  // período grande (calendário da época): por ano é menos pedidos
  const keys = months.length > 4 ? [...new Set(months.map(m => m.slice(0, 4)))] : months;
  const res = [];
  for (let i = 0; i < keys.length; i += 4) {
    res.push(...await Promise.all(keys.slice(i, i + 4).map(async k => {
      const url = `${base}?dates=${k}&limit=1000`;
      const c = ESPN_MONTH_CACHE.get(url);
      if (c && Date.now() - c.t < espnMonthTTL(k)) return c.j;   // v59: meses já acabados não mudam → não se pedem outra vez nesta sessão
      const j = await getJSONany(url);
      ESPN_MONTH_CACHE.set(url, { t: Date.now(), j });
      return j;
    })));
  }
  const seen = new Set();
  const events = res.flatMap(j => (j && j.events) || []).filter(e => {
    if (!e || seen.has(e.id)) return false; seen.add(e.id);
    const t = new Date(e.date); return t >= A && t < end;
  });
  return { events };
}
espnScoreboard = (function (prev) {
  return async function (url) {
    const m = url.match(/^(.*\/scoreboard)\?dates=(\d{8})-(\d{8})/);
    if (!m) return prev(url);
    try { return await espnByMonths(m[1], m[2], m[3]); }
    catch (e) { if (e.status === 400 || e.status === 404) return prev(url); throw e; }
  };
})(espnScoreboard);
/* o teste de ligação passa a experimentar também «por mês» */
netTest = (function (prev) {
  return async function (btn) {
    await prev(btn);
    try {
      const box = document.getElementById('netTestBox'); if (!box) return;
      const now = new Date(), k = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0');
      const t0 = Date.now();
      const j = await getJSONany(`https://site.api.espn.com/apis/site/v2/sports/soccer/por.1/scoreboard?dates=${k}&limit=1000`);
      const n = (j.events || []).length;
      box.insertAdjacentHTML('afterbegin', `<div style="font-size:.86rem;margin-bottom:6px;">📅 <b>Por mês</b> (o formato que a ESPN aceita agora): ✅ ${n} jogos da Liga Portugal este mês (${Date.now() - t0} ms). É este que o Zé usa.</div>`);
    } catch (e) {}
  };
})(netTest);
/* a memória dos meses só vale dentro do mesmo «Atualizar» (o seguinte pede tudo de novo) */
atualizarTudo = (function (prev) { return async function (opts) { if (!(opts && opts._retry)) [...ESPN_MONTH_CACHE.keys()].forEach(u => { const m = /dates=(\d{4,6})/.exec(u); if (!m || espnMonthTTL(m[1]) < 3600e3) ESPN_MONTH_CACHE.delete(u); }); return prev.apply(this, arguments); }; })(atualizarTudo);

/* Mercado: além do canal do YouTube, as notícias com «here we go» do Fabrizio Romano (feed público do Google Notícias) */
ytFetch = (function (prev) {
  return async function (force) {
    const yt = await prev(force).catch(() => []);
    let gn = [];
    try {
      const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent('"Fabrizio Romano" "here we go" when:7d') + '&hl=en-GB&gl=GB&ceid=GB:en';
      gn = parseRSS(await fetchText(url)).map(x => ({ ...x, flag: '📰', yt: true, source: x.source + ' · Romano' }));
    } catch (e) {}
    const seen = new Set();
    return yt.concat(gn).filter(x => { const k = normTxt(x.title).slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  };
})(ytFetch);
