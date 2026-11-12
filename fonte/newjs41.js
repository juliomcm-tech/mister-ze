/* =====================================================================
   v50 · listas de previsões: o 1/X/2 dentro dos quadrados laranja
   O leitor de texto confundia o «1» com «A», «a», «to». Agora o Zé encontra os quadrados pela cor
   e lê o algarismo pela forma (estreito = 1; barra em baixo = 2; resto = X).
   ===================================================================== */
async function predPills(file) {
  const d = await decodeAny(file);
  const k = Math.min(1, 1000 / d.w);
  const W = Math.max(1, Math.round(d.w * k)), H = Math.max(1, Math.round(d.h * k));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'); ctx.drawImage(d.src, 0, 0, W, H); d.done();
  const p = ctx.getImageData(0, 0, W, H).data, N = W * H, M = new Uint8Array(N);
  for (let i = 0, j = 0; i < N; i++, j += 4) { const R = p[j], G = p[j + 1], B = p[j + 2]; M[i] = R > 150 && R - G > 50 && R - B > 60 && G < 160 ? 1 : 0; }
  const seen = new Uint8Array(N), comps = [], stack = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (!M[s] || seen[s]) continue;
    let top = 0; stack[top++] = s; seen[s] = 1;
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    while (top) {
      const q = stack[--top], x = q % W, y = (q - x) / W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x + 1 < W && M[q + 1] && !seen[q + 1]) { seen[q + 1] = 1; stack[top++] = q + 1; }
      if (x > 0 && M[q - 1] && !seen[q - 1]) { seen[q - 1] = 1; stack[top++] = q - 1; }
      if (y + 1 < H && M[q + W] && !seen[q + W]) { seen[q + W] = 1; stack[top++] = q + W; }
      if (y > 0 && M[q - W] && !seen[q - W]) { seen[q - W] = 1; stack[top++] = q - W; }
    }
    const pw = x1 - x0, ph = y1 - y0;
    if (pw > W * 0.1 && pw < W * 0.35 && ph > 0 && pw / ph > 1.8 && pw / ph < 5) comps.push({ x0, x1, y0, y1 });
  }
  comps.sort((a, b) => a.y0 - b.y0);
  return comps.map(({ x0, x1, y0, y1 }) => {
    const pw = x1 - x0, ph = y1 - y0;
    const ix0 = x0 + Math.round(pw * 0.12), ix1 = x1 - Math.round(pw * 0.12), iy0 = y0 + Math.round(ph * 0.18), iy1 = y1 - Math.round(ph * 0.18);
    let bx0 = W, bx1 = -1, by0 = H, by1 = -1;
    for (let y = iy0; y < iy1; y++) for (let x = ix0; x < ix1; x++) if (M[y * W + x]) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    if (bx1 < 0) return null;
    const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
    if (bw / bh < 0.55) return '1';
    let bot = 0;
    for (let x = bx0; x <= bx1; x++) { for (let y = Math.round(by1 - bh * 0.2); y <= by1; y++) if (M[y * W + x]) { bot++; break; } }
    return bot / bw > 0.6 ? '2' : 'X';
  });
}
/* os quadrados lidos pela forma mandam no 1/X/2 (e limpam o lixo que o leitor pôs no fim dos nomes) */
let PRED_PILLS_CUR = null;
const trimJunk = n => String(n || '').replace(/\s+([a-z]{1,2}|[^A-Za-zÀ-ÿ0-9]{1,3})$/, '').trim();
predFinalize = (function (prev) {
  return function (out) {
    try {
      const P = PRED_PILLS_CUR;
      if (P && P.length >= 3 && out && out.length === P.length && P.every(Boolean)) {
        out.forEach((x, i) => { x.pick = P[i]; x.home = trimJunk(x.home); x.away = trimJunk(x.away); });
        out.pillsRead = P.length;
      }
    } catch (e) {}
    return prev(out);
  };
})(predFinalize);
ocrFiles = (function (prev) {
  return async function (files, status) {
    let pills = [];
    try { for (const f of [...(files || [])]) pills = pills.concat(await predPills(f)); } catch (e) { pills = []; }
    PRED_PILLS_CUR = pills.length >= 3 ? pills : null;
    try { return await prev.apply(this, arguments); } finally { PRED_PILLS_CUR = null; }
  };
})(ocrFiles);
/* nomes que as apps de dicas escrevem de outra maneira */
Object.assign(TEAM_ALIAS, { 'olympiakos piraeus': 'olympiacos', 'olympiakos': 'olympiacos', 'slavia praha': 'slavia prague', 'fenerbahce': 'fenerbahce fenerbahçe', 'kortrijk': 'kv kortrijk', 'mechelen': 'kv mechelen' });
