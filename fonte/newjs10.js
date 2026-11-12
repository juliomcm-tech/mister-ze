/* =====================================================================
   v25 · Partilhar cartão do jogo (análise) e calendário
   ===================================================================== */
function matchBestMarket(m) {
  const r = modelo(m);
  return ['1', '1X', 'O1.5', 'O2.5', 'BTTS', 'U2.5', 'X2', '2'].map(k => ({ k, p: r.mk[k] }))
    .filter(o => o.p >= 0.55 && o.p <= 0.85).sort((a, b) => b.p - a.p)[0] || null;
}
function matchShareText(m) {
  const r = modelo(m), best = matchBestMarket(m);
  const L = [];
  L.push(`⚽ ${m.home} vs ${m.away}`);
  L.push(`🏆 ${m.league} · 📅 ${m.date}${m.kickoff ? ' ' + m.kickoff : ''}`);
  if (m.aviso) L.push(`⚠️ ${m.aviso}`);
  L.push(`💡 Dossiê: ${String(deriveBet(m)).replace(/<[^>]+>/g, '')} (${m.prob})`);
  L.push(`🧠 Modelo do Zé: 1 ${pct(r.mk['1'])} · X ${pct(r.mk['X'])} · 2 ${pct(r.mk['2'])} · Over 2.5 ${pct(r.mk['O2.5'])} · Ambas ${pct(r.mk.BTTS)}`);
  L.push(`📊 Placares: ${r.mk.cs.slice(0, 3).map(c => `${c.s} (${pct(c.p)})`).join(' · ')}`);
  if (best) L.push(`🎯 O Zé só entra em «${marketName(best.k, m)}» a odd ≥ ${(1.03 / best.p).toFixed(2)}`);
  const an = String(m.analysis || '').replace(/<[^>]+>/g, '').trim();
  if (an) L.push(`📝 ${an.length > 260 ? an.slice(0, 257) + '…' : an}`);
  L.push('— Mister Zé · dossiê 2026/27');
  return L.join('\n');
}
function calendarList() {
  const q = (document.getElementById('searchInput') || {}).value || '';
  const qq = q.toLowerCase().trim();
  return upcoming(7).map(x => x.m).filter(m => {
    if (currentCalFilter === 'fav' && !m.fav) return false;
    if (currentCalFilter === 'best' && m.type !== 'best') return false;
    if (currentCalFilter === 'worst' && m.type !== 'worst') return false;
    if (['portugal', 'premier', 'seriea', 'bundesliga', 'laliga', 'ucl', 'eredivisie'].includes(currentCalFilter) && !leagueMatchFilter(m, currentCalFilter)) return false;
    if (qq && !(m.home + m.away + m.team + m.league).toLowerCase().includes(qq)) return false;
    return true;
  });
}
const CAL_FILTER_LABEL = { all: 'Todos', fav: 'Favoráveis', best: 'Casa forte', worst: 'Fora fraco', portugal: 'Portugal', premier: 'Premier', seriea: 'Serie A', bundesliga: 'Bundesliga', laliga: 'La Liga', ucl: 'UCL / Europa', eredivisie: 'Eredivisie' };
function calendarShareText(list) {
  const L = [`📅 Calendário do Mister Zé — próximos 7 dias${currentCalFilter !== 'all' ? ' · ' + CAL_FILTER_LABEL[currentCalFilter] : ''}`];
  let day = '';
  list.slice(0, 20).forEach(m => {
    if (m.date !== day) { day = m.date; L.push(`\n🗓️ ${day}`); }
    const best = matchBestMarket(m);
    L.push(`${m.fav ? '⭐' : '•'} ${m.home} vs ${m.away}${m.kickoff ? ' ' + m.kickoff : ''} (${m.league}) — ${best ? `${marketName(best.k, m)} ${pct(best.p)}` : m.prob}`);
  });
  if (list.length > 20) L.push(`\n+ ${list.length - 20} jogos`);
  if (!list.length) L.push('Sem jogos com estes filtros.');
  L.push('\n— Mister Zé · dossiê 2026/27');
  return L.join('\n');
}

/* ---------- Imagens: jogo e calendário ---------- */
const _cardImageV24 = cardImage;
cardImage = async function (kind, data) {
  if (kind !== 'match' && kind !== 'cal') return _cardImageV24(kind, data);
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#2c1656'); g.addColorStop(.6, '#160d2b'); g.addColorStop(1, '#0f0a1a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,.035)';
  for (let x = -H; x < W; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 8, 0); ctx.lineTo(x + 8 + H * 0.47, H); ctx.lineTo(x + H * 0.47, H); ctx.fill(); }
  const F = (w, s) => `${w} ${s}px "Barlow Condensed", "Arial Narrow", "Roboto Condensed", sans-serif`;
  const T = (s, w) => `${w || 500} ${s}px Barlow, "Segoe UI", Roboto, sans-serif`;
  const face = await svgToImg(zeFace('feliz', 160));
  if (face) ctx.drawImage(face, 70, 60, 150, 150);
  ctx.fillStyle = '#c8f53c'; ctx.font = F(800, 30); ctx.fillText('MISTER ZÉ FC', 250, 110);
  ctx.fillStyle = '#ffffff'; ctx.font = F(800, 64); ctx.fillText(kind === 'match' ? 'ANÁLISE DO JOGO' : 'CALENDÁRIO', 250, 175);
  ctx.fillStyle = '#a99ec4'; ctx.font = T(28); ctx.fillText(kind === 'match' ? `${data.m.league} · ${data.m.date}${data.m.kickoff ? ' ' + data.m.kickoff : ''}` : `Próximos 7 dias${currentCalFilter !== 'all' ? ' · ' + CAL_FILTER_LABEL[currentCalFilter] : ''}`, 250, 215);
  const badge = async (name, x, y, s) => { const im = await svgToImg(teamBadge(name, s)); if (im) ctx.drawImage(im, x, y, s, s * 1.15); };
  let y = 290;
  if (kind === 'match') {
    const m = data.m, r = modelo(m);
    await badge(m.home, 90, y, 110); await badge(m.away, W - 200, y, 110);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = F(800, 54);
    ctx.fillText(m.home.toUpperCase().slice(0, 16), W / 2, y + 50);
    ctx.fillStyle = '#7d7299'; ctx.font = F(800, 36); ctx.fillText('VS', W / 2, y + 95);
    ctx.fillStyle = '#ffffff'; ctx.font = F(800, 54); ctx.fillText(m.away.toUpperCase().slice(0, 16), W / 2, y + 150);
    ctx.textAlign = 'left';
    y += 200;
    const cells = [['1', r.mk['1']], ['X', r.mk['X']], ['2', r.mk['2']], ['Over 2.5', r.mk['O2.5']], ['Ambas', r.mk.BTTS], ['1X', r.mk['1X']]];
    const cw = (W - 120 - 50) / 3, ch = 130;
    cells.forEach(([lab, p], i) => {
      const x = 60 + (i % 3) * (cw + 25), yy = y + Math.floor(i / 3) * (ch + 20);
      ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x, yy, cw, ch);
      ctx.fillStyle = '#a99ec4'; ctx.font = T(26, 700); ctx.fillText(lab.toUpperCase(), x + 24, yy + 40);
      ctx.fillStyle = '#ffffff'; ctx.font = F(800, 58); ctx.fillText(pct(p), x + 24, yy + 102);
      ctx.fillStyle = '#7d7299'; ctx.font = T(24); ctx.textAlign = 'right'; ctx.fillText('justa ' + fairOdd(p), x + cw - 20, yy + 40); ctx.textAlign = 'left';
    });
    y += 2 * (ch + 20) + 30;
    ctx.fillStyle = '#c8f53c'; ctx.font = T(32, 700);
    ctx.fillText(`Placares: ${r.mk.cs.slice(0, 3).map(c2 => `${c2.s} (${pct(c2.p)})`).join('  ·  ')}`, 70, y); y += 60;
    ctx.fillStyle = '#f2eefb'; ctx.font = T(32, 600);
    y = wrapText(ctx, '💡 ' + String(deriveBet(m)).replace(/<[^>]+>/g, ''), 70, y, W - 140, 44, 2) + 10;
    const best = matchBestMarket(m);
    if (best) { ctx.fillStyle = '#c8f53c'; y = wrapText(ctx, `🎯 O Zé só entra em «${marketName(best.k, m)}» a odd ≥ ${(1.03 / best.p).toFixed(2)}`, 70, y, W - 140, 44, 2) + 10; }
    ctx.fillStyle = '#a99ec4'; ctx.font = T(28);
    y = wrapText(ctx, String(m.analysis || '').replace(/<[^>]+>/g, ''), 70, y, W - 140, 40, 4);
  } else {
    const list = data.list.slice(0, 11);
    let day = '';
    for (const m of list) {
      if (y > H - 140) break;
      if (m.date !== day) { if (day) y += 16; day = m.date; ctx.fillStyle = '#c8f53c'; ctx.font = F(800, 34); ctx.fillText(day.toUpperCase(), 70, y + 10); y += 50; }
      ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(60, y - 8, W - 120, 82);
      await badge(m.home, 80, y + 2, 44);
      ctx.fillStyle = '#ffffff'; ctx.font = T(32, 700); ctx.fillText(`${m.home} vs ${m.away}`.slice(0, 34), 140, y + 32);
      ctx.fillStyle = '#a99ec4'; ctx.font = T(24); ctx.fillText(`${m.league}${m.kickoff ? ' · ' + m.kickoff : ''}`.slice(0, 44), 140, y + 64);
      const best = matchBestMarket(m);
      ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff'; ctx.font = F(800, 38);
      ctx.fillText(best ? pct(best.p) : String(m.prob), W - 84, y + 34);
      ctx.fillStyle = '#a99ec4'; ctx.font = T(22); ctx.fillText(best ? marketName(best.k, m).slice(0, 26) : '', W - 84, y + 64);
      ctx.textAlign = 'left';
      y += 98;
    }
    if (data.list.length > list.length) { ctx.fillStyle = '#a99ec4'; ctx.font = T(28); ctx.fillText(`+ ${data.list.length - list.length} jogos`, 70, y + 10); }
    if (!data.list.length) { ctx.fillStyle = '#a99ec4'; ctx.font = T(32); ctx.fillText('Sem jogos com estes filtros.', 70, y + 20); }
  }
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = T(24);
  ctx.fillText('Modelo heurístico · não adivinha o futuro · 18+', 70, H - 50);
  return new Promise(res => c.toBlob(bl => res(bl), 'image/png'));
};
function shareMatch(i) {
  const m = matches[i];
  if (!m) return;
  shareOut(matchShareText(m), 'match', { m }, `jogo-${normTxt(m.home + '-' + m.away).replace(/\s+/g, '-')}.png`);
}
function shareCalendar() {
  const list = calendarList();
  shareOut(calendarShareText(list), 'cal', { list }, `calendario-${isoDay(new Date())}.png`);
}
