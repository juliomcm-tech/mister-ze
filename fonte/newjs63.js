/* =====================================================================
   v66 · 💰 Finanças em três contas: Tu · Mister Zé · Piloto automático
   A mesma estrutura em cada conta: Em jogo · Decididas · Extrato · Resumo, com exportar e imprimir sempre à mão.
   Só muda a forma de mostrar: nenhuma regra de aposta, saldo ou liquidação é tocada aqui.
   ===================================================================== */
const FIN = { acc: 'you', w: 'all', filt: 'tudo', nDone: 40, nExt: 60 };
const FIN_ST = { open: ['Em jogo', 'open', '⏳'], win: ['Ganha', 'win', '✅'], loss: ['Perdida', 'loss', '❌'], void: ['Devolvida', 'void', '↩️'] };
function finOn() { return !!document.getElementById('finAccs'); }
function finWallets() { return Object.keys(AUTO_W).filter(w => w !== 'justo' || (function () { try { return autoMode() === 'nuvem'; } catch (e) { return false; } })()); }
function finAccName(acc) { return acc === 'auto' ? 'Piloto automático' : holderName(acc); }
function finWName(w) { return AUTO_W[w] ? AUTO_W[w].name : w; }
function finHM(t) { return new Date(t).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }); }
function finDayLabel(t) {
  const d = new Date(t), n = new Date(), d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), n0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(), k = Math.round((d0 - n0) / 864e5);
  if (k === 0) return 'hoje'; if (k === 1) return 'amanhã'; if (k === -1) return 'ontem';
  return d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
}
function finOdd(e) { return (e.est ? '≈' : '') + Number(e.odd).toFixed(2).replace('.', ','); }

/* ---------- contas: números de cada uma ---------- */
function finPilotStats(w) {
  const ws = w && w !== 'all' && AUTO_W[w] ? [w] : finWallets();
  const o = { capital: 0, value: 0, cash: 0, exposure: 0, open: 0, n: 0, w: 0, profit: 0, staked: 0, bets: 0, since: null, wallets: ws.length };
  ws.forEach(k => {
    const a = autoLoad(k), op = a.bets.filter(x => x.st === 'open'), dec = a.bets.filter(x => x.st === 'win' || x.st === 'loss');
    const exp = op.reduce((s, x) => s + x.stake, 0), cap = a.start + (a.topups || []).reduce((s, t) => s + t.amount, 0);
    o.capital += cap; o.cash += a.bank; o.exposure += exp; o.value += a.bank + exp; o.open += op.length; o.bets += a.bets.length;
    o.n += dec.length; o.w += dec.filter(x => x.st === 'win').length; o.staked += dec.reduce((s, x) => s + x.stake, 0); o.profit += dec.reduce((s, x) => s + (x.ret || 0) - x.stake, 0);
    if (a.since && (!o.since || a.since < o.since)) o.since = a.since;
  });
  ['capital', 'cash', 'exposure', 'value', 'staked', 'profit'].forEach(k => { o[k] = r2(o[k]); });
  o.result = r2(o.value - o.capital); o.roi = o.capital ? (o.value - o.capital) / o.capital : 0; o.hit = o.n ? o.w / o.n : null;
  return o;
}

/* ---------- apostas de qualquer conta, no mesmo formato ---------- */
function finBets(acc) {
  if (acc === 'auto') {
    const all = FIN.w === 'all' || !AUTO_W[FIN.w], ws = all ? finWallets() : [FIN.w], g = new Map();
    ws.forEach(w => autoLoad(w).bets.forEach(x => {
      const key = all ? `${x.ev}|${x.k}|${x.st}` : `${w}|${x.id}`;
      let e = g.get(key);
      if (!e) {
        const t = Date.parse(x.at) || 0;
        e = { id: key, acc, t, td: Math.max(t + 1000, (x.ko || t) + 110 * 60e3), ko: x.ko || null, match: `${x.h} – ${x.a}`, lg: x.lg || '', pick: x.label || x.k, odd: +x.o, est: !!x.od, stake: 0, ret: 0, st: FIN_ST[x.st] ? x.st : 'open', res: x.res || '', p: x.p, parts: [], raw: x };
        g.set(key, e);
      }
      e.stake = r2(e.stake + x.stake);
      e.ret = r2(e.ret + (x.st === 'win' ? (x.ret != null ? x.ret : r2(x.stake * x.o)) : x.st === 'void' ? x.stake : 0));
      e.parts.push({ w, stake: x.stake, how: x.how || '', kind: x.kind || '' });
    }));
    return [...g.values()];
  }
  const b = loadBank(), L = acc === 'ze' ? b.zeBets : b.bets;
  return L.filter(x => x.status !== 'cancel').map(x => {
    const stake = Number(x.stake) || 0, odd = Number(x.odd) || 0, st = FIN_ST[x.status] ? x.status : 'open', t = Date.parse(x.at) || 0;
    return { id: String(x.id), acc, t, td: Date.parse(x.settledAt || x.at) || t, ko: null, match: x.match || '', lg: '', pick: x.pick || '', odd, est: false, stake, ret: st === 'win' ? r2(stake * odd) : st === 'void' ? stake : 0, st, res: '',
      legs: Array.isArray(x.legs) ? x.legs : [], src: (typeof SOURCE_LABEL !== 'undefined' && SOURCE_LABEL[x.source]) || '', note: x.zeCompare || '', autoSet: !!x.autoSettled, raw: x };
  });
}
function finProfit(e) { return e.st === 'win' ? r2(e.ret - e.stake) : e.st === 'loss' ? -e.stake : 0; }

/* ---------- mosaicos das três contas ---------- */
function finTile(acc, name, face, value, result, open, inplay) {
  const on = FIN.acc === acc, up = result >= 0;
  return `<button type="button" class="fin-acc ${acc}${on ? ' on' : ''}" role="tab" aria-selected="${on}" onclick="finAcc('${acc}')" aria-label="Conta ${esc(name)}">
    <span class="fa-top">${face}<span class="fa-name">${esc(name)}</span></span>
    <span class="fa-val num">${eur(value)}</span>
    <span class="fa-res ${Math.abs(result) < 0.005 ? 'muted' : up ? 'pos' : 'neg'}">${Math.abs(result) < 0.005 ? 'sem ganho nem perda' : (up ? '▲ ' : '▼ ') + eurS(result)}</span>
    <span class="fa-open${open ? ' live' : ''}">${open ? `⏳ ${open} em jogo${inplay ? ' · ' + eur(inplay) : ''}` : 'nada em jogo'}</span>
  </button>`;
}
function finPilotIcon() { let m = 'local'; try { m = autoMode(); } catch (e) {} return m === 'nuvem' ? '☁️' : '📱'; }

/* ---------- barra de ferramentas: carteiras do piloto, filtros, exportar, imprimir ---------- */
function finToolsHTML() {
  const acc = FIN.acc, t = wlTab;
  if (t === 'registar') return `<button class="btn btn-sm" onclick="wlSetTab('emjogo')">← Voltar às apostas</button>`;
  let left = '';
  if (acc === 'auto') {
    const opts = [['all', 'Todas']].concat(finWallets().map(w => [w, finWName(w)]));
    left = `<div class="fin-chips wide" role="group" aria-label="Carteiras do piloto">${opts.map(([k, l]) => `<button type="button" class="fin-chip${FIN.w === k ? ' on' : ''}" onclick="finSetW('${k}')">${l}</button>`).join('')}</div>`;
  } else if (t === 'emjogo') {
    left = acc === 'you' ? `<button class="btn btn-lime btn-sm" onclick="wlSetTab('registar')">＋ Registar aposta</button>` : '';
  } else {
    left = `<div class="seg fin-seg" role="group" aria-label="Período">${[['epoca', 'Época'], ['30d', '30 dias'], ['7d', '7 dias']].map(([k, l]) => `<button type="button" class="${wlPeriod === k ? 'active' : ''}" onclick="wlSet('period','${k}')">${l}</button>`).join('')}</div>`;
  }
  return `${left}<div class="fin-io"><button class="btn btn-sm" onclick="finShare()" title="Enviar por WhatsApp ou outra app">📤 Partilhar</button><button class="btn btn-sm" onclick="finExport()" title="Guardar num ficheiro que abre no Excel">⬇️ Exportar</button><button class="btn btn-sm" onclick="finPrint()" title="Imprimir ou guardar em PDF">🖨️ Imprimir</button></div>`;
}

/* ---------- Em jogo ---------- */
function finWhen(e, d) {
  const now = Date.now();
  if (e.ko) {
    if (now < e.ko) return { t: `⏳ Joga ${finDayLabel(e.ko)} às ${finHM(e.ko)}` };
    if (now < e.ko + 115 * 60e3) return { t: '🔴 A decorrer agora', live: 1 };
    return { t: '⌛ Já acabou · à espera do resultado' };
  }
  if (d && d.ds && d.ds.length) {
    const ic = { won: '✅', lost: '❌', pending: '⏳', notfound: '❓', manual: '✋', teams: '❓' };
    if (d.ds.length === 1) {
      const x = d.ds[0], m = /\(([^()]+)\)\s*$/.exec(x.txt || '');
      if (x.k === 'pending') return { t: `⏳ Ainda não acabou${m ? ' · ' + m[1] : ''}` };
      if (x.k === 'notfound') return { t: '❓ Ainda não encontrei este jogo nos resultados', list: [x.txt] };
      if (x.k === 'teams') return { t: '❓ Não sei de que jogo é esta aposta', list: [x.txt] };
      if (x.k === 'manual') return { t: '✋ Só tu podes confirmar esta aposta', list: [x.txt] };
      return { t: `${ic[x.k] || '•'} ${x.txt.charAt(0).toUpperCase()}${x.txt.slice(1)}` };
    }
    const c = k => d.ds.filter(x => x.k === k).length, parts = [];
    if (c('won')) parts.push(`✅ ${c('won')} certa${c('won') > 1 ? 's' : ''}`); if (c('lost')) parts.push(`❌ ${c('lost')} falhada${c('lost') > 1 ? 's' : ''}`);
    if (c('pending')) parts.push(`⏳ ${c('pending')} por jogar`); const o = d.ds.length - c('won') - c('lost') - c('pending'); if (o) parts.push(`✋ ${o} por confirmar`);
    return { t: parts.join(' · '), list: d.ds.map(x => `${ic[x.k] || '•'} ${x.txt}`) };
  }
  return { t: `Apostada ${finDayLabel(e.t)} às ${finHM(e.t)}` };
}
function finOpenCard(e, d) {
  const w = finWhen(e, d), id = esc(e.id), who = e.acc;
  const tags = e.acc === 'auto' ? e.parts.map(p => `<span class="fb-tag">${finWName(p.w)}${e.parts.length > 1 ? ' · ' + eur(p.stake) : ''}</span>`).join('') : (e.src ? `<span class="fb-tag">${esc(e.src)}</span>` : '');
  let more = '';
  if (e.acc === 'auto') {
    more = `<details class="fin-more"><summary>Porquê esta aposta</summary><div class="fm-txt">O Zé dá-lhe <b>${Math.round(e.p * 100)}%</b> de probabilidade${e.est ? ' · odd calculada a partir das odds da casa (≈)' : ''}.${e.parts.map(p => `<br>${finWName(p.w)}: ${eur(p.stake)}${p.how ? ' · ' + esc(p.how) : ''}`).join('')}</div><div class="acts"><button class="mini s" onclick="finShare('${id}')">📤 Partilhar esta aposta</button></div></details>`;
  } else {
    more = `<details class="fin-more"><summary>Fechar à mão ou partilhar</summary>${w.list ? `<div class="fm-txt">${w.list.map(esc).join('<br>')}</div>` : ''}${e.note ? `<div class="fm-txt">🤖 ${esc(e.note)}</div>` : ''}<div class="acts">
      <button class="mini w" onclick="settleBet('${id}','win','${who}')">Ganhou</button><button class="mini l" onclick="settleBet('${id}','loss','${who}')">Perdeu</button><button class="mini v" onclick="settleBet('${id}','void','${who}')">Nula</button>
      <button class="mini s" onclick="shareBet('${id}','${who}')" title="Partilhar (WhatsApp)">📤 Partilhar</button>${who === 'you' ? `<button class="mini x" onclick="cancelUserBet('${id}')" title="Não chegaste a fazer esta aposta: devolve o dinheiro à carteira">🗑️ Anular</button>` : ''}</div>
      <div class="fm-txt">As apostas fecham sozinhas quando o resultado chega. Só precisas destes botões se o jogo não for encontrado.</div></details>`;
  }
  return `<article class="fin-bet${w.live ? ' live' : ''}"><div class="fb-top"><div class="fb-match">${esc(e.match)}${e.lg ? `<small>${esc(e.lg)}</small>` : ''}</div><span class="spill open">${w.live ? 'A decorrer' : 'Em jogo'}</span></div>
    <div class="fb-pick">${esc(e.pick)}</div>
    <div class="fb-nums"><span>Odd <b>${finOdd(e)}</b></span><span>Apostado <b>${eur(e.stake)}</b></span><span>Se ganhar recebe <b class="pos">${eur(r2(e.stake * e.odd))}</b></span></div>
    <div class="fb-when${w.live ? ' live' : ''}">${esc(w.t)}</div>${tags ? `<div class="fb-tags">${tags}</div>` : ''}${more}</article>`;
}
function finOpenPaint() {
  const acc = FIN.acc, L = finBets(acc).filter(e => e.st === 'open');
  let D = {};
  if (acc !== 'auto' && L.length) { try { openDiag().forEach(d => { if (d.who === acc) D[String(d.bet.id)] = d; }); } catch (e) {} }
  L.sort((a, c) => acc === 'auto' ? (a.ko || 0) - (c.ko || 0) : c.t - a.t);
  if (!L.length) {
    const why = acc === 'you' ? 'Não tens apostas por decidir. Regista uma com o botão em cima, ou entra no Duelo.' : acc === 'ze' ? 'O Zé não tem apostas por decidir. Ele aposta quando preparas um duelo.' : 'O piloto não tem apostas por decidir. Ele só aposta a menos de 30 horas do jogo, e só quando encontra uma aposta que cumpra as regras.';
    setHTML('finOpen', `<div class="fin-empty">👌 Nada em jogo.<br>${why}</div>`); return;
  }
  const stake = r2(L.reduce((s, e) => s + e.stake, 0)), pot = r2(L.reduce((s, e) => s + e.stake * e.odd, 0));
  setHTML('finOpen', `<div class="fin-sum"><span><b>${L.length}</b> aposta${L.length > 1 ? 's' : ''} em jogo</span><span>Apostado <b>${eur(stake)}</b></span><span>Se todas ganharem <b class="pos">${eur(pot)}</b></span></div>
    <div class="fin-list">${L.map(e => finOpenCard(e, D[e.id])).join('')}</div>`);
}

/* ---------- Decididas (ganhas, perdidas, devolvidas) ---------- */
function finDoneRow(e) {
  const p = finProfit(e), s = FIN_ST[e.st], id = esc(e.id);
  let body = '';
  if (e.acc === 'auto') body = `Probabilidade do Zé: ${Math.round(e.p * 100)}%${e.est ? ' · odd calculada (≈)' : ''}${e.parts.map(q => `<br>${finWName(q.w)}: ${eur(q.stake)}${q.how ? ' · ' + esc(q.how) : ''}`).join('')}`;
  else body = `${e.legs.length > 1 ? `Múltipla de ${e.legs.length} seleções. ` : ''}${e.src ? `Origem: ${esc(e.src)}. ` : ''}${e.autoSet ? 'Fechada sozinha pelo resultado. ' : ''}${e.note ? `<br>🤖 ${esc(e.note)}` : ''}
    <div class="acts"><button class="mini s" onclick="shareBet('${id}','${e.acc}')">📤 Partilhar</button>${e.acc === 'you' ? `<button class="mini x" onclick="cancelUserBet('${id}')" title="Anular o registo (fica um estorno no extrato)">🗑️ Anular registo</button>` : ''}</div>`;
  return `<details class="fin-row"><summary><span class="fr-ic">${s[2]}</span><span class="fr-main"><span class="fr-match" style="display:block;">${esc(e.match)}${e.res ? ` <span class="muted">${esc(e.res)}</span>` : ''}</span><span class="fr-pick" style="display:block;">${esc(e.pick)} · ${finOdd(e)} · ${eur(e.stake)}</span></span>
    <span class="fr-right"><b class="${p > 0 ? 'pos' : p < 0 ? 'neg' : 'muted'}">${e.st === 'void' ? 'devolvida' : eurS(p)}</b></span></summary><div class="fr-body">${body}</div></details>`;
}
function finDonePaint() {
  const acc = FIN.acc, from = acc === 'auto' ? 0 : periodFrom();
  const all = finBets(acc).filter(e => e.st !== 'open' && e.td >= from).sort((a, c) => c.td - a.td);
  const W = all.filter(e => e.st === 'win'), Lo = all.filter(e => e.st === 'loss'), dec = W.length + Lo.length, profit = r2(all.reduce((s, e) => s + finProfit(e), 0));
  const L = FIN.filt === 'tudo' ? all : all.filter(e => e.st === FIN.filt);
  if (!all.length) { setHTML('finDone', `<div class="fin-empty">Ainda não há apostas decididas${from ? ' neste período' : ''}.</div>`); return; }
  let last = '', rows = '';
  L.slice(0, FIN.nDone).forEach(e => { const d = finDayLabel(e.td); if (d !== last) { rows += `<div class="fin-day">${d}</div>`; last = d; } rows += finDoneRow(e); });
  const kb = (k, lab, val, cls) => `<button type="button" class="fin-kpi${FIN.filt === k ? ' on' : ''}" onclick="finSetFilt('${FIN.filt === k ? 'tudo' : k}')" aria-pressed="${FIN.filt === k}"><span class="k">${lab}</span><span class="v num ${cls}">${val}</span></button>`;
  setHTML('finDone', `<div class="fin-kpis">${kb('win', '✅ Ganhas', W.length, 'pos')}${kb('loss', '❌ Perdidas', Lo.length, 'neg')}
      <div class="fin-kpi"><span class="k">Acerto</span><span class="v num">${dec ? pctP(W.length / dec) : '—'}</span></div><div class="fin-kpi"><span class="k">Resultado</span><span class="v num ${profit > 0 ? 'pos' : profit < 0 ? 'neg' : ''}">${eurS(profit)}</span></div></div>
    ${L.length ? `<div class="fin-rows">${rows}</div>` : '<div class="fin-empty">Nenhuma aposta com este filtro.</div>'}
    ${L.length > FIN.nDone ? `<div class="fin-foot"><button class="btn btn-sm" onclick="finMore('nDone')">Ver mais ${Math.min(60, L.length - FIN.nDone)} (faltam ${L.length - FIN.nDone})</button></div>` : ''}
    <div class="fin-note">Toca em «Ganhas» ou «Perdidas» para ver só essas, e numa aposta para ver os detalhes.${acc === 'auto' && FIN.w === 'all' ? ' Com «Todas» escolhido, a mesma aposta feita por várias carteiras aparece numa só linha, com os valores somados.' : ''}</div>`);
}

/* ---------- Extrato do piloto (uma carteira, ou todas juntas com saldo corrente comum) ---------- */
function finAutoLedger() {
  const ws = FIN.w === 'all' || !AUTO_W[FIN.w] ? finWallets() : [FIN.w];
  let entries = [], staked = 0, ret = 0;
  ws.forEach(w => { const L = autoLedger(w), ic = finWName(w).split(' ')[0]; staked += L.staked; ret += L.ret; L.entries.forEach(e => entries.push(Object.assign({}, e, { w, desc: ws.length > 1 ? `${ic} ${e.desc}` : e.desc }))); });
  if (ws.length > 1) { entries.sort((p, q) => p.t - q.t || p.ord - q.ord); let bal = 0; entries.forEach(e => { bal = r2(bal + e.credit - e.debit); e.bal = bal; }); }
  return { entries, staked: r2(staked), ret: r2(ret), s: finPilotStats(FIN.w) };
}
function finLedgerTable(rows) {
  return `<table class="ltable stmt"><thead><tr><th>Data</th><th>Documento</th><th>Descrição</th><th>Estado</th><th class="num">Débito</th><th class="num">Crédito</th><th class="num">Saldo</th></tr></thead><tbody>${rows.map(e => `<tr class="k-${e.kind}">
    <td data-l="Data" class="nowrap">${dmyhm(e.t)}</td><td data-l="Doc." class="doc">${e.doc}</td><td data-l="Descrição" class="desc"><span class="kind">${AUTO_KIND[e.kind]}</span> ${esc(e.desc)}</td><td data-l="Estado">${autoPill(e)}</td>
    <td data-l="Débito" class="num neg">${e.debit ? '−' + eu2(e.debit) : ''}</td><td data-l="Crédito" class="num pos">${e.credit ? '+' + eu2(e.credit) : ''}</td><td data-l="Saldo" class="num strong">${eu2(e.bal)}</td></tr>`).join('')}</tbody></table>`;
}
function finAutoExtHTML() {
  const L = finAutoLedger(), rows = L.entries.slice().reverse(), show = rows.slice(0, FIN.nExt);
  let hist = '';
  try { if (autoMode() === 'nuvem') hist = ` O histórico completo do piloto na nuvem fica guardado <a href="${ROBO_BASE}piloto.csv" target="_blank" rel="noopener">neste ficheiro</a>.`; } catch (e) {}
  return `<div class="panel stmt-panel"><div class="panel-b">
      <div class="stmt-holder"><span class="wc-ico">${finPilotIcon()}</span><div><div class="stmt-name">Piloto automático</div><div class="muted">${FIN.w === 'all' ? `${L.s.wallets} carteiras juntas` : finWName(FIN.w)} · ${finPilotIcon() === '☁️' ? 'na nuvem' : 'neste telemóvel'}</div></div></div>
      <dl class="stmt-sum"><div><dt>Capital</dt><dd class="num">${eur(L.s.capital)}</dd></div><div><dt>Apostado</dt><dd class="num neg">${eur(L.staked)}</dd></div><div><dt>Recebido</dt><dd class="num pos">${eur(L.ret)}</dd></div><div><dt>Saldo</dt><dd class="num strong">${eur(L.s.cash)}</dd></div></dl>
    </div><div class="tscroll">${finLedgerTable(show)}</div></div>
    ${rows.length > show.length ? `<div class="fin-foot"><button class="btn btn-sm" onclick="finMore('nExt')">Ver mais ${Math.min(60, rows.length - show.length)} movimentos (faltam ${rows.length - show.length})</button></div>` : ''}
    <div class="fin-note">O saldo não conta com o dinheiro das apostas em jogo.${hist}</div>`;
}

/* ---------- Resumo do piloto ---------- */
function finPilotCard(s) {
  const up = s.result >= 0, cloud = finPilotIcon() === '☁️';
  return `<article class="wcard auto" aria-label="Conta do piloto automático"><header class="wc-top"><span class="wc-ico">${finPilotIcon()}</span>
      <div class="wc-id"><div class="wc-name">Piloto automático</div><div class="wc-acc">${FIN.w === 'all' ? `${s.wallets} carteiras` : esc(finWName(FIN.w))} · ${cloud ? 'na nuvem' : 'neste telemóvel'}</div></div></header>
    <div class="wc-lbl">Saldo disponível</div><div class="wc-bal num">${eur(s.cash)}</div>
    <dl class="wc-grid" style="margin-top:14px;"><div><dt>Em jogo</dt><dd class="num">${eur(s.exposure)}</dd></div><div><dt>Património</dt><dd class="num">${eur(s.value)}</dd></div>
      <div><dt>Resultado</dt><dd class="num ${up ? 'pos' : 'neg'}">${up ? '▲' : '▼'} ${eurS(s.result)}</dd></div><div><dt>ROI</dt><dd class="num ${up ? 'pos' : 'neg'}">${pctS(s.roi)}</dd></div></dl>
    <footer class="wc-foot"><span>Capital ${eur(s.capital)}</span><span>${s.bets} apostas · ${s.open} em jogo${s.n ? ` · ${s.w}/${s.n} certas` : ''}</span></footer></article>`;
}
function finAutoSumHTML() {
  const s = finPilotStats(FIN.w);
  let sw = '', robo = '', on = true;
  try { if (cloudOk()) sw = autoSwitchHTML(); } catch (e) {}
  try { if (autoMode() === 'nuvem') { const rs = roboState(); robo = `<div class="zst-row" style="margin-bottom:10px;"><span>${rs.i} Robô na nuvem</span><span class="muted" style="text-align:right;">${esc(rs.t)}</span></div>`; } else on = !!autoLoad('ouro').on; } catch (e) {}
  return `<div class="wcards">${finPilotCard(s)}</div>
    <div class="panel"><div class="panel-h"><span>Como está a correr</span><span class="muted">${on ? '🟢 ligado' : '⚪ desligado'}</span></div><div class="panel-b">${sw}${robo}
      <div class="hint" style="margin-bottom:10px;">O Zé aposta sozinho em carteiras só dele, que não mexem no duelo. Cada estratégia tem a sua carteira, para no fim se ver qual cresce mais.</div>
      ${autoTableHTML()}
      <div class="fin-foot"><button class="btn btn-sm" onclick="finPilotCfg()">⚙️ Ligar, desligar e gerir o piloto</button></div></div></div>`;
}
function finPilotCfg() { fmGo('config'); setTimeout(() => { const el = document.getElementById('autoPanel'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 200); }

/* ---------- comandos ---------- */
function finAcc(acc) {
  if (!['you', 'ze', 'auto'].includes(acc)) acc = 'you';
  FIN.acc = acc; FIN.nDone = 40; FIN.nExt = 60; if (acc !== 'auto') wlAcc = acc;
  if (wlTab === 'registar' && acc !== 'you') { wlSetTab('emjogo'); return; }
  renderWallet();
}
function finSetW(w) { FIN.w = w === 'all' || AUTO_W[w] ? w : 'all'; FIN.nDone = 40; FIN.nExt = 60; renderWallet(); }
function finSetFilt(f) { FIN.filt = f; FIN.nDone = 40; renderWallet(); }
function finMore(k) { FIN[k] += 60; renderWallet(); }
function finOpenAcc(acc, tab) { fmGo('banca'); FIN.acc = ['you', 'ze', 'auto'].includes(acc) ? acc : 'you'; if (FIN.acc !== 'auto') wlAcc = FIN.acc; wlSetTab(tab || 'emjogo'); try { window.scrollTo(0, 0); } catch (e) {} }

/* ---------- desenhar ---------- */
function finRender() {
  const acc = FIN.acc, t = wlTab, b = loadBank();
  if (!['emjogo', 'decididas', 'extrato', 'resumo', 'registar'].includes(t)) { wlSetTab('emjogo'); return; }
  const sy = walletStats(b, 'you'), sz = walletStats(b, 'ze'), sp = finPilotStats('all');
  setHTML('finAccs', finTile('you', holderName('you'), humanFace(24), b.you, sy.result, b.bets.filter(x => x.status === 'open').length, r2(b.bets.filter(x => x.status === 'open').reduce((t, x) => t + (Number(x.stake) || 0), 0)))
    + finTile('ze', 'Zé', zeFace(zeMood(b), 24), b.ze, sz.result, b.zeBets.filter(x => x.status === 'open').length, r2(b.zeBets.filter(x => x.status === 'open').reduce((t, x) => t + (Number(x.stake) || 0), 0)))
    + finTile('auto', 'Piloto', `<span class="fa-ico">${finPilotIcon()}</span>`, sp.cash, sp.result, finBetsOpenCount(), (function () { const k = FIN.w; FIN.w = 'all'; try { return finPilotStats('all').exposure; } finally { FIN.w = k; } })()));
  const nOpen = acc === 'auto' ? finBets('auto').filter(e => e.st === 'open').length : (acc === 'ze' ? b.zeBets : b.bets).filter(x => x.status === 'open').length;
  setText('wlOpenBadge', nOpen ? String(nOpen) : '');
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.hidden = !on; };
  show('wlFilters', false);
  show('finAutoSum', acc === 'auto'); show('finSumBank', acc !== 'auto'); show('finAutoExt', acc === 'auto'); show('finExtBank', acc !== 'auto');
  show('wlRaioX', acc === 'you'); show('stuckBox', acc !== 'auto');
  setHTML('finTools', finToolsHTML());
  if (t === 'emjogo') finOpenPaint();
  if (t === 'decididas') finDonePaint();
  if (t === 'extrato') { if (acc === 'auto') setHTML('finAutoExt', finAutoExtHTML()); else renderExtrato(); }
  if (t === 'resumo') {
    if (acc === 'auto') setHTML('finAutoSum', finAutoSumHTML());
    else { _renderWalletV65(); setHTML('wlCards', walletCard(b, acc === 'ze' ? sz : sy, duelLeader(b).who === acc)); }
  }
}
function finBetsOpenCount() { const keep = FIN.w; FIN.w = 'all'; try { return finBets('auto').filter(e => e.st === 'open').length; } finally { FIN.w = keep; } }
const _renderWalletV65 = renderWallet;
renderWallet = function () {
  if (!finOn()) return _renderWalletV65.apply(this, arguments);
  try { finRender(); } catch (e) { console.error(e); }
};
wlSetTab = (function (prev) {
  return function (t) {
    if (t === 'apostas') t = 'emjogo';
    if (t === 'registar') { FIN.acc = 'you'; wlAcc = 'you'; }
    return prev.call(this, t);
  };
})(wlSetTab);
try { if (finOn()) wlTab = 'emjogo'; } catch (e) {}
stuckBox = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const sb = document.getElementById('stuckBox'); if (!sb) return r;
      // só as apostas da conta que está aberta (antes apareciam as tuas dentro da conta do Zé, e vice-versa)
      const mine = FIN.acc === 'ze' ? '🤖' : '👤'; let n = 0;
      // e só as que estão mesmo presas (com «Fecha à mão»); as que apenas esperam pelo jogo já estão nos cartões por baixo
      sb.querySelectorAll('.need').forEach(d => { const ok = FIN.acc !== 'auto' && (d.textContent || '').trim().startsWith(mine) && !!d.querySelector('.acts'); d.hidden = !ok; if (ok) n++; });
      const t = sb.querySelector('b'); if (t) t.textContent = `✋ Apostas ${FIN.acc === 'ze' ? 'do Zé ' : ''}que precisam de ti (${n})`;
      sb.hidden = !n;
    } catch (e) {}
    return r;
  };
})(stuckBox);
/* o piloto mudou (nuvem ↔ telemóvel, apostas novas): se as Finanças estiverem abertas, redesenha */
cloudRepaint = (function (prev) { return function () { const r = prev.apply(this, arguments); try { if (currentView === 'banca') renderWallet(); } catch (e) {} return r; }; })(cloudRepaint);

/* ---------- exportar ---------- */
function finCSVLine(a) { return a.map(v => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';'); }
function finNum(v) { return v == null || !isFinite(v) ? '' : Number(v).toFixed(2).replace('.', ','); }
function finBetsCSVText(acc) {
  const L = finBets(acc).sort((a, c) => a.t - c.t);
  const head = ['conta', 'apostada em', 'decidida em', 'jogo', 'aposta', 'seleções', 'odd', 'valor (€)', 'estado', 'recebido (€)', 'lucro (€)', 'origem', 'nota do Zé'];
  return '﻿' + [finCSVLine(head)].concat(L.map(e => finCSVLine([finAccName(acc), dtFmt(e.t, true), e.st === 'open' ? '' : dtFmt(e.td, true), e.match, e.pick, Math.max(1, (e.legs || []).length), finNum(e.odd), finNum(e.stake), FIN_ST[e.st][0], e.st === 'open' ? '' : finNum(e.ret), e.st === 'open' ? '' : finNum(finProfit(e)), e.src || '', e.note || '']))).join('\r\n');
}
function finExport() {
  const acc = FIN.acc, day = isoDay(new Date());
  if (acc === 'auto') {
    if (wlTab === 'extrato') {
      const L = finAutoLedger();
      const txt = '﻿' + [finCSVLine(['Data', 'Carteira', 'Documento', 'Tipo', 'Descrição', 'Estado', 'Débito', 'Crédito', 'Saldo'])].concat(L.entries.map(e => finCSVLine([dmyhm(e.t), finWName(e.w).replace(/^\S+\s/, ''), e.doc, AUTO_KIND[e.kind], e.desc, e.bet ? (PST_TXT[e.kind === 'premio' ? 'win' : e.kind === 'reembolso' ? 'void' : e.bet.st] || '') : '', e.debit ? finNum(e.debit) : '', e.credit ? finNum(e.credit) : '', finNum(e.bal)]))).join('\r\n');
      zeDownload(`extrato-piloto-${FIN.w === 'all' ? 'todas' : FIN.w}-${day}.csv`, txt, 'text/csv;charset=utf-8', `📄 Extrato do piloto exportado (${L.entries.length} movimentos · abre no Excel).`);
    } else autoCSV();
    return;
  }
  if (wlTab === 'extrato') { extratoCSV(); return; }
  const n = finBets(acc).length; if (!n) { toast('Esta conta ainda não tem apostas para exportar.'); return; }
  const slug = acc === 'ze' ? 'mister-ze' : (normTxt(holderName('you')).replace(/\s+/g, '-') || 'tu');
  zeDownload(`apostas-${slug}-${day}.csv`, finBetsCSVText(acc), 'text/csv;charset=utf-8', `📄 ${n} apostas exportadas (abre no Excel).`);
}

/* ---------- imprimir / PDF: a conta escolhida numa folha limpa ---------- */
function finPrint() {
  const acc = FIN.acc, name = finAccName(acc), bets = finBets(acc), open = bets.filter(e => e.st === 'open').sort((a, c) => (a.ko || a.t) - (c.ko || c.t)), done = bets.filter(e => e.st !== 'open').sort((a, c) => c.td - a.td);
  const b = loadBank();
  let sum, mov;
  if (acc === 'auto') {
    const s = finPilotStats(FIN.w), L = finAutoLedger();
    sum = `<table class="zp-t"><thead><tr><th>Carteiras</th><th>Capital</th><th>Saldo disponível</th><th>Em jogo</th><th>Património</th><th>Resultado</th><th>Certas</th></tr></thead><tbody><tr><td>${FIN.w === 'all' ? `Todas (${s.wallets})` : esc(finWName(FIN.w))}</td><td>${eur(s.capital)}</td><td>${eur(s.cash)}</td><td>${eur(s.exposure)}</td><td>${eur(s.value)}</td><td>${eurS(s.result)} (${pctS(s.roi)})</td><td>${s.n ? `${s.w}/${s.n} · ${pctP(s.hit)}` : '—'}</td></tr></tbody></table>`;
    mov = finLedgerTable(L.entries.slice().reverse());
  } else {
    const s = walletStats(b, acc), led = buildLedger(b, acc);
    sum = `<table class="zp-t"><thead><tr><th>Conta</th><th>Capital inicial</th><th>Saldo disponível</th><th>Em jogo</th><th>Património</th><th>Resultado</th><th>Certas</th></tr></thead><tbody><tr><td>${esc(name)} · ${accNo(acc, b)}</td><td>${eur(s.start)}</td><td>${eur(s.cash)}</td><td>${eur(s.exposure)}</td><td>${eur(s.equity)}</td><td>${eurS(s.result)} (${pctS(s.roiCap)})</td><td>${s.nWin + s.nLoss ? `${s.nWin}/${s.nWin + s.nLoss} · ${pctP(s.hit)}` : '—'}</td></tr></tbody></table>`;
    mov = `<table class="zp-t"><thead><tr><th>Data</th><th>Documento</th><th>Descrição</th><th>Estado</th><th>Débito</th><th>Crédito</th><th>Saldo</th></tr></thead><tbody>${led.entries.slice().reverse().map(e => { const pill = extratoPill(e); return `<tr><td>${dtFmt(e.t, true)}</td><td>${e.doc}</td><td>${KIND_LABEL[e.kind]} · ${esc(e.desc)}</td><td>${pill ? pill[0] : ''}</td><td>${e.debit ? '−' + eur(e.debit) : ''}</td><td>${e.credit ? '+' + eur(e.credit) : ''}</td><td>${eur(e.bal)}</td></tr>`; }).join('')}</tbody></table>`;
  }
  const tb = (L, isOpen) => L.length ? `<table class="zp-t"><thead><tr><th>${isOpen ? 'Quando' : 'Decidida'}</th><th>Jogo</th><th>Aposta</th><th>Odd</th><th>Valor</th><th>${isOpen ? 'Se ganhar recebe' : 'Estado'}</th>${isOpen ? '' : '<th>Lucro</th>'}${acc === 'auto' ? '<th>Carteiras</th>' : ''}</tr></thead><tbody>${L.map(e => `<tr><td>${isOpen ? (e.ko ? dtFmt(e.ko, true) : 'apostada ' + dtFmt(e.t, true)) : dtFmt(e.td, true)}</td><td>${esc(e.match)}${e.res ? ` (${esc(e.res)})` : ''}</td><td>${esc(e.pick)}</td><td>${finOdd(e)}</td><td>${eur(e.stake)}</td><td>${isOpen ? eur(r2(e.stake * e.odd)) : FIN_ST[e.st][0]}</td>${isOpen ? '' : `<td>${e.st === 'void' ? '—' : eurS(finProfit(e))}</td>`}${acc === 'auto' ? `<td>${e.parts.map(p => esc(finWName(p.w).replace(/^\S+\s/, ''))).join(', ')}</td>` : ''}</tr>`).join('')}</tbody></table>` : '<p class="zp-note">Nenhuma.</p>';
  zePrintDoc(`Conta ${name}`, `${sum}<h3>Apostas em jogo (${open.length})</h3>${tb(open, true)}<h3>Apostas decididas (${done.length})</h3>${tb(done.slice(0, 500), false)}<h3>Extrato de movimentos</h3>${mov}`);
}

/* ---------- Definições e ecrã do Zé: o painel do piloto fica só com os comandos; as apostas e o extrato vivem nas Finanças ---------- */
autoExtHTML = function () { return `<div id="autoExtBox" style="margin-top:12px;"><button class="btn btn-sm btn-lime" onclick="finOpenAcc('auto')">💰 Abrir a conta do piloto (em jogo, extrato, exportar)</button></div>`; };
autoPanelHTML = (function (prev) {
  return function () {
    let h = prev.apply(this, arguments);
    try { if (finOn()) h = h.replace(/<div class="rx-h">(?:Em jogo agora[^<]*|Últimas decididas)<\/div>(?:<div class="zst-row">(?:(?!<div).)*?<\/div>)*/gs, ''); } catch (e) {}
    return h;
  };
})(autoPanelHTML);

/* ---------- Início: o que está em jogo nas três contas, num relance ---------- */
function finOpenSum(acc) {
  const keep = FIN.w; FIN.w = 'all';
  try {
    const L = finBets(acc).filter(e => e.st === 'open'), now = Date.now();
    return { n: L.length, stake: r2(L.reduce((s, e) => s + e.stake, 0)), live: L.filter(e => e.ko && now >= e.ko && now < e.ko + 115 * 60e3).length };
  } catch (e) { return { n: 0, stake: 0, live: 0 }; } finally { FIN.w = keep; }
}
function finHomeStrip() {
  try {
    const A = [['you', holderName('you')], ['ze', 'Zé'], ['auto', 'Piloto']].map(([k, n]) => Object.assign({ k, name: n }, finOpenSum(k)));
    const tot = A.reduce((s, a) => s + a.n, 0); if (!tot) return '';
    const live = A.reduce((s, a) => s + a.live, 0);
    return `<div class="fin-home" aria-label="Apostas em jogo nas três contas"><div class="fh-h"><span>⏳ Em jogo agora</span><small>${tot} aposta${tot > 1 ? 's' : ''} · ${eur(r2(A.reduce((s, a) => s + a.stake, 0)))}${live ? ` · <b class="fh-live">🔴 ${live} a decorrer</b>` : ''}</small></div>
      <div class="fh-accs">${A.map(a => `<button type="button" class="fh-a ${a.k}${a.n ? '' : ' off'}" onclick="finOpenAcc('${a.k}','emjogo')"><span class="fh-n num">${a.n}</span><span class="fh-who">${esc(a.name)}</span><span class="fh-v">${a.n ? eur(a.stake) : 'nada em jogo'}</span></button>`).join('')}</div></div>`;
  } catch (e) { return ''; }
}

/* registo: a auditoria de novembro não mudou regras; ficam três testes marcados para maio */
try { ZE_RULES.log.push({ ver: ZE_RULES.ver, d: '2026-11-11', txt: 'Auditoria a 6.994 jogos de 3 épocas: 158 ideias testadas, nenhuma confirmada. As regras ficam como estão. Três testes ficam registados para medir até maio, sem mexer nas apostas: teto de odd em 1,35; não apostar em equipa cuja odd subiu mais de 10%; não apostar na casa que perdeu na 1ª volta.' }); } catch (e) {}

/* ---------- 📒 Diário: opiniões pendentes com data e liga; resultados antigos vão-se buscar; as que nunca terão resultado saem da lista ---------- */
let DIARY_CATCH_AT = 0;
const DIARY_OLD = 10 * 864e5;
function diaryPendSplit() {
  const now = Date.now(), P = Object.values(diaryLoad().items).filter(x => !x.res && !x.lost);
  const t = x => Date.parse(x.kick) || 0;
  return { next: P.filter(x => t(x) > now).sort((a, b) => t(a) - t(b)), wait: P.filter(x => t(x) <= now && now - t(x) < DIARY_OLD).sort((a, b) => t(b) - t(a)), old: P.filter(x => now - t(x) >= DIARY_OLD) };
}
function diaryPendHTML() {
  const S = diaryPendSplit(), now = Date.now();
  const when = x => { const d = new Date(x.kick); return d.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(/\./g, '') + ' ' + finHM(d); };
  const row = (x, ic) => `<div style="font-size:.8rem;padding:4px 0;border-top:1px solid var(--line2);line-height:1.4;">${ic} <b>${esc(x.home)} vs ${esc(x.away)}</b> <span class="muted">· ${esc(x.league || x.code || '')} · ${when(x)}</span><br><span class="muted">${x.pick ? `${esc(x.pick.label)} ${pct(x.pick.p)}` : 'sem aposta segura'}${x.cs ? ` · 🎯 placar previsto <b>${esc(x.cs)}</b>` : ''}${x.value ? ` · 💶 valor em ${esc(marketName(x.value.k, x))} @ ${x.value.odd}` : ''}${x.studied ? ' 🧠' : ''}</span></div>`;
  const blk = (title, L, ic, note) => L.length ? `<div style="margin-top:10px;"><b>${title} (${L.length})</b>${L.slice(0, 8).map(x => row(x, ic)).join('')}${L.length > 8 ? `<div class="muted" style="font-size:.74rem;padding-top:4px;">… e mais ${L.length - 8}</div>` : ''}${note ? `<div class="muted" style="font-size:.74rem;padding-top:4px;">${note}</div>` : ''}</div>` : '';
  return blk('🔒 Opinião gravada · jogos por jogar', S.next, '⏳', '')
    + blk('⌛ Já jogados · à espera do resultado', S.wait, '⌛', 'O resultado entra quando carregas em 📡 Atualizar. Se um jogo foi adiado, ou é de uma competição que saiu da tua lista, sai daqui sozinho ao fim de 10 dias.')
    + (S.old.length ? `<div class="muted" style="font-size:.74rem;margin-top:8px;">${S.old.length} opini${S.old.length > 1 ? 'ões antigas' : 'ão antiga'} sem resultado encontrado (jogos adiados ou fora da lista) — não conta${S.old.length > 1 ? 'm' : ''} para as estatísticas. <a href="#" onclick="diaryDropOld(); return false;">Limpar</a></div>` : '');
}
function diaryDropOld() { const D = diaryLoad(), now = Date.now(); let n = 0; Object.values(D.items).forEach(x => { if (!x.res && !x.lost && now - (Date.parse(x.kick) || 0) >= DIARY_OLD) { x.lost = true; n++; } }); if (n) diarySave(D); try { renderDiary(); } catch (e) {} toast(n ? `🧹 ${n} opini${n > 1 ? 'ões antigas arrumadas' : 'ão antiga arrumada'}.` : 'Nada para limpar.'); }
diaryHTML = (function (prev) {
  return function () {
    let h = prev.apply(this, arguments);
    try { h = h.replace(/<div style="margin-top:10px;"><b>🔒 Opiniões gravadas \(à espera do resultado\)<\/b>(?:<div style="font-size:.8rem;padding:3px 0;">(?:(?!<div).)*?<\/div>)*<\/div>/s, () => diaryPendHTML()); } catch (e) {}
    return h;
  };
})(diaryHTML);
/* jogos já jogados cujo resultado nunca chegou (a app esteve fechada, a liga saiu da lista): vai buscar o mês dessa liga */
async function diaryCatchUp(force) {
  if (/jsdom/i.test(navigator.userAgent || '') || window.__ZE_LAB || navigator.onLine === false) return 0;
  if (!force && Date.now() - DIARY_CATCH_AT < 30 * 60e3) return 0;
  if (typeof espnCooling === 'function' && espnCooling()) return 0;
  const now = Date.now(), want = {};
  Object.values(diaryLoad().items).forEach(x => {
    const t = Date.parse(x.kick) || 0; if (x.res || x.lost || !x.code || now - t < 1.5 * 864e5 || now - t > 45 * 864e5) return;
    const d = new Date(t); want[x.code + '|' + d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0')] = 1;
  });
  const keys = Object.keys(want).slice(0, 4); if (!keys.length) return 0;
  DIARY_CATCH_AT = Date.now();
  const all = [];
  for (const kk of keys) {
    const [code, ym] = kk.split('|');
    try {
      const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${ym}&limit=1000`);
      (j.events || []).forEach(ev => { const n = normalizeEspn(ev, code, (typeof ESPN_LEAGUES !== 'undefined' && ESPN_LEAGUES[code]) || code); if (n) all.push(n); });
    } catch (e) {}
    if (typeof espnCooling === 'function' && espnCooling()) break;
  }
  const n = all.length ? diaryGrade({ matches: all }) : 0;
  try { if (n && currentView === 'ze') renderDiary(); } catch (e) {}
  return n;
}
setTimeout(() => diaryCatchUp().catch(() => {}), 60000);
applyLive = (function (prev) { return function () { const r = prev.apply(this, arguments); setTimeout(() => diaryCatchUp().catch(() => {}), 40000); return r; }; })(applyLive);
try { ZE_RULES.log.push({ ver: ZE_RULES.ver, d: '2026-11-12', txt: 'O piloto na nuvem passa a ser um só apostador com 1000 € virtuais ao todo, repartidos pelas 4 estratégias (250 € cada). As apostas já feitas foram reduzidas na mesma proporção; as regras e as percentagens apostadas não mudaram.' }); } catch (e) {}

/* 📸 Boletim abre como ecrã próprio (título e botão de voltar), e sair dele repõe as Finanças normais */
function finRegMode() {
  try {
    const on = currentView === 'banca' && wlTab === 'registar';
    document.body.classList.toggle('fin-reg', on); document.body.classList.toggle('fin-dim', currentView === 'banca');
    const e = document.getElementById('finEyebrow'), h = document.getElementById('finTitle');
    if (e) e.textContent = on ? 'Boletim' : 'Finanças'; if (h) h.textContent = on ? 'Manda o print ou regista' : 'Contas';
  } catch (e) {}
}
wlSetTab = (function (prev) { return function () { const r = prev.apply(this, arguments); finRegMode(); return r; }; })(wlSetTab);
fmGo = (function (prev) { return function (view) { try { if (view === 'banca' && wlTab === 'registar' && !window.__finKeepReg) { if (currentView === 'banca') wlSetTab('emjogo'); else wlTab = 'emjogo'; } } catch (e) {} const r = prev.apply(this, arguments); finRegMode(); return r; }; })(fmGo);

/* ---------- partilhar: as apostas de uma conta em texto (WhatsApp, etc.) — também as do piloto ---------- */
function finShareText(acc, id) {
  const who = acc === 'auto' ? '🛫 Piloto automático do Mister Zé' : acc === 'ze' ? '🤖 Mister Zé' : '⭐ ' + holderName('you');
  const when = e => { if (!e.ko) return ''; const d = new Date(e.ko); return ' · ' + finDayLabel(e.ko) + ' ' + finHM(d); };
  const line = e => `• ${e.match}${e.lg ? ' (' + e.lg + ')' : ''}${when(e)}\n   ${e.pick} @ ${Number(e.odd).toFixed(2)}${e.est ? '≈' : ''} · ${eur(e.stake)}${e.st === 'open' ? ' → pode dar ' + eur(r2(e.stake * e.odd)) : ' · ' + FIN_ST[e.st][0] + (e.res ? ' (' + e.res + ')' : '') + ' · ' + (finProfit(e) >= 0 ? '+' : '') + eur(finProfit(e))}`;
  const all = finBets(acc);
  if (id) { const e = all.find(x => x.id === id); return e ? `${who}\n${line(e)}\n— Mister Zé · dinheiro virtual` : ''; }
  const open = all.filter(e => e.st === 'open').sort((a, c) => (a.ko || a.t) - (c.ko || c.t)), done = all.filter(e => e.st === 'win' || e.st === 'loss').sort((a, c) => c.td - a.td);
  const L = wlTab === 'decididas' ? done.slice(0, 12) : open, title = wlTab === 'decididas' ? 'Últimas decididas' : 'Em jogo';
  if (!L.length) return '';
  const wins = done.filter(e => e.st === 'win').length, pr = r2(done.reduce((s, e) => s + finProfit(e), 0));
  const sum = done.length ? `\nAté agora: ${wins}/${done.length} certas · ${pr >= 0 ? '+' : ''}${eur(pr)}` : '';
  return `${who}${acc === 'auto' && FIN.w !== 'all' && AUTO_W[FIN.w] ? ' · ' + finWName(FIN.w) : ''}\n${title} (${L.length}):\n${L.map(line).join('\n')}${sum}\n— Mister Zé · dinheiro virtual`;
}
/* a mesma imagem bonita das apostas do duelo, agora para qualquer conta e também para a lista inteira */
function finShareBet(acc, id) {
  const all = finBets(acc), who = acc === 'auto' ? 'auto' : acc;
  const name = acc === 'auto' ? 'PILOTO DO ZÉ' : acc === 'ze' ? 'MISTER ZÉ' : (pname() === 'Tu' ? 'MIM' : pname().toUpperCase());
  const leg = e => { const [h, a] = String(e.match).split(/\s+[–-]\s+|\s+vs\s+/i); return { sel: e.pick, odd: e.odd, home: h || e.match, away: a || '', extra: eur(e.stake),
    _inf: acc === 'auto' ? { when: e.ko ? new Date(e.ko) : null, st: e.st === 'win' || e.st === 'loss' ? { win: e.st === 'win', score: e.res || '' } : e.st === 'void' ? { off: true } : null } : null }; };
  if (id) {
    const e = all.find(x => x.id === id); if (!e) return null;
    if (acc !== 'auto') return { native: true };
    const l = leg(e); delete l.extra;
    return { who, bet: { match: e.match, pick: e.pick, odd: e.odd, stake: e.stake, status: e.st, at: e.t, legs: [l], pUsed: e.p, finalScores: e.res || '' } };
  }
  const done = all.filter(e => e.st === 'win' || e.st === 'loss').sort((a, c) => c.td - a.td), open = all.filter(e => e.st === 'open').sort((a, c) => (a.ko || a.t) - (c.ko || c.t));
  const dec = wlTab === 'decididas', L = dec ? done.slice(0, 12) : open; if (!L.length) return null;
  const stake = r2(L.reduce((s, e) => s + e.stake, 0)), wins = done.filter(e => e.st === 'win').length, pr = r2(done.reduce((s, e) => s + finProfit(e), 0));
  const legs = L.map(e => { const l = leg(e); if (acc !== 'auto') l._inf = { when: null, st: e.st === 'win' || e.st === 'loss' ? { win: e.st === 'win', score: '' } : null }; return l; });
  return { who, bet: { match: '', pick: '', odd: 1, stake, status: 'open', at: Date.now(), legs,
    _title: dec ? `ÚLTIMAS ${acc === 'you' ? 'DE' : 'DO'} ${name}` : `EM JOGO · ${name}`, _list: `${L.length} aposta${L.length > 1 ? 's' : ''}${acc === 'auto' && FIN.w !== 'all' && AUTO_W[FIN.w] ? ' · ' + finWName(FIN.w).replace(/^\S+\s/, '') : ''}`,
    _boxes: dec ? [['Apostas', String(L.length)], ['Certas', `${L.filter(e => e.st === 'win').length}/${L.length}`, '#c8f53c'], ['Resultado', (L.reduce((s, e) => s + finProfit(e), 0) >= 0 ? '+' : '') + eur(r2(L.reduce((s, e) => s + finProfit(e), 0))), L.reduce((s, e) => s + finProfit(e), 0) >= 0 ? '#2fd27a' : '#ff7a8f']]
      : [['Apostas', String(L.length)], ['Em jogo', eur(stake)], ['Pode dar', eur(r2(L.reduce((s, e) => s + e.stake * e.odd, 0))), '#c8f53c']],
    _foot: done.length ? `ATÉ AGORA  ·  ${wins}/${done.length} CERTAS  ·  ${pr >= 0 ? '+' : ''}${eur(pr)}` : 'AINDA SEM APOSTAS DECIDIDAS' } };
}
async function finShare(id) {
  const acc = FIN.acc, text = finShareText(acc, id), S = finShareBet(acc, id);
  if (!text || !S) { toast(wlTab === 'decididas' ? 'Ainda não há apostas decididas para partilhar.' : 'Esta conta não tem apostas em jogo para partilhar.'); return; }
  if (S.native) { shareBet(id, acc); return; }
  toast('🖼️ A preparar a imagem…');
  try { const blobs = await betCardImages(S.bet, S.who); if (blobs && blobs.length) { await shareOutMany(text, blobs, `${acc === 'auto' ? 'piloto' : acc === 'ze' ? 'mister-ze' : 'apostas'}-${isoDay(new Date())}`); return; } } catch (e) { console.warn(e); }
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { shareSheet(text, null); } catch (e) { toast('Não consegui partilhar neste browser.'); }
}

/* ================= v67 · Estatísticas: partilhar e imprimir cada janela + relatório do ano, mês a mês ================= */
const ST_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const stMonthKey = t => { const d = new Date(t); return isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const stMonthName = k => { const [y, m] = k.split('-'); return ST_MES[+m - 1].replace(/^./, c => c.toUpperCase()) + ' ' + y; };
const stPct = (a, n) => n ? Math.round(a / n * 100) + '%' : '—';
const stSg = v => (v >= 0 ? '+' : '−') + eur(Math.abs(r2(v)));
/* opiniões do Zé já corrigidas (a aposta mais segura de cada jogo): mês → liga → contas */
function stDiaryMonths() {
  const M = {};
  Object.values(diaryLoad().items).forEach(x => {
    if (!x.res || !x.g || !x.pick || x.g.pick == null) return;
    const k = stMonthKey(x.kick); if (!k) return; const lg = x.league || x.code || 'Outras';
    const m = M[k] = M[k] || { tot: { n: 0, hit: 0, exp: 0 }, lg: {} }, l = m.lg[lg] = m.lg[lg] || { n: 0, hit: 0, exp: 0 };
    [m.tot, l].forEach(o => { o.n++; o.hit += x.g.pick ? 1 : 0; o.exp += x.pick.p || 0; });
  });
  return M;
}
/* apostas decididas de uma conta: mês → totais (e por liga, quando a aposta a traz) */
function stAccMonths(acc) {
  const keep = FIN.w; FIN.w = 'all'; let L = []; try { L = finBets(acc); } catch (e) {} FIN.w = keep;
  const M = {};
  L.filter(e => e.st === 'win' || e.st === 'loss').forEach(e => {
    const k = stMonthKey(e.td); if (!k) return;
    const m = M[k] = M[k] || { tot: { n: 0, win: 0, stake: 0, pr: 0 }, lg: {} };
    const cv = acc === 'auto' && typeof autoClv === 'function' ? autoClv(e.raw) : null;
    const add = o => { o.n++; o.win += e.st === 'win' ? 1 : 0; o.stake += e.stake; o.pr += finProfit(e); if (cv != null) { o.cn = (o.cn || 0) + 1; o.cs = (o.cs || 0) + cv; } };
    add(m.tot); if (e.lg) add(m.lg[e.lg] = m.lg[e.lg] || { n: 0, win: 0, stake: 0, pr: 0 });
  });
  return M;
}
function stYearHTML(full) {
  const D = stDiaryMonths(), dk = Object.keys(D).sort();
  const A = { you: stAccMonths('you'), ze: stAccMonths('ze'), auto: stAccMonths('auto') };
  const cls = v => v >= 0 ? 'rx-pos pos' : 'rx-neg neg';
  const MN = k => full ? stMonthName(k) : stMonthName(k).slice(0, 3) + ' ' + k.slice(2, 4), X = s => full ? s : '';
  let h = '';
  // 1) o Zé a prever
  if (dk.length) {
    const T = { n: 0, hit: 0, exp: 0 };
    h += `<h3>🔮 O Zé a prever — aposta mais segura de cada jogo</h3><table class="rx-t zp-t"><thead><tr><th>Mês</th><th>Liga</th><th class="num">Jogos</th><th class="num">Certas</th>${X('<th class="num">Falhadas</th>')}<th class="num">Acerto</th><th class="num">Prometia</th><th>Sinal</th></tr></thead><tbody>`;
    dk.forEach(k => {
      const m = D[k]; T.n += m.tot.n; T.hit += m.tot.hit; T.exp += m.tot.exp;
      if (full) Object.entries(m.lg).sort((a, b) => b[1].n - a[1].n).forEach(([lg, o]) => { h += `<tr><td>${stMonthName(k)}</td><td>${esc(lg)}</td><td class="num">${o.n}</td><td class="num">${o.hit}</td>${X(`<td class="num">${o.n - o.hit}</td>`)}<td class="num">${stPct(o.hit, o.n)}</td><td class="num">${stPct(o.exp, o.n)}</td><td>${stSignal(o.hit, o.n, o.exp, full)}</td></tr>`; });
      h += `<tr class="st-tot"><td><b>${MN(k)}</b></td><td><b>${full ? 'Total do mês' : Object.keys(m.lg).length + ' ligas'}</b></td><td class="num"><b>${m.tot.n}</b></td><td class="num"><b>${m.tot.hit}</b></td>${X(`<td class="num"><b>${m.tot.n - m.tot.hit}</b></td>`)}<td class="num"><b>${stPct(m.tot.hit, m.tot.n)}</b></td><td class="num">${stPct(m.tot.exp, m.tot.n)}</td><td>${stSignal(m.tot.hit, m.tot.n, m.tot.exp, full)}</td></tr>`;
    });
    h += `<tr class="st-tot"><td><b>Época</b></td><td></td><td class="num"><b>${T.n}</b></td><td class="num"><b>${T.hit}</b></td>${X(`<td class="num"><b>${T.n - T.hit}</b></td>`)}<td class="num"><b>${stPct(T.hit, T.n)}</b></td><td class="num">${stPct(T.exp, T.n)}</td><td>${stSignal(T.hit, T.n, T.exp, full)}</td></tr></tbody></table>
      <p class="zp-note muted" style="font-size:.74rem;">«Prometia» é a média das probabilidades que o Zé deu antes dos jogos. O sinal compara o acerto com o prometido tendo em conta quantos jogos foram: ⚪ poucos jogos para concluir · 🟢 dentro do normal · 🟡 a vigiar · 🔴 pior do que a sorte explica · 🔵 melhor do que o esperado.</p>`;
  }
  // 2) as três contas
  [['you', '⭐ ' + holderName('you')], ['ze', '🤖 Mister Zé (duelo)'], ['auto', '🛫 Piloto automático']].forEach(([acc, name]) => {
    const M = A[acc], ks = Object.keys(M).sort(); if (!ks.length) return;
    const T = { n: 0, win: 0, stake: 0, pr: 0, cn: 0, cs: 0 };
    h += `<h3>${esc(name)} — apostas decididas</h3><table class="rx-t zp-t"><thead><tr><th>Mês</th>${full && acc === 'auto' ? '<th>Liga</th>' : ''}<th class="num">Apostas</th><th class="num">Ganhas</th>${X('<th class="num">Perdidas</th>')}<th class="num">Acerto</th>${X('<th class="num">Apostado</th>')}<th class="num">Resultado</th><th class="num">${full ? 'Por € apostado' : 'Por €'}</th>${acc === 'auto' ? `<th class="num">${full ? 'Odd apanhada vs fecho' : 'vs fecho'}</th>` : ''}</tr></thead><tbody>`;
    const row = (a, b, o, bold) => { const B = s => bold ? `<b>${s}</b>` : s; return `<tr${bold ? ' class="st-tot"' : ''}><td>${B(a)}</td>${full && acc === 'auto' ? `<td>${B(b)}</td>` : ''}<td class="num">${B(o.n)}</td><td class="num">${B(o.win)}</td>${X(`<td class="num">${B(o.n - o.win)}</td>`)}<td class="num">${B(stPct(o.win, o.n))}</td>${X(`<td class="num">${eur(r2(o.stake))}</td>`)}<td class="num ${cls(o.pr)}">${B(stSg(o.pr))}</td><td class="num ${cls(o.pr)}">${o.stake ? (o.pr >= 0 ? '+' : '−') + Math.abs(o.pr / o.stake * 100).toFixed(1) + '%' : '—'}</td>${acc === 'auto' ? `<td class="num ${o.cn ? cls(o.cs) : ''}">${o.cn ? (o.cs >= 0 ? '+' : '−') + Math.abs(o.cs / o.cn * 100).toFixed(1) + '%' + (full ? ` (${o.cn})` : '') : '—'}</td>` : ''}</tr>`; };
    ks.forEach(k => {
      const m = M[k]; ['n', 'win', 'stake', 'pr', 'cn', 'cs'].forEach(f => T[f] += m.tot[f] || 0);
      if (full && acc === 'auto') Object.entries(m.lg).sort((a, b) => b[1].n - a[1].n).forEach(([lg, o]) => { h += row(stMonthName(k), esc(lg), o, false); });
      h += row(MN(k), 'Total do mês', m.tot, true);
    });
    h += row('Época', '', T, true) + '</tbody></table>';
    if (acc === 'auto') h += `<p class="zp-note muted" style="font-size:.74rem;">«vs fecho» compara a odd que o piloto apanhou com a odd no início do jogo. Positivo, mês após mês, é o melhor sinal de que o modelo vê coisas antes do mercado — mesmo antes de haver lucro.</p>`;
  });
  try { h += stExtraHTML(full); } catch (e) { console.warn(e); }
  return h || '<p class="muted">Ainda não há jogos corrigidos nem apostas decididas. Este quadro enche-se sozinho à medida que os resultados entram.</p>';
}
function stYearPanelHTML() {
  return `<div class="panel" id="yearPanel" style="margin-top:12px;"><div class="panel-h"><span>📅 A época, mês a mês</span><span class="muted">acertos, falhas e resultado por mês</span></div>
    <div class="panel-b">${stYearHTML(false)}<div class="btn-row" style="margin-top:10px;"><button class="btn btn-lime btn-sm" onclick="stYearPrint()">🖨️ Relatório completo por mês e por liga (PDF)</button></div></div></div>`;
}
function stYearPrint() {
  zePrintDoc('Mister Zé — relatório da época, mês a mês', `<p class="zp-note">Por cada mês: o que o Zé previu em cada liga (certas, falhadas, acerto) e o que cada conta apostou e ganhou ou perdeu. Regras ${typeof ZE_RULES !== 'undefined' ? ZE_RULES.ver : ''}. Dinheiro virtual.</p>${stYearHTML(true)}`);
}
/* cada janela das Estatísticas ganha 📤 e 🖨️ no cabeçalho */
function stPanelOf(btn) { const p = btn.closest('.panel'); const t = p && p.querySelector('.panel-h span'); return p ? { p, title: (t ? t.textContent : 'Estatísticas').trim() } : null; }
function stPanelClone(p) {
  const c = (p.querySelector('.panel-b') || p).cloneNode(true);
  c.querySelectorAll('details').forEach(d => d.setAttribute('open', ''));
  c.querySelectorAll('button, input, select, textarea, .btn-row, .st-io, canvas, script').forEach(x => x.remove());
  c.querySelectorAll('[hidden]').forEach(x => x.remove());
  return c;
}
function stPanelPrint(btn) { const o = stPanelOf(btn); if (!o) return; zePrintDoc('Mister Zé — ' + o.title, `<div class="zp-panel">${stPanelClone(o.p).innerHTML}</div>`); }
async function stPanelShare(btn) {
  const o = stPanelOf(btn); if (!o) return;
  const c = stPanelClone(o.p); c.querySelectorAll('tr').forEach(tr => { tr.querySelectorAll('th,td').forEach((td, i) => { if (i) td.insertAdjacentText('afterbegin', ' · '); }); tr.insertAdjacentText('beforeend', '\n'); });
  c.querySelectorAll('span, b, small, strong, a').forEach(x => x.insertAdjacentText('afterend', ' '));
  c.querySelectorAll('div, p, h3, h4, li, summary, br').forEach(x => x.insertAdjacentText(x.tagName === 'BR' ? 'afterend' : 'beforeend', '\n'));
  let body = (c.textContent || '').replace(/[ \t]+/g, ' ').replace(/ ([,.;:)%])/g, '$1').replace(/ ?\n ?/g, '\n').replace(/\n{2,}/g, '\n').trim();
  if (!body) { toast('Esta janela ainda não tem nada para partilhar.'); return; }
  if (body.length > 3000) body = body.slice(0, 3000).replace(/\n[^\n]*$/, '') + '\n… (o resto está na app)';
  const text = `📊 Mister Zé — ${o.title}\n${body}\n— Mister Zé · dinheiro virtual`;
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { shareSheet(text, null); } catch (e) { toast('Não consegui partilhar neste browser.'); }
}
function stAllPrint() {
  const box = document.getElementById('zeStatsBox'); if (!box) return;
  const parts = [...box.querySelectorAll('.panel')].filter(p => p.id !== 'yearPanel').map(p => { const t = p.querySelector('.panel-h span'); return `<h3>${esc(t ? t.textContent.trim() : '')}</h3><div class="zp-panel">${stPanelClone(p).innerHTML}</div>`; }).join('');
  zePrintDoc('Mister Zé — estatísticas completas', parts + '<h3>📅 A época, mês a mês</h3>' + stYearHTML(true));
}
function stDecorate() {
  const box = document.getElementById('zeStatsBox'); if (!box) return;
  const old = document.getElementById('yearPanel'); if (old) old.remove();
  const bar0 = document.getElementById('stTopBar'); if (bar0) bar0.remove();
  box.insertAdjacentHTML('afterbegin', `<div class="fin-io st-top" id="stTopBar"><button class="btn btn-sm" onclick="stYearPrint()">📅 Época por mês (PDF)</button><button class="btn btn-sm" onclick="stAllPrint()">🖨️ Imprimir tudo</button></div>` + stYearPanelHTML());
  box.querySelectorAll('.panel').forEach(p => {
    const h = p.querySelector('.panel-h'); if (!h || h.querySelector('.st-io')) return;
    h.insertAdjacentHTML('beforeend', `<span class="st-io"><button type="button" title="Partilhar esta janela" aria-label="Partilhar esta janela" onclick="event.stopPropagation(); stPanelShare(this)">📤</button><button type="button" title="Imprimir ou guardar em PDF" aria-label="Imprimir ou guardar em PDF" onclick="event.stopPropagation(); stPanelPrint(this)">🖨️</button></span>`);
  });
}
renderZeStats = (function (prev) { return function () { const r = prev.apply(this, arguments); try { stDecorate(); } catch (e) { console.warn(e); } return r; }; })(renderZeStats);
(function () {
  const css = document.createElement('style');
  css.textContent = `.st-io{display:inline-flex;gap:6px;margin-left:auto;flex:0 0 auto}.st-io button{width:34px;height:34px;border-radius:9px;border:1px solid var(--border);background:var(--tile);cursor:pointer;font-size:.95rem;line-height:1;padding:0}
    .st-io button:active{transform:scale(.95)}#zeStatsBox .panel-h{gap:8px;align-items:center}#zeStatsBox .panel-h>.muted{margin-left:auto;text-align:right}#zeStatsBox .panel-h>.muted+.st-io{margin-left:0}
    .st-top{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin:0 0 10px}#yearPanel table{width:100%}#yearPanel .st-tot td{border-top:1px solid var(--border)}#yearPanel h3{font-size:.86rem;margin:12px 0 6px}#yearPanel h3:first-child{margin-top:0}
    @media (max-width:560px){#zeStatsBox .panel-h>.muted{display:none}#yearPanel table{font-size:.74rem}#yearPanel th,#yearPanel td{padding:5px 4px}}
    @media print{#zePrint .zp-panel,#zePrint .zp-panel *{color:#111!important;background:transparent!important;border-color:#ccc!important;box-shadow:none!important}#zePrint .zp-panel{font-size:10.5px}#zePrint .zp-panel details>summary{font-weight:700;list-style:none}#zePrint .st-tot td{background:#f1f1f1!important;font-weight:700}#zePrint .zp-panel>div{break-inside:avoid}}`;
  document.head.appendChild(css);
})();

/* ---------- auditoria contínua: sinal, tu contra o Zé, tipo de aposta e faixa de odd ---------- */
function stSignal(hit, n, exp, full) {
  if (!n) return '';
  const p = Math.min(.98, Math.max(.02, exp / n)), z = (hit - exp) / Math.sqrt(n * p * (1 - p));
  const t = n < 12 ? ['⚪', 'poucos jogos'] : z <= -2.5 ? ['🔴', 'pior que a sorte'] : z <= -1.5 ? ['🟡', 'a vigiar'] : z >= 2 ? ['🔵', 'acima do esperado'] : ['🟢', 'normal'];
  return `<span title="${t[1]}">${t[0]}${full ? ' ' + t[1] : ''}</span>`;
}
const ST_BANDS = [['até 1,29', 0, 1.30], ['1,30 a 1,49', 1.30, 1.50], ['1,50 a 1,99', 1.50, 2], ['2,00 ou mais', 2, 1e9]];
function stHeadToHead() {
  const b = loadBank(), dec = x => x.status === 'win' || x.status === 'loss', one = x => !Array.isArray(x.legs) || x.legs.length <= 1, key = x => normTxt(String(x.match || '')).replace(/\b(vs|x)\b|[–-]/g, ' ').replace(/\s+/g, ' ').trim();
  const Z = {}; b.zeBets.filter(x => dec(x) && one(x)).forEach(x => { Z[key(x)] = x; });
  const R = { n: 0, you: 0, ze: 0, both: 0, none: 0, same: 0, list: [] };
  b.bets.filter(x => dec(x) && one(x)).forEach(x => {
    const z = Z[key(x)]; if (!z || !key(x)) return;
    const a = x.status === 'win', c = z.status === 'win'; R.n++; if (a) R.you++; if (c) R.ze++; if (a && c) R.both++; if (!a && !c) R.none++;
    if (normTxt(String(x.pick || '')) === normTxt(String(z.pick || ''))) R.same++;
    R.list.push({ m: x.match, you: x.pick, ze: z.pick, a, c, t: Date.parse(x.settledAt || x.at) || 0 });
  });
  return R;
}
function stExtraHTML(full) {
  let h = '';
  // tu contra o Zé no mesmo jogo
  const H = stHeadToHead();
  h += `<h3>⚔️ Tu contra o Zé, no mesmo jogo</h3>`;
  if (!H.n) h += `<p class="muted" style="font-size:.8rem;">Ainda não há jogos em que os dois tenham apostado e que já estejam decididos. É a medida mais justa do duelo: mesmo jogo, cada um com a sua aposta.</p>`;
  else {
    h += `<table class="rx-t zp-t"><thead><tr><th>Jogos em comum</th><th class="num">Tu acertaste</th><th class="num">O Zé acertou</th><th class="num">Os dois</th><th class="num">Nenhum</th>${full ? '<th class="num">Mesma aposta</th>' : ''}</tr></thead><tbody><tr class="st-tot"><td><b>${H.n}</b></td><td class="num"><b>${H.you}</b> (${stPct(H.you, H.n)})</td><td class="num"><b>${H.ze}</b> (${stPct(H.ze, H.n)})</td><td class="num">${H.both}</td><td class="num">${H.none}</td>${full ? `<td class="num">${H.same}</td>` : ''}</tr></tbody></table>`;
    if (H.n < 20) h += `<p class="zp-note muted" style="font-size:.74rem;">Com ${H.n} jogo${H.n > 1 ? 's' : ''} ainda não dá para dizer quem é melhor — a partir de uns 30 começa a contar.</p>`;
    if (full) h += `<table class="zp-t"><thead><tr><th>Jogo</th><th>A tua aposta</th><th>A do Zé</th></tr></thead><tbody>${H.list.sort((a, c) => c.t - a.t).slice(0, 40).map(r => `<tr><td>${esc(r.m)}</td><td>${r.a ? '✓' : '✗'} ${esc(r.you)}</td><td>${r.c ? '✓' : '✗'} ${esc(r.ze)}</td></tr>`).join('')}</tbody></table>`;
  }
  // o Zé por tipo de aposta
  const F = {}, FM = {};
  Object.values(diaryLoad().items).forEach(x => {
    if (!x.res || !x.g || !x.pick || x.g.pick == null) return; let f = 'outras'; try { f = PICK_FAMILY(x.pick.k); } catch (e) {}
    const k = stMonthKey(x.kick); [F[f] = F[f] || { n: 0, hit: 0, exp: 0 }, (FM[k] = FM[k] || {})[f] = FM[k][f] || { n: 0, hit: 0, exp: 0 }].forEach(o => { o.n++; o.hit += x.g.pick ? 1 : 0; o.exp += x.pick.p || 0; });
  });
  if (Object.keys(F).length) {
    h += `<h3>🧩 O Zé por tipo de aposta</h3><table class="rx-t zp-t"><thead><tr>${full ? '<th>Mês</th>' : ''}<th>Tipo</th><th class="num">Jogos</th><th class="num">Certas</th><th class="num">Acerto</th><th class="num">Prometia</th><th>Sinal</th></tr></thead><tbody>`;
    const fr = (m, f, o, bold) => `<tr${bold ? ' class="st-tot"' : ''}>${full ? `<td>${m}</td>` : ''}<td>${bold ? '<b>' + esc(f) + '</b>' : esc(f)}</td><td class="num">${o.n}</td><td class="num">${o.hit}</td><td class="num">${stPct(o.hit, o.n)}</td><td class="num">${stPct(o.exp, o.n)}</td><td>${stSignal(o.hit, o.n, o.exp, full)}</td></tr>`;
    if (full) Object.keys(FM).sort().forEach(k => Object.entries(FM[k]).sort((a, c) => c[1].n - a[1].n).forEach(([f, o]) => { h += fr(stMonthName(k), f, o, false); }));
    Object.entries(F).sort((a, c) => c[1].n - a[1].n).forEach(([f, o]) => { h += fr('Época', f, o, true); });
    h += '</tbody></table>';
  }
  // contas por faixa de odd
  const accs = full ? [['you', '⭐ ' + holderName('you')], ['ze', '🤖 Mister Zé (duelo)'], ['auto', '🛫 Piloto']] : [['you', holderName('you')], ['ze', 'Zé'], ['auto', 'Piloto']];
  let any = false, hb = `<h3>🎚️ Por faixa de odd</h3><table class="rx-t zp-t"><thead><tr><th>Conta</th>${full ? '<th>Mês</th>' : ''}<th>Odd</th><th class="num">Apostas</th><th class="num">Acerto</th>${full ? '<th class="num">Precisava</th>' : ''}<th class="num">Resultado</th><th class="num">Por €</th></tr></thead><tbody>`;
  accs.forEach(([acc, name]) => {
    const keep = FIN.w; FIN.w = 'all'; let L = []; try { L = finBets(acc).filter(e => e.st === 'win' || e.st === 'loss'); } catch (e) {} FIN.w = keep;
    const B = {}, BM = {};
    L.forEach(e => { const bd = ST_BANDS.find(b => e.odd >= b[1] && e.odd < b[2]); if (!bd) return; const k = stMonthKey(e.td);
      [B[bd[0]] = B[bd[0]] || { n: 0, win: 0, stake: 0, pr: 0, need: 0 }, (BM[k] = BM[k] || {})[bd[0]] = BM[k][bd[0]] || { n: 0, win: 0, stake: 0, pr: 0, need: 0 }].forEach(o => { o.n++; o.win += e.st === 'win' ? 1 : 0; o.stake += e.stake; o.pr += finProfit(e); o.need += 1 / e.odd; }); });
    const br = (m, bn, o, bold) => { any = true; return `<tr${bold ? ' class="st-tot"' : ''}><td>${esc(name)}</td>${full ? `<td>${m}</td>` : ''}<td>${bn}</td><td class="num">${o.n}</td><td class="num">${stPct(o.win, o.n)}</td>${full ? `<td class="num">${stPct(o.need, o.n)}</td>` : ''}<td class="num ${o.pr >= 0 ? 'rx-pos pos' : 'rx-neg neg'}">${stSg(o.pr)}</td><td class="num ${o.pr >= 0 ? 'rx-pos pos' : 'rx-neg neg'}">${o.stake ? (o.pr >= 0 ? '+' : '−') + Math.abs(o.pr / o.stake * 100).toFixed(1) + '%' : '—'}</td></tr>`; };
    if (full) Object.keys(BM).sort().forEach(k => ST_BANDS.forEach(b => { if (BM[k][b[0]]) hb += br(stMonthName(k), b[0], BM[k][b[0]], false); }));
    ST_BANDS.forEach(b => { if (B[b[0]]) hb += br('Época', b[0], B[b[0]], true); });
  });
  if (any) h += hb + `</tbody></table><p class="zp-note muted" style="font-size:.74rem;">A auditoria de novembro deixou uma pista: o Zé perde mais nas odds mais altas. Este quadro mostra, mês a mês, se a pista se mantém.${full ? ' «Precisava» é o acerto necessário para não perder dinheiro a essas odds.' : ''}</p>`;
  // arquivo do robô
  h += `<h3>🗄️ Arquivo mensal do robô</h3><p class="muted" style="font-size:.8rem;">No início de cada mês o robô guarda na nuvem o fecho do mês anterior do piloto (por liga, com a odd de fecho). Fica gravado mesmo que limpes o telemóvel. <span id="stFechos">${stFechosHTML()}</span></p>`;
  return h;
}
let ST_FECHOS = null;
function stFechosHTML() { if (!ST_FECHOS) return 'Ainda sem meses fechados.'; const L = ST_FECHOS.meses || []; return L.length ? 'Meses fechados: ' + L.map(m => `<a href="${ROBO_BASE}fecho/${m}.csv" target="_blank" rel="noopener">${stMonthName(m)}</a>`).join(' · ') : 'Ainda sem meses fechados (o primeiro sai no dia 1 do próximo mês).'; }
async function stFechosLoad() { try { if (ST_FECHOS || typeof roboGet !== 'function' || !roboOn()) return; const j = await roboGet('fecho/indice.json'); if (j && j.meses) { ST_FECHOS = j; const e = document.getElementById('stFechos'); if (e) e.innerHTML = stFechosHTML(); } } catch (e) {} }
renderZeStats = (function (prev) { return function () { const r = prev.apply(this, arguments); try { stFechosLoad(); } catch (e) {} return r; }; })(renderZeStats);

/* ---------- 📒 Diário: jogos adiados ou remarcados saem logo da lista (não esperam 10 dias) ---------- */
function diaryMarkGhosts(all, scope) {
  // all = jogos normalizados acabados de ler; scope = {'code|AAAAMM': 1} dos meses lidos por inteiro (se o jogo não está lá, não se jogou nessa data)
  try {
    const D = diaryLoad(), now = Date.now(), byId = {}; let n = 0;
    (all || []).forEach(e => { byId[String(e.id)] = e; });
    Object.values(D.items).forEach(x => {
      if (x.res || x.lost) return; const t = Date.parse(x.kick) || 0; if (now - t < 4 * 3600e3) return;
      const e = byId[String(x.ev)];
      if (e) { if (/POSTPONED|CANCEL|SUSPENDED|ABANDON/i.test(e.status || '') || (e.status !== 'FINISHED' && Date.parse(e.utcDate) - t > 20 * 3600e3)) { x.lost = true; x.why = 'adiado'; n++; } return; }
      const d = new Date(t), k = (x.code || '') + '|' + d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0');
      if (scope && scope[k] && now - t > 1.5 * 864e5) { x.lost = true; x.why = 'sem jogo nessa data'; n++; }
    });
    if (n) diarySave(D);
    return n;
  } catch (e) { return 0; }
}
diaryCatchUp = async function (force) {
  if (/jsdom/i.test(navigator.userAgent || '') || window.__ZE_LAB || navigator.onLine === false) return 0;
  if (!force && Date.now() - DIARY_CATCH_AT < 20 * 60e3) return 0;
  if (typeof espnCooling === 'function' && espnCooling()) return 0;
  const now = Date.now(), want = {};
  Object.values(diaryLoad().items).forEach(x => {
    const t = Date.parse(x.kick) || 0; if (x.res || x.lost || !x.code || now - t < 1.5 * 864e5 || now - t > 45 * 864e5) return;
    const d = new Date(t); want[x.code + '|' + d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0')] = 1;
  });
  const keys = Object.keys(want).slice(0, 4); if (!keys.length) return 0;
  DIARY_CATCH_AT = Date.now();
  const all = [], read = {};
  for (const kk of keys) {
    const [code, ym] = kk.split('|');
    try {
      const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${ym}&limit=1000`);
      if (j && Array.isArray(j.events) && j.events.length) { read[kk] = 1; j.events.forEach(ev => { const n = normalizeEspn(ev, code, (typeof ESPN_LEAGUES !== 'undefined' && ESPN_LEAGUES[code]) || code); if (n) all.push(n); }); }
    } catch (e) {}
    if (typeof espnCooling === 'function' && espnCooling()) break;
  }
  const n = all.length ? diaryGrade({ matches: all }) : 0, g = diaryMarkGhosts(all, read);
  try { if ((n || g) && currentView === 'ze') renderDiary(); } catch (e) {}
  if (g) { try { toast(`🧹 ${g} jogo${g > 1 ? 's' : ''} adiado${g > 1 ? 's' : ''} saí${g > 1 ? 'ram' : 'u'} das opiniões à espera — não chega${g > 1 ? 'ram' : 'ou'} a jogar-se nessa data.`); } catch (e) {} }
  return n + g;
};
/* os resultados normais também trazem «adiado»: aproveita */
applyLive = (function (prev) { return function (payload) { const r = prev.apply(this, arguments); try { if (diaryMarkGhosts((payload && payload.matches) || [], null) && currentView === 'ze') renderDiary(); } catch (e) {} return r; }; })(applyLive);
renderDiary = (function (prev) { return function () { const r = prev.apply(this, arguments); try { if (diaryPendSplit().wait.some(x => Date.now() - Date.parse(x.kick) > 1.5 * 864e5)) diaryCatchUp().catch(() => {}); } catch (e) {} return r; }; })(renderDiary);

/* ================= Menu «Mais»: folha com ícones próprios ================= */
const ZI = (function () {
  const w = (d, extra) => `<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${extra || ''}</svg>`;
  const a = 'fill="var(--zi-a,#7c4dff)" fill-opacity=".45" stroke="none"';
  return {
    stats: w(`<rect x="5" y="17" width="5" height="10" rx="1.2" ${a}/><rect x="13.5" y="10" width="5" height="17" rx="1.2" ${a}/><rect x="22" y="5" width="5" height="22" rx="1.2" ${a}/><path d="M5 17h5v10H5zM13.5 10h5v17h-5zM22 5h5v22h-5z"/>`),
    jogos: w(`<rect x="5" y="7" width="22" height="20" rx="3" ${a}/><rect x="5" y="7" width="22" height="20" rx="3"/><path d="M5 13h22M11 4v6M21 4v6"/><circle cx="16" cy="20" r="3.2"/>`),
    scout: w(`<circle cx="14" cy="14" r="9" ${a}/><circle cx="14" cy="14" r="9"/><path d="M14 9v10M9 14h10M21 21l6 6"/>`),
    banca: w(`<ellipse cx="13" cy="10" rx="8" ry="3.6" ${a}/><ellipse cx="13" cy="10" rx="8" ry="3.6"/><path d="M5 10v5c0 2 3.6 3.6 8 3.6M5 15v5c0 2 3.6 3.6 8 3.6"/><circle cx="22" cy="21" r="6" ${a}/><circle cx="22" cy="21" r="6"/><path d="M22 18.2v5.6M20.3 19.6h2.6a1.2 1.2 0 010 2.4h-1.8"/>`),
    boletim: w(`<path d="M8 4h16v24l-3-2-2.5 2-2.5-2-2.5 2-2.5-2-3 2z" ${a}/><path d="M8 4h16v24l-3-2-2.5 2-2.5-2-2.5 2-2.5-2-3 2z"/><path d="M12 10h8M12 15h8M12 20l2 2 4-4.5"/>`),
    refresh: w(`<circle cx="16" cy="16" r="10" ${a}/><path d="M26 16a10 10 0 01-17.6 6.5M6 16A10 10 0 0123.6 9.5"/><path d="M24 4v6h-6M8 28v-6h6"/>`),
    search: w(`<circle cx="14" cy="14" r="8.5" ${a}/><circle cx="14" cy="14" r="8.5"/><path d="M20.5 20.5L27 27"/>`),
    config: w(`<path d="M6 9h20M6 16h20M6 23h20"/><circle cx="12" cy="9" r="3.2" fill="#160d27"/><circle cx="21" cy="16" r="3.2" fill="#160d27"/><circle cx="10" cy="23" r="3.2" fill="#160d27"/><circle cx="12" cy="9" r="3.2" ${a}/><circle cx="21" cy="16" r="3.2" ${a}/><circle cx="10" cy="23" r="3.2" ${a}/>`),
    install: w(`<rect x="9" y="3" width="14" height="26" rx="3" ${a}/><rect x="9" y="3" width="14" height="26" rx="3"/><path d="M16 9v9M12.5 14.5L16 18l3.5-3.5M13 23h6"/>`),
    close: w(`<path d="M9 9l14 14M23 9L9 23"/>`)
  };
})();
function mMoreDress() {
  try {
    const more = document.getElementById('mMore'), sheet = more && more.querySelector('.sheet'), grid = more && more.querySelector('.grid'); if (!grid) return;
    if (!sheet.querySelector('.mm-head')) sheet.insertAdjacentHTML('afterbegin', `<div class="mm-grab"></div><div class="mm-head"><b>Menu</b><span>${typeof APP_VER !== 'undefined' ? 'Mister Zé · ' + APP_VER : ''}</span></div>`);
    grid.querySelectorAll('button').forEach(b => {
      const k = b.hasAttribute('data-zst') ? 'stats' : (b.dataset.g || b.dataset.a), i = b.querySelector('.i');
      if (i && ZI[k] && !i.dataset.zi) { i.innerHTML = ZI[k]; i.dataset.zi = '1'; b.classList.add('mm-' + k); }
    });
  } catch (e) {}
}
(function () {
  const css = document.createElement('style');
  css.textContent = `@media (max-width: 900px){
    #mMore.open{background:rgba(6,3,14,.72)!important;animation:mmFade .16s ease-out}
    #mMore .sheet{background:linear-gradient(180deg,#24154a 0%,#150c2b 60%,#0f0820 100%)!important;border-radius:22px 22px 0 0!important;border-top:2px solid rgba(200,245,60,.55)!important;box-shadow:0 -14px 40px rgba(0,0,0,.6);padding:8px 14px calc(18px + env(safe-area-inset-bottom))!important;animation:mmUp .22s cubic-bezier(.2,.9,.3,1)}
    #mMore .mm-grab{width:44px;height:5px;border-radius:3px;background:rgba(255,255,255,.22);margin:2px auto 10px}
    #mMore .mm-head{display:flex;justify-content:space-between;align-items:baseline;margin:0 2px 12px}
    #mMore .mm-head b{font:800 1.5rem/1 var(--cond);letter-spacing:.06em;text-transform:uppercase;color:#fff}
    #mMore .mm-head span{font:600 .72rem var(--cond);letter-spacing:.08em;text-transform:uppercase;color:#a99ec4}
    #mMore .grid{gap:10px!important}
    #mMore .grid button{--zi-a:#7c4dff;position:relative;overflow:hidden;background:linear-gradient(180deg,#33235c 0%,#1d1238 100%)!important;border:1px solid #4b3a74!important;border-bottom:3px solid #120a24!important;border-radius:16px!important;padding:14px 4px 11px!important;gap:8px!important;font:800 .8rem var(--cond)!important;letter-spacing:.06em;text-transform:uppercase;color:#f2eefb!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 4px 10px rgba(0,0,0,.35);cursor:pointer;transition:transform .08s}
    #mMore .grid button:active{transform:translateY(2px) scale(.98)}
    #mMore .grid button::before{content:"";position:absolute;inset:0 0 55% 0;background:linear-gradient(180deg,rgba(255,255,255,.07),transparent);pointer-events:none}
    #mMore .grid button .i{width:52px;height:52px;border-radius:15px;display:grid;place-items:center;color:#c8f53c;background:radial-gradient(circle at 35% 25%,#3d2a70,#170e2e 75%);border:1px solid rgba(200,245,60,.28);box-shadow:0 0 0 3px rgba(124,77,255,.10),inset 0 -6px 10px rgba(0,0,0,.35);font-size:1.4rem}
    #mMore .grid button.mm-banca .i,#mMore .grid button.mm-boletim .i{color:#ffd166;border-color:rgba(255,209,102,.3)} #mMore .grid button.mm-banca,#mMore .grid button.mm-boletim{--zi-a:#ff9f1c}
    #mMore .grid button.mm-refresh .i,#mMore .grid button.mm-search .i{color:#7fb2ff;border-color:rgba(127,178,255,.3)} #mMore .grid button.mm-refresh,#mMore .grid button.mm-search{--zi-a:#2f7bff}
    #mMore .grid button.mm-config .i,#mMore .grid button.mm-install .i{color:#d7c8ff;border-color:rgba(215,200,255,.28)}
    #mMore .grid button.mm-close{background:transparent!important;border:1px dashed #4b3a74!important;box-shadow:none;color:#a99ec4!important}
    #mMore .grid button.mm-close .i{background:transparent;border-color:transparent;box-shadow:none;color:#a99ec4}
    #mMore .grid button.mm-close::before{display:none}
    @keyframes mmUp{from{transform:translateY(40px);opacity:.4}to{transform:none;opacity:1}} @keyframes mmFade{from{opacity:0}to{opacity:1}}
    @media (prefers-reduced-motion: reduce){#mMore.open,#mMore .sheet{animation:none}}
  }`;
  document.head.appendChild(css);
  mMoreDress(); document.addEventListener('DOMContentLoaded', mMoreDress); setTimeout(mMoreDress, 800); setTimeout(mMoreDress, 3000);
})();

/* ================= v69 · Boletins de seleções: nomes em português, lixo das bandeiras e jogos encontrados ================= */
/* nome da ESPN (inglês) → como aparece nas casas portuguesas */
const ZE_PAISES = { england: 'inglaterra', croatia: 'croacia', turkiye: 'turquia', turkey: 'turquia', belgium: 'belgica', czechia: 'chequia republica checa', spain: 'espanha', latvia: 'letonia', armenia: 'armenia', cyprus: 'chipre', 'san marino': 'sao marino', belarus: 'bielorrussia', france: 'franca', italy: 'italia', germany: 'alemanha', netherlands: 'paises baixos holanda', portugal: 'portugal', scotland: 'escocia', wales: 'pais de gales gales', 'northern ireland': 'irlanda do norte', 'republic of ireland': 'republica da irlanda irlanda', ireland: 'irlanda', switzerland: 'suica', austria: 'austria', denmark: 'dinamarca', sweden: 'suecia', norway: 'noruega', finland: 'finlandia', iceland: 'islandia', poland: 'polonia', ukraine: 'ucrania', hungary: 'hungria', romania: 'romenia', bulgaria: 'bulgaria', greece: 'grecia', serbia: 'servia', slovenia: 'eslovenia', slovakia: 'eslovaquia', albania: 'albania', kosovo: 'kosovo', 'north macedonia': 'macedonia do norte', 'bosnia-herzegovina': 'bosnia herzegovina', 'bosnia and herzegovina': 'bosnia herzegovina', georgia: 'georgia', azerbaijan: 'azerbaijao', kazakhstan: 'cazaquistao', moldova: 'moldavia', lithuania: 'lituania', estonia: 'estonia', luxembourg: 'luxemburgo', malta: 'malta', andorra: 'andorra', gibraltar: 'gibraltar', liechtenstein: 'liechtenstein', 'faroe islands': 'ilhas faroe faroe', israel: 'israel', montenegro: 'montenegro', russia: 'russia', brazil: 'brasil', argentina: 'argentina', uruguay: 'uruguai', colombia: 'colombia', mexico: 'mexico', 'united states': 'estados unidos eua', usa: 'estados unidos eua', canada: 'canada', japan: 'japao', 'south korea': 'coreia do sul', morocco: 'marrocos', senegal: 'senegal', nigeria: 'nigeria', egypt: 'egito', algeria: 'argelia', tunisia: 'tunisia', ghana: 'gana', cameroon: 'camaroes', 'ivory coast': 'costa do marfim', australia: 'australia', 'saudi arabia': 'arabia saudita', iran: 'irao', qatar: 'catar', ecuador: 'equador', chile: 'chile', peru: 'peru', paraguay: 'paraguai', 'cape verde': 'cabo verde', angola: 'angola', mozambique: 'mocambique', 'south africa': 'africa do sul' };
try { Object.keys(ZE_PAISES).forEach(en => { const pt = ZE_PAISES[en]; if (!TEAM_ALIAS[en]) TEAM_ALIAS[en] = en + ' ' + pt; pt.split(' ').filter(w => w.length > 4 && !/^(republica|paises|ilhas|costa|estados|unidos|norte|arabia|africa|coreia|irlanda|baixos)$/.test(w)).forEach(w => { if (!TEAM_ALIAS[w] && w !== en) TEAM_ALIAS[w] = w + ' ' + en; }); }); } catch (e) {}
const ZE_PAIS_PT = (function () { const L = []; Object.keys(ZE_PAISES).forEach(en => { const all = ZE_PAISES[en].split(' '); [ZE_PAISES[en]].concat(en === 'czechia' ? ['chequia', 'republica checa'] : en === 'netherlands' ? ['paises baixos', 'holanda'] : en === 'wales' ? ['pais de gales', 'gales'] : en === 'republic of ireland' ? ['republica da irlanda'] : en === 'faroe islands' ? ['ilhas faroe'] : en === 'united states' || en === 'usa' ? ['estados unidos', 'eua'] : []).forEach(n => { if (!L.includes(n)) L.push(n); }); }); return L.filter(n => !/ /.test(n) || /^(sao marino|irlanda do norte|macedonia do norte|bosnia herzegovina|republica checa|paises baixos|pais de gales|republica da irlanda|ilhas faroe|estados unidos|coreia do sul|costa do marfim|arabia saudita|cabo verde|africa do sul)$/.test(n)).sort((a, b) => b.length - a.length); })();
/* equipas conhecidas neste momento (calendário + resultados) + seleções em português */
function zeKnownTeams() {
  const S = new Set(ZE_PAIS_PT);
  try { matches.forEach(m => { [m.home, m.away].forEach(n => { n = normTxt(n || '').replace(/\./g, ''); if (n.length >= 4) S.add(n); }); }); } catch (e) {}
  try { ((lsGet(LIVE_KEY, null) || {}).matches || []).forEach(x => { [x.homeTeam, x.awayTeam].forEach(t => { [t && t.shortName, t && t.name].forEach(n => { n = normTxt(n || '').replace(/\./g, ''); if (n.length >= 4) S.add(n); }); }); }); } catch (e) {}
  return [...S].sort((a, b) => b.length - a.length);
}
function zeSnapTeam(raw, known) {
  const n = ' ' + normTxt(String(raw || '')).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  const hit = (known || zeKnownTeams()).find(k => n.includes(' ' + k + ' '));
  if (hit) { const words = hit.split(' ').length, src = String(raw).replace(DATE_RE, '').trim().split(/\s+/); for (let i = 0; i + words <= src.length; i++) { const cand = src.slice(i, i + words).join(' '); if (normTxt(cand).replace(/[^a-z0-9 ]/g, ' ').trim() === hit) return cand.replace(/^./, c => c.toUpperCase()); } return hit.replace(/(^| )./g, c => c.toUpperCase()); }
  // desconhecida: tira o lixo que as bandeiras deixam antes do nome («em», «ec», «mia», «x",»)
  const t = String(raw || '').trim().split(/\s+/); while (t.length > 1 && (!/^[A-ZÀ-Ý]/.test(t[0]) || t[0].replace(/[^A-Za-zÀ-ÿ]/g, '').length <= 2)) t.shift();
  while (t.length > 1 && !/^[A-Za-zÀ-ÿ.'-]{2,}$/.test(t[t.length - 1])) t.pop();
  return t.join(' ');
}
const zeTeamOk = s => (normTxt(String(s || '')).match(/[a-z]{4,}/g) || []).length > 0;
parseSlip = (function (prev) {
  return function (text) {
    const out = prev.apply(this, arguments);
    try {
      const known = zeKnownTeams();
      out.legs.forEach(l => {
        if (l.sport === 'nba') return;
        ['home', 'away'].forEach(k => { if (l[k]) { const v = zeSnapTeam(l[k], known); l[k] = zeTeamOk(v) ? v : ''; } });
        if (l.home && l.away && normTxt(l.home) === normTxt(l.away)) l.away = '';
      });
      // a mesma seleção lida duas vezes (o ponto de «2.5» perde-se: «25 golos»)
      out.legs = out.legs.filter((l, i) => !(/\b(\d)(5) golos\b/.test(normTxt(l.sel)) && out.legs.some((o, j) => j !== i && normTxt(o.sel).replace(/[^a-z0-9]/g, '') === normTxt(l.sel).replace(/\b(\d)(5) golos\b/, '$1.$2 golos').replace(/[^a-z0-9]/g, ''))));
      out.legs.forEach(l => {
        let t = String(l.sel || '').replace(/\bMaisde\b/i, 'Mais de').trim().split(/\s+/);
        while (t.length > 1 && !/^[A-ZÀ-Ý0-9][A-Za-zÀ-ÿ0-9.'-]*$/.test(t[0]) && !/^(mais|menos|ambas|empate|sim|n[aã]o|x|1x|x2|12|over|under)$/i.test(t[0])) t.shift();
        l.sel = t.join(' ').replace(/\b(Mais|Menos)\s+(?:de\s+)?(\d)[.,]?5(?:\s+golos)?(?![\d.,])/gi, '$1 de $2.5 golos');
      });
    } catch (e) { console.warn(e); }
    return out;
  };
})(parseSlip);
/* a seleção em português («Bélgica ou Empate») tem de ser entendida contra o nome da ESPN («Belgium») */
selConds = (function (prev) { return function (selRaw, m) { let s = String(selRaw || '').replace(/\b(mais|menos)\s+(?:de\s+)?(\d)[.,]?5(?![\d.,])/gi, '$1 de $2.5'); try { const x = expandAliases(normTxt(s).replace(/\./g, (c, i, str) => /\d\.\d/.test(str.slice(i - 1, i + 2)) ? '.' : ' ')); const extra = x.slice(normTxt(s).length); if (extra.trim()) s += ' ' + extra; } catch (e) {} return prev.call(this, s, m); }; })(selConds);
/* encontrar o jogo mesmo quando o print só deixou ler uma das equipas (ou as trocou) */
evMatchesLeg = (function (prev) {
  return function (e, l) {
    try { if (prev.apply(this, arguments)) return true; } catch (er) {}
    try {
      const hx = expandAliases(normTxt(e.homeTeam.name + ' ' + e.homeTeam.shortName)), ax = expandAliases(normTxt(e.awayTeam.name + ' ' + e.awayTeam.shortName));
      const sc = n => zeTeamOk(n) ? [teamScore(n, hx) > 0, teamScore(n, ax) > 0] : null;
      const H = sc(l.home), A = sc(l.away);
      if (H && A) return (H[1] && A[0]);                                   // as duas lidas mas trocadas
      const one = H || A; if (one) return one[0] || one[1];                 // só uma lida: basta que jogue neste jogo
      const known = ZE_PAIS_PT.concat([]), s = ' ' + normTxt(l.sel || '') + ' ';   // nenhuma lida: a seleção diz a equipa («Bélgica ou Empate»)
      const t = known.find(k => s.includes(' ' + k + ' ')); if (t) { const r = [teamScore(t, hx) > 0, teamScore(t, ax) > 0]; return r[0] || r[1]; }
    } catch (er) {}
    return false;
  };
})(evMatchesLeg);

renderWallet = (function (prev) { return function () { const r = prev.apply(this, arguments); try { stuckBox(); } catch (e) {} return r; }; })(renderWallet);

/* ---------- ícones próprios também nos mosaicos do início e na barra de baixo ---------- */
(function () {
  const w = d => `<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const a = 'fill="var(--zi-a,#7c4dff)" fill-opacity=".45" stroke="none"';
  Object.assign(ZI, {
    duelo: w(`<path d="M6 5l13 13-3 3L4 9z" ${a}/><path d="M26 5L13 18l3 3L28 9z" ${a}/><path d="M5 5h4l12 12-3 3L5 9zM27 5h-4L11 17l3 3L27 9z"/><path d="M8 20l-3 3 4 4 3-3M24 20l3 3-4 4-3-3M9 23l2-2M23 23l-2-2"/>`),
    raiox: w(`<rect x="6" y="4" width="20" height="24" rx="3" ${a}/><rect x="6" y="4" width="20" height="24" rx="3"/><path d="M16 8v16M11 11.5c2 1.3 8 1.3 10 0M10.5 15.5c2.2 1.5 8.8 1.5 11 0M11.5 19.5c2 1.2 7 1.2 9 0"/>`),
    ze: w(`<rect x="6" y="11" width="20" height="15" rx="4" ${a}/><rect x="6" y="11" width="20" height="15" rx="4"/><path d="M16 11V6M3 17v4M29 17v4M12 22h8"/><circle cx="16" cy="5" r="1.6"/><circle cx="12" cy="17" r="1.7"/><circle cx="20" cy="17" r="1.7"/>`),
    portal: w(`<path d="M5 15L16 5l11 10v11a1.5 1.5 0 01-1.5 1.5H6.5A1.5 1.5 0 015 26z" ${a}/><path d="M3.5 16L16 5l12.5 11M6.5 13.5V27h19V13.5M13 27v-8h6v8"/>`),
    dia: w(`<circle cx="16" cy="16" r="11" ${a}/><circle cx="16" cy="16" r="11"/><path d="M16 11l4.6 3.3-1.8 5.4h-5.6l-1.8-5.4zM16 5v6M20.6 14.3l5.6-2M18.8 19.7l3.6 4.8M13.2 19.7l-3.6 4.8M11.4 14.3l-5.6-2"/>`),
    mais: w(`<rect x="5" y="5" width="9" height="9" rx="2.5" ${a}/><rect x="18" y="18" width="9" height="9" rx="2.5" ${a}/><rect x="5" y="5" width="9" height="9" rx="2.5"/><rect x="18" y="5" width="9" height="9" rx="2.5"/><rect x="5" y="18" width="9" height="9" rx="2.5"/><rect x="18" y="18" width="9" height="9" rx="2.5"/>`)
  });
  ZI.jogos_tile = w(`<path d="M10 5h12v7a6 6 0 01-12 0z" ${a}/><path d="M10 5h12v7a6 6 0 01-12 0zM10 7H5.5c0 4 2 6 4.8 6.4M22 7h4.5c0 4-2 6-4.8 6.4M16 18v5M11 27h10M12.5 23h7"/>`);
  const css = document.createElement('style');
  css.textContent = `.rv-tile .rvic.zi{filter:none!important;top:12%!important;display:grid;place-items:center;font-size:0!important}
    .rv-tile .rvic.zi svg{width:50px;height:50px;color:#c8f53c;padding:9px;box-sizing:content-box;border-radius:20px;background:radial-gradient(circle at 35% 25%,rgba(124,77,255,.55),rgba(18,10,36,.85) 75%);border:1px solid rgba(200,245,60,.3);box-shadow:0 8px 14px rgba(0,0,0,.5),inset 0 -6px 10px rgba(0,0,0,.35)}
    .rv-tile .rvic.zi-banca svg,.rv-tile .rvic.zi-boletim svg{color:#ffd166;border-color:rgba(255,209,102,.32);--zi-a:#ff9f1c}
    .rv-tile .rvic.zi-refresh svg,.rv-tile .rvic.zi-scout svg{color:#7fb2ff;border-color:rgba(127,178,255,.32);--zi-a:#2f7bff}
    .rv-tile .rvic.zi-duelo svg{color:#ff7a8f;border-color:rgba(255,122,143,.32);--zi-a:#ff4d6a}
    .rv-tile .rvic.zi-raiox svg,.rv-tile .rvic.zi-ze svg{color:#d7c8ff;border-color:rgba(215,200,255,.3)}
    @media (max-width:420px){.rv-tile .rvic.zi svg{width:38px;height:38px;padding:8px;border-radius:16px}}
    body.rv #mNav button .i.zi{font-size:0;display:grid;place-items:center;height:30px}
    body.rv #mNav button .i.zi svg{width:27px;height:27px;color:#a99ec4;transition:color .15s,transform .15s}
    body.rv #mNav button.on .i.zi svg{color:#c8f53c;transform:translateY(-1px) scale(1.08);filter:drop-shadow(0 0 6px rgba(200,245,60,.45))}`;
  document.head.appendChild(css);
  const nav = () => { try { document.querySelectorAll('#mNav button').forEach(b => { const k = b.dataset.m, i = b.querySelector('.i'); if (i && ZI[k] && !i.classList.contains('zi')) { i.innerHTML = ZI[k]; i.classList.add('zi'); } }); } catch (e) {} };
  nav(); document.addEventListener('DOMContentLoaded', nav); setTimeout(nav, 800); setTimeout(nav, 3000);
})();

/* ---------- 🔔 Desde a última visita: o que se decidiu nas três contas (aviso dentro da app; some ao abrir as Finanças) ---------- */
const FIN_SEEN_KEY = 'ze_fin_seen_v1';
function finNews() {
  let seen = lsGet(FIN_SEEN_KEY, 0) || 0;
  if (!seen) { lsSet(FIN_SEEN_KEY, Date.now()); return null; }
  const keep = FIN.w; FIN.w = 'all'; const out = [];
  try {
    [['you', holderName('you')], ['ze', 'Zé'], ['auto', 'Piloto']].forEach(([acc, name]) => {
      const L = finBets(acc).filter(e => (e.st === 'win' || e.st === 'loss') && e.td > seen && e.td <= Date.now()); if (!L.length) return;
      out.push({ acc, name, w: L.filter(e => e.st === 'win').length, l: L.filter(e => e.st === 'loss').length, pr: r2(L.reduce((s, e) => s + finProfit(e), 0)) });
    });
  } catch (e) {} finally { FIN.w = keep; }
  return out.length ? out : null;
}
function finNewsSeen() { try { lsSet(FIN_SEEN_KEY, Date.now()); } catch (e) {} }
finHomeStrip = (function (prev) {
  return function () {
    let h = ''; try {
      const N = finNews();
      if (N) h = `<div class="fin-home fin-news" aria-label="Resultados desde a última visita"><div class="fh-h"><span>🔔 Desde a última visita</span><small>${N.reduce((s, a) => s + a.w + a.l, 0)} decidida${N.reduce((s, a) => s + a.w + a.l, 0) > 1 ? 's' : ''}</small></div>
        <div class="fh-accs">${N.map(a => `<button type="button" class="fh-a ${a.acc}" onclick="finOpenAcc('${a.acc}','decididas')"><span class="fh-n num" style="font-size:1.05rem;color:${a.pr >= 0 ? 'var(--green,#2fd27a)' : 'var(--red-light,#ff7a8f)'}">${a.pr >= 0 ? '▲' : '▼'}</span><span class="fh-who">${esc(a.name)}</span><span class="fh-v">${a.w}✓ ${a.l}✗ · ${a.pr >= 0 ? '+' : '−'}${eur(Math.abs(a.pr))}</span></button>`).join('')}</div></div>`;
    } catch (e) {}
    return h + prev.apply(this, arguments);
  };
})(finHomeStrip);
fmGo = (function (prev) { return function (view) { const r = prev.apply(this, arguments); try { if (view === 'banca') finNewsSeen(); } catch (e) {} return r; }; })(fmGo);

/* ================= v70 · Mercados que estavam a ser corrigidos pelo resultado errado ================= */
/* o tipo de mercado (1ª parte, cantos, golos de uma equipa, empate anula…) passa a contar na correção, não só o texto da seleção */
function zeLegFull(l) {
  try {
    if (!l || !l.market || l._full) return l;
    const mk = normTxt(l.market), sel = String(l.sel || ''), ns = normTxt(sel); let add = '';
    if (/\b1.{0,3}parte|primeira parte|1st half|first half/.test(mk) && !/parte|half/.test(ns)) add = ' (primeira parte)';
    else if (/\b2.{0,3}parte|segunda parte|2nd half/.test(mk) && !/parte|half/.test(ns)) add = ' (segunda parte)';
    else if (/intervalo|half ?time/.test(mk) && !/intervalo/.test(ns)) add = ' (ao intervalo)';
    else if (/canto|corner/.test(mk) && !/canto/.test(ns)) add = ' (cantos)';
    else if (/cartao|cartoes|card/.test(mk) && !/cart/.test(ns)) add = ' (cartões)';
    else if (/impar|par\b|odd\/even/.test(mk) && /impar|\bpar\b/.test(ns)) add = ' (ímpar/par — minuto)';   // «minuto» faz o validador deixá-la para ti
    else if (/golos da equipa|team total|total da equipa/.test(mk) && !/da equipa/.test(ns)) add = ' golos da equipa ' + String(l.market).replace(/^.*?(equipa|team total)\s*[-–:]?\s*/i, '');
    else if (/empate anula|draw no bet/.test(mk)) return /anula|draw no bet/.test(ns) ? l : Object.assign({}, l, { sel: 'Empate anula aposta: ' + sel, market: '', _full: 1 });   // a app já devolve no empate, mas só olhava para o texto da seleção
    else if (/handicap/.test(mk) && !/handicap/.test(ns)) add = ' (handicap)';
    else if (/resultado corre|resultado exato|correct score/.test(mk) && !/resultado/.test(ns)) add = ' (resultado correto)';
    return add ? Object.assign({}, l, { sel: sel + add, _full: 1 }) : l;
  } catch (e) { return l; }
}
selConds = (function (prev) {
  return function (selRaw, m) {
    const raw = String(selRaw || ''), s = normTxt(raw);
    try {
      const hs = n => teamScore(n, expandAliases(s)) > 0;
      // resultado correto: «2-1»
      let x = raw.match(/^\s*(\d{1,2})\s*[-:–]\s*(\d{1,2})\s*(\(resultado correto\))?\s*$/i); if (x) return [(i, j) => i === +x[1] && j === +x[2]];
      // golos de uma só equipa
      if (/golos da equipa/.test(s)) {
        const ou = s.match(/(mais|menos)\s+(?:de\s+)?(\d+)[.,]5/); const tail = s.slice(s.indexOf('golos da equipa') + 15), th = teamScore(m.home, expandAliases(tail)) > 0, ta = teamScore(m.away, expandAliases(tail)) > 0;
        if (!ou || th === ta) return null; const L = +ou[2] + .5, over = ou[1] === 'mais';
        return [th ? ((i, j) => over ? i > L : i < L) : ((i, j) => over ? j > L : j < L)];
      }
      // handicap: só as linhas ,5 se decidem pelo resultado; as outras podem devolver dinheiro
      if (/handicap/.test(s) && (!/[+-]\s?\d+[.,]5\b/.test(s) || /[.,](25|75)\b/.test(s))) return null;
      // hipótese dupla «casa ou fora»
      if (/ ou /.test(s) && !/empate|draw/.test(s) && hs(m.home) && hs(m.away) && !/mais|menos|ambas/.test(s)) return [(i, j) => i !== j];
    } catch (e) {}
    return prev.call(this, raw.replace(/\s*\((handicap|resultado correto)\)/gi, ''), m);
  };
})(selConds);
resolveLeg = (function (prev) {
  return function (l, fin, at) {
    const L = zeLegFull(l), r = prev.call(this, L, fin, at);
    return r;
  };
})(resolveLeg);
legDiag = (function (prev) {
  return function (l, bet, pool) {
    const a = [].slice.call(arguments); let L = zeLegFull(l);
    try {
      // seleção gravada sem equipas («Bélgica ou Empate»): o nome está na própria seleção — procura o jogo por aí
      if (L && !L.home && !L.away && L.sel) {
        const atT = new Date((bet && bet.at) || Date.now()).getTime();
        const evs = (pool || []).filter(x => evMatchesLeg(x, L)).map(x => ({ x, t: new Date(x.utcDate).getTime() }));
        const ev = ((evs.filter(c => c.t >= atT - 12 * 3600e3).sort((p, q) => p.t - q.t)[0]) || (evs.filter(c => c.t >= atT - 6 * 864e5).sort((p, q) => q.t - p.t)[0]) || {}).x;
        if (ev) L = Object.assign({}, L, { home: ev.homeTeam.shortName || ev.homeTeam.name, away: ev.awayTeam.shortName || ev.awayTeam.name });
      }
    } catch (e) {}
    a[0] = L; return prev.apply(this, a);
  };
})(legDiag);
legEval = (function (prev) { return function (leg) { return prev.call(this, zeLegFull(leg)); }; })(legEval);
/* «golos» só se acrescenta quando o mercado é mesmo de golos (cantos e cartões também têm «Mais de 9.5») */
parseSlip = (function (prev) {
  return function () {
    const out = prev.apply(this, arguments);
    try { out.legs.forEach(l => { const mk = normTxt(l.market || ''); if (/ golos$/.test(l.sel || '') && mk && !/golos|mais\/menos/.test(mk)) l.sel = l.sel.replace(/ golos$/, ''); if (/canto|corner|cartao|cartoes/.test(mk) && / golos/.test(l.sel)) l.sel = l.sel.replace(/ golos/, ''); }); } catch (e) {}
    return out;
  };
})(parseSlip);

/* ================= v71 · Segunda fonte de odds: a Betano contra o preço justo (Pinnacle) ================= */
/* quinta estratégia do piloto — só existe na nuvem (é o robô que tem a chave da segunda fonte); no telemóvel nunca aposta */
AUTO_W.justo = { key: 'ze_auto_justo_v1', name: '💎 Preço justo', desc: 'só quando a Betano paga 3% ou mais acima do preço justo da Pinnacle', perDay: 6, ok: () => false };
let ZE_VALOR = null, ZE_VALOR_AT = 0;
async function zeValorLoad(force) {
  try {
    if (typeof roboGet !== 'function' || !roboOn()) return null;
    if (!force && ZE_VALOR && Date.now() - ZE_VALOR_AT < 10 * 60e3) return ZE_VALOR;
    const j = await roboGet('valor.json'); if (j && Array.isArray(j.jogos)) { ZE_VALOR = j; ZE_VALOR_AT = Date.now(); const e = document.getElementById('valorBody'); if (e) e.innerHTML = zeValorBody(); }
  } catch (e) {}
  return ZE_VALOR;
}
function zeValorBody() {
  const V = ZE_VALOR;
  if (!V) return `<p class="muted" style="font-size:.84rem;">A carregar as medições do robô… Se não aparecer nada, liga o robô na nuvem em Definições.</p>`;
  const J = V.jogos.filter(j => j.valor), ks = ['1', 'X', '2'], pc = x => (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(1).replace('.', ',') + '%';
  if (!J.length) return `<p class="muted" style="font-size:.84rem;">Ainda sem jogos medidos. O robô mede até 6 por dia, nas 4 horas antes de cada jogo.</p>`;
  const all = []; J.forEach(j => j.valor.forEach((v, i) => all.push({ j, i, v, o: j.bet[i], p: j.justo[i], hit: j.saiu ? (j.saiu === ks[i] ? 1 : 0) : null })));
  const grp = (lab, f) => { const L = all.filter(f), D = L.filter(x => x.hit != null); const pr = D.reduce((s, x) => s + (x.hit ? x.o - 1 : -1), 0); return `<tr><td>${lab}</td><td class="num">${L.length}</td><td class="num">${D.length}</td><td class="num">${D.length ? stPct(D.reduce((s, x) => s + x.hit, 0), D.length) : '—'}</td><td class="num">${D.length ? stPct(D.reduce((s, x) => s + x.p, 0), D.length) : '—'}</td><td class="num ${pr >= 0 ? 'rx-pos pos' : 'rx-neg neg'}">${D.length ? pc(pr / D.length) : '—'}</td></tr>`; };
  const mB = J.reduce((s, j) => s + j.margemBet, 0) / J.length, mP = J.reduce((s, j) => s + j.margemPin, 0) / J.length;
  const best = j => { let b = 0; j.valor.forEach((v, i) => { if (v > j.valor[b]) b = i; }); return b; };
  const lab = (j, i) => i === 0 ? esc(j.h) : i === 1 ? 'Empate' : esc(j.a);
  const C = V.carteira, dec = C ? C.bets.filter(b => b.st === 'win' || b.st === 'loss') : [];
  return `<div class="zst" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:10px;">
      <div class="kv"><span>Jogos medidos</span><b>${J.length}</b></div>
      <div class="kv"><span>Margem da Betano</span><b>${(mB * 100).toFixed(1).replace('.', ',')}%</b></div>
      <div class="kv"><span>Margem da Pinnacle</span><b>${(mP * 100).toFixed(1).replace('.', ',')}%</b></div>
      <div class="kv"><span>Vezes com 3% ou mais</span><b>${all.filter(x => x.v >= .03).length} em ${all.length}</b></div>
      ${C ? `<div class="kv"><span>Carteira 💎 (250 €)</span><b>${eur(r2(C.bank + C.bets.filter(b => b.st === 'open').reduce((s, b) => s + b.stake, 0)))}</b></div><div class="kv"><span>Apostas dela</span><b>${C.bets.length}${dec.length ? ` · ${dec.filter(b => b.st === 'win').length}/${dec.length} certas` : ''}</b></div>` : ''}
    </div>
    <table class="rx-t zp-t"><thead><tr><th>Betano contra o preço justo</th><th class="num">Casos</th><th class="num">Decididos</th><th class="num">Saiu</th><th class="num">Era esperado</th><th class="num">Por €</th></tr></thead><tbody>
      ${grp('Paga 3% ou mais acima', x => x.v >= .03)}${grp('Entre 0 e 3% acima', x => x.v >= 0 && x.v < .03)}${grp('Até 5% abaixo', x => x.v < 0 && x.v >= -.05)}${grp('Mais de 5% abaixo', x => x.v < -.05)}
    </tbody></table>
    <p class="muted" style="font-size:.74rem;">«Preço justo» é a odd da Pinnacle sem a margem. Se a régua for boa, a linha de cima deve acabar com «Por €» positivo e as de baixo negativo. Com poucos casos decididos não dá para concluir nada.</p>
    <h3 style="font-size:.86rem;margin:12px 0 6px;">Últimos jogos medidos</h3>
    <table class="rx-t zp-t"><thead><tr><th>Jogo</th><th>Melhor caso</th><th class="num">Betano</th><th class="num">Justo</th><th class="num">Vantagem</th><th>Saiu</th></tr></thead><tbody>
      ${J.slice(-12).reverse().map(j => { const b = best(j); return `<tr><td>${esc(j.h)} – ${esc(j.a)}${j.apostou ? ' 💎' : ''}</td><td>${lab(j, b)}</td><td class="num">${j.bet[b].toFixed(2).replace('.', ',')}</td><td class="num">${(1 / j.justo[b]).toFixed(2).replace('.', ',')}</td><td class="num ${j.valor[b] >= 0 ? 'rx-pos pos' : 'rx-neg neg'}">${pc(j.valor[b])}</td><td>${j.res ? esc(j.res) + (j.saiu === ks[b] ? ' ✓' : ' ✗') : '⏳'}</td></tr>`; }).join('')}
    </tbody></table>
    <p class="muted" style="font-size:.74rem;">💎 = a carteira «Preço justo» do piloto apostou neste jogo (1% da banca, só com 3% ou mais de vantagem e odd entre 1,25 e 4,00). Última medição: ${V.at ? new Date(V.at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}.</p>`;
}
function zeValorPanelHTML() { return `<div class="panel" id="valorPanel" style="margin-top:12px;"><div class="panel-h"><span>💎 Betano contra o preço justo</span><span class="muted">segunda fonte de odds · em teste</span></div><div class="panel-b" id="valorBody">${zeValorBody()}</div></div>`; }
stDecorate = (function (prev) {
  return function () {
    try { const old = document.getElementById('valorPanel'); if (old) old.remove(); } catch (e) {}
    const r = prev.apply(this, arguments);
    try { const y = document.getElementById('yearPanel'); if (y) { y.insertAdjacentHTML('afterend', zeValorPanelHTML()); const p = document.getElementById('valorPanel'), h = p.querySelector('.panel-h'); if (h && !h.querySelector('.st-io')) h.insertAdjacentHTML('beforeend', `<span class="st-io"><button type="button" title="Partilhar esta janela" aria-label="Partilhar esta janela" onclick="event.stopPropagation(); stPanelShare(this)">📤</button><button type="button" title="Imprimir ou guardar em PDF" aria-label="Imprimir ou guardar em PDF" onclick="event.stopPropagation(); stPanelPrint(this)">🖨️</button></span>`); zeValorLoad(); } } catch (e) { console.warn(e); }
    return r;
  };
})(stDecorate);
try { ZE_RULES.log.push({ ver: ZE_RULES.ver, d: '2026-11-12', txt: 'Nova estratégia do piloto, à parte das outras: «💎 Preço justo» (250 € virtuais). Aposta 1% da banca no resultado final quando a Betano paga 3% ou mais acima do preço justo da Pinnacle, com odd entre 1,25 e 4,00. Regra fixada hoje; as regras do Zé não mudaram.' }); } catch (e) {}


/* ================= v72 · arrumações pedidas: data/hora do boletim, cópia completa na nuvem ================= */
/* 1) Boletim: a data e hora que a casa escreve por baixo de cada jogo serve de desempate.
      Se o print não deixou ler as equipas e só há UM jogo conhecido a essa hora, é esse. */
function zeSlipKick(txt) {
  const m = String(txt || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\D{1,4}(\d{1,2})[:h.](\d{2})/);
  if (!m) return null;
  const y = +m[3] < 100 ? 2000 + +m[3] : +m[3], d = new Date(y, +m[2] - 1, +m[1], +m[4], +m[5]);
  return isNaN(d) || +m[2] > 12 || +m[1] > 31 || +m[4] > 23 ? null : d.toISOString();
}
function zeFixturesAt(iso, pool) {
  const t = Date.parse(iso); if (!t) return [];
  let L = pool; if (!L) { try { L = (lsGet(LIVE_KEY, null) || {}).matches || []; } catch (e) { L = []; } }
  const seen = {};
  return L.filter(x => x && x.utcDate && x.homeTeam && x.awayTeam && Math.abs(Date.parse(x.utcDate) - t) <= 5 * 60e3)
    .filter(x => { const k = normTxt((x.homeTeam.name || '') + '|' + (x.awayTeam.name || '')); if (seen[k]) return false; seen[k] = 1; return true; });
}
parseSlip = (function (prev) {
  return function (text) {
    const out = prev.apply(this, arguments);
    try {
      const lines = String(text || '').split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const blocks = [];
      lines.forEach((l, i) => {
        if (!MARKET_RE.test(l)) return;
        let kick = null;
        for (let k = i + 1; k <= i + 5 && k < lines.length; k++) { if (MARKET_RE.test(lines[k])) break; kick = zeSlipKick(lines[k]); if (kick) break; }
        blocks.push({ market: l, kick, used: false });
      });
      out.legs.forEach(l => { if (!l.market || l.kick) return; const b = blocks.find(x => !x.used && x.market === l.market); if (b) { b.used = true; if (b.kick) l.kick = b.kick; } });
      // desempate: sem equipas legíveis e sem equipa na seleção → o único jogo conhecido a essa hora
      out.legs.forEach(l => {
        if (!l.kick || l.sport === 'nba' || (zeTeamOk(l.home) && zeTeamOk(l.away))) return;
        const c = zeFixturesAt(l.kick); if (c.length !== 1) return;
        const e = c[0], hx = expandAliases(normTxt(e.homeTeam.name + ' ' + (e.homeTeam.shortName || ''))), ax = expandAliases(normTxt(e.awayTeam.name + ' ' + (e.awayTeam.shortName || '')));
        // se uma equipa foi lida, tem de jogar neste jogo — senão não mexo
        const one = zeTeamOk(l.home) ? l.home : zeTeamOk(l.away) ? l.away : '';
        if (one && !(teamScore(one, hx) > 0 || teamScore(one, ax) > 0)) return;
        const h = e.homeTeam.shortName || e.homeTeam.name, a = e.awayTeam.shortName || e.awayTeam.name;
        l.home = h; l.away = a; l.byKick = 1;
      });
    } catch (e) { console.warn(e); }
    return out;
  };
})(parseSlip);
/* apostas já gravadas com a hora mas sem equipas: na liquidação, o único jogo acabado a essa hora */
resolveLeg = (function (prev) {
  return function (l, fin, at) {
    const r = prev.apply(this, arguments);
    if (r || !l || !l.kick || (zeTeamOk(l.home) && zeTeamOk(l.away))) return r;
    try {
      const c = zeFixturesAt(l.kick, fin || []); if (c.length !== 1) return r;
      const e = c[0];
      return prev.call(this, Object.assign({}, l, { home: e.homeTeam.shortName || e.homeTeam.name, away: e.awayTeam.shortName || e.awayTeam.name }), fin, at);
    } catch (e) { return r; }
  };
})(resolveLeg);

/* 2) Cópia de segurança completa: o backup antigo só levava bancas, épocas e perfil.
      Agora leva também o diário do Zé, o piloto local, notas, limites, etc. — nunca tokens nem chaves. */
const ZE_BK_EXTRA = ['ze_diary_v1', 'ze_auto_v1', 'ze_auto_mode_v1', 'ze_gold_v1', 'ze_notes_v1', 'ze_tips_v1', 'ze_archive_v1', 'ze_month_test_v1', 'ze_disc_v1', 'ze_minstake', 'ze_safe_slip_v1', 'ze_scout_v1', 'ze_teams_v1', 'ze_team_meta_v1', 'ze_players_v2', 'ze_leg_league_v1', 'ze_ch_done_v1', 'ze_euro_v1', 'ze_rules_seen_v1', 'ze_fin_seen_v1'];
buildBackup = (function (prev) {
  return function () {
    const d = prev.apply(this, arguments);
    try { d.v = 72; d.extra = {}; ZE_BK_EXTRA.forEach(k => { const v = lsGet(k, null); if (v != null) d.extra[k] = v; }); } catch (e) {}
    return d;
  };
})(buildBackup);
applyBackup = (function (prev) {
  return function (d) {
    // primeiro o que é novo (se o ficheiro for antigo não tem «extra» e nada muda), depois o resto e o redesenho
    if (d && d.app === 'mister-ze' && d.bank && d.extra && typeof d.extra === 'object') { ZE_BK_EXTRA.forEach(k => { if (d.extra[k] != null) { try { lsSet(k, d.extra[k]); } catch (e) {} } }); }
    return prev.apply(this, arguments);
  };
})(applyBackup);
/* com token posto, a cópia para o Gist privado passa de semanal a diária (só quando a app está aberta) */
gistAutoBackup = (function (prev) {
  return async function () {
    try {
      const s = lsGet(SYNC_KEY, {}); if (!s.token) return false;
      if (s.last && Date.now() - new Date(s.last).getTime() < 20 * 3600e3) return false;
      const body = { description: 'Mister Zé backup', public: false, files: { 'mister-ze.json': { content: JSON.stringify(buildBackup()) } } };
      const g = s.gist ? await gh('/gists/' + s.gist, { method: 'PATCH', body: JSON.stringify(body) }) : await gh('/gists', { method: 'POST', body: JSON.stringify(body) });
      const s2 = lsGet(SYNC_KEY, {}); s2.gist = g.id; s2.last = new Date().toISOString(); lsSet(SYNC_KEY, s2);
      lsSet('ze_last_backup', Date.now());
      return true;
    } catch (e) { return false; }
  };
})(gistAutoBackup);
try { ZE_RULES.log.push({ ver: ZE_RULES.ver, d: '2026-11-12', txt: 'Sem mudança de regras. Boletim: a hora do jogo desempata quando as equipas não se leem. Cópia de segurança passa a levar tudo (diário, piloto, notas) e, com token, é diária.' }); } catch (e) {}

/* ================= v73 · Duelo abre depressa: o Zé faz as contas dos jogos em segundo plano ================= */
/* As contas são exatamente as mesmas (modelo de cada jogo); só mudam de momento: aos bocadinhos, enquanto estás
   noutro ecrã, em vez de todas de uma vez quando carregas em Duelo. Nada é gravado nem decidido aqui. */
let ZE_WARM_RUN = 0;
function zeWarm(delay) {
  if (/jsdom/i.test(navigator.userAgent || '') || window.__ZE_LAB || window.__ROBO) return;
  const run = ++ZE_WARM_RUN;
  setTimeout(() => {
    let i = 0; const L = (typeof matches !== 'undefined' && matches || []).slice();
    const step = () => {
      if (run !== ZE_WARM_RUN) return;                       // começou outra ronda (dados novos): esta pára
      const t0 = performance.now();
      while (i < L.length && performance.now() - t0 < 12) { try { modelo(L[i]); } catch (e) {} i++; }   // fatias curtas: o ecrã nunca prende
      if (i < L.length) return setTimeout(step, 40);
      setTimeout(() => { if (run === ZE_WARM_RUN && typeof currentView !== 'undefined' && currentView !== 'duelo') { try { zeChallenges(); } catch (e) {} } }, 60);
    };
    step();
  }, delay == null ? 1800 : delay);
}
try { zeWarm(2500); } catch (e) {}
atualizarTudo = (function (prev) { return async function () { const r = await prev.apply(this, arguments); try { zeWarm(1200); } catch (e) {} return r; }; })(atualizarTudo);
fmGo = (function (prev) { return function (v) { const r = prev.apply(this, arguments); try { if (v === 'portal' && !(CH_MEM && Date.now() - CH_MEM.t < 4 * 60e3)) zeWarm(900); } catch (e) {} return r; }; })(fmGo);

/* ================= v75 · Boletim seguro: só jogos do próprio dia + percentagem numa bolinha ================= */
/* A escolha é a mesma de sempre (mesmos mercados, mesmos 85%/70%); só muda a janela: em vez de «próximas 36 horas»
   entram apenas os jogos que começam HOJE. Os de amanhã ficam para amanhã (dá para espreitar, sem os guardar). */
let SAFE_DAY = null;
function safeDayOf(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
safeCandidates = (function (prev) {
  return function (hours) {
    if (!SAFE_DAY) return prev.apply(this, arguments);
    const alvo = new Date(); if (SAFE_DAY === 'amanha') alvo.setDate(alvo.getDate() + 1);
    const dia = safeDayOf(alvo);
    return (prev.call(this, 48) || []).filter(c => c.k && safeDayOf(c.k) === dia);
  };
})(safeCandidates);
safeLogSave = (function (prev) { return function () { if (SAFE_DAY === 'amanha') return; return prev.apply(this, arguments); }; })(safeLogSave);   // espreitar amanhã não conta para as estatísticas
zeSafeSlip = (function (prev) {
  return function (quando) {
    const am = quando === 'amanha';
    SAFE_DAY = am ? 'amanha' : 'hoje';
    let r; try { r = prev.call(this); } finally { SAFE_DAY = null; }
    try { safeDress(am); } catch (e) { console.warn(e); }
    return r;
  };
})(zeSafeSlip);
function safeDress(am) {
  const box = document.getElementById('dayResult'); if (!box) return;
  const legs = box.querySelectorAll('#ssLegs .ss-leg');
  const outro = am ? `<button class="mini" onclick="zeSafeSlip()">↩ Voltar aos de hoje</button>` : `<button class="mini" onclick="zeSafeSlip('amanha')">👀 Espreitar os de amanhã</button>`;
  if (!legs.length) {
    const m = box.querySelector('.muted');
    if (m) m.innerHTML = (am ? 'Para amanhã ainda não há nenhuma seleção com 80% ou mais.' : 'Hoje já não há nenhuma seleção com 80% ou mais por jogar. Os jogos de amanhã entram no boletim de amanhã.') + `<div class="acts" style="margin-top:8px;">${outro}</div>`;
    return;
  }
  const meta = box.querySelector('.day-meta');
  if (meta) {
    meta.innerHTML = meta.innerHTML.replace('das próximas 36 horas', am ? 'de <b>amanhã</b> (só para espreitar — as odds e as contas ainda podem mudar)' : 'dos jogos de <b>hoje</b>');
    meta.insertAdjacentHTML('beforeend', `<div class="acts" style="margin-top:8px;">${outro}</div>`);
  }
  const h = box.querySelector('h3'); if (h && am) h.textContent = '🛡️ Boletim seguro do Zé · amanhã';
  // a percentagem sai da linha de texto e passa para uma bolinha ao lado da odd
  legs.forEach(row => {
    if (row.querySelector('.ss-pct')) return;
    const b = [...row.querySelectorAll('b')].find(x => /^\d{1,3}%$/.test(x.textContent.trim())); if (!b) return;
    const line = b.parentNode, v = b.textContent.trim();
    b.remove(); line.innerHTML = line.innerHTML.replace(/^\s*Zé:\s*·?\s*/, '').replace(/^\s*·\s*/, '');
    const ball = document.createElement('span'); ball.className = 'ss-pct'; ball.title = 'probabilidade que o Zé dá a esta seleção'; ball.textContent = v;
    const od = row.querySelector('.od'); if (od) row.insertBefore(ball, od); else row.appendChild(ball);
    row.classList.add('ss4');
  });
}
(function () {
  const st = document.createElement('style');
  st.textContent = `.ss-leg.ss4{grid-template-columns:26px 1fr auto auto;}
.ss-pct{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;flex:none;
  font:800 .86rem var(--cond, inherit);letter-spacing:-.01em;color:var(--lime);background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.10),rgba(0,0,0,.28));
  border:2px solid var(--lime);box-shadow:0 0 0 3px rgba(0,0,0,.25),0 2px 6px rgba(0,0,0,.45),inset 0 1px 2px rgba(255,255,255,.12);}`;
  document.head.appendChild(st);
})();
