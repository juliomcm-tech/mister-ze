/* =====================================================================
   v55 · ESPN sem intervalos · H2H real · Continuar certo · Marcadores de hoje · Ao vivo · partilha nova
   1) A ESPN deixou de aceitar «dates=AAAAMMDD-AAAAMMDD» (responde 400). Quando falha, o Zé pede mês a mês
      (ou dia a dia) e junta — o «Atualizar», os marcadores e o calendário continuam a funcionar.
   2) H2H recente: vem do «seasonseries» do resumo da ESPN (últimos confrontos, várias épocas).
      Só informação — não mexe nas contas do Zé (a simulação foi feita sem isto).
   3) «Continuar» = o mesmo jogo do banner (1.º desafio do Zé) e atualiza-se sozinho.
   4) ⚽ Marcadores de hoje: os mais prováveis do dia (golos da época, forma, defesa do adversário,
      onze inicial quando já saiu, penáltis). Guarda e confere com os marcadores reais.
      Simulação desta época (9 ligas, 5 836 casos): 20–30% → 27%; 30–40% → 32%; 40–50% → 46%.
   5) ⚡ Ao vivo: probabilidade de mais golos a partir do minuto, do resultado, das expulsões e das
      expectativas antes do jogo. Curva de tempo medida em 949 jogos desta época.
   6) Partilha de apostas: quem apostou (nome + foto ou o Zé), datas dos jogos, estado de cada
      seleção e várias imagens quando a múltipla é grande.
   ===================================================================== */

/* ---------- 1) ESPN: intervalo de datas → mês a mês ---------- */
let ESPN_RANGE_BAD = false, ESPN_RANGE_PROBED = false;
function espnSplitUrls(url, d1, d2) {
  const p = s => new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  const a = p(d1), b = p(d2), days = Math.round((b - a) / 864e5);
  const base = url.replace(/dates=\d{8}-\d{8}/, 'dates=__D__').replace(/([?&])limit=\d+/, '$1limit=1000');
  const withLimit = /[?&]limit=/.test(base) ? base : base + '&limit=1000';
  const out = [];
  if (days <= 3) { for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) out.push(withLimit.replace('__D__', ymd(d))); }
  else { const d = new Date(a.getFullYear(), a.getMonth(), 1); while (d <= b) { out.push(withLimit.replace('__D__', d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0'))); d.setMonth(d.getMonth() + 1); } }
  return out;
}
fetchJSON = (function (prev) {
  return async function (url) {
    const m = /scoreboard\?.*dates=(\d{8})-(\d{8})/.exec(String(url || ''));
    if (!m) return prev.apply(this, arguments);
    // já se sabe que os intervalos falham (preferência guardada = semana/dia): ir direto ao mês, que são 1–2 pedidos
    if (!ESPN_RANGE_BAD && lsGet('ze_espn_variant', 0) >= 3) ESPN_RANGE_BAD = true;
    if (ESPN_RANGE_BAD && !ESPN_RANGE_PROBED) {
      // uma vez por sessão: a ESPN já voltou a aceitar intervalos?
      ESPN_RANGE_PROBED = true;
      try { const j = await getJSONany(url); lsSet('ze_espn_variant', 0); ESPN_RANGE_BAD = false; return j; } catch (e) { if (e && e.cool) throw e; }
    }
    if (!ESPN_RANGE_BAD) {
      try { return await prev.apply(this, arguments); } catch (e) { if (e && e.cool) throw e; ESPN_RANGE_BAD = true; ESPN_RANGE_PROBED = true; lsSet('ze_espn_variant', 3); }
    }
    const urls = espnSplitUrls(url, m[1], m[2]);
    const res = await Promise.all(urls.map((u, k) => {
      const mk = /dates=(\d{6,8})/.exec(u), c = ESPN_MONTH_CACHE.get(u);
      if (c && mk && Date.now() - c.t < espnMonthTTL(mk[1].slice(0, 6))) return Promise.resolve(c.j);
      return new Promise(r => setTimeout(r, k * 80)).then(() => prev(u)).then(j => { if (j && mk) ESPN_MONTH_CACHE.set(u, { t: Date.now(), j }); return j; }).catch(() => null);
    }));
    const ok = res.filter(Boolean);
    if (!ok.length) throw new Error('ESPN sem resposta');
    const seen = new Set(), events = [];
    const lo = m[1].slice(0, 4) + '-' + m[1].slice(4, 6) + '-' + m[1].slice(6, 8), hi = m[2].slice(0, 4) + '-' + m[2].slice(4, 6) + '-' + m[2].slice(6, 8);
    ok.forEach(j => (j.events || []).forEach(ev => {
      if (!ev || seen.has(ev.id)) return;
      const d = String(ev.date || '').slice(0, 10);
      // margem de 1 dia (a ESPN usa datas dos EUA)
      if (d && (d < isoDay(new Date(new Date(lo).getTime() - 864e5)) || d > isoDay(new Date(new Date(hi).getTime() + 864e5)))) return;
      seen.add(ev.id); events.push(ev);
    }));
    return Object.assign({}, ok[0], { events });
  };
})(fetchJSON);

/* ---------- 2) H2H real ---------- */
const H2H_KEY = 'ze_h2h_v1';
function h2hKey(m) { return m && m.espn ? m.espn.code + '|' + m.espn.h + '|' + m.espn.a : null; }
function h2hFromSummary(summ, m) {
  const ss = (summ && summ.seasonseries) || [], list = [], seen = new Set();
  const cur = m && m.espn && String(m.espn.ev || '');
  ss.forEach(s => (s.events || []).forEach(e => {
    if (!e || seen.has(e.id) || (cur && String(e.id) === cur)) return;
    const st = e.statusType || {};
    if (st.completed === false || /POSTPON|CANCEL|SCHEDULED|ABANDON/i.test(String(st.name || ''))) return;
    const C = e.competitors || [], H = C.find(c => c.homeAway === 'home'), A = C.find(c => c.homeAway === 'away');
    if (!H || !A) return;
    const hs = Number(H.score && H.score.value != null ? H.score.value : H.score), as = Number(A.score && A.score.value != null ? A.score.value : A.score);
    if (!isFinite(hs) || !isFinite(as) || H.score === '' || A.score === '') return;
    if (new Date(e.date).getTime() > Date.now()) return;
    seen.add(e.id);
    list.push({ d: e.date, hId: String((H.team && H.team.id) || ''), aId: String((A.team && A.team.id) || ''), hAb: (H.team && (H.team.abbreviation || H.team.shortDisplayName)) || '', aAb: (A.team && (A.team.abbreviation || A.team.shortDisplayName)) || '', hs, as, c: e.competitionName || '' });
  }));
  return list.sort((x, y) => new Date(y.d) - new Date(x.d)).slice(0, 6);
}
function h2hSave(m, list) {
  const k = h2hKey(m); if (!k) return;
  const c = lsGet(H2H_KEY, {}); c[k] = { t: Date.now(), v: list };
  const ks = Object.keys(c); if (ks.length > 150) ks.sort((x, y) => c[x].t - c[y].t).slice(0, ks.length - 150).forEach(x => delete c[x]);
  lsSet(H2H_KEY, c);
  try { const s = h2hShort(m, list); if (s) m.h2h = s; } catch (e) {}
}
function h2hGet(m) { const k = h2hKey(m); if (!k) return null; const c = lsGet(H2H_KEY, {}); return c[k] && Date.now() - c[k].t < 24 * 3600e3 ? c[k].v : null; }
function h2hStats(m, list) {
  let w = 0, d = 0, l = 0, g = 0, bt = 0;
  list.forEach(x => {
    const homeIsH = x.hId === String(m.espn.h);
    const gf = homeIsH ? x.hs : x.as, ga = homeIsH ? x.as : x.hs;
    if (gf > ga) w++; else if (gf === ga) d++; else l++;
    g += x.hs + x.as; if (x.hs > 0 && x.as > 0) bt++;
  });
  return { n: list.length, w, d, l, avg: list.length ? g / list.length : 0, btts: list.length ? bt / list.length : 0 };
}
function h2hShort(m, list) {
  if (!list || !list.length) return 'Sem confrontos recentes nesta competição';
  const s = h2hStats(m, list);
  return `${m.home} ${s.w}V ${s.d}E ${s.l}D nos últimos ${s.n} · ${s.avg.toFixed(1).replace('.', ',')} golos/jogo`;
}
function h2hName(m, id, ab) { return id === String(m.espn.h) ? m.home : id === String(m.espn.a) ? m.away : ab; }
function h2hHTML(m, list) {
  if (!list) return '<span class="muted">sem dados</span>';
  if (!list.length) return '<span class="muted">Sem confrontos recentes nesta competição (a ESPN só guarda os da mesma prova).</span>';
  const s = h2hStats(m, list);
  return `<div style="margin:2px 0 6px;"><b>${esc(m.home)}</b> ${s.w}V ${s.d}E ${s.l}D · ${s.avg.toFixed(1).replace('.', ',')} golos/jogo · ambas marcaram ${Math.round(s.btts * 100)}%</div>` +
    list.map(x => { const dt = new Date(x.d); return `<div style="display:flex;gap:8px;font-size:.8rem;"><span class="muted" style="min-width:62px;">${dt.getDate()}/${dt.getMonth() + 1}/${String(dt.getFullYear()).slice(2)}</span><span>${esc(h2hName(m, x.hId, x.hAb))} <b>${x.hs}-${x.as}</b> ${esc(h2hName(m, x.aId, x.aAb))}</span></div>`; }).join('') +
    `<div class="muted" style="font-size:.7rem;margin-top:4px;">Só informação: plantéis mudam, o Zé não decide por aqui.</div>`;
}
async function h2hLoad(m) {
  if (!m || !m.espn || !m.espn.ev) return null;
  const hit = h2hGet(m); if (hit) return hit;
  const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${m.espn.code}/summary?event=${m.espn.ev}`);
  const list = h2hFromSummary(j, m);
  h2hSave(m, list);
  return list;
}
/* o estudo já lê o resumo: aproveita (o modelo continua igual — parseH2H devolve o mesmo de antes) */
parseH2H = (function (prev) { return function (summary, m) { try { if (summary && summary.seasonseries && m && m.espn) h2hSave(m, h2hFromSummary(summary, m)); } catch (e) {} return prev.apply(this, arguments); }; })(parseH2H);
openModal = (function (prev) {
  return function (m) {
    const r = prev.apply(this, arguments);
    try {
      const body = document.getElementById('modal-body'), box = body && body.querySelector('.h2h');
      if (box && m && m.espn) {
        const paint = list => { if (window._modalMatch === m || !window._modalMatch) box.innerHTML = `<strong>H2H recente:</strong> ${h2hHTML(m, list)}`; };
        const hit = h2hGet(m);
        if (hit) paint(hit);
        else if (m.espn.ev) { box.innerHTML = '<strong>H2H recente:</strong> <span class="muted">⏳ a procurar os últimos confrontos…</span>'; h2hLoad(m).then(paint).catch(() => { box.innerHTML = `<strong>H2H recente:</strong> <span class="muted">não consegui ligar à ESPN agora.</span>`; }); }
      }
      if (m && m.espn && lvIsLive(m)) lvModalBlock(m);
    } catch (e) { console.warn(e); }
    return r;
  };
})(openModal);

/* ---------- 3) Continuar = jogo do dia ---------- */
pickDueloMatch = (function (prev) {
  return function () {
    try { const c = zeChallenges(36)[0]; if (c) return c.m; } catch (e) {}
    try { if (typeof rvPickOfDay === 'function') { const p = rvPickOfDay(); if (p && p.m) return p.m; } } catch (e) {}
    return prev.apply(this, arguments);
  };
})(pickDueloMatch);
proximaAcao = (function (prev) {
  return function () {
    try {
      const c = zeChallenges(36)[0];
      if (c) {
        const key = c.m.home + ' vs ' + c.m.away;
        if (!loadBank().zeBets.some(x => x.match === key)) return { label: 'Duelo: ' + key, run: () => { fmGo('duelo'); aceitarDesafio(c.i); } };
      }
    } catch (e) {}
    return prev.apply(this, arguments);
  };
})(proximaAcao);
renderPortal = (function (prev) { return function () { const r = prev.apply(this, arguments); try { updateContinue(); } catch (e) {} return r; }; })(renderPortal);
if (!/jsdom/i.test(navigator.userAgent || '')) setInterval(() => { try { if (!document.hidden) updateContinue(); } catch (e) {} }, 60e3);

/* ---------- 4) ⚽ Marcadores de hoje ---------- */
const SCO_KEY = 'ze_scorers_v1';
let SCO_CUR = null;
function scoLog() { return lsGet(SCO_KEY, { picks: {} }); }
function scoGames() {
  const now = Date.now(), t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const all = matches.map((m, i) => ({ m, i, k: kickOf(m) })).filter(x => x.m.live && x.m.espn && !x.m.past && !x.m.aviso && x.k && x.m.sport !== 'nba' && !/nba/i.test(x.m.espn.code || ''));
  const day = off => { const a = new Date(t0); a.setDate(a.getDate() + off); const b = new Date(a); b.setDate(b.getDate() + 1); return all.filter(x => x.k >= a && x.k < b && x.k.getTime() > now + 2 * 60e3); };
  let list = day(0), when = 'hoje';
  if (!list.length) { list = day(1); when = 'amanhã'; }
  list.forEach(x => { try { const r = modelo(x.m); x.xg = r.lh + r.la; } catch (e) { x.xg = 0; } x.st = studyFor(x.m) ? 1 : 0; });
  return { when, total: list.length, list: list.sort((a, b) => (b.st - a.st) || (b.xg - a.xg)).slice(0, 12).sort((a, b) => a.k - b.k) };
}
function scoWhy(m, p, side) {
  const bits = [];
  const def = defenceOf(m, side === 'home' ? 'a' : 'h'), opp = side === 'home' ? m.away : m.home;
  if (p.goals) bits.push(`${p.goals} golo${p.goals === 1 ? '' : 's'} na época (${Math.round(p.share * 100)}% dos da equipa)`);
  if ((p.g5 || 0) >= 2) bits.push(`🔥 ${p.g5} nos últimos ${p.n5 || 5} jogos`);
  if (def && def.weak) bits.push(`🛡️ ${esc(opp)} sofre ${def.ga.toFixed(1).replace('.', ',')}/jogo (${def.rank}.ª pior defesa)`);
  else if (def && def.ratio < 0.8) bits.push(`🧱 ${esc(opp)} defende bem (${def.ga.toFixed(1).replace('.', ',')}/jogo)`);
  if (p.pens) bits.push(`🎯 marca penáltis (${p.pens})`);
  if (p.status === 'titular') bits.push('✅ no onze');
  if (p.mkt != null) bits.push(`casas ${Math.round(p.mkt * 100)}%`);
  return bits.join(' · ');
}
async function zeScorersToday(boxId) {
  const box = document.getElementById(boxId || (currentView === 'dia' ? 'dayResult' : 'scorersBox')); if (!box) return;
  box.classList.add('show'); setTimeout(() => { try { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }, 60);
  const G = scoGames();
  if (!G.list.length) { box.innerHTML = `<h3>⚽ Marcadores de hoje</h3><div class="muted">Hoje e amanhã já não há jogos por começar. Carrega em 📡 Atualizar mais logo.</div>${scoStatsHTML()}`; return; }
  box.innerHTML = `<h3>⚽ Marcadores ${G.when === 'hoje' ? 'de hoje' : 'de amanhã'}</h3><div class="muted" id="scoProg">⏳ A estudar ${G.list.length} jogo${G.list.length === 1 ? '' : 's'} (marcadores da época, plantéis e onzes)…</div>`;
  let done = 0; const boards = [];
  const work = G.list.slice();
  const one = async () => { while (work.length) { const x = work.shift(); let b = null; try { b = boardFor(x.m) || (studyFor(x.m) && studyFor(x.m).board) || await playerBoard(x.m); } catch (e) {} if (b) boards.push({ x, b }); done++; const p = document.getElementById('scoProg'); if (p) p.textContent = `⏳ A estudar… ${done}/${G.list.length}`; } };
  await Promise.all([one(), one(), one()]);
  const cand = [];
  boards.forEach(({ x, b }) => ['home', 'away'].forEach(side => (b[side] || []).forEach(p => {
    if (!p || p.status === 'fora' || p.status === 'lesão' || p.status === 'suplente' || p.pos === 'G' || !(p.prob >= 0.12)) return;
    cand.push({ x, p, side, team: side === 'home' ? x.m.home : x.m.away, opp: side === 'home' ? x.m.away : x.m.home, lu: !!b.lineupKnown });
  })));
  const per = {};
  const top = cand.sort((a, b) => b.p.prob - a.p.prob).filter(c => { const k = c.x.i + c.side; per[k] = (per[k] || 0) + 1; return per[k] <= 2; }).slice(0, 10);
  SCO_CUR = top;
  scoSave(top);
  const exp = top.reduce((s, c) => s + c.p.prob, 0);
  box.innerHTML = `<h3>⚽ Marcadores ${G.when === 'hoje' ? 'de hoje' : 'de amanhã'}</h3>
    <div class="day-meta">Os ${top.length} jogadores com mais hipótese de marcar ${G.when}, em ${boards.length} jogo${boards.length === 1 ? '' : 's'}${G.total > G.list.length ? ` (os ${G.list.length} com mais golos esperados de ${G.total})` : ''}. Conta: golos esperados da equipa (ataque vs defesa adversária) × quota de golos do jogador × se joga. <b>Marcador é sempre arriscado</b>: dos 10, o normal é acertarem <b>${Math.round(exp)}</b>.</div>
    ${top.length ? `<div class="panel"><div class="panel-b" id="scoLegs">${top.map((c, i) => `<div class="ss-leg"><input type="checkbox" data-i="${i}" ${i < 3 ? 'checked' : ''} onchange="scoSum()">
      <div><b>${esc(c.p.name)}</b> <span class="muted">(${esc(c.team)})</span>${i < 3 ? ' <span class="muted">· top 3</span>' : ''}<div class="muted" style="font-size:.78rem;">vs ${esc(c.opp)} · ${esc(c.x.m.kickoff || '')} · ${esc(c.x.m.league || '')}${c.lu ? '' : ' · onze ainda não saiu'}</div>
      <div style="font-size:.78rem;">Zé: <b style="color:var(--lime)">${pct(c.p.prob)}</b> · justa ${fairOdd(c.p.prob)}${scoWhy(c.x.m, c.p, c.side) ? ' · ' + scoWhy(c.x.m, c.p, c.side) : ''}</div></div>
      <input class="inp od" type="number" inputmode="decimal" step="0.01" min="1.01" placeholder="${fairOdd(c.p.prob)}" title="odd da tua casa" oninput="scoSum()"></div>`).join('')}</div></div>
      <div class="muted" style="font-size:.76rem;margin-top:4px;">Mete a odd da tua casa em «marca a qualquer momento». Só vale a pena se a odd for maior do que a justa. Antes do onze sair, o Zé desconta quem pode ficar no banco — volta a abrir 1 h antes do jogo para ver os onzes.</div>
      <div class="ss-sum" id="scoSum"></div>` : '<div class="muted">Não encontrei marcadores com dados suficientes nestes jogos (ligas sem lista de marcadores na ESPN).</div>'}
    ${scoStatsHTML()}
    <div class="hint" style="margin-top:8px;">🧪 Simulação nesta época (9 ligas, 5 836 casos, sem saber os onzes): quando o Zé dá 20–30% acertou 27%; 30–40% → 32%; 40–50% → 46%. Os 10 do dia acertaram 29% (prometia 25%).</div>`;
  scoSum();
}
function scoSave(top) {
  const L = scoLog(); const day = isoDay(new Date());
  top.forEach(c => {
    const id = c.x.m.espn.ev + '|' + normTxt(c.p.name);
    const o = L.picks[id];
    if (o && o.w != null) return;
    if (o && Date.now() > o.k) return;
    L.picks[id] = { ev: String(c.x.m.espn.ev), n: c.p.name, tm: c.team, h: c.x.m.home, a: c.x.m.away, p: +c.p.prob.toFixed(3), k: c.x.k.getTime(), lu: c.lu ? 1 : 0, day, top3: (o && o.top3) || (top.indexOf(c) < 3 ? 1 : 0), d: (o && o.d) || Date.now() };
  });
  const ids = Object.keys(L.picks); if (ids.length > 600) ids.sort((x, y) => L.picks[x].d - L.picks[y].d).slice(0, ids.length - 600).forEach(id => delete L.picks[id]);
  lsSet(SCO_KEY, L);
}
function scoSel() {
  const out = [];
  document.querySelectorAll('#scoLegs .ss-leg').forEach(row => { const cb = row.querySelector('input[type=checkbox]'); if (!cb || !cb.checked) return; const c = SCO_CUR[+cb.dataset.i]; const od = parseFloat(String(row.querySelector('.od').value).replace(',', '.')) || 0; out.push({ c, od }); });
  return out;
}
function scoSum() {
  const el = document.getElementById('scoSum'); if (!el || !SCO_CUR) return;
  const S = scoSel(); const P = S.reduce((a, x) => a * x.c.p.prob, 1), O = S.reduce((a, x) => a * (x.od > 1 ? x.od : 1), 1);
  const anyOne = 1 - S.reduce((a, x) => a * (1 - x.c.p.prob), 1);
  el.innerHTML = S.length ? `<b>${S.length} escolhido${S.length === 1 ? '' : 's'}</b> · pelo menos um marca: <b style="color:var(--lime)">${pct(anyOne)}</b>${S.length > 1 ? ` · todos marcam (múltipla): <b>${pct(P)}</b>` : ''}${O > 1 ? ` · odd ${O.toFixed(2)}` : ''}
    ${S.length > 1 && P < 0.1 ? '<div class="muted" style="font-size:.76rem;">⚠️ Múltipla de marcadores quase nunca entra — o Zé prefere simples.</div>' : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:8px;"><label class="lbl">Valor (€)<input id="scoStake" class="inp" type="number" inputmode="decimal" min="0.1" step="0.1" placeholder="ex. 1" style="width:90px;"></label>
    <button class="btn btn-primary" onclick="scoRegister(false)">Registar cada um (simples)</button>${S.length > 1 ? '<button class="btn" onclick="scoRegister(true)">Registar como múltipla</button>' : ''}</div>` : 'Escolhe pelo menos um jogador para registar.';
}
function scoRegister(multi) {
  const S = scoSel(); if (!S.length) return;
  const stake = parseFloat(String((document.getElementById('scoStake') || {}).value || '').replace(',', '.'));
  if (!(stake > 0)) { toast('Mete o valor primeiro.'); return; }
  if (S.some(x => !(x.od > 1))) { toast('Falta a odd de algum jogador.'); return; }
  const leg = x => ({ home: x.c.x.m.home, away: x.c.x.m.away, sel: `${x.c.p.name} marca`, odd: +x.od.toFixed(2), market: 'scorer' });
  let n = 0;
  if (multi) { const O = S.reduce((a, x) => a * x.od, 1); if (addBet({ match: `Marcadores do Zé (${S.length})`, pick: 'Múltipla de marcadores', odd: +O.toFixed(2), stake, legs: S.map(leg), source: 'marcadores' }, 'you')) n = 1; }
  else S.forEach(x => { if (addBet({ match: `${x.c.x.m.home} vs ${x.c.x.m.away}`, pick: `${x.c.p.name} marca`, odd: +x.od.toFixed(2), stake, legs: [leg(x)], source: 'marcadores' }, 'you')) n++; });
  if (n) { toast(`✅ ${n} aposta${n > 1 ? 's' : ''} registada${n > 1 ? 's' : ''}.`); try { renderBanca(); } catch (e) {} }
}
function scoNameHit(n, list) {
  const k = normTxt(n), last = k.split(' ').filter(x => x.length >= 3).pop() || k;
  return (list || []).some(s => { const t = normTxt(s); return t === k || (last && t.split(' ').includes(last)); });
}
function scoGrade(payload) {
  const all = (payload && payload.matches) || [];
  if (!all.length) return 0;
  const L = scoLog(); let n = 0, ch = false;
  Object.keys(L.picks).forEach(id => {
    const x = L.picks[id]; if (x.w != null) return;
    const e = all.find(z => String(z.id) === String(x.ev)); if (!e) return;
    if (e.status === 'POSTPONED') { delete L.picks[id]; ch = true; return; }
    if (e.status !== 'FINISHED' || !e.score || !e.score.fullTime || e.score.fullTime.home == null) return;
    const tot = e.score.fullTime.home + e.score.fullTime.away;
    if (!Array.isArray(e.scorers) || (!e.scorers.length && tot > 0)) return;
    x.w = scoNameHit(x.n, e.scorers) ? 1 : 0; x.res = e.score.fullTime.home + '-' + e.score.fullTime.away; n++; ch = true;
  });
  if (ch) lsSet(SCO_KEY, L);
  return n;
}
function scoStats() {
  const g = Object.values(scoLog().picks).filter(x => x.w != null);
  if (!g.length) return null;
  const t3 = g.filter(x => x.top3);
  return { n: g.length, w: g.filter(x => x.w).length, p: g.reduce((a, x) => a + x.p, 0) / g.length, t3n: t3.length, t3w: t3.filter(x => x.w).length, t3p: t3.length ? t3.reduce((a, x) => a + x.p, 0) / t3.length : 0 };
}
function scoStatsHTML() {
  const s = scoStats();
  return `<div class="hint" style="margin-top:12px;">📊 ${s ? `Marcadores do Zé já decididos: <b>${s.w} de ${s.n}</b> marcaram (${Math.round(100 * s.w / s.n)}%; ele prometia ${Math.round(s.p * 100)}%).${s.t3n ? ` Top 3 do dia: ${s.t3w}/${s.t3n} (prometia ${Math.round(s.t3p * 100)}%).` : ''}` : 'Ainda não há marcadores decididos — o Zé guarda os 10 de cada dia e confere com os marcadores reais quando o jogo acaba.'}</div>`;
}
applyLive = (function (prev) { return function (payload) { const r = prev.apply(this, arguments); try { scoGrade(payload); } catch (e) {} return r; }; })(applyLive);
zeLogText = (function (prev) { return function () { let t = prev.apply(this, arguments); try { const s = scoStats(); if (s) t = t.replace(/\n(erros:)/, `\nmarcadores: ${s.w}/${s.n} prometia ${Math.round(s.p * 100)}%${s.t3n ? ` · top3 ${s.t3w}/${s.t3n} p${Math.round(s.t3p * 100)}` : ''}\n$1`); } catch (e) {} return t; }; })(zeLogText);
raioXHTML = (function (prev) { return function (chat) { let h = prev.apply(this, arguments); try { const s = scoStats(); if (s) h += `<div class="muted" style="font-size:.8rem;margin-top:8px;">⚽ Marcadores do Zé: ${s.w}/${s.n} marcaram (${Math.round(100 * s.w / s.n)}%, prometia ${Math.round(s.p * 100)}%).</div>`; } catch (e) {} return h; }; })(raioXHTML);

/* ---------- 5) ⚡ Ao vivo ---------- */
// curva de golos (quota dos golos de um jogo já marcados ao minuto t), medida em 949 jogos desta época
const LV_F1 = [[0, 0], [5, .037], [10, .089], [20, .178], [30, .279], [40, .370], [45, .418]];
const LV_F2 = [[45, .442], [46, .450], [50, .499], [60, .616], [70, .733], [80, .822], [85, .880], [88, .913], [90, .937]];
function lvInterp(T, t) { if (t <= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) if (t <= T[i][0]) { const [a, fa] = T[i - 1], [b, fb] = T[i]; return fa + (fb - fa) * (t - a) / (b - a); } return T[T.length - 1][1]; }
function lvClock(ev) {
  const st = (ev.status || (ev.competitions && ev.competitions[0] && ev.competitions[0].status) || {}), ty = st.type || {};
  const per = +st.period || 1, disp = String(st.displayClock || ''), short = String(ty.shortDetail || ty.detail || '');
  const mm = disp.match(/(\d+)'?(?:\s*\+\s*(\d+))?/);
  const base = mm ? +mm[1] : 0, plus = mm && mm[2] ? +mm[2] : 0;
  if (/^HT|half.?time|intervalo/i.test(short) || ty.name === 'STATUS_HALFTIME') return { t: 45, per: 1, ht: true, label: 'Intervalo', F: .442 };
  if (per >= 3) return { t: 90 + (base > 90 ? base - 90 : 0), per, label: 'Prolongamento ' + disp, F: 0, et: true };
  if (per === 1) { const F = base >= 45 ? .418 + .024 * Math.min(1, plus / 4) : lvInterp(LV_F1, base); return { t: base, plus, per, label: disp || short, F }; }
  let F;
  if (base >= 90) F = plus >= 8 ? .999 : plus >= 6 ? .993 : plus >= 3 ? .971 + (.993 - .971) * (plus - 3) / 3 : .937 + (.971 - .937) * plus / 3;
  else F = lvInterp(LV_F2, Math.max(45, base));
  return { t: base, plus, per, label: disp || short, F };
}
function lvParse(ev) {
  const c = ev.competitions && ev.competitions[0]; if (!c) return null;
  const H = c.competitors.find(x => x.homeAway === 'home'), A = c.competitors.find(x => x.homeAway === 'away');
  if (!H || !A) return null;
  const st = ((c.status || ev.status || {}).type) || {};
  const det = c.details || [];
  const red = tid => det.filter(d => (d.redCard || /red card/i.test((d.type && d.type.text) || '')) && String((d.team && d.team.id) || '') === String(tid)).length;
  const goals = det.filter(d => (d.scoringPlay || /goal/i.test((d.type && d.type.text) || ''))).map(d => ({ min: (d.clock && d.clock.displayValue) || '', team: String((d.team && d.team.id) || ''), who: ((d.athletesInvolved || [])[0] || {}).displayName || '', og: !!d.ownGoal, pen: !!d.penaltyKick }));
  return { id: String(ev.id), date: ev.date, state: st.state, done: !!st.completed, hId: String(H.team.id), aId: String(A.team.id), hn: H.team.shortDisplayName || H.team.displayName, an: A.team.shortDisplayName || A.team.displayName,
    hs: Number(scoreVal(H.score)) || 0, as: Number(scoreVal(A.score)) || 0, rh: red(H.team.id), ra: red(A.team.id), goals, clock: lvClock(Object.assign({}, ev, { status: c.status || ev.status })) };
}
function lvPois(l, k) { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; }
function lvCalc(m, L) {
  let r = null; try { r = modelo(m); } catch (e) {}
  if (!r) return null;
  const rem = L.clock.et ? 0.33 * (r.lh + r.la > 0 ? 1 : 0) : Math.max(0, 1 - L.clock.F);
  // expulsões: quem fica com menos marca menos, o outro um pouco mais
  let fh = 1, fa = 1;
  if (L.rh) { fh *= Math.pow(0.75, L.rh); fa *= Math.pow(1.15, L.rh); }
  if (L.ra) { fa *= Math.pow(0.75, L.ra); fh *= Math.pow(1.15, L.ra); }
  const eh = r.lh * rem * fh, ea = r.la * rem * fa;
  let p1 = 0, pX = 0, p2 = 0;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) { const p = lvPois(eh, i) * lvPois(ea, j), H = L.hs + i, A = L.as + j; if (H > A) p1 += p; else if (H === A) pX += p; else p2 += p; }
  const s = p1 + pX + p2;
  const tot = L.hs + L.as;
  return { r, rem, eh, ea, pH: 1 - Math.exp(-eh), pA: 1 - Math.exp(-ea), pMore: 1 - Math.exp(-eh - ea), p2more: 1 - Math.exp(-eh - ea) * (1 + eh + ea), p1: p1 / s, pX: pX / s, p2: p2 / s, line: tot + 0.5, line2: tot + 1.5 };
}
let LV_TIMER = null, LV_LAST = null, LV_BUSY = false, LV_MATCHES = [], LV_STR = {}, LV_REG = {};
function lvStrengths() {
  const P = lsGet(LIVE_KEY, null), k = P && P.generatedAt;
  if (LV_STR.k !== k) { LV_STR = { k, s: {} }; Object.keys((P && P.standings) || {}).forEach(c => { try { LV_STR.s[c] = computeStrengths(P.standings[c]); } catch (e) {} }); }
  return LV_STR.s;
}
/* um jogo a decorrer volta a ser «jogo do Zé» com as mesmas contas de antes do apito (tabelas + estudo, se houver) */
function lvBuild(x) {
  try {
    const comp = (x.competition && x.competition.code) || '', d = new Date(x.utcDate);
    const home = x.homeTeam.shortName || x.homeTeam.name, away = x.awayTeam.shortName || x.awayTeam.name;
    let lam = null; try { const S = lvStrengths()[comp]; if (S) lam = lambdasLive(S, x.homeTeam.id, x.awayTeam.id); } catch (e) {}
    const m = { phase: 'imediato', type: 'best', live: true, inplay: true, home, away, date: `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`,
      league: (x.competition && x.competition.name) || FD_COMPS[comp] || comp, h2h: '—', prob: '', analysis: '', note: '', stats: '', team: home,
      lambdas: lam, espn: { h: String(x.homeTeam.id), a: String(x.awayTeam.id), code: comp, ev: String(x.id || '') },
      kickoff: d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) };
    if (!lam && !studyFor(m)) return null;
    return m;
  } catch (e) { return null; }
}
applyLive = (function (prev) {
  return function (payload) {
    const r = prev.apply(this, arguments);
    try { LV_MATCHES = ((payload && payload.matches) || []).filter(x => x && x.status === 'IN_PLAY' && x.homeTeam && x.awayTeam && !/nba/i.test((x.competition && x.competition.code) || '')).map(lvBuild).filter(Boolean); } catch (e) {}
    return r;
  };
})(applyLive);
function lvOpen(id) { const m = LV_REG[id]; if (m) openModal(m); }
function lvIsLive(m) { const k = kickOf(m); return !!(k && k.getTime() <= Date.now() && k.getTime() > Date.now() - 2.6 * 3600e3 && !m.past); }
async function lvScan() {
  const pool = matches.filter(m => m.espn && m.live && lvIsLive(m) && !/nba/i.test(m.espn.code || '')).concat(LV_MATCHES);
  const codes = [...new Set(pool.map(m => m.espn.code))];
  const days = [ymd(new Date())];
  const t = new Date(); if (t.getHours() < 3) { const y = new Date(t); y.setDate(y.getDate() - 1); days.push(ymd(y)); }
  const evs = [];
  let fail = 0;
  await Promise.all(codes.flatMap(code => days.map(d => fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${d}`).then(j => (j.events || []).forEach(ev => { const L = lvParse(ev); if (L) { L.code = code; evs.push(L); } })).catch(() => { fail++; return null; }))));
  const out = [];
  evs.filter(L => L.state === 'in').forEach(L => {
    const m = pool.find(x => x.espn && String(x.espn.ev) === L.id) || pool.find(x => x.espn && String(x.espn.h) === L.hId && String(x.espn.a) === L.aId)
      || lvBuild({ id: L.id, utcDate: L.date, competition: { code: L.code, name: (typeof ESPN_LEAGUES !== 'undefined' && ESPN_LEAGUES[L.code]) || (typeof EXTRA_LEAGUES !== 'undefined' && EXTRA_LEAGUES[L.code]) || '' }, homeTeam: { id: L.hId, shortName: L.hn }, awayTeam: { id: L.aId, shortName: L.an } });
    if (m) { LV_REG[L.id] = m; out.push({ m, L, c: lvCalc(m, L) }); }
  });
  LV_LAST = { t: Date.now(), out, codes: codes.length, fail: codes.length && fail >= codes.length * days.length };
  return LV_LAST;
}
function lvCardHTML(o) {
  const { m, L, c } = o; if (!c) return '';
  LV_REG[L.id] = m;
  const red = (n) => n ? ` <span title="expulsões" style="display:inline-block;width:9px;height:12px;background:#ff4d5e;border-radius:2px;vertical-align:-1px;"></span>${n > 1 ? '×' + n : ''}` : '';
  const trail = L.hs === L.as ? null : (L.hs < L.as ? 'h' : 'a');
  let note = '';
  if (trail) {
    const tl = trail === 'h' ? c.r.lh : c.r.la, ol = trail === 'h' ? c.r.la : c.r.lh, nm = trail === 'h' ? m.home : m.away;
    note = tl > ol ? `${esc(nm)} está a perder mas era quem o Zé esperava que marcasse mais (${tl.toFixed(1).replace('.', ',')} golos esperados antes do jogo) — a conta já lhe dá <b>${pct(trail === 'h' ? c.pH : c.pA)}</b> de marcar.` : `${esc(nm)} está a perder e já antes do jogo marcava menos — precisa de mais do que «normalmente marca».`;
  }
  const lines = [
    `⚽ <b>Mais um golo no jogo</b> (Mais de ${String(c.line).replace('.', ',')}): <b style="color:var(--lime)">${pct(c.pMore)}</b> · odd justa ${fairOdd(c.pMore)}`,
    `➕ Dois ou mais (Mais de ${String(c.line2).replace('.', ',')}): ${pct(c.p2more)} · justa ${fairOdd(c.p2more)}`,
    `🏠 ${esc(m.home)} marca: <b>${pct(c.pH)}</b> · justa ${fairOdd(c.pH)} &nbsp; ✈️ ${esc(m.away)} marca: <b>${pct(c.pA)}</b> · justa ${fairOdd(c.pA)}`,
    `🏁 Final: 1 ${pct(c.p1)} · X ${pct(c.pX)} · 2 ${pct(c.p2)}`
  ];
  return `<div class="vc-card lv-card" data-ev="${esc(L.id)}"><div class="vc-top">${esc(m.league || '')} · <b style="color:#ff6b7d;">● ${esc(L.clock.label)}</b> · faltam ~${Math.round(c.rem * 100)}% dos golos de um jogo</div>
    <div class="vc-teams" onclick="lvOpen('${esc(L.id)}')">${esc(m.home)}${red(L.rh)} <b style="font-size:1.15em;">${L.hs}-${L.as}</b> ${esc(m.away)}${red(L.ra)}</div>
    <div style="font-size:.84rem;line-height:1.6;">${lines.join('<br>')}</div>
    ${note ? `<div class="muted" style="font-size:.78rem;margin-top:4px;">💭 ${note}</div>` : ''}
    <div class="muted" style="font-size:.74rem;margin-top:4px;">Antes do jogo o Zé esperava ${c.r.lh.toFixed(1).replace('.', ',')}–${c.r.la.toFixed(1).replace('.', ',')} golos.${L.goals.length ? ' Golos: ' + L.goals.map(g => `${esc(g.min)} ${esc(g.who)}${g.og ? ' (p.b.)' : g.pen ? ' (pen.)' : ''}`).join(', ') : ''}</div>
    ${typeof autoBadge === 'function' ? autoBadge(m) : ''}
    <div class="ch-acts"><button class="btn btn-sm" onclick="lvStats('${esc(L.code)}','${esc(L.id)}',this)">📊 Remates e posse</button></div><div class="lv-stats"></div></div>`;
}
async function lvStats(code, id, btn) {
  const card = btn.closest('.lv-card'), box = card && card.querySelector('.lv-stats'); if (!box) return;
  btn.disabled = true; box.innerHTML = '<span class="muted">⏳ …</span>';
  try {
    const j = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/summary?event=${id}`);
    const T = (j.boxscore && j.boxscore.teams) || [];
    const get = (t, n) => { const s = (t.statistics || []).find(x => x.name === n); return s ? s.displayValue : '—'; };
    const rows = [['possessionPct', 'Posse %'], ['totalShots', 'Remates'], ['shotsOnTarget', 'À baliza'], ['wonCorners', 'Cantos'], ['foulsCommitted', 'Faltas']];
    box.innerHTML = T.length >= 2 ? `<table style="width:100%;font-size:.8rem;margin-top:6px;">${rows.map(([k, lb]) => `<tr><td style="text-align:right;width:30%;"><b>${esc(get(T[0], k))}</b></td><td class="muted" style="text-align:center;">${lb}</td><td style="width:30%;"><b>${esc(get(T[1], k))}</b></td></tr>`).join('')}</table><div class="muted" style="font-size:.72rem;">Só para veres a pressão — o Zé não usa isto na conta (na simulação não melhorou a previsão de forma segura).</div>` : '<span class="muted">A ESPN ainda não tem estatísticas deste jogo.</span>';
  } catch (e) { box.innerHTML = '<span class="muted">Não consegui ligar agora.</span>'; }
}
async function zeLivePanel(boxId) {
  const box = document.getElementById(boxId || (currentView === 'dia' ? 'dayResult' : 'scorersBox')); if (!box) return;
  box.classList.add('show'); box.dataset.lv = '1';
  if (!LV_BUSY) setTimeout(() => { try { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }, 60);
  if (LV_BUSY) return; LV_BUSY = true;
  if (!box.querySelector('.lv-card')) box.innerHTML = `<h3>⚡ Ao vivo</h3><div class="muted">⏳ A ver os jogos a decorrer…</div>`;
  // dados com mais de 10 min: atualiza primeiro (assim aparecem os jogos que começaram entretanto)
  try { const P = lsGet(LIVE_KEY, null), age = P && P.generatedAt ? Date.now() - new Date(P.generatedAt).getTime() : 1e12; if (age > 10 * 60e3 && !(typeof espnCooling === 'function' && espnCooling())) await atualizarTudo({ quiet: true }); } catch (e) {}
  let R = null, err = null; try { R = await lvScan(); } catch (e) { err = e; }
  LV_BUSY = false;
  if (box.dataset.lv !== '1') return;
  const cards = R && R.out.filter(o => o.c);
  const lvMode = (() => { try { return localStorage.getItem('ze_lv_sort') || 'pct'; } catch (e) { return 'pct'; } })();
  if (cards) cards.sort((a, b) => lvMode === 'pct' ? (b.c.pMore - a.c.pMore) || (b.L.clock.F - a.L.clock.F) : (b.L.clock.F - a.L.clock.F) || (b.c.pMore - a.c.pMore));
  const lvSeg = `<span class="rv-seg"><b class="${lvMode === 'pct' ? 'on' : ''}" onclick="lvSortSet('pct')">↓ % golo</b><b class="${lvMode === 'pct' ? '' : 'on'}" onclick="lvSortSet('tempo')">⏱ mais adiantados</b></span>`;
  box.innerHTML = `<h3>⚡ Ao vivo</h3>
    <div class="day-meta">Cada % é a hipótese de <b>isso acontecer daqui até ao fim</b> (não é «a aposta mais provável»): conta o minuto, o resultado, as expulsões e o que o Zé esperava antes do jogo. Atualiza sozinho a cada minuto enquanto estiver aberto.</div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:-4px 0 10px;"><span class="muted" style="font-size:.78rem;">🕒 Atualizado às ${new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><button class="btn btn-sm" onclick="zeLivePanel('${box.id}')">🔄 Atualizar agora</button></div>
    ${cards && cards.length > 1 ? `<div style="display:flex;justify-content:flex-end;align-items:center;gap:6px;margin:-4px 0 10px;font:700 .78rem var(--cond);color:var(--muted);text-transform:uppercase;">Ordem ${lvSeg}</div>` : ''}
    ${cards && cards.length ? cards.map(lvCardHTML).join('') : `<div class="muted" style="padding:6px 0;">${err || (R && R.fail) ? '📡 Não consegui ligar à ESPN agora — tenta daqui a um minuto.' : `Agora não há jogos a decorrer nas ligas que o Zé segue${R && R.codes ? ' (os que estavam a decorrer já acabaram)' : ''}.`}</div>`}
    <div class="hint" style="margin-top:10px;">🧪 Testado em 949 jogos desta época: ao intervalo, «mais golos» acontece 83% das vezes (o Zé dava 80%); aos 75', 53% (dava 48%). A equipa a perder marca um pouco mais do que a conta simples — mas forçar esse ajuste não acertou melhor nos jogos seguintes, por isso o Zé não o força. Expulsões: −25% para quem fica com 10, +15% para o outro.</div>`;
  clearTimeout(LV_TIMER);
  LV_TIMER = setTimeout(() => { if (box.dataset.lv === '1' && box.offsetParent && !document.hidden) zeLivePanel(box.id); }, 60e3);
}
function lvSortSet(m) { try { localStorage.setItem('ze_lv_sort', m); } catch (e) {} const b = document.querySelector('[data-lv="1"]'); if (b && LV_LAST) { zeLivePanel(b.id); } }
function lvStop() { clearTimeout(LV_TIMER); document.querySelectorAll('[data-lv="1"]').forEach(b => { b.dataset.lv = ''; }); }
fmGo = (function (prev) { return function (v) { lvStop(); return prev.apply(this, arguments); }; })(fmGo);
['gerarDia', 'zeSafeSlip', 'verificarAtualizacoes', 'zeScorersToday'].forEach(fn => { try { const p = window[fn]; if (typeof p === 'function') window[fn] = function () { lvStop(); return p.apply(this, arguments); }; } catch (e) {} });
async function lvModalBlock(m) {
  const body = document.getElementById('modal-body'); if (!body) return;
  let el = document.getElementById('lvModal');
  if (!el) { el = document.createElement('div'); el.id = 'lvModal'; el.className = 'reason'; el.style.margin = '8px 0'; const h = body.querySelector('.h2h'); if (h) h.parentNode.insertBefore(el, h); else body.prepend(el); }
  el.innerHTML = '<div class="rz-head">⚡ Ao vivo</div><div class="muted">⏳ a ver o minuto e o resultado…</div>';
  try {
    const R = await lvScan(); const o = R.out.find(x => x.m === m || (x.m.espn && m.espn && String(x.m.espn.ev) === String(m.espn.ev)));
    if (window._modalMatch && window._modalMatch !== m) return;
    el.innerHTML = o && o.c ? `<div class="rz-head">⚡ Ao vivo</div>${lvCardHTML(o)}<button class="btn btn-sm" onclick="closeModal && closeModal(); fmGo('jogos'); setTimeout(()=>zeLivePanel('scorersBox'),80)">Ver todos os jogos ao vivo</button>` : '<div class="rz-head">⚡ Ao vivo</div><div class="muted">Este jogo não aparece a decorrer na ESPN (pode já ter acabado ou ainda não começou).</div>';
  } catch (e) { el.innerHTML = '<div class="rz-head">⚡ Ao vivo</div><div class="muted">Não consegui ligar agora.</div>'; }
}
function lvCount() { try { const ids = new Set(), now = Date.now(); matches.filter(m => m.espn && m.live && lvIsLive(m)).concat(LV_MATCHES).filter(m => { const k = kickOf(m); return k && now - k.getTime() < 2.1 * 3600e3; }).forEach(m => ids.add(String(m.espn.ev || m.home + m.away))); return ids.size; } catch (e) { return 0; } }

/* zeTalk: «marcadores», «ao vivo», «h2h» */
zeTalk = (function (prev) {
  return function (q0) {
    const q = normTxt(String(q0 || ''));
    try {
      if (/marcador(es)? (de )?hoje|quem marca hoje|marcadores do dia/.test(q)) { setTimeout(() => { fmGo('jogos'); setTimeout(() => zeScorersToday('scorersBox'), 80); }, 300); return { mood: 'pensativo', html: '⚽ Vou ver os marcadores mais prováveis de hoje — abro no Calendário.' }; }
      if (/ao vivo|em direto|live|a decorrer/.test(q) && /golo|jogo|ajuda|probab|apost/.test(q)) { setTimeout(() => { fmGo('jogos'); setTimeout(() => zeLivePanel('scorersBox'), 80); }, 300); return { mood: 'pensativo', html: '⚡ Vou ver os jogos a decorrer e a hipótese de golo em cada um — abro no Calendário.' }; }
    } catch (e) {}
    return prev.apply(this, arguments);
  };
})(zeTalk);

/* ---------- 6) Partilha de apostas: quem, quando, estado e várias imagens ---------- */
function shareLegInfo(l, bet) {
  const L = lsGet(LIVE_KEY, null), all = (L && L.matches) || [];
  const t0 = bet.at ? new Date(bet.at).getTime() - 12 * 3600e3 : 0;
  let e = null; try { e = all.find(x => new Date(x.utcDate).getTime() >= t0 && evMatchesLeg(x, l)); } catch (er) {}
  if (!e) { try { const m = matches.find(x => l.home && l.away && normTxt(x.home) === normTxt(l.home) && normTxt(x.away) === normTxt(l.away)); const k = m && kickOf(m); if (k) return { when: k, st: null }; } catch (er) {} return { when: null, st: null }; }
  let st = null;
  try { if (e.status === 'FINISHED') { const r = resolveLeg(l, all.filter(x => x.status === 'FINISHED'), bet.at); if (r) st = { win: r.win, score: r.score }; } else if (e.status === 'POSTPONED') st = { off: true }; } catch (er) {}
  return { when: new Date(e.utcDate), st };
}
function shareWhen(d) { if (!d) return ''; const wd = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d.getDay()]; return `${wd} ${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
async function shareImgOf(src) { return new Promise(res => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
const SHARE_PER = 12;
async function betCardImages(bet, who) {
  const legs = betLegsOf(bet), info = legs.map(l => l._inf || shareLegInfo(l, bet));
  const pages = []; for (let i = 0; i < legs.length; i += SHARE_PER) pages.push([i, Math.min(legs.length, i + SHARE_PER)]);
  if (!pages.length) pages.push([0, 0]);
  const u = userProfile(), isZe = who === 'ze' || who === 'auto';
  const name = who === 'auto' ? 'PILOTO DO ZÉ' : isZe ? 'MISTER ZÉ' : (pname() === 'Tu' ? 'MIM' : pname().toUpperCase());
  const photo = !isZe && u.photo ? await shareImgOf(u.photo) : null;
  const face = await svgToImg(zeFace(isZe ? 'gozao' : 'feliz', 160));
  const F = (w, s) => `${w} ${s}px "Barlow Condensed", "Arial Narrow", "Roboto Condensed", sans-serif`;
  const T = (s, w) => `${w || 500} ${s}px Barlow, "Segoe UI", Roboto, sans-serif`;
  const blobs = [];
  for (let pg = 0; pg < pages.length; pg++) {
    const [a, b] = pages[pg], last = pg === pages.length - 1, nRows = b - a;
    const rowH = legs.length > 6 ? 92 : 118;
    const W = 1080, H = Math.max(1350, 330 + nRows * rowH + 60 + (last ? 420 : 120));
    const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2c1656'); g.addColorStop(.6, '#160d2b'); g.addColorStop(1, '#0f0a1a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    for (let x = -H; x < W; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 8, 0); ctx.lineTo(x + 8 + H * 0.47, H); ctx.lineTo(x + H * 0.47, H); ctx.fill(); }
    // quem apostou: foto (ou cara do Zé) num círculo
    ctx.save(); ctx.beginPath(); ctx.arc(145, 140, 78, 0, Math.PI * 2); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill(); ctx.clip();
    if (photo) { const s = Math.max(156 / photo.width, 156 / photo.height); ctx.drawImage(photo, 145 - photo.width * s / 2, 140 - photo.height * s / 2, photo.width * s, photo.height * s); }
    else if (face) ctx.drawImage(face, 70, 65, 150, 150);
    ctx.restore();
    ctx.strokeStyle = isZe ? '#c8f53c' : '#4c95f0'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(145, 140, 80, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#c8f53c'; ctx.font = F(800, 28); ctx.fillText('MISTER ZÉ FC · ANÁLISE DE FUTEBOL', 255, 95);
    let fs = 66; const title = bet._title || `APOSTA ${isZe ? 'DO' : 'DE'} ${name}`;
    do { ctx.font = F(800, fs); fs -= 2; } while (ctx.measureText(title).width > W - 300 && fs > 34);
    ctx.fillStyle = '#ffffff'; ctx.fillText(title, 255, 160);
    ctx.fillStyle = '#a99ec4'; ctx.font = T(27);
    const kind = bet._list || (legs.length > 1 ? `Múltipla · ${legs.length} seleções` : 'Simples');
    ctx.fillText(`${kind} · ${bet._list ? '' : 'registada '}${dtFmt(bet.at || Date.now())}${pages.length > 1 ? ` · ${pg + 1}/${pages.length}` : ''}`, 255, 205);
    let y = 270;
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2;
    const ph = Math.max(rowH, nRows * rowH) + 30;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(50, y, W - 100, ph, 24) : ctx.rect(50, y, W - 100, ph); ctx.fill(); ctx.stroke();
    let yy = y + 18;
    for (let i = a; i < b; i++) {
      const l = legs[i], inf = info[i], st = inf.st;
      const ic = st ? (st.off ? '↩' : st.win ? '✓' : '✗') : '•', col = st ? (st.off ? '#a99ec4' : st.win ? '#2fd27a' : '#ff7a8f') : '#ffc233';
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(98, yy + rowH / 2 - 6, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#160d2b'; ctx.font = F(800, 28); ctx.textAlign = 'center'; ctx.fillText(ic, 98, yy + rowH / 2 + 3); ctx.textAlign = 'left';
      const big = rowH > 100;
      ctx.fillStyle = '#ffffff'; ctx.font = T(big ? 38 : 32, 700);
      let sel = String(l.sel || bet.pick || ''); while (ctx.measureText(sel).width > W - 330 && sel.length > 4) sel = sel.slice(0, -2);
      if (sel !== String(l.sel || bet.pick || '')) sel += '…';
      ctx.fillText(sel, 135, yy + (big ? 46 : 38));
      if (Number(l.odd) > 1) { ctx.textAlign = 'right'; ctx.fillStyle = '#c8f53c'; ctx.font = F(800, big ? 46 : 40); ctx.fillText(Number(l.odd).toFixed(2), W - 85, yy + (big ? 48 : 40)); ctx.textAlign = 'left'; }
      ctx.fillStyle = '#a99ec4'; ctx.font = T(big ? 27 : 24);
      let sub = (l.home && l.away ? `${l.home} vs ${l.away}` : '') + (inf.when ? ` · ${shareWhen(inf.when)}` : '') + (st && st.score ? ` · ${st.score}` : st && st.off ? ' · adiado' : '') + (l.extra ? ` · ${l.extra}` : '');
      while (ctx.measureText(sub).width > W - 230 && sub.length > 4) sub = sub.slice(0, -2);
      ctx.fillText(sub, 135, yy + (big ? 86 : 72));
      if (i < b - 1) { ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.moveTo(135, yy + rowH - 4); ctx.lineTo(W - 85, yy + rowH - 4); ctx.stroke(); }
      yy += rowH;
    }
    y += ph + 34;
    if (last) {
      const box = (x, w, lab, val, colr) => { ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x, y, w, 140); ctx.fillStyle = '#a99ec4'; ctx.font = T(25, 700); ctx.fillText(lab.toUpperCase(), x + 24, y + 44); ctx.fillStyle = colr || '#ffffff'; ctx.font = F(800, 56); ctx.fillText(val, x + 24, y + 112); };
      const bw = (W - 100 - 40) / 3;
      if (bet._boxes) bet._boxes.forEach((q, i) => box(50 + i * (bw + 20), bw, q[0], q[1], q[2]));
      else {
      box(50, bw, 'Odd', Number(bet.odd).toFixed(2), '#c8f53c');
      box(50 + bw + 20, bw, 'Aposta', eur(bet.stake));
      box(50 + 2 * (bw + 20), bw, bet.status === 'win' ? 'Ganhou' : 'Potencial', eur(bet.stake * bet.odd), bet.status === 'win' ? '#2fd27a' : '#ffffff');
      }
      y += 200;
      const decided = info.filter(x => x.st && !x.st.off).length, won = info.filter(x => x.st && x.st.win).length;
      ctx.fillStyle = bet.status === 'win' ? '#2fd27a' : bet.status === 'loss' ? '#ff7a8f' : '#ffc233'; ctx.font = F(800, 44);
      if (bet._list) ctx.fillText(bet._foot || '', 60, y); else ctx.fillText(((ST_TXT[bet.status] || '').replace(/^\S+\s/, '').toUpperCase()) + (legs.length > 1 && decided ? `  ·  ${won}/${legs.length} certas` : (legs.length === 1 && bet.finalScores ? '  ·  ' + bet.finalScores : '')), 60, y);
      y += 60;
      const p = isZe ? bet.pUsed : bet.zeP;
      if (typeof p === 'number') { ctx.fillStyle = '#f2eefb'; ctx.font = T(30); y = wrapText(ctx, `🤖 O Zé dá-lhe ${pct(p)} de hipótese.`, 60, y, W - 120, 42, 2); }
    } else { ctx.fillStyle = '#a99ec4'; ctx.font = T(30, 700); ctx.fillText(`continua na imagem ${pg + 2} ›`, 60, y + 10); }
    // rodapé = publicidade da app
    ctx.fillStyle = 'rgba(200,245,60,.9)'; ctx.font = F(800, 30); ctx.fillText('Feito com o Mister Zé', 60, H - 78);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = T(23); ctx.fillText('juliomcm-tech.github.io/mister-ze · bancas virtuais · 18+ joga com responsabilidade', 60, H - 42);
    blobs.push(await new Promise(res => c.toBlob(bl => res(bl), 'image/png')));
  }
  return blobs.filter(Boolean);
}
async function shareOutMany(text, blobs, base) {
  const files = blobs.map((bl, i) => new File([bl], `${base}${blobs.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' }));
  try {
    // só a imagem (o texto já está todo na imagem)
    if (files.length && navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files }); return; }
    if (files.length > 1 && navigator.canShare && navigator.canShare({ files: [files[0]] })) { await navigator.share({ files: [files[0]] }); toast(`Este telemóvel só partilha 1 imagem de cada vez — as outras ${files.length - 1} ficam para guardar.`); shareSheetMany(text, files.slice(1)); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  shareSheetMany(text, files);
}
function shareSheetMany(text, files) {
  const urls = files.map(f => URL.createObjectURL(f));
  const html = `<h3>📤 Partilhar</h3>
    <div class="modal-meta">${files.length > 1 ? `${files.length} imagens (a múltipla não cabia numa só).` : 'A imagem da aposta:'}</div>
    ${urls.map((u, i) => `<img src="${u}" alt="Cartão ${i + 1}" style="width:100%;border-radius:10px;margin-bottom:8px;border:1px solid var(--line2);"><a class="btn btn-sm" href="${u}" download="${esc(files[i].name)}" style="margin-bottom:12px;">🖼️ Guardar imagem ${files.length > 1 ? i + 1 : ''}</a>`).join('')}
    <div class="muted" style="font-size:.78rem;">Guarda a imagem e envia-a no WhatsApp.</div>`;
  const m = document.getElementById('modal-content'); if (m) m.classList.remove('worst-modal');
  setHTML('modal-body', html);
  const o = document.getElementById('modal'); if (o) o.classList.add('open');
}
shareBet = function (id, who) {
  const b = loadBank();
  const bet = (who === 'ze' ? b.zeBets : b.bets).find(x => String(x.id) === String(id));
  if (!bet) return;
  toast('🖼️ A preparar a imagem…');
  betCardImages(bet, who).then(blobs => shareOutMany(betShareText(bet, who), blobs, `aposta-${isoDay(new Date())}`)).catch(e => { console.warn(e); shareOut(betShareText(bet, who), 'bet', { bet, who }, `aposta-${isoDay(new Date())}.png`); });
};
betShareText = (function (prev) {
  return function (bet, who) {
    let t = prev.apply(this, arguments);
    try {
      const legs = betLegsOf(bet);
      if (legs.length > 1) {
        const lines = legs.map(l => { const inf = shareLegInfo(l, bet); return `${inf.st ? (inf.st.win ? '✅' : inf.st.off ? '↩️' : '❌') : '⏳'} ${l.sel || ''}${l.home && l.away ? ` (${l.home} vs ${l.away}${inf.when ? ', ' + shareWhen(inf.when) : ''})` : ''}${Number(l.odd) > 1 ? ' @ ' + Number(l.odd).toFixed(2) : ''}`; });
        if (!lines.every(x => t.includes(x.slice(2, 20)))) t = t.replace(/\n— /, '\n' + lines.join('\n') + '\n— ');
      }
    } catch (e) {}
    return t;
  };
})(betShareText);

/* estilos pequenos */
(function () {
  try {
    const css = document.createElement('style');
    css.textContent = `.lv-card .vc-teams{font-size:1.02rem}.lv-card table td{padding:2px 4px}#scorersBox:empty{display:none}`;
    document.head.appendChild(css);
  } catch (e) {}
})();

/* ---------- 7) Desafio aceite = o Zé joga mesmo a escolha dele ---------- */
// Antes: «Aceitar desafio» abria o duelo e o Zé decidia só por valor → nas «seguras» (odd baixa) dizia «passo».
// Agora: se o Zé não encontra valor, joga a escolha do desafio com stake pequena (é um desafio, não valor).
let CH_ACCEPTED = null, CH_CONFIRMING = false;
let CH_RENDERED = [];
zeChallengesHTML = (function (prev) { return function () { try { CH_RENDERED = (zeChallenges(36) || []).slice(); } catch (e) {} return prev.apply(this, arguments); }; })(zeChallengesHTML);
aceitarDesafio = (function (prev) {
  return function (i) {
    try { CH_ACCEPTED = CH_RENDERED.find(c => c.i === i) || (zeChallenges(36) || []).find(c => c.i === i) || null; } catch (e) { CH_ACCEPTED = null; }
    // os jogos podem ter sido recarregados entretanto (Atualizar): procura o índice atual do mesmo jogo
    try { if (CH_ACCEPTED && !chSame(matches[i], CH_ACCEPTED.m)) { const j = matches.findIndex(x => chSame(x, CH_ACCEPTED.m)); if (j >= 0) { i = j; CH_ACCEPTED = Object.assign({}, CH_ACCEPTED, { i: j, m: matches[j] }); } } } catch (e) {}
    return prev.call(this, i);
  };
})(aceitarDesafio);
function chSame(a, b) { return !!(a && b && (a === b || (a.home === b.home && a.away === b.away && a.date === b.date))); }
function chStake() {
  const b = loadBank(), mn = typeof minStake === 'function' ? minStake() : 0.1;
  return r2(Math.min(b.ze, Math.max(mn, Math.min(b.ze * 0.02, b.ze * 0.01))));
}
zeDecidirUI = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const c = CH_ACCEPTED, d = dueloAtual && dueloAtual.decision, m = dueloAtual && dueloAtual.m, el = document.getElementById('zeDecision');
      if (!c || !d || !m || !el || !chSame(c.m, m) || d.pick) return r;
      const inp = document.getElementById('odd_' + String(c.k2).replace('.', '_'));
      const odd = inp && +inp.value > 1 ? +inp.value : (c.odd > 1 ? +c.odd : null);
      const label = marketName(c.k2, m), tag = CH_TAG[c.cat] ? CH_TAG[c.cat][1] : 'Desafio';
      const sp = el.querySelector('.speech');
      if (!odd) {
        if (sp) sp.innerHTML = `${zeFace('pensativo', 46)}<div><b>Desafio: ${esc(label)}</b> (eu dou ${pct(c.p)} · justa ${fairOdd(c.p)}).<br>Falta a odd da tua casa para este mercado. Mete-a aqui:
          <div style="display:flex;gap:6px;align-items:center;margin-top:6px;"><input id="chOdd" class="inp" type="number" inputmode="decimal" step="0.01" min="1.01" style="width:90px;"><button class="btn btn-lime btn-sm" onclick="chSetOdd()">Jogar desafio</button></div></div>`;
        return r;
      }
      const ev = c.p * odd - 1, stake = chStake();
      d.pick = { k: c.k2, label, odd, p: c.p, pModel: c.p, ev, kelly: 0, challenge: c.cat };
      d.stake = stake;
      if (sp) sp.innerHTML = `${zeFace(ev > 0 ? 'gozao' : 'feliz', 46)}<div><b>Desafio aceite!</b> Vou na minha ${esc(tag.toLowerCase())}: <b>${esc(label)}</b> @ <b>${odd.toFixed(2)}</b><br>
        Eu dou ${pct(c.p)} (justa ${fairOdd(c.p)}) · ${ev > 0 ? `valor <b class="ev-pos">+${(ev * 100).toFixed(1)}%</b>` : `a odd paga <b>${(ev * 100).toFixed(1)}%</b> abaixo do que vale — por isso a stake é pequena`}.<br>
        Stake <b style="color:var(--lime)">${stake.toFixed(2)} €</b> (${c.cat === 'valor' ? 'desafio de valor' : 'desafio: aposta pela probabilidade, não pelo valor'} · conta à parte nas estatísticas)
        <div style="margin-top:8px;"><button class="btn btn-lime btn-sm" onclick="confirmarDueloZe()">✅ Confirmar aposta do Zé</button></div></div>`;
      const why = [...el.querySelectorAll('.reason')].find(b => /Porquê/.test(b.textContent));
      if (why && why.lastElementChild) why.lastElementChild.insertAdjacentHTML('beforeend', `<br>🎯 <b>Mas foi o meu desafio</b>: sem valor nas odds, jogo a escolha mais provável com stake mínima — para o duelo ser justo. No longo prazo, só as apostas de valor dão lucro.`);
      const py = document.getElementById('dueloPickYou'); if (py && !py.value) py.value = label;
    } catch (e) { console.warn(e); }
    return r;
  };
})(zeDecidirUI);
function chSetOdd() {
  const v = +String((document.getElementById('chOdd') || {}).value || '').replace(',', '.');
  if (!(v > 1)) { toast('Mete a odd (ex. 1.30).'); return; }
  if (CH_ACCEPTED) CH_ACCEPTED = Object.assign({}, CH_ACCEPTED, { odd: v, book: 'tua casa' });
  zeDecidirUI();
}
confirmarDueloZe = (function (prev) { return function () { CH_CONFIRMING = !!(dueloAtual && dueloAtual.decision && dueloAtual.decision.pick && dueloAtual.decision.pick.challenge); try { return prev.apply(this, arguments); } finally { CH_CONFIRMING = false; } }; })(confirmarDueloZe);
addBet = (function (prev) {
  return function (bet, who) {
    try { if (CH_CONFIRMING && who === 'ze' && bet) { const p = dueloAtual.decision.pick; bet.source = 'desafio-ze'; bet.challenge = p.challenge; bet.zeCompare = `Desafio (${p.challenge}) · prob ${pct(p.p)} · justa ${fairOdd(p.p)} · EV ${(p.ev * 100).toFixed(1)}%`; } } catch (e) {}
    return prev.apply(this, arguments);
  };
})(addBet);
prepararDuelo = (function (prev) { return function (idx) { const r = prev.apply(this, arguments); try { if (CH_ACCEPTED && dueloAtual && !chSame(dueloAtual.m, CH_ACCEPTED.m)) CH_ACCEPTED = null; } catch (e) {} return r; }; })(prepararDuelo);
