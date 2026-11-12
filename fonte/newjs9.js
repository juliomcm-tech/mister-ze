/* =====================================================================
   v24 · Partilhar (WhatsApp) + atualizar resultados à vista
   ===================================================================== */

/* ---------- Texto de uma aposta ---------- */
function betLegsOf(bet) {
  if (Array.isArray(bet.legs) && bet.legs.length && bet.legs.some(l => l && (l.sel || l.home))) return bet.legs;
  const parts = String(bet.match || '').split(/\s+vs\.?\s+/i);
  return [{ home: parts[0] || '', away: parts[1] || '', sel: bet.pick, odd: bet.odd }];
}
const ST_TXT = { open: '⏳ Aberta', win: '✅ Ganha', loss: '❌ Perdida', void: '↩️ Nula', cancel: '🗑️ Anulada' };
function betShareText(bet, who) {
  const legs = betLegsOf(bet);
  const owner = who === 'ze' ? 'Mister Zé' : ((userProfile().name || '').trim() || 'Eu');
  const lines = [];
  lines.push(`🎟️ ${who === 'ze' ? 'Aposta do Mister Zé' : 'A minha aposta'} — ${bet.match}`);
  legs.forEach(l => {
    const jogo = l.home && l.away ? ` (${l.home} vs ${l.away})` : '';
    lines.push(`• ${l.sel || bet.pick}${jogo}${Number(l.odd) > 1 && legs.length > 1 ? ' @ ' + Number(l.odd).toFixed(2) : ''}`);
  });
  lines.push(`Odd ${Number(bet.odd).toFixed(2)} · ${eur(bet.stake)} → ${bet.status === 'win' ? 'ganhou ' + eur(bet.stake * bet.odd) : 'ganhos potenciais ' + eur(bet.stake * bet.odd)}`);
  lines.push(`Estado: ${ST_TXT[bet.status] || bet.status}${bet.finalScores ? ' · ' + bet.finalScores : ''}`);
  const p = who === 'ze' ? bet.pUsed : bet.zeP;
  const ev = who === 'ze' ? bet.ev : bet.zeEV;
  if (typeof p === 'number') lines.push(`🤖 Mister Zé: dá-lhe ${pct(p)} de hipótese${typeof ev === 'number' ? ` · valor ${pctS(ev)}` : ''}${who === 'you' && bet.stakePct > 0.1 ? ` · stake de ${Math.round(bet.stakePct * 100)}% da banca 🚨` : ''}`);
  lines.push(`— ${owner} · Duelo ${pname()} vs Mister Zé`);
  return lines.join('\n');
}
function duelShareText() {
  const b = loadBank();
  const a = walletStats(b, 'you'), z = walletStats(b, 'ze');
  const L = duelLeader(b);
  const nm = pname();
  return [
    `⚔️ Duelo ${nm} vs Mister Zé — época ${b.season}`,
    `👤 ${nm}: ${eur(a.equity)} (${pctS(a.roiCap)}) · ${a.nWin}V ${a.nLoss}D · acerto ${pctP(a.hit)}`,
    `🤖 Mister Zé: ${eur(z.equity)} (${pctS(z.roiCap)}) · ${z.nWin}V ${z.nLoss}D · acerto ${pctP(z.hit)}`,
    L.who === 'ze' ? '🏆 Lidera o Zé. A matemática agradece.' : L.who === 'you' ? `🏆 Lidera ${nm}. Por agora.` : '🤝 Empate técnico.',
  ].join('\n');
}
function proposalShareText() {
  const pr = window._zeProps || zeProposals();
  const out = ['🧾 O boletim do Mister Zé'];
  if (pr.singles.length) { out.push('🧠 Simples com valor:'); pr.singles.forEach(l => out.push(`• ${l.sel}${l.home && l.away ? ` (${l.home} vs ${l.away})` : ''} @ ${l.odd.toFixed(2)} — ${pct(l.p)}`)); }
  if (pr.dupla) out.push(`🎯 Dupla: ${pr.dupla.legs.map(l => l.sel).join(' + ')} — odd ${pr.dupla.O.toFixed(2)}, acerta ${pct(pr.dupla.P)}`);
  if (pr.louca) out.push(`🎰 Loucura controlada: ${pr.louca.legs.length} seleções — odd ${pr.louca.O.toFixed(2)}, acerta ${pct(pr.louca.P)}`);
  if (!pr.singles.length && !pr.dupla) out.push('Hoje o Zé não jogava. 🙃');
  out.push(`— Duelo ${pname()} vs Mister Zé`);
  return out.join('\n');
}

/* ---------- Imagem (cartão) para partilhar ---------- */
function svgToImg(svg) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  });
}
function wrapText(ctx, text, x, y, maxW, lh, maxLines) {
  const words = String(text).split(/\s+/); let line = '', n = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y); y += lh; n++; line = words[i];
      if (maxLines && n >= maxLines - 1) { const rest = words.slice(i).join(' '); let t = rest; while (ctx.measureText(t + '…').width > maxW && t.length) t = t.slice(0, -1); ctx.fillText(rest === t ? t : t + '…', x, y); return y + lh; }
    } else line = test;
  }
  if (line) { ctx.fillText(line, x, y); y += lh; }
  return y;
}
async function cardImage(kind, data) {
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
  const face = await svgToImg(zeFace(kind === 'bet' && data.who === 'you' ? 'pensativo' : 'gozao', 160));
  if (face) ctx.drawImage(face, 70, 60, 150, 150);
  ctx.fillStyle = '#c8f53c'; ctx.font = F(800, 30); ctx.fillText('MISTER ZÉ FC', 250, 110);
  ctx.fillStyle = '#ffffff'; ctx.font = F(800, 64);
  const title = kind === 'bet' ? (data.who === 'ze' ? 'APOSTA DO ZÉ' : 'A MINHA APOSTA') : kind === 'duel' ? 'DUELO' : 'BOLETIM DO ZÉ';
  ctx.fillText(title, 250, 175);
  ctx.fillStyle = '#a99ec4'; ctx.font = T(28); ctx.fillText(`${pname()} vs Mister Zé · ${dtFmt(Date.now())}`, 250, 215);
  let y = 300;
  const panel = (h) => { ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; const r = 24; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(60, y, W - 120, h, r) : ctx.rect(60, y, W - 120, h); ctx.fill(); ctx.stroke(); };
  if (kind === 'bet') {
    const bet = data.bet, legs = betLegsOf(bet);
    const rowH = 132, h = 40 + legs.length * rowH;
    panel(Math.min(h, 760));
    let yy = y + 40;
    legs.slice(0, 5).forEach((l, i) => {
      ctx.fillStyle = '#ffffff'; ctx.font = T(40, 700);
      ctx.fillText((l.sel || bet.pick).slice(0, 34), 100, yy + 40);
      if (Number(l.odd) > 1 && legs.length > 1) { ctx.textAlign = 'right'; ctx.fillStyle = '#c8f53c'; ctx.font = F(800, 46); ctx.fillText(Number(l.odd).toFixed(2), W - 100, yy + 42); ctx.textAlign = 'left'; }
      ctx.fillStyle = '#a99ec4'; ctx.font = T(30);
      if (l.home && l.away) ctx.fillText(`${l.home} vs ${l.away}`.slice(0, 46), 100, yy + 88);
      if (i < Math.min(legs.length, 5) - 1) { ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.moveTo(100, yy + rowH - 10); ctx.lineTo(W - 100, yy + rowH - 10); ctx.stroke(); }
      yy += rowH;
    });
    if (legs.length > 5) { ctx.fillStyle = '#a99ec4'; ctx.font = T(28); ctx.fillText(`+ ${legs.length - 5} seleções`, 100, yy + 10); }
    y += Math.min(h, 760) + 40;
    const box = (x, w, lab, val, col) => { ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x, y, w, 150); ctx.fillStyle = '#a99ec4'; ctx.font = T(26, 700); ctx.fillText(lab.toUpperCase(), x + 26, y + 46); ctx.fillStyle = col || '#ffffff'; ctx.font = F(800, 58); ctx.fillText(val, x + 26, y + 118); };
    const bw = (W - 120 - 40) / 3;
    box(60, bw, 'Odd', Number(bet.odd).toFixed(2), '#c8f53c');
    box(60 + bw + 20, bw, 'Aposta', eur(bet.stake));
    box(60 + 2 * (bw + 20), bw, bet.status === 'win' ? 'Ganhou' : 'Potencial', eur(bet.stake * bet.odd), bet.status === 'win' ? '#2fd27a' : '#ffffff');
    y += 215;
    ctx.fillStyle = bet.status === 'win' ? '#2fd27a' : bet.status === 'loss' ? '#ff7a8f' : '#ffc233'; ctx.font = F(800, 46);
    ctx.fillText((ST_TXT[bet.status] || '').replace(/^\S+\s/, '').toUpperCase() + (bet.finalScores ? '  ·  ' + bet.finalScores : ''), 70, y);
    y += 70;
    const p = data.who === 'ze' ? bet.pUsed : bet.zeP;
    if (typeof p === 'number') { ctx.fillStyle = '#f2eefb'; ctx.font = T(32); y = wrapText(ctx, `🤖 O Zé dá-lhe ${pct(p)} de hipótese${data.who === 'you' && bet.stakePct > 0.1 ? ` — e acha que ${Math.round(bet.stakePct * 100)}% da banca é loucura.` : '.'}`, 70, y, W - 140, 44, 3); }
  } else if (kind === 'duel') {
    const b = loadBank(); const a = walletStats(b, 'you'), z = walletStats(b, 'ze'); const L = duelLeader(b);
    const half = (W - 140) / 2;
    [[a, '#4c95f0', pname().toUpperCase()], [z, '#c8f53c', 'MISTER ZÉ']].forEach(([s, col, nm], i) => {
      const x = 60 + i * (half + 20);
      ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x, y, half, 560);
      ctx.fillStyle = col; ctx.fillRect(x, y, half, 8);
      ctx.fillStyle = '#ffffff'; ctx.font = F(800, 44); ctx.fillText(nm.slice(0, 14), x + 30, y + 80);
      ctx.fillStyle = col; ctx.font = F(800, 86); ctx.fillText(eur(s.equity), x + 30, y + 190);
      ctx.fillStyle = s.roiCap >= 0 ? '#2fd27a' : '#ff7a8f'; ctx.font = F(800, 46); ctx.fillText(pctS(s.roiCap), x + 30, y + 260);
      ctx.fillStyle = '#a99ec4'; ctx.font = T(30);
      [`${s.nWin} vitórias · ${s.nLoss} derrotas`, `Acerto ${pctP(s.hit)}`, `Yield ${pctS(s.yield)}`, `Em jogo ${eur(s.exposure)}`].forEach((t, k) => ctx.fillText(t, x + 30, y + 340 + k * 50));
    });
    y += 620;
    ctx.fillStyle = '#ffffff'; ctx.font = F(800, 56); ctx.textAlign = 'center';
    ctx.fillText(L.who === 'ze' ? '🏆 LIDERA O ZÉ' : L.who === 'you' ? `🏆 LIDERA ${pname().toUpperCase()}` : '🤝 EMPATE', W / 2, y); ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = '#f2eefb'; ctx.font = T(34);
    proposalShareText().split('\n').slice(1, -1).forEach(line => { y = wrapText(ctx, line, 70, y, W - 140, 48, 3) + 8; });
  }
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = T(24);
  ctx.fillText('Bancas virtuais · 18+ · joga com responsabilidade', 70, H - 50);
  return new Promise(res => c.toBlob(bl => res(bl), 'image/png'));
}

/* ---------- Partilhar: imagem + texto → WhatsApp ---------- */
async function shareOut(text, kind, data, fname) {
  let file = null;
  try { const blob = await cardImage(kind, data); if (blob) file = new File([blob], fname || 'mister-ze.png', { type: 'image/png' }); } catch (e) { console.warn(e); }
  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  shareSheet(text, file);
}
function shareSheet(text, file) {
  const url = file ? URL.createObjectURL(file) : null;
  const html = `<h3>📤 Partilhar</h3>
    <div class="modal-meta">Este browser não abre a partilha direta. Escolhe:</div>
    ${url ? `<img src="${url}" alt="Cartão da aposta" style="width:100%;border-radius:10px;margin-bottom:10px;border:1px solid var(--line2);">` : ''}
    <div class="btn-row">
      <a class="btn btn-lime" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">💬 Abrir no WhatsApp</a>
      <button class="btn" onclick="copyText(${JSON.stringify(text).replace(/"/g, '&quot;')}).then(()=>toast('📋 Texto copiado'))">📋 Copiar texto</button>
      ${url ? `<a class="btn" href="${url}" download="mister-ze.png">🖼️ Guardar imagem</a>` : ''}
    </div>
    <pre style="white-space:pre-wrap;font-family:inherit;font-size:.84rem;background:var(--bg2);padding:10px;border-radius:8px;">${esc(text)}</pre>`;
  const m = document.getElementById('modal-content');
  if (m) m.classList.remove('worst-modal');
  setHTML('modal-body', html);
  const o = document.getElementById('modal'); if (o) o.classList.add('open');
}
function shareBet(id, who) {
  const b = loadBank();
  const bet = (who === 'ze' ? b.zeBets : b.bets).find(x => String(x.id) === String(id));
  if (!bet) return;
  shareOut(betShareText(bet, who), 'bet', { bet, who }, `aposta-${isoDay(new Date())}.png`);
}
function shareDuel() { shareOut(duelShareText(), 'duel', {}, `duelo-${isoDay(new Date())}.png`); }
function shareProposal() { shareOut(proposalShareText(), 'prop', {}, `boletim-do-ze-${isoDay(new Date())}.png`); }

/* ---------- Última atualização (visível) ---------- */
function lastUpdateTxt() {
  const p = lsGet(LIVE_KEY, null);
  if (!p || !p.generatedAt) return 'Resultados nunca atualizados';
  const min = Math.round((Date.now() - new Date(p.generatedAt).getTime()) / 60000);
  return 'Atualizado ' + (min < 1 ? 'agora' : min < 60 ? `há ${min} min` : min < 1440 ? `há ${Math.round(min / 60)} h` : `há ${Math.round(min / 1440)} dias`);
}
function renderUpdateInfo() {
  const open = loadBank().bets.concat(loadBank().zeBets).filter(x => x.status === 'open').length;
  document.querySelectorAll('.upd-info').forEach(el => { el.textContent = `${lastUpdateTxt()}${open ? ` · ${open} aposta${open > 1 ? 's' : ''} à espera de resultado` : ''}`; });
}
const _renderBancaV23 = renderBanca;
renderBanca = function () { _renderBancaV23(); try { renderUpdateInfo(); } catch (e) {} };
const _atualizarTudoV23 = atualizarTudo;
let _atuInflight = null, _atuLoudPending = false;
/** Um só «Atualizar» de cada vez: quem chega durante um em curso espera pelo mesmo resultado */
atualizarTudo = function (opts) {
  const loud = !(opts && opts.quiet);
  if (_atuInflight) {
    if (loud) { _atuLoudPending = true; toast('⏳ Já estou a atualizar — espera só um bocadinho…'); }
    return _atuInflight;
  }
  _atuLoudPending = false;
  document.querySelectorAll('.btn-upd').forEach(b => { b.disabled = true; b.dataset.l = b.dataset.l || b.innerHTML; b.innerHTML = '⏳ A atualizar…'; });
  _atuInflight = (async () => {
    try { await _atualizarTudoV23(opts); }
    finally {
      document.querySelectorAll('.btn-upd').forEach(b => { b.disabled = false; if (b.dataset.l) b.innerHTML = b.dataset.l; });
      renderUpdateInfo();
      if (_atuLoudPending && !loud) { const st = document.getElementById('liveStatus'); toast(st && st.textContent ? st.innerHTML : '✅ Atualizado.'); }
      _atuInflight = null; _atuLoudPending = false;
    }
  })();
  return _atuInflight;
};
