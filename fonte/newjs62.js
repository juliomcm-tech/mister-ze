/* =====================================================================
   v65 · 🧾 extrato do piloto (ver, exportar, imprimir) · 🎲 sorte e azar · 📰 relatório da semana
   Nada aqui mexe nas regras do Zé: é só ler, medir e mostrar.
   ===================================================================== */
const pc1 = v => (v * 100).toFixed(1).replace('.', ',') + '%', sg1 = v => (v >= 0 ? '+' : '') + pc1(v), eu2 = v => (Number(v) || 0).toFixed(2).replace('.', ',') + ' €';
const dmy = t => new Date(t).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }), dmyhm = t => new Date(t).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const PST_TXT = { open: 'Em jogo', win: 'Ganha', loss: 'Perdida', void: 'Devolvida' }, PST_CLS = { open: 'open', win: 'win', loss: 'loss', void: 'void' };

/* ---------- 🧾 extrato de uma carteira do piloto (movimentos com saldo corrente) ---------- */
function autoLedger(w) {
  const a = autoLoad(w), ev = [];
  const bets = (a.bets || []).slice();
  const t0 = a.since ? Date.parse(a.since) : (bets.length ? Math.min.apply(null, bets.map(x => Date.parse(x.at))) - 1000 : Date.now());
  (a.topups || []).forEach(u => ev.push({ t: Date.parse(u.at) || t0, kind: 'recarga', credit: Number(u.amount) || 0, debit: 0, desc: 'Recarga da carteira', ord: 0 }));
  bets.forEach(x => {
    const tb = Date.parse(x.at) || t0, td = Math.max(tb + 1000, (x.ko || tb) + 110 * 60e3), jogo = `${x.h} – ${x.a}`;
    ev.push({ t: tb, kind: 'aposta', debit: x.stake, credit: 0, bet: x, desc: `${jogo} · ${x.label} @ ${x.od ? '≈' : ''}${Number(x.o).toFixed(2)}`, ord: 1 });
    if (x.st === 'win') ev.push({ t: td, kind: 'premio', debit: 0, credit: x.ret != null ? x.ret : r2(x.stake * x.o), bet: x, desc: `Prémio · ${jogo}${x.res ? ' (' + x.res + ')' : ''}`, ord: 2 });
    if (x.st === 'void') ev.push({ t: td, kind: 'reembolso', debit: 0, credit: x.stake, bet: x, desc: `Devolução (jogo adiado) · ${jogo}`, ord: 2 });
  });
  ev.sort((p, q) => p.t - q.t || p.ord - q.ord);
  // o saldo guardado manda: se a lista de apostas já não tem as mais antigas, a diferença entra no saldo de abertura
  const mov = ev.reduce((s, e) => s + e.credit - e.debit, 0), opening = r2(a.bank - mov), carried = Math.abs(opening - a.start) >= 0.01;
  const entries = [{ t: Math.min(t0, ev.length ? ev[0].t - 1 : t0), kind: 'abertura', credit: opening, debit: 0, desc: carried ? 'Saldo transportado (inclui movimentos mais antigos, fora desta lista)' : 'Capital inicial', ord: 0 }].concat(ev);
  let bal = 0; const seq = {}, code = { abertura: 'AB', recarga: 'RC', aposta: 'AP', premio: 'PR', reembolso: 'DV' };
  entries.forEach(e => { bal = r2(bal + e.credit - e.debit); e.bal = bal; seq[e.kind] = (seq[e.kind] || 0) + 1; e.doc = `${w.slice(0, 2).toUpperCase()}-${code[e.kind]}-${String(seq[e.kind]).padStart(3, '0')}`; });
  return { a, entries, staked: bets.reduce((s, x) => s + x.stake, 0), ret: bets.reduce((s, x) => s + (x.st === 'win' || x.st === 'void' ? (x.ret != null ? x.ret : 0) : 0), 0) };
}
const AUTO_KIND = { abertura: 'Abertura', recarga: 'Recarga', aposta: 'Aposta', premio: 'Prémio', reembolso: 'Devolução' };
function autoPill(e) { if (!e.bet) return ''; const st = e.kind === 'premio' ? 'win' : e.kind === 'reembolso' ? 'void' : e.bet.st; return `<span class="spill ${PST_CLS[st] || 'open'}">${PST_TXT[st] || '—'}</span>`; }
let AUTO_EXT = { open: false, w: 'ouro', n: 40 };
function autoExtToggle() { AUTO_EXT.open = !AUTO_EXT.open; AUTO_EXT.n = 40; autoExtPaint(); }
function autoExtSet(w) { AUTO_EXT.w = w; AUTO_EXT.n = 40; autoExtPaint(); }
function autoExtMore() { AUTO_EXT.n += 80; autoExtPaint(); }
function autoExtPaint() { const el = document.getElementById('autoExtBox'); if (el) el.outerHTML = autoExtHTML(); }
function autoLedgerTable(w, limit) {
  const L = autoLedger(w), rows = L.entries.slice().reverse(), show = limit ? rows.slice(0, limit) : rows;
  return { L, more: rows.length - show.length, html: `<table class="ltable stmt"><thead><tr><th>Data</th><th>Documento</th><th>Descrição</th><th>Estado</th><th class="num">Débito</th><th class="num">Crédito</th><th class="num">Saldo</th></tr></thead><tbody>${show.map(e => `<tr class="k-${e.kind}">
      <td data-l="Data" class="nowrap">${dmyhm(e.t)}</td><td data-l="Doc." class="doc">${e.doc}</td>
      <td data-l="Descrição" class="desc"><span class="kind">${AUTO_KIND[e.kind]}</span> ${esc(e.desc)}</td>
      <td data-l="Estado">${autoPill(e)}</td>
      <td data-l="Débito" class="num neg">${e.debit ? '−' + eu2(e.debit) : ''}</td><td data-l="Crédito" class="num pos">${e.credit ? '+' + eu2(e.credit) : ''}</td><td data-l="Saldo" class="num strong">${eu2(e.bal)}</td></tr>`).join('')}</tbody></table>` };
}
function autoExtHTML() {
  if (!AUTO_EXT.open) return `<div id="autoExtBox" style="margin-top:10px;"><button class="btn btn-sm" onclick="autoExtToggle()">🧾 Extrato, exportar e imprimir</button></div>`;
  if (!AUTO_W[AUTO_EXT.w]) AUTO_EXT.w = 'ouro';
  const T = autoLedgerTable(AUTO_EXT.w, AUTO_EXT.n), a = T.L.a, s = autoStats(a);
  return `<div id="autoExtBox" style="margin-top:12px;">
    <div class="rx-h">🧾 Extrato do piloto ${autoMode() === 'nuvem' ? '(☁️ nuvem)' : '(📱 este telemóvel)'}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">${Object.keys(AUTO_W).map(w => `<button class="btn btn-sm ${AUTO_EXT.w === w ? 'btn-lime' : ''}" onclick="autoExtSet('${w}')">${AUTO_W[w].name}</button>`).join('')}</div>
    <dl class="stmt-sum"><div><dt>Capital</dt><dd class="num">${eu2(s.capital)}</dd></div><div><dt>Apostado</dt><dd class="num neg">${eu2(T.L.staked)}</dd></div><div><dt>Recebido</dt><dd class="num pos">${eu2(T.L.ret)}</dd></div><div><dt>Saldo</dt><dd class="num strong">${eu2(a.bank)}</dd></div></dl>
    <div class="tscroll">${T.html}</div>
    ${T.more > 0 ? `<div style="margin-top:6px;"><button class="btn btn-sm" onclick="autoExtMore()">Ver mais ${Math.min(80, T.more)} movimentos (faltam ${T.more})</button></div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button class="btn btn-sm" onclick="autoCSV()">⬇️ CSV (todas as carteiras)</button><button class="btn btn-sm" onclick="autoPrint()">🖨️ Imprimir / PDF</button><button class="btn btn-sm" onclick="autoExtToggle()">Fechar</button></div>
    <div class="muted" style="font-size:.72rem;margin-top:6px;line-height:1.5;">O CSV abre no Excel e leva tudo o que serve para estudo: probabilidade do Zé, odd, odd de fecho, critério da aposta e os fatores do jogo.${autoMode() === 'nuvem' ? ` O histórico completo do piloto na nuvem fica guardado para sempre <a href="${ROBO_BASE}piloto.csv" target="_blank" rel="noopener">neste ficheiro</a>.` : ''}</div>
  </div>`;
}
autoPanelHTML = (function (prev) {
  return function () {
    const h = prev.apply(this, arguments), i = h.lastIndexOf('</div></div>');
    try { return i > 0 ? h.slice(0, i) + autoExtHTML() + h.slice(i) : h; } catch (e) { return h; }
  };
})(autoPanelHTML);
/* ---------- exportar: uma linha por aposta, com tudo o que serve para estudar ---------- */
function autoCSVText(list) {
  const q = v => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }, n = (v, d) => v == null || !isFinite(v) ? '' : Number(v).toFixed(d == null ? 2 : d).replace('.', ',');
  const head = ['carteira', 'apostada em', 'jogo em', 'liga', 'jogo', 'aposta', 'probabilidade do Zé (%)', 'odd', 'odd calculada', 'valor (€)', 'critério do valor', 'tipo', 'estado', 'resultado (90 min)', 'recebido (€)', 'lucro (€)', 'odd de fecho', 'CLV (%)', 'regras', 'odd mexeu desde a abertura (%)', 'dias de descanso', 'dias de descanso do adversário'];
  const rows = list.slice().sort((p, c) => Date.parse(p.at) - Date.parse(c.at)).map(x => {
    const dec = x.st === 'win' || x.st === 'loss' || x.st === 'void', clv = typeof autoClv === 'function' ? autoClv(x) : null, f = x.f || {};
    return [AUTO_W[x.w] ? AUTO_W[x.w].name.replace(/^\S+\s/, '') : x.w, dmyhm(Date.parse(x.at)), x.ko ? dmyhm(x.ko) : '', x.lg || '', `${x.h} – ${x.a}`, x.label || x.k, n(x.p * 100, 1), n(x.o), x.od ? 'sim' : 'não', n(x.stake), x.how || '', x.kind || '', PST_TXT[x.st] || x.st, x.res || '', dec ? n(x.ret || 0) : '', dec ? n((x.ret || 0) - x.stake) : '', n(x.cl), clv == null ? '' : n(clv * 100, 1), x.rv || 'R0', f.dr == null ? '' : n(f.dr * 100, 1), n(f.rs, 1), n(f.ro, 1)].map(q).join(';');
  });
  return '﻿' + [head.map(q).join(';')].concat(rows).join('\r\n');
}
function zeDownload(name, text, type, okMsg) {
  const blob = new Blob([text], { type: type || 'text/csv;charset=utf-8' }), file = new File([blob], name, { type: (type || 'text/csv').split(';')[0] });
  (async () => {
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    if (okMsg) toast(okMsg);
  })();
}
function autoCSV() {
  const L = autoAllBets(); if (!L.length) { toast('O piloto ainda não tem apostas para exportar.'); return; }
  zeDownload(`mister-ze-piloto-${autoMode()}-${isoDay(new Date())}.csv`, autoCSVText(L), 'text/csv;charset=utf-8', `📄 ${L.length} apostas do piloto exportadas (abre no Excel).`);
}
/* ---------- imprimir / PDF: uma folha limpa, à parte do resto da app ---------- */
function zePrintDoc(title, inner) {
  let el = document.getElementById('zePrint'); if (el) el.remove();
  el = document.createElement('div'); el.id = 'zePrint';
  el.innerHTML = `<div class="zp-head"><b>${esc(title)}</b><span>Mister Zé · ${new Date().toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })} · dinheiro virtual</span></div>${inner}`;
  document.body.appendChild(el); document.body.classList.add('print-ze');
  const done = () => { document.body.classList.remove('print-ze'); try { el.remove(); } catch (e) {} window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { try { window.print(); } catch (e) {} setTimeout(done, 60000); }, 80);
}
function autoPrint() {
  const sum = `<table class="zp-t"><thead><tr><th>Carteira</th><th>Capital</th><th>Saldo (com apostas em jogo)</th><th>Resultado</th><th>Certas</th><th>Prometia</th><th>Retorno por € apostado</th><th>CLV</th></tr></thead><tbody>${Object.keys(AUTO_W).map(w => { const a = autoLoad(w), s = autoStats(a), c = s.cur || {}; return `<tr><td><b>${esc(AUTO_W[w].name)}</b><br><small>${esc(AUTO_W[w].desc)}</small></td><td>${eu2(s.capital)}</td><td>${eu2(s.value)}</td><td>${sg1(s.roi)}</td><td>${c.n ? `${c.w}/${c.n} (${Math.round(c.hit * 100)}%)` : '—'}</td><td>${c.n ? Math.round(c.prom * 100) + '%' : '—'}</td><td>${c.yield != null ? sg1(c.yield) : '—'}</td><td>${c.clv != null ? sg1(c.clv) : '—'}</td></tr>`; }).join('')}</tbody></table>`;
  const each = Object.keys(AUTO_W).map(w => `<h3>${esc(AUTO_W[w].name)} — movimentos</h3>${autoLedgerTable(w, 0).html}`).join('');
  zePrintDoc(`Piloto automático — extrato (${autoMode() === 'nuvem' ? 'na nuvem' : 'neste telemóvel'})`, `<p class="zp-note">Regras ${typeof ZE_RULES !== 'undefined' ? ZE_RULES.ver + ', congeladas desde ' + new Date(ZE_RULES.since).toLocaleDateString('pt-PT') : ''}. «Prometia» é a média das probabilidades que o Zé deu antes dos jogos. CLV é a odd apanhada contra a odd de fecho.</p>${sum}${each}`);
}

/* ---------- 🎲 sorte e azar: o que é normal acontecer, mesmo a jogar bem ---------- */
let LUCK = { p: 77, o: 1.31, f: 1, n: 100 };
function luckSim(p, o, f, n) {
  let seed = (Math.round(p * 1e4) * 31 + Math.round(o * 1e3) * 17 + Math.round(f * 100) * 7 + n) >>> 0;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const R = 4000, fin = new Array(R), stk = new Array(R), dd = new Array(R);
  for (let r = 0; r < R; r++) {
    let b = 100, peak = 100, md = 0, s = 0, ms = 0;
    for (let i = 0; i < n; i++) { const st = b * f; if (rnd() < p) { b += st * (o - 1); s = 0; } else { b -= st; s++; if (s > ms) ms = s; } if (b > peak) peak = b; else { const d = (peak - b) / peak; if (d > md) md = d; } }
    fin[r] = b / 100 - 1; stk[r] = ms; dd[r] = md;
  }
  const srt = A => A.slice().sort((x, y) => x - y), q = (A, k) => A[Math.min(A.length - 1, Math.max(0, Math.round(k * (A.length - 1))))];
  const F = srt(fin), S = srt(stk), D = srt(dd);
  return { ev: p * o - 1, be: 1 / o, lo: q(F, 0.05), med: q(F, 0.5), hi: q(F, 0.95), neg: fin.filter(v => v < 0).length / R, sMed: q(S, 0.5), sBad: q(S, 0.95), dMed: q(D, 0.5), dBad: q(D, 0.95),
    need: p > 1 / o ? Math.ceil(3.84 * p * (1 - p) / Math.pow(p - 1 / o, 2)) : null };
}
function luckSet(k, v) { v = parseFloat(String(v).replace(',', '.')); if (!isFinite(v)) return; LUCK[k] = k === 'p' ? Math.min(99, Math.max(1, v)) : k === 'o' ? Math.min(20, Math.max(1.01, v)) : k === 'f' ? Math.min(25, Math.max(0.1, v)) : Math.min(1000, Math.max(10, Math.round(v))); luckPaint(); }
function luckPreset(p, o) { LUCK.p = p; LUCK.o = o; luckPaint(); }
function luckPaint() { const el = document.getElementById('luckPanel'); if (el) el.outerHTML = zeLuckHTML(); }
function zeLuckHTML() {
  const L = LUCK, r = luckSim(L.p / 100, L.o, L.f / 100, L.n);
  const inp = (k, lab, step, suf) => `<label style="display:flex;flex-direction:column;gap:2px;font-size:.72rem;" class="muted">${lab}<span><input class="inp" type="number" inputmode="decimal" step="${step}" value="${L[k]}" onchange="luckSet('${k}', this.value)" style="width:86px;padding:6px 8px;"> ${suf}</span></label>`;
  // carteiras do piloto com apostas suficientes viram atalhos com os números reais
  const real = Object.keys(AUTO_W).map(w => { try { const a = autoLoad(w), d = a.bets.filter(x => x.st === 'win' || x.st === 'loss'); if (d.length < 20) return ''; const h = d.filter(x => x.st === 'win').length / d.length, o = d.reduce((s, x) => s + x.o, 0) / d.length; return `<button class="btn btn-sm" onclick="luckPreset(${(h * 100).toFixed(1)}, ${o.toFixed(2)})">${AUTO_W[w].name.split(' ')[0]} piloto (${Math.round(h * 100)}% · ${o.toFixed(2)})</button>`; } catch (e) { return ''; } }).join('');
  const row = (a, b) => `<div class="zst-row"><span>${a}</span><span style="text-align:right;">${b}</span></div>`;
  return `<div class="panel" id="luckPanel"><div class="panel-h"><span>🎲 Sorte e azar</span><span class="muted">simulador</span></div><div class="panel-b">
    <div class="hint" style="margin-bottom:8px;">Mesmo a jogar bem há semanas más. Isto mostra o que é <b>normal</b> acontecer, para não desistires numa fase má nem te entusiasmares numa boa. Foram simuladas 4 000 «vidas» com estes números.</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;"><button class="btn btn-sm" onclick="luckPreset(77, 1.31)">🥇 Selo de ouro no teste (77% · 1,31)</button><button class="btn btn-sm" onclick="luckPreset(74, 1.32)">🎯 Desafios no teste (74% · 1,32)</button>${real}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">${inp('p', 'Acerta', '0.5', '%')}${inp('o', 'Odd média', '0.01', '')}${inp('f', 'Aposta de cada vez', '0.5', '% da banca')}${inp('n', 'N.º de apostas', '10', '')}</div>
    ${row('Para não perder, com esta odd, tem de acertar', `<b>${pc1(r.be)}</b>`)}
    ${row('Cada aposta vale, em média', `<b class="${r.ev >= 0 ? 'rx-pos' : 'rx-neg'}">${sg1(r.ev)}</b> do valor apostado`)}
    ${row(`Ao fim de ${L.n} apostas, a banca fica quase sempre`, `entre <b>${sg1(r.lo)}</b> e <b>${sg1(r.hi)}</b>`)}
    ${row('Probabilidade de acabar a perder', `<b>${Math.round(r.neg * 100)}%</b>`)}
    ${row('Maior série de perdas seguidas', `normal: <b>${r.sMed}</b> · num período mau: <b>${r.sBad}</b>`)}
    ${row('Maior queda da banca pelo caminho', `normal: <b>${pc1(r.dMed)}</b> · num período mau: <b>${pc1(r.dBad)}</b>`)}
    ${row('Apostas precisas para ter a certeza de que há vantagem', r.need ? `cerca de <b>${r.need > 5000 ? 'mais de 5 000' : r.need}</b>` : '<b>não há vantagem</b> com estes números')}
    <div class="muted" style="font-size:.74rem;margin-top:8px;line-height:1.5;">${r.ev < 0 ? `⚠️ Com ${pc1(L.p / 100)} de acerto a odd ${L.o.toFixed(2)} perde-se dinheiro a longo prazo, por muito que se acerte: a casa paga menos do que o risco vale.` : r.neg > 0.3 ? `Mesmo com vantagem, em ${Math.round(r.neg * 100)} de cada 100 «vidas» acaba-se a perder ao fim de ${L.n} apostas. É por isso que uma semana (ou um mês) não prova nada.` : `Com estes números a vantagem nota-se cedo — mas só valem se o acerto se mantiver com apostas a sério.`} «Quase sempre» = 9 em cada 10 vezes; «período mau» = 1 em cada 20.</div>
  </div></div>`;
}

/* ---------- 📰 relatório da semana do piloto ---------- */
let WEEK_OFF = null;
function weekBounds(off) { const d = new Date(); d.setHours(0, 0, 0, 0); const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7 * off); const nx = new Date(mon); nx.setDate(mon.getDate() + 7); return [mon.getTime(), nx.getTime()]; }
function zeWeek(off) {
  const [t0, t1] = weekBounds(off), W = {}; let any = 0;
  Object.keys(AUTO_W).forEach(w => {
    const a = autoLoad(w), B = (a.bets || []).filter(x => { const t = x.ko || Date.parse(x.at); return t >= t0 && t < t1; }), D = B.filter(x => x.st === 'win' || x.st === 'loss');
    const wins = D.filter(x => x.st === 'win').length, staked = D.reduce((s, x) => s + x.stake, 0), profit = D.reduce((s, x) => s + (x.ret || 0) - x.stake, 0);
    const clv = D.map(x => autoClv(x)).filter(v => v != null);
    W[w] = { n: B.length, dec: D.length, wins, open: B.filter(x => x.st === 'open').length, voids: B.filter(x => x.st === 'void').length, staked, profit, prom: D.length ? D.reduce((s, x) => s + x.p, 0) / D.length : null,
      clv: clv.length ? clv.reduce((s, v) => s + v, 0) / clv.length : null, pctBank: a.start ? profit / (a.start + (a.topups || []).reduce((s, u) => s + (u.amount || 0), 0)) : 0 };
    any += B.length;
  });
  // jogos sem repetir (a mesma aposta pode estar em várias carteiras)
  const seen = {}, U = autoAllBets().filter(x => { const t = x.ko || Date.parse(x.at); if (!(t >= t0 && t < t1)) return false; const k = x.ev + '|' + x.k; if (seen[k]) return false; seen[k] = 1; return true; });
  const dec = U.filter(x => x.st === 'win' || x.st === 'loss'), best = dec.filter(x => x.st === 'win').sort((p, c) => c.o - p.o)[0], worst = dec.filter(x => x.st === 'loss').sort((p, c) => c.p - p.p)[0];
  return { t0, t1, W, any, uniq: U.length, uDec: dec.length, uWin: dec.filter(x => x.st === 'win').length, best, worst, label: `${dmy(t0)} a ${dmy(t1 - 864e5)}` };
}
function weekDefault() { const prev = zeWeek(-1), d = (new Date().getDay() + 6) % 7; return (d <= 2 && prev.uDec > 0) || (!zeWeek(0).any && prev.any) ? -1 : 0; }
function weekGo(d) { WEEK_OFF = Math.min(0, (WEEK_OFF == null ? weekDefault() : WEEK_OFF) + d); const el = document.getElementById('weekPanel'); if (el) el.outerHTML = zeWeekHTML(); }
function weekVerdict(R) {
  if (!R.uDec) return R.any ? 'Ainda sem jogos decididos nesta semana.' : 'O piloto não apostou nesta semana.';
  const ci = wilson(R.uWin, R.uDec);
  return `${R.uWin} certas em ${R.uDec} jogos diferentes (${Math.round(R.uWin / R.uDec * 100)}%). Com tão poucos jogos, o acerto «verdadeiro» pode estar ${ciTxt(R.uWin, R.uDec)} — uma semana sozinha não prova nada; o que conta é o acumulado.`;
}
function zeWeekText(off) {
  const R = zeWeek(off), L = [`📰 Mister Zé · piloto ${autoMode() === 'nuvem' ? 'na nuvem' : 'do telemóvel'} · semana de ${R.label}`];
  Object.keys(AUTO_W).forEach(w => { const s = R.W[w]; L.push(`${AUTO_W[w].name}: ${s.n ? `${s.n} aposta${s.n === 1 ? '' : 's'}${s.dec ? ` · ${s.wins}/${s.dec} certas (${Math.round(s.wins / s.dec * 100)}%, prometia ${Math.round(s.prom * 100)}%) · ${sg1(s.pctBank)} da carteira` : ''}${s.clv != null ? ` · CLV ${sg1(s.clv)}` : ''}${s.open ? ` · ${s.open} em jogo` : ''}` : 'sem apostas'}`); });
  if (R.best) L.push(`Melhor: ${R.best.h}–${R.best.a} · ${R.best.label} @ ${R.best.o.toFixed(2)} ✅`);
  if (R.worst) L.push(`Pior: ${R.worst.h}–${R.worst.a} · ${R.worst.label} @ ${R.worst.o.toFixed(2)} ❌ (o Zé dava ${Math.round(R.worst.p * 100)}%)`);
  L.push(weekVerdict(R), 'Dinheiro virtual.');
  return L.join('\n');
}
function weekCopy() { const t = zeWeekText(WEEK_OFF == null ? weekDefault() : WEEK_OFF); try { navigator.clipboard.writeText(t).then(() => toast('📋 Relatório copiado.'), () => toast('Não consegui copiar.')); } catch (e) { toast('Não consegui copiar.'); } }
function weekTable(R) {
  return `<table class="rx-t zp-t"><tr><th>estratégia</th><th>apostas</th><th>certas</th><th>prometia</th><th>resultado</th><th>CLV</th></tr>${Object.keys(AUTO_W).map(w => { const s = R.W[w]; return `<tr><td><b>${AUTO_W[w].name}</b></td><td>${s.n || '—'}${s.open ? ` <span class="muted">(${s.open} em jogo)</span>` : ''}</td><td>${s.dec ? `${s.wins}/${s.dec} · ${Math.round(s.wins / s.dec * 100)}%` : '—'}</td><td>${s.dec ? Math.round(s.prom * 100) + '%' : '—'}</td><td class="${s.profit >= 0 ? 'rx-pos' : 'rx-neg'}">${s.dec ? `${s.profit >= 0 ? '+' : '−'}${eu2(Math.abs(s.profit))} <span class="muted">(${sg1(s.pctBank)})</span>` : '—'}</td><td>${s.clv != null ? sg1(s.clv) : '—'}</td></tr>`; }).join('')}</table>`;
}
function weekPrint() { const off = WEEK_OFF == null ? weekDefault() : WEEK_OFF, R = zeWeek(off); zePrintDoc(`Piloto automático — relatório da semana de ${R.label}`, `${weekTable(R)}<p class="zp-note">${esc(weekVerdict(R))}</p>${R.best ? `<p>Melhor aposta: ${esc(R.best.h)}–${esc(R.best.a)} · ${esc(R.best.label)} @ ${R.best.o.toFixed(2)} ✅</p>` : ''}${R.worst ? `<p>Pior aposta: ${esc(R.worst.h)}–${esc(R.worst.a)} · ${esc(R.worst.label)} @ ${R.worst.o.toFixed(2)} ❌ (o Zé dava ${Math.round(R.worst.p * 100)}%)</p>` : ''}`); }
function zeWeekHTML() {
  const off = WEEK_OFF == null ? weekDefault() : WEEK_OFF, R = zeWeek(off);
  return `<div class="panel" id="weekPanel"><div class="panel-h"><span>📰 Relatório da semana</span><span class="muted">${off === 0 ? 'esta semana' : off === -1 ? 'semana passada' : `há ${-off} semanas`}</span></div><div class="panel-b">
    <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:8px;"><button class="btn btn-sm" onclick="weekGo(-1)">◀</button><b>${R.label}</b><button class="btn btn-sm" ${off >= 0 ? 'disabled' : ''} onclick="weekGo(1)">▶</button></div>
    <div class="muted" style="font-size:.74rem;margin-bottom:6px;">Piloto ${autoMode() === 'nuvem' ? '☁️ na nuvem' : '📱 deste telemóvel'} · conta o dia do jogo</div>
    <div style="overflow-x:auto;">${weekTable(R)}</div>
    ${R.best ? `<div class="zst-row"><span>Melhor aposta</span><span style="text-align:right;font-size:.8rem;">${esc(R.best.h)}–${esc(R.best.a)} · ${esc(R.best.label)} @ ${R.best.o.toFixed(2)} ✅</span></div>` : ''}
    ${R.worst ? `<div class="zst-row"><span>Pior aposta</span><span style="text-align:right;font-size:.8rem;">${esc(R.worst.h)}–${esc(R.worst.a)} · ${esc(R.worst.label)} @ ${R.worst.o.toFixed(2)} ❌ <span class="muted">(dava ${Math.round(R.worst.p * 100)}%)</span></span></div>` : ''}
    <div class="muted" style="font-size:.76rem;margin-top:8px;line-height:1.5;">${esc(weekVerdict(R))}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button class="btn btn-sm" onclick="weekCopy()">📋 Copiar</button><button class="btn btn-sm" onclick="weekPrint()">🖨️ Imprimir / PDF</button></div>
  </div></div>`;
}
/** linha para o Início, à segunda, terça e quarta, quando a semana passada teve jogos decididos */
function zeWeekLine() {
  try {
    if ((new Date().getDay() + 6) % 7 > 2) return '';
    const R = zeWeek(-1); if (R.uDec < 1) return '';
    const tot = Object.keys(R.W).reduce((s, w) => s + R.W[w].profit, 0);
    return `${R.uWin}/${R.uDec} certas · ${tot >= 0 ? '+' : '−'}${eu2(Math.abs(tot))} nas ${Object.keys(R.W).length} carteiras`;
  } catch (e) { return ''; }
}
renderZeStats = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const box = document.getElementById('zeStatsBox'); if (!box) return r;
      ['weekPanel', 'luckPanel'].forEach(id => { const o = document.getElementById(id); if (o) o.remove(); });
      const hasPilot = autoLoad('ouro').on || autoAllBets().length;
      const lab = document.getElementById('factorLab');
      const html = (hasPilot ? zeWeekHTML() : '') + zeLuckHTML();
      if (lab) lab.insertAdjacentHTML('beforebegin', html); else box.insertAdjacentHTML('beforeend', html);
    } catch (e) { console.warn(e); }
    return r;
  };
})(renderZeStats);
(function () {
  try {
    const css = document.createElement('style');
    css.textContent = `#zePrint{display:none}
      @media print{ body.print-ze{background:#fff!important;color:#111!important} body.print-ze > *:not(#zePrint){display:none!important}
        body.print-ze #zePrint{display:block!important;font:11px/1.4 system-ui,Arial,sans-serif;color:#111;padding:6mm}
        #zePrint .zp-head{display:flex;justify-content:space-between;gap:10px;border-bottom:2px solid #111;padding-bottom:4px;margin-bottom:8px;font-size:13px}
        #zePrint h3{font-size:12px;margin:14px 0 4px;break-after:avoid} #zePrint .zp-note{color:#444;font-size:10px;margin:4px 0 8px}
        #zePrint table{width:100%;border-collapse:collapse;display:table!important} #zePrint thead{display:table-header-group!important} #zePrint tbody{display:table-row-group!important} #zePrint tr{display:table-row!important;break-inside:avoid}
        #zePrint th,#zePrint td{display:table-cell!important;border:1px solid #ccc!important;padding:3px 5px!important;text-align:left;color:#111!important;background:#fff!important;font-size:10px}
        #zePrint td::before{content:none!important} #zePrint .num{text-align:right;white-space:nowrap} #zePrint .muted,#zePrint small,#zePrint .doc,#zePrint .kind{color:#555!important}
        #zePrint .spill{border:1px solid #999;border-radius:8px;padding:0 5px;background:#fff!important;color:#111!important} #zePrint .pos,#zePrint .rx-pos{color:#0a7a3a!important} #zePrint .neg,#zePrint .rx-neg{color:#b0172f!important} }`;
    document.head.appendChild(css);
  } catch (e) {}
})();
