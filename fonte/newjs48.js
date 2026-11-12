/* =====================================================================
   v56 · 📊 Estatísticas do Zé (no «Mais») + travão automático
   - Arquivo próprio das previsões decididas (o diário só guarda as últimas 400): dá para ver dia, semana, mês.
   - Aposta lógica, favorito 1X2, boletim seguro, marcadores, desafios e duelo.
   - Onde falha mais: por liga, por tipo de aposta («análise») e por confiança.
   - Exportar CSV (abre no Excel) e copiar resumo.
   - Travão automático: liga + tipo de aposta com falhas a mais (provado, não azar) sai dos desafios e do
     boletim seguro até recuperar. As probabilidades não mudam — o Zé só deixa de as propor aí.
   ===================================================================== */
VIEWS.push('stats');
const ZARCH_KEY = 'ze_archive_v1';
function zarchLoad() { return lsGet(ZARCH_KEY, { v: 1, rows: {} }); }
/* copia para o arquivo tudo o que já foi decidido (diário, marcadores, boletim seguro) */
function zarchSync() {
  const A = zarchLoad(); let ch = false;
  const put = (id, row) => { if (!A.rows[id] || A.rows[id].w !== row.w) { A.rows[id] = row; ch = true; } };
  try {
    Object.values(diaryLoad().items).forEach(x => {
      if (!x.res || !x.g || !x.pick || x.g.pick == null || x.backfill) return;
      put('p|' + x.key, { t: 'aposta', d: String(x.kick || '').slice(0, 10), lg: x.league || '?', c: x.code || '', j: `${x.home} vs ${x.away}`, k: x.pick.k, s: x.pick.label || x.pick.k, p: x.pick.p, w: x.g.pick, r: x.res, f: x.g.fav, cf: x.conf || '' });
    });
  } catch (e) {}
  try {
    Object.entries(scoLog().picks).forEach(([id, x]) => { if (x.w == null) return; put('s|' + id, { t: 'marcador', d: new Date(x.k).toISOString().slice(0, 10), lg: '', c: '', j: `${x.h} vs ${x.a}`, k: 'scorer', s: `${x.n} marca`, p: x.p, w: x.w, r: x.res || '', top3: x.top3 || 0 }); });
  } catch (e) {}
  try {
    Object.entries(safeLog().legs).forEach(([id, x]) => { if (x.w == null) return; put('b|' + id, { t: 'seguro', d: new Date(x.d).toISOString().slice(0, 10), lg: x.lg || '', c: '', j: `${x.h} vs ${x.a}`, k: x.k, s: x.k, p: x.p, w: x.w, r: x.res || '' }); });
  } catch (e) {}
  const ids = Object.keys(A.rows);
  if (ids.length > 3000) { ids.sort((a, b) => A.rows[a].d.localeCompare(A.rows[b].d)).slice(0, ids.length - 3000).forEach(id => delete A.rows[id]); ch = true; }
  if (ch) lsSet(ZARCH_KEY, A);
  return A;
}
applyLive = (function (prev) { return function () { const r = prev.apply(this, arguments); try { zarchSync(); ZBRAKE_MEM = null; } catch (e) {} return r; }; })(applyLive);

/* ---------- travão automático ---------- */
let ZBRAKE_MEM = null;
function zeBrakes() {
  if (ZBRAKE_MEM && Date.now() - ZBRAKE_MEM.t < 5 * 60e3) return ZBRAKE_MEM.v;
  const G = {};
  Object.values(zarchLoad().rows).filter(r => r.t === 'aposta' && r.c).forEach(r => { const k = r.c + '|' + PICK_FAMILY(r.k); const g = G[k] = G[k] || { n: 0, w: 0, p: 0, v: 0, lg: r.lg, fam: PICK_FAMILY(r.k), c: r.c }; g.n++; g.w += r.w; g.p += r.p; g.v += r.p * (1 - r.p); });
  const v = Object.values(G).filter(g => g.n >= 12).map(g => ({ ...g, hit: g.w / g.n, exp: g.p / g.n, z: (g.w - g.p) / Math.sqrt(Math.max(1e-6, g.v)) }))
    .filter(g => g.hit - g.exp <= -0.12 && g.z <= -2).sort((a, b) => a.z - b.z);
  ZBRAKE_MEM = { t: Date.now(), v };
  return v;
}
function zeBraked(m, k) { try { if (!m || !m.espn || !k) return null; const f = PICK_FAMILY(k); return zeBrakes().find(b => b.c === m.espn.code && b.fam === f) || null; } catch (e) { return null; } }
zeChallenges = (function (prev) { return function () { return (prev.apply(this, arguments) || []).filter(c => c.cat === 'valor' || !zeBraked(c.m, c.k2)); }; })(zeChallenges);
safeCandidates = (function (prev) { return function () { return (prev.apply(this, arguments) || []).filter(c => !zeBraked(c.m, c.key)); }; })(safeCandidates);

/* ---------- página ---------- */
let ZST_PER = 'all';
function zstRange(per) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const iso = d => isoDay(d);
  if (per === 'hoje') return [iso(t), iso(t)];
  if (per === '7') { const a = new Date(t); a.setDate(a.getDate() - 6); return [iso(a), iso(t)]; }
  if (per === '30') { const a = new Date(t); a.setDate(a.getDate() - 29); return [iso(a), iso(t)]; }
  return ['0000', '9999'];
}
function zstAgg(rows) { const n = rows.length, w = rows.reduce((s, r) => s + (r.w ? 1 : 0), 0), p = rows.reduce((s, r) => s + (+r.p || 0), 0); return { n, w, hit: n ? w / n : null, exp: n ? p / n : null }; }
function zstLine(lab, a, extra) {
  if (!a.n) return `<div class="zst-row"><span>${lab}</span><span class="muted">sem jogos decididos</span></div>`;
  const d = a.hit - a.exp, col = d >= -0.03 ? 'var(--lime)' : d >= -0.10 ? '#ffc233' : '#ff7a8f';
  return `<div class="zst-row"><span>${lab}</span><span><b style="color:${col}">${a.w}/${a.n} · ${Math.round(a.hit * 100)}%</b> <span class="muted">prometia ${Math.round(a.exp * 100)}%</span>${extra || ''}</span></div>`;
}
function zstGroup(rows, keyFn, min) {
  const G = {}; rows.forEach(r => { const k = keyFn(r); if (!k) return; (G[k] = G[k] || []).push(r); });
  return Object.entries(G).map(([k, L]) => ({ k, ...zstAgg(L) })).filter(g => g.n >= (min || 3)).sort((a, b) => (a.hit - a.exp) - (b.hit - b.exp));
}
function zstTable(title, G, note) {
  if (!G.length) return '';
  return `<div class="rx-h">${title}</div><div style="overflow-x:auto;"><table class="rx-t"><tr><th></th><th>jogos</th><th>acertou</th><th>prometia</th><th>diferença</th></tr>${G.map(g => { const d = Math.round((g.hit - g.exp) * 100); return `<tr><td>${esc(g.k)}</td><td>${g.n}</td><td>${Math.round(g.hit * 100)}%</td><td>${Math.round(g.exp * 100)}%</td><td class="${d >= 0 ? 'rx-pos' : 'rx-neg'}">${d >= 0 ? '+' : ''}${d}</td></tr>`; }).join('')}</table></div>${note ? `<div class="muted" style="font-size:.72rem;">${note}</div>` : ''}`;
}
function renderZeStats() {
  const box = document.getElementById('zeStatsBox'); if (!box) return;
  const A = zarchSync(), all = Object.values(A.rows), [a, b] = zstRange(ZST_PER);
  const R = all.filter(r => r.d >= a && r.d <= b);
  const ap = R.filter(r => r.t === 'aposta'), sc = R.filter(r => r.t === 'marcador'), sf = R.filter(r => r.t === 'seguro');
  const fav = ap.filter(r => r.f != null), favA = { n: fav.length, w: fav.filter(r => r.f).length };
  const bank = loadBank(), inPer = x => { const d = String(x.settledAt || x.at || '').slice(0, 10); return d >= a && d <= b; };
  const zb = bank.zeBets.filter(x => (x.status === 'win' || x.status === 'loss') && inPer(x)), ch = zb.filter(x => x.source === 'desafio-ze');
  const money = L => { const st = L.reduce((s, x) => s + (+x.stake || 0), 0), pr = L.reduce((s, x) => s + (x.status === 'win' ? x.stake * (x.odd - 1) : -x.stake), 0); return { n: L.length, w: L.filter(x => x.status === 'win').length, st, pr }; };
  const zm = money(zb), cm = money(ch);
  // por dia (últimos 14 com jogos) e por mês
  const byDay = zstGroup(ap, r => r.d, 1).sort((x, y) => y.k.localeCompare(x.k)).slice(0, 14);
  const byMonth = zstGroup(ap, r => r.d.slice(0, 7), 1).sort((x, y) => y.k.localeCompare(x.k));
  const brakes = zeBrakes();
  const per = [['hoje', 'Hoje'], ['7', '7 dias'], ['30', '30 dias'], ['all', 'Tudo']];
  box.innerHTML = `
    <div class="btn-row" style="margin-bottom:10px;">${per.map(([k, l]) => `<button class="btn btn-sm ${ZST_PER === k ? 'btn-lime' : ''}" onclick="ZST_PER='${k}'; renderZeStats()">${l}</button>`).join('')}</div>
    <div class="panel"><div class="panel-h"><span>🎯 Acertos do Zé</span><span class="muted">${R.length} previsões decididas</span></div><div class="panel-b">
      ${zstLine('💡 Aposta lógica', zstAgg(ap))}
      ${favA.n ? `<div class="zst-row"><span>🏆 Quem ganha (1X2)</span><span><b>${favA.w}/${favA.n} · ${Math.round(100 * favA.w / favA.n)}%</b> <span class="muted">o favorito do Zé</span></span></div>` : ''}
      ${zstLine('🛡️ Boletim seguro (seleções)', zstAgg(sf))}
      ${zstLine('⚽ Marcadores', zstAgg(sc), sc.filter(r => r.top3).length ? ` <span class="muted">· top 3: ${sc.filter(r => r.top3 && r.w).length}/${sc.filter(r => r.top3).length}</span>` : '')}
      <div class="zst-row"><span>⚔️ Duelo (apostas do Zé)</span><span>${zm.n ? `<b>${zm.w}/${zm.n}</b> · <b class="${zm.pr >= 0 ? 'rx-pos' : 'rx-neg'}">${zm.pr >= 0 ? '+' : ''}${eur2(zm.pr)} €</b> <span class="muted">(${zm.st ? Math.round(100 * zm.pr / zm.st) : 0}% do apostado)</span>` : '<span class="muted">sem apostas fechadas</span>'}</span></div>
      <div class="zst-row"><span>🎯 Desafios aceites</span><span>${cm.n ? `<b>${cm.w}/${cm.n}</b> · <b class="${cm.pr >= 0 ? 'rx-pos' : 'rx-neg'}">${cm.pr >= 0 ? '+' : ''}${eur2(cm.pr)} €</b>` : '<span class="muted">nenhum fechado</span>'}</span></div>
      <div class="muted" style="font-size:.74rem;margin-top:6px;">Verde = acerta o que promete · amarelo = um pouco abaixo · vermelho = promete demais. Com menos de 30 jogos os números ainda mexem muito.</div>
    </div></div>
    <div class="panel"><div class="panel-h"><span>🔎 Onde o Zé falha mais</span><span class="muted">aposta lógica · pior primeiro</span></div><div class="panel-b">
      ${zstTable('Por liga', zstGroup(ap, r => r.lg, 3))}
      ${zstTable('Por tipo de aposta', zstGroup(ap, r => PICK_FAMILY(r.k), 3))}
      ${zstTable('Por confiança', zstGroup(ap, r => CONF_BAND(r.p), 3), 'Diferença = acertou − prometia, em pontos. Negativo = otimista demais.')}
      ${!ap.length ? '<div class="muted">Ainda sem previsões decididas neste período.</div>' : ''}
    </div></div>
    <div class="panel"><div class="panel-h"><span>🧯 Travão automático</span><span class="muted">${brakes.length ? brakes.length + ' ativo' + (brakes.length > 1 ? 's' : '') : 'nenhum ativo'}</span></div><div class="panel-b" style="font-size:.86rem;">
      ${brakes.length ? brakes.map(g => `<div class="zst-row"><span>⛔ ${esc(g.lg)} · ${esc(g.fam)}</span><span><b style="color:#ff7a8f">${g.w}/${g.n} · ${Math.round(g.hit * 100)}%</b> <span class="muted">prometia ${Math.round(g.exp * 100)}%</span></span></div>`).join('') : '<div class="muted">O Zé está a acertar dentro do que promete em todas as ligas com jogos suficientes.</div>'}
      <div class="hint" style="margin-top:8px;">Quando uma liga + tipo de aposta tem <b>12 ou mais jogos</b> e o Zé acerta <b>12 pontos abaixo</b> do que promete — e a diferença é grande demais para ser azar — essa combinação sai sozinha dos <b>desafios</b> e do <b>boletim seguro</b>. Volta quando os resultados recuperarem. As contas não mudam; ele só deixa de te propor onde está provado que falha. Correções ao modelo em si (golos, ligas novas) continuam a ser feitas por nós com o log e simulações.</div>
    </div></div>
    <div class="panel"><div class="panel-h"><span>📅 Dia a dia · mês a mês</span><span class="muted">aposta lógica</span></div><div class="panel-b">
      ${byDay.length ? `<div style="overflow-x:auto;"><table class="rx-t"><tr><th>dia</th><th>jogos</th><th>acertou</th><th>prometia</th></tr>${byDay.map(g => `<tr><td>${g.k.slice(8, 10)}/${g.k.slice(5, 7)}</td><td>${g.n}</td><td><b>${g.w}</b> (${Math.round(g.hit * 100)}%)</td><td>${Math.round(g.exp * 100)}%</td></tr>`).join('')}</table></div>` : '<div class="muted">Sem dias com jogos decididos.</div>'}
      ${byMonth.length > 0 ? `<div class="rx-h">Por mês</div><div style="overflow-x:auto;"><table class="rx-t"><tr><th>mês</th><th>jogos</th><th>acertou</th><th>prometia</th></tr>${byMonth.map(g => `<tr><td>${g.k.slice(5, 7)}/${g.k.slice(0, 4)}</td><td>${g.n}</td><td><b>${g.w}</b> (${Math.round(g.hit * 100)}%)</td><td>${Math.round(g.exp * 100)}%</td></tr>`).join('')}</table></div>` : ''}
    </div></div>
    <div class="panel"><div class="panel-h"><span>📤 Exportar</span><span class="muted">${all.length} linhas no arquivo</span></div><div class="panel-b">
      <div class="btn-row"><button class="btn btn-lime" onclick="zstExport()">📄 Exportar CSV (Excel)</button><button class="btn" onclick="zstCopy()">📋 Copiar resumo</button></div>
      <div class="muted" style="font-size:.74rem;margin-top:6px;">O CSV tem cada previsão decidida: dia, tipo (aposta lógica, marcador, seguro), liga, jogo, previsão, probabilidade, resultado e se acertou. Exporta o período escolhido em cima.</div>
    </div></div>`;
}
function zstRows() { const [a, b] = zstRange(ZST_PER); return Object.values(zarchSync().rows).filter(r => r.d >= a && r.d <= b).sort((x, y) => x.d.localeCompare(y.d)); }
function zstExport() {
  const q = v => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const T = { aposta: 'aposta lógica', marcador: 'marcador', seguro: 'boletim seguro' };
  const lines = ['dia;tipo;liga;jogo;previsao;probabilidade;resultado;acertou'].concat(zstRows().map(r => [r.d, T[r.t] || r.t, r.lg, r.j, r.s, String(Math.round(r.p * 1000) / 10).replace('.', ',') + '%', r.r, r.w ? 'sim' : 'não'].map(q).join(';')));
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const name = `mister-ze-previsoes-${isoDay(new Date())}.csv`;
  const file = new File([blob], name, { type: 'text/csv' });
  (async () => {
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    toast(`📄 ${lines.length - 1} previsões exportadas.`);
  })();
}
function zstCopy() {
  const rows = zstRows(), ap = rows.filter(r => r.t === 'aposta'), sc = rows.filter(r => r.t === 'marcador'), sf = rows.filter(r => r.t === 'seguro');
  const f = (lab, L) => { const g = zstAgg(L); return g.n ? `${lab}: ${g.w}/${g.n} (${Math.round(g.hit * 100)}%, prometia ${Math.round(g.exp * 100)}%)` : `${lab}: —`; };
  const worst = zstGroup(ap, r => r.lg, 5)[0], wf = zstGroup(ap, r => PICK_FAMILY(r.k), 5)[0];
  const t = [`📊 Mister Zé · ${({ hoje: 'hoje', 7: 'últimos 7 dias', 30: 'últimos 30 dias', all: 'desde o início' })[ZST_PER]}`, f('Aposta lógica', ap), f('Boletim seguro', sf), f('Marcadores', sc)];
  if (worst && worst.hit < worst.exp) t.push(`Onde falha mais: ${worst.k} (${Math.round(worst.hit * 100)}% vs ${Math.round(worst.exp * 100)}%)`);
  if (wf && wf.hit < wf.exp) t.push(`Tipo de aposta mais fraco: ${wf.k} (${Math.round(wf.hit * 100)}% vs ${Math.round(wf.exp * 100)}%)`);
  const b = zeBrakes(); if (b.length) t.push('Travão: ' + b.map(x => `${x.lg} · ${x.fam}`).join(', '));
  copyText(t.join('\n')).then(() => toast('📋 Resumo copiado.'));
}
fmGo = (function (prev) { return function (v) { const r = prev.apply(this, arguments); if (v === 'stats') { try { renderZeStats(); } catch (e) { console.warn(e); } } return r; }; })(fmGo);
/* botão no «Mais» e na página do Zé */
(function () {
  try {
    const grid = document.querySelector('#mMore .grid');
    if (grid && !grid.querySelector('[data-zst]')) {
      const b = document.createElement('button'); b.setAttribute('data-zst', '1'); b.innerHTML = '<span class="i">📊</span>Estatísticas';
      b.addEventListener('click', e => { e.stopPropagation(); document.getElementById('mMore').classList.remove('open'); fmGo('stats'); });
      grid.insertBefore(b, grid.firstChild);
    }
    const css = document.createElement('style');
    css.textContent = `.zst-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:.88rem;align-items:baseline;flex-wrap:wrap}.zst-row:last-of-type{border-bottom:0}
.rv-seg{display:inline-flex;border-radius:999px;overflow:hidden;border:1px solid #6f9410;vertical-align:1px}.rv-seg b{padding:4px 9px;font-weight:800;font-size:.72rem;cursor:pointer;background:#241844;color:#c9c1e6}.rv-seg b.on{background:#c8f53c;color:#122000}`;
    document.head.appendChild(css);
  } catch (e) {}
})();
zeTalk = (function (prev) {
  return function (q0) {
    try {
      const q = normTxt(String(q0 || ''));
      if (/melhor aposta|aposta (do|de) (dia|hoje)|o que (e que )?(devo )?apostar|em que (jogo )?(devo )?apostar|qual (e )?a tua aposta/.test(q)) {
        const C = zeChallenges(36);
        if (!C.length) return { mood: 'pensativo', html: 'Hoje não tenho nenhuma aposta que valha a pena (nas próximas 36 h não há nada seguro nem com valor acima de 1.25). Às vezes a melhor aposta é não apostar.' };
        const c = C[0], o = c.odd > 1 ? `${esc(c.book || 'casa')} ${(+c.odd).toFixed(2)}` : `justa ${fairOdd(c.p)}`;
        setTimeout(() => { fmGo('duelo'); zeChallengesToggle(true); }, 400);
        return { mood: 'gozao', html: `🎯 A minha de hoje: <b>${esc(marketName(c.k2, c.m))}</b> em ${esc(c.m.home)} vs ${esc(c.m.away)} (${esc(c.m.date || '')} ${esc(c.m.kickoff || '')}) — dou-lhe ${pct(c.p)} · ${o}.${C.length > 1 ? `<br>Tenho mais ${C.length - 1} na lista de desafios (abri-a no Duelo).` : ''}<br><span class="muted">Provável não é certo: confirma a odd na tua casa.</span>` };
      }
      if (/(o ze|tu) acerta(s)? quanto|quanto (e que )?(o ze |tu )?acerta|quantas (e que )?acert|percentagem/.test(q) && !/banca/.test(q)) {
        const rows = Object.values(zarchSync().rows), ap = rows.filter(r => r.t === 'aposta'), g = zstAgg(ap), sc = zstAgg(rows.filter(r => r.t === 'marcador'));
        setTimeout(() => fmGo('stats'), 400);
        return { mood: 'pensativo', html: g.n ? `📊 Aposta lógica: acertei <b>${g.w} de ${g.n}</b> (${Math.round(g.hit * 100)}%) e prometia ${Math.round(g.exp * 100)}%.${sc.n ? ` Marcadores: ${sc.w}/${sc.n}.` : ''} Abri as estatísticas completas.` : '📊 Ainda não tenho previsões decididas — dá-me uns dias de jogos. Abri as estatísticas.' };
      }
      if (/estatistic|quanto (e que )?acert|percentagem de acert|onde (e que )?falh/.test(q)) { setTimeout(() => fmGo('stats'), 300); return { mood: 'pensativo', html: '📊 Abri as minhas estatísticas: acertos por dia e mês, onde falho mais (liga e tipo de aposta), travão automático e exportar para Excel.' }; } } catch (e) {}
    return prev.apply(this, arguments);
  };
})(zeTalk);
