
/* =====================================================================
   v38 · prints de apps de dicas (cartões: liga + hora / casa  ✓  fora / pick + odd)
   - dicas de HOJE → analisadas como seleções (valor, odd justa) e prontas a registar
   - dicas de DIAS PASSADOS (já com resultado) → histórico da app: quantas acertou, e se dava lucro
   - publicidade («CORRECT SCORE RESULT… VIP») é ignorada
   - vários prints → uma lista só, sem repetidos
   ===================================================================== */
const TIP_LEAGUE = /^(.*?[A-Za-z]{3,}.*?)\s+(\d{1,2}:\d{2})\s*$/;
const TIP_PICK = /^(.*?[A-Za-z].*?)\s+(\d{1,2}[.,]\d{2})\s*$/;
const TIP_JUNK_LEAD = /^(?:[^A-Za-z\s]+|\(?[A-Za-z]{1,2}[)\].,]+|[^A-Za-z\s]*[A-Za-z][^A-Za-z\s]+)\s+/;
const TIP_PROMO = /(correct score|odds won|vip|buy now|@gmail|telegram|whatsapp|\d\s*:\s*\d.*\d[.,]\d{2})/i;
function tipScoreOf(seg) {
  const toks = seg.trim().split(/\s+/);
  const firstT = toks[0].replace(/[oO]/g, '0'), lastT = toks[toks.length - 1].replace(/[oO]/g, '0');
  // «0 630»: o ícone colado ao número lê-se como algarismos → fica só o último
  const lead = firstT.length >= 3 ? firstT[0] : (firstT.match(/^\d{1,2}/) || [])[0];
  const tail = lastT.length >= 3 ? lastT[lastT.length - 1] : (lastT.match(/\d{1,2}$/) || [])[0];
  if (lead == null || tail == null) return null;
  if (toks.length === 1) { const s = toks[0].replace(/[oO]/g, '0'); return [+s[0], +s[s.length - 1]]; }
  return [+lead, +tail];
}
function tipMatchLine(ln) {
  const toks = ln.split(/\s+/);
  // o marcador do meio: 1 a 3 «palavras» que começam e acabam em algarismo (ou o/O lido como 0) e quase sem letras
  for (let i = 1; i < toks.length - 1; i++) for (let k = 1; k <= 3 && i + k <= toks.length - 1; k++) {
    const seg = toks.slice(i, i + k).join(' ');
    const s0 = seg[0], s1 = seg[seg.length - 1];
    const letters = (seg.match(/[A-Za-z]/g) || []).length;
    if (!/[0-9oO]/.test(s0) || !/[0-9oO]/.test(s1)) continue;
    if (!/\d/.test(seg) && !/^[oO][a-z]{0,2}[oO]?$/.test(seg)) continue;
    if ((letters > 2 && !/^[oO][a-z]{0,2}[oO]$/.test(seg)) || seg.length > 9) continue;   // «oso» = 0 ⏱ 0
    const home = toks.slice(0, i).join(' ').replace(TIP_JUNK_LEAD, '').trim(), away = toks.slice(i + k).join(' ').trim();
    if (!/[A-Za-zÀ-ÿ]{2,}/.test(home) || !/^[A-Za-zÀ-ÿ]{2,}/.test(away)) continue;   // a equipa de fora começa por letra
    return { home, away, score: tipScoreOf(seg) };
  }
  return null;
}
/** Dia escolhido na barra de datas: o número que desaparece (fica laranja e a leitura apaga-o) */
function tipSelectedDay(lines) {
  for (const ln of lines) {
    const clean = ln.replace(/\b[oO](\d{2})\b/g, '$1').replace(/\b[oO](\d)\b/g, '0$1');   // «O01» e «O1» = 01
    const nums = (clean.match(/\b\d{2}\b/g) || []).map(Number);
    if (nums.length < 6 || !nums.every(n => n >= 1 && n <= 31)) continue;
    const follows = (a, b) => b === a + 1 || (a >= 28 && b === 1);
    for (let i = 0; i < nums.length - 1; i++) {
      const a = nums[i], b = nums[i + 1];
      if (follows(a, b)) continue;
      if (b === a + 2) return a + 1;
      if (a >= 28 && b === 2) return 1;
      if (a >= 28 && b === 1) continue;
      break;
    }
    const last = nums[nums.length - 1];
    return last >= 30 ? 1 : last + 1;     // não falta nenhum no meio → o escolhido é o último (cortado)
  }
  return null;
}
function tipDate(day) {
  if (!day) return null;
  const now = new Date();
  let d = new Date(now.getFullYear(), now.getMonth(), day);
  if (d - now > 15 * 864e5) d = new Date(now.getFullYear(), now.getMonth() - 1, day);
  if (now - d > 20 * 864e5) d = new Date(now.getFullYear(), now.getMonth() + 1, day);
  return d;
}
function whichSide(txt, home, away) {
  const t = normTxt(txt).replace(/\s+/g, ''), h = normTxt(home).replace(/\s+/g, ''), a = normTxt(away).replace(/\s+/g, '');
  const sc = x => x && t.startsWith(x.slice(0, Math.min(5, x.length))) ? 1 : simil(t.slice(0, x.length), x);
  const sh = sc(h), sa = sc(a);
  return sh >= sa ? (sh >= 0.6 ? 'h' : null) : (sa >= 0.6 ? 'a' : null);
}
/** «Inter Win or Draw» → «Empate ou Inter (X2)», «Over +2,5 Goals» → «Mais de 2.5 golos» … */
function tipSel(pick, home, away) {
  const p = normTxt(pick);
  let m;
  if ((m = p.match(/both teams? scores?\s*\/?\s*(yes|no|sim|nao)/))) return /yes|sim/.test(m[1]) ? 'Ambas marcam — Sim' : 'Ambas marcam — Não';
  if ((m = p.match(/(?:over|mais de|acima de)\s*\+?\s*(\d)[.,]5/))) return `Mais de ${m[1]}.5 golos`;
  if ((m = p.match(/(?:under|menos de|abaixo de)\s*-?\s*(\d)[.,]5/))) return `Menos de ${m[1]}.5 golos`;
  const team = side => side === 'h' ? home : away;
  if ((m = p.match(/^(.*?)\s+(?:win or draw|or draw|ou empate)$/))) { const s = whichSide(m[1], home, away); if (s) return s === 'h' ? `${home} ou empate (1X)` : `Empate ou ${away} (X2)`; }
  if ((m = p.match(/^(.*?)\s+1\/1\b/))) { const s = whichSide(m[1], home, away); if (s) return `${team(s)} vence ao intervalo e no final`; }
  if ((m = p.match(/^(.*?)\s+([+-]\d)[.,]5\b/))) { const s = whichSide(m[1], home, away); if (s) return `${team(s)} ${m[2]}.5 (handicap)`; }
  if ((m = p.match(/^(.*?)\s+(?:wins?|vence|ganha)$/))) { const s = whichSide(m[1], home, away); if (s) return `${team(s)} vence`; }
  if (/^(draw|empate|x)$/.test(p)) return 'Empate';
  return pick;
}
function parseTipCards(text) {
  const lines = String(text || '').split(/\n+/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const day = tipSelectedDay(lines), date = tipDate(day);
  const cards = []; let lg = null, mt = null;
  for (const raw of lines) {
    if (TIP_PROMO.test(raw)) { lg = mt = null; continue; }
    const ln = raw.replace(TIP_JUNK_LEAD, '').trim();
    const L = ln.match(TIP_LEAGUE);
    if (L && !TIP_PICK.test(ln)) { lg = { league: L[1].trim(), time: L[2] }; mt = null; continue; }
    if (lg && !mt) { const M = tipMatchLine(raw); if (M) { mt = M; continue; } }
    if (lg && mt) {
      const P = ln.match(TIP_PICK);
      if (P) {
        const sport = /basket|nba|euroleague/i.test(lg.league) ? 'basket' : /tennis|tenis|atp|wta/i.test(lg.league) ? 'tennis' : '';
        cards.push({ league: lg.league, time: lg.time, home: mt.home, away: mt.away, score: mt.score, pick: P[1].trim(), odd: +P[2].replace(',', '.'), sel: tipSel(P[1].trim(), mt.home, mt.away), sport, day: date ? date.toISOString() : null });
        lg = mt = null;
      }
    }
  }
  if (!cards.length) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const past = date && date < today;
  cards.forEach(c => {
    c.done = past || (!date && c.score && (c.score[0] + c.score[1] > 0));
    if (c.done && c.score && !c.sport) { const cd = selConds(c.sel, { home: c.home, away: c.away }); c.won = cd ? cd.every(f => f(c.score[0], c.score[1])) : null; }
    if (c.done && c.sport && c.score) c.won = /vence/.test(c.sel) ? (whichSide(c.sel, c.home, c.away) === 'h' ? c.score[0] > c.score[1] : c.score[1] > c.score[0]) : null;
  });
  return { cards, date, promo: lines.some(l => /correct score|vip/i.test(l)) };
}
const _parseAnyV38 = parseAny;
parseAny = function (text) {
  const base = _parseAnyV38(text);
  try {
    const t = parseTipCards(text);
    const full = s => (s && s.legs || []).filter(l => Number(l.odd) > 1 && l.home && l.away).length;
    if (t && t.cards.length && t.cards.length >= full(base)) {
      const pend = t.cards.filter(c => !c.done);
      return {
        legs: pend.filter(c => !c.sport).map(c => ({ home: c.home, away: c.away, sel: c.sel, odd: c.odd, market: '', tip: c.pick, league: c.league })),
        tipsDone: t.cards.filter(c => c.done), tipsOther: pend.filter(c => c.sport), tipsDate: t.date ? t.date.toISOString() : null, tipsPromo: t.promo,
        totalOdd: null, boost: 0, stake: null, declared: null, appProb: null, text: String(text), source: 'App de dicas', tips: true
      };
    }
  } catch (e) { console.warn(e); }
  return base;
};

/* vários prints de dicas → uma lista só (sem repetidos), histórico à parte */
const _ocrBatchV38 = ocrBatch;
ocrBatch = async function (files, status) {
  const groups = await _ocrBatchV38(files, status);
  const tips = groups.filter(g => g.tips || g.source === 'App de dicas');
  if (tips.length <= 1) return groups;
  const one = { legs: [], tipsDone: [], tipsOther: [], totalOdd: null, boost: 0, stake: null, declared: null, text: '', source: 'App de dicas', tips: true, nImgs: 0, tipsPromo: false };
  const kD = c => normTxt(c.home).slice(0, 4) + '|' + normTxt(c.away).slice(0, 4) + '|' + normTxt(c.sel || c.pick).replace(/^\S+\s/, '') + '|' + c.odd;   // «Cayirova»/«Cayiorva» = o mesmo jogo
  tips.forEach(g => {
    mergeSlip(one, g); one.nImgs += g.nImgs || 1; one.text += g.text || '';
    (g.tipsDone || []).forEach(c => { if (!one.tipsDone.some(x => kD(x) === kD(c))) one.tipsDone.push(c); });
    (g.tipsOther || []).forEach(c => { if (!one.tipsOther.some(x => kD(x) === kD(c))) one.tipsOther.push(c); });
    one.tipsPromo = one.tipsPromo || g.tipsPromo;
  });
  return groups.filter(g => !tips.includes(g)).concat(one);
};

/* histórico da app de dicas (guardado: quanto acerta de verdade) */
const TIPS_KEY = 'ze_tips_v1';
function tipsRecord(done) {
  const R = lsGet(TIPS_KEY, { picks: {} });
  (done || []).forEach(c => { if (c.won == null) return; const k = (c.day || '').slice(0, 10) + '|' + normTxt(c.home).slice(0, 4) + '|' + normTxt(c.away).slice(0, 4) + '|' + c.odd; if (!R.picks[k]) R.picks[k] = { won: c.won, odd: c.odd, day: c.day }; });
  const ks = Object.keys(R.picks); if (ks.length > 600) ks.sort((a, b) => String(R.picks[a].day).localeCompare(String(R.picks[b].day))).slice(0, ks.length - 600).forEach(k => delete R.picks[k]);
  lsSet(TIPS_KEY, R);
  const all = Object.values(R.picks), n = all.length, w = all.filter(x => x.won).length;
  const avgOdd = n ? all.reduce((s, x) => s + x.odd, 0) / n : 0;
  const roi = n ? all.reduce((s, x) => s + (x.won ? x.odd - 1 : -1), 0) / n : 0;
  return { n, w, avgOdd, roi };
}
function tipsHTML(g) {
  const d = g.tipsDone || [], o = g.tipsOther || [];
  const dd = g.tipsDate ? new Date(g.tipsDate) : null;
  let h = `<div class="needs" style="margin:6px 0;"><div class="rz-head">📱 App de dicas${g.nImgs > 1 ? ` · ${g.nImgs} prints` : ''}</div>`;
  if (g.legs.length) h += `<div style="font-size:.84rem;">${g.legs.length} dica${g.legs.length > 1 ? 's' : ''} por jogar (sem repetidos). Em baixo, o valor de cada uma — escolhe só as que pagam mais do que valem.</div>`;
  if (d.length) {
    const ok = d.filter(c => c.won === true).length, ko = d.filter(c => c.won === false).length;
    h += `<div style="margin-top:6px;font-size:.84rem;"><b>Resultados que a app mostra${dd && g.legs.length === 0 ? ` (${dd.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })})` : ''}:</b> ✅ ${ok} · ❌ ${ko}${d.length - ok - ko ? ` · ${d.length - ok - ko} sem confirmar` : ''}<br>${d.map(c => `${c.won === true ? '✅' : c.won === false ? '❌' : '•'} ${esc(c.home)} ${c.score ? c.score.join('-') : ''} ${esc(c.away)} — ${esc(c.sel)} @ ${c.odd.toFixed(2)}${c.sport ? ' <span class="muted">(basquetebol)</span>' : ''}`).join('<br>')}</div>`;
    const R = tipsRecord(d);
    if (R.n >= 3) {
      const need = 1 / R.avgOdd;
      h += `<div style="margin-top:6px;font-size:.84rem;">📊 Histórico desta app no Zé: <b>${R.w}/${R.n}</b> (${pct(R.w / R.n)}) · odd média ${R.avgOdd.toFixed(2)} → para dar lucro precisa de acertar ${pct(need)}. Lucro por dica: <b class="${R.roi >= 0 ? 'ev-pos' : 'ev-neg'}">${R.roi >= 0 ? '+' : ''}${(R.roi * 100).toFixed(1)}%</b>.</div>`;
    }
    h += `<div class="muted" style="font-size:.74rem;">Atenção: estas apps mostram sobretudo os dias que correram bem. O Zé só confia no histórico que vai juntando com os teus prints, dia após dia (os bons e os maus).</div>`;
  }
  if (o.length) h += `<div class="muted" style="font-size:.78rem;margin-top:4px;">Deixei de fora ${o.length} dica${o.length > 1 ? 's' : ''} de outro desporto (${[...new Set(o.map(c => c.sport === 'basket' ? 'basquetebol' : c.sport))].join(', ')}): o meu modelo é de futebol.</div>`;
  if (g.tipsPromo) h += `<div class="muted" style="font-size:.78rem;margin-top:4px;">🙈 Ignorei a publicidade («CORRECT SCORE RESULT», «VIP»…): resultados exatos a odd 7.50 «ganhos» todos os dias não existem — é para vender VIP.</div>`;
  return h + '</div>';
}
const _batchHTMLV38 = batchHTML;
batchHTML = function (groups) {
  const tips = (groups || []).filter(g => g.tips || g.source === 'App de dicas');
  if (!tips.length) return _batchHTMLV38(groups);
  const rest = groups.filter(g => !tips.includes(g)).concat(tips.filter(g => g.legs && g.legs.length));
  return tips.map(tipsHTML).join('') + (rest.length ? _batchHTMLV38(rest) : '');
};

/* nomes da app («Villareal», «BodoGlimt», «Bratislava») também encontram o jogo no radar */
const _findMatchForLegV38 = findMatchForLeg;
findMatchForLeg = function (leg) {
  const r = _findMatchForLegV38(leg);
  if (r || !leg || !leg.home || !leg.away) return r;
  const sq = s => normTxt(s).replace(/[^a-z0-9]/g, '');
  const near = (a, b) => { const x = sq(a), y = sq(b); return x && y && (x === y || y.includes(x) || x.includes(y) || simil(x, y) >= 0.8 || fuzzyTeam(a, [b])); };
  return matches.find(m => !m.past && !m.aviso && near(leg.home, m.home) && near(leg.away, m.away)) || null;
};

/* As passagens extra do leitor (recibo, colunas) são para boletins e estragavam as dicas:
   no fim de cada print, se o texto for de uma app de dicas, manda o leitor de dicas. */
function tipsSlipFrom(text) {
  const t = parseTipCards(text);
  if (!t || !t.cards.length) return null;
  const k = c => normTxt(c.home + '|' + c.away + '|' + c.sel + '|' + c.odd);
  const seen = new Set(), cards = t.cards.filter(c => !seen.has(k(c)) && seen.add(k(c)));
  const pend = cards.filter(c => !c.done);
  return {
    legs: pend.filter(c => !c.sport).map(c => ({ home: c.home, away: c.away, sel: c.sel, odd: c.odd, market: '', tip: c.pick, league: c.league })),
    tipsDone: cards.filter(c => c.done), tipsOther: pend.filter(c => c.sport), tipsDate: t.date ? t.date.toISOString() : null, tipsPromo: t.promo,
    totalOdd: null, boost: 0, stake: null, declared: null, appProb: null, text: String(text), source: 'App de dicas', tips: true
  };
}
const _ocrFilesV38 = ocrFiles;
ocrFiles = async function (files, status) {
  const s = await _ocrFilesV38(files, status);
  try { const t = tipsSlipFrom(s.text); if (t && (t.legs.length + t.tipsDone.length + t.tipsOther.length) >= Math.max(1, (s.legs || []).filter(l => l.home && l.away).length)) return t; } catch (e) { console.warn(e); }
  return s;
};

/* Handicap («Shakhtar +1.5 (handicap)»): o «+1.5» não é «mais de 1.5 golos» */
const _selCondsV38 = selConds;
selConds = function (selRaw, m) {
  const s = normTxt(selRaw);
  const hm = s.match(/([+-]\d)[.,]5\s*\(?\s*(handicap|hcp|ah)\b|\b(handicap|hcp)\s*([+-]\d)[.,]5/);
  if (hm && m) {
    const v = parseFloat((hm[1] || hm[4]) + '.5');
    const hs = teamScore(m.home, s) > 0 || (whichSide(s, m.home, m.away) === 'h'), as = teamScore(m.away, s) > 0 || (whichSide(s, m.home, m.away) === 'a');
    if (hs && !as) return [(i, j) => i + v > j];
    if (as && !hs) return [(i, j) => j + v > i];
  }
  return _selCondsV38(selRaw, m);
};
/* «Villareal» + «PSG»: nomes curtos e com gralhas também encontram o jogo */
findMatchForLeg = (function (prev) {
  return function (leg) {
    const r = prev(leg); if (r || !leg || !leg.home || !leg.away) return r;
    const sq = s => normTxt(s).replace(/[^a-z0-9]/g, '');
    const near = (a, b) => { const x = sq(a), y = sq(b); if (!x || !y) return false; return x === y || (x.length >= 4 && (y.includes(x) || x.includes(y))) || simil(x, y) >= 0.8 || fuzzyTeam(a, [b]) || teamScore(a, normTxt(b)) > 0 || teamScore(b, normTxt(a)) > 0; };
    return matches.find(m => !m.past && !m.aviso && near(leg.home, m.home) && near(leg.away, m.away)) || null;
  };
})(findMatchForLeg);

/* Uma lista de dicas analisa-se dica a dica (não como uma múltipla gigante) */
let TIP_PICKS = [];
function tipsAnalysisHTML(g) {
  const rows = g.legs.map(l => { const e = legEval(l); const p = e.p || 0; return { l, e, p, ev: p * l.odd - 1 }; }).sort((a, b) => b.ev - a.ev);
  TIP_PICKS = rows;
  const good = rows.filter(r => r.e.m && r.ev >= 0.02);
  const tr = rows.map((r, i) => `<tr><td><input type="checkbox" data-tip="${i}" ${r.ev >= 0.02 && r.e.m ? 'checked' : ''}></td><td>${esc(r.l.home)} – ${esc(r.l.away)}</td><td>${esc(r.l.sel)}</td><td>${r.l.odd.toFixed(2)}</td><td>${r.e.m ? pct(r.p) : '—'}</td><td>${r.e.m ? fairOdd(r.p) : '—'}</td><td class="${r.ev >= 0.02 ? 'ev-pos' : r.ev < 0 ? 'ev-neg' : ''}">${r.e.m ? (r.ev >= 0 ? '+' : '') + (r.ev * 100).toFixed(0) + '%' : '?'}</td></tr>`).join('');
  const verdict = good.length
    ? `💚 Com valor ao preço da app: ${good.map(r => `<b>${esc(r.l.home)}: ${esc(r.l.sel)}</b> @ ${r.l.odd.toFixed(2)} (${pct(r.p)})`).join(' · ')}. Joga-as <b>em simples</b> — juntar dicas numa múltipla multiplica a margem da casa.`
    : `🧊 Nenhuma destas dicas paga mais do que vale (pelo meu modelo e às odds que a app mostra). Se a tua casa der odds maiores, diz-me que eu refaço as contas.`;
  const same = {}; rows.forEach(r => { const k = normTxt(r.l.home + r.l.away); same[k] = (same[k] || 0) + 1; });
  const dup = Object.values(same).some(n => n > 1) ? '<div class="muted" style="font-size:.76rem;">Há dicas diferentes para o mesmo jogo (ex.: «Shakhtar ou empate» e «Shakhtar +1.5»): são quase a mesma aposta — escolhe uma.</div>' : '';
  return `<div class="needs" style="margin:6px 0;"><div class="rz-head">🔎 As dicas de hoje, uma a uma</div>
    <div style="overflow-x:auto;"><table class="mtable"><thead><tr><th></th><th>Jogo</th><th>Dica</th><th>Odd</th><th>Prob. Zé</th><th>Justa</th><th>Valor</th></tr></thead><tbody>${tr}</tbody></table></div>
    <div style="margin-top:6px;font-size:.86rem;">${verdict}</div>${dup}
    <div class="acts" style="margin-top:6px;"><button class="mini l" onclick="tipsToEditor()">📝 Levar as marcadas para o boletim</button><button class="mini" onclick="tipsToPool()">📌 Guardar para as «Melhores do dia»</button></div>
    <div class="muted" style="font-size:.74rem;">${rows.filter(r => !r.e.m).length ? `${rows.filter(r => !r.e.m).length} jogo(s) não estão no meu radar — carrega em 📡 Atualizar. ` : ''}As odds da app podem não ser as da tua casa: confirma antes de jogar.</div></div>`;
}
function tipsChosen() { return [...document.querySelectorAll('[data-tip]')].filter(x => x.checked).map(x => TIP_PICKS[+x.dataset.tip]).filter(Boolean); }
function tipsToEditor() {
  const ch = tipsChosen(); if (!ch.length) { toast('Marca pelo menos uma dica.'); return; }
  slipState = { legs: ch.map(r => ({ ...r.l })), totalOdd: null, boost: 0, stake: null, declared: null, source: 'App de dicas', text: '' };
  fmGo('banca'); wlSetTab('registar'); try { renderSlipEditor(); } catch (e) {}
  toast(`📝 ${ch.length} dica${ch.length > 1 ? 's' : ''} no editor. Mete o valor e regista${ch.length > 1 ? ' (ou regista uma a uma, em simples)' : ''}.`);
}
function tipsToPool() {
  const ch = tipsChosen().length ? tipsChosen() : TIP_PICKS;
  try { poolAdd(ch.map(r => ({ ...r.l, p: r.p })), 'App de dicas'); toast(`📌 ${ch.length} dica(s) guardadas para as «Melhores do dia».`); } catch (e) { toast('Não consegui guardar: ' + e.message); }
}
batchHTML = (function (prev) {
  return function (groups) {
    const tips = (groups || []).filter(g => g.tips || g.source === 'App de dicas');
    if (!tips.length) return prev(groups);
    const others = groups.filter(g => !tips.includes(g));
    return tips.map(g => tipsHTML(g) + (g.legs.length ? tipsAnalysisHTML(g) : '')).join('') + (others.length ? prev(others) : '');
  };
})(batchHTML);
