
/* =====================================================================
   v48 · leitura de boletins à prova de telemóvel
   - o leitor (OCR) descarrega-se uma vez em segundo plano, com o progresso à vista; se a rede for lenta
     o descarregamento continua (antes cortava aos 60 s e voltava ao início → «erro» sempre)
   - se o leitor falhar, tenta outra vez sozinho com um leitor mais leve e imagem mais pequena
   - 🩺 «Testar o leitor»: diz exatamente em que passo falha (para corrigirmos)
   - leitura: «Viking FK - Sabah» é o jogo, não a seleção; equipa de fora que falte vem do calendário;
     nunca se troca uma leitura com seleções por uma vazia
   - «Boletim do Zé»: tira seleções de jogos que já acabaram
   ===================================================================== */
const OCR_JS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let OCR_INIT_P = null, OCR_LANGS = 'por+eng', OCR_STAGE = '', OCR_DL = 0;
function ocrWrapRecognize(w) {
  if (w._z36) return w;
  const rec = w.recognize.bind(w);
  w.recognize = async function (img, opts, out) {
    if (OCR_PASS >= OCR_MAX_PASSES && OCR_LAST) return OCR_LAST;
    OCR_PASS++;
    const r = await Promise.race([rec(img, opts, out), new Promise((_, rej) => setTimeout(() => rej(new Error('a leitura demorou demasiado (imagem muito grande ou telemóvel sem memória)')), IS_PHONE ? 120000 : 120000))]);
    OCR_LAST = r; return r;
  };
  w._z36 = true;
  return w;
}
async function ocrLoadScriptRetry() {
  if (window.Tesseract) return;
  let last;
  for (let i = 0; i < 3; i++) {
    try { OCR_STAGE = 'a carregar o leitor'; await loadScript(OCR_JS + (i ? '?r=' + i : ''), 45000); if (window.Tesseract) return; }
    catch (e) { last = e; await new Promise(r => setTimeout(r, 1500)); }
  }
  throw last || new Error('não consegui carregar o leitor (OCR)');
}
function ocrInit(langs) {
  if (OCR_INIT_P) return OCR_INIT_P;
  OCR_INIT_P = (async () => {
    if (navigator.onLine === false && !window.Tesseract) throw new Error('sem internet para carregar o leitor (OCR)');
    await ocrLoadScriptRetry();
    OCR_STAGE = 'a preparar o leitor';
    const w = await Tesseract.createWorker(langs || OCR_LANGS, 1, {
      logger: m => {
        if (/loading language|loading tesseract core/i.test(m.status || '')) { OCR_DL = m.progress || 0; OCR_STAGE = 'a descarregar o leitor'; }
        if (window._ocrProgress) window._ocrProgress(m);
      }
    });
    await w.setParameters({ tessedit_pageseg_mode: '6' });
    OCR_STAGE = 'pronto';
    window._zeOcr = ocrWrapRecognize(w);
    return window._zeOcr;
  })().catch(e => { OCR_INIT_P = null; OCR_STAGE = 'falhou: ' + (e && e.message || e); throw e; });
  return OCR_INIT_P;
}
getOcrWorker = async function (onProgress) {
  window._ocrProgress = m => {
    try {
      if (/loading language|loading tesseract core|initializ/i.test(m.status || '')) onProgress && onProgress({ status: 'loading', progress: m.progress, _txt: `A preparar o leitor de boletins${m.progress ? ' ' + Math.round(m.progress * 100) + '%' : ''} (só na 1.ª vez)…` });
      else onProgress && onProgress(m);
    } catch (e) {}
  };
  if (window._zeOcr) return window._zeOcr;
  // não desiste do descarregamento: se demorar, avisa, mas o leitor continua a vir
  return await Promise.race([ocrInit(), new Promise((_, rej) => setTimeout(() => rej(new Error(`o leitor ainda está a descarregar (${OCR_STAGE}${OCR_DL ? ' ' + Math.round(OCR_DL * 100) + '%' : ''}) — espera um minuto e manda outra vez`)), IS_PHONE ? 150000 : 90000))]);
};
/* o estado «A preparar o leitor 45%» aparece no ecrã */
ocrFiles = (function (prev) {
  return async function (files, status) {
    const st = typeof status === 'function' ? status : () => {};
    const wrapped = t => st(t);
    // v48b: o telemóvel (seletor de fotos do Android) às vezes não deixa abrir a mesma imagem várias vezes.
    // Abre cada imagem UMA vez (3 maneiras diferentes) e passa a trabalhar com uma cópia em memória.
    files = await normFiles([...(files || [])], st);
    // 1.ª tentativa normal; se o motor rebentar (memória/worker), 2.ª com leitor só inglês e imagem mais pequena
    try {
      const out = await prev.call(this, files, wrapped);
      return ocrPost(out);
    } catch (e) {
      const msg = String(e && e.message || e);
      if (/ainda está a descarregar|sem internet/i.test(msg)) throw e;
      st('😬 O leitor engasgou-se — vou tentar outra vez com uma versão mais leve…');
      try { if (window._zeOcr) await window._zeOcr.terminate(); } catch (x) {}
      window._zeOcr = null; OCR_INIT_P = null;
      const keepLangs = OCR_LANGS, keepPx = OCR_PX_OVERRIDE;
      OCR_LANGS = 'eng'; OCR_PX_OVERRIDE = 1.2e6;
      try { await ocrInit('eng'); const out = await prev.call(this, files, wrapped); return ocrPost(out); }
      finally { OCR_LANGS = keepLangs; OCR_PX_OVERRIDE = keepPx; try { if (window._zeOcr) await window._zeOcr.terminate(); } catch (x) {} window._zeOcr = null; OCR_INIT_P = null; }
    }
  };
})(ocrFiles);
let OCR_PX_OVERRIDE = null;
capCanvas = (function (prev) {
  return function (c) {
    if (!OCR_PX_OVERRIDE) return prev(c);
    const px = c.width * c.height; if (px <= OCR_PX_OVERRIDE) return c;
    const k = Math.sqrt(OCR_PX_OVERRIDE / px), o = document.createElement('canvas');
    o.width = Math.round(c.width * k); o.height = Math.round(c.height * k);
    o.getContext('2d').drawImage(c, 0, 0, o.width, o.height); return o;
  };
})(capCanvas);
/* imagens que o browser não consegue abrir (ex.: HEIC) → mensagem clara */
prepImage = (function (prev) {
  return async function (file) {
    try { return await prev(file); }
    catch (e) {
      if (/inválida|invalid|decode/i.test(String(e && e.message))) throw new Error(`não consegui abrir a imagem «${file && file.name || ''}» (${file && file.type || 'formato desconhecido'}). Usa um screenshot normal (PNG/JPG).`);
      throw e;
    }
  };
})(prepImage);

/* ---------- arrumar o que se leu ---------- */
const EVT_RE = /^\s*(.{2,40}?)\s+(?:-|–|—|vs\.?|v)\s+(.{2,40}?)\s*$/i;
function liveFinder(home) {
  const L = lsGet(LIVE_KEY, null), now = Date.now();
  const cand = [];
  matches.forEach(m => { if (teamScore(m.home, normTxt(home)) > 0 || teamScore(home, normTxt(m.home)) > 0 || simil(m.home, home) >= 0.8) cand.push({ home: m.home, away: m.away, side: 'h' }); else if (teamScore(m.away, normTxt(home)) > 0 || simil(m.away, home) >= 0.8) cand.push({ home: m.home, away: m.away, side: 'a' }); });
  ((L && L.matches) || []).forEach(x => {
    if (Math.abs(new Date(x.utcDate).getTime() - now) > 5 * 864e5) return;
    const h = x.homeTeam.shortName || x.homeTeam.name, a = x.awayTeam.shortName || x.awayTeam.name;
    if (teamScore(h, normTxt(home)) > 0 || teamScore(home, normTxt(h)) > 0 || simil(h, home) >= 0.8 || teamScore(x.homeTeam.name, normTxt(home)) > 0) cand.push({ home: h, away: a, side: 'h' });
    else if (teamScore(a, normTxt(home)) > 0 || simil(a, home) >= 0.8 || teamScore(x.awayTeam.name, normTxt(home)) > 0) cand.push({ home: h, away: a, side: 'a' });
  });
  const uniq = []; cand.forEach(c => { if (!uniq.some(u => normTxt(u.home) === normTxt(c.home) && normTxt(u.away) === normTxt(c.away))) uniq.push(c); });
  return uniq.length === 1 ? uniq[0] : null;
}
function ocrPostOne(g) {
  if (!g || !Array.isArray(g.legs)) return g;
  g.legs.forEach(l => {
    // «Viking FK - Sabah» na seleção é o jogo: a seleção verdadeira é o nome que ficou em «casa»
    const ev = EVT_RE.exec(String(l.sel || ''));
    if (ev && (!l.away || !l.home || normTxt(l.home) === normTxt(ev[1]))) {
      const pickName = l.home && normTxt(l.home) !== normTxt(l.sel) ? l.home : '';
      l.home = ev[1].trim(); l.away = ev[2].trim();
      if (pickName) l.sel = pickName;
    }
    // falta a equipa de fora: procura no calendário e nos resultados dos últimos dias
    if (l.home && !l.away) {
      const f = liveFinder(l.home);
      if (f) { l.away = f.side === 'h' ? f.away : f.home; if (f.side === 'a') { const h = l.home; l.home = f.home; l.away = h; } l._filled = true; }
    }
  });
  // lixo da leitura (sem odd e com nomes ilegíveis) fora
  g.legs = g.legs.filter(l => Number(l.odd) > 1 || (nameQuality(l.home || '') >= 0.6 && nameQuality(l.away || '') >= 0.6));
  // repetidos mal lidos («Malorca – Cad 1Siiint» sem odd ao lado de «Maiorca – Cadis» com odd)
  g.legs = g.legs.filter((l, i) => Number(l.odd) > 1 || !g.legs.some((o, j) => j !== i && Number(o.odd) > 1 && (simil(o.home || '', l.home || '') >= 0.75 || simil(o.away || '', l.away || '') >= 0.75)));
  return g;
}
function ocrPost(out) { try { return ocrPostOne(out); } catch (e) { console.warn(e); return out; } }

/* ---------- Boletim do Zé sem jogos que já acabaram ---------- */
poolLoad = (function (prev) {
  return function () {
    const p = prev();
    try {
      const L = lsGet(LIVE_KEY, null), fin = ((L && L.matches) || []).filter(x => x.status === 'FINISHED' && Date.now() - new Date(x.utcDate).getTime() < 3 * 864e5);
      const done = l => fin.some(x => sameTeams({ home: l.home, away: l.away }, x.homeTeam.shortName || x.homeTeam.name, x.awayTeam.shortName || x.awayTeam.name)) || matches.some(m => m.past && sameTeams({ home: l.home, away: l.away }, m.home, m.away));
      const before = p.legs.length;
      p.legs = p.legs.filter(l => !(l.home && l.away && done(l)));
      if (p.legs.length !== before) p._dropped = before - p.legs.length;
    } catch (e) {}
    return p;
  };
})(poolLoad);

/* ---------- 🩺 testar o leitor ---------- */
async function ocrSelfTest(btn) {
  const box = document.getElementById('ocrTestBox') || (btn && btn.parentNode && (() => { const d = document.createElement('div'); d.id = 'ocrTestBox'; btn.parentNode.appendChild(d); return d; })());
  if (!box) return;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ A testar…'; }
  const rows = []; const t0 = Date.now();
  const show = () => { box.innerHTML = `<div class="reason" style="margin-top:8px;font-size:.84rem;line-height:1.5;"><div class="rz-head">🩺 Teste do leitor de boletins</div>${rows.join('<br>')}</div>`; };
  const step = (ok, t) => { rows.push(`${ok === null ? '⏳' : ok ? '✅' : '❌'} ${t}`); show(); };
  step(true, `Aparelho: ${IS_PHONE ? 'telemóvel' : 'computador'} · memória ${navigator.deviceMemory || '?'} GB · ${navigator.onLine === false ? 'SEM internet' : 'com internet'} · ${navigator.serviceWorker && navigator.serviceWorker.controller ? 'app instalada/ativa' : 'site'}`);
  try {
    let t = Date.now(); await ocrLoadScriptRetry(); step(true, `Leitor carregado (${Math.round((Date.now() - t) / 100) / 10} s)`);
    t = Date.now();
    const w = await getOcrWorker(m => { if (m && m._txt) { rows[rows.length - 1] = '⏳ ' + m._txt; show(); } });
    step(true, `Motor pronto (${Math.round((Date.now() - t) / 100) / 10} s)`);
    const c = document.createElement('canvas'); c.width = 900; c.height = 300; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 900, 300); x.fillStyle = '#111'; x.font = 'bold 48px Arial';
    x.fillText('Benfica - Porto', 30, 90); x.fillText('Resultado Final 1.85', 30, 190);
    t = Date.now(); OCR_PASS = 0; OCR_LAST = null;
    const r = await w.recognize(c);
    const txt = (r && r.data && r.data.text || '').replace(/\s+/g, ' ').trim();
    const ok = /benfica/i.test(txt) && /1[.,]85/.test(txt);
    step(ok, `Leitura de teste (${Math.round((Date.now() - t) / 100) / 10} s): «${esc(txt.slice(0, 60))}»`);
    step(ok, ok ? `<b>O leitor funciona neste aparelho.</b> Se um print teu falhar, é o print — manda-o e eu digo o que não percebi.` : '<b>O leitor arrancou mas leu mal.</b> Manda print deste quadro.');
  } catch (e) {
    step(false, `Falhou em «${esc(OCR_STAGE || '?')}»: ${esc(String(e && e.message || e).slice(0, 200))}`);
    step(false, 'Manda-me print deste quadro para eu corrigir. Plano B que funciona sempre: Galeria → abre o print → ícone T (extrair texto) → Copiar, e cola no chat.');
  }
  rows.push(`<span class="muted">total ${Math.round((Date.now() - t0) / 1000)} s</span>`); show();
  if (btn) { btn.disabled = false; btn.textContent = '🩺 Testar o leitor'; }
}
ocrErrorHTML = (function (prev) {
  return function (e, partial) {
    return prev(e, partial) + `<div class="acts" style="margin-top:6px;"><button class="mini" onclick="ocrSelfTest(this)">🩺 Testar o leitor</button></div>`;
  };
})(ocrErrorHTML);
renderConfig = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const v = document.getElementById('appVer');
      if (v && !document.getElementById('ocrTestBtn')) v.insertAdjacentHTML('beforebegin', '<div style="text-align:center;margin-top:10px;"><button id="ocrTestBtn" class="btn btn-sm" onclick="ocrSelfTest(this)">🩺 Testar o leitor de boletins</button></div>');
    } catch (e) {}
    return r;
  };
})(renderConfig);
/* prepara o leitor em segundo plano (uma vez), para o 1.º print não esperar pelo descarregamento */
(function ocrPrewarm() {
  if (/jsdom/i.test(navigator.userAgent || '') || !/^https?:$/.test(location.protocol)) return;
  const c = navigator.connection; if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return;
  if (lsGet('ze_ocr_warm', 0) > Date.now() - 7 * 864e5) return;
  setTimeout(async () => {
    try {
      if (window._zeOcr || document.visibilityState === 'hidden') return;
      const w = await ocrInit();
      lsSet('ze_ocr_warm', Date.now());
      // liberta a memória; os ficheiros ficam guardados e o próximo arranque é rápido
      setTimeout(async () => { try { if (window._zeOcr === w && !OCR_BUSY) { await w.terminate(); window._zeOcr = null; OCR_INIT_P = null; } } catch (e) {} }, 20000);
    } catch (e) {}
  }, 15000);
})();
let OCR_BUSY = false;
ocrBatch = (function (prev) { return async function () { OCR_BUSY = true; try { return await prev.apply(this, arguments); } finally { OCR_BUSY = false; } }; })(ocrBatch);

/* ---------- abrir imagens à prova de telemóvel ---------- */
function imgFromUrl(url) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('img')); i.src = url; }); }
async function decodeAny(file) {
  const errs = [];
  if (window.createImageBitmap) {
    try { const b = await createImageBitmap(file); return { w: b.width, h: b.height, src: b, done: () => b.close && b.close() }; } catch (e) { errs.push('bitmap'); }
  }
  let buf = null;
  try { buf = await file.arrayBuffer(); } catch (e) { errs.push('ler ficheiro: ' + (e && e.name || e)); }
  if (buf && window.createImageBitmap) {
    try { const b = await createImageBitmap(new Blob([buf], { type: file.type || 'image/jpeg' })); return { w: b.width, h: b.height, src: b, done: () => b.close && b.close() }; } catch (e) { errs.push('bitmap2'); }
  }
  if (buf) {
    try {
      const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(new Blob([buf], { type: file.type || 'image/jpeg' })); });
      const i = await imgFromUrl(url); return { w: i.naturalWidth, h: i.naturalHeight, src: i, done: () => {} };
    } catch (e) { errs.push('dataurl'); }
  }
  try { const u = URL.createObjectURL(file); const i = await imgFromUrl(u); return { w: i.naturalWidth, h: i.naturalHeight, src: i, done: () => URL.revokeObjectURL(u) }; } catch (e) { errs.push('url'); }
  throw new Error(`não consegui abrir a imagem «${file && file.name || ''}» (${file && file.type || '?'}, ${file && file.size ? Math.round(file.size / 1024) + ' KB' : '?'}; ${errs.join(', ')})`);
}
async function normFiles(files, st) {
  const out = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f || f._zeNorm) { out.push(f); continue; }
    if (files.length > 1) st && st(`A abrir a imagem ${i + 1}/${files.length}…`);
    const d = await decodeAny(f);
    const k = Math.min(1, 1600 / d.w, Math.sqrt(5e6 / (d.w * d.h)));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(d.w * k)); c.height = Math.max(1, Math.round(d.h * k));
    c.getContext('2d').drawImage(d.src, 0, 0, c.width, c.height); d.done();
    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    const nf = new File([blob], String(f.name || 'print').replace(/\.\w+$/, '') + '.png', { type: 'image/png' });
    nf._zeNorm = true; out.push(nf);
  }
  return out;
}
/* as miniaturas no chat também já não seguram o ficheiro original */
zeChatSlip = (function (prev) {
  return async function (fileList) {
    let files = [...(fileList || [])];
    try { files = await Promise.all(files.map(async f => { try { const b = await f.arrayBuffer(); const nf = new File([b], f.name || 'print.jpg', { type: f.type || 'image/jpeg' }); return nf; } catch (e) { return f; } })); } catch (e) {}
    const inp = document.getElementById('zeSlipFile');
    const r = await prev(files);
    if (inp) inp.value = '';
    return r;
  };
})(zeChatSlip);
slipLoad = (function (prev) {
  return async function (fileList) {
    let files = [...(fileList || [])];
    try { files = await Promise.all(files.map(async f => { try { return new File([await f.arrayBuffer()], f.name || 'print.jpg', { type: f.type || 'image/jpeg' }); } catch (e) { return f; } })); } catch (e) {}
    return prev(files);
  };
})(slipLoad);

/* =====================================================================
   v48c · apps de dicas com «pílulas» coloridas (Special VIP / Elite VIP) e listas de previsões (1 · X · 2)
   O texto amarelo/verde/laranja desaparecia na leitura normal (tema escuro). Leitura extra «tinta»:
   só o texto branco, o texto escuro dentro das pílulas amarelas e o laranja ficam pretos; o resto fica branco.
   ===================================================================== */
async function prepImageInk(file) {
  const d = await decodeAny(file);
  const k = Math.min(1, 1200 / d.w, Math.sqrt((IS_PHONE ? 2.6e6 : 4e6) / (d.w * d.h)));
  const W = Math.max(1, Math.round(d.w * k)), H = Math.max(1, Math.round(d.h * k));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'); ctx.drawImage(d.src, 0, 0, W, H); d.done();
  const img = ctx.getImageData(0, 0, W, H), p = img.data, N = W * H;
  const yel = new Uint8Array(N);
  for (let i = 0, j = 0; i < N; i++, j += 4) { const R = p[j], G = p[j + 1], B = p[j + 2]; yel[i] = R > 180 && G > 150 && B < 130 ? 1 : 0; }
  // somas acumuladas por linha e por coluna (para saber se há amarelo à esquerda/direita/cima/baixo)
  const rowCs = new Int32Array((W + 1) * H), colCs = new Int32Array(W * (H + 1));
  for (let y = 0; y < H; y++) { let s = 0; const o = y * (W + 1); for (let x = 0; x < W; x++) { s += yel[y * W + x]; rowCs[o + x + 1] = s; } }
  for (let x = 0; x < W; x++) { let s = 0; for (let y = 0; y < H; y++) { s += yel[y * W + x]; colCs[(y + 1) * W + x] = s; } }
  const rh = Math.max(8, Math.round(40 * k * (d.w / 1080))), rv = Math.max(6, Math.round(30 * k * (d.w / 1080)));
  for (let y = 0, i = 0; y < H; y++) {
    const o = y * (W + 1);
    for (let x = 0; x < W; x++, i++) {
      const j = i * 4, R = p[j], G = p[j + 1], B = p[j + 2];
      const L = 0.299 * R + 0.587 * G + 0.114 * B, mx = Math.max(R, G, B), mn = Math.min(R, G, B), S = mx ? (mx - mn) / mx : 0;
      let ink = (L > 185 && S < 0.3) || (R > 190 && G < 150 && G > 40 && B < 110);
      if (!ink && L < 130) {
        const l = rowCs[o + x + 1] - rowCs[o + Math.max(0, x - rh)], r = rowCs[o + Math.min(W, x + rh + 1)] - rowCs[o + x];
        if (l > 0 && r > 0) {
          const u = colCs[(y + 1) * W + x] - colCs[Math.max(0, y - rv) * W + x], dn = colCs[Math.min(H, y + rv + 1) * W + x] - colCs[y * W + x];
          ink = u > 0 && dn > 0;
        }
      }
      const v = ink ? 0 : 255; p[j] = p[j + 1] = p[j + 2] = v; p[j + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
const VIP_LEAGUE = /\b(league|liga|cup|copa|serie|bundesliga|premier|eredivisie|ligue|champions|europa|conference|nba|euroleague|eurocup|championship|primeira|super lig|superliga)\b/i;
const VIP_SEP = /\s+(?:[-=–—_~]*\s*(?:\(\s*[0oO@]\s*\)|\[\s*[@©®]\s*\]?|[©®@◎⊙]|ro\))\s*[-=–—_~]*|[-=–—]{1,3}|[O0oQ])\s+/;   // o relógio no meio lê-se «©», «(0)», «-@-» ou só «O»
function parseVipTips(text) {
  const lines = String(text || '').split(/\n+/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const cards = []; let lg = null, mt = null;
  for (const raw of lines) {
    if (TIP_PROMO.test(raw) && !/tips history/i.test(raw)) { mt = null; continue; }
    const ln = raw.replace(/^[^A-Za-z]{1,6}\s+/, '').trim();
    const P = ln.match(TIP_PICK);
    if (mt && P) {
      const odd = +P[2].replace(',', '.');
      if (odd > 1 && odd < 30) {
        const pick = P[1].replace(/[\]\[_|]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\s+(1X|X2|12)$/i, '');
        const sport = /basket|nba|euroleague|eurocup/i.test(lg || '') ? 'basket' : '';
        cards.push({ league: lg || '', home: mt.home, away: mt.away, pick, odd, sel: tipSel(pick, mt.home, mt.away), sport, done: false });
      }
      mt = null; continue;
    }
    if (VIP_LEAGUE.test(ln) && ln === ln.toUpperCase() && !P) { lg = ln.replace(/^[^A-Z]+/, ''); mt = null; continue; }
    const parts = ln.split(VIP_SEP).map(s => s.replace(/[^A-Za-zÀ-ÿ0-9.' /&-]+/g, ' ').replace(/\s+/g, ' ').trim()).filter(s => /[A-Za-zÀ-ÿ]{2,}/.test(s));
    if (parts.length === 2 && !/tips history|special|elite|vip/i.test(ln) && !parts.some(x => /\d/.test(x))) mt = { home: parts[0], away: parts[1] };
  }
  return cards.length ? cards : null;
}
function parsePredList(text) {
  const raw = String(text || '').split(/\n+/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out = [];
  const PK = /\s+[(\[{]?\s*([12xX])\s*[)\]}]?\s*\)?\s*$/;
  for (let i = 0; i < raw.length; i++) {
    let ln = raw[i].replace(/^\d{1,2}\/\d{1,2}\s+\d{1,2}[:.]\S*\s*/, '');
    if (!/ - /.test(ln) && !/-\s*\S*$/.test(ln)) continue;
    let pick = null, m = ln.match(PK); if (m) { pick = m[1].toUpperCase(); ln = ln.replace(PK, ''); }
    // nome que continua na linha seguinte («AEK Athens - Real» + «Madrid»)
    let parts = ln.split(/\s+-\s*|\s*-\s+/).map(s => s.trim()).filter(Boolean);
    const next = raw[i + 1] ? raw[i + 1].replace(/^\d{1,2}\/\d{1,2}\s+\d{1,2}[:.]\S*\s*/, '') : '';
    if (next && !/ - /.test(next) && /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'&]{1,30}(\s+[(\[{]?[12xX][)\]}]?)?$/.test(next.replace(/[^A-Za-zÀ-ÿ0-9 .'&()\[\]{}]/g, '').trim())) {
      let nx = next.replace(/[^A-Za-zÀ-ÿ0-9 .'&()\[\]{}]/g, '').trim(); const m2 = nx.match(PK); if (m2) { pick = pick || m2[1].toUpperCase(); nx = nx.replace(PK, ''); }
      if (parts.length === 1) parts.push(nx.trim()); else parts[1] = (parts[1] + ' ' + nx).trim();
      i++;
    }
    // «Fenerbahçe -» / «; Do ?2» / «Liverpool»: lixo no meio → a equipa é a linha seguinte com nome
    if ((parts.length < 2 || (parts[1].match(/[A-Za-zÀ-ÿ]/g) || []).length < 3) && raw[i + 1] && /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'&]{2,30}$/.test(raw[i + 1].replace(/[^A-Za-zÀ-ÿ .'&]/g, '').trim()) && !/ - /.test(raw[i + 1])) {
      parts = [parts[0], raw[i + 1].replace(/[^A-Za-zÀ-ÿ .'&]/g, '').trim()]; i++;
    }
    if (parts.length !== 2 || !/[A-Za-z]{2,}/.test(parts[0]) || !/[A-Za-z]{2,}/.test(parts[1])) continue;
    const clean = n => n.replace(/[—–_~-]+$/, '').replace(/\s*[—–_~]{2,}\s*/g, ' ').replace(/\s[A-Za-z](?=\s)/g, '').replace(/\s+/g, ' ').trim();
    out.push({ home: clean(parts[0]), away: clean(parts[1]), pick });
  }
  return predFinalize(out);
}
function predFinalize(out) { return out.filter(x => x.pick).length >= 3 ? out : null; }
function tipsFromCards(cards, text, label) {
  const k = c => normTxt(c.home + '|' + c.away + '|' + c.sel + '|' + c.odd);
  const seen = new Set(); cards = cards.filter(c => !seen.has(k(c)) && seen.add(k(c)));
  return { legs: cards.filter(c => !c.sport).map(c => ({ home: c.home, away: c.away, sel: c.sel, odd: c.odd, market: '', tip: c.pick, league: c.league })),
    tipsDone: [], tipsOther: cards.filter(c => c.sport), tipsDate: null, tipsPromo: false, totalOdd: null, boost: 0, stake: null, declared: null, appProb: null, text: String(text), source: label, tips: true };
}
const goodLegs = s => ((s && s.legs) || []).filter(l => l.home && l.away && (Number(l.odd) > 1 || l.pred)).length;
ocrFiles = (function (prev) {
  return async function (files, status) {
    const st = typeof status === 'function' ? status : () => {};
    files = await normFiles([...(files || [])], st);
    let out = await prev.call(this, files, status);
    try {
      const txt = String(out && out.text || '');
      const looks = (/tips history|special vip|elite vip/i.test(txt) && goodLegs(out) < 3) || goodLegs(out) <= 1 || ((txt.match(/ - /g) || []).length >= 4 && goodLegs(out) < 3);
      if (!looks) return out;
      st('🎨 Leitura das cores (dicas em caixas)…');
      const w = await getOcrWorker(() => {});
      let allText = '', cards = [], preds = [];
      for (const f of files) {
        const c = await prepImageInk(f);
        OCR_PASS = 0; OCR_LAST = null;
        await w.setParameters({ tessedit_pageseg_mode: '6' });
        const r = await w.recognize(c);
        const t = r && r.data && r.data.text || ''; allText += '\n' + t;
        cards = cards.concat(parseVipTips(t) || []);
        preds = preds.concat(parsePredList(t) || []);
      }
      const vip = cards.length ? tipsFromCards(cards, allText, 'App de dicas (VIP)') : null;
      const pl = preds.length >= 3 ? { legs: preds.map(x => ({ home: x.home, away: x.away, sel: x.pick === '1' ? `${x.home} vence` : x.pick === '2' ? `${x.away} vence` : x.pick === 'X' ? 'Empate' : '', odd: null, market: '', tip: x.pick || '?', pred: true })), tipsDone: [], tipsOther: [], text: allText, source: 'Lista de previsões', tips: true, preds: true, totalOdd: null, boost: 0, stake: null, declared: null, appProb: null } : null;
      const best = [out, vip, pl].filter(Boolean).sort((a, b) => goodLegs(b) - goodLegs(a))[0];
      if (best !== out) { best.text = (out.text || '') + '\n' + allText; return ocrPost(best); }
    } catch (e) { console.warn('ink', e); }
    return out;
  };
})(ocrFiles);
/* listas de previsões (sem odds): o Zé diz se concorda e a partir de que odd vale a pena */
tipsAnalysisHTML = (function (prev) {
  return function (g) {
    if (!g || !g.legs || !g.legs.some(l => l.pred || !(Number(l.odd) > 1))) return prev(g);
    const withOdd = g.legs.filter(l => !l.pred && Number(l.odd) > 1), noOdd = g.legs.filter(l => !withOdd.includes(l));
    const head = withOdd.length ? prev({ ...g, legs: withOdd }) : '';
    const rows = noOdd.map(l => {
      const m = findMatchForLeg(l); let p = null;
      if (m) { try { const r = modelo(m); const k = l.tip === '1' ? '1' : l.tip === '2' ? '2' : l.tip === 'X' ? 'X' : null; if (k) p = r.mk[k]; } catch (e) {} }
      return { l, m, p };
    });
    const tr = rows.map(r => `<tr><td>${esc(r.l.home)} – ${esc(r.l.away)}</td><td><b>${esc(r.l.tip || '?')}</b></td><td>${r.p != null ? pct(r.p) : '—'}</td><td>${r.p != null ? fairOdd(r.p) : '—'}</td><td>${r.p == null ? '<span class="muted">jogo não encontrado</span>' : r.p >= 0.55 ? '👍 concordo' : r.p >= 0.4 ? '🤔 arriscado' : '👎 discordo'}</td></tr>`).join('');
    return head + `<div class="needs" style="margin:6px 0;"><div class="rz-head">🔎 Previsões (sem odds) — o que acho de cada uma</div>
      <div style="overflow-x:auto;"><table class="mtable"><thead><tr><th>Jogo</th><th>Previsão</th><th>Prob. Zé</th><th>Só a partir de</th><th></th></tr></thead><tbody>${tr}</tbody></table></div>
      <div class="muted" style="font-size:.8rem;margin-top:4px;">Esta lista não traz odds. «Só a partir de» é a odd mínima para valer a pena: vê na tua casa e, se pagar isso ou mais, mete no duelo.</div></div>`;
  };
})(tipsAnalysisHTML);
/* «Dortmund Or Draw» com «Borussia Dortmund»: o nome curto também conta */
whichSide = (function (prev) {
  return function (name, home, away) {
    const r = prev(name, home, away); if (r) return r;
    const n = normTxt(name).trim(); if (n.length < 3) return r;
    const has = t => (' ' + normTxt(t) + ' ').includes(' ' + n + ' ');
    if (has(home) && !has(away)) return 'h';
    if (has(away) && !has(home)) return 'a';
    return r;
  };
})(whichSide);
