
/* =====================================================================
   v33 · mercado de transferências
   - janelas de mercado (verão / inverno) com aviso do Zé
   - cada compra/venda pesa pelo VALOR, comparado com o que é normal na liga
   - investimento líquido da época → sinal de ambição da direção
   - muitas caras novas → período de adaptação
   - valor de mercado do plantel → ponto de partida da equipa
   - entradas: chat, prints (Transfermarkt ou outro site, lidos no telemóvel) e títulos de jornais
   ===================================================================== */

/* ---------- Dinheiro: «40 milhões», «€12.5m», «12,00 M €», «£30m», «500 mil €» → milhões de € ---------- */
function parseMoney(str) {
  const s = String(str || '').toLowerCase().replace(/ /g, ' ');
  const re = /(€|£|\$|eur|euros?)?\s*(\d{1,4}(?:[.,]\d{1,3})?)\s*(mil milh[oõ]es|bil(?:i[aã]o|lion)?|bn|bi\.?(?![a-z])|milh[oõ]es|millones|milioni|millions?|mill\.?|mio\.?|mil(?![a-z])|mi\.?|m(?![a-z])|k(?![a-z])|th\.?)\s*(€|£|\$|eur|euros?)?/i;
  const m = s.match(re);
  if (!m) return null;
  let n = parseFloat(m[2].replace(/\.(?=\d{3}\b)/, '').replace(',', '.'));
  if (!isFinite(n)) return null;
  const u = m[3];
  if (/^(mil milh|bil|bn|bi)/.test(u)) n *= 1000;
  else if (/^(mil$|k|th)/.test(u)) n /= 1000;
  const cur = (m[1] || m[4] || '');
  if (/£/.test(cur)) n *= 1.17; else if (/\$/.test(cur)) n *= 0.92;
  return n > 0 && n < 5000 ? +n.toFixed(2) : null;
}
const LOAN_RE = /(emprestad|emprestimo|cedid|loan|prestito|leihe|cesion|pret\b|en prestamo)/;
['ponta', 'lanca', 'extremo', 'medio', 'defesa', 'central', 'lateral', 'guarda', 'redes', 'avancado', 'esquerdo', 'direito', 'ofensivo', 'defensivo', 'centre', 'forward', 'winger', 'midfield', 'midfielder', 'back', 'left', 'right', 'goalkeeper', 'striker', 'attacking', 'defensive', 'second', 'custo', 'zero', 'free', 'transfer', 'loan', 'emprestimo', 'fim', 'end', 'chegadas', 'saidas', 'arrivals', 'departures', 'portugal', 'brasil', 'espanha', 'franca', 'italia', 'inglaterra', 'alemanha', 'holanda', 'grecia', 'servia', 'croacia', 'argentina', 'uruguai', 'colombia', 'nigeria', 'gana', 'senegal', 'marrocos', 'belgica', 'suica', 'dinamarca', 'noruega', 'suecia', 'polonia', 'ucrania', 'turquia', 'japao', 'coreia', 'mexico', 'eua', 'canada'].forEach(w => HEAD_STOP.add(w));
const FREE_RE = /(custo zero|livre|free transfer|a custo zero|ablosefrei|parametro zero|libre|svincolat|fim de contrato)/;

/* ---------- O que é «muito dinheiro» em cada liga (milhões €, compra típica de titular) ---------- */
const FEE_REF = { 'eng.1': 45, 'esp.1': 25, 'ita.1': 22, 'ger.1': 22, 'fra.1': 18, 'por.1': 8, 'ned.1': 6, 'eng.2': 5, 'den.1': 2.5, 'por.2': 0.6 };
const feeRef = code => FEE_REF[code] || 8;
function transferImpact(code, dir, fee, opts) {
  opts = opts || {};
  let q = fee == null ? (opts.free ? 0.45 : 0.6) : Math.sqrt(fee / feeRef(code));
  q = clamp(q, 0.2, 2.5);
  let v = 0.03 * q;
  if (opts.loan) v *= 0.6;
  if (dir === 'out' && opts.star) v *= 1.5;
  return +(dir === 'in' ? v : -v).toFixed(4);
}

/* ---------- Janelas de mercado (datas típicas; cada federação fecha num dia ligeiramente diferente) ---------- */
function transferWindow(d) {
  d = d ? new Date(d) : new Date();
  const y = d.getFullYear(), t = d.getTime();
  const W = [
    { k: 'verao', name: 'mercado de verão', from: new Date(y, 5, 14), to: new Date(y, 8, 1, 23, 59) },
    { k: 'inverno', name: 'mercado de inverno', from: new Date(y, 0, 1), to: new Date(y, 1, 2, 23, 59) }
  ];
  const open = W.find(x => t >= x.from && t <= x.to);
  if (open) return { open: true, ...open, daysLeft: Math.ceil((open.to - t) / 864e5) };
  const next = [new Date(y, 5, 14), new Date(y + 1, 0, 1), new Date(y + 1, 5, 14)].find(x => x > d);
  return { open: false, next, name: next.getMonth() === 0 ? 'mercado de inverno' : 'mercado de verão' };
}
function windowTxt(w) {
  w = w || transferWindow();
  const f = x => x.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
  return w.open ? `🔄 <b>${w.name} aberto</b> até ${f(w.to)} (faltam ${w.daysLeft} dias)` : `🔒 Mercado fechado · abre o ${w.name} a ${f(w.next)}`;
}

/* ---------- Força do plantel: transferências + valor de mercado + adaptação ---------- */
function teamGames(t, season) { return t && t.cur && (!season || t.cur.season === season) ? t.cur.H.n + t.cur.A.n : 0; }
function squadValueRating(t) {
  const P = prof(); const V = P.values || {};
  const mine = V[t.k]; if (!mine) return null;
  const vals = Object.keys(V).filter(k => k.split('|')[0] === t.code).map(k => V[k].v).sort((a, b) => a - b);
  if (vals.length < 6) return { v: mine.v, r: null, n: vals.length };
  const med = vals[Math.floor(vals.length / 2)];
  return { v: mine.v, med, r: clamp(0.12 * Math.log(mine.v / med), -0.2, 0.2), n: vals.length };
}
squadDelta = function (t) {
  const list = ((t && t.squad) || []).slice();
  const curSeason = t && t.cur ? t.cur.season : seasonOf(new Date(), t && t.code);
  const extra = [];
  const vr = t ? squadValueRating(t) : null;
  // com época passada conhecida, o valor só acrescenta uma parte (a época passada já diz muito)
  if (vr && vr.r != null && Math.abs(vr.r) >= 0.01) extra.push({ txt: `plantel vale ${vr.v.toFixed(0)} M€ (mediana da liga ${vr.med.toFixed(0)} M€)`, v: +(vr.r * (t.prev ? 0.4 : 1)).toFixed(4), season: curSeason, n0: 0, span: 20, kind: 'value' });
  const ins = list.filter(e => e.dir === 'in' && e.season === curSeason && !e.loanBack);
  if (ins.length >= 5) extra.push({ txt: `${ins.length} caras novas: precisam de tempo`, v: -0.02, season: curSeason, n0: 0, span: 6, kind: 'turnover' });
  const all = list.concat(extra);
  let raw = 0, eff = 0;
  all.forEach(e => {
    const n = e.season && t && t.cur && t.cur.season === e.season ? teamGames(t) : 0;
    const span = e.span || 12, n0 = e.n0 || 0;
    raw += e.v; eff += e.v * Math.max(0, 1 - Math.max(0, n - n0) / span);
  });
  return { raw: clamp(raw, -0.3, 0.3), eff: clamp(eff, -0.3, 0.3), list: all };
};
function netSpend(t, season) {
  season = season || (t.cur ? t.cur.season : seasonOf(new Date(), t.code));
  const L = (t.squad || []).filter(e => e.season === season && e.fee != null);
  const inn = L.filter(e => e.dir === 'in').reduce((s, e) => s + e.fee, 0), out = L.filter(e => e.dir === 'out').reduce((s, e) => s + e.fee, 0);
  return { inn, out, net: inn - out, n: L.length };
}
const _teamProfileV33 = teamProfile;
teamProfile = function (t) {
  const p = _teamProfileV33(t);
  if (!p) return p;
  // «reforçou-se / perdeu jogadores» só pelas transferências (o valor do plantel tem etiqueta própria)
  p.tags = p.tags.filter(x => !/reforcou-se|reforçou-se|perdeu jogadores/.test(x));
  const tr = (t.squad || []).filter(e => e.dir && e.season === (t.cur ? t.cur.season : seasonOf(new Date(), t.code))).reduce((s, e) => s + e.v, 0);
  if (tr >= 0.05) p.tags.push('📥 reforçou-se'); else if (tr <= -0.05) p.tags.push('📤 perdeu jogadores');
  const ns = netSpend(t), ref = feeRef(t.code);
  if (ns.net >= 2 * ref) p.tags.push(`💰 investimento forte (+${ns.net.toFixed(0)} M€): a direção quer resultados já`);
  else if (ns.net <= -3 * ref) p.tags.push(`📤 vendeu muito (${ns.net.toFixed(0)} M€ líquidos)`);
  if (p.sq.list.some(e => e.kind === 'turnover')) p.tags.push('🔄 plantel muito mexido');
  const vr = squadValueRating(t); if (vr && vr.r != null && vr.r >= 0.08) p.tags.push('💎 plantel caro'); else if (vr && vr.r != null && vr.r <= -0.08) p.tags.push('🪙 plantel barato');
  p.money = ns; p.value = vr;
  return p;
};

/* ---------- Registar uma transferência ---------- */
function teamForName(name) {
  let code = null;
  const mm = matches.find(m => m.espn && (teamScore(m.home, normTxt(name)) > 0 || teamScore(m.away, normTxt(name)) > 0));
  if (mm) code = mm.espn.code;
  let t = profFind(name, code);
  if (!t) t = Object.values(prof().teams).find(x => teamScore(x.name, normTxt(name)) > 0) || profTeam(code || 'manual', normTxt(name), name);
  return { t, m: mm };
}
function starShare(m, player) {
  if (!m || !player) return null;
  const b = boardFor(m) || (studyFor(m) && studyFor(m).board);
  const p = b ? b.home.concat(b.away).find(x => nameHit(player, x.name) != null) : null;
  return p ? p.share : null;
}
function addTransfer(teamName, e) {
  const { t, m } = teamForName(teamName);
  const season = seasonOf(new Date(), t.code);
  const share = e.dir === 'out' ? starShare(m, e.player) : null;
  const star = share != null && share >= 0.2;
  const v = e.v != null ? e.v : transferImpact(t.code, e.dir, e.fee, { loan: e.loan, free: e.free, star });
  const who = e.player || (e.dir === 'in' ? 'um reforço' : 'um jogador');
  const feeTxt = e.loan ? 'empréstimo' : e.free ? 'custo zero' : e.fee != null ? `${e.fee.toFixed(e.fee < 10 ? 1 : 0)} M€` : 'valor desconhecido';
  const txt = `${e.dir === 'in' ? 'chegou' : 'saiu'} ${who} (${feeTxt}${star ? `, ${Math.round(share * 100)}% dos golos` : ''}${e.other ? `, ${e.dir === 'in' ? 'do' : 'para o'} ${e.other}` : ''})`;
  if ((t.squad || []).some(s => s.player && e.player && normTxt(s.player) === normTxt(e.player) && s.dir === e.dir && s.season === season)) return { t, dup: true, txt };
  const entry = { txt, v, season, at: new Date().toISOString(), dir: e.dir, fee: e.fee != null ? e.fee : null, loan: !!e.loan, free: !!e.free, player: e.player || null, other: e.other || null, src: e.src || 'chat', n0: teamGames(t, season), span: transferWindow().k === 'inverno' || teamGames(t, season) > 4 ? 8 : 12 };
  t.squad = (t.squad || []).concat(entry);
  return { t, entry, txt, v };
}
function transferReply(res, mirror) {
  if (res.dup) return `Já tinha isso no <b>${esc(res.t.name)}</b>: ${esc(res.txt)}.`;
  const sq = squadDelta(res.t), ns = netSpend(res.t);
  return `📝 <b>${esc(res.t.name)}</b>: ${esc(res.txt)} → ${res.v > 0 ? '+' : ''}${(res.v * 100).toFixed(1)}% de força${mirror ? `<br>📝 <b>${esc(mirror.t.name)}</b>: ${esc(mirror.txt)} → ${mirror.v > 0 ? '+' : ''}${(mirror.v * 100).toFixed(1)}%` : ''}
    <br><span class="muted">Total do plantel ${sq.raw > 0 ? '+' : ''}${Math.round(sq.raw * 100)}%${ns.n ? ` · saldo da época ${ns.net >= 0 ? '+' : ''}${ns.net.toFixed(1)} M€` : ''}. O peso depende do valor face ao normal na liga (${feeRef(res.t.code)} M€ = titular típico) e vai-se apagando com os jogos reais.</span>`;
}

/* ---------- Ler páginas de transferências / valores (texto de prints ou colado) ---------- */
const TR_IN = /(chegadas|entradas|arrivals|zugange|altas|llegadas|acquisti|incoming|signings|aquisicoes)/;
const TR_OUT = /(saidas|departures|abgange|bajas|cessioni|salidas|outgoing|vendas)/;
function looksTransferText(t) { const n = normTxt(t); return (TR_IN.test(n) || TR_OUT.test(n)) && /(custo zero|empr|loan|free transfer|\d\s*(m|mi|mio)\b|milh|€)/.test(n); }
function looksValueText(t) { const n = normTxt(t); return /(valor de mercado|market value|marktwert|valor total|valore di mercato|valeur marchande|squad value|valor do plantel)/.test(n); }
function clubsInText(raw) {
  const q = normTxt(raw), seen = {};
  const head = normTxt(String(raw).split(/\n/).slice(0, 2).join(' '));
  profTeamsInText(q).forEach(n => { const tk = normTxt(n).split(' ').filter(x => x.length > 2)[0] || normTxt(n); const re = new RegExp('(^| )' + tk + '( |$)', 'g'); seen[n] = ((q.match(re) || []).length || 1) + (teamScore(n, head) > 0 ? 100 : 0); });
  return Object.keys(seen).sort((a, b) => seen[b] - seen[a]);   // o clube do título da página primeiro
}
function parseTransferText(raw) {
  const lines = String(raw).split(/\n+/).map(x => x.trim()).filter(Boolean);
  let dir = null; const out = [];
  const clubs = clubsInText(raw);
  lines.forEach(line => {
    const n = normTxt(line);
    if (TR_IN.test(n) && n.length < 40) { dir = 'in'; return; }
    if (TR_OUT.test(n) && n.length < 40) { dir = 'out'; return; }
    if (!dir || /(total|saldo|balance|soma|gastos|receitas|expenditure|income)/.test(n)) return;
    const loan = LOAN_RE.test(n) && !/fim do empr|end of loan|fine prestito|ende der leihe/.test(n), back = /fim do empr|end of loan|fine prestito|ende der leihe/.test(n);
    const free = FREE_RE.test(n), fee = (loan || free) ? null : parseMoney(line);
    if (fee == null && !loan && !free && !back) return;
    const player = playerFromRaw(line, clubs) || null;
    if (!player) return;
    const other = clubs.slice(1).find(c => teamScore(c, n) > 0) || null;
    out.push({ dir, player, fee, loan, free, loanBack: back, other });
  });
  return { clubs, items: out };
}
function parseValueText(raw) {
  const lines = String(raw).split(/\n+/).map(x => x.trim()).filter(Boolean), out = [];
  lines.forEach(line => {
    const n = normTxt(line);
    const team = profTeamsInText(n)[0] || teamsMentioned(n)[0];
    if (!team) return;
    const ms = [...line.matchAll(/(\d{1,4}(?:[.,]\d{1,2})?)\s*(mil milh[oõ]es|bn|bi\.?|mil mi\.?|m(?![a-z])|mi\.?|mio\.?|milh[oõ]es|million)\s*(€|£)?/gi)].map(x => parseMoney(x[0].includes('€') || x[0].includes('£') ? x[0] : x[0] + ' €')).filter(x => x && x > 0.5);
    if (!ms.length) return;
    const v = Math.max(...ms);   // a linha da tabela traz o total do plantel (o maior número)
    if (!out.some(o => normTxt(o.team) === normTxt(team))) out.push({ team, v });
  });
  return out;
}
let TRANSFER_DRAFT = null;
function transferDraftHTML(d) {
  if (!d) return '';
  if (d.kind === 'values') {
    return `<div class="needs news"><div class="rz-head">💎 Valores dos plantéis</div>${d.items.map((x, j) => `<label class="need" style="display:block;"><input type="checkbox" checked data-tdi="${j}"> <b>${esc(x.team)}</b> — ${x.v.toFixed(1)} M€</label>`).join('')}
      <div class="acts" style="margin-top:6px;"><button class="mini l" onclick="transferDraftSave()">Guardar valores</button><button class="mini x" onclick="TRANSFER_DRAFT=null;this.closest('.needs').remove()">Ignorar</button></div>
      <div class="muted" style="font-size:.74rem;">Com 6 ou mais equipas da mesma liga, o Zé compara cada plantel com a mediana: um plantel caro começa mais forte (até +20%), e o efeito apaga-se ao longo de 20 jogos.</div></div>`;
  }
  const opts = d.clubs.map((c, i) => `<option ${i === 0 ? 'selected' : ''}>${esc(c)}</option>`).join('');
  return `<div class="needs news"><div class="rz-head">💸 Transferências lidas</div>
    <div class="need">Clube: <select id="tdClub" class="inp" style="width:auto;display:inline-block;padding:2px 6px;">${opts || '<option>?</option>'}</select> <span class="muted">(confirma)</span></div>
    ${d.items.map((x, j) => `<label class="need" style="display:block;"><input type="checkbox" ${x.loanBack ? '' : 'checked'} data-tdi="${j}"> ${x.dir === 'in' ? '📥' : '📤'} <b>${esc(x.player)}</b> — ${x.loan ? 'empréstimo' : x.loanBack ? 'fim de empréstimo' : x.free ? 'custo zero' : x.fee != null ? x.fee.toFixed(1) + ' M€' : '?'}${x.other ? ` <span class="muted">(${x.dir === 'in' ? 'do' : 'para o'} ${esc(x.other)})</span>` : ''}</label>`).join('')}
    <div class="acts" style="margin-top:6px;"><button class="mini l" onclick="transferDraftSave()">Registar estas</button><button class="mini x" onclick="TRANSFER_DRAFT=null;this.closest('.needs').remove()">Ignorar</button></div>
    <div class="muted" style="font-size:.74rem;">Li isto do texto do print. Desmarca o que estiver errado antes de registar.</div></div>`;
}
function transferDraftSave() {
  const d = TRANSFER_DRAFT; if (!d) return;
  const keep = new Set([...document.querySelectorAll('[data-tdi]')].filter(x => x.checked).map(x => +x.dataset.tdi));
  const P = prof(); let msg = '';
  if (d.kind === 'values') {
    P.values = P.values || {};
    d.items.forEach((x, j) => { if (!keep.has(j)) return; const { t } = teamForName(x.team); P.values[t.k] = { v: x.v, at: new Date().toISOString() }; });
    profSave(); msg = `💎 Guardei ${keep.size} valores de plantel.`;
  } else {
    const club = (document.getElementById('tdClub') || {}).value || d.clubs[0];
    const res = d.items.filter((x, j) => keep.has(j)).map(x => addTransfer(club, { ...x, src: 'print' }));
    profSave();
    const t = res[0] && res[0].t; const sq = t ? squadDelta(t) : null, ns = t ? netSpend(t) : null;
    msg = t ? `📝 <b>${esc(t.name)}</b>: registei ${res.filter(r => !r.dup).length} transferências → força do plantel ${sq.raw > 0 ? '+' : ''}${Math.round(sq.raw * 100)}% · saldo ${ns.net >= 0 ? '+' : ''}${ns.net.toFixed(1)} M€${teamProfile(t).tags.filter(x => /💰|📤|🔄/.test(x)).map(x => '<br>' + esc(x)).join('')}` : 'Nada registado.';
  }
  TRANSFER_DRAFT = null;
  document.querySelectorAll('.needs').forEach(x => { if (x.querySelector('[data-tdi]')) x.remove(); });
  addChat('bot', msg, 'feliz');
}
function transferFromText(raw) {
  if (looksValueText(raw)) { const items = parseValueText(raw); if (items.length >= 2) { TRANSFER_DRAFT = { kind: 'values', items }; return transferDraftHTML(TRANSFER_DRAFT); } }
  if (looksTransferText(raw)) { const d = parseTransferText(raw); if (d.items.length) { TRANSFER_DRAFT = { kind: 'transfers', ...d }; return transferDraftHTML(TRANSFER_DRAFT); } }
  return null;
}
/* prints: o leitor de boletins passa o texto por aqui primeiro */
let TRANSFER_OCR = null;
const _parseAnyV33 = parseAny;
parseAny = function (text) {
  try {
    if (looksValueText(text) || looksTransferText(text)) {
      const prev = TRANSFER_OCR && TRANSFER_OCR.text;
      if (!prev || String(text).length > prev.length) TRANSFER_OCR = { text: String(text) };
    }
  } catch (e) {}
  return _parseAnyV33(text);
};
const _batchHTMLV33 = batchHTML;
batchHTML = function (groups) {
  if (TRANSFER_OCR) {
    const h = transferFromText(TRANSFER_OCR.text); TRANSFER_OCR = null;
    if (h) return `Isto não é um boletim — é uma página de ${TRANSFER_DRAFT.kind === 'values' ? 'valores de plantel' : 'transferências'}. Li assim:${h}`;
  }
  return _batchHTMLV33(groups);
};
const _zeChatSlipV33 = zeChatSlip;
zeChatSlip = async function (fileList) { TRANSFER_OCR = null; return _zeChatSlipV33(fileList); };

/* ---------- Chat ---------- */
const _zeTalkV33 = zeTalk;
zeTalk = function (raw, opts) {
  const q = zeNorm(raw);
  // texto colado de uma página (vários linhas)
  if (/\n/.test(raw) && (looksTransferText(raw) || looksValueText(raw))) { const h = transferFromText(raw); if (h) return { mood: 'pensativo', html: 'Li a página assim:' + h }; }
  if (/(janela|mercado).*(transferenc|aberto|fecha|abre)|mercado de (verao|inverno)|quando (abre|fecha) o mercado/.test(q)) {
    return { mood: 'pensativo', html: `${windowTxt()}<br><span class="muted">Datas típicas: verão de meados de junho a 1 de setembro, inverno de 1 de janeiro a 2 de fevereiro (cada liga fecha num dia ligeiramente diferente). Com o mercado aberto, diz-me as compras e vendas ou manda prints da página de transferências do clube.</span>` };
  }
  const teams = profTeamsInText(q);
  if (/(valor|vale)\b.*(plantel|equipa)|plantel.*(vale|valor)/.test(q) && teams.length) {
    const v = parseMoney(raw.replace(/(\d)\s*(?=milh)/, '$1 ')) || parseMoney(raw + ' M€');
    if (v) { const { t } = teamForName(teams[0]); const P = prof(); P.values = P.values || {}; P.values[t.k] = { v, at: new Date().toISOString() }; profSave(); const vr = squadValueRating(t);
      return { mood: 'feliz', html: `💎 <b>${esc(t.name)}</b>: plantel de ${v.toFixed(0)} M€ guardado.${vr && vr.r != null ? ` Comparado com a mediana da liga (${vr.med.toFixed(0)} M€) → ${vr.r > 0 ? '+' : ''}${Math.round(vr.r * 100)}% de força no arranque.` : ` <span class="muted">Preciso de pelo menos 6 equipas da mesma liga para comparar (tenho ${vr ? vr.n : 1}). Manda print da tabela de valores da liga.</span>`}` };
    }
  }
  if (/(transferencias|mercado|compras|vendas|saldo)\b.*\b(do|da|de)\b/.test(q) && teams.length && !/(vendeu|contratou|comprou|vende|contrata)/.test(q)) {
    const { t } = teamForName(teams[0]); const ns = netSpend(t), sq = squadDelta(t);
    const L = (t.squad || []).filter(e => e.dir);
    return { mood: 'pensativo', html: L.length ? `💸 <b>${esc(t.name)}</b> (${esc(seasonOf(new Date(), t.code))}):<br>${L.map(e => `${e.dir === 'in' ? '📥' : '📤'} ${esc(e.txt)} → ${e.v > 0 ? '+' : ''}${(e.v * 100).toFixed(1)}%`).join('<br>')}<br><b>Saldo ${ns.net >= 0 ? '+' : ''}${ns.net.toFixed(1)} M€</b> (compras ${ns.inn.toFixed(1)} · vendas ${ns.out.toFixed(1)}) · força ${sq.raw > 0 ? '+' : ''}${Math.round(sq.raw * 100)}%, agora vale ${sq.eff > 0 ? '+' : ''}${Math.round(sq.eff * 100)}%` : `Não tenho transferências do <b>${esc(t.name)}</b>. Diz-me («${esc(t.name)} vendeu X por 20 milhões») ou manda print da página de transferências.` };
  }
  const sale = SALE_RE.test(q), buy = BUY_RE.test(q);
  const fee0 = parseMoney(raw), pl0 = (sale || buy) && teams.length ? playerFromRaw(raw, teams) : null;
  // «o Benfica perdeu com o Porto» é um resultado, não uma venda: sem jogador nem valor, deixa passar
  const clearVerb = /\b(vendeu|vende|vendido|contratou|contrata|comprou|foi buscar|assinou|emprest|transferid)/.test(q);
  if ((sale || buy) && teams.length && !/aposta|odd|@/.test(q) && (pl0 || fee0 || clearVerb) && !/\b\d+\s*-\s*\d+\b/.test(q)) {
    const fee = fee0, loan = LOAN_RE.test(q), free = FREE_RE.test(q);
    const pl = pl0;
    // quem vende e quem compra: «A vendeu X ao B», «B contratou X ao A», «X saiu do A para o B»
    let seller = null, buyer = null;
    const pos = n => { const tk = teamTokens(n).find(x => q.includes(x)); return tk ? q.indexOf(tk) : 99; };
    const ord = teams.slice(0, 2).sort((a, b) => pos(a) - pos(b));
    if (/\b(vendeu|vende|vendido)/.test(q)) { seller = ord[0]; buyer = ord[1] || null; }
    else if (/\b(contratou|contrata|comprou|compra|foi buscar|assinou)/.test(q)) { buyer = ord[0]; seller = ord[1] || null; }
    else if (/\b(saiu|sai d|deixou|deixa|trocou|troca o)/.test(q)) { seller = ord[0]; buyer = ord[1] || null; }
    else if (/\b(chegou|chega|reforco|reforca|reforcou)/.test(q)) { buyer = ord[0]; seller = ord[1] || null; }
    else { if (sale) seller = ord[0]; else buyer = ord[0]; }
    const main = seller ? addTransfer(seller, { dir: 'out', player: pl, fee, loan, free, other: buyer }) : addTransfer(buyer, { dir: 'in', player: pl, fee, loan, free, other: seller });
    const mirror = seller && buyer ? addTransfer(buyer, { dir: 'in', player: pl, fee, loan, free, other: seller }) : null;
    profSave();
    return { mood: main.v < 0 ? 'pensativo' : 'feliz', html: transferReply(main, mirror && !mirror.dup ? mirror : null) + (fee == null && !loan && !free ? '<br><span class="muted">Sem valor conto como transferência média. Se souberes o valor, diz «… por 15 milhões» que eu acerto.</span>' : '') };
  }
  return _zeTalkV33(raw, opts);
};

/* ---------- Jornais: títulos de mercado com valor ---------- */
const TRANSFER_HEAD = /\b(contrat|reforco|vende|vendid|sign|sells|sold|joins|completes|transfer|ficha|fichaje|traspaso|ingaggi|acquist|cede|verpflicht|wechsel|recrue|transfert|signe|deal|agreement|acordo|oficial)/;
const _newsSignalsV33 = newsSignals;
newsSignals = function (m, items) {
  const out = _newsSignalsV33(m, items);
  items.forEach((it, i) => {
    const t = normTxt(it.title).replace(/[.,+\-/]/g, ' ').replace(/\s+/g, ' ');
    if (!TRANSFER_HEAD.test(t)) return;
    const fee = parseMoney(it.title), side = teamSide(m, t);
    if (!side) return;
    const g = guessPlayer(it.title, m);
    const player = g ? g.name : null;
    if (!player || out.some(s => s.player === player && s.k === 'transfer')) return;
    out.push({ i, k: 'transfer', label: `💸 Mercado${fee ? ` (${fee.toFixed(fee < 10 ? 1 : 0)} M€)` : ''}`, player, side, fee, guessed: false });
  });
  return out;
};
const _newsApplyV33 = newsApply;
newsApply = function (idx, j, what) {
  if (what === 'tin' || what === 'tout') {
    const m = matches[idx], st = m && studyFor(m), sg = st && st.news && st.news.signals[j]; if (!sg) return;
    const team = sg.side === 'h' ? m.home : m.away;
    const it = st.news.items[sg.i] || {};
    const res = addTransfer(team, { dir: what === 'tin' ? 'in' : 'out', player: sg.player, fee: sg.fee, loan: LOAN_RE.test(normTxt(it.title || '')), src: 'jornal' });
    profSave();
    st.newsIgnored = (st.newsIgnored || []).concat(sg.k + '|' + (sg.player || sg.side));
    toast(res.dup ? 'Já estava registada.' : `📝 ${res.t.name}: ${res.txt}`);
    ['studyBox', 'dueloStudy'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = reasoningHTML(m); });
    return;
  }
  return _newsApplyV33(idx, j, what);
};
const _newsHTMLV33 = newsHTML;
newsHTML = function (m) {
  let h = _newsHTMLV33(m);
  const st = studyFor(m); if (!st || !st.news) return h;
  const idx = matchIndex(m);
  st.news.signals.forEach((sg, j) => {
    if (sg.k !== 'transfer') return;
    const key = `onclick="newsApply(${idx},${j},'ignore')"`;
    const team = esc(sg.side === 'h' ? m.home : m.away);
    h = h.replace(`<button class="mini x" ${key}`, `<button class="mini l" onclick="newsApply(${idx},${j},'tin')">📥 Entrou no ${team}</button><button class="mini" onclick="newsApply(${idx},${j},'tout')">📤 Saiu do ${team}</button><button class="mini x" ${key}`);
  });
  return h;
};

/* ---------- Painel e aviso da janela ---------- */
const _renderTeamsPanelV33 = renderTeamsPanel;
renderTeamsPanel = function () {
  _renderTeamsPanelV33();
  const el = document.getElementById('cfgTeams'); if (!el) return;
  const T = Object.values(prof().teams).filter(t => (t.squad || []).some(e => e.dir)).map(t => ({ t, ns: netSpend(t) })).sort((a, b) => b.ns.net - a.ns.net);
  const nv = Object.keys(prof().values || {}).length;
  el.insertAdjacentHTML('afterbegin', `<div style="margin-bottom:8px;font-size:.86rem;">${windowTxt()}</div>`);
  el.insertAdjacentHTML('beforeend', `<div style="margin-top:10px;font-size:.84rem;line-height:1.5;"><b>💸 Mercado registado</b>${T.length ? '<br>' + T.slice(0, 8).map(x => `${esc(x.t.name)}: ${x.ns.net >= 0 ? '+' : ''}${x.ns.net.toFixed(1)} M€ <span class="muted">(${(x.t.squad || []).filter(e => e.dir === 'in').length} entradas · ${(x.t.squad || []).filter(e => e.dir === 'out').length} saídas)</span>`).join('<br>') : ' — <span class="muted">nada ainda. No chat: «Benfica vendeu X ao Porto por 40 milhões», ou manda print da página de transferências do clube.</span>'}
    <br><b>💎 Valores de plantel:</b> ${nv ? `${nv} equipas` : '<span class="muted">manda print da tabela de valores de mercado da liga (todas as equipas) — é o melhor ponto de partida para a época.</span>'}</div>`);
};
function windowNudge() {
  const w = transferWindow(); if (!w.open) return;
  const key = 'ze_window_seen', k = w.k + w.from.getFullYear();
  if (lsGet(key, '') === k) return;
  lsSet(key, k);
  setTimeout(() => { try { zeSay(`${windowTxt(w)}. Conta-me as compras e vendas que forem acontecendo (com o valor, se souberes) ou manda prints da página de transferências — compra cara pesa mais, venda do melhor marcador pesa a dobrar.`, 'pensativo', 12000); } catch (e) {} }, 2500);
}
windowNudge();
