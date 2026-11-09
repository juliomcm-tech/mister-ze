(() => {
  const R = window.__FL;
  const g = (L, pk, wk, ok) => {
    pk = pk || 'p'; wk = wk || 'win'; ok = ok || 'odd';
    const X = L.filter(r => r[wk] != null); const n = X.length; if (!n) return 'n0';
    const w = X.reduce((a, r) => a + r[wk], 0), e = X.reduce((a, r) => a + r[pk], 0), v = X.reduce((a, r) => a + r[pk] * (1 - r[pk]), 0);
    const Q = X.filter(r => r.q != null), wq = Q.reduce((a, r) => a + r[wk], 0), eq = Q.reduce((a, r) => a + r.q, 0), vq = Q.reduce((a, r) => a + r.q * (1 - r.q), 0);
    const O = X.filter(r => r[ok] > 1), pr = O.reduce((a, r) => a + (r[wk] ? r[ok] - 1 : -1), 0);
    return `n${n} hit${Math.round(w / n * 1000) / 10} ze${Math.round(e / n * 1000) / 10} z${((w - e) / Math.sqrt(v || 1)).toFixed(1)}` + (Q.length ? ` cas${Math.round(eq / Q.length * 1000) / 10} zc${((wq - eq) / Math.sqrt(vq || 1)).toFixed(1)}` : '') + (O.length ? ` roi${Math.round(pr / O.length * 1000) / 10}(${O.length})` : '');
  };
  const out = [];
  const P = R.filter(r => r.k && r.odd >= 1.25);          // o que o piloto «Desafios» podia apostar
  out.push('TOTAL linhas ' + R.length + ' de ' + R[0].d + ' a ' + R[R.length - 1].d);
  out.push('LOGICA ' + g(R.map(r => ({ p: r.lp, win: r.lwin, q: null, odd: null }))));
  out.push('DESAFIO(odd>=1.25) ' + g(P));
  out.push('OURO ' + g(R.filter(r => r.grade === 'ouro')));
  out.push('NAO-OURO(1.25+) ' + g(P.filter(r => r.grade !== 'ouro')));
  const half = R[Math.floor(R.length / 2)].d;
  out.push('OURO 1a metade ' + g(R.filter(r => r.grade === 'ouro' && r.d < half)) + ' | 2a ' + g(R.filter(r => r.grade === 'ouro' && r.d >= half)));
  out.push('VALOR ' + g(R.filter(r => r.vb).map(r => ({ p: r.vb.p, win: r.vb.w, odd: r.vb.o, q: null }))));
  // filtro de valor esperado
  const ev = r => r.p * r.odd;
  out.push('EV>=1.00 ' + g(P.filter(r => ev(r) >= 1)) + ' | EV<1 ' + g(P.filter(r => ev(r) < 1)));
  out.push('EV>=1.02 ' + g(P.filter(r => ev(r) >= 1.02)) + ' | EV 0.97-1 ' + g(P.filter(r => ev(r) >= 0.97 && ev(r) < 1)) + ' | EV<0.97 ' + g(P.filter(r => ev(r) < 0.97)));
  out.push('OURO EV>=1 ' + g(P.filter(r => r.grade === 'ouro' && ev(r) >= 1)) + ' | OURO EV<1 ' + g(P.filter(r => r.grade === 'ouro' && ev(r) < 1)));
  out.push('EV>=1 1a ' + g(P.filter(r => ev(r) >= 1 && r.d < half)) + ' | 2a ' + g(P.filter(r => ev(r) >= 1 && r.d >= half)));
  // fatores
  const F = (name, f) => { const a = P.filter(r => f(r) === true), b = P.filter(r => f(r) === false); out.push(`F ${name}: SIM ${g(a)} | NAO ${g(b)} | SIM1a ${g(a.filter(r => r.d < half))} | SIM2a ${g(a.filter(r => r.d >= half))}`); };
  const dr = r => r.f.drift;
  F('odd fugiu >3%', r => dr(r) == null ? null : dr(r) > 0.03);
  F('odd fugiu >6%', r => dr(r) == null ? null : dr(r) > 0.06);
  F('odd caiu >3%', r => dr(r) == null ? null : dr(r) < -0.03);
  F('odd caiu >6%', r => dr(r) == null ? null : dr(r) < -0.06);
  F('descanso <4d (escolhida)', r => r.f.restP == null ? null : r.f.restP < 4);
  F('menos descanso que adversario (2d+)', r => r.f.restP == null || r.f.restO == null ? null : r.f.restP - r.f.restO <= -2);
  F('mais descanso que adversario (2d+)', r => r.f.restP == null || r.f.restO == null ? null : r.f.restP - r.f.restO >= 2);
  F('Europa a seguir (escolhida)', r => r.f.euroNextP);
  F('vem da Europa (escolhida)', r => r.f.euroPrevP);
  F('Europa a seguir (adversario)', r => r.f.euroNextO);
  F('sem nada em jogo (escolhida)', r => r.f.nothingP);
  F('sem nada em jogo (adversario)', r => r.f.nothingO);
  F('derbi', r => r.f.derby);
  F('fim de semana', r => r.f.wk);
  F('casa (1/1X)', r => r.f.side ? r.f.side === 'h' : null);
  F('fora (2/X2)', r => r.f.side ? r.f.side === 'a' : null);
  F('golos mais', r => r.f.side ? r.f.side === 'o' : null);
  F('odd derivada', r => r.oddDer);
  const by = (name, f) => { const o = {}; P.forEach(r => { const k = f(r); (o[k] = o[k] || []).push(r); }); out.push('BY ' + name + ': ' + Object.entries(o).map(([k, v]) => k + ' ' + g(v)).join(' ; ')); };
  by('liga', r => r.code); by('tipo', r => r.k);
  by('odd', r => r.odd < 1.3 ? '1.25-1.30' : r.odd < 1.4 ? '1.30-1.40' : r.odd < 1.6 ? '1.40-1.60' : '1.60+');
  out.push('drift disp ' + P.filter(r => dr(r) != null).length + '/' + P.length);
  return out.join('\n');
})()
