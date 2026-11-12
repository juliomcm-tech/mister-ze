/* =====================================================================
   v14 · Layout FM + Duelo — utilitários, cara do Zé, Portal, navegação
   ===================================================================== */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function r2(n) { return Math.round(Number(n) * 100) / 100; }
function setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }
function setHTML(id, h) { const el = document.getElementById(id); if (el) el.innerHTML = h; }
function lsGet(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', '');
  ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { ta.setSelectionRange(0, text.length); document.execCommand('copy'); } catch (e) {}
  ta.remove();
}
/** Clipboard que funciona também em file:// no Android (sem contexto seguro). */
function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    }
  } catch (e) {}
  legacyCopy(text);
  return Promise.resolve();
}
function copyAnalysis(btn) {
  const text = (document.getElementById('modal-body').innerText || document.getElementById('modal-body').textContent || '').replace('📋 Copiar análise', '').trim();
  copyText(text).then(() => {
    btn.textContent = '✅ Copiado!'; btn.classList.add('copied');
    setTimeout(() => { btn.textContent = '📋 Copiar análise'; btn.classList.remove('copied'); }, 1600);
  });
}
function copyDay(btn) {
  const label = btn.textContent;
  const text = (document.getElementById('dayResult').innerText || document.getElementById('dayResult').textContent || '').replace(label, '').trim();
  copyText(text).then(() => {
    btn.textContent = '✅ Copiado!';
    setTimeout(() => { btn.textContent = label; }, 1600);
  });
}

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ========== A CARA DO MISTER ZÉ (SVG original) ========== */
let zeFaceSeq = 0;
function zeFace(mood, size, cls) {
  mood = mood || 'neutro'; size = size || 48;
  const id = 'zf' + (++zeFaceSeq);
  const eye = mood === 'chateado' ? '#ff5d78' : '#c8f53c';
  let eyes = '', brows = '', mouth = '';
  if (mood === 'feliz') {
    eyes = `<path d="M45 55 q5 -7 10 0" /><path d="M65 55 q5 -7 10 0" />`;
    mouth = `<path d="M51 67 q9 8 18 0" />`;
  } else if (mood === 'gozao') {
    eyes = `<path d="M45 55 q5 -7 10 0" /><path d="M65 53 h10" />`;
    brows = `<path d="M64 47 l11 -3" />`;
    mouth = `<path d="M52 68 q9 4 17 -4" />`;
  } else if (mood === 'chateado') {
    eyes = `<circle cx="50" cy="55" r="3.2" stroke="none" fill="${eye}"/><circle cx="70" cy="55" r="3.2" stroke="none" fill="${eye}"/>`;
    brows = `<path d="M44 47 l11 4" /><path d="M76 47 l-11 4" />`;
    mouth = `<path d="M52 71 q8 -6 16 0" />`;
  } else if (mood === 'pensativo') {
    eyes = `<circle cx="53" cy="52" r="3.2" stroke="none" fill="${eye}"/><circle cx="73" cy="52" r="3.2" stroke="none" fill="${eye}"/>`;
    brows = `<path d="M67 45 l10 -2" />`;
    mouth = `<path d="M56 69 h9" />`;
  } else {
    eyes = `<circle cx="50" cy="54" r="3.6" stroke="none" fill="${eye}"/><circle cx="70" cy="54" r="3.6" stroke="none" fill="${eye}"/>`;
    mouth = `<path d="M54 69 h12" />`;
  }
  return `<svg class="ze-face ${cls || ''}" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="Mister Zé">
  <defs>
    <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#2a1450"/></linearGradient>
    <linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1eefa"/><stop offset="1" stop-color="#b6add0"/></linearGradient>
    <clipPath id="${id}c"><circle cx="60" cy="60" r="57"/></clipPath>
  </defs>
  <circle cx="60" cy="60" r="58" fill="url(#${id}b)"/>
  <g clip-path="url(#${id}c)">
    <path d="M14 122 C18 98 36 89 60 89 C84 89 102 98 106 122 Z" fill="#1c1236"/>
    <path d="M14 122 C18 98 36 89 60 89 L60 122 Z" fill="#24184a"/>
    <path d="M50 89 L60 106 L70 89" fill="none" stroke="#c8f53c" stroke-width="3.5" stroke-linejoin="round"/>
    <rect x="58.6" y="106" width="2.8" height="16" fill="#c8f53c"/>
  </g>
  <rect x="52" y="78" width="16" height="12" rx="2" fill="#8f86a8"/>
  <line x1="60" y1="24" x2="60" y2="11" stroke="#b6add0" stroke-width="3"/>
  <circle class="ze-led" cx="60" cy="10" r="4.5" fill="#c8f53c"/>
  <rect x="27" y="29" width="66" height="54" rx="17" fill="url(#${id}m)"/>
  <rect x="21" y="45" width="8" height="21" rx="3" fill="#5b4a85"/>
  <rect x="91" y="45" width="8" height="21" rx="3" fill="#5b4a85"/>
  <path d="M95 64 Q97 78 81 79" fill="none" stroke="#5b4a85" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="80" cy="79" r="3" fill="#5b4a85"/>
  <path d="M27 41 C27 19 93 19 93 41 Z" fill="#2b1d4a"/>
  <path d="M24 41 Q60 49 96 41 L97 45.5 Q60 56 23 45.5 Z" fill="#1d1336"/>
  <circle cx="60" cy="25" r="2.2" fill="#c8f53c"/>
  <rect x="35" y="45" width="50" height="31" rx="10" fill="#120a20"/>
  <g fill="none" stroke="${eye}" stroke-width="3" stroke-linecap="round">
    <g class="ze-eyes">${eyes}</g>
    ${brows}
    <path d="M47 63.5 q6.5 -5 13 0 q6.5 -5 13 0" stroke-width="3.4"/>
    ${mouth}
  </g>
</svg>`;
}

function humanFace(size, cls) {
  size = size || 48;
  return `<svg class="${cls || ''}" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="Tu">
  <circle cx="60" cy="60" r="58" fill="#163a66"/>
  <circle cx="60" cy="60" r="58" fill="none" stroke="#5aa9ff" stroke-width="3" opacity=".6"/>
  <circle cx="60" cy="50" r="21" fill="#9fc3ee"/>
  <path d="M20 112 C24 86 42 78 60 78 C78 78 96 86 100 112 Z" fill="#9fc3ee"/>
  <text x="60" y="104" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="17" fill="#163a66">TU</text>
</svg>`;
}

function zeMood(b) {
  const L = duelLeader(b || loadBank());
  if (Math.abs(L.ry - L.rz) < 0.02) return 'neutro';
  return L.who === 'ze' ? 'gozao' : 'chateado';
}

/* ========== BANCA — histórico, VS, liquidação ========== */
function settleBet(id, result, who) {
  // result: 'win' | 'loss' | 'void'
  const b = loadBank();
  const list = who === 'ze' ? b.zeBets : b.bets;
  const bet = list.find(x => x.id === id);
  if (!bet || bet.status !== 'open') return;
  bet.status = result;
  bet.settledAt = new Date().toISOString();
  if (result === 'win') {
    const ret = r2(bet.stake * bet.odd);
    if (who === 'ze') b.ze = r2(b.ze + ret); else b.you = r2(b.you + ret);
  } else if (result === 'void') {
    if (who === 'ze') b.ze = r2(b.ze + bet.stake); else b.you = r2(b.you + bet.stake);
  }
  // loss: stake já foi descontada ao registar
  b.zePeak = Math.max(b.zePeak || 0, b.ze);
  saveBank(b);
  if (who === 'ze' && result !== 'void') registarResultado(bet.match + ' · ' + bet.pick, result === 'win', 'auto-duelo');
  renderBanca();
  const quem = who === 'ze' ? 'Zé' : pname();
  toast(result === 'win' ? `✅ ${quem}: ganhou ${r2(bet.stake * bet.odd - bet.stake).toFixed(2)} €` :
        result === 'loss' ? `❌ ${quem}: perdeu ${Number(bet.stake).toFixed(2)} €` : `↩️ ${quem}: aposta anulada`);
}

function betItemHTML(bet, who) {
  const st = {
    open: ['⏳ Aberta', 'var(--yellow)'], win: ['✅ Ganha', 'var(--green)'],
    loss: ['❌ Perdida', 'var(--red)'], void: ['↩️ Nula', 'var(--muted)']
  }[bet.status] || ['?', 'var(--muted)'];
  const stake = Number(bet.stake) || 0, odd = Number(bet.odd) || 0;
  const res = bet.status === 'win' ? ` · <b style="color:var(--green)">+${(stake * odd - stake).toFixed(2)} €</b>` :
              bet.status === 'loss' ? ` · <b style="color:var(--red)">−${stake.toFixed(2)} €</b>` : '';
  const bid = esc(bet.id);
  const acts = bet.status === 'open'
    ? `<div class="acts">
        <button class="mini w" onclick="settleBet('${bid}','win','${who}')">Ganhou</button>
        <button class="mini l" onclick="settleBet('${bid}','loss','${who}')">Perdeu</button>
        <button class="mini v" onclick="settleBet('${bid}','void','${who}')">Nula</button>
        <button class="mini s" onclick="shareBet('${bid}','${who}')" title="Partilhar (WhatsApp)">📤</button>
        ${who === 'you' ? `<button class="mini x" onclick="cancelUserBet('${bid}')" title="Não chegaste a fazer esta aposta: devolve o dinheiro à carteira">🗑️ Anular</button>` : ''}
      </div>` : (bet.status !== 'cancel' ? `<div class="acts"><button class="mini s" onclick="shareBet('${bid}','${who}')" title="Partilhar (WhatsApp)">📤 Partilhar</button>${who === 'you' ? `<button class="mini x" onclick="cancelUserBet('${bid}')" title="Anular registo (estorno)">🗑️ Anular</button>` : ''}</div>` : '');
  const face = who === 'ze' ? zeFace(bet.status === 'win' ? 'feliz' : bet.status === 'loss' ? 'chateado' : 'pensativo', 32) : humanFace(32);
  return `<div class="bet">${face}<div style="flex:1;min-width:0;">
    <div class="bm">${esc(bet.match)}</div>
    <div class="bp">${esc(bet.pick)} @ ${odd.toFixed(2)} · ${stake.toFixed(2)} € · <span style="color:${st[1]};font-weight:800;">${st[0]}</span>${res}</div>
    ${bet.zeCompare ? `<div class="bz">🤖 ${esc(bet.zeCompare)}</div>` : ''}
    ${acts}
  </div></div>`;
}

function formPills(list) {
  const closed = (list || []).filter(x => x.status !== 'open' && x.status !== 'cancel').slice(0, 5).reverse();
  const out = closed.map(x => x.status === 'win' ? '<span class="pill v">V</span>' : x.status === 'loss' ? '<span class="pill d">D</span>' : '<span class="pill n">N</span>');
  while (out.length < 5) out.unshift('<span class="pill e"></span>');
  return `<span class="form" title="Últimas 5 (V vitória · D derrota · N nula)">${out.join('')}</span>`;
}

function statsOf(list, bank, start) {
  list = list.filter(x => x.status !== 'cancel');
  const closed = list.filter(x => x.status !== 'open');
  const w = closed.filter(x => x.status === 'win').length;
  const l = closed.filter(x => x.status === 'loss').length;
  const open = list.filter(x => x.status === 'open').length;
  const roi = ((bank + openStake(list) - start) / start * 100);
  return { w, l, open, roi, pct: (w + l) ? Math.round(100 * w / (w + l)) : null };
}

function zeRoastText(b) {
  const L = duelLeader(b);
  const ry = (L.ry * 100).toFixed(1), rz = (L.rz * 100).toFixed(1);
  const zeWins = (b.seasons || []).filter(s => s.winner === 'ze').length, youWins = (b.seasons || []).filter(s => s.winner === 'you').length;
  let msg;
  if (L.who === 'ze') {
    msg = L.handicap === 'ze'
      ? `“Comecei com ${b.startZe.toFixed(2)} € e tu com ${b.startYou.toFixed(2)} €… e mesmo assim vou à frente (ROI ${rz}% vs ${ry}%). Nem com mais dinheiro consegues, chefe. 😏”`
      : `“Vou à frente: ROI ${rz}% contra ${ry}%. Não é sorte — é valor esperado.”`;
  } else if (L.who === 'you') {
    msg = L.handicap === 'you' ? `“Começaste com menos e vais à frente (ROI ${ry}% vs ${rz}%). Ok… respeito. Por agora.”`
      : L.handicap === 'ze' ? `“Vais à frente, mas tiveste ${(b.startYou - b.startZe).toFixed(2)} € de avanço. Falamos no fim da época.”`
      : `“Vais à frente (ROI ${ry}% vs ${rz}%). Não te habitues — variância não é talento.”`;
  } else msg = `“Empatados. Aborrecido. Prepara o duelo e vamos separar isto.”`;
  if (b.zePasses) msg += `<br><span class="muted">Já recusei ${b.zePasses} aposta${b.zePasses > 1 ? 's' : ''} sem valor. Disciplina também é estratégia.</span>`;
  if (zeWins || youWins) msg += `<br><span class="muted">Épocas: Zé ${zeWins} · ${esc(pname())} ${youWins}${zeWins > youWins ? ' — o histórico fala por mim.' : ''}</span>`;
  const last = b.bets[0];
  if (last && last.status === 'open' && /m[uú]ltipla/i.test(last.match)) msg += `<br><br>Esse teu <b>${esc(last.match)}</b> @ ${Number(last.odd).toFixed(2)}… vou guardar o print para a posteridade.`;
  return msg;
}

function renderBanca() {
  const b = loadBank();
  const sy = statsOf(b.bets, b.you, b.startYou);
  const sz = statsOf(b.zeBets, b.ze, b.startZe);

  setText('bankYou', b.you.toFixed(2) + ' €');
  setText('bankZe', b.ze.toFixed(2) + ' €');
  setText('bankYouMeta', `V${sy.w} · D${sy.l} · ROI ${sy.roi.toFixed(1)}% · início ${b.startYou.toFixed(2)} €`);
  setText('bankZeMeta', `V${sz.w} · D${sz.l} · ROI ${sz.roi.toFixed(1)}% · início ${b.startZe.toFixed(2)} €`);
  setHTML('bankFaceYou', humanFace(46));
  setHTML('bankFaceZe', zeFace(zeMood(b), 46));
  { const nc = b.bets.filter(x => x.status === 'cancel').length, nv = b.bets.length - nc; setText('histYouCount', nv || nc ? `${nv} · ${sy.open} abertas${nc ? ` · ${nc} anulada${nc > 1 ? 's' : ''}` : ''}` : ''); }
  setText('histZeCount', b.zeBets.length ? `${b.zeBets.length} · ${sz.open} abertas` : '');

  setHTML('betHistory', b.bets.some(x => x.status !== 'cancel') ? b.bets.filter(x => x.status !== 'cancel').map(x => betItemHTML(x, 'you')).join('')
    : '<div class="empty">Sem apostas ainda. Regista o boletim do print, uma aposta manual, ou entra no duelo.</div>');
  setHTML('betHistoryZe', b.zeBets.length ? b.zeBets.map(x => betItemHTML(x, 'ze')).join('')
    : '<div class="empty">O Zé ainda não apostou. Vai a <b>Duelo → Preparar duelo</b>.</div>');

  const openAll = b.bets.filter(x => x.status === 'open').map(x => betItemHTML(x, 'you'))
    .concat(b.zeBets.filter(x => x.status === 'open').map(x => betItemHTML(x, 'ze')));
  setHTML('dueloOpen', openAll.length ? openAll.join('') : '<div class="empty">Nada por liquidar. 👌</div>');
  setText('badgeDuelo', openAll.length ? String(openAll.length) : '');

  const roast = zeRoastText(b);
  setHTML('zeRoast', zeFace(zeMood(b), 40) + `<div>${personalize(roast)}</div>`);

  // Ribbon + crest
  setText('fmBankYou', b.you.toFixed(2) + ' €');
  setText('fmBankZe', b.ze.toFixed(2) + ' €');
  setText('fmBankRoi', `ROI tu ${sy.roi.toFixed(1)}% · Zé ${sz.roi.toFixed(1)}%`);
  { const L = duelLeader(b); setText('fmLeader', (L.who === 'you' ? '🏆 Lideras tu' : L.who === 'ze' ? '🤖 Lidera o Zé' : '🤝 Empate') + ` · época ${b.season}`); }
  setHTML('crest', zeFace(zeMood(b), 44));

  renderVS(b, sy, sz);
  renderPortal();
}

function renderVS(b, sy, sz) {
  if (!document.getElementById('vsPanel')) return;
  b = b || loadBank();
  sy = sy || statsOf(b.bets, b.you, b.startYou);
  sz = sz || statsOf(b.zeBets, b.ze, b.startZe);
  const L = duelLeader(b);
  const youLead = L.who === 'you', zeLead = L.who === 'ze';
  const diff = Math.abs(L.ry - L.rz) * 100;
  setHTML('vsPanel', `
    <div class="vs-card you${youLead ? ' leader' : ''}">
      ${humanFace(96, 'big')}
      <div class="name">${esc((userProfile().name || '').trim() || 'Tu')}</div>
      <div class="bank">${b.you.toFixed(2)} €</div>
      <div class="meta">V${sy.w} · D${sy.l}${sy.pct != null ? ' · ' + sy.pct + '%' : ''} · ROI ${sy.roi.toFixed(1)}%</div>
      ${formPills(b.bets)}
    </div>
    <div class="vs-mid">
      <div class="vs-txt">VS</div>
      <div class="diff">${diff < 0.05 ? 'empate' : (youLead ? '+' : '−') + diff.toFixed(1) + ' pp ROI'}</div>
    </div>
    <div class="vs-card ze${zeLead ? ' leader' : ''}">
      ${zeFace(zeMood(b), 96, 'big')}
      <div class="name">Mister Zé</div>
      <div class="bank">${b.ze.toFixed(2)} €</div>
      <div class="meta">V${sz.w} · D${sz.l}${sz.pct != null ? ' · ' + sz.pct + '%' : ''} · ROI ${sz.roi.toFixed(1)}%</div>
      ${formPills(b.zeBets)}
    </div>`);
  setHTML('vsSpeech', zeFace(zeMood(b), 40) + `<div>${personalize(zeRoastText(b))}</div>`);
  setHTML('duelProfile', zeFace(zeProfile().tipo === 'Discípulo do Zé' ? 'feliz' : 'gozao', 44) + `<div>${personalize(zeProfileHTML())}</div>`);
}

/* ========== PORTAL: inbox + tiles + calendário 14 dias ========== */
let inboxFilter = 'tudo';
let inboxSel = null;
const INBOX_KEY = 'ze_inbox_v1';

function probClass(p) {
  const s = String(p || '');
  if (/feito/.test(s)) return 'mid';
  const n = parseInt(s.replace(/[~%\s]/g, '').split('-')[0], 10);
  if (isNaN(n)) return 'mid';
  return n >= 65 ? 'hi' : n >= 45 ? 'mid' : 'lo';
}

function upcoming(maxDays) {
  return matches.map((m, i) => {
    if (m.past || m.aviso) return null;
    const d = parseDayLabel(m.date);
    return d ? { m, i, d, days: daysFromToday(d) } : null;
  }).filter(x => x && x.days >= 0 && x.days <= maxDays)
    .sort((a, b) => a.days - b.days || scoreMatch(b.m) - scoreMatch(a.m));
}

function matchIndex(m) {
  if (!m) return -1;
  return matches.findIndex(x => x.home === m.home && x.away === m.away && x.date === m.date && x.type === m.type);
}
function openMatchIdx(i) { if (matches[i]) openModal(matches[i]); }

function buildInbox() {
  const msgs = [];
  const b = loadBank();
  const t = loadTrack();
  const m = pickDueloMatch();

  if (m) {
    const conf = confiancaMatch(m), pred = preverPlacar(m), pctStake = stakePctFromConf(conf);
    const key = m.home + ' vs ' + m.away;
    const zeHas = b.zeBets.some(x => x.match === key);
    msgs.push({
      id: 'pick|' + key + '|' + m.date, cat: 'tarefa', mood: conf >= 4 ? 'feliz' : 'pensativo',
      title: zeHas ? `Duelo lançado: ${key}` : `Duelo do dia: ${key}`,
      meta: `${m.league} · ${m.date}`,
      body: `<p>Chefe, o radar aponta para <b>${m.home} vs ${m.away}</b>.${zeHas ? ' Já meti a minha aposta — falta a tua.' : ' Mete a odd real e eu fecho a stake.'}</p>
        <div class="kv"><span>Leitura do dossiê</span><b>${deriveBet(m)}</b></div>
        <div class="kv"><span>Modelo</span><b>1 ${pct(modelo(m).mk['1'])} · X ${pct(modelo(m).mk['X'])} · 2 ${pct(modelo(m).mk['2'])} · O2.5 ${pct(modelo(m).mk['O2.5'])}</b></div>
        <div class="kv"><span>Cenário</span><b>${pred.label}</b></div>
        <div class="kv"><span>Probabilidade</span><b>${m.prob}</b></div>
        <div class="kv"><span>Confiança</span><b>${conf}/5 · stake ${(pctStake * 100).toFixed(1)}% da banca</b></div>
        <p style="margin-top:10px;">${m.analysis}</p>${m.fatores ? `<p class="muted">📋 ${m.fatores}</p>` : ''}`,
      actions: [
        { label: '⚔️ Preparar duelo', js: 'prepararDuelo()', cls: 'btn-lime' },
        { label: 'Abrir cartão', js: `openMatchIdx(${matchIndex(m)})` }
      ]
    });
  }

  const open = b.bets.filter(x => x.status === 'open').length + b.zeBets.filter(x => x.status === 'open').length;
  if (open) {
    const ids = b.bets.concat(b.zeBets).filter(x => x.status === 'open').map(x => x.id).join(',');
    msgs.push({
      id: 'open|' + ids, cat: 'tarefa', mood: 'pensativo',
      title: `${open} aposta${open > 1 ? 's' : ''} por liquidar`,
      meta: 'Finanças',
      body: `<p>Quando os jogos acabarem, marca <b>Ganhou / Perdeu / Nula</b>. Sem isso a tabela do duelo fica coxa.</p>` +
        b.bets.concat(b.zeBets).filter(x => x.status === 'open').slice(0, 6)
          .map(x => `<div class="kv"><span>${esc(x.match)}</span><b>${esc(x.pick)} @ ${x.odd}</b></div>`).join(''),
      actions: [{ label: 'Liquidar agora', js: "fmGo('duelo')", cls: 'btn-primary' }]
    });
  }

  const LL = duelLeader(b);
  const d = LL.who === 'ze' ? 1 : LL.who === 'you' ? -1 : 0;
  msgs.push({
    id: 'duel|' + b.you.toFixed(2) + '|' + b.ze.toFixed(2), cat: 'info', mood: zeMood(b),
    title: d > 0 ? 'O Zé lidera o duelo' : d < 0 ? 'Estás à frente do Zé' : 'Duelo empatado',
    meta: `${pname()} ${b.you.toFixed(2)} € · Zé ${b.ze.toFixed(2)} €`,
    body: `<p>${zeRoastText(b)}</p>
      <div class="kv"><span>Forma (tu)</span><b>${formPills(b.bets)}</b></div>
      <div class="kv"><span>Forma (Zé)</span><b>${formPills(b.zeBets)}</b></div>`,
    actions: [{ label: 'Ver duelo', js: "fmGo('duelo')", cls: 'btn-primary' }]
  });

  const up = upcoming(14).filter(x => x.m.fav).slice(0, 5);
  if (up.length) {
    msgs.push({
      id: 'agenda|' + up.map(x => x.m.home + x.m.date).join(','), cat: 'info', mood: 'neutro',
      title: `Agenda: ${up.length} jogo${up.length > 1 ? 's' : ''} favorável${up.length > 1 ? 'eis' : ''} à vista`,
      meta: 'Próximos 14 dias',
      body: `<p>Do estudo, estes são os que contam:</p>` +
        up.map(x => `<div class="kv"><span>${x.m.date} · ${x.m.home} vs ${x.m.away}</span><b>${x.m.prob}</b></div>`).join(''),
      actions: [{ label: 'Calendário', js: "fmGo('jogos')", cls: 'btn-primary' }]
    });
  }

  const tot = t.hits + t.miss;
  if (tot) {
    msgs.push({
      id: 'track|' + t.hits + '|' + t.miss, cat: 'info', mood: t.hits >= t.miss ? 'feliz' : 'chateado',
      title: `Relatório de acertos: ${Math.round(100 * t.hits / tot)}%`,
      meta: `${t.hits} acertos · ${t.miss} falhas`,
      body: `<p>${t.miss > t.hits ? 'Mais falhas que acertos — vou jogar mais conservador.' : 'A leitura do dossiê está a pagar. Mantemos a disciplina.'}</p>` +
        t.log.slice(0, 6).map(l => `<div class="kv"><span>${esc(l.key)}</span><b>${l.hit ? '✅' : '❌'}</b></div>`).join(''),
      actions: [{ label: 'Falar com o Zé', js: "fmGo('ze')" }]
    });
  }

  const prof = zeProfile();
  if (prof.n >= 3) msgs.push({
    id: 'perfil|' + prof.tipo + '|' + prof.closed, cat: 'ze', mood: prof.tipo === 'Discípulo do Zé' ? 'feliz' : 'gozao',
    title: `Relatório do treinador: ${prof.tipo}`, meta: `${prof.n} apostas analisadas`,
    body: zeProfileHTML(), actions: [{ label: 'Ver duelo', js: "fmGo('duelo')" }]
  });
  msgs.push({
    id: 'welcome', cat: 'ze', mood: 'feliz',
    title: 'Regras do duelo',
    meta: 'Mister Zé · adjunto técnico',
    body: `<p>Bem-vindo, Mister. Esta época começaste com <b>${b.startYou.toFixed(2)} €</b> e eu com <b>${b.startZe.toFixed(2)} €</b> (muda em Definições).</p>
      <div class="kv"><span>O Zé</span><b>modelo Poisson · só aposta com valor · Kelly ¼</b></div>
      <div class="kv"><span>Boletim louco?</span><b>manda-me o print (📸 no chat)</b></div>
      <div class="kv"><span>${esc(pname())}</span><b>segues o Zé ou a tua lógica</b></div>
      <div class="kv"><span>Ganha</span><b>quem tiver mais banca</b></div>
      <p style="margin-top:10px;">O botão <b>Continuar</b> lá em cima leva-te sempre à próxima coisa a fazer — como no FM.</p>`,
    actions: [{ label: '⚔️ Começar', js: 'prepararDuelo()', cls: 'btn-lime' }]
  });
  return msgs;
}

function inboxState() { return lsGet(INBOX_KEY, { read: {}, seen: {} }); }

function renderInbox() {
  const list = document.getElementById('inboxList');
  if (!list) return;
  const st = inboxState();
  const now = Date.now();
  let changed = false;
  const msgs = buildInbox();
  msgs.forEach(m => { if (!st.seen[m.id]) { st.seen[m.id] = now; changed = true; } });
  // limpar ids antigos
  const live = new Set(msgs.map(m => m.id));
  Object.keys(st.seen).forEach(k => { if (!live.has(k) && now - st.seen[k] > 30 * 864e5) { delete st.seen[k]; delete st.read[k]; changed = true; } });
  if (changed) lsSet(INBOX_KEY, st);

  const unread = msgs.filter(m => !st.read[m.id]).length;
  setText('badgeInbox', unread ? String(unread) : '');

  const shown = msgs.filter(m => {
    if (inboxFilter === 'novas') return now - (st.seen[m.id] || now) < 864e5;
    if (inboxFilter === 'tarefas') return m.cat === 'tarefa';
    if (inboxFilter === 'naolidas') return !st.read[m.id];
    return true;
  });
  window._inboxMsgs = msgs;
  list.innerHTML = shown.length ? shown.map(m => `
    <div class="imsg${st.read[m.id] ? '' : ' unread'}${inboxSel === m.id ? ' sel' : ''}" onclick="openInboxIdx(${msgs.indexOf(m)})">
      ${zeFace(m.mood, 34)}
      <div style="min-width:0;">
        <div class="t"><span class="tag tag-${m.cat}">${m.cat === 'tarefa' ? 'Tarefa' : m.cat === 'ze' ? 'Zé' : 'Info'}</span>${m.title}</div>
        <div class="m">${m.meta}</div>
      </div>
    </div>`).join('') : '<div class="empty">Nada nesta pasta.</div>';

  if (!inboxSel || !msgs.find(m => m.id === inboxSel)) inboxSel = shown[0] ? shown[0].id : null;
  renderInboxRead(false);
}

function renderInboxRead(markRead) {
  const box = document.getElementById('inboxRead');
  if (!box) return;
  const m = (window._inboxMsgs || []).find(x => x.id === inboxSel);
  if (!m) { box.innerHTML = '<div class="empty">Seleciona uma mensagem.</div>'; return; }
  if (markRead) { const st = inboxState(); st.read[m.id] = Date.now(); lsSet(INBOX_KEY, st); }
  box.innerHTML = `
    <button class="btn btn-sm read-back" onclick="document.getElementById('inboxWrap').classList.remove('reading')">‹ Caixa de entrada</button>
    <div class="read-head">${zeFace(m.mood, 54)}<div><div class="eyebrow">${m.cat === 'tarefa' ? 'Tarefa' : 'Mister Zé'}</div><h3>${m.title}</h3><div class="muted" style="font-size:.78rem;">${m.meta}</div></div></div>
    <div class="read-body">${personalize(m.body)}</div>
    <div class="read-actions">${(m.actions || []).map(a => `<button class="btn ${a.cls || ''}" onclick="${a.js}">${a.label}</button>`).join('')}</div>`;
}

function openInboxIdx(i) { const m = (window._inboxMsgs || [])[i]; if (m) openInbox(m.id); }
function openInbox(id) {
  inboxSel = id;
  renderInboxRead(true);
  document.getElementById('inboxWrap').classList.add('reading');
  // atualizar lista (bolinhas de não lida) sem perder a seleção
  const keepReading = true;
  renderInbox();
  if (keepReading) document.getElementById('inboxWrap').classList.add('reading');
}

function setInboxFilter(f) {
  inboxFilter = f;
  document.querySelectorAll('#inboxFilters .ifilter').forEach(b => b.classList.toggle('active', b.dataset.f === f));
  inboxSel = null;
  document.getElementById('inboxWrap').classList.remove('reading');
  renderInbox();
}

function renderPortal() {
  if (!document.getElementById('portalTiles')) return;
  const b = loadBank();
  const t = loadTrack();
  const h = new Date().getHours();
  setText('portalGreet', (h < 6 ? 'Boa noite' : h < 13 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite') + ', ' + ((userProfile().name || '').trim() || 'Mister'));

  const m = pickDueloMatch();
  const up = upcoming(14);
  const tot = t.hits + t.miss;
  const mi = matchIndex(m);
  const pred = m ? preverPlacar(m) : null;
  const tiles = [];
  if (m) {
    tiles.push(`<div class="tile hero" onclick="openMatchIdx(${mi})">
      ${zeFace(confiancaMatch(m) >= 4 ? 'feliz' : 'pensativo', 58)}
      <div class="tcol">
        <div class="tl">Próximo jogo · ${m.date}</div>
        <div class="tv">${m.home} vs ${m.away}</div>
        <div class="ts" style="margin-top:0;">💡 ${deriveBet(m)} · cenário <b style="color:var(--text)">${pred.label}</b> · <span class="ptag ${probClass(m.prob)}">${m.prob}</span></div>
      </div></div>`);
  }
  tiles.push(`<div class="tile" onclick="fmGo('duelo')">
      <div class="tl">Duelo</div>
      <div class="tv"><span style="color:var(--blue)">${b.you.toFixed(2)}</span> <span class="muted" style="font-size:.9rem;">vs</span> <span style="color:var(--lime)">${b.ze.toFixed(2)}</span></div>
      <div class="ts">${(L => L.who === 'you' ? 'Lideras tu' : L.who === 'ze' ? 'Lidera o Zé' : 'Empate técnico')(duelLeader(b))} · ROI</div>
      <div class="corner">VS</div></div>`);
  tiles.push(`<div class="tile" onclick="fmGo('banca')">
      <div class="tl">Forma</div>
      <div style="display:flex;flex-direction:column;gap:5px;margin-top:4px;font-size:.72rem;">
        <div style="display:flex;justify-content:space-between;gap:6px;align-items:center;"><span>${esc(pname())}</span>${formPills(b.bets)}</div>
        <div style="display:flex;justify-content:space-between;gap:6px;align-items:center;"><span>Zé</span>${formPills(b.zeBets)}</div>
      </div>
      <div class="ts">Últimas 5 apostas fechadas</div></div>`);
  tiles.push(`<div class="tile" onclick="fmGo('ze')">
      <div class="tl">Acertos do Zé</div>
      <div class="tv">${tot ? Math.round(100 * t.hits / tot) + '%' : '—'}</div>
      <div class="ts">${t.hits} acertos · ${t.miss} falhas</div></div>`);
  tiles.push(`<div class="tile" onclick="fmGo('scout')">
      <div class="tl">Scouting</div>
      <div class="tv">10 + 10</div>
      <div class="ts">Fortes em casa · fracos fora</div></div>`);
  setHTML('portalTiles', tiles.join(''));

  setText('portalCalCount', up.length + ' jogos');
  setHTML('portalCal', up.length ? up.slice(0, 10).map(x => {
    const wd = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][x.d.getDay()];
    const mo = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][x.d.getMonth()];
    return `<div class="fx" onclick="openMatchIdx(${x.i})">
      <div class="d">${x.days === 0 ? 'Hoje' : wd}<b>${x.d.getDate()}</b>${mo}</div>
      <div style="min-width:0;"><div class="tm">${x.m.fav ? '⭐ ' : ''}${vsHTML(x.m.home, x.m.away, 16)}</div><div class="lg">${x.m.league}${x.m.risk ? ' · ⚠️ goleada' : ''}</div></div>
      <span class="ptag ${probClass(x.m.prob)}">${x.m.prob}</span>
    </div>`;
  }).join('') : '<div class="empty">Sem jogos nas próximas 2 semanas.</div>');

  renderInbox();
  updateContinue();
}

/* ========== CONTINUAR (como no FM) ========== */
function proximaAcao() {
  const b = loadBank();
  const open = b.bets.filter(x => x.status === 'open').length + b.zeBets.filter(x => x.status === 'open').length;
  const m = pickDueloMatch();
  const key = m ? m.home + ' vs ' + m.away : '';
  const zeHas = m && b.zeBets.some(x => x.match === key);
  if (m && !zeHas) return { label: 'Duelo: ' + m.home + ' vs ' + m.away, run: () => { fmGo('duelo'); prepararDuelo(); } };
  if (open) return { label: `Resultados (${open} aberta${open > 1 ? 's' : ''})`, run: () => { fmGo('duelo'); atualizarTudo(); } };
  return { label: 'Match Day', run: () => { fmGo('dia'); gerarDia(); } };
}
function updateContinue() { setText('btnContinueSub', proximaAcao().label); }
function continuar() { proximaAcao().run(); }

/* ========== NAVEGAÇÃO (com botão «voltar» do Android) ========== */
const VIEWS = ['portal', 'dia', 'duelo', 'jogos', 'scout', 'banca', 'ze', 'config'];
let currentView = 'portal';

function fmGo(view, fromHistory) {
  if (!VIEWS.includes(view)) view = 'portal';
  currentView = view;
  document.querySelectorAll('.fm-nav-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-view') === view));
  document.querySelectorAll('.fm-view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));

  if (view === 'portal') renderPortal();
  if (view === 'banca' || view === 'duelo') renderBanca();
  if (view === 'jogos') renderCalendar();
  if (view === 'config') renderConfig();
  if (view === 'banca') { if (!slipState.legs.length) slipAddLeg(true); renderSlipEditor(); }
  if (view === 'ze') {
    setHTML('zeHeroFace', zeFace('feliz', 64));
    const log = document.getElementById('chatLog');
    if (log && !log.innerHTML.trim()) {
      addChat('bot', 'Olá, sou o <strong>Mister Zé</strong> 🤖<br>Jogos, odds, duelo e banca. Diz o jogo, toca em <em>Jogo do dia</em>, ou usa os botões em baixo.', 'feliz');
      const today = upcoming(0);
      if (today.length) {
        zeLastMatch = today[0].m;
        addChat('bot', `Hoje no radar: <strong>${zeLastMatch.home} vs ${zeLastMatch.away}</strong> (${zeLastMatch.prob}).<br>💡 ${deriveBet(zeLastMatch)} · cenário ${preverPlacar(zeLastMatch).label}`, 'pensativo');
      }
    }
    updateZeContext();
  }
  const ab = document.querySelector('.fm-nav-btn.active');
  if (ab && ab.parentElement) {
    const nav = ab.parentElement;
    nav.scrollLeft = ab.offsetLeft - nav.clientWidth / 2 + ab.clientWidth / 2;
  }
  if (!fromHistory) { try { if (location.hash !== '#' + view) history.pushState({ v: view }, '', '#' + view); } catch (e) {} }
  window.scrollTo(0, 0);
}
window.addEventListener('popstate', () => fmGo((location.hash || '#portal').slice(1), true));

function toggleSearch() {
  const h = document.getElementById('fmHeader');
  h.classList.toggle('show-search');
  if (h.classList.contains('show-search')) document.getElementById('searchInput').focus();
}
function onGlobalSearch() {
  if (currentView !== 'jogos' && currentView !== 'scout') fmGo('jogos');
  filterAll();
}

/* ========== CHAT com cara ========== */
function addChat(who, text, mood) {
  const log = document.getElementById('chatLog');
  if (!log) return;
  const div = document.createElement('div');
  div.className = 'cmsg ' + (who === 'bot' ? 'bot' : 'user');
  div.innerHTML = who === 'bot'
    ? `${zeFace(mood || 'pensativo', 34)}<div class="bubble"><div class="who">Mister Zé</div>${personalize(text)}</div>`
    : `<div class="bubble">${esc(text)}</div>${humanFace(30)}`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

/* ========== ARRANQUE ========== */
function initApp() {
  const now = new Date();
  setHTML('hdrDate', `<strong>${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][now.getDay()]}, ${now.getDate()} ${['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][now.getMonth()]}</strong>${now.getFullYear()} · época 26/27`);
  setHTML('crest', zeFace(zeMood(), 44));
  liveBoot();
  showSection('best');
  renderCalendar();
  renderBanca();
  const start = (location.hash || '').slice(1);
  fmGo(VIEWS.includes(start) ? start : 'portal', true);
  try { history.replaceState({ v: currentView }, '', '#' + currentView); } catch (e) {}
}
