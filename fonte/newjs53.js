/* =====================================================================
   v59 · 🔥 onde o Zé está quente / ❄️ onde falha (com contas de «é sorte ou é real?»)
   - Agrupa as previsões decididas por competição e por tipo de aposta.
   - Quente: ≥ 8 jogos, acerta pelo menos o que promete e ≥ 75%.
   - Frio: ≥ 10 jogos e falha tanto que já não parece azar (z ≤ −1.8, ≥ 10 pontos abaixo).
   - Liga Europa e Conference contam também juntas («Europa secundária»): no telemóvel do Júlio
     acertaram 60% para 78% prometidos (35 jogos) — e são jogos entre ligas diferentes, onde o modelo
     sabe menos. Ficam fora do selo de ouro.
   - O travão automático passa a apanhar também competições inteiras (≥ 12 jogos, z ≤ −2).
   ===================================================================== */
const EU2_CODES = ['uefa.europa', 'uefa.europa.conf'];
let HC_MEM = null;
function zeHotCold() {
  if (HC_MEM && Date.now() - HC_MEM.t < 3 * 60e3) return HC_MEM.v;
  const rows = Object.values(zarchLoad().rows).filter(r => r.t === 'aposta');
  const grp = (keyFn) => { const G = {}; rows.forEach(r => { const k = keyFn(r); if (!k) return; const g = G[k] = G[k] || { k, n: 0, w: 0, p: 0, v: 0, codes: new Set() }; g.n++; g.w += r.w ? 1 : 0; g.p += r.p; g.v += r.p * (1 - r.p); if (r.c) g.codes.add(r.c); }); return Object.values(G).map(g => ({ ...g, codes: [...g.codes], hit: g.w / g.n, exp: g.p / g.n, z: (g.w - g.p) / Math.sqrt(Math.max(1e-6, g.v)) })); };
  const lg = grp(r => r.lg || null), fam = grp(r => PICK_FAMILY(r.k));
  const eu2 = grp(r => EU2_CODES.includes(r.c) ? 'Europa secundária (Liga Europa + Conference)' : null);
  const hot = L => L.filter(g => g.n >= 8 && g.hit >= g.exp && g.hit >= 0.75).sort((a, b) => (b.hit - b.exp) - (a.hit - a.exp));
  const cold = L => L.filter(g => g.n >= 10 && g.z <= -1.8 && g.hit - g.exp <= -0.10).sort((a, b) => a.z - b.z);
  const few = L => L.filter(g => g.n < 8).length;
  let lc = cold(lg.concat(eu2)); if (lc.some(g => /Europa secundária/.test(g.k))) lc = lc.filter(g => /Europa secundária/.test(g.k) || !g.codes.every(c => EU2_CODES.includes(c)));
  const v = { lgHot: hot(lg), lgCold: lc, famHot: hot(fam), famCold: cold(fam), nRows: rows.length, fewLg: few(lg), all: { lg, fam, eu2 } };
  HC_MEM = { t: Date.now(), v };
  return v;
}
applyLive = (function (prev) { return function () { const r = prev.apply(this, arguments); HC_MEM = null; return r; }; })(applyLive);
function hcOfMatch(m) {
  try {
    const H = zeHotCold(), name = m.league || '';
    const hot = H.lgHot.find(g => g.k === name), cold = H.lgCold.find(g => g.k === name || (m.espn && g.codes.includes(m.espn.code) && /Europa secundária/.test(g.k)));
    return { hot, cold };
  } catch (e) { return {}; }
}
/* o travão passa a apanhar também competições inteiras */
zeBraked = (function (prev) {
  return function (m, k) {
    const r = prev.apply(this, arguments); if (r) return r;
    try {
      if (!m || !m.espn) return null;
      const H = zeHotCold(), c = H.lgCold.find(g => (g.k === m.league || g.codes.includes(m.espn.code)) && g.n >= 12 && g.z <= -2);
      return c ? { lg: c.k, fam: 'todas as apostas', n: c.n, w: c.w, hit: c.hit, exp: c.exp, z: c.z, c: m.espn.code } : null;
    } catch (e) { return null; }
  };
})(zeBraked);
zeBrakes = (function (prev) {
  return function () {
    const L = prev.apply(this, arguments) || [];
    try { zeHotCold().lgCold.filter(g => g.n >= 12 && g.z <= -2).forEach(g => { if (!L.some(b => b.lg === g.k && b.fam === 'todas as apostas')) L.push({ lg: g.k, fam: 'todas as apostas', n: g.n, w: g.w, hit: g.hit, exp: g.exp, z: g.z, c: g.codes[0] || '' }); }); } catch (e) {}
    return L;
  };
})(zeBrakes);
/* selo de ouro: fora da Liga Europa / Conference (jogos entre ligas — o Zé sabe menos e falha mais) */
zeSelo = (function (prev) {
  return function (m) {
    const s = prev.apply(this, arguments);
    try { if (m && m.espn && EU2_CODES.includes(m.espn.code)) { s.bad = (s.bad || []).concat(['Liga Europa/Conference — o Zé falha mais aqui (jogos entre ligas)']); s.grade = null; } } catch (e) {}
    return s;
  };
})(zeSelo);

/* ---------- painel nas Estatísticas ---------- */
function hcRow(g, kind) {
  const d = Math.round((g.hit - g.exp) * 100);
  return `<div class="zst-row"><span>${kind === 'hot' ? '🔥' : '❄️'} ${esc(g.k)}</span><span><b style="color:${kind === 'hot' ? 'var(--lime)' : '#ff7a8f'}">${g.w}/${g.n} · ${Math.round(g.hit * 100)}%</b> <span class="muted">prometia ${Math.round(g.exp * 100)}% (${d >= 0 ? '+' : ''}${d})</span></span></div>`;
}
function zeHotColdHTML() {
  const H = zeHotCold();
  if (!H.nRows) return '';
  const hot = H.lgHot.slice(0, 4).map(g => hcRow(g, 'hot')).concat(H.famHot.slice(0, 3).map(g => hcRow(g, 'hot')));
  const cold = H.lgCold.slice(0, 4).map(g => hcRow(g, 'cold')).concat(H.famCold.slice(0, 3).map(g => hcRow(g, 'cold')));
  return `<div class="panel"><div class="panel-h"><span>🔥 Onde o Zé acerta · ❄️ onde falha</span><span class="muted">${H.nRows} previsões</span></div><div class="panel-b">
    ${hot.length ? `<div class="rx-h">Confiar mais</div>${hot.join('')}` : '<div class="muted" style="margin-bottom:6px;">Ainda nenhuma liga ou tipo de aposta com 8+ jogos acima do prometido.</div>'}
    ${cold.length ? `<div class="rx-h">Evitar</div>${cold.join('')}` : '<div class="muted">Nenhuma liga ou tipo de aposta a falhar de forma clara (já descontado o azar).</div>'}
    <div class="muted" style="font-size:.72rem;margin-top:6px;">Só entram ligas/tipos com jogos suficientes: «quente» com 8+ jogos; «evitar» com 10+ e falhas grandes demais para ser azar. ${H.fewLg ? `${H.fewLg} liga${H.fewLg > 1 ? 's' : ''} ainda com menos de 8 jogos — não tiro conclusões.` : ''} O que está em «evitar» com 12+ jogos sai sozinho dos desafios e do boletim seguro.</div>
  </div></div>`;
}
renderZeStats = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const box = document.getElementById('zeStatsBox'); if (!box) return r;
      const html = zeHotColdHTML(); if (!html) return r;
      const health = box.querySelector('.panel'); if (health) health.insertAdjacentHTML('afterend', html); else box.insertAdjacentHTML('afterbegin', html);
    } catch (e) { console.warn(e); }
    return r;
  };
})(renderZeStats);
/* resumo de uma linha (Início) */
function zeHotColdLine() {
  try {
    const H = zeHotCold(); if (!H.nRows) return '';
    const h = H.lgHot.slice(0, 2).map(g => g.k).concat(H.famHot.slice(0, 1).map(g => g.k)), c = H.lgCold.slice(0, 2).map(g => g.k.replace(/ \(.*\)/, '')).concat(H.famCold.slice(0, 1).map(g => g.k));
    if (!h.length && !c.length) return '';
    return `${h.length ? '🔥 ' + h.map(esc).join(' · ') : ''}${h.length && c.length ? '  —  ' : ''}${c.length ? '❄️ evitar: ' + c.map(esc).join(' · ') : ''}`;
  } catch (e) { return ''; }
}
/* desafios: etiqueta liga quente / fria */
chPanelDone = (function (prev) {
  return function (box) {
    const r = prev.apply(this, arguments);
    try {
      box = box || document.getElementById('zeChallenges'); if (!box) return r;
      const L = (typeof CH_RENDERED !== 'undefined' && CH_RENDERED.length ? CH_RENDERED : zeChallenges(36));
      box.querySelectorAll('.ch-card[data-i]').forEach(card => {
        if (card.querySelector('.ch-hc')) return;
        const c = L.find(x => String(x.i) === card.dataset.i); if (!c) return;
        const hc = hcOfMatch(c.m); if (!hc.hot && !hc.cold) return;
        const t = hc.cold ? `❄️ ${esc(hc.cold.k.replace(/ \(.*\)/, ''))}: o Zé acerta ${hc.cold.w}/${hc.cold.n} (prometia ${Math.round(hc.cold.exp * 100)}%)` : `🔥 ${esc(hc.hot.k)}: o Zé acerta ${hc.hot.w}/${hc.hot.n} aqui`;
        const sel = card.querySelector('.ch-selo'); const html = `<div class="ch-hc ${hc.cold ? 'c' : 'h'}">${t}</div>`;
        if (sel) sel.insertAdjacentHTML('afterend', html); else card.insertAdjacentHTML('beforeend', html);
      });
    } catch (e) {}
    return r;
  };
})(chPanelDone);
zeTalk = (function (prev) {
  return function (q0) {
    try {
      const q = normTxt(String(q0 || ''));
      if (/(onde|em que liga|que liga|que aposta).*(acerta|ganha|falha|sucesso)|liga (quente|fria)|onde (e que )?(es|estas) (melhor|pior)/.test(q)) {
        const l = zeHotColdLine(); setTimeout(() => fmGo('stats'), 400);
        return { mood: 'pensativo', html: l ? `📊 ${l}<br><span class="muted">Abri as estatísticas com os números todos.</span>` : '📊 Ainda não tenho jogos suficientes por liga para te dizer com confiança (preciso de 8+ por liga). Abri as estatísticas.' };
      }
    } catch (e) {}
    return prev.apply(this, arguments);
  };
})(zeTalk);
(function () {
  try {
    const css = document.createElement('style');
    css.textContent = `.ch-hc{font-size:.74rem;margin:4px 0 2px;padding:5px 8px;border-radius:8px}.ch-hc.h{background:rgba(200,245,60,.10);border:1px solid rgba(200,245,60,.35)}.ch-hc.c{background:rgba(255,90,110,.10);border:1px solid rgba(255,90,110,.4)}`;
    document.head.appendChild(css);
  } catch (e) {}
})();
