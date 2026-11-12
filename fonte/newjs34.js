
/* =====================================================================
   v47 · o Zé como analista profissional
   1) Forma de TODAS as competições (liga + taças + Europa): nos jogos europeus a forma vinha só da Champions (1–2 jogos)
   2) Cansaço: quem jogou há ≤3 dias contra quem descansou ≥5 → ajuste pequeno nos golos esperados
   3) Confiança honesta: «alta» só com amostra suficiente, odds das casas e sem grande desacordo com elas
   4) Diário: o Zé contra as casas (Brier) e CLV — se apanha odds antes de elas baixarem (a medida dos profissionais)
   5) Duelo: compara a odd da tua casa com a melhor publicada (procura a melhor odd) e apanha odds mal escritas
   6) «Jogo do dia» com veredito: vale / não vale a odd das casas, e onde há valor
   ===================================================================== */

/* ---------- 1) forma de todas as competições + dias de descanso ---------- */
const ALL_RECENT = new Map();
async function allRecent(id) {
  const c = ALL_RECENT.get(id); if (c && Date.now() - c.t < 3 * 3600e3) return c.v;
  const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${id}/schedule`);
  const evs = (j.events || []).map(ev => normalizeEspn(ev, 'all', '')).filter(Boolean);
  const fin = evs.filter(x => x.status === 'FINISHED').sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate));
  const v = {
    games: fin.slice(0, 10).map(x => { const home = x.homeTeam.id === String(id); return { home, gf: home ? x.score.fullTime.home : x.score.fullTime.away, ga: home ? x.score.fullTime.away : x.score.fullTime.home, d: x.utcDate, opp: home ? x.awayTeam.shortName : x.homeTeam.shortName }; }),
    last: fin[0] ? fin[0].utcDate : null,
    upcoming: evs.filter(x => x.status === 'TIMED' || x.status === 'IN_PLAY').map(x => x.utcDate).sort()
  };
  ALL_RECENT.set(id, { t: Date.now(), v });
  return v;
}
function restInfo(v, kick) {
  if (!v || !kick) return null;
  const k = kick.getTime();
  const prev = (v.games || []).map(g => new Date(g.d).getTime()).filter(t => t < k - 3600e3).sort((a, b) => b - a)[0];
  const next = (v.upcoming || []).map(d => new Date(d).getTime()).filter(t => t > k + 6 * 3600e3).sort((a, b) => a - b)[0];
  return { since: prev ? (k - prev) / 864e5 : null, until: next ? (next - k) / 864e5 : null };
}
zeStudy = (function (prev) {
  return async function (m, status) {
    const st = await prev.apply(this, arguments);
    try {
      if (st && !st.offline && m.espn && m.espn.h && m.espn.a && !(st.allT && Date.now() - st.allT < 3 * 3600e3)) {
        const [vh, va] = await Promise.all([allRecent(m.espn.h).catch(() => null), allRecent(m.espn.a).catch(() => null)]);
        const kick = kickOf(m);
        st.allT = Date.now();
        st.restH = restInfo(vh, kick); st.restA = restInfo(va, kick);
        // nos jogos europeus, a forma da própria competição tem 1–3 jogos: usa todas as competições
        if (/^uefa/.test(m.espn.code || '') && vh && va && vh.games.length >= 4 && va.games.length >= 4) {
          st.recentH = vh.games; st.recentA = va.games; st.formAll = true;
        }
        try { MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear(); } catch (e) {}
      }
    } catch (e) {}
    return st;
  };
})(zeStudy);
/* cansaço → golos esperados (pequeno: 4–6%)
   v50: a simulação de 540 jogos mostrou o contrário (quem joga mais é quem está na Europa = a melhor equipa) → fica só como nota */
var ZE_FATIGUE_ON = false;
lambdasFor = (function (prev) {
  return function (m) {
    const b = prev(m);
    try {
      const st = studyFor(m); if (!st || !st.restH || !st.restA) return b;
      const tired = r => r && r.since != null && r.since <= 3.2;
      const fresh = r => r && (r.since == null || r.since >= 5);
      let lh = b.lh, la = b.la, note = '';
      if (tired(st.restH) && fresh(st.restA)) { lh *= 0.95; la *= 1.04; note = `${m.home} jogou há ${Math.round(st.restH.since)} dias, ${m.away} descansou ${st.restA.since == null ? 'mais' : Math.round(st.restA.since) + ' dias'}`; }
      else if (tired(st.restA) && fresh(st.restH)) { la *= 0.95; lh *= 1.04; note = `${m.away} jogou há ${Math.round(st.restA.since)} dias, ${m.home} descansou ${st.restH.since == null ? 'mais' : Math.round(st.restH.since) + ' dias'}`; }
      // jogo grande daqui a ≤3 dias → risco de poupanças (só aviso, sem mexer nos números)
      st.rotRisk = [st.restH && st.restH.until != null && st.restH.until <= 3 ? m.home : null, st.restA && st.restA.until != null && st.restA.until <= 3 ? m.away : null].filter(Boolean);
      st.fatigueNote = note;
      return note && ZE_FATIGUE_ON ? { ...b, lh: +lh.toFixed(2), la: +la.toFixed(2) } : b;
    } catch (e) { return b; }
  };
})(lambdasFor);

/* ---------- 3) confiança honesta ---------- */
modelo = (function (prev) {
  return function (m) {
    const r = prev.apply(this, arguments);
    try {
      if (!r || !r.mk || r._conf2) return r;
      const st = studyFor(m);
      const out = { ...r, _conf2: true, trace: (r.trace || []).slice() };
      if (st && st.fatigueNote) out.trace.splice(Math.max(1, out.trace.length - 1), 0, { k: 'Descanso', txt: ZE_FATIGUE_ON ? `${esc(st.fatigueNote)} → ajuste pequeno nos golos esperados` : `${esc(st.fatigueNote)} — só nota: nos 540 jogos testados isto não pesou (quem joga mais vezes costuma ser a melhor equipa).` });
      if (st && st.rotRisk && st.rotRisk.length) out.trace.push({ k: 'Calendário', txt: `${st.rotRisk.map(esc).join(' e ')} ${st.rotRisk.length > 1 ? 'voltam' : 'volta'} a jogar daqui a ≤3 dias → pode haver poupanças. Confirma os onzes antes de apostar.` });
      if (st && st.formAll) out.trace.push({ k: 'Forma', txt: 'Jogo europeu: a forma conta com todas as competições (liga, taças e Europa), não só esta.' });
      let conf = r.conf, why = [];
      if (st) {
        const nH = (st.recentH || []).length, nA = (st.recentA || []).length;
        if (nH < 5 || nA < 5) { why.push(`pouca forma recente (${nH} e ${nA} jogos)`); }
        if (!st.market) why.push('sem odds das casas para comparar');
        const mk = st.market;
        if (mk) {
          const fav = ['1', 'X', '2'].sort((a, b) => r.mk[b] - r.mk[a])[0];
          const mp = { '1': mk.p1, X: mk.pX, '2': mk.p2 }[fav];
          const gap = Math.abs(r.mk[fav] - mp);
          if (gap >= 0.12) { conf = 'baixa'; why.push(`discordo das casas no favorito (eu ${pct(r.mk[fav])}, casas ${pct(mp)})`); }
          else if (gap >= 0.07 && conf === 'alta') { conf = 'média'; why.push('alguma diferença para as casas'); }
        }
        if (why.length && conf === 'alta') conf = 'média';
        if (st.rotRisk && st.rotRisk.length && conf === 'alta') { conf = 'média'; why.push('risco de poupanças'); }
      }
      if (conf !== r.conf || why.length) out.trace.push({ k: 'Confiança', txt: `<b>${conf}</b>${why.length ? ' — ' + why.join(' · ') : ''}` });
      out.conf = conf;
      return out;
    } catch (e) { return r; }
  };
})(modelo);

/* ---------- 4) diário: Zé contra as casas e CLV ---------- */
diarySnap = (function (prev) {
  return function (m, d) {
    const D = d || diaryLoad(), key = diaryKey(m), old = D.items[key] ? JSON.parse(JSON.stringify(D.items[key])) : null;
    const ch = prev(m, D);
    try {
      const it = D.items[key]; if (!it || it.res) return ch;
      const st = studyFor(m), books = (st && st.books) || [];
      const best = k => Math.max(0, ...books.map(b => b.odds[k] || 0)) || null;
      // primeira vez que vi valor (a odd «de entrada») fica guardada; a última odd antes do jogo é o «fecho»
      it.valueFirst = (old && old.valueFirst) || (it.value ? { k: it.value.k, odd: it.value.odd, t: Date.now() } : null);
      const keys = [it.valueFirst && it.valueFirst.k, it.pick && it.pick.k].filter(Boolean);
      it.close = Object.assign({}, (old && old.close) || {}, Object.fromEntries(keys.map(k => [k, best(k)]).filter(([, o]) => o)));
      if (!d) diarySave(D);
    } catch (e) {}
    return ch;
  };
})(diarySnap);
diaryGrade = (function (prev) {
  return function (payload) {
    const before = new Set(Object.values(diaryLoad().items).filter(x => x.res).map(x => x.key));
    const n = prev(payload);
    if (!n) return n;
    try {
      const D = diaryLoad();
      Object.values(D.items).forEach(it => {
        if (!it.res || before.has(it.key) || !it.g) return;
        const [i, j] = it.res.split('-').map(Number), o = [i > j ? 1 : 0, i === j ? 1 : 0, i < j ? 1 : 0];
        const brier = q => (q[0] - o[0]) ** 2 + (q[1] - o[1]) ** 2 + (q[2] - o[2]) ** 2;
        it.g.bz = +brier([it.mk['1'], it.mk.X, it.mk['2']]).toFixed(4);
        if (it.odds1x2) { const a = it.odds1x2, s = 1 / a['1'] + 1 / a.X + 1 / a['2']; it.g.bm = +brier([1 / a['1'] / s, 1 / a.X / s, 1 / a['2'] / s]).toFixed(4); }
        if (it.valueFirst && it.close && it.close[it.valueFirst.k]) it.g.clv = +(it.valueFirst.odd / it.close[it.valueFirst.k] - 1).toFixed(4);
      });
      diarySave(D);
    } catch (e) {}
    return n;
  };
})(diaryGrade);
function diaryPro() {
  const all = Object.values(diaryLoad().items).filter(x => x.res && x.g);
  const vm = all.filter(x => x.g.bz != null && x.g.bm != null);
  const cl = all.filter(x => x.g.clv != null);
  return {
    vs: vm.length ? { n: vm.length, bz: vm.reduce((a, x) => a + x.g.bz, 0) / vm.length, bm: vm.reduce((a, x) => a + x.g.bm, 0) / vm.length } : null,
    clv: cl.length ? { n: cl.length, avg: cl.reduce((a, x) => a + x.g.clv, 0) / cl.length, pos: cl.filter(x => x.g.clv > 0).length } : null
  };
}
diaryHTML = (function (prev) {
  return function () {
    let h = prev();
    try {
      const P = diaryPro();
      const vs = P.vs ? `<div class="kv"><span>Eu contra as casas (erro médio, menor é melhor)</span><b>Zé ${P.vs.bz.toFixed(3)} · casas ${P.vs.bm.toFixed(3)} <span class="muted" style="font-weight:400;">(${P.vs.n} j)</span></b></div><div class="muted" style="font-size:.78rem;">${P.vs.bz <= P.vs.bm ? '👏 Estou a prever tão bem ou melhor do que as casas.' : P.vs.n < 30 ? 'As casas ainda acertam melhor do que eu — normal; com mais jogos vê-se a sério.' : 'As casas acertam melhor do que eu: segue-me só onde há valor claro.'}</div>` : '<div class="kv"><span>Eu contra as casas</span><b class="muted" style="font-weight:400;">preciso de jogos estudados com odds</b></div>';
      const clv = P.clv ? `<div class="kv"><span>CLV — odd de entrada vs odd final</span><b>${P.clv.avg >= 0 ? '+' : ''}${(P.clv.avg * 100).toFixed(1)}% <span class="muted" style="font-weight:400;">(${P.clv.pos}/${P.clv.n} a meu favor)</span></b></div><div class="muted" style="font-size:.78rem;">CLV positivo = apanho as odds antes de elas baixarem. É o melhor sinal de que o valor é real (mais fiável do que ganhar ou perder meia dúzia de apostas).</div>` : '';
      h = h.replace('<div style="margin-top:8px;"><b>Por mercado</b>', `<div style="margin-top:8px;"><b>🎓 Medidas de profissional</b>${vs}${clv}</div><div style="margin-top:8px;"><b>Por mercado</b>`);
      if (!/Medidas de profissional/.test(h)) h = h.replace('<div style="margin-top:10px;"><b>📚 Lições</b>', `<div style="margin-top:8px;"><b>🎓 Medidas de profissional</b>${vs}${clv}</div><div style="margin-top:10px;"><b>📚 Lições</b>`);
    } catch (e) {}
    return h;
  };
})(diaryHTML);

/* ---------- 5) duelo: procurar a melhor odd e apanhar erros de escrita ---------- */
zeDecidirUI = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const m = dueloAtual && dueloAtual.m, el = document.getElementById('zeDecision'), st = m && studyFor(m);
      if (!m || !el || !st || !st.books || !st.books.length) return r;
      const notes = [];
      ZE_MARKETS.forEach(k => {
        const inp = document.getElementById('odd_' + k.replace('.', '_')); const mine = inp && Number(inp.value);
        if (!(mine > 1)) return;
        const pub = st.books.map(b => ({ b: b.provider, o: b.odds[k] })).filter(x => x.o > 1).sort((a, b) => b.o - a.o)[0];
        if (!pub) return;
        if (mine > pub.o * 1.25 || mine < pub.o * 0.75) notes.push(`❓ <b>${esc(marketName(k, m))}</b>: meteste ${mine.toFixed(2)} mas a ${esc(pub.b)} paga ${pub.o.toFixed(2)} — confirma se não te enganaste a escrever.`);
        else if (mine < pub.o * 0.96) notes.push(`🔎 <b>${esc(marketName(k, m))}</b>: a tua casa paga ${mine.toFixed(2)}, a ${esc(pub.b)} paga ${pub.o.toFixed(2)} (+${Math.round((pub.o / mine - 1) * 100)}%). Se tiveres conta noutra casa, aposta onde paga mais — é lucro grátis a longo prazo.`);
      });
      if (notes.length) el.insertAdjacentHTML('beforeend', `<div class="reason" style="margin-top:8px;"><div class="rz-head">🛒 Comparar odds</div><div style="font-size:.84rem;line-height:1.5;">${notes.slice(0, 4).join('<br>')}</div></div>`);
    } catch (e) { console.warn(e); }
    return r;
  };
})(zeDecidirUI);

/* ---------- 6) «Jogo do dia» com veredito ---------- */
zeJogosDoDia = function () {
  const list = upcoming(3).slice(0, 6);
  if (!list.length) return { mood: 'pensativo', html: 'Nos próximos 3 dias não tenho jogos confirmados no radar. Carrega em <b>📡 Atualizar</b>.' };
  const rows = list.map(x => {
    const m = x.m, r = modelo(m), st = studyFor(m);
    const best = ['1', '1X', 'O1.5', 'O2.5', 'BTTS', 'U2.5', 'X2', '2'].map(kk => ({ kk, p: r.mk[kk] })).filter(o => o.p >= 0.55 && o.p <= 0.85).sort((a, b) => b.p - a.p)[0];
    const need = best ? 1.03 / best.p : null;
    const pub = best && st && st.books ? Math.max(0, ...st.books.map(b => b.odds[best.kk] || 0)) : 0;
    let val = null; try { val = st && st.books ? oddsValue(m).filter(v => v.ev > zeEdgeFor(0.03, v.o) && v.o <= 6 && v.p >= 0.2 && !v.doubt && (!isContra(v.k, favOf(r.mk), favOf({ '1': 1 / st.books[0].odds['1'], X: 1 / st.books[0].odds.X, '2': 1 / st.books[0].odds['2'] })) || v.ev >= CONTRA_EDGE))[0] : null; } catch (e) {}
    const score = (val ? 2 : 0) + (pub && need && pub >= need ? 1 : 0) + (r.conf === 'alta' ? 0.5 : r.conf === 'baixa' ? -0.5 : 0) + (best ? best.p : 0);
    const line = `<b>${esc(m.home)} vs ${esc(m.away)}</b> (${whenTxt(m)}${m.kickoff ? ', ' + m.kickoff : ''})<br>` +
      (best ? `${esc(marketName(best.kk, m))} ${pct(best.p)} · justa ${need.toFixed(2)}${pub > 1 ? (pub >= need ? ` · casas ${pub.toFixed(2)} ✅ <b>vale</b>` : ` · casas ${pub.toFixed(2)} ❌ não vale`) : st && st.books && st.books.length ? ' · <span class="muted">as casas não dão esta linha</span>' : ' · <span class="muted">sem odds ainda</span>'}` : 'jogo equilibrado — só com odd boa') +
      (val ? `<br>💶 Valor: <b>${esc(marketName(val.k, m))} @ ${val.o.toFixed(2)}</b> (${esc(val.book)}, +${Math.round(val.ev * 100)}%)` : '') +
      ` <span class="muted">· confiança ${esc(r.conf || '—')}${st ? ' 🧠' : ''}</span>`;
    return { m, line, score };
  }).sort((a, b) => b.score - a.score);
  zeLastMatch = rows[0].m;
  return { mood: 'feliz', html: `${pickOne(['Ora bem, o menu dos próximos dias:', 'O que me interessa:', 'Radar ligado:'])}<br>${rows.map((x, i) => `${i === 0 ? '⭐' : '•'} ${x.line}`).join('<br><br>')}<br><br><span class="muted">✅ vale = as casas pagam acima da odd justa · 💶 = aposta com valor (as mesmas regras do duelo) · 🧠 = estudado a fundo. Mete sempre a odd da TUA casa no duelo.</span><br>Fico de olho no <b>${esc(rows[0].m.home)} vs ${esc(rows[0].m.away)}</b> — diz «duelo» ou pergunta-me o que quiseres.` };
};
/* «jogo do dia» sem estudos feitos (ex.: acabaste de abrir a app): estuda os 4 primeiros antes de responder */
zeJogosDoDia = (function (prev) {
  return function () {
    const list = upcoming(3).slice(0, 6).map(x => x.m);
    const todo = list.filter(m => m.espn && m.espn.ev && (!studyFor(m) || (!studyFor(m).market && !studyFor(m).oddsTried))).slice(0, 6);   // v51: todos os da lista (sem odds o Zé exagera nos jogos europeus)
    if (!todo.length || navigator.onLine === false || (typeof espnCooling === 'function' && espnCooling())) return prev();
    return { mood: 'pensativo', html: `Deixa-me ver forma e odds de ${todo.length} ${todo.length > 1 ? 'jogos' : 'jogo'} antes de te responder… 🧐`, later: async () => {
      for (const m of todo) { PRE_NEWS_OFF = true; try { await zeStudy(m); } catch (e) {} finally { PRE_NEWS_OFF = false; } const s = studyFor(m); if (s && s.news && s.news.skipped) delete s.news; }
      try { diarySnapAll(); } catch (e) {}
      return prev();
    } };
  };
})(zeJogosDoDia);
/* nomes de mercados que faltavam (ex.: «U3.5» → «Menos de 3.5 golos») */
marketName = (function (prev) {
  return function (k, m) {
    const n = prev(k, m);
    if (n && n !== k) return n;
    const g = /^([OU])(\d+(?:\.\d+)?)$/.exec(k || '');
    return g ? `${g[1] === 'O' ? 'Mais' : 'Menos'} de ${g[2]} golos` : n;
  };
})(marketName);
