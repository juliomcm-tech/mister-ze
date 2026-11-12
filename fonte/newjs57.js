/* ===== v61c · odds derivadas da casa (para o piloto e desafios) =====
   A ESPN só traz 1X2 e Mais/Menos 2.5. As escolhas mais seguras (1X, X2, Mais 1.5, Menos 3.5)
   ficavam sem odd e o piloto nunca as apostava. Agora a odd sai das odds da própria casa:
   - dupla hipótese: 1 / (1/odd1 + 1/oddX)  (a margem da casa fica incluída)
   - outras linhas de golos: ajusta Poisson à linha 2.5 da casa e aplica a mesma margem. */
function oddDerived(m, k) {
  try {
    const st = studyFor(m), b = st && st.books && st.books[0], o = b && b.odds; if (!o) return null;
    if (o[k] > 1) return { odd: +o[k], der: false, book: b.provider };
    if (OUT_SET[k] && o['1'] > 1 && o.X > 1 && o['2'] > 1) {
      const s = OUT_SET[k].reduce((a, j) => a + 1 / o[j], 0);
      return s > 0 && s < 1 ? { odd: +(1 / s).toFixed(2), der: true, book: b.provider } : null;
    }
    const g = /^([OU])(\d+)\.5$/.exec(k);
    if (g && o['O2.5'] > 1 && o['U2.5'] > 1) {
      const t = 1 / o['O2.5'] + 1 / o['U2.5'], pO = (1 / o['O2.5']) / t;
      const cdf = (lam, n) => { let s = 0, term = Math.exp(-lam); for (let i = 0; i <= n; i++) { if (i) term *= lam / i; s += term; } return s; };
      let lo = 0.2, hi = 6;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (1 - cdf(mid, 2) < pO) lo = mid; else hi = mid; }
      const lam = (lo + hi) / 2, n = +g[2], pU = cdf(lam, n), p = g[1] === 'O' ? 1 - pU : pU;
      if (!(p > 0.02 && p < 0.98)) return null;
      return { odd: +(1 / (p * t)).toFixed(2), der: true, book: b.provider };
    }
  } catch (e) {}
  return null;
}
const _chOddOfV61 = chOddOf;
chOddOf = function (m, k, p) {
  const d = oddDerived(m, k);
  if (d && d.odd > 1) return { odd: d.odd, est: false, der: d.der, book: d.book };
  return _chOddOfV61(m, k, p);
};
const _chFixMinOddV61 = chFixMinOdd;
chFixMinOdd = function (c) {
  const r = _chFixMinOddV61(c);
  if (!r) return r;
  const d = oddDerived(r.m, r.k2);
  if (!(r.odd > 1)) { if (d && d.odd >= ZE_MIN_ODD) { const o = Object.assign({}, r, { odd: d.odd, oddDer: d.der }); if (!o.book) o.book = d.book; return o; } }
  else if (d && d.der && Math.abs(d.odd - r.odd) < 0.005 && !r.oddDer) return Object.assign({}, r, { oddDer: true });
  return r;
};

/* ===== v61c · o piloto liquida apostas antigas (fora da janela de 4 dias do Atualizar) ===== */
let AUTO_CATCH_AT = 0;
async function autoCatchUp(force) {
  if (/jsdom/i.test(navigator.userAgent || '') || window.__ZE_LAB || navigator.onLine === false) return 0;
  if (!force && Date.now() - AUTO_CATCH_AT < 30 * 60e3) return 0;
  if (typeof espnCooling === 'function' && espnCooling()) return 0;
  const old = Date.now() - 3.5 * 864e5, want = {};
  Object.keys(AUTO_W).forEach(w => autoLoad(w).bets.forEach(x => {
    if (x.st !== 'open' || !x.code || !(x.ko < old)) return;
    const d = new Date(x.ko); want[x.code + '|' + d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0')] = 1;
  }));
  const keys = Object.keys(want).slice(0, 4); if (!keys.length) return 0;
  AUTO_CATCH_AT = Date.now();
  const all = [];
  for (const kk of keys) {
    const [code, ym] = kk.split('|');
    try {
      const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${ym}&limit=1000`);
      (j.events || []).forEach(ev => { const n = normalizeEspn(ev, code, (typeof ESPN_LEAGUES !== 'undefined' && ESPN_LEAGUES[code]) || code); if (n) all.push(n); });
    } catch (e) {}
    if (typeof espnCooling === 'function' && espnCooling()) break;
  }
  const n = all.length ? autoGrade({ matches: all }) : 0;
  if (n) { try { if (currentView === 'stats') renderZeStats(); if (currentView === 'config') renderConfig(); } catch (e) {} }
  return n;
}
setTimeout(() => autoCatchUp().catch(() => {}), 45000);
applyLive = (function (prev) { return function () { const r = prev.apply(this, arguments); setTimeout(() => autoCatchUp().catch(() => {}), 25000); return r; }; })(applyLive);
