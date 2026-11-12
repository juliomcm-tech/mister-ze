
/* =====================================================================
   v34 · calendário verificado
   O dossiê trazia jogos inventados (equipas a jogar 3× no mesmo dia, dias da semana trocados,
   equipas na divisão errada). Agora cada jogo do dossiê é confirmado contra o calendário oficial (ESPN):
   ✅ confirmado · 📅 data corrigida · ✔ já jogado (com resultado) · ❌ não existe (escondido)
   ===================================================================== */
const CALFIX_KEY = 'ze_calfix_v1';
const CAL_LEAGUE_CODES = { 'liga portugal': ['por.1', 'por.2'], 'liga 2': ['por.2', 'por.1'], 'liga 3': ['por.2'], 'premier league': ['eng.1', 'eng.2'], 'championship': ['eng.2', 'eng.1'],
  'la liga': ['esp.1', 'esp.2'], 'segunda': ['esp.2', 'esp.1'], 'serie a': ['ita.1', 'ita.2'], 'serie b': ['ita.2', 'ita.1'], 'bundesliga': ['ger.1', 'ger.2'], 'eredivisie': ['ned.1'], 'champions': ['uefa.champions'] };
const calCodesFor = league => { const l = normTxt(league); const k = Object.keys(CAL_LEAGUE_CODES).find(x => l.includes(x)); return k ? CAL_LEAGUE_CODES[k] : []; };
const MO_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'], WD_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dayLabel = d => `${WD_PT[d.getDay()]} ${d.getDate()} ${MO_PT[d.getMonth()]}`;
const phaseOf = d => { const mo = d.getMonth(); return mo >= 6 ? 'imediato' : mo <= 2 ? 'inverno' : 'final'; };

/* guardar o original de cada jogo do dossiê (antes de qualquer correção) */
const CAL_STATIC = matches.filter(m => !m.live);
CAL_STATIC.forEach(m => { if (!m._orig) m._orig = { date: m.date, phase: m.phase, aviso: m.aviso || null, league: m.league, past: !!m.past, prob: m.prob, analysis: m.analysis }; });
const calKey = m => normTxt(m.home + '|' + m.away + '|' + m._orig.date);

function calApply() {
  const F = lsGet(CALFIX_KEY, null);
  if (!F || !F.items) return null;
  const n = { ok: 0, moved: 0, played: 0, missing: 0, dup: 0, unknown: 0 };
  CAL_STATIC.forEach(m => {
    const f = F.items[calKey(m)]; if (!f) return;
    n[f.st] = (n[f.st] || 0) + 1;
    m.calSt = f.st;
    if (f.st === 'ok' || f.st === 'moved') {
      const d = new Date(f.utc);
      m.date = dayLabel(d); m.phase = phaseOf(d); m.kickoff = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      m.aviso = null; m.calNote = f.st === 'moved' ? `📅 data corrigida (o dossiê dizia ${m._orig.date})` : '✅ confirmado no calendário oficial';
      if (f.espn) m.espn = f.espn;
      if (f.league) m.league = f.league;
    } else if (f.st === 'played') {
      m.past = true; m.resultado = f.res; m.prob = 'feito'; m.calNote = `✔ já jogado a ${dayLabel(new Date(f.utc))}: ${f.res}`;
    } else {
      m.aviso = f.st === 'dup' ? 'Repetido no dossiê (é o mesmo jogo de outro cartão)' : f.st === 'unknown' ? '⚠️ Não consegui confirmar (a ESPN não tem esta liga)' : '❌ Não existe no calendário oficial — o dossiê inventou este jogo';
      m.calNote = m.aviso;
    }
  });
  MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear();
  return { n, at: F.at };
}

async function calVerify(status) {
  status = status || (() => {});
  const now = new Date(), y0 = DOSSIER_Y0;
  const from = new Date(y0, 6, 1), to = new Date(y0 + 1, 5, 30);
  const codes = [...new Set(CAL_STATIC.flatMap(m => calCodesFor(m._orig.league || m.league)))];
  const evs = []; let ok = 0;
  for (let i = 0; i < codes.length; i += 3) {
    if (i) await new Promise(r => setTimeout(r, 300));
    const chunk = codes.slice(i, i + 3);
    status(`📅 A confirmar o calendário: ${chunk.map(c => ESPN_LEAGUES[c] || EXTRA_LEAGUES[c] || c).join(', ')}…`);
    const res = await Promise.all(chunk.map(async code => {
      const get = (a, b) => fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${ymd(a)}-${ymd(b)}&limit=1000`).then(j => (j.events || []).map(ev => normalizeEspn(ev, code, ESPN_LEAGUES[code] || EXTRA_LEAGUES[code] || code)).filter(Boolean));
      try {
        let L = await get(from, to);
        // (com o pedido por ano, a época inteira vem de uma vez — já não é preciso pedir às fatias)
        return L;
      } catch (e) { return null; }
    }));
    res.forEach(L => { if (L) { ok++; evs.push(...L); } });
  }
  if (!ok) throw new Error('sem ligação ao calendário');
  const items = {}, used = new Map();
  const same = (e, m) => { const h = expandAliases(normTxt(e.homeTeam.name + ' ' + e.homeTeam.shortName)), a = expandAliases(normTxt(e.awayTeam.name + ' ' + e.awayTeam.shortName)); return teamScore(m.home, h) > 0 && teamScore(m.away, a) > 0; };
  CAL_STATIC.forEach(m => {
    const want = calCodesFor(m._orig.league || m.league);
    const dOrig = parseDayLabel(m._orig.date) || now;
    const cands = evs.filter(e => same(e, m)).sort((a, b) => (want.indexOf(a.competition.code) < 0) - (want.indexOf(b.competition.code) < 0) || Math.abs(new Date(a.utcDate) - dOrig) - Math.abs(new Date(b.utcDate) - dOrig));
    const k = calKey(m);
    // jogos que só existem nas ligas que consegui ler
    const covered = want.length && !/liga 3/.test(normTxt(m._orig.league || ''));
    if (!cands.length) { items[k] = { st: covered ? 'missing' : 'unknown' }; return; }
    const e = cands[0];
    if (used.has(e.id)) { items[k] = { st: 'dup', of: used.get(e.id) }; return; }
    used.set(e.id, k);
    const d = new Date(e.utcDate);
    const espn = { h: e.homeTeam.id, a: e.awayTeam.id, code: e.competition.code, ev: e.id };
    if (e.status === 'FINISHED') items[k] = { st: 'played', utc: e.utcDate, res: `${e.score.fullTime.home}-${e.score.fullTime.away}`, espn };
    else items[k] = { st: Math.abs(d - dOrig) < 1.6 * 864e5 && normTxt(dayLabel(d)) === normTxt(m._orig.date) ? 'ok' : 'moved', utc: e.utcDate, espn, league: e.competition.name || m.league };
  });
  // repõe o original antes de aplicar a nova verificação
  CAL_STATIC.forEach(m => { m.date = m._orig.date; m.phase = m._orig.phase; m.aviso = m._orig.aviso; m.league = m._orig.league; m.past = m._orig.past; m.prob = m._orig.prob; delete m.calSt; delete m.calNote; });
  lsSet(CALFIX_KEY, { at: new Date().toISOString(), items, leagues: ok });
  return calApply();
}
let CAL_SHOW_ALL = false;
const _renderCalendarV34 = renderCalendar;
renderCalendar = function () {
  const hide = CAL_SHOW_ALL ? [] : matches.filter(m => !m.past && (m.calSt === 'missing' || m.calSt === 'dup' || m.calSt === 'unknown'));
  hide.forEach(m => { m.past = true; });
  try { _renderCalendarV34(); } finally { hide.forEach(m => { m.past = false; }); }
  try { calBar(); } catch (e) {}
};
function calBar() {
  const anchor = document.getElementById('cal-imediato'); if (!anchor) return;
  let bar = document.getElementById('calCheck');
  if (!bar) { bar = document.createElement('div'); bar.id = 'calCheck'; bar.className = 'needs'; bar.style.margin = '0 0 12px'; const pb = anchor.closest('.phase-block') || anchor; pb.parentNode.insertBefore(bar, pb); }
  const F = lsGet(CALFIX_KEY, null);
  const c = { ok: 0, moved: 0, played: 0, missing: 0, dup: 0, unknown: 0 }; CAL_STATIC.forEach(m => { if (m.calSt) c[m.calSt]++; });
  bar.innerHTML = F ? `<div class="rz-head">📅 Calendário confirmado com o oficial <span class="muted" style="font-weight:400;">(${new Date(F.at).toLocaleDateString('pt-PT')})</span></div>
      <div style="font-size:.84rem;line-height:1.5;">✅ ${c.ok} confirmados · 📅 ${c.moved} com data corrigida · ✔ ${c.played} já jogados · ❌ ${c.missing + c.dup} que não existem ou estavam repetidos${c.unknown ? ` · ⚠️ ${c.unknown} de ligas que não consigo confirmar` : ''} ${CAL_SHOW_ALL ? '(a mostrar, com aviso)' : '(escondidos)'}</div>
      <div class="acts" style="margin-top:6px;"><button class="mini" onclick="CAL_SHOW_ALL=!CAL_SHOW_ALL;renderCalendar()">${CAL_SHOW_ALL ? 'Esconder os inventados' : 'Mostrar os inventados'}</button><button class="mini l" onclick="calVerifyUI(this)">🔄 Verificar outra vez</button></div>`
    : `<div class="rz-head">⚠️ Este calendário ainda não foi confirmado</div><div style="font-size:.84rem;">Muitos jogos do dossiê estão mal: equipas a jogar 3 vezes no mesmo dia, dias da semana trocados, equipas na divisão errada. Carrega em <b>Verificar</b> (precisa de internet) e o Zé compara cada jogo com o calendário oficial, corrige as datas e esconde os que não existem.</div>
      <div class="acts" style="margin-top:6px;"><button class="mini l" onclick="calVerifyUI(this)">📅 Verificar calendário</button></div>`;
}
async function calVerifyUI(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '⏳ A verificar…'; }
  const bar = document.getElementById('calCheck');
  try {
    const r = await calVerify(t => { if (bar) bar.innerHTML = `<div class="rz-head">${esc(t)}</div>`; });
    renderCalendar(); renderBanca && renderBanca();
    toast(`📅 Calendário: ${r.n.ok + r.n.moved} confirmados (${r.n.moved} com data corrigida), ${r.n.played} já jogados, ${r.n.missing + r.n.dup + r.n.unknown} escondidos.`);
  } catch (e) {
    toast('❌ Não consegui ver o calendário oficial: ' + (e.message || e));
    if (btn) { btn.disabled = false; btn.textContent = '📅 Verificar calendário'; }
  }
}
/* aplica já o que estava guardado (funciona offline) e verifica de novo no «Atualizar», no máximo 1×/dia */
calApply();
try { renderCalendar(); } catch (e) {}
const _atualizarTudoV34c = atualizarTudo;
atualizarTudo = async function (opts) {
  const r = await _atualizarTudoV34c(opts);
  try {
    const F = lsGet(CALFIX_KEY, null);
    const anyLeft = CAL_STATIC.some(m => { const d = parseDayLabel(m._orig.date); return d && d > Date.now() - 864e5; }) || CAL_STATIC.some(m => m.calSt === 'ok' || m.calSt === 'moved');
    if (navigator.onLine !== false && anyLeft && (!F || Date.now() - new Date(F.at).getTime() > 3 * 864e5) && lsGet(LIVE_KEY, null)) {
      // fica para daqui a 20 s: não junta os pedidos do calendário aos do Atualizar (a ESPN não gosta de rajadas)
      setTimeout(async () => { try { if (typeof espnCooling === 'function' && espnCooling()) return; await calVerify(); applyLive(lsGet(LIVE_KEY, null)); renderCalendar(); } catch (e) { console.warn(e); } }, (opts && opts._calNow) || window.__calNow ? 0 : 20000);
    }
  } catch (e) { console.warn(e); }
  return r;
};
/* o calendário verificado aparece também na ficha do jogo */
const _openModalV34 = openModal;
openModal = function (m) {
  const r = _openModalV34.apply(this, arguments);
  try { if (m && m.calNote) { const b = document.getElementById('modal-body'); if (b) b.insertAdjacentHTML('afterbegin', `<div class="needs" style="margin:0 0 10px;padding:6px 10px;font-size:.82rem;">${esc(m.calNote)}${m.kickoff && m.calSt !== 'played' ? ` · ${esc(m.date)}, ${esc(m.kickoff)}` : ''}</div>`); } } catch (e) {}
  return r;
};
