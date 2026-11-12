/* ===== v62b · revisão das últimas estruturas ===== */
/* 1) odds derivadas: algumas casas só dão a linha 1.5 (ou 3.5) em vez da 2.5 (ex.: Liga das Nações) */
oddDerived = (function (prev) {
  return function (m, k) {
    const r = prev(m, k); if (r) return r;
    try {
      const g = /^([OU])(\d+)\.5$/.exec(k); if (!g) return null;
      const st = studyFor(m), b = st && st.books && st.books[0], o = b && b.odds; if (!o) return null;
      const line = ['2.5', '1.5', '3.5'].find(L => o['O' + L] > 1 && o['U' + L] > 1); if (!line) return null;
      const t = 1 / o['O' + line] + 1 / o['U' + line], pO = (1 / o['O' + line]) / t, nL = Math.floor(+line);
      const cdf = (lam, n) => { let s = 0, term = Math.exp(-lam); for (let i = 0; i <= n; i++) { if (i) term *= lam / i; s += term; } return s; };
      let lo = 0.1, hi = 7;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (1 - cdf(mid, nL) < pO) lo = mid; else hi = mid; }
      const lam = (lo + hi) / 2, pU = cdf(lam, +g[2]), p = g[1] === 'O' ? 1 - pU : pU;
      if (!(p > 0.02 && p < 0.98)) return null;
      return { odd: +(1 / (p * t)).toFixed(2), der: true, book: b.provider };
    } catch (e) { return null; }
  };
})(oddDerived);

/* 2) seleções sem odds estudadas: o Zé também não entra no duelo nem no boletim seguro */
zeDecide = (function (prev) {
  return function (m) {
    const d = prev.apply(this, arguments);
    if (d && typeof isIntl === 'function' && isIntl(m) && !intlStudied(m)) { d.pick = null; d.stake = 0; d.intlNoOdds = true; }
    return d;
  };
})(zeDecide);
zeDecidirUI = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const d = dueloAtual && dueloAtual.decision, el = document.getElementById('zeDecision');
      if (d && el && d.intlNoOdds) {
        const sp = el.querySelector('.speech');
        if (sp) sp.innerHTML = `${zeFace('pensativo', 46)}<div><b>Passo.</b> 🌍 Jogo de seleções: só aposto depois de estudar o jogo com as odds das casas — sozinho prometo demais nestes jogos. Volta mais perto do jogo (eu estudo-o sozinho).</div>`;
      }
    } catch (e) {}
    return r;
  };
})(zeDecidirUI);
safeZeBet = (function (prev) {
  return function () {
    try {
      const S = safeSel(), bad = S.filter(x => x.c && x.c.m && isIntl(x.c.m) && !intlStudied(x.c.m));
      if (bad.length) { toast(`🤖 Passo: ${bad.map(x => x.c.m.home + '–' + x.c.m.away).join(', ')} — jogo de seleções que ainda não estudei com as odds das casas.`); return; }
    } catch (e) {}
    return prev.apply(this, arguments);
  };
})(safeZeBet);
