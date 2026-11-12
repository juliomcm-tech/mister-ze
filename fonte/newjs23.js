
/* =====================================================================
   v36 · telemóvel e liquidação do utilizador
   - o nome das Definições em todo o lado (nada de «Humano»)
   - leitura de boletins no telemóvel: imagens mais leves, menos passagens, tempo limite, erro explicado
   - as TUAS apostas fecham como as do Zé: o texto do pick passa a mercado (1, X, 2, 1X, Mais 2.5…),
     nomes com erros de leitura (Benflca) ainda batem, «Mais/Menos» não se contradiz, «Empate anula» devolve
   - «Atualizar» tenta outra vez sozinho se falhar
   ===================================================================== */
function pname() { const n = (userProfile().name || '').trim(); return n || 'Tu'; }
function applyNames() {
  const n = pname();
  document.querySelectorAll('.pname').forEach(el => { el.textContent = n; });
  const h = document.getElementById('hdrSub'); if (h) h.textContent = `Dossiê 2026/27 · ${n} vs Mister Zé`;
  const t = document.getElementById('duelTitle'); if (t) t.textContent = `${n} vs Mister Zé`;
}
const _renderBancaV36 = renderBanca;
renderBanca = function () { const r = _renderBancaV36.apply(this, arguments); try { applyNames(); stuckBox(); } catch (e) {} return r; };
const _saveUserNameV36 = saveUserName;
saveUserName = function () { const r = _saveUserNameV36.apply(this, arguments); try { applyNames(); } catch (e) {} return r; };
applyNames();

/* ---------- Leitura no telemóvel ---------- */
const IS_PHONE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') || (navigator.deviceMemory && navigator.deviceMemory <= 4);
const OCR_MAX_PX = IS_PHONE ? 2.0e6 : 4.5e6;      // píxeis por imagem (um print de 1080×2400 a 1,3× passava os 4 milhões)
const OCR_MAX_PASSES = IS_PHONE ? 2 : 6;          // passagens por imagem
function capCanvas(c) {
  if (!c || !c.width) return c;
  const px = c.width * c.height;
  if (px <= OCR_MAX_PX) return c;
  const k = Math.sqrt(OCR_MAX_PX / px), o = document.createElement('canvas');
  o.width = Math.round(c.width * k); o.height = Math.round(c.height * k);
  o.getContext('2d').drawImage(c, 0, 0, o.width, o.height);
  return o;
}
let OCR_PASS = 0, OCR_LAST = null;
const _prepImageV36 = prepImage;
prepImage = async function (file) { OCR_PASS = 0; OCR_LAST = null; return capCanvas(await _prepImageV36(file)); };
if (typeof prepImageWhite === 'function') { const _pw = prepImageWhite; prepImageWhite = async function (f) { const r = await _pw(f); if (r && r.canvas) r.canvas = capCanvas(r.canvas); return r; }; }
if (typeof prepImageReceipt === 'function') { const _pr = prepImageReceipt; prepImageReceipt = async function (f) { return capCanvas(await _pr(f)); }; }
let OCR_LAST_ERR = null;
const _getOcrWorkerV36 = getOcrWorker;
getOcrWorker = async function (onProgress) {
  let w;
  try { w = await _getOcrWorkerV36(onProgress); }
  catch (e) {
    OCR_LAST_ERR = e;
    try { if (window._zeOcr) await window._zeOcr.terminate(); } catch (x) {}
    window._zeOcr = null;
    throw e;
  }
  if (!w._z36) {
    const rec = w.recognize.bind(w);
    w.recognize = async function (img, opts, out) {
      // no telemóvel, poucas passagens: a partir do limite devolve a última leitura (as passagens extra só refinam)
      if (OCR_PASS >= OCR_MAX_PASSES && OCR_LAST) return OCR_LAST;
      OCR_PASS++;
      const r = await Promise.race([rec(img, opts, out), new Promise((_, rej) => setTimeout(() => rej(new Error('a leitura demorou demasiado (imagem muito grande ou telemóvel sem memória)')), IS_PHONE ? 90000 : 120000))]);
      OCR_LAST = r; return r;
    };
    w._z36 = true;
  }
  return w;
};
function ocrErrorHTML(e, partial) {
  const msg = String((e && e.message) || e || '');
  OCR_LAST_ERR = e;
  // o leitor pode ter ficado estragado: na próxima tenta do zero
  try { if (window._zeOcr && /memória|demasiado|worker|abort|terminat/i.test(msg)) { window._zeOcr.terminate(); window._zeOcr = null; } } catch (x) {}
  const offline = navigator.onLine === false || /sem internet|failed to fetch|network/i.test(msg);
  const isFile = location.protocol === 'file:' || location.protocol === 'content:';
  const tips = [];
  if (offline) tips.push('Sem internet, o leitor não arranca na 1.ª vez (precisa de descarregar ~10 MB; depois fica guardado).');
  if (/worker|security|cross|origin|blob/i.test(msg) || (isFile && !offline)) tips.push('Aberto como ficheiro no telemóvel, o browser às vezes não deixa o leitor trabalhar. Instalada a partir de um endereço (GitHub Pages), funciona sempre.');
  if (/demasiado|memória|memory|alloc/i.test(msg)) tips.push('Manda um print de cada vez, ou corta o print só à parte do boletim.');
  tips.push('Plano B que funciona sempre: <b>Galeria → abre o print → ícone T (extrair texto) → Copiar</b> e cola aqui.');
  const legs = partial && (partial.legs || (Array.isArray(partial) && partial.flatMap(g => g.legs || []))) || [];
  return `😬 Não consegui ler ${legs.length ? 'tudo d' : ''}o boletim.<br>${tips.map(t => '• ' + t).join('<br>')}${legs.length ? `<br>As ${legs.length} seleções que li estão em <b>Finanças → Boletim</b> para corrigires.` : ''}<br><span class="muted" style="font-size:.76rem;">Detalhe técnico: ${esc(msg.slice(0, 160)) || '—'}${IS_PHONE ? ' · telemóvel' : ''}${isFile ? ' · aberto como ficheiro' : ''}</span>`;
}

/* ---------- As tuas apostas fecham como as do Zé ---------- */
// erros de leitura: «Benflca» ≈ «Benfica», «Sportlng» ≈ «Sporting»
function simil(a, b) {
  a = normTxt(a); b = normTxt(b); if (!a || !b) return 0; if (a === b) return 1;
  const m = a.length, n = b.length; if (Math.abs(m - n) > 3) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return 1 - prev[n] / Math.max(m, n);
}
function fuzzyTeam(legName, evNames) {
  const L = teamTokens(legName).filter(t => !TEAM_GENERIC.has(t)); if (!L.length) return false;
  const E = evNames.flatMap(n => normTxt(n).split(' ')).filter(t => t.length >= 3);
  return L.every(t => E.some(x => t.length >= 4 && simil(t, x) >= 0.8));
}
const _evMatchesLegV36 = evMatchesLeg;
evMatchesLeg = function (e, l) {
  if (_evMatchesLegV36(e, l)) return true;
  if (!l || (!l.home && !l.away)) return false;
  const hN = [e.homeTeam.name, e.homeTeam.shortName], aN = [e.awayTeam.name, e.awayTeam.shortName];
  const hOk = l.home ? fuzzyTeam(l.home, hN) : true, aOk = l.away ? fuzzyTeam(l.away, aN) : true;
  return !!(hOk && aOk);
};
// texto do pick → limpo de títulos de mercado que confundem
const _selCondsV36 = selConds;
selConds = function (selRaw, m) {
  let s = String(selRaw || '');
  s = s.replace(/mais\s*\/\s*menos|over\s*\/\s*under|acima\s*\/\s*abaixo|total de golos|total goals|resultado final|resultado \(1x2\)|1x2|vencedor do jogo|match winner|dupla hip[oó]tese|double chance/gi, ' ');
  // «Mais de 2.5 … Menos» : fica a última indicação
  const lastOU = [...s.matchAll(/(mais de|over|acima de|menos de|under|abaixo de)\s*\d+[.,]5/gi)].pop();
  if (lastOU) s = s.replace(/(mais de|over|acima de|menos de|under|abaixo de)\s*\d+[.,]5/gi, x => x === lastOU[0] ? x : ' ');
  return _selCondsV36(s, m);
};
// «Empate anula aposta» (DNB): empate devolve essa seleção
const DNB = /(empate anula|draw no bet|\bdnb\b|anula se empate|empate devolve)/;
const _resolveLegV36 = resolveLeg;
resolveLeg = function (l, fin, at) {
  if (l && DNB.test(normTxt(l.sel || '')) && !l.market) {
    const r = _resolveLegV36({ ...l, sel: String(l.sel).replace(/empate anula( a)?( aposta)?|draw no bet|dnb|anula se empate|empate devolve/gi, ' ') }, fin, at);
    if (r && r.e && r.e.score.fullTime.home === r.e.score.fullTime.away) return { ...r, win: true, voidLeg: true };
    return r;
  }
  return _resolveLegV36(l, fin, at);
};
// depois de liquidar: seleções anuladas pagam odd 1
const _settleFromResultsV36 = settleFromResults;
settleFromResults = function (payload) {
  const rep = _settleFromResultsV36(payload);
  try {
    const fin = ((payload && payload.matches) || []).filter(x => x.status === 'FINISHED');
    const b = loadBank(); let ch = false;
    rep.filter(r => r.result === 'win').forEach(r => {
      const list = r.who === 'ze' ? b.zeBets : b.bets, bet = list.find(x => x.id === r.bet.id); if (!bet) return;
      const legs = Array.isArray(bet.legs) && bet.legs.length ? bet.legs : [legFromBet(bet)];
      let f = 1;
      legs.forEach(l => { if (!l || !DNB.test(normTxt(l.sel || ''))) return; const x = resolveLeg(l, fin, bet.at); if (x && x.voidLeg) f /= Math.max(1, Number(l.odd) || (legs.length === 1 ? bet.odd : 1)); });
      if (f < 1) {
        const paid = r2(bet.stake * bet.odd), should = r2(bet.stake * bet.odd * f);
        if (r.who === 'ze') b.ze = r2(b.ze - paid + should); else b.you = r2(b.you - paid + should);
        if (legs.length === 1) bet.status = 'void';
        else { bet.oddOrig = bet.odd; bet.odd = +(bet.odd * f).toFixed(4); bet.note = (bet.note ? bet.note + ' · ' : '') + 'seleção com «empate anula» devolvida (odd 1)'; }
        bet.voidAdj = r2(should - paid); ch = true; r.result = bet.status;
      }
    });
    if (ch) saveBank(b);
  } catch (e) { console.warn(e); }
  return rep;
};

/* ---------- Na aba Apostas: o que ficou por fechar, com botões ---------- */
function stuckBox() {
  const host = document.getElementById('zeRoast'); if (!host) return;
  let box = document.getElementById('stuckBox');
  const D = typeof openDiag === 'function' ? openDiag() : [];
  const stuck = D.filter(d => d.stuck || d.ds.every(x => x.k === 'won' || x.k === 'lost'));
  if (!stuck.length) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement('div'); box.id = 'stuckBox'; box.className = 'needs'; box.style.margin = '10px 0'; host.parentNode.insertBefore(box, host); }
  box.innerHTML = openDiagHTML().replace('🔍 Apostas abertas', '✋ Apostas que precisam de ti');
}

/* ---------- «Atualizar» falhou? tenta outra vez uma vez ---------- */
const _atualizarTudoV36 = atualizarTudo;
atualizarTudo = async function (opts) {
  const r = await _atualizarTudoV36(opts);
  try {
    const st = document.getElementById('liveStatus');
    if (st && /Não consegui ligar|Erro a processar/.test(st.textContent) && !(opts && opts._retry) && navigator.onLine !== false) {
      st.insertAdjacentHTML('beforeend', '<br>🔁 A tentar outra vez…');
      await new Promise(res => setTimeout(res, 2500));
      return _atualizarTudoV36({ ...(opts || {}), _retry: true });
    }
  } catch (e) {}
  try { stuckBox(); } catch (e) {}
  return r;
};
