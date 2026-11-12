/* =====================================================================
   v28 · Validações + o Zé PEDE e APRENDE informação do utilizador
   (ausências, poupanças, odds da tua casa, segunda opinião externa)
   ===================================================================== */

/* ---------- Validações de apostas ---------- */
const _addBetV27 = addBet;
addBet = function (bet, who) {
  const odd = parseFloat(String(bet.odd).replace(',', '.'));
  const stake = parseFloat(String(bet.stake).replace(',', '.'));
  if (!(odd >= 1.01) || !isFinite(odd)) { alert('Odd inválida — tem de ser um número maior que 1 (ex.: 1.85).'); return null; }
  if (!(stake > 0) || !isFinite(stake)) { alert('Indica o valor da aposta (€).'); return null; }
  const b = loadBank();
  const avail = who === 'ze' ? b.ze : b.you;
  if (stake > avail + 1e-9) {
    if (who === 'ze') return null;
    alert(`Saldo insuficiente: tens ${eur(Math.max(0, avail))} disponíveis e querias apostar ${eur(stake)}.\n\nEspera pelos resultados, anula uma aposta que não fizeste, recarrega a banca (💰 Recarregar) ou começa uma nova época em Definições.`);
    return null;
  }
  bet.odd = r2(odd); bet.stake = r2(stake);
  return _addBetV27(bet, who);
};

/* ---------- Notas que o utilizador dá ao Zé (por jogo) ---------- */
const NOTES_KEY = 'ze_notes_v1';
function notesAll() {
  const n = lsGet(NOTES_KEY, {});
  let ch = false;
  Object.keys(n).forEach(k => { if (!n[k] || Date.now() - (n[k].t || 0) > 4 * 864e5) { delete n[k]; ch = true; } });
  if (ch) lsSet(NOTES_KEY, n);
  return n;
}
function notesFor(m) { return notesAll()[mKey(m)] || null; }
function noteSet(m, fn) {
  const n = notesAll(); const k = mKey(m);
  const cur = n[k] || { t: Date.now(), out: [], rot: [], ext: null, odds: null };
  fn(cur); cur.t = Date.now(); n[k] = cur; lsSet(NOTES_KEY, n);
  ZE_MODEL_CACHE.clear(); MODEL_CACHE.clear(); ZE_NOTE_CACHE.clear();
  return cur;
}
function noteClear(i) {
  const m = matches[i]; if (!m) return;
  const n = notesAll(); delete n[mKey(m)]; lsSet(NOTES_KEY, n);
  ZE_MODEL_CACHE.clear(); MODEL_CACHE.clear(); ZE_NOTE_CACHE.clear();
  toast('🧹 Notas deste jogo apagadas.');
}

/* ---------- O modelo usa as notas ---------- */
const ZE_NOTE_CACHE = new Map();
const _modeloV27 = modelo;
modelo = function (m) {
  const r = _modeloV27(m);
  const nt = notesFor(m);
  if (!nt || (!nt.out.length && !nt.rot.length && !nt.ext && !nt.odds)) return r;
  const ck = mKey(m) + '|' + nt.t + '|' + r.lh + '|' + r.la;
  if (ZE_NOTE_CACHE.has(ck)) return ZE_NOTE_CACHE.get(ck);
  let lh = r.lh, la = r.la;
  const trace = r.trace.slice();
  const sideOf = name => teamScore(m.home, normTxt(name)) > 0 || m.home === name ? 'h' : 'a';
  if (nt.out.length) {
    const b = boardFor(m) || (studyFor(m) && studyFor(m).board);
    let kh = 1, ka = 1;
    nt.out.forEach(o => {
      let share = o.share;
      if (share == null && b) { const p = (o.side === 'h' ? b.home : b.away).find(x => nameHit(o.name, x.name) != null); if (p) share = p.share; }
      if (share == null) share = o.rank === 0 ? 0.3 : o.rank === 1 ? 0.18 : 0.1;
      const f = clamp(1 - 0.6 * share, 0.7, 1);
      if (o.side === 'h') kh *= f; else ka *= f;
    });
    kh = Math.max(kh, 0.65); ka = Math.max(ka, 0.65);
    lh *= kh; la *= ka;
    trace.push({ k: 'Tu disseste', txt: `Ausências: ${nt.out.map(o => `${esc(o.name)} (${o.side === 'h' ? esc(m.home) : esc(m.away)})`).join(', ')} → ${kh < 1 ? `${esc(m.home)} −${Math.round((1 - kh) * 100)}% golos` : ''}${kh < 1 && ka < 1 ? ' · ' : ''}${ka < 1 ? `${esc(m.away)} −${Math.round((1 - ka) * 100)}% golos` : ''}` });
  }
  if (nt.rot.length) {
    nt.rot.forEach(side => { if (side === 'h') { lh *= 0.9; la *= 1.04; } else { la *= 0.9; lh *= 1.04; } });
    trace.push({ k: 'Tu disseste', txt: `Poupança/rotação: ${nt.rot.map(s => s === 'h' ? esc(m.home) : esc(m.away)).join(', ')} → −10% golos a quem poupa, +4% ao adversário` });
  }
  if (nt.odds && !r.market) {
    const o = nt.odds, s = 1 / o['1'] + 1 / o['X'] + 1 / o['2'];
    const fit = fitLambdas((1 / o['1']) / s, (1 / o['X']) / s, (1 / o['2']) / s, null);
    const w = learnWeights().wModel;
    lh = w * lh + (1 - w) * fit.lh; la = w * la + (1 - w) * fit.la;
    trace.push({ k: 'Tuas odds', txt: `1 ${o['1'].toFixed(2)} · X ${o['X'].toFixed(2)} · 2 ${o['2'].toFixed(2)} (margem ${((s - 1) * 100).toFixed(1)}%) → uso-as como mercado, ${Math.round((1 - w) * 100)}% de peso` });
  }
  if (nt.ext) {
    const e = nt.ext;
    const fit = fitLambdas(e.p1, e.pX, e.p2, null);
    lh = 0.85 * lh + 0.15 * fit.lh; la = 0.85 * la + 0.15 * fit.la;
    trace.push({ k: '2.ª opinião', txt: `${esc(e.src)}: 1 ${pct(e.p1)} · X ${pct(e.pX)} · 2 ${pct(e.p2)} → conta 15% (é outro modelo, não um facto)` });
  }
  const M = scoreMatrix(lh, la, 10);
  let mk = marketsFrom(M);
  const W = learnWeights(); if (W.k < 0.999) mk = shrinkMk(mk, W.k);
  const out = { ...r, lh: +lh.toFixed(2), la: +la.toFixed(2), M, mk, trace, src: r.src + ' + as tuas notas', notes: nt };
  ZE_NOTE_CACHE.set(ck, out);
  try { snapshotPred(m, out); } catch (e) {}
  return out;
};

/* ---------- O que falta ao Zé (e como lho dar) ---------- */
function zeNeeds(m) {
  const r = modelo(m), st = studyFor(m), nt = notesFor(m);
  const need = [];
  const online = navigator.onLine !== false;
  if (!st && online) need.push({ t: 'Ainda não estudei este jogo a fundo (forma, ficha, mercado).', ex: 'estuda este jogo', act: 'ask' });
  if (st && st.offline) need.push({ t: 'Não encontro este jogo nos dados online — estou só com o dossiê.', ex: '', act: '' });
  if (!r.market && !(nt && nt.odds)) need.push({ t: 'Não tenho odds para comparar. Dá-me as da tua casa (1 · X · 2).', ex: 'odds 1.30 5.00 9.00', act: 'fill' });
  const b = boardFor(m) || (st && st.board);
  const known = new Set(((nt && nt.out) || []).map(o => normTxt(o.name)));
  const cand = playersOf(m.home).concat(playersOf(m.away)).find(p => p && p.name && !known.has(normTxt(p.name)));
  if (!b || !b.lineupKnown) need.push({ t: known.size ? `Já sei que falta ${[...((nt && nt.out) || [])].map(o => esc(o.name)).join(', ')}. Há mais alguém de fora?` : 'Sei pouco das ausências. Se souberes de lesões ou castigos, diz-me.', ex: cand ? `${cand.name} não joga` : '', act: 'fill' });
  if (!(nt && nt.rot && nt.rot.length)) need.push({ t: 'Há poupanças/rotação por causa de outro jogo?', ex: `${m.home} vai poupar`, act: 'fill' });
  if (!(nt && nt.ext)) need.push({ t: 'Viste outra previsão (Forebet, tipster)? Dá-me as percentagens.', ex: 'forebet 60 25 15', act: 'fill' });
  return need.slice(0, 4);
}
function needsHTML(m) {
  const n = zeNeeds(m);
  if (!n.length) return '';
  return `<div class="needs"><div class="rz-head">📝 Ajuda-me a pensar melhor</div>${n.map(x => `<div class="need">• ${x.t}${x.ex ? ` <button class="ze-chip" onclick="zeFillChat(${JSON.stringify(x.ex).replace(/"/g, '&quot;')}, ${x.act === 'ask'})">${esc(x.ex)}</button>` : ''}</div>`).join('')}
    ${notesFor(m) ? `<div style="margin-top:6px;"><button class="mini x" onclick="noteClear(${matchIndex(m)}); (document.getElementById('studyBox')||{}).innerHTML=reasoningHTML(matches[${matchIndex(m)}]);">🧹 Apagar o que te disse</button></div>` : ''}</div>`;
}
function zeFillChat(txt, send) {
  try { closeModal(); } catch (e) {}
  fmGo('ze');
  const inp = document.getElementById('chatInput');
  if (!inp) return;
  inp.value = txt;
  if (send) { enviarChat(); return; }
  inp.focus();
  try { inp.setSelectionRange(0, txt.length); } catch (e) {}
  toast('✏️ Ajusta o texto e carrega em Enviar.');
}
const _reasoningHTMLV27 = reasoningHTML;
reasoningHTML = function (m) { return _reasoningHTMLV27(m) + needsHTML(m); };

/* ---------- O Zé percebe o que lhe dizes ---------- */
function parseThreeProbs(q) {
  const nums = (q.match(/\d+(?:[.,]\d+)?/g) || []).map(x => parseFloat(x.replace(',', '.')));
  if (nums.length >= 3) {
    let [a, b, c] = nums.slice(0, 3);
    if (a + b + c > 3.5) { const s = a + b + c; if (s > 80 && s < 120) return { p1: a / s, pX: b / s, p2: c / s }; }
    else if (a < 1.01 || b < 1.01 || c < 1.01) { const s = a + b + c; if (s > 0.8 && s < 1.2) return { p1: a / s, pX: b / s, p2: c / s }; }
  }
  return null;
}
function parseThreeOdds(q) {
  const nums = (q.match(/\d+[.,]\d{1,2}/g) || []).map(x => parseFloat(x.replace(',', '.'))).filter(x => x >= 1.01 && x < 60);
  return nums.length >= 3 ? { '1': nums[0], 'X': nums[1], '2': nums[2] } : null;
}
function findPlayerAnywhere(q, m) {
  const p = playerMentioned(q, m);
  if (p) return { name: p.name, side: teamScore(m.home, normTxt(p.team || '')) > 0 || p.team === m.home ? 'h' : 'a', share: typeof p.share === 'number' ? p.share : null, rank: p.rank };
  return null;
}
const _zeTalkV27 = zeTalk;
zeTalk = function (raw, opts) {
  const q = zeNorm(raw);
  const teams = teamsMentioned(q);
  const m = teams.length ? resolveFocus(q, teams) : (zeLastMatch || pickDueloMatch());
  if (m) {
    const idx = matchIndex(m);
    const after = (msg) => { const r = modelo(m); return `${msg}<br>Agora: 1 <b>${pct(r.mk['1'])}</b> · X ${pct(r.mk['X'])} · 2 ${pct(r.mk['2'])} · Over 2.5 ${pct(r.mk['O2.5'])} · golos esperados ${r.lh.toFixed(2)}–${r.la.toFixed(2)}.<br><span class="muted">Diz «porquê» para veres o raciocínio completo, ou «esquece as notas» para apagar.</span>`; };
    if (/esquece (as )?notas|apaga (as )?notas|limpa (as )?notas/.test(q)) { noteClear(idx); return { mood: 'neutro', html: `Apaguei o que me disseste sobre <b>${esc(m.home)} vs ${esc(m.away)}</b>.` }; }
    // ausências
    if (/(nao joga|nao vai jogar|lesionad|lesao|castigad|suspens|esta fora|fica de fora|nao e convocad|ausente|baixa)/.test(q)) {
      const p = findPlayerAnywhere(q, m);
      if (p) {
        zeLastMatch = m;
        noteSet(m, n => { if (!n.out.some(o => normTxt(o.name) === normTxt(p.name))) n.out.push(p); });
        return { mood: 'pensativo', html: after(`📝 Anotado: <b>${esc(p.name)}</b> fora no ${esc(m.home)} vs ${esc(m.away)}.`) };
      }
      if (!opts || !opts.noAsync) return { mood: 'pensativo', html: 'Não reconheço esse jogador neste jogo. Escreve o apelido como aparece na ficha (ex.: «Pavlidis não joga»), ou pergunta-me primeiro pela ficha do jogo.' };
    }
    // poupança / rotação
    if (/(vai poupar|poupa|poupanca|rotacao|roda a equipa|equipa b|segundas linhas|descansa os titulares|joga com os suplentes)/.test(q) && !/\?$/.test(String(raw).trim())) {
      const t = teams.find(x => teamInMatch(m, x));
      if (t) {
        const side = teamScore(m.home, normTxt(t)) > 0 ? 'h' : 'a';
        zeLastMatch = m;
        noteSet(m, n => { if (!n.rot.includes(side)) n.rot.push(side); });
        return { mood: 'pensativo', html: after(`📝 Anotado: o <b>${esc(side === 'h' ? m.home : m.away)}</b> vai poupar jogadores.`) };
      }
    }
    // segunda opinião (Forebet, tipster…)
    if (/(forebet|previsao|tipster|site diz|outra opiniao|segundo o|percentagens)/.test(q)) {
      const pr = parseThreeProbs(q);
      if (pr) {
        const src = /forebet/.test(q) ? 'Forebet' : 'Opinião externa';
        zeLastMatch = m;
        noteSet(m, n => { n.ext = { ...pr, src }; });
        const r0 = modelo(m);
        const dis = Math.abs(r0.mk['1'] - pr.p1) > 0.1 ? ` Discordamos bastante no 1 (eu ${pct(r0.mk['1'])}, ${src} ${pct(pr.p1)}) — vale a pena perceber porquê.` : ' Estamos mais ou menos alinhados.';
        return { mood: 'pensativo', html: after(`📝 Registei a opinião do ${src}: 1 ${pct(pr.p1)} · X ${pct(pr.pX)} · 2 ${pct(pr.p2)}. Conta 15% — é outro modelo, não um facto.${dis}`) };
      }
    }
    // odds da casa do utilizador
    if (/^(as )?odds?\b|cotas?\b|na betano|no placard|na betclic/.test(q)) {
      const o = parseThreeOdds(String(raw));
      if (o) {
        zeLastMatch = m;
        noteSet(m, n => { n.odds = o; });
        const r0 = modelo(m);
        const ev = ['1', 'X', '2'].map(k => ({ k, ev: r0.mk[k] * o[k] - 1 })).sort((a, b) => b.ev - a.ev)[0];
        return { mood: ev.ev > 0.03 ? 'feliz' : 'pensativo', html: after(`📝 Odds registadas para ${esc(m.home)} vs ${esc(m.away)}: 1 ${o['1'].toFixed(2)} · X ${o['X'].toFixed(2)} · 2 ${o['2'].toFixed(2)}. ${ev.ev > 0.03 ? `Com elas vejo valor em <b>${esc(marketName(ev.k, m))}</b> (+${(ev.ev * 100).toFixed(0)}%).` : 'Com estas odds não vejo valor no 1X2.'}`) };
      }
    }
  }
  if (/^\s*@?\s*\d{1,2}[.,]\d{1,2}\s*$/.test(String(raw)) && !zePending) {
    const fm = zeLastMatch || pickDueloMatch();
    return { mood: 'pensativo', html: `Odd ${esc(String(raw).trim())} para quê? Diz-me a aposta e o jogo, tipo <i>«${fm ? esc(fm.home) + ' vence' : 'Benfica vence'} ${esc(String(raw).trim())}»</i> ou <i>«over 2.5 a ${esc(String(raw).trim())}»</i>, e eu digo-te se vale.` };
  }
  return _zeTalkV27(raw, opts);
};
