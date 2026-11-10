// teste: o GitHub consegue falar com a ESPN?
const urls = [
  'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=202611&limit=1000',
  'https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings',
  'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.nations/scoreboard?dates=202611&limit=1000'
];
for (const u of urls) {
  const t = Date.now();
  try {
    const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; MisterZeRobo/1.0)' } });
    const txt = await r.text();
    let n = '-', ev = null; try { const j = JSON.parse(txt); n = (j.events || j.children || []).length; ev = j.events && j.events.find(e => e.status && e.status.type && e.status.type.state === 'pre'); } catch (e) {}
    console.log(r.status, txt.length + ' bytes', 'itens ' + n, (Date.now() - t) + ' ms', u.slice(40, 110));
    if (ev) {
      const code = u.split('/soccer/')[1].split('/')[0];
      const o = await fetch(`https://sports.core.api.espn.com/v2/sports/soccer/leagues/${code}/events/${ev.id}/competitions/${ev.id}/odds`);
      const oj = await o.json().catch(() => ({}));
      console.log('  odds', o.status, 'casas ' + ((oj.items || []).map(i => i.provider && i.provider.name).join(',')), ev.name);
    }
  } catch (e) { console.log('ERRO', String(e), u); }
}
