
/* =====================================================================
   v49 · dicas e boletins: resposta clara no telemóvel
   - primeiro o veredito («✅ vale», «❌ não vale», «❓ fora do radar»), em frases simples
   - depois cada dica num cartão (a tabela de 7 colunas partia as palavras letra a letra)
   - a mesma dica vista em 2 prints conta uma vez (fica a melhor odd)
   - prints de dicas que não se leram bem já não aparecem como «boletim» com valor −38%
   - o «Boletim do Zé» não contradiz o veredito (nas dicas, o veredito é a decisão)
   ===================================================================== */
(function () {
  const css = document.createElement('style');
  css.textContent = `
.tcard { border: 1px solid var(--line2); border-radius: 10px; padding: 8px 10px; margin: 6px 0; display: flex; gap: 8px; align-items: flex-start; }
.tcard.ok { border-color: rgba(200,245,60,.55); background: rgba(200,245,60,.05); }
.tcard.no { opacity: .78; }
.tcard .tc-main { flex: 1; min-width: 0; }
.tcard .tc-game { font-weight: 800; font-size: .92rem; line-height: 1.25; }
.tcard .tc-pick { font-size: .88rem; margin-top: 2px; }
.tcard .tc-nums { font-size: .78rem; color: var(--muted); margin-top: 3px; }
.tcard .tc-badge { font-size: .74rem; font-weight: 800; white-space: nowrap; padding: 2px 7px; border-radius: 999px; border: 1px solid var(--line2); }
.tcard.ok .tc-badge { color: #14081f; background: var(--lime); border-color: var(--lime); }
.tsum { border-radius: 12px; padding: 10px 12px; margin: 6px 0; background: rgba(255,255,255,.03); border: 1px solid var(--line2); font-size: .88rem; line-height: 1.5; }
.tsum h4 { margin: 0 0 4px; font-size: .95rem; }
.tsum .ln { margin: 3px 0; }`;
  document.head.appendChild(css);
})();
function prettySel(sel, home, away) {
  const s = String(sel || '').trim(); const n = normTxt(s);
  const side = [home, away].find(t => t && (normTxt(t) === n || teamScore(t, n) > 0 && n.split(' ').length <= normTxt(t).split(' ').length + 1));
  if (side && !/empate|ou |\(|mais|menos|ambas|handicap|vence/i.test(s)) return `${side} vence`;
  return s;
}
function tipsRows(legs) {
  // avaliar e juntar repetidos (mesmo jogo + mesma escolha → fica a melhor odd)
  const rows = [];
  legs.forEach(l => {
    const e = legEval(l), m = e.m, odd = Number(l.odd) || 0;
    const home = m ? m.home : l.home, away = m ? m.away : l.away;
    const sel = prettySel(l.sel, home, away);
    const key = normTxt(home).slice(0, 6) + '|' + normTxt(away).slice(0, 6) + '|' + normTxt(sel).replace(/\s+/g, '');
    const p = m ? e.p : null;
    const ex = rows.find(r => r.key === key);
    if (ex) { ex.n++; if (odd > ex.odd) { ex.odd = odd; ex.l = { ...l, odd }; ex.ev = ex.p != null ? ex.p * odd - 1 : null; } return; }
    rows.push({ key, l: { ...l, sel }, e, m, home, away, sel, odd, p, ev: p != null ? p * odd - 1 : null, n: 1 });
  });
  rows.forEach(r => {
    r.need = r.p ? 1.03 / r.p : null;
    if (!r.m || r.p == null) r.v = 'radar';
    else if (r.ev > zeEdgeFor(0.03, r.odd) && r.odd <= 6 && r.p >= 0.2) r.v = 'ok';
    else if (r.ev >= -0.01) r.v = 'fair';
    else r.v = 'no';
  });
  const order = { ok: 0, fair: 1, no: 2, radar: 3 };
  return rows.sort((a, b) => order[a.v] - order[b.v] || (b.ev || -9) - (a.ev || -9));
}
const stakeTxt = r => { try { const b = loadBank().you, k = (r.p * r.odd - 1) / (r.odd - 1), f = Math.min(0.05, Math.max(0, k * 0.25)); const s = Math.max(minStake(), Math.round(b * f * 100) / 100); return `${s.toFixed(2)} €`; } catch (e) { return ''; } };
tipsAnalysisHTML = (function (prev) {
  return function (g) {
    if (!g || !g.legs || !g.legs.length) return '';
    const withOdd = g.legs.filter(l => !l.pred && Number(l.odd) > 1), noOdd = g.legs.filter(l => !withOdd.includes(l));
    let html = '';
    if (withOdd.length) {
      const rows = tipsRows(withOdd);
      TIP_PICKS = rows.map(r => ({ l: r.l, e: r.e, p: r.p || 0, ev: r.ev || 0 }));
      const ok = rows.filter(r => r.v === 'ok'), fair = rows.filter(r => r.v === 'fair'), no = rows.filter(r => r.v === 'no'), radar = rows.filter(r => r.v === 'radar');
      const game = r => `${esc(r.home)} – ${esc(r.away)}`;
      const sum = [];
      if (ok.length) {
        sum.push(`<h4>✅ Vale a pena (${ok.length})</h4>` + ok.map(r => `<div class="ln"><b>${esc(r.sel)}</b> @ ${r.odd.toFixed(2)} <span class="muted">· ${game(r)}</span><br><span class="muted">Eu dou ${pct(r.p)} → a odd justa é ${(1 / r.p).toFixed(2)}, pagam ${r.odd.toFixed(2)}: <b style="color:var(--lime)">+${Math.round(r.ev * 100)}%</b> · aposta sugerida ${stakeTxt(r)} (simples)</span></div>`).join(''));
      } else sum.push('<h4>🧊 Nenhuma dica tem valor</h4><div class="ln">A estas odds, todas pagam menos (ou o mesmo) do que valem. <b>Hoje eu não jogava estas dicas.</b></div>');
      if (fair.length) sum.push(`<div class="ln" style="margin-top:6px;">🟡 <b>Preço justo, sem margem</b> (${fair.length}): ${fair.map(r => `${esc(r.sel)} @ ${r.odd.toFixed(2)}`).join(' · ')} <span class="muted">— só se a tua casa pagar mais.</span></div>`);
      if (no.length) sum.push(`<div class="ln" style="margin-top:6px;">❌ <b>Pagam pouco</b> (${no.length}): ${no.slice(0, 6).map(r => `${esc(r.sel)} @ ${r.odd.toFixed(2)} <span class="muted">(precisava ${r.need.toFixed(2)})</span>`).join(' · ')}${no.length > 6 ? ` · +${no.length - 6}` : ''}</div>`);
      if (radar.length) sum.push(`<div class="ln" style="margin-top:6px;">❓ <b>Fora do meu radar</b> (${radar.length}): ${radar.map(r => game(r)).join(' · ')} <span class="muted">— carrega em 📡 Atualizar; se continuar, é liga que não acompanho.</span></div>`);
      sum.push(`<div class="ln muted" style="margin-top:6px;font-size:.78rem;">«Vale» = a odd paga mais do que a minha probabilidade (com margem de segurança). Joga em <b>simples</b>: juntar numa múltipla multiplica a margem da casa. As odds da app podem não ser as da tua casa.</div>`);
      const dupNote = rows.some(r => r.n > 1) ? `<div class="muted" style="font-size:.76rem;">Juntei dicas repetidas entre prints (fica a melhor odd).</div>` : '';
      const label = { ok: '✅ vale', fair: '🟡 justo', no: '❌ paga pouco', radar: '❓ fora do radar' };
      const cards = rows.map((r, i) => `<label class="tcard ${r.v === 'ok' ? 'ok' : r.v === 'no' ? 'no' : ''}">
          <input type="checkbox" data-tip="${i}" ${r.v === 'ok' ? 'checked' : ''} style="margin-top:3px;">
          <div class="tc-main"><div class="tc-game">${game(r)}</div><div class="tc-pick">${esc(r.sel)} <b>@ ${r.odd.toFixed(2)}</b>${r.n > 1 ? ` <span class="muted">(${r.n} prints)</span>` : ''}</div>
          <div class="tc-nums">${r.p != null ? `Eu dou ${pct(r.p)} · justa ${(1 / r.p).toFixed(2)} · valor ${r.ev >= 0 ? '+' : ''}${Math.round(r.ev * 100)}%` : 'sem dados deste jogo'}</div></div>
          <span class="tc-badge">${label[r.v]}</span></label>`).join('');
      html += `<div class="tsum">${sum.join('')}</div>
        <details style="margin:4px 0;"><summary class="muted" style="cursor:pointer;font-size:.84rem;">Ver as ${rows.length} dicas uma a uma</summary>${cards}${dupNote}</details>
        <div class="acts" style="margin-top:6px;"><button class="mini l" onclick="tipsToEditor()">📝 Levar as marcadas para o boletim</button><button class="mini" onclick="tipsToPool()">📌 Guardar para as «Melhores do dia»</button></div>`;
    }
    if (noOdd.length) {
      const pr = noOdd.map(l => {
        const m = findMatchForLeg(l); let p = null;
        if (m) { try { const r = modelo(m); const k = l.tip === '1' ? '1' : l.tip === '2' ? '2' : l.tip === 'X' ? 'X' : null; if (k) p = r.mk[k]; } catch (e) {} }
        const who = l.tip === '1' ? (m ? m.home : l.home) + ' vence' : l.tip === '2' ? (m ? m.away : l.away) + ' vence' : l.tip === 'X' ? 'Empate' : '?';
        return { l, m, p, who };
      });
      const v = x => x.p == null ? '❓' : x.p >= 0.55 ? '👍 concordo' : x.p >= 0.4 ? '🤔 arriscado' : '👎 discordo';
      html += `<div class="tsum"><h4>🔮 Previsões sem odds (${pr.length})</h4>${pr.map(x => `<div class="ln"><b>${esc(x.who)}</b> <span class="muted">· ${esc(x.m ? x.m.home : x.l.home)} – ${esc(x.m ? x.m.away : x.l.away)}</span><br><span class="muted">${x.p != null ? `Eu dou ${pct(x.p)} → só vale a partir de <b>${(1.03 / x.p).toFixed(2)}</b> · ${v(x)}` : x.l.tip === '?' ? 'não consegui ler a previsão' : 'jogo fora do meu radar'}</span></div>`).join('')}
        <div class="ln muted" style="font-size:.78rem;margin-top:4px;">Esta lista não traz odds: vê na tua casa — se pagar pelo menos «só vale a partir de», mete-a no duelo.</div></div>`;
    }
    return html;
  };
})(tipsAnalysisHTML);
function mergeTips(groups) {
  const T = { ...groups[0], legs: [], tipsDone: [], tipsOther: [], nImgs: 0, tips: true };
  groups.forEach(g => { T.legs = T.legs.concat(g.legs || []); T.tipsDone = T.tipsDone.concat(g.tipsDone || []); T.tipsOther = T.tipsOther.concat(g.tipsOther || []); T.nImgs += g.nImgs || 1; T.tipsPromo = T.tipsPromo || g.tipsPromo; T.tipsDate = T.tipsDate || g.tipsDate; });
  return T;
}
batchHTML = (function (prev) {
  return function (groups) {
    groups = groups || [];
    const tipsG = groups.filter(g => g.tips || /dicas/i.test(g.source || ''));
    if (!tipsG.length) return prev(groups);
    const others = groups.filter(g => !tipsG.includes(g));
    const bad = g => { const L = g.legs || []; const good = L.filter(l => l.home && l.away && Number(l.odd) > 1).length; return /tips/i.test(g.source || '') || good < Math.max(1, L.length / 2); };
    const junk = others.filter(bad), real = others.filter(g => !bad(g));
    const T = mergeTips(tipsG);
    let h = tipsHTML(T) + tipsAnalysisHTML(T);
    if (junk.length) h += `<div class="muted" style="font-size:.8rem;margin:6px 0;">🙈 ${junk.length} print${junk.length > 1 ? 's' : ''} não ${junk.length > 1 ? 'ficaram' : 'ficou'} bem lido${junk.length > 1 ? 's' : ''} — não ${junk.length > 1 ? 'os' : 'o'} contei. Se tinha${junk.length > 1 ? 'm' : ''} dicas importantes, manda-${junk.length > 1 ? 'os' : 'o'} sozinho${junk.length > 1 ? 's' : ''}.</div>`;
    if (real.length) h += `<div style="margin-top:10px;"><b>E os boletins que mandaste:</b></div>` + prev(real);
    return h;
  };
})(batchHTML);
tipsHTML = (function (prev) {
  return function (g) {
    let h = prev(g);
    try {
      const n = tipsRows((g.legs || []).filter(l => !l.pred && Number(l.odd) > 1)).length, np = (g.legs || []).filter(l => l.pred || !(Number(l.odd) > 1)).length;
      h = h.replace(/<div style="font-size:\.84rem;">\d+ dicas? por jogar[^<]*<\/div>/, `<div style="font-size:.84rem;">${n ? `${n} dica${n > 1 ? 's' : ''} diferente${n > 1 ? 's' : ''} por jogar` : ''}${n && np ? ' · ' : ''}${np ? `${np} previs${np > 1 ? 'ões' : 'ão'} sem odd` : ''}. O meu veredito vem logo a seguir.</div>`);
    } catch (e) {}
    return h;
  };
})(tipsHTML);
