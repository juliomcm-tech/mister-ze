/* =====================================================================
   v50 · Campo do jogo (substitui o «XI provável» desenhado à mão)
   - Onzes oficiais (saem ~1h antes): as duas equipas no esquema real, com marcadores destacados
   - Antes disso: ameaças de golo e quem está de fora, de cada lado
   - Sem dados do jogo, o campo não aparece
   ===================================================================== */
(function () {
  const css = `
.zpitch-wrap{margin:12px 0;}
.zpitch-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:.78rem;margin-bottom:6px;}
.zpitch-h b{white-space:nowrap;color:var(--lime,#c6f432);letter-spacing:.03em;text-transform:uppercase;font-size:.74rem;}
.zpitch{position:relative;width:100%;aspect-ratio:3/4;max-height:560px;border-radius:12px;overflow:hidden;border:1px solid #1f6b3a;
  background:repeating-linear-gradient(180deg,#1b6b36 0 10%,#1e7a3d 10% 20%);}
.zpitch:before{content:"";position:absolute;inset:4%;border:2px solid rgba(255,255,255,.45);border-radius:4px;}
.zpitch:after{content:"";position:absolute;left:4%;right:4%;top:50%;border-top:2px solid rgba(255,255,255,.45);}
.zp-circle{position:absolute;left:50%;top:50%;width:22%;aspect-ratio:1;transform:translate(-50%,-50%);border:2px solid rgba(255,255,255,.45);border-radius:50%;}
.zp-box{position:absolute;left:28%;width:44%;height:11%;border:2px solid rgba(255,255,255,.45);}
.zp-box.t{top:4%;border-top:0}.zp-box.b{bottom:4%;border-bottom:0}
.zp-p{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;width:20%;pointer-events:none;}
.zp-dot{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:800 .62rem/1 system-ui,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.5);}
.zp-p.h .zp-dot{background:#c6f432;color:#0b1a05;}
.zp-p.a .zp-dot{background:#e2e8f0;color:#0f172a;}
.zp-n{margin-top:2px;font:600 .6rem/1.1 system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.zp-g{position:absolute;top:-6px;right:calc(50% - 20px);font-size:.58rem;background:#0f172a;color:#fde047;border-radius:6px;padding:0 3px;}
.zp-team{position:absolute;left:6%;font:800 .66rem/1 system-ui,sans-serif;color:rgba(255,255,255,.85);text-shadow:0 1px 2px #000;}
.zp-team.t{top:5.5%}.zp-team.b{bottom:5.5%}
.zp-half{position:absolute;left:6%;right:6%;display:flex;flex-direction:column;gap:6px;font-size:.78rem;color:#f1f5f9;text-shadow:0 1px 2px rgba(0,0,0,.6);}
.zp-half.t{top:7%}.zp-half.b{bottom:7%}
.zp-chip{display:inline-block;background:rgba(15,23,42,.72);border-radius:8px;padding:3px 7px;margin:2px 4px 0 0;font-size:.74rem;}
.zpitch-notes{font-size:.8rem;line-height:1.5;margin-top:6px;}
`;
  try { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); } catch (e) {}
})();

/* a ficha guarda o onze com posições para o desenho */
buildBoard = (function (prev) {
  return function (m, scorers, rosters, lineups) {
    const b = prev(m, scorers, rosters, lineups);
    try { if (lineups && m.espn) b.xi = { h: (lineups[m.espn.h] && lineups[m.espn.h].xi) || null, a: (lineups[m.espn.a] && lineups[m.espn.a].xi) || null }; } catch (e) {}
    return b;
  };
})(buildBoard);

/* profundidade da posição no campo: 0 GR, 1 defesa, 2 médio defensivo/centro, 3 médio ofensivo, 4 avançado */
function posDepth(p) {
  const a = String(p || '').toUpperCase();
  if (a === 'G' || a === 'GK') return 0;
  if (/WB/.test(a)) return 1.5;
  if (/^(DM|CDM)/.test(a)) return 2;
  if (/^(CD|CB|D|LB|RB|SW)/.test(a)) return 1;
  if (/^(AM|CAM)/.test(a)) return 3;
  if (/^(F|CF|ST|LW|RW|SS|W)/.test(a) || /-F$/.test(a)) return 4;
  if (/^(M|CM|LM|RM)/.test(a)) return 2.2;
  return 2.5;
}
function posSide(p) { const a = String(p || '').toUpperCase(); return /^L/.test(a) ? 0 : /-L$/.test(a) ? 1 : /^R/.test(a) ? 4 : /-R$/.test(a) ? 3 : 2; }
/** reparte o onze em linhas (GR + linhas do esquema), cada linha da esquerda para a direita */
function xiRows(xi, formation) {
  const list = (xi || []).filter(p => p && p.n).slice(0, 11);
  if (list.length < 9) return null;
  const sorted = list.slice().sort((x, y) => posDepth(x.pos) - posDepth(y.pos) || (x.fp || 0) - (y.fp || 0));
  const gk = sorted[0];
  let counts = String(formation || '').split('-').map(Number).filter(n => n > 0);
  const out = sorted.slice(1);
  if (counts.reduce((s, n) => s + n, 0) !== out.length) {
    // sem esquema: agrupa pela posição
    counts = []; let cur = null;
    out.forEach(p => { const d = Math.round(posDepth(p.pos)); if (d !== cur) { counts.push(0); cur = d; } counts[counts.length - 1]++; });
  }
  const rows = []; let i = 0;
  counts.forEach(c => { rows.push(out.slice(i, i + c).sort((x, y) => posSide(x.pos) - posSide(y.pos) || (x.fp || 0) - (y.fp || 0))); i += c; });
  return { gk, rows };
}
function shortName(n) {
  const parts = String(n || '').trim().split(/\s+/);
  const last = parts.length > 1 ? parts.slice(-1)[0] : parts[0];
  const s = /^(de|da|dos|van|von|di|el|al|mac|mc|le|la|ten|ter)$/i.test(parts[parts.length - 2] || '') ? parts.slice(-2).join(' ') : last;
  return s.length > 11 ? s.slice(0, 10) + '…' : s;
}
function pitchHTML(m) {
  const st = typeof studyFor === 'function' ? studyFor(m) : null;
  const b = (st && st.board) || (typeof boardFor === 'function' && boardFor(m));
  if (!b || !b.home || !b.away) return '';
  const goalsOf = (list, name) => { const p = (list || []).find(x => nameMatch(x.name, name)); return p ? p.goals : 0; };
  const notes = [];
  const outOf = (list) => (list || []).filter(p => p.status === 'lesão' || (p.inj && p.status !== 'titular' && p.status !== 'suplente')).sort((a, c) => c.goals - a.goals).slice(0, 4);
  const benchStars = (list) => (list || []).filter(p => p.status === 'suplente' && p.goals >= 3);
  const threats = (list) => (list || []).filter(p => p.status !== 'fora' && p.status !== 'lesão' && p.prob > 0.08).slice(0, 3);
  const pctS = x => Math.round(x * 100) + '%';
  [['h', b.home, m.home], ['a', b.away, m.away]].forEach(([, list, team]) => {
    const o = outOf(list), bs = benchStars(list);
    if (o.length) notes.push(`🚑 <b>${esc(team)}</b> sem ${o.map(p => `${esc(p.name)}${p.goals ? ` (${p.goals} golos)` : ''}`).join(', ')}`);
    if (bs.length) notes.push(`🪑 <b>${esc(team)}</b>: ${bs.map(p => `${esc(p.name)} (${p.goals} golos)`).join(', ')} no banco`);
  });
  const rh = b.lineupKnown && b.xi ? xiRows(b.xi.h, b.formation && b.formation.h) : null;
  const ra = b.lineupKnown && b.xi ? xiRows(b.xi.a, b.formation && b.formation.a) : null;
  let field = '', status;
  if (rh && ra) {
    status = 'onzes oficiais';
    const dot = (p, side, x, y, list) => { const g = goalsOf(list, p.n); return `<div class="zp-p ${side}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;"><div class="zp-dot">${esc(String(p.j || '').slice(0, 2)) || '•'}</div>${g ? `<span class="zp-g">⚽${g}</span>` : ''}<div class="zp-n">${esc(shortName(p.n))}</div></div>`; };
    const half = (R, side, list) => {
      const home = side === 'h', H = [];
      const yGk = home ? 92 : 8, yEnd = home ? 57 : 43, n = R.rows.length;
      H.push(dot(R.gk, side, 50, yGk, list));
      R.rows.forEach((row, k) => {
        const y = yGk + (yEnd - yGk) * (k + 1) / n;
        row.forEach((p, i) => { let x = (i + 1) / (row.length + 1) * 100; if (!home) x = 100 - x; H.push(dot(p, side, x, y, list)); });
      });
      return H.join('');
    };
    field = `<div class="zpitch"><div class="zp-circle"></div><div class="zp-box t"></div><div class="zp-box b"></div>
      <div class="zp-team t">${esc(m.away)}${b.formation && b.formation.a ? ' · ' + esc(b.formation.a) : ''}</div><div class="zp-team b">${esc(m.home)}${b.formation && b.formation.h ? ' · ' + esc(b.formation.h) : ''}</div>
      ${half(ra, 'a', b.away)}${half(rh, 'h', b.home)}</div>`;
  } else {
    status = 'onzes saem ~1h antes';
    const halfTxt = (list, team) => {
      const t = threats(list), o = outOf(list);
      return `<div><b>${esc(team)}</b></div>`
        + `<div>🎯 ${t.length ? t.map(p => `<span class="zp-chip">${esc(shortName(p.name))} ${pctS(p.prob)}</span>`).join('') : '<span class="zp-chip">sem marcadores claros</span>'}</div>`
        + (o.length ? `<div>🚑 ${o.map(p => `<span class="zp-chip">${esc(shortName(p.name))}</span>`).join('')}</div>` : '');
    };
    field = `<div class="zpitch" style="aspect-ratio:4/3;"><div class="zp-circle"></div>
      <div class="zp-half t">${halfTxt(b.away, m.away)}</div><div class="zp-half b">${halfTxt(b.home, m.home)}</div></div>`;
  }
  return `<div class="zpitch-wrap"><div class="zpitch-h"><b>⚽ Campo do jogo</b><span class="muted">${status}</span></div>${field}
    ${notes.length ? `<div class="zpitch-notes">${notes.join('<br>')}</div>` : ''}
    <div class="muted" style="font-size:.72rem;margin-top:4px;">${rh && ra ? '⚽ = golos na época. Fonte: ficha oficial (ESPN).' : '🎯 = probabilidade de marcar neste jogo. Volta ~1h antes para ver os onzes.'}</div></div>`;
}
/* o desenho antigo (só a equipa da casa, num 4-2-3-1 inventado) dá lugar ao campo real */
pitchXI = function (m) {
  try { return `<div id="zPitchSlot">${pitchHTML(m)}</div>`; } catch (e) { return '<div id="zPitchSlot"></div>'; }
};
function pitchRefresh(m) { const el = document.getElementById('zPitchSlot'); if (el && m) { try { el.innerHTML = pitchHTML(m); } catch (e) {} } }
studyInModal = (function (prev) {
  return async function (btn) {
    const r = await prev.apply(this, arguments);
    try { pitchRefresh(window._modalMatch); } catch (e) {}
    return r;
  };
})(studyInModal);
