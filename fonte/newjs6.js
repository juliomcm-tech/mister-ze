/* =====================================================================
   v18 · Leitura por coordenadas (tabelas), «se fosse parvo», perfil do
   utilizador (nome + foto), análise de comportamento, sync opcional.
   ===================================================================== */

/* ---------- Palavras com posição (tesseract.js) ---------- */
function ocrWords(data) {
  if (Array.isArray(data.words) && data.words.length) return data.words.map(w => ({ t: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1, c: w.confidence }));
  const out = [];
  (data.blocks || []).forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => (l.words || []).forEach(w => out.push({ t: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1, c: w.confidence })))));
  return out;
}
const CHOICE_MAP = s => {
  const n = normTxt(s).replace(/\s+/g, ' ').trim();
  if (/^btts ?(no|nao)$|^gg ?no$|^ng$/.test(n)) return 'BTTS NO';
  if (/^btts ?(yes|sim)$|^gg$/.test(n)) return 'BTTS YES';
  if (/^(over|o|mais de|\+) ?(\d)[.,]5$/.test(n)) return 'Over ' + n.match(/(\d)[.,]5/)[1] + '.5';
  if (/^(under|u|menos de|-) ?(\d)[.,]5$/.test(n)) return 'Under ' + n.match(/(\d)[.,]5/)[1] + '.5';
  if (/^(1x|x2|12|1|x|2)$/.test(n)) return n.toUpperCase();
  return s.trim();
};
/** Tabela «Matches | Choices | Values» lida pela posição das palavras */
function parseGeometric(words, W) {
  const ws = words.filter(w => w.t && w.t.trim() && (w.c == null || w.c > 35));
  const out = { legs: [], totalOdd: null, boost: 0, stake: null, declared: null, appProb: null, geo: true };
  if (!ws.length) return out;
  const yc = w => (w.y0 + w.y1) / 2, hgt = w => Math.max(8, w.y1 - w.y0);
  const sameLine = (a, b) => Math.abs(yc(a) - yc(b)) < Math.max(hgt(a), hgt(b)) * 0.7;
  const labels = ws.filter(w => /^(total|odds|win|potential|coupon|value|probability|ganhos|cota|stake|montante)$/i.test(w.t));
  const isOdd = w => /^\d{1,2}[.,]\d{2}$/.test(w.t) && parseFloat(w.t.replace(',', '.')) >= 1.01;
  ws.filter(w => /^%?\d{1,2}[.,]\d{1,2}%?$/.test(w.t) && /%/.test(w.t)).forEach(w => { out.appProb = parseFloat(w.t.replace(/%/g, '').replace(',', '.')) / 100; });
  const totalLbl = ws.find(w => /^total$/i.test(w.t));
  if (totalLbl) { const t = ws.filter(w => /^\d{1,4}[.,]\d{2}$/.test(w.t) && sameLine(w, totalLbl)).sort((a, b) => b.x0 - a.x0)[0]; if (t) out.totalOdd = parseFloat(t.t.replace(',', '.')); }
  const stakeLbl = ws.find(w => /^(coupon|stake|montante)$/i.test(w.t));
  if (stakeLbl) { const s = ws.filter(w => /^\d{1,5}[.,]\d{2}$/.test(w.t) && sameLine(w, stakeLbl)).sort((a, b) => b.x0 - a.x0)[0]; if (s) out.stake = parseFloat(s.t.replace(',', '.')); }
  const odds = ws.filter(w => isOdd(w) && w.x0 > W * 0.55 && !labels.some(l => sameLine(l, w))).sort((a, b) => yc(a) - yc(b));
  if (odds.length < 2) return out;
  const gaps = odds.slice(1).map((o, i) => yc(o) - yc(odds[i])).filter(g => g > 10).sort((a, b) => a - b);
  const gap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 120;
  const hdr = ws.find(w => /^(choices?|escolhas?|pick|aposta|selec)/i.test(w.t));
  odds.forEach(o => {
    const top = yc(o) - gap * 0.55, bot = yc(o) + gap * 0.55;
    const band = ws.filter(w => w !== o && yc(w) >= top && yc(w) <= bot);
    const choiceX = hdr ? hdr.x0 - 10 : W * 0.62;
    const cx = w => (w.x0 + w.x1) / 2;
    const choice = band.filter(w => cx(w) >= choiceX && w.x1 <= o.x0 + 2).sort((a, b) => a.x0 - b.x0).map(w => w.t).join(' ');
    const teamWords = band.filter(w => cx(w) < choiceX && w.x0 > W * 0.3 && /[A-Za-zÀ-ÿ]{2,}/.test(w.t) && !/\d{1,2}[-/:]\d{2}/.test(w.t));
    const lines = [];
    teamWords.sort((a, b) => yc(a) - yc(b) || a.x0 - b.x0).forEach(w => {
      const L = lines.find(l => sameLine(l[0], w));
      if (L) L.push(w); else lines.push([w]);
    });
    const names = lines.map(l => l.sort((a, b) => a.x0 - b.x0).map(w => w.t).join(' ').trim()).filter(n => n.length >= 3);
    const home = names[0] || '', away = names[1] || '';
    const ch = CHOICE_MAP(choice);
    const sel = ch === '1' ? `${home} (1)` : ch === '2' ? `${away} (2)` : ch === 'X' ? 'Empate (X)' : ch === '1X' ? `${home} ou empate (1X)` : ch === 'X2' ? `${away} ou empate (X2)` : ch === 'BTTS NO' ? 'Ambas marcam — Não' : ch === 'BTTS YES' ? 'Ambas marcam — Sim' : ch;
    if (home || ch) out.legs.push({ sel: sel || '', market: ch, home, away, odd: parseFloat(o.t.replace(',', '.')) });
  });
  return out;
}

/* ---------- OCR v3: normal → (texto branco) → (coordenadas) ---------- */
async function ocrFiles(files, status) {
  const slip = { legs: [], totalOdd: null, boost: 0, stake: null, declared: null, appProb: null, text: '' };
  const w = await getOcrWorker(m => {
    if (m.status === 'recognizing text') status(`A ler… ${Math.round(m.progress * 100)}%`);
    else if (/loading|initializ/.test(m.status)) status('A preparar o leitor (1.ª vez demora um pouco)…');
  });
  const good = s => s.legs.filter(l => Number(l.odd) > 1 && (l.home || l.sel)).length;
  for (let n = 0; n < files.length; n++) {
    status(`Imagem ${n + 1}/${files.length}…`);
    const canvas = await prepImage(files[n]);
    await w.setParameters({ tessedit_pageseg_mode: '6' });
    const { data } = await w.recognize(canvas);
    let one = parseAny(data.text);
    slip.text += '\n' + data.text;
    const wp = await prepImageWhite(files[n]);
    if (wp.dark || one.legs.some(l => !l.odd)) {
      status(`Imagem ${n + 1}: 2.ª leitura (odds)…`);
      const r2 = await w.recognize(wp.canvas);
      one = mergeTwoPass(one, parseSlip(r2.data.text));
    }
    const looksTable = /total odds|choices|values|win probability|matches/i.test(data.text) || one.legs.filter(l => !l.home || !l.away).length >= 2;
    if (looksTable || good(one) < 2) {
      status(`Imagem ${n + 1}: leitura por colunas…`);
      try {
        await w.setParameters({ tessedit_pageseg_mode: '11' });
        const r3 = await w.recognize(canvas, {}, { blocks: true, text: true });
        const geo = parseGeometric(ocrWords(r3.data), canvas.width);
        const full = s => s.legs.filter(l => Number(l.odd) > 1 && l.home && l.away).length;
        if (full(geo) > full(one) || (full(geo) === full(one) && good(geo) >= good(one) && good(geo) > 0)) { geo.declared = one.declared || geo.declared; one = geo; }   // v48: nunca trocar uma leitura com seleções por uma vazia
        else { one.totalOdd = one.totalOdd || geo.totalOdd; one.appProb = geo.appProb; }
      } catch (e) { console.warn(e); }
      await w.setParameters({ tessedit_pageseg_mode: '6' });
    }
    mergeSlip(slip, one);
    if (one.appProb && !slip.appProb) slip.appProb = one.appProb;
  }
  return slip;
}

/* ---------- «Se fosse parvo…» e melhores do dia (todos os prints) ---------- */
const POOL_KEY = 'ze_pool_v1';
function poolLoad() {
  const p = lsGet(POOL_KEY, { day: '', legs: [] });
  const today = isoDay(new Date());
  return p.day === today ? p : { day: today, legs: [] };
}
function poolAdd(evLegs) {
  const p = poolLoad();
  evLegs.forEach(l => {
    if (l.p == null || !(Number(l.odd) > 1)) return;
    const k = normTxt((l.home || '') + '|' + (l.away || '') + '|' + (l.market || l.sel));
    const ex = p.legs.find(x => x.k === k);
    const row = { k, home: l.home || (l.m && l.m.home) || '', away: l.away || (l.m && l.m.away) || '', sel: l.sel, market: l.market || '', odd: Number(l.odd), p: l.p, ev: l.p * l.odd - 1, src: l.src, sport: l.sport || '' };
    if (!ex) p.legs.push(row); else if (row.odd > ex.odd) Object.assign(ex, row); // fica a melhor odd vista
  });
  lsSet(POOL_KEY, p);
  return p;
}
/** Escolha consciente: alta probabilidade e preço justo (ou melhor) */
function parvoPicks(legs, max) {
  const cand = legs.filter(l => l.p != null && l.p >= 0.58 && (l.p * l.odd - 1) >= -0.03 && l.sport !== 'nba')
    .map(l => ({ ...l, ev: l.p * l.odd - 1, score: (l.p * l.odd - 1) + (l.p - 0.6) * 0.5 + (/modelo/.test(l.src || '') ? 0.03 : 0) }))
    .sort((a, b) => b.score - a.score);
  const used = new Set();
  return cand.filter(l => { const k = normTxt((l.home || '') + (l.away || '')); if (k && used.has(k)) return false; used.add(k); return true; }).slice(0, max || 3);
}
function parvoHTML(picks, intro) {
  if (!picks.length) return `🎯 <b>Se fosse parvo?</b> Nem assim. Nenhuma seleção junta probabilidade alta com preço justo. Fico a ver.`;
  const odd = picks.reduce((a, l) => a * l.odd, 1), P = picks.reduce((a, l) => a * l.p, 1), EV = P * odd - 1;
  const name = l => l.home && l.away ? `${esc(l.home)} vs ${esc(l.away)}` : '';
  return `🎯 <b>${intro || 'Se fosse parvo e quisesse mesmo arriscar'}</b>, ia só ${picks.length === 1 ? 'nesta' : 'nestas'}:<br>` +
    picks.map(l => `• <b>${esc(l.sel)}</b>${name(l) ? ` <span class="muted">(${name(l)})</span>` : ''} @ ${l.odd.toFixed(2)} — eu dou-lhe ${pct(l.p)}, ${l.ev >= 0.02 ? `<span class="ev-pos">valor +${(l.ev * 100).toFixed(0)}%</span>` : 'preço quase justo'}`).join('<br>') +
    (picks.length > 1 ? `<br>Juntas: odd ${odd.toFixed(2)} · acertas ${pct(P)} das vezes (1 em ${Math.max(1, Math.round(1 / P))}) · valor ${(EV * 100).toFixed(1)}%. ${EV >= 0 ? 'Isto já é aposta, não é lotaria.' : 'Mesmo assim a casa ganha um bocadinho — mas é o mal menor.'}` : '');
}
function zeMelhoresDoDia() {
  const p = poolLoad();
  if (!p.legs.length) return { mood: 'pensativo', html: 'Ainda não me mostraste nenhum boletim hoje. Manda prints (📸) — eu guardo todas as seleções e no fim digo-te quais valem a pena.' };
  const picks = parvoPicks(p.legs, 3);
  const worst = p.legs.filter(l => l.p != null).sort((a, b) => (a.p * a.odd) - (b.p * b.odd))[0];
  return {
    mood: picks.length ? 'feliz' : 'pensativo',
    html: `Vi <b>${p.legs.length}</b> seleções nos teus prints de hoje.<br>${parvoHTML(picks, 'De tudo o que me mostraste, se fosse parvo')}` +
      (worst ? `<br><br>🗑️ A pior de todas: <b>${esc(worst.sel)}</b> @ ${worst.odd.toFixed(2)} (eu dou ${pct(worst.p)}).` : '')
  };
}

/* ---------- Perfil do utilizador: nome + foto ---------- */
const USER_KEY = 'ze_user_v1';
function userProfile() { return lsGet(USER_KEY, { name: '', photo: '' }); }
function uname() { const n = (userProfile().name || '').trim(); return n || 'chefe'; }
function personalize(html) {
  const n = (userProfile().name || '').trim();
  if (!n || !html) return html;
  return String(html).replace(/\bchefe\b/g, esc(n)).replace(/\bchef\b/g, esc(n)).replace(/\bMister\b(?=[,.!?])/g, esc(n));
}
function humanFace(size, cls) {
  size = size || 48;
  const u = userProfile();
  if (u.photo) return `<img class="${cls || ''}" src="${u.photo}" alt="${esc(u.name || 'Tu')}" width="${size}" height="${size}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid #5aa9ff;flex-shrink:0;">`;
  const ini = (u.name || 'TU').trim().split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase() || 'TU';
  return `<svg class="${cls || ''}" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="${esc(u.name || 'Tu')}">
  <circle cx="60" cy="60" r="58" fill="#163a66"/>
  <circle cx="60" cy="60" r="58" fill="none" stroke="#5aa9ff" stroke-width="3" opacity=".6"/>
  <circle cx="60" cy="50" r="21" fill="#9fc3ee"/>
  <path d="M20 112 C24 86 42 78 60 78 C78 78 96 86 100 112 Z" fill="#9fc3ee"/>
  <text x="60" y="104" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="17" fill="#163a66">${esc(ini)}</text>
</svg>`;
}
function saveUserName() {
  const u = userProfile();
  u.name = (document.getElementById('cfgName').value || '').trim().slice(0, 24);
  lsSet(USER_KEY, u);
  renderBanca(); renderConfig();
  toast(u.name ? `👋 Olá, ${esc(u.name)}! O Zé já sabe o teu nome.` : 'Nome removido.');
}
function savePhoto(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const S = 160, c = document.createElement('canvas');
    c.width = c.height = S;
    const k = Math.max(S / img.width, S / img.height);
    const w = img.width * k, h = img.height * k;
    c.getContext('2d').drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
    const u = userProfile();
    u.photo = c.toDataURL('image/jpeg', 0.85);
    lsSet(USER_KEY, u);
    URL.revokeObjectURL(url);
    renderBanca(); renderConfig();
    toast('📸 Foto guardada.');
  };
  img.src = url;
}
function removePhoto() { const u = userProfile(); u.photo = ''; lsSet(USER_KEY, u); renderBanca(); renderConfig(); }

/* ---------- Avaliação de cada aposta tua (fica guardada) ---------- */
function evalUserBet(bet) {
  const legs = Array.isArray(bet.legs) && bet.legs.length ? bet.legs : [legFromBet(bet)].filter(Boolean);
  if (!legs.length) return null;
  let P = 1, known = 0;
  legs.forEach(l => {
    const e = legEval({ home: l.home, away: l.away, sel: l.sel || bet.pick, odd: l.odd || bet.odd, sport: l.sport });
    if (e.p != null) { P *= e.p; if (/modelo/.test(e.src)) known++; }
  });
  const EV = P * Number(bet.odd) - 1;
  const zeSame = loadBank().zeBets.some(z => z.match === bet.match && normTxt(z.pick) === normTxt(bet.pick));
  return { zeP: +P.toFixed(5), zeEV: +EV.toFixed(4), nlegs: legs.length, known, align: zeSame ? 'copiou' : EV >= -0.02 ? 'valor' : 'rebelde' };
}
function addBet(bet, who) {
  const b = loadBank();
  const stake = Number(bet.stake);
  if (!(stake > 0)) { alert('Indica o valor da aposta (€).'); return null; }
  if (who === 'you' && stake > b.you + 1e-9) {
    if (!confirm('Stake maior que a banca. Continuar na mesma?')) return null;
  }
  if (who === 'you' && bet.zeEV == null) { try { Object.assign(bet, evalUserBet(bet) || {}); } catch (e) {} }
  bet.id = Date.now() + Math.random().toString(36).slice(2, 6);
  bet.status = 'open';
  bet.who = who;
  bet.at = new Date().toISOString();
  if (who === 'you') { b.you = r2(b.you - stake); b.bets.unshift(bet); }
  else { b.ze = r2(b.ze - stake); b.zeBets.unshift(bet); }
  saveBank(b);
  return b;
}

/* ---------- O Zé analisa o teu comportamento ---------- */
function zeProfile() {
  const b = loadBank();
  const all = b.bets.filter(x => x.status !== 'cancel');
  const n = all.length;
  const closed = all.filter(x => x.status === 'win' || x.status === 'loss');
  const staked = closed.reduce((s, x) => s + Number(x.stake), 0);
  const ret = closed.filter(x => x.status === 'win').reduce((s, x) => s + x.stake * x.odd, 0);
  const roi = staked ? (ret - staked) / staked : null;
  const ze = b.zeBets.filter(x => x.status === 'win' || x.status === 'loss');
  const zeSt = ze.reduce((s, x) => s + Number(x.stake), 0), zeRet = ze.filter(x => x.status === 'win').reduce((s, x) => s + x.stake * x.odd, 0);
  const zeRoi = zeSt ? (zeRet - zeSt) / zeSt : null;
  const withEval = all.filter(x => x.align);
  const rebels = withEval.filter(x => x.align === 'rebelde'), followers = withEval.filter(x => x.align !== 'rebelde');
  const roiOfList = L => { const c = L.filter(x => x.status === 'win' || x.status === 'loss'); const s = c.reduce((a, x) => a + Number(x.stake), 0); const r = c.filter(x => x.status === 'win').reduce((a, x) => a + x.stake * x.odd, 0); return s ? (r - s) / s : null; };
  const avgOdd = n ? all.reduce((s, x) => s + Number(x.odd), 0) / n : 0;
  const legs = all.map(x => x.nlegs || (Array.isArray(x.legs) ? x.legs.length : 1));
  const avgLegs = n ? legs.reduce((s, x) => s + x, 0) / n : 0;
  const multis = legs.filter(x => x >= 3).length;
  const avgEV = withEval.length ? withEval.reduce((s, x) => s + (x.zeEV || 0), 0) / withEval.length : null;
  const winRate = closed.length ? closed.filter(x => x.status === 'win').length / closed.length : null;
  const rebelShare = withEval.length ? rebels.length / withEval.length : 0;
  let tipo, emoji;
  if (n < 3) { tipo = 'Ainda em observação'; emoji = '🔍'; }
  else if (avgLegs >= 4 || avgOdd >= 8) { tipo = 'Caçador de lotarias'; emoji = '🎰'; }
  else if (rebelShare >= 0.5 && (roiOfList(rebels) || -1) > 0) { tipo = 'Rebelde com causa'; emoji = '😎'; }
  else if (rebelShare >= 0.5) { tipo = 'Rebelde sem causa'; emoji = '🙃'; }
  else if (rebelShare <= 0.25) { tipo = 'Discípulo do Zé'; emoji = '🧑‍🎓'; }
  else { tipo = 'Meio-termo indeciso'; emoji = '🤷'; }
  return { n, closed: closed.length, roi, zeRoi, winRate, avgOdd, avgLegs, multis, avgEV, rebels: rebels.length, followers: followers.length, rebelRoi: roiOfList(rebels), followRoi: roiOfList(followers), tipo, emoji, rebelShare };
}
function zeProfileHTML() {
  const p = zeProfile();
  const nm = esc(uname());
  if (p.n === 0) return `🔍 ${nm}, ainda não fizeste nenhuma aposta. Não te consigo avaliar… mas a tua banca intacta é, até agora, a tua melhor decisão.`;
  const f = x => x == null ? '—' : (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%';
  const lines = [];
  lines.push(`${p.emoji} <b>Diagnóstico: ${p.tipo}</b>`);
  lines.push(`Apostas: ${p.n} (${p.closed} fechadas) · acertas ${p.winRate == null ? '—' : pct(p.winRate)} · odd média ${p.avgOdd.toFixed(2)} · ${p.avgLegs.toFixed(1)} seleções por boletim${p.multis ? ` · ${p.multis} múltiplas de 3+` : ''}.`);
  lines.push(`Lucro por euro apostado: <b>tu ${f(p.roi)}</b> vs <b>Zé ${f(p.zeRoi)}</b>.`);
  if (p.avgEV != null) lines.push(`Valor médio das tuas apostas, pelas minhas contas: <b>${f(p.avgEV)}</b> ${p.avgEV < -0.1 ? '— estás a pagar imposto à casa.' : p.avgEV >= 0 ? '— escolhes bem os preços.' : '— quase justo.'}`);
  if (p.rebels + p.followers) lines.push(`Contra a minha leitura: ${p.rebels} (lucro ${f(p.rebelRoi)}) · alinhadas comigo: ${p.followers} (lucro ${f(p.followRoi)}).`);
  let quip;
  switch (p.tipo) {
    case 'Caçador de lotarias': quip = `Tu não apostas, ${nm}, tu compras raspadinhas com nomes de equipas. Cada perna extra é mais uma taxa para a casa.`; break;
    case 'Rebelde com causa': quip = `Ignoras-me e… estás a ganhar. Irrita-me. Ou tens olho, ou tens sorte — daqui a 30 apostas eu digo-te qual.`; break;
    case 'Rebelde sem causa': quip = `Fazes o contrário do que eu digo e pagas por isso. É uma estratégia… só não é boa.`; break;
    case 'Discípulo do Zé': quip = `Segues-me quase sempre. Bom aluno. Agora falta só seres tão disciplinado na stake como eu.`; break;
    case 'Meio-termo indeciso': quip = `Umas vezes ouves-me, outras não. Escolhe um lado — de preferência o meu.`; break;
    default: quip = `Ainda estou a estudar-te. Mais umas apostas e faço o teu retrato completo.`;
  }
  if (p.roi != null && p.zeRoi != null) quip += p.zeRoi > p.roi ? ' E sim, estou à tua frente. 😏' : ' Por agora vais à frente. Aproveita.';
  lines.push(`<i>${quip}</i>`);
  return lines.join('<br>');
}

/* ---------- Sincronizar PC ↔ telemóvel (opcional, GitHub Gist) ---------- */
const SYNC_KEY = 'ze_sync_v1';
function buildBackup() {
  return { app: 'mister-ze', v: 18, at: new Date().toISOString(), bank: loadBank(), track: loadTrack(), inbox: lsGet(INBOX_KEY, null), live: lsGet(LIVE_KEY, null), user: userProfile(), pool: lsGet(POOL_KEY, null) };
}
function applyBackup(d) {
  if (!d || d.app !== 'mister-ze' || !d.bank) throw new Error('não é um backup do Mister Zé');
  saveBank(d.bank); if (d.track) saveTrack(d.track); if (d.inbox) lsSet(INBOX_KEY, d.inbox);
  if (d.user) lsSet(USER_KEY, d.user); if (d.pool) lsSet(POOL_KEY, d.pool);
  if (d.live) { lsSet(LIVE_KEY, d.live); applyLive(d.live); }
  renderBanca(); renderConfig();
}
function exportBackup() {
  const blob = new Blob([JSON.stringify(buildBackup(), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mister-ze-backup-${isoDay(new Date())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('💾 Backup descarregado.');
}
function importBackup(file) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      if (!confirm('Substituir os dados deste aparelho pelo backup de ' + new Date(d.at).toLocaleString('pt-PT') + '?')) return;
      applyBackup(d); toast('✅ Backup importado.');
    } catch (e) { alert('Não consegui importar: ' + e.message); }
  };
  fr.readAsText(file);
}
async function gh(path, opts) {
  const s = lsGet(SYNC_KEY, {});
  if (!s.token) throw new Error('falta o token do GitHub');
  const r = await fetch('https://api.github.com' + path, { ...(opts || {}), headers: { 'Authorization': 'Bearer ' + s.token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' } });
  if (!r.ok) throw new Error('GitHub HTTP ' + r.status + (r.status === 401 ? ' (token inválido)' : r.status === 404 ? ' (sem acesso a gists)' : ''));
  return r.json();
}
function syncSaveCfg() {
  const s = lsGet(SYNC_KEY, {});
  s.token = (document.getElementById('cfgGh').value || '').trim();
  lsSet(SYNC_KEY, s);
  toast('💾 Token guardado só neste aparelho.');
}
async function syncUp() {
  try {
    syncSaveCfg();
    setHTML('syncStatus', '⏳ A enviar…');
    const s = lsGet(SYNC_KEY, {});
    const body = { description: 'Mister Zé backup', public: false, files: { 'mister-ze.json': { content: JSON.stringify(buildBackup()) } } };
    const g = s.gist ? await gh('/gists/' + s.gist, { method: 'PATCH', body: JSON.stringify(body) }) : await gh('/gists', { method: 'POST', body: JSON.stringify(body) });
    s.gist = g.id; s.last = new Date().toISOString(); lsSet(SYNC_KEY, s);
    setHTML('syncStatus', `✅ Enviado (${new Date().toLocaleString('pt-PT')}). No outro aparelho cola o mesmo token e carrega «Receber».`);
  } catch (e) { setHTML('syncStatus', '❌ ' + esc(e.message)); }
}
async function syncDown() {
  try {
    syncSaveCfg();
    setHTML('syncStatus', '⏳ A receber…');
    const s = lsGet(SYNC_KEY, {});
    let id = s.gist;
    if (!id) { const list = await gh('/gists?per_page=100'); const f = list.find(g => g.description === 'Mister Zé backup'); if (!f) throw new Error('ainda não há backup na nuvem — envia primeiro do outro aparelho'); id = f.id; }
    const g = await gh('/gists/' + id);
    const file = g.files && g.files['mister-ze.json'];
    if (!file) throw new Error('backup não encontrado');
    let content = file.content;
    if (file.truncated && file.raw_url) content = await (await fetch(file.raw_url)).text();
    const d = JSON.parse(content);
    if (!confirm('Substituir os dados deste aparelho pelos da nuvem (' + new Date(d.at).toLocaleString('pt-PT') + ')?')) { setHTML('syncStatus', 'Cancelado.'); return; }
    applyBackup(d);
    s.gist = id; s.last = new Date().toISOString(); lsSet(SYNC_KEY, s);
    setHTML('syncStatus', `✅ Recebido. Dados de ${new Date(d.at).toLocaleString('pt-PT')}.`);
  } catch (e) { setHTML('syncStatus', '❌ ' + esc(e.message)); }
}

/* ---------- Definições: perfil + sync (render) ---------- */
function renderProfileCfg() {
  const u = userProfile();
  const el = document.getElementById('cfgName'); if (el && document.activeElement !== el) el.value = u.name || '';
  setHTML('cfgPhoto', humanFace(72));
  const s = lsGet(SYNC_KEY, {});
  const g = document.getElementById('cfgGh'); if (g && document.activeElement !== g) g.value = s.token || '';
  if (s.last) setHTML('syncStatus', `Última sincronização: ${new Date(s.last).toLocaleString('pt-PT')}`);
  setHTML('cfgProfileZe', zeProfileHTML());
}


/* ---------- Recibos de papel (Placard / Santa Casa) e formatos «Casa vs Fora» ---------- */
Object.assign(TEAM_ALIAS, {
  'veneza': 'venezia veneza', 'maiorca': 'mallorca maiorca', 'cadis': 'cadiz cadis', 'dinamo kiev': 'dynamo kyiv dinamo kiev', 'dinamo kyiv': 'dynamo kyiv',
  'copenhaga': 'copenhagen kobenhavn copenhaga', 'fc copenhaga': 'copenhagen kobenhavn copenhaga', 'sevilha': 'sevilla sevilha', 'corunha': 'deportivo coruna',
  'milao': 'milan', 'napoles': 'napoli', 'genova': 'genoa', 'turim': 'torino', 'florenca': 'fiorentina', 'marselha': 'marseille', 'colonia': 'koln',
  'estugarda': 'stuttgart', 'lazio': 'lazio', 'sonderjyske': 'sonderjyske sonderjyske', 'kryvbas kriviy rih': 'kryvbas', 'al nassr': 'nassr', 'al wasl': 'wasl'
});
const VS_RE = /^(?:\W*\d{1,4}\s*[|¦!il:]?\s*)?(.{2,}?)\s+v[sg5]\.?\s+(.{2,}?)\s*\|?\s*$/i;
function parseReceipt(text) {
  const out = { legs: [], totalOdd: null, boost: 0, stake: null, declared: null };
  const lines = String(text || '').split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  let league = '';
  lines.forEach((l, i) => {
    let mm;
    if ((mm = l.match(/c\w{0,2}binadas?\s*\((\d+)\)/i))) out.declared = +mm[1];
    if ((mm = l.match(/total de cotas\D{0,12}(\d+[.,]\d{2})/i))) out.totalOdd = parseFloat(mm[1].replace(',', '.'));
    if (/futebol|soccer|football/i.test(l) && /[|¦!]/.test(l)) { league = l.split(/[|¦!]/).map(x => x.trim()).filter(Boolean).pop() || ''; return; }
    const vs = l.match(VS_RE);
    if (!vs || /total|cotas/i.test(l)) return;
    const strip = x => cleanName(x).replace(/^(?:[a-zà-ÿ]{1,3}\s+|[A-Z]\s+(?=\d)|[^\sA-Za-zÀ-ÿ0-9]{1,3}\s+|\d{1,4}\s+)+/, '').trim();
    const home = strip(vs[1].replace(/^[^A-Za-zÀ-ÿ]*\d{1,4}\s*[|¦!il:]\s*/, '')), away = strip(vs[2]);
    if (home.length < 2 || away.length < 2) return;
    let sel = '', odd = '';
    for (let k = i + 1; k <= i + 3 && k < lines.length; k++) {
      const L = lines[k];
      if (VS_RE.test(L) || /futebol/i.test(L)) break;
      if (/^\W*1x2\b|^\W*tr\b|resultado|dupla|^\W*(mais|menos) de/i.test(L) && !oddFrom(L.replace(/[|]/g, ''))) continue;
      const L2 = L.replace(/[|]/g, ' ').replace(/(\s+[^\s\d]{1,3})+$/, '').trim();
      const o = oddFrom(L2);
      const name = cleanName(L2).replace(/\s+\d{1,2}$/, '');
      if (o) { odd = o; if (name && !/^1x2/i.test(name)) sel = name; break; }
      if (name && !sel && !/^1x2|^tr$/i.test(name)) sel = name;
    }
    out.legs.push({ sel: sel || '', market: '1X2', home, away, odd: odd || '', league });
  });
  return out;
}
/** Usa o leitor que extrair mais seleções completas */
function parseAny(text) {
  const a = parseSlip(text), b = parseReceipt(text);
  const score = s => s.legs.filter(l => Number(l.odd) > 1).length * 2 + s.legs.filter(l => l.home && l.away).length;
  const best = score(b) > score(a) ? b : a;
  best.totalOdd = best.totalOdd || a.totalOdd || b.totalOdd;
  best.declared = best.declared || a.declared || b.declared;
  best.boost = best.boost || a.boost || 0;
  return best;
}

/* ---------- Mais ligas na pesquisa online (em paralelo) ---------- */
Object.assign(ESPN_LEAGUES, {
  'esp.2': 'LaLiga 2', 'ita.2': 'Serie B', 'ger.2': '2. Bundesliga', 'ned.2': 'Eerste Divisie', 'ukr.1': 'Premier League UKR', 'fin.1': 'Veikkausliiga',
  'tur.1': 'Süper Lig', 'bel.1': 'Bélgica', 'sco.1': 'Escócia', 'ksa.1': 'Arábia Saudita', 'afc.champions': 'Liga dos Campeões AFC', 'alg.1': 'Argélia', 'uefa.europa.conf': 'Conference League'
});
async function fetchLeaguesParallel(codes, from, to, status) {
  const all = []; let ok = 0, lastErr = null;
  for (let i = 0; i < codes.length; i += 6) {
    const chunk = codes.slice(i, i + 6);
    status && status(`⏳ ${chunk.map(c => ESPN_LEAGUES[c]).join(', ')}…`);
    const res = await Promise.all(chunk.map(code => fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${ymd(from)}-${ymd(to)}&limit=300`).then(j => ({ code, j })).catch(e => { lastErr = e; return null; })));
    res.forEach(r => { if (!r) return; ok++; (r.j.events || []).forEach(ev => { const n = normalizeEspn(ev, r.code, ESPN_LEAGUES[r.code]); if (n) all.push(n); }); });
  }
  return { all, ok, lastErr };
}
async function atualizarTudo(opts) {
  opts = opts || {};
  const T = opts.quiet ? () => {} : toast;
  if (atualizarBusy) return;
  atualizarBusy = true;
  const st = t => setHTML('liveStatus', t);
  T('📡 A ir buscar jogos e resultados…');
  const now = new Date();
  const from = new Date(now.getTime() - 4 * 864e5), to = new Date(now.getTime() + 4 * 864e5);
  const standings = {};
  let all = [];
  try {
    const r = await fetchLeaguesParallel(Object.keys(ESPN_LEAGUES), from, to, st);
    all = r.all;
    const nbaNeeded = loadBank().bets.concat(loadBank().zeBets).some(x => x.status === 'open' && (x.legs || []).some(l => l.sport === 'nba'));
    if (nbaNeeded) {
      try { const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${ymd(from)}-${ymd(to)}&limit=300`); (j.events || []).forEach(ev => { const n = normalizeEspn(ev, 'nba', 'NBA'); if (n) all.push(n); }); } catch (e) {}
    }
    if (!r.ok) throw r.lastErr || new Error('sem resposta');
    const withGames = [...new Set(all.filter(x => x.status === 'TIMED').map(x => x.competition.code))].filter(c => c !== 'nba');
    for (let i = 0; i < withGames.length; i += 6) {
      const chunk = withGames.slice(i, i + 6);
      st(`⏳ Classificações (${i + chunk.length}/${withGames.length})…`);
      await Promise.all(chunk.map(code => fetchJSON(`https://site.api.espn.com/apis/v2/sports/soccer/${code}/standings`).then(j => { const s = espnStandings(j); if (s) standings[code] = s; }).catch(() => {})));
    }
  } catch (e) {
    atualizarBusy = false;
    st(`❌ Não consegui ligar (${esc(e && e.message || e)}). O Zé continua com o dossiê${lsGet(LIVE_KEY, null) ? ' e os últimos dados guardados' : ''}.`);
    T('❌ Sem ligação aos resultados.');
    return;
  }
  const payload = { generatedAt: new Date().toISOString(), source: 'espn', matches: all, standings };
  lsSet(LIVE_KEY, payload);
  const added = applyLive(payload);
  const rep = settleFromResults(payload);
  const fin = all.filter(x => x.status === 'FINISHED').length, up = all.filter(x => x.status === 'TIMED').length;
  st(`✅ ${up} jogos por jogar · ${fin} resultados · ${added} novos no radar · ${rep.length} apostas liquidadas · ${new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`);
  lsSet('ze_last_report', { at: payload.generatedAt, html: reportHTML(rep) });
  renderCalendar(); renderBanca(); renderConfig();
  if (rep.length) {
    if (document.getElementById('chatLog')) addChat('bot', reportHTML(rep), rep.some(r => r.who === 'ze' && r.result === 'win') ? 'gozao' : 'pensativo');
    T(`📊 ${rep.length} aposta${rep.length > 1 ? 's' : ''} liquidada${rep.length > 1 ? 's' : ''} automaticamente.`);
  } else {
    const open = loadBank().bets.concat(loadBank().zeBets).filter(x => x.status === 'open').length;
    T(open ? `✅ Atualizado. ${open} aposta${open > 1 ? 's' : ''} ainda à espera de resultado.` : '✅ Atualizado.');
  }
  atualizarBusy = false;
}

/* ---------- Todos os prints do dia: o veredicto ---------- */
function poolSlip(n, odd, P, EV) {
  const p = poolLoad();
  p.slips = p.slips || [];
  const k = n + '|' + odd.toFixed(2);
  if (!p.slips.some(s => s.k === k)) p.slips.push({ k, n, odd, P, EV });
  lsSet(POOL_KEY, p);
}
function parvoPicks(legs, max) {
  const scored = legs.filter(l => l.p != null && l.sport !== 'nba').map(l => ({ ...l, ev: l.p * l.odd - 1, score: (l.p * l.odd - 1) + (l.p - 0.6) * 0.5 + (/modelo/.test(l.src || '') ? 0.03 : 0) }));
  const dedupe = arr => { const used = new Set(); return arr.filter(l => { const k = normTxt((l.home || '') + (l.away || '') + l.sel); if (used.has(k)) return false; used.add(k); return true; }); };
  const good = dedupe(scored.filter(l => l.p >= 0.58 && l.ev >= -0.03).sort((a, b) => b.score - a.score)).slice(0, max || 3);
  if (good.length) return good;
  const lesser = dedupe(scored.filter(l => l.p >= 0.7).sort((a, b) => b.p - a.p)).slice(0, 2);
  lesser.forEach(l => { l.lesser = true; });
  return lesser;
}
function parvoHTML(picks, intro) {
  if (!picks.length) return `🎯 <b>Se fosse parvo?</b> Nem assim. Não há nada aqui com probabilidade alta. Estão loucos. 🙃`;
  const odd = picks.reduce((a, l) => a * l.odd, 1), P = picks.reduce((a, l) => a * l.p, 1), EV = P * odd - 1;
  const name = l => l.home && l.away ? `${esc(l.home)} vs ${esc(l.away)}` : '';
  const lesser = picks.every(l => l.lesser);
  return `🎯 <b>${intro || 'Se fosse parvo e quisesse mesmo arriscar'}</b>${lesser ? ' (nenhuma tem valor — isto é o <i>mal menor</i>)' : ''}, ia só ${picks.length === 1 ? 'nesta' : 'nestas'}:<br>` +
    picks.map(l => `• <b>${esc(l.sel)}</b>${name(l) ? ` <span class="muted">(${name(l)})</span>` : ''} @ ${l.odd.toFixed(2)} — eu dou-lhe ${pct(l.p)}, ${l.ev >= 0.02 ? `<span class="ev-pos">valor +${(l.ev * 100).toFixed(0)}%</span>` : l.ev >= -0.03 ? 'preço quase justo' : `paga ${(l.ev * 100).toFixed(0)}% de imposto`}${/modelo/.test(l.src || '') ? '' : ' <span class="muted">(sem dados próprios)</span>'}`).join('<br>') +
    (picks.length > 1 ? `<br>Juntas: odd ${odd.toFixed(2)} · acertas ${pct(P)} das vezes (1 em ${Math.max(1, Math.round(1 / P))}) · valor ${(EV * 100).toFixed(1)}%. ${EV >= 0 ? 'Isto já é aposta, não é lotaria.' : 'A casa continua a ganhar um bocadinho — mas é o que menos dói.'}` : '');
}
function zeMelhoresDoDia() {
  const p = poolLoad();
  if (!p.legs.length) return { mood: 'pensativo', html: `Ainda não me mostraste nenhum boletim hoje. Manda prints ou fotos dos recibos (📸) — eu guardo todas as seleções e no fim digo-te quais valem a pena.` };
  const legs = p.legs.filter(l => l.p != null);
  const withValue = legs.filter(l => l.p * l.odd - 1 >= 0.02);
  const modelled = legs.filter(l => /modelo/.test(l.src || '')).length;
  const picks = parvoPicks(p.legs, 3);
  const worst = legs.slice().sort((a, b) => (a.p * a.odd) - (b.p * b.odd))[0];
  const slips = p.slips || [];
  const allP = slips.length ? slips.reduce((a, s) => a * (s.P || 0), 1) : null;
  const avgEV = legs.length ? legs.reduce((s, l) => s + (l.p * l.odd - 1), 0) / legs.length : 0;
  let verdict;
  if (withValue.length >= 2) verdict = `Há aqui qualquer coisa. ${withValue.length} seleções com valor real — não são loucos, são só desarrumados.`;
  else if (withValue.length === 1) verdict = 'Uma agulha num palheiro: só uma seleção com valor. O resto é a casa a sorrir.';
  else if (avgEV < -0.06) verdict = `Veredicto: <b>estão loucos</b>. 🙃 Em média cada seleção paga ${(avgEV * 100).toFixed(0)}% de imposto à casa.`;
  else verdict = 'Nada de valor, mas também nada de escandaloso: são preços de mercado. Ganha a casa, devagarinho.';
  return {
    mood: withValue.length ? 'feliz' : 'gozao',
    html: `Hoje mostraste-me <b>${slips.length || '?'} boletins</b> com <b>${p.legs.length} seleções</b> (${modelled} com o meu modelo, o resto pela odd).<br>${verdict}<br><br>${parvoHTML(picks, 'De tudo isto, se fosse parvo')}` +
      (worst ? `<br><br>🗑️ A pior de todas: <b>${esc(worst.sel)}</b> @ ${worst.odd.toFixed(2)} (eu dou ${pct(worst.p)}).` : '') +
      (allP != null && slips.length > 1 ? `<br>🎰 Se jogasses todos os boletins, a hipótese de acertar <i>todos</i> era ${pct(allP)}.` : '')
  };
}


/* ---------- Fotos de recibos: normalizar iluminação + juntar leituras ---------- */
function prepImageReceipt(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(2.2, Math.max(1, 1400 / img.width));
      const W = Math.round(img.width * scale), H = Math.round(img.height * scale);
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H);
      const bgc = document.createElement('canvas'); bgc.width = W; bgc.height = H;
      const bctx = bgc.getContext('2d');
      bctx.filter = 'blur(25px)';
      bctx.drawImage(img, 0, 0, W, H);
      const b = bctx.getImageData(0, 0, W, H);
      for (let k = 0; k < d.data.length; k += 4) {
        const g = 0.299 * d.data[k] + 0.587 * d.data[k + 1] + 0.114 * d.data[k + 2];
        const bg = 0.299 * b.data[k] + 0.587 * b.data[k + 1] + 0.114 * b.data[k + 2] + 1;
        const v = (g / bg) * 255 < 200 ? 0 : 255;
        d.data[k] = d.data[k + 1] = d.data[k + 2] = v;
      }
      ctx.putImageData(d, 0, 0);
      URL.revokeObjectURL(url);
      res(c);
    };
    img.onerror = () => rej(new Error('imagem inválida'));
    img.src = url;
  });
}
function knownTeam(n) {
  const q = expandAliases(normTxt(n));
  if (!q || q.length < 3) return false;
  if (teamsMentioned(q).length) return true;
  const p = lsGet(LIVE_KEY, null);
  return !!(p && (p.matches || []).some(x => teamScore(x.homeTeam.shortName || x.homeTeam.name, q) > 0 || teamScore(x.awayTeam.shortName || x.awayTeam.name, q) > 0));
}
function nameQuality(n) {
  const t = String(n || '').split(/\s+/).filter(Boolean);
  if (!t.length) return 0;
  if (knownTeam(n)) return 2;
  const good = t.filter(x => /^[A-ZÀ-Ý][A-Za-zÀ-ÿ'.-]{2,}$/.test(x) || /^(FC|SC|CF|AC|IF|FK|CR|JS|HJK|VPS|Al|SL)$/.test(x)).length;
  return good / t.length + Math.min(0.2, n.length / 100);
}
/** Ajusta a seleção à equipa certa (OCR: «HUK» → HJK, «Majorca» → Maiorca) */
function snapSel(l) {
  if (!l || !l.home || !l.away || !l.sel) return l;
  if (/ambas|btts|both|mais de|menos de|over|under|\b1x\b|\bx2\b|or draw|ou empate|dupla|handicap|[+-]\d[.,]5/i.test(l.sel)) return l; // é um mercado, não um nome
  const s = String(l.sel).replace(/\d+[.,]\d{2}.*$/, '').trim();
  if (/^(x|empate|draw)$/i.test(s)) { l.sel = 'Empate'; return l; }
  const score = t => { const a = normTxt(s), b = normTxt(t); if (!a || !b) return 99; if (a.includes(b) || b.includes(a)) return 0; const d = nameHit(s, t); if (d != null) return d; const a1 = a.replace(/\s/g, ''), b1 = b.replace(/\s/g, ''); const d2 = lev(a1, b1); return d2 <= Math.max(1, Math.ceil(b1.length / 2)) ? d2 + 0.5 : 99; };
  const sh = score(l.home), sa = score(l.away);
  if (Math.min(sh, sa) < 99 && sh !== sa) l.sel = sh < sa ? l.home : l.away;
  return l;
}
function slipScore(s) { return s.legs.filter(l => Number(l.odd) > 1).length * 2 + s.legs.filter(l => l.home && l.away).length + s.legs.reduce((a, l) => a + nameQuality(l.home) + nameQuality(l.away), 0) * 0.5; }
function mergeFill(best, others) {
  best.legs.forEach(l => {
    const votes = {};
    if (Number(l.odd) > 1) votes[Number(l.odd).toFixed(2)] = 1.5;
    others.forEach(o => { const m = o.legs.find(x => (x.away && l.away && (nameHit(x.away, l.away) != null || normTxt(x.away) === normTxt(l.away)))); if (m && Number(m.odd) > 1) { const k = Number(m.odd).toFixed(2); votes[k] = (votes[k] || 0) + 1; } });
    const top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    if (top) l.odd = parseFloat(top[0]);
    if (Object.keys(votes).length > 1) l.oddDoubt = true;
    others.forEach(o => {
      const m = o.legs.find(x => (x.away && l.away && (nameHit(x.away, l.away) != null || normTxt(x.away) === normTxt(l.away))) || (x.home && l.home && nameHit(x.home, l.home) != null));
      if (!m) return;
      if (!(Number(l.odd) > 1) && Number(m.odd) > 1) l.odd = m.odd;
      if (nameQuality(m.home) > nameQuality(l.home) + 0.2) l.home = m.home;
      if (nameQuality(m.away) > nameQuality(l.away) + 0.2) l.away = m.away;
      if ((!l.sel || nameQuality(l.sel) < 0.5) && m.sel && nameQuality(m.sel) >= 0.5) l.sel = m.sel;
    });
    snapSel(l);
  });
  others.forEach(o => { best.totalOdd = best.totalOdd || o.totalOdd; best.declared = best.declared || o.declared; });
  return best;
}
async function ocrFiles(files, status) {
  const slip = { legs: [], totalOdd: null, boost: 0, stake: null, declared: null, appProb: null, text: '' };
  const w = await getOcrWorker(m => {
    if (m.status === 'recognizing text') status(`A ler… ${Math.round(m.progress * 100)}%`);
    else if (/loading|initializ/.test(m.status)) status('A preparar o leitor (1.ª vez demora um pouco)…');
  });
  const good = s => s.legs.filter(l => Number(l.odd) > 1 && (l.home || l.sel)).length;
  for (let n = 0; n < files.length; n++) {
    status(`Imagem ${n + 1}/${files.length}…`);
    const canvas = await prepImage(files[n]);
    await w.setParameters({ tessedit_pageseg_mode: '6' });
    const { data } = await w.recognize(canvas);
    let one = parseAny(data.text);
    slip.text += '\n' + data.text;
    const wp = await prepImageWhite(files[n]);
    if (wp.dark || one.legs.some(l => !l.odd)) {
      status(`Imagem ${n + 1}: 2.ª leitura (odds)…`);
      const r2 = await w.recognize(wp.canvas);
      one = mergeTwoPass(one, parseAny(r2.data.text));
    }
    if (/c\w{0,2}binadas|futebol|1x2|total de cotas| v[sg5] /i.test(data.text) || one.legs.some(l => !l.home || !l.away || nameQuality(l.home) < 0.5 || nameQuality(l.away) < 0.5)) {
      status(`Imagem ${n + 1}: recibo — leitura reforçada…`);
      try {
        const rc = await prepImageReceipt(files[n]);
        const ra = await w.recognize(rc);
        await w.setParameters({ tessedit_pageseg_mode: '4' });
        const rb = await w.recognize(rc);
        await w.setParameters({ tessedit_pageseg_mode: '6' });
        const cands = [one, parseAny(ra.data.text), parseAny(rb.data.text)];
        const best = cands.slice().sort((a, b) => slipScore(b) - slipScore(a))[0];
        one = mergeFill(best, cands.filter(c => c !== best));
      } catch (e) { console.warn(e); }
    }
    const looksTable = /total odds|choices|values|win probability|matches/i.test(data.text);
    if (looksTable || good(one) < 2) {
      status(`Imagem ${n + 1}: leitura por colunas…`);
      try {
        await w.setParameters({ tessedit_pageseg_mode: '11' });
        const r3 = await w.recognize(canvas, {}, { blocks: true, text: true });
        const geo = parseGeometric(ocrWords(r3.data), canvas.width);
        const full = s => s.legs.filter(l => Number(l.odd) > 1 && l.home && l.away).length;
        if (full(geo) > full(one) || (full(geo) === full(one) && good(geo) >= good(one) && good(geo) > 0)) { geo.declared = one.declared || geo.declared; one = geo; }   // v48: nunca trocar uma leitura com seleções por uma vazia
        else { one.totalOdd = one.totalOdd || geo.totalOdd; one.appProb = geo.appProb; }
      } catch (e) { console.warn(e); }
      await w.setParameters({ tessedit_pageseg_mode: '6' });
    }
    one.legs.forEach(snapSel);
    mergeSlip(slip, one);
    if (one.appProb && !slip.appProb) slip.appProb = one.appProb;
  }
  slip.source = detectSource(slip.text);
  return slip;
}


/* ---------- Escudos originais: cores do clube + sigla (não são os emblemas oficiais) ---------- */
const META_KEY = 'ze_team_meta_v1';
const BASE_COLORS = {
  'benfica': ['#d1102b', '#ffffff', 'BEN'], 'porto': ['#0b3d91', '#ffffff', 'POR'], 'sporting': ['#007a3d', '#ffffff', 'SCP'],
  'braga': ['#c8102e', '#ffffff', 'BRA'], 'vitoria': ['#ffffff', '#111111', 'VSC'], 'estoril': ['#f5c400', '#0b3d91', 'EST'],
  'santa clara': ['#c8102e', '#ffffff', 'SCL'], 'gil vicente': ['#c8102e', '#0b3d91', 'GIL'], 'famalicao': ['#0b3d91', '#ffffff', 'FAM'],
  'inter': ['#0a2d6e', '#111111', 'INT'], 'milan': ['#c8102e', '#111111', 'MIL'], 'juventus': ['#111111', '#ffffff', 'JUV'],
  'napoli': ['#12a0d7', '#ffffff', 'NAP'], 'atalanta': ['#1d4e9e', '#111111', 'ATA'], 'lazio': ['#87ceeb', '#ffffff', 'LAZ'], 'roma': ['#8e1f2f', '#f0bc42', 'ROM'],
  'genoa': ['#c8102e', '#0a2d6e', 'GEN'], 'real madrid': ['#ffffff', '#3c2a7a', 'RMA'], 'barcelona': ['#a50044', '#004d98', 'BAR'],
  'atletico': ['#c8102e', '#ffffff', 'ATM'], 'espanyol': ['#0a62ae', '#ffffff', 'ESP'], 'bayern': ['#dc052d', '#ffffff', 'BAY'], 'dortmund': ['#fde100', '#111111', 'BVB'],
  'leverkusen': ['#e32221', '#111111', 'B04'], 'man city': ['#6cabdd', '#ffffff', 'MCI'], 'manchester city': ['#6cabdd', '#ffffff', 'MCI'],
  'man united': ['#da291c', '#111111', 'MUN'], 'manchester united': ['#da291c', '#111111', 'MUN'], 'liverpool': ['#c8102e', '#ffffff', 'LIV'],
  'arsenal': ['#ef0107', '#ffffff', 'ARS'], 'chelsea': ['#034694', '#ffffff', 'CHE'], 'newcastle': ['#111111', '#ffffff', 'NEW'], 'everton': ['#003399', '#ffffff', 'EVE'],
  'sunderland': ['#eb172b', '#ffffff', 'SUN'], 'southampton': ['#d71920', '#ffffff', 'SOU'], 'middlesbrough': ['#e11b22', '#ffffff', 'MID'],
  'twente': ['#e30613', '#ffffff', 'TWE'], 'ajax': ['#d2122e', '#ffffff', 'AJA'], 'psv': ['#ed1c24', '#ffffff', 'PSV'], 'feyenoord': ['#e30613', '#111111', 'FEY'],
  'palermo': ['#f4a7c0', '#111111', 'PAL'], 'verona': ['#f5c400', '#0b3d91', 'VER'], 'heidenheim': ['#e30613', '#0b3d91', 'HDH'], 'almeria': ['#e30613', '#ffffff', 'ALM']
};
const KIT = {
  'porto': 'stripes', 'sporting': 'hoops', 'juventus': 'stripes', 'inter': 'stripes', 'milan': 'stripes', 'atalanta': 'stripes',
  'newcastle': 'stripes', 'sunderland': 'stripes', 'southampton': 'stripes', 'barcelona': 'stripes', 'atletico': 'stripes',
  'espanyol': 'stripes', 'psv': 'stripes', 'almeria': 'stripes', 'genoa': 'half', 'feyenoord': 'half', 'ajax': 'band'
};
function teamMeta() { return lsGet(META_KEY, {}); }
function rememberTeams(payload) {
  const meta = teamMeta(); let ch = false;
  (payload.matches || []).forEach(x => [x.homeTeam, x.awayTeam].forEach(t => {
    if (!t || !t.color) return;
    const k = normTxt(t.shortName || t.name);
    if (!meta[k]) { meta[k] = { c: '#' + t.color.replace('#', ''), a: '#' + String(t.alt || 'ffffff').replace('#', ''), ab: t.abbr || '' }; ch = true; }
    const k2 = normTxt(t.name); if (k2 !== k && !meta[k2]) { meta[k2] = meta[k]; ch = true; }
  }));
  if (ch) lsSet(META_KEY, meta);
}
function hashColor(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 55% 42%)`; }
function lightness(hex) { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 0.4; const n = parseInt(m[1], 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }
function teamColors(name) {
  const k = normTxt(name).replace(/\./g, '');
  const meta = teamMeta();
  if (meta[k]) return meta[k];
  const hit = Object.keys(meta).find(x => x.length >= 4 && (k.includes(x) || x.includes(k)));
  if (hit) return meta[hit];
  const base = Object.keys(BASE_COLORS).sort((a, b) => b.length - a.length).find(x => (' ' + k + ' ').includes(' ' + x + ' ') || k === x);
  if (base) { const [c, a, ab] = BASE_COLORS[base]; return { c, a, ab, kit: KIT[base] || '' }; }
  return { c: hashColor(k), a: '#ffffff', ab: '' };
}
function teamAbbr(name, meta) {
  if (meta && meta.ab) return meta.ab.slice(0, 3).toUpperCase();
  const words = String(name).replace(/[^A-Za-zÀ-ÿ0-9 ]/g, ' ').split(/\s+/).filter(w => w && !/^(fc|sc|cf|ac|sl|cd|ud|fk|if|al|de|da|do|the)$/i.test(w));
  if (!words.length) return '?';
  return (words.length === 1 ? words[0].slice(0, 3) : words.slice(0, 3).map(w => w[0]).join('')).toUpperCase();
}
let badgeSeq = 0;
/** Escudo genérico (desenho próprio) com as cores e a sigla da equipa */
function teamBadge(name, size) {
  size = size || 20;
  const m = teamColors(name);
  const c1 = m.c, c2 = m.a && m.a.toLowerCase() !== m.c.toLowerCase() ? m.a : (lightness(m.c) > 0.6 ? '#111111' : '#ffffff');
  const txt = lightness(c1) > 0.62 ? '#111111' : '#ffffff';
  const ab = teamAbbr(name, m);
  const id = 'tb' + (++badgeSeq);
  return `<svg class="tbadge" width="${size}" height="${Math.round(size * 1.15)}" viewBox="0 0 40 46" role="img" aria-label="${esc(name)}"><defs><clipPath id="${id}"><path d="M20 1 L38 6 V22 C38 34 30 41 20 45 C10 41 2 34 2 22 V6 Z"/></clipPath></defs><g clip-path="url(#${id})"><rect width="40" height="46" fill="${c1}"/>${kitSVG(m.kit, c2)}</g><path d="M20 1 L38 6 V22 C38 34 30 41 20 45 C10 41 2 34 2 22 V6 Z" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.6"/>${m.kit ? '<rect x="5" y="14" width="30" height="15" rx="3" fill="rgba(0,0,0,.55)"/>' : ''}<text x="20" y="${ab.length > 2 ? 24 : 25}" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="${ab.length > 2 ? 13 : 15}" fill="${m.kit ? '#ffffff' : txt}" stroke="${txt === '#ffffff' ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.35)'}" stroke-width=".6">${esc(ab)}</text></svg>`;
}
/** Padrão do equipamento (riscas, faixas, metades) — desenho genérico */
function kitSVG(kit, c2) {
  if (kit === 'stripes') return [5, 17, 29].map(x => `<rect x="${x}" y="0" width="6" height="46" fill="${c2}" opacity=".95"/>`).join('');
  if (kit === 'hoops') return [8, 22, 36].map(y => `<rect x="0" y="${y}" width="40" height="6" fill="${c2}" opacity=".95"/>`).join('');
  if (kit === 'half') return `<rect x="20" y="0" width="20" height="46" fill="${c2}"/>`;
  if (kit === 'band') return `<rect x="14" y="0" width="12" height="46" fill="${c2}"/>`;
  return `<path d="M0 34 L40 22 V46 H0 Z" fill="${c2}" opacity=".9"/>`;
}
function vsHTML(home, away, size) { return `${teamBadge(home, size)} ${esc(home)} <span class="muted">vs</span> ${esc(away)} ${teamBadge(away, size)}`; }
function decorateScout() {
  document.querySelectorAll('.card .club-name').forEach(el => {
    if (el.dataset.badged) return;
    const name = el.textContent.replace(/^\s*\d+\.\s*/, '').replace(/[^\p{L}\p{N} .'-]/gu, '').trim();
    el.insertAdjacentHTML('afterbegin', teamBadge(name, 24) + ' ');
    el.dataset.badged = '1';
  });
}

/* =====================================================================
   v20 · Comparar boletins: mesma aposta em várias fontes, melhor odd,
   preço de consenso, «melhores do dia» com razões
   ===================================================================== */
function detectSource(t) {
  t = String(t || '');
  if (/betan[a-z]/i.test(t) || (/partilhar boletim de aposta/i.test(t) && /resultado final/i.test(t)) || (/ganhos potenciais/i.test(t) && /valor da aposta|cash ?out/i.test(t))) return 'Betano';
  if (/betclic/i.test(t)) return 'Betclic';
  if (/solverde/i.test(t)) return 'Solverde';
  if (/c\w{0,2}binadas|total de cotas|santa casa|placard|1x2 tr/i.test(t)) return 'Placard';
  if (/tips history|special vip|elite vip|tips/i.test(t)) return 'App de tips';
  if (/single bet|bet now|coupon value|potential win/i.test(t)) return 'App Single Bet';
  return 'Boletim';
}
function teamKey(name) {
  const t = teamTokens(name).filter(x => !TEAM_GENERIC.has(x) && !/^\d+$/.test(x));
  if (!t.length) return normTxt(name).replace(/\s/g, '');
  return t.sort((a, b) => b.length - a.length)[0];
}
/** Código canónico do mercado: 1, X, 2, 1X, X2, BTTS, BTTS_N, O2.5, U2.5… */
function legCode(l) {
  const s = normTxt((l.sel || '') + ' ' + (l.market && !/resultado|1x2/i.test(l.market) ? l.market : ''));
  if (/ambas|btts|both/.test(s)) return /\b(nao|no)\b/.test(s) ? 'BTTS_N' : 'BTTS';
  let mm = s.match(/(mais de|over|\+)\s*(\d+)[.,]5/); if (mm) return 'O' + mm[2] + '.5';
  mm = s.match(/(menos de|under)\s*(\d+)[.,]5/); if (mm) return 'U' + mm[2] + '.5';
  const m = { home: l.home || '', away: l.away || '' };
  const hs = m.home && teamScore(m.home, s) > 0, as = m.away && teamScore(m.away, s) > 0;
  if (/\b1x\b|or draw|ou empate/.test(s)) return as && !hs ? 'X2' : '1X';
  if (/\bx2\b/.test(s)) return 'X2';
  if (/\b12\b/.test(s) && /dupla|double/.test(s)) return '12';
  if (/^x$|\bempate\b|\bdraw\b/.test(s)) return 'X';
  if (/^1$|\(1\)/.test(s) || (hs && !as)) return '1';
  if (/^2$|\(2\)/.test(s) || (as && !hs)) return '2';
  return null;
}
function canonKey(l) {
  const code = legCode(l);
  if (!code || !l.home || !l.away) return null;
  return teamKey(l.home) + '|' + teamKey(l.away) + '|' + code;
}
function poolLoad() {
  const p = lsGet(POOL_KEY, { day: '', legs: [], slips: [] });
  const today = isoDay(new Date());
  if (p.day !== today || !Array.isArray(p.legs)) return { day: today, legs: [], slips: [] };
  // migrar seleções guardadas por versões anteriores (sem lista de odds por fonte)
  p.legs = p.legs.filter(e => e && Number(e.odd) > 1 || (e && Array.isArray(e.occ) && e.occ.length)).map(e => {
    if (!Array.isArray(e.occ) || !e.occ.length) e.occ = [{ odd: Number(e.odd), source: 'Boletim' }];
    if (e.pModel === undefined) e.pModel = /modelo/.test(e.src || '') ? e.p : null;
    if (!e.code) e.code = null;
    return e;
  });
  p.slips = Array.isArray(p.slips) ? p.slips : [];
  return p;
}
/** Guarda cada seleção com todas as odds vistas (por fonte) */
function poolAdd(evLegs, source) {
  const p = poolLoad();
  evLegs.forEach(l => {
    if (!(Number(l.odd) > 1)) return;
    const home = l.home || (l.m && l.m.home) || '', away = l.away || (l.m && l.m.away) || '';
    const k = canonKey({ ...l, home, away }) || ('t|' + normTxt(l.sel) + '|' + Number(l.odd).toFixed(2));
    let e = p.legs.find(x => x.k === k);
    if (!e) { e = { k, home, away, sel: l.sel, code: legCode({ ...l, home, away }), occ: [], pModel: null, src: '', sport: l.sport || '' }; p.legs.push(e); }
    const o = { odd: Number(l.odd), source: source || 'Boletim' };
    if (!e.occ.some(x => x.source === o.source && Math.abs(x.odd - o.odd) < 0.005)) e.occ.push(o);
    if (/modelo/.test(l.src || '') && l.p != null) { e.pModel = l.p; e.src = l.src; }
  });
  p.legs.forEach(poolScore);
  lsSet(POOL_KEY, p);
  return p;
}
/** Probabilidade: modelo do Zé > consenso das fontes > odd sem margem */
const TIP_SOURCES = new Set(['App de tips', 'App Single Bet']);
function poolScore(e) {
  if (!Array.isArray(e.occ) || !e.occ.length) e.occ = [{ odd: Number(e.odd) || 1.01, source: 'Boletim' }];
  const odds = e.occ.map(x => x.odd);
  const real = e.occ.filter(x => !TIP_SOURCES.has(x.source));
  const bestOcc = (real.length ? real : e.occ).slice().sort((a, b) => b.odd - a.odd)[0];
  e.odd = bestOcc.odd;
  e.best = bestOcc.source;
  e.tipOnly = !real.length;
  e.sources = [...new Set(e.occ.map(x => x.source))];
  const others = e.occ.filter(x => x !== bestOcc);
  if (e.pModel != null) { e.p = e.pModel; e.src = e.src || 'modelo'; }
  else if (others.length) { const mg = src => src === 'Placard' ? 1.10 : src === 'App de tips' ? 1.07 : 1.05; e.p = others.reduce((s, x) => s + (1 / x.odd) / mg(x.source), 0) / others.length; e.src = `comparação de ${others.length + 1} preços`; }
  else { e.p = (1 / e.odd) / 1.055; e.src = 'odd sem margem'; }
  e.spread = odds.length > 1 ? (Math.max(...odds) / Math.min(...odds) - 1) : 0;
  return e;
}
function lineShopLines(evLegs) {
  const p = poolLoad(), out = [];
  evLegs.forEach(l => {
    const home = l.home || (l.m && l.m.home) || '', away = l.away || (l.m && l.m.away) || '';
    const k = canonKey({ ...l, home, away });
    const e = k && p.legs.find(x => x.k === k);
    if (!e || e.occ.length < 2) return;
    const better = e.occ.filter(x => x.odd > Number(l.odd) + 0.004 && !TIP_SOURCES.has(x.source)).sort((a, b) => b.odd - a.odd)[0];
    if (better) out.push(`💡 <b>${esc(l.sel)}</b>: já vi a <b>${better.odd.toFixed(2)}</b> (${esc(better.source)}) — aqui está a ${Number(l.odd).toFixed(2)}. Joga onde paga mais: +${((better.odd - 1) / (Number(l.odd) - 1) * 100 - 100).toFixed(0)}% de lucro pelo mesmo risco.`);
    else if (e.sources.length >= 2) out.push(`🔁 <b>${esc(l.sel)}</b> aparece em ${e.sources.length} fontes (${e.sources.map(esc).join(', ')}) — e esta é a melhor odd.`);
  });
  return out;
}
function zeMelhoresDoDia() {
  const p = poolLoad();
  if (!p.legs.length) return { mood: 'pensativo', html: `Ainda não me mostraste nenhum boletim hoje. Manda prints ou fotos dos recibos (📸) — eu junto tudo, comparo odds entre casas e no fim digo-te o que vale a pena.` };
  p.legs.forEach(poolScore);
  const legs = p.legs.filter(l => l.p != null);
  const ev = l => l.p * l.odd - 1;
  const value = legs.filter(l => ev(l) >= 0.02).sort((a, b) => ev(b) - ev(a));
  const multi = legs.filter(l => l.sources.length >= 2).sort((a, b) => b.sources.length - a.sources.length || b.spread - a.spread);
  const picks = parvoPicks(legs, 3);
  const srcs = [...new Set(legs.flatMap(l => l.sources))];
  const avgEV = legs.length ? legs.reduce((s, l) => s + ev(l), 0) / legs.length : 0;
  const slips = p.slips || [];
  const allP = slips.length > 1 ? slips.reduce((a, s) => a * (s.P || 0), 1) : null;
  const nm = l => l.home && l.away ? ` <span class="muted">(${esc(l.home)} vs ${esc(l.away)})</span>` : '';
  let html = `Hoje vi <b>${slips.length || '?'} boletins</b> de ${srcs.length} fonte${srcs.length > 1 ? 's' : ''} (${srcs.map(esc).join(', ')}) — <b>${legs.length} seleções diferentes</b>, ${legs.filter(l => /modelo/.test(l.src)).length} com o meu modelo.`;
  if (value.length) html += `<br><br>🏆 <b>Com valor real</b> (paga mais do que vale):<br>` + value.slice(0, 4).map(l => `• <b>${esc(l.sel)}</b>${nm(l)} @ <b>${l.odd.toFixed(2)}</b> ${l.tipOnly ? `<span class="muted">(odd da ${esc(l.best)} — confirma numa casa real)</span>` : `na ${esc(l.best)}`} — dou-lhe ${pct(l.p)} (${esc(l.src)}), valor <span class="ev-pos">+${(ev(l) * 100).toFixed(0)}%</span>`).join('<br>');
  if (multi.length) html += `<br><br>🔁 <b>Repetidas em várias fontes</b>:<br>` + multi.slice(0, 4).map(l => `• <b>${esc(l.sel)}</b>${nm(l)} — ${l.occ.map(o => `${o.odd.toFixed(2)} ${esc(o.source)}`).join(' · ')}${l.tipOnly ? ' <span class="muted">(só em apps de tips — confirma a odd numa casa real)</span>' : l.occ.length > 1 && l.occ.some(o => o.odd < l.odd - 0.004 && !TIP_SOURCES.has(o.source)) ? ` → <b>joga na ${esc(l.best)}</b>` : ''}`).join('<br>') + `<br><span class="muted">Repetida não quer dizer certa — quer dizer que toda a gente vê o mesmo, e a odd já o sabe.</span>`;
  html += `<br><br>${parvoHTML(picks.map(l => ({ ...l, sel: l.sel + (l.best ? ` [${l.best}]` : '') })), 'De tudo isto, se fosse parvo')}`;
  let verdict;
  if (value.length >= 2) verdict = `Veredicto: <b>não estão loucos</b>, estão desarrumados. Há ${value.length} apostas com valor — o resto deita fora.`;
  else if (value.length === 1) verdict = 'Veredicto: uma agulha num palheiro. Uma aposta boa, o resto é a casa a sorrir.';
  else if (avgEV < -0.06) verdict = `Veredicto: <b>estão loucos</b>. 🙃 Em média cada seleção paga ${(Math.abs(avgEV) * 100).toFixed(0)}% de imposto à casa.`;
  else verdict = 'Veredicto: nada de valor, mas nada de escandaloso. São preços de mercado — ganha a casa, devagarinho.';
  html += `<br><br>${verdict}`;
  if (allP != null) html += `<br>🎰 Se jogasses todos os boletins, a hipótese de acertar <i>todos</i> era ${allP < 1e-4 ? 'menos de 0,01% — mais fácil acertar no Euromilhões do que nisto' : pct(allP)}.`;
  return { mood: value.length ? 'feliz' : 'gozao', html };
}
function zeTopForDuel() {
  const p = poolLoad();
  p.legs.forEach(poolScore);
  return p.legs.filter(l => l.p != null && l.p * l.odd - 1 >= 0.03 && l.sport !== 'nba').sort((a, b) => (b.p * b.odd) - (a.p * a.odd))[0] || null;
}


/* =====================================================================
   v21 · Vários boletins de uma vez + «O boletim do Zé» (3 versões)
   ===================================================================== */
const MARKET_SEL_RE = /ambas|btts|mais de|menos de|over|under|empate|draw|\b1x\b|\bx2\b/i;
function legReadable(l) {
  if (!(Number(l.odd) > 1) || !l.sel || l.sel.length < 3) return false;
  const teamsOk = !l.home || !l.away || ((nameQuality(l.home) >= 0.5 || knownTeam(l.home)) && (nameQuality(l.away) >= 0.5 || knownTeam(l.away)));
  if (!teamsOk) return false;
  if (MARKET_SEL_RE.test(l.sel) || /or draw|ou empate|wins|vence|ganha/i.test(l.sel)) return true;
  return knownTeam(l.sel) || (l.home && normTxt(l.sel) === normTxt(l.home)) || (l.away && normTxt(l.sel) === normTxt(l.away));
}
/** Lê cada imagem à parte e junta só as que continuam o mesmo boletim */
async function ocrBatch(files, status) {
  const groups = [];
  for (let i = 0; i < files.length; i++) {
    status(`📸 Imagem ${i + 1} de ${files.length}…`);
    const s = await ocrFiles([files[i]], t => status(`📸 ${i + 1}/${files.length}: ${t}`));
    const prev = groups[groups.length - 1];
    const cont = prev && !s.declared && !s.totalOdd && prev.declared && prev.declared > prev.legs.length && (s.source === prev.source || s.source === 'Boletim');
    if (cont) { mergeSlip(prev, s); prev.text += s.text; prev.nImgs++; }
    else { s.nImgs = 1; groups.push(s); }
  }
  groups.forEach(g => { g.legs.forEach(snapSel); g.legs = g.legs.filter(l => (l.sel || l.home) && Number(l.odd) > 1 || l.home); });
  return groups;
}
function slipLine(g, i, c) {
  const legs = g.legs.filter(l => Number(l.odd) > 1);
  const bad = g.legs.filter(l => !legReadable(l)).length;
  const face = c.EV >= 0.02 ? '💚' : c.EV > -0.08 ? '😐' : legs.length >= 5 ? '🎰' : '💸';
  return `${face} <b>Boletim ${i + 1}</b> <span class="muted">(${esc(g.source || 'Boletim')}${g.nImgs > 1 ? `, ${g.nImgs} prints` : ''})</span>: ${legs.length} sel. · odd ${Number(c.payout || 0).toFixed(2)} · ganhas 1 em ${c.P > 0 ? Math.max(1, Math.round(1 / c.P)).toLocaleString('pt-PT') : '∞'} · valor <b class="${c.EV >= 0 ? 'ev-pos' : 'ev-neg'}">${(c.EV * 100).toFixed(0)}%</b>${bad ? ` · <span style="color:var(--yellow)">${bad} ilegíve${bad > 1 ? 'is' : 'l'}</span>` : ''}`;
}
/** Escolhe seleções do pool do dia e monta 3 propostas */
function zeProposals() {
  const p = poolLoad();
  p.legs.forEach(poolScore);
  const cand = p.legs.filter(l => l.p != null && l.sport !== 'nba' && legReadable(l))
    .map(l => ({ ...l, ev: l.p * l.odd - 1, mk: normTxt((l.home || l.sel) + '|' + (l.away || '')) }));
  const bank = loadBank().you;
  const diff = arr => { const u = new Set(); return arr.filter(l => { if (u.has(l.mk)) return false; u.add(l.mk); return true; }); };
  // 🧠 Gerir: simples com valor
  const singles = diff(cand.filter(l => l.ev >= 0.02 && l.p >= 0.4).sort((a, b) => b.ev - a.ev)).slice(0, 3)
    .map(l => ({ ...l, stake: Math.max(0.1, r2(bank * Math.min(0.05, ((l.p * l.odd - 1) / (l.odd - 1)) * 0.25))) }));
  // 🎯 Dupla sensata: melhor par (prob ≥ 40%)
  let dupla = null;
  const pool2 = cand.filter(l => l.p >= 0.6 && l.ev >= -0.065).sort((a, b) => b.ev - a.ev).slice(0, 12);
  for (let i = 0; i < pool2.length; i++) for (let j = i + 1; j < pool2.length; j++) {
    if (pool2[i].mk === pool2[j].mk) continue;
    const P = pool2[i].p * pool2[j].p, O = pool2[i].odd * pool2[j].odd, EV = P * O - 1;
    if (P >= 0.4 && (!dupla || EV > dupla.EV)) dupla = { legs: [pool2[i], pool2[j]], P, O, EV };
  }
  // 🎰 Loucura controlada: 4–5 pernas, as menos más
  const pool3 = diff(cand.filter(l => l.p >= 0.55 && l.ev >= -0.06).sort((a, b) => (b.ev + (b.p - 0.6) * 0.3) - (a.ev + (a.p - 0.6) * 0.3)));
  let louca = null;
  if (pool3.length >= 4) {
    const legs = pool3.slice(0, Math.min(5, pool3.length));
    const P = legs.reduce((a, l) => a * l.p, 1), O = legs.reduce((a, l) => a * l.odd, 1);
    louca = { legs, P, O, EV: P * O - 1 };
  }
  return { singles, dupla, louca, n: cand.length, total: p.legs.length };
}
function legLi(l) {
  const where = l.tipOnly ? `<span class="muted">odd da ${esc(l.best)} — confirma numa casa real</span>` : `na <b>${esc(l.best || 'casa')}</b>`;
  return `<b>${esc(l.sel)}</b>${l.home && l.away ? ` <span class="muted">— ${esc(l.home)} vs ${esc(l.away)}</span>` : ''} @ <b>${l.odd.toFixed(2)}</b> ${where} · ${pct(l.p)} ${l.ev >= 0.02 ? `<span class="ev-pos">+${(l.ev * 100).toFixed(0)}%</span>` : `<span class="muted">${(l.ev * 100).toFixed(0)}%</span>`}`;
}
function proposalsHTML() {
  const pr = zeProposals();
  window._zeProps = pr;
  let h = `<div style="margin-top:6px;font-family:var(--cond);font-size:1.15rem;font-weight:800;text-transform:uppercase;">🧾 O boletim do Zé</div>`;
  h += `<div class="muted" style="font-size:.8rem;margin-bottom:6px;">Escolhido de ${pr.total} seleções que me mostraste hoje (${pr.n} legíveis e com preço).</div>`;
  h += `<div class="zbox"><b>🧠 Gerir com cabeça</b> — apostas simples, só onde há valor:<br>` + (pr.singles.length
    ? pr.singles.map((l, i) => `${i + 1}. ${legLi(l)} → <b>${l.stake.toFixed(2)} €</b>`).join('<br>') + `<div style="margin-top:6px;"><button class="btn btn-sm btn-primary" onclick="zeRegistarProposta('singles')">📥 Registar estas simples</button> <button class="btn btn-sm" onclick="zeApostaProposta('singles')">🤖 O Zé também vai</button></div>`
    : `Nenhuma. Hoje nada paga mais do que vale — gerir bem é <b>não jogar</b>.`) + `</div>`;
  if (pr.dupla) {
    const d = pr.dupla;
    h += `<div class="zbox"><b>🎯 Dupla sensata</b> — se queres combinar, combina pouco:<br>${d.legs.map((l, i) => `${i + 1}. ${legLi(l)}`).join('<br>')}<br>Odd <b>${d.O.toFixed(2)}</b> · acertas ${pct(d.P)} (1 em ${Math.max(1, Math.round(1 / d.P))}) · valor <b class="${d.EV >= 0 ? 'ev-pos' : 'ev-neg'}">${(d.EV * 100).toFixed(0)}%</b>${d.EV < 0 ? ' <span class="muted">(é o mal menor)</span>' : ''}<div style="margin-top:6px;"><button class="btn btn-sm btn-primary" onclick="zeRegistarProposta('dupla')">📥 Registar esta dupla</button></div></div>`;
  }
  if (pr.louca) {
    const d = pr.louca;
    h += `<div class="zbox" style="border-color:var(--orange);"><b>🎰 Loucura controlada</b> — se vais mesmo «loucamente», ao menos assim:<br>${d.legs.map((l, i) => `${i + 1}. ${legLi(l)}`).join('<br>')}<br>Odd <b>${d.O.toFixed(2)}</b> · acertas ${pct(d.P)} (1 em ${Math.max(1, Math.round(1 / d.P))}) · valor <b class="${d.EV >= 0 ? 'ev-pos' : 'ev-neg'}">${(d.EV * 100).toFixed(0)}%</b>. Stake máxima: <b>${r2(Math.max(0.1, loadBank().you * 0.01)).toFixed(2)} €</b> (1% da banca — é diversão, não investimento).<div style="margin-top:6px;"><button class="btn btn-sm" onclick="zeRegistarProposta('louca')">📥 Registar a loucura</button></div></div>`;
  }
  const verdict = pr.singles.length >= 2 ? `<b>Eu ia assim:</b> as ${pr.singles.length} simples do 🧠. A dupla só se quiseres emoção; a loucura só com trocos.`
    : pr.singles.length === 1 ? `<b>Eu ia assim:</b> só a simples do 🧠. O resto é para quem gosta de pagar à casa.`
    : `<b>Eu hoje não jogava.</b> Se mesmo assim quiseres, a 🎯 dupla é o mal menor — e a 🎰 loucura, só com trocos.`;
  return h + `<div style="margin-top:8px;">${verdict}</div><div style="margin-top:8px;"><button class="btn btn-sm" onclick="shareProposal()">📤 Partilhar o boletim do Zé</button></div>`;
}
function zeRegistarProposta(kind) {
  const pr = window._zeProps || zeProposals();
  const bank = loadBank().you;
  if (kind === 'singles') {
    let n = 0;
    pr.singles.forEach(l => { if (addBet({ match: l.home && l.away ? `${l.home} vs ${l.away}` : l.sel, pick: l.sel, odd: l.odd, stake: l.stake, source: 'proposta-ze', legs: [{ home: l.home, away: l.away, sel: l.sel, odd: l.odd }], zeCompare: `Proposta do Zé · ${pct(l.p)} · valor ${(l.ev * 100).toFixed(0)}%` }, 'you')) n++; });
    renderBanca(); toast(`📥 ${n} simples registadas na tua banca.`); return;
  }
  const d = kind === 'dupla' ? pr.dupla : pr.louca;
  if (!d) return;
  const sug = kind === 'louca' ? r2(Math.max(0.1, bank * 0.01)) : r2(Math.max(0.1, bank * 0.02));
  const v = prompt(`Valor a apostar (€)? Sugestão do Zé: ${sug.toFixed(2)} €`, sug.toFixed(2));
  const stake = parseFloat(String(v || '').replace(',', '.'));
  if (!(stake > 0)) return;
  if (addBet({ match: `${kind === 'dupla' ? 'Dupla' : 'Múltipla'} ${d.legs.length} seleções (Zé)`, pick: d.legs.map(l => l.sel).join(' + '), odd: r2(d.O), stake, source: 'proposta-ze',
    legs: d.legs.map(l => ({ home: l.home, away: l.away, sel: l.sel, odd: l.odd })), zeCompare: `Proposta do Zé · ${pct(d.P)} · valor ${(d.EV * 100).toFixed(0)}%` }, 'you')) { renderBanca(); toast('📥 Registado. Carrega em «Atualizar» depois dos jogos.'); }
}
function zeApostaProposta() {
  const pr = window._zeProps || zeProposals();
  const b = loadBank();
  let n = 0;
  pr.singles.forEach(l => {
    if (l.tipOnly) return;
    const key = l.home && l.away ? `${l.home} vs ${l.away}` : l.sel;
    if (zeHasSame(key, l.sel)) return;
    const kelly = ((l.p * l.odd - 1) / (l.odd - 1));
    const stake = r2(Math.min(b.ze * 0.05, Math.max(0.1, b.ze * kelly * 0.25)));
    if (addBet({ match: key, pick: l.sel, odd: l.odd, stake, source: 'proposta-ze', legs: [{ home: l.home, away: l.away, sel: l.sel, odd: l.odd }], pModel: +l.p.toFixed(4), pUsed: +l.p.toFixed(4), ev: +l.ev.toFixed(4), zeCompare: `Das propostas · valor +${(l.ev * 100).toFixed(0)}%` }, 'ze')) n++;
  });
  renderBanca();
  toast(n ? `🤖 O Zé registou ${n} aposta${n > 1 ? 's' : ''}. Agora é ver quem ganha.` : 'O Zé não entra: ou já tem estas, ou a odd só existe em apps de tips.');
}
/** Resposta completa a um lote de prints */
function batchHTML(groups) {
  const parts = [];
  const lines = [];
  groups.forEach((g, i) => {
    if (!g.legs.some(l => Number(l.odd) > 1)) { lines.push(`❔ <b>Boletim ${i + 1}</b> <span class="muted">(${esc(g.source || 'Boletim')})</span>: não li odds — confirma no editor.`); return; }
    const c = zeCritiqueSlip(g, loadBank().you);
    lines.push(slipLine(g, i, c));
    parts.push(`<details style="margin:4px 0 0 0;"><summary class="muted" style="cursor:pointer;font-size:.8rem;">ver detalhe do boletim ${i + 1}</summary><div style="margin-top:6px;">${c.html}</div></details>`);
  });
  const p = poolLoad();
  const allP = groups.length > 1 && p.slips && p.slips.length ? p.slips.slice(-groups.length).reduce((a, s) => a * (s.P || 0), 1) : null;
  return `<b>Li ${groups.length} ${groups.length > 1 ? 'boletins' : 'boletim'}:</b><br>${lines.join('<br>')}` +
    (allP != null ? `<br><span class="muted">Acertar todos de uma vez: ${allP < 1e-4 ? 'menos de 0,01%' : pct(allP)}.</span>` : '') +
    parts.join('') + `<br>${proposalsHTML()}`;
}
async function zeChatSlip(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  const log = document.getElementById('chatLog');
  const div = document.createElement('div');
  div.className = 'cmsg user';
  div.innerHTML = `<div class="bubble"><div class="slip-thumbs">${files.map(f => `<img src="${URL.createObjectURL(f)}" alt="boletim">`).join('')}</div>Vou assim. Que achas?</div>${humanFace(30)}`;
  log.appendChild(div);
  const sid = 'zeOcr' + Date.now();
  addChat('bot', `<span id="${sid}">A ler ${files.length > 1 ? `os ${files.length} prints` : 'o boletim'}… 🧐</span>`, 'pensativo');
  log.scrollTop = log.scrollHeight;
  let groups = null;
  try {
    groups = await ocrBatch(files, t => setText(sid, t));
    const all = { legs: groups.flatMap(g => g.legs), totalOdd: null, boost: 0, stake: null, declared: null, source: 'Vários' };
    slipState = groups.length === 1 ? groups[0] : all;
    try { await crossCheckSlip(all, t => setText(sid, t)); groups.forEach(g => { g._forms = all._forms; }); } catch (x) { console.warn(x); }
    setText(sid, 'Feito. A minha opinião:');
    addChat('bot', batchHTML(groups), 'pensativo');
  } catch (e) {
    console.error(e);
    const net = /internet|fetch|network|load|carregar/i.test(String(e && e.message));
    addChat('bot', ocrErrorHTML(e, (typeof groups !== 'undefined' && groups) || (typeof slipState !== 'undefined' ? slipState : null)), 'chateado');
    if (groups) { try { renderSlipEditor(); } catch (x) {} }
  }
  const inp = document.getElementById('zeSlipFile'); if (inp) inp.value = '';
}
async function slipLoad(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  const st = t => setText('slipStatus', t);
  const prev = document.getElementById('slipThumbs');
  if (prev) prev.innerHTML = files.map(f => `<img src="${URL.createObjectURL(f)}" alt="boletim">`).join('');
  try {
    const groups = await ocrBatch(files, st);
    const all = { legs: groups.flatMap(g => g.legs), totalOdd: groups.length === 1 ? groups[0].totalOdd : null, boost: groups.length === 1 ? groups[0].boost : 0, stake: null, declared: groups.length === 1 ? groups[0].declared : null, source: groups.length === 1 ? groups[0].source : 'Vários' };
    slipState = all;
    try { await crossCheckSlip(all, st); groups.forEach(g => { g._forms = all._forms; }); } catch (x) { console.warn(x); }
    st(`Li ${groups.length} ${groups.length > 1 ? 'boletins' : 'boletim'} (${all.legs.length} seleções). Em baixo: a análise e o boletim do Zé. No editor podes corrigir nomes e odds.`);
    renderSlipEditor();
    setHTML('slipCritique', `<div class="speech" style="margin:12px 0 0;align-items:flex-start;">${zeFace('pensativo', 48)}<div style="flex:1;min-width:0;">${personalize(batchHTML(groups))}</div></div>`);
  } catch (e) {
    console.error(e);
    setHTML('slipStatus', ocrErrorHTML(e, slipState));
    if (!slipState.legs.length) slipAddLeg(true);
    renderSlipEditor();
  }
}

initApp();
decorateScout();
