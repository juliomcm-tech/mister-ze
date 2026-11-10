/* Corre DENTRO da app (no jsdom): o piloto automático do Zé, igual ao do telemóvel.
   Regra: só aposta em jogos com estudo completo (forma + odds), como no telemóvel. */
(async () => {
  const IN = JSON.parse(window.__ROBO_IN), out = { janela: 0, cands: 0, estudados: 0, novas: 0, clv: 0, atrasadas: 0, log: [] };
  try {
    // o robô não lê jornais nem fichas de jogadores (não entram nas contas e poupam pedidos)
    zeNews = async () => ({ t: Date.now(), items: [], signals: [] });
    playerBoard = async () => { throw new Error('robo'); };
    const now = Date.now();
    const W = matches.filter(m => m.live && !m.past && m.espn && m.espn.ev).map(m => ({ m, k: kickOf(m) })).filter(x => x.k && x.k.getTime() > now + 10 * 60e3 && x.k.getTime() < now + 30 * 3600e3);
    out.janela = W.length;
    // 1) estudo leve (só as odds já guardadas) — serve apenas para escolher que jogos estudar a sério
    W.forEach(x => { const b = IN.books[String(x.m.espn.ev)]; if (!b || !b.odds || !(b.odds['1'] > 1)) return; STUDY[mKey(x.m)] = { t: Date.now(), m: { home: x.m.home, away: x.m.away }, sources: [], books: [b], market: marketFromBook(b), oddsTried: Date.now(), allT: Date.now(), robo: 1 }; });
    MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear(); try { CH_MEM = null; } catch (e) {}
    const C = autoCands(); out.cands = C.length;
    const today = isoDay(new Date()), pick = new Map();
    Object.keys(AUTO_W).forEach(w => {
      const a = autoLoad(w), left = Math.max(0, (a.perDay || AUTO_W[w].perDay) - a.bets.filter(x => x.day === today).length);
      if (!left) return;
      C.filter(AUTO_W[w].ok).filter(c => !a.bets.some(x => x.ev === String(c.m.espn.ev))).slice(0, left + 1).forEach(c => pick.set(String(c.m.espn.ev), c.m));
    });
    // 2) estudo completo só dos jogos em que pode apostar agora
    for (const m of [...pick.values()].slice(0, IN.maxEstudos || 8)) {
      try { await zeStudy(m); out.estudados++; } catch (e) { out.log.push('estudo ' + m.home + ': ' + (e && e.message)); }
    }
    // 3) aposta só com estudo completo
    Object.keys(STUDY).forEach(k => { if (STUDY[k] && STUDY[k].robo) delete STUDY[k]; });
    MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear(); try { CH_MEM = null; } catch (e) {}
    try { SELO_STUDY_RUN = true; } catch (e) {}
    try { INTL_STUDY_RUN = true; } catch (e) {}
    out.novas = await zeAutoRun(true);
    // (diagnóstico, só quando pedido) estuda N jogos e diz o que conseguiu ler — não aposta
    if (IN.testeEstudo) {
      const up = matches.filter(m => m.live && !m.past && m.espn && m.espn.ev).slice(0, IN.testeEstudo);
      for (const m of up) {
        const t = Date.now();
        try { const st = await zeStudy(m); const z = zeLogical(m); const c = chFixMinOdd({ m, i: 0, k2: z.k, p: z.p, odd: null, cat: 'dia', score: 1 }); const sl = c ? zeSelo(m, c.k2, c.p, c.odd) : null;
          out.log.push(`teste ${m.home}–${m.away}: ${Date.now() - t} ms · casas ${(st.books || []).map(b => b.provider).join('+') || '—'} · forma ${st.recentH ? st.recentH.length : '—'}/${st.recentA ? st.recentA.length : '—'} · descanso ${st.restH && st.restH.since != null ? st.restH.since.toFixed(1) : '—'}/${st.restA && st.restA.since != null ? st.restA.since.toFixed(1) : '—'} · escolha ${c ? c.k2 + ' @' + c.odd + ' p' + c.p.toFixed(2) : z.k} · selo ${sl ? (sl.grade || 'não') : '—'} · fatores ${JSON.stringify(zeFactors(m, z.k))}`);
        } catch (e) { out.log.push('teste ' + m.home + ': ERRO ' + (e && e.message)); }
      }
    }
    // 4) apostas antigas por fechar e odds de fecho (CLV)
    try { Object.defineProperty(navigator, 'userAgent', { get: () => 'MisterZeRobo/1.0', configurable: true }); } catch (e) { out.log.push('ua: ' + e.message); }
    try { out.atrasadas = await autoCatchUp(true); } catch (e) { out.log.push('atrasadas: ' + (e && e.message)); }
    try { out.clv = await autoClvFill(true); } catch (e) { out.log.push('clv: ' + (e && e.message)); }
  } catch (e) { out.log.push('piloto: ' + (e && e.stack || e)); }
  const wallets = {};
  Object.keys(AUTO_W).forEach(w => { const a = lsGet(AUTO_W[w].key, null); if (a) wallets[w] = Object.assign({}, a, { bets: (a.bets || []).slice(0, 400) }); });
  // histórico completo (nunca se apaga): junta as apostas de agora às de corridas anteriores e escreve o CSV para estudo
  const hist = IN.hist || {}; let csv = null;
  try {
    Object.keys(AUTO_W).forEach(w => { const a = lsGet(AUTO_W[w].key, null); ((a && a.bets) || []).forEach(x => { hist[w + '|' + x.id] = Object.assign({}, x, { w }); }); });
    if (typeof autoCSVText === 'function') csv = autoCSVText(Object.values(hist));
  } catch (e) { out.log.push('histórico: ' + (e && e.message)); }
  return JSON.stringify({ out, wallets, hist, csv, regras: typeof ZE_RULES !== 'undefined' ? ZE_RULES.ver : null, nomes: Object.fromEntries(Object.keys(AUTO_W).map(w => [w, { name: AUTO_W[w].name, desc: AUTO_W[w].desc }])) });
})()
