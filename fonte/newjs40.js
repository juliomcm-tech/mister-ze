/* =====================================================================
   v50 · ecrãs com dados reais
   1) Scouting a partir dos resultados desta época (ESPN): fortes em casa, fracos fora, em subida
   2) «Hoje» no Início: jogos de hoje com o veredito do Zé + apostas abertas, numa só lista
   3) Lembrete semanal de backup (os dados vivem só neste telemóvel)
   ===================================================================== */
const SCOUT_KEY = 'ze_scout_v1';
const SCOUT_CODES = ['por.1', 'eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'ned.1', 'eng.2'];
let SCOUT_TAB = 'casa', SCOUT_BUSY = false;
(function () {
  const css = `
.sc-tabs{display:flex;gap:6px;margin:6px 0 12px;}
.sc-tab{flex:1;background:transparent;border:1px solid var(--line2);color:var(--muted);border-radius:10px;padding:9px 6px;font-weight:700;font-size:.8rem;cursor:pointer;min-height:44px;}
.sc-tab.active{background:var(--tile);color:var(--text);border-color:var(--lime,#c6f432);}
.sc-card{background:var(--panel,#16112b);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px;}
.sc-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px;}
.sc-name{font-weight:800;font-size:1rem;}
.sc-lg{font-size:.72rem;color:var(--muted);}
.sc-stat{font-size:.82rem;margin-top:4px;line-height:1.45;}
.sc-next{margin-top:8px;font-size:.82rem;padding:8px 10px;border-radius:9px;background:var(--tile);cursor:pointer;}
.sc-form{display:inline-flex;gap:3px;vertical-align:middle;margin-left:4px;}
.sc-form i{font-style:normal;font-size:.62rem;font-weight:800;width:16px;height:16px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;}
.sc-form i.v{background:#16a34a;color:#fff}.sc-form i.e{background:#64748b;color:#fff}.sc-form i.d{background:#dc2626;color:#fff}
.hoje-row{display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line);cursor:pointer;}
.hoje-row:last-child{border-bottom:0}
.hoje-h{font-weight:800;font-size:.8rem;min-width:42px;color:var(--lime,#c6f432);}
.hoje-m{flex:1;min-width:0;font-size:.86rem;}
.hoje-v{font-size:.76rem;color:var(--muted);margin-top:2px;}
.bk-nag{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:rgba(250,204,21,.1);border:1px solid rgba(250,204,21,.35);border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:.84rem;}
`;
  try { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); } catch (e) {}
})();

/* ---------- 1) Scouting ---------- */
function seasonStartFor(code, now) { now = now || new Date(); return new Date(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1, 6, 15); }
async function scoutLoad(force) {
  const c = lsGet(SCOUT_KEY, null);
  if (!force && c && Date.now() - c.t < 12 * 3600e3 && c.teams && c.teams.length) return c;
  const now = new Date(), teams = {};
  for (const code of SCOUT_CODES) {
    try {
      const j = await espnByMonths(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard`, ymd(seasonStartFor(code, now)), ymd(now));
      const fin = (j.events || []).map(ev => normalizeEspn(ev, code, ESPN_LEAGUES[code] || code)).filter(x => x && x.status === 'FINISHED' && x.score && x.score.fullTime && x.score.fullTime.home != null)
        .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
      fin.forEach(x => {
        const hg = x.score.fullTime.home, ag = x.score.fullTime.away;
        [[x.homeTeam, 'H', hg, ag], [x.awayTeam, 'A', ag, hg]].forEach(([tm, side, gf, ga]) => {
          const k = code + '|' + tm.id;
          const t = teams[k] = teams[k] || { id: String(tm.id), name: tm.shortName || tm.name, code, H: { n: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }, A: { n: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }, form: [] };
          const s = t[side]; s.n++; s.gf += gf; s.ga += ga; if (gf > ga) s.w++; else if (gf === ga) s.d++; else s.l++;
          t.form.push(gf > ga ? 'V' : gf === ga ? 'E' : 'D');
        });
      });
    } catch (e) {}
  }
  const list = Object.values(teams).map(t => ({ ...t, form: t.form.slice(-5) }));
  if (!list.length) { if (c) return c; throw new Error('sem dados'); }
  const out = { t: Date.now(), teams: list };
  lsSet(SCOUT_KEY, out);
  return out;
}
const ppgOf = s => s.n ? (3 * s.w + s.d) / s.n : 0;
const formPts = f => f.reduce((a, x) => a + (x === 'V' ? 3 : x === 'E' ? 1 : 0), 0);
function scoutRank(data, tab) {
  const L = data.teams;
  if (tab === 'casa') return L.filter(t => t.H.n >= 3).sort((a, b) => ppgOf(b.H) - ppgOf(a.H) || (b.H.gf - b.H.ga) / b.H.n - (a.H.gf - a.H.ga) / a.H.n).slice(0, 10);
  if (tab === 'fora') return L.filter(t => t.A.n >= 3).sort((a, b) => ppgOf(a.A) - ppgOf(b.A) || (a.A.gf - a.A.ga) / a.A.n - (b.A.gf - b.A.ga) / b.A.n).slice(0, 10);
  return L.filter(t => t.form.length >= 5 && t.H.n + t.A.n >= 6).map(t => ({ ...t, trend: formPts(t.form) / 5 - (ppgOf(t.H) * t.H.n + ppgOf(t.A) * t.A.n) / (t.H.n + t.A.n) }))
    .filter(t => formPts(t.form) >= 10 && t.trend > 0.25).sort((a, b) => b.trend - a.trend || formPts(b.form) - formPts(a.form)).slice(0, 10);
}
function scoutNext(t, side) {
  const tn = normTxt(t.name);
  const up = matches.map((m, i) => ({ m, i })).filter(({ m }) => !m.past && !m.aviso && m.espn && (String(m.espn.h) === t.id || String(m.espn.a) === t.id || teamInMatch(m, tn)))
    .map(x => ({ ...x, d: parseDayLabel(x.m.date) })).filter(x => x.d && x.d >= new Date(Date.now() - 3 * 3600e3)).sort((a, b) => a.d - b.d);
  const want = side ? up.find(x => side === 'H' ? String(x.m.espn.h) === t.id : String(x.m.espn.a) === t.id) : up[0];
  return want || null;
}
function scoutCard(t, rank, tab) {
  const s = tab === 'fora' ? t.A : t.H, where = tab === 'fora' ? 'fora' : 'em casa';
  const lg = ESPN_LEAGUES[t.code] || t.code;
  let stat;
  if (tab === 'subida') stat = `Últimos 5: <b>${formPts(t.form)} pts</b> (média da época ${((ppgOf(t.H) * t.H.n + ppgOf(t.A) * t.A.n) / (t.H.n + t.A.n) * 5).toFixed(1)} em 5 jogos)`;
  else stat = `${where}: <b>${s.w}V ${s.d}E ${s.l}D</b> · ${ppgOf(s).toFixed(2)} pts/jogo · marca ${(s.gf / s.n).toFixed(1)} · sofre ${(s.ga / s.n).toFixed(1)}`;
  const nx = scoutNext(t, tab === 'casa' ? 'H' : tab === 'fora' ? 'A' : null);
  let next = '';
  if (nx) {
    let p = null; try { const r = modelo(nx.m); const isH = String(nx.m.espn.h) === t.id || teamInMatch(nx.m, normTxt(t.name)) && normTxt(nx.m.home) === normTxt(t.name); p = isH ? r.mk['1'] : r.mk['2']; } catch (e) {}
    const opp = String(nx.m.espn.h) === t.id ? nx.m.away : nx.m.home;
    next = `<div class="sc-next" onclick="openMatchIdx(${nx.i})">📅 ${esc(nx.m.date)} · ${String(nx.m.espn.h) === t.id ? 'recebe' : 'visita'} <b>${esc(opp)}</b>${p != null ? ` · Zé: ${esc(t.name)} ganha <b>${Math.round(p * 100)}%</b>` : ''} ›</div>`;
  }
  const form = `<span class="sc-form">${t.form.map(x => `<i class="${x === 'V' ? 'v' : x === 'E' ? 'e' : 'd'}">${x}</i>`).join('')}</span>`;
  return `<div class="sc-card"><div class="sc-top"><span class="sc-name">${rank}. ${esc(t.name)}</span><span class="sc-lg">${esc(lg)}</span></div>
    <div class="sc-stat">${stat}</div><div class="sc-stat">Forma ${form}</div>${next}</div>`;
}
async function renderScout(force) {
  const view = document.getElementById('view-scout'); if (!view) return;
  ['section-best', 'section-worst'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  view.querySelectorAll('.controls, .screen-head .toggle-bar').forEach(el => { el.style.display = 'none'; });
  const p = view.querySelector('.screen-head p'); if (p) p.textContent = 'Desta época, com resultados reais: quem é forte em casa, quem é fraco fora e quem está em subida.';
  let box = document.getElementById('scoutLive');
  if (!box) { box = document.createElement('div'); box.id = 'scoutLive'; view.querySelector('.screen-head').insertAdjacentElement('afterend', box); }
  const tabs = `<div class="sc-tabs">${[['casa', '🏠 Fortes em casa'], ['fora', '✈️ Fracos fora'], ['subida', '📈 Em subida']].map(([k, l]) => `<button class="sc-tab${SCOUT_TAB === k ? ' active' : ''}" onclick="SCOUT_TAB='${k}';renderScout()">${l}</button>`).join('')}</div>`;
  const c = lsGet(SCOUT_KEY, null);
  const draw = (data, note) => {
    const L = scoutRank(data, SCOUT_TAB);
    box.innerHTML = tabs + (L.length ? L.map((t, i) => scoutCard(t, i + 1, SCOUT_TAB)).join('') : '<div class="muted" style="padding:10px 0;">Ainda poucos jogos para esta lista.</div>')
      + `<div class="muted" style="font-size:.74rem;margin:8px 0 4px;">${note || ''}Resultados ESPN · ${data.teams.length} equipas de ${SCOUT_CODES.length} ligas · atualizado ${new Date(data.t).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} <button class="btn btn-sm" style="margin-left:6px;" onclick="renderScout(true)">🔄</button></div>`;
  };
  if (c && c.teams && c.teams.length) draw(c);
  else box.innerHTML = tabs + '<div class="muted" style="padding:10px 0;">⏳ A juntar os resultados desta época…</div>';
  const stale = !c || Date.now() - c.t > 12 * 3600e3;
  if ((force || stale) && !SCOUT_BUSY && navigator.onLine !== false) {
    SCOUT_BUSY = true;
    try { const d = await scoutLoad(true); draw(d); }
    catch (e) { if (!c) box.innerHTML = tabs + '<div class="muted" style="padding:10px 0;">Sem ligação para juntar os resultados. Tenta outra vez com internet.</div>'; }
    finally { SCOUT_BUSY = false; }
  }
}

/* ---------- 2) «Hoje» no Início ---------- */
function safePickOf(r) { return ['1', '1X', 'O1.5', 'O2.5', 'BTTS', 'U2.5', 'X2', '2'].map(k => ({ k, p: r.mk[k] })).filter(o => o.p >= 0.55 && o.p <= 0.85).sort((a, b) => b.p - a.p)[0] || null; }
function hojeHTML() {
  const now = new Date(), d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  const d1 = new Date(d0.getTime() + 864e5);
  const today = matches.map((m, i) => ({ m, i, d: parseDayLabel(m.date) })).filter(x => x.d && x.d >= d0 && x.d < d1 && !x.m.past && !x.m.aviso && x.m.live)
    .sort((a, b) => String(a.m.kickoff || '').localeCompare(String(b.m.kickoff || '')));
  const b = loadBank();
  const open = b.bets.filter(x => x.status === 'open').map(x => ({ x, who: 'you' })).concat(b.zeBets.filter(x => x.status === 'open').map(x => ({ x, who: 'ze' })));
  if (!today.length && !open.length) return '';
  const rows = today.slice(0, 12).map(({ m, i }) => {
    let v = '';
    try {
      const r = modelo(m), fav = favOf(r.mk), sp = safePickOf(r);
      const favTxt = fav === 'X' ? 'empate' : (fav === '1' ? m.home : m.away);
      const val = typeof studyFor === 'function' && studyFor(m) ? oddsValue(m).filter(x => x.ev > zeEdgeFor(0.03, x.o) && x.o <= 6 && x.p >= 0.2)[0] : null;
      v = `Mais provável: <b>${esc(favTxt)}</b> ${Math.round(r.mk[fav] * 100)}%${sp ? ` · seguro: ${esc(marketName(sp.k, m))} ${Math.round(sp.p * 100)}%` : ''}${val ? ` · 💶 valor em ${esc(marketName(val.k, m))} @ ${val.o.toFixed(2)}` : ''}`;
    } catch (e) {}
    const mine = open.filter(o => teamScore(String(o.x.match || ''), normTxt(m.home)) > 0 || teamScore(String(o.x.match || ''), normTxt(m.away)) > 0);
    const tag = mine.length ? ` <span class="spill open" style="font-size:.66rem;">${mine.map(o => o.who === 'ze' ? 'Zé apostou' : 'apostaste').join(' · ')}</span>` : '';
    return `<div class="hoje-row" onclick="openMatchIdx(${i})"><div class="hoje-h">${esc(m.kickoff || '—')}</div><div class="hoje-m"><b>${esc(m.home)}</b> vs <b>${esc(m.away)}</b>${tag}<div class="hoje-v">${v}</div></div></div>`;
  }).join('');
  const bets = open.slice(0, 6).map(({ x, who }) => `<div class="hoje-row" onclick="fmGo('banca')"><div class="hoje-h" style="color:${who === 'ze' ? 'var(--lime)' : 'var(--blue)'};">${who === 'ze' ? 'Zé' : 'Tu'}</div><div class="hoje-m">${esc(x.match || '')}<div class="hoje-v">${esc(x.pick || '')} @ ${(+x.odd || 0).toFixed(2)} · ${(+x.stake || 0).toFixed(2)} €</div></div></div>`).join('');
  return `<div class="panel" id="hojePanel"><div class="panel-h"><span>📅 Hoje</span><span class="muted">${today.length} jogo${today.length === 1 ? '' : 's'} · ${open.length} aposta${open.length === 1 ? '' : 's'} aberta${open.length === 1 ? '' : 's'}</span></div>
    <div class="panel-b" style="padding-top:2px;">${rows || '<div class="muted" style="padding:8px 0;">Hoje não há jogos no radar.</div>'}${bets ? `<div style="margin-top:8px;font-size:.74rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;">Apostas abertas</div>${bets}` : ''}</div></div>`;
}

/* ---------- 3) lembrete de backup ---------- */
const BK_KEY = 'ze_last_backup';
function backupNagHTML() {
  const b = loadBank(); const n = b.bets.length + b.zeBets.length;
  if (n < 3) return '';
  const last = +(lsGet(BK_KEY, 0) || 0), days = last ? Math.floor((Date.now() - last) / 864e5) : null;
  if (days != null && days < 7) return '';
  let snooze = 0; try { snooze = +(sessionStorage.getItem('ze_bk_snooze') || 0); } catch (e) {}
  if (snooze) return '';
  return `<div class="bk-nag" id="bkNag">💾 <span style="flex:1;min-width:160px;">${days == null ? 'Ainda não fizeste nenhuma cópia' : `Última cópia há ${days} dias`}. Os dados vivem só neste telemóvel — se limpares o Chrome, perdes o duelo.</span>
    <button class="btn btn-sm btn-primary" onclick="exportBackup()">⬇️ Guardar cópia</button><button class="btn btn-sm" onclick="try{sessionStorage.setItem('ze_bk_snooze','1')}catch(e){};document.getElementById('bkNag').remove()">Agora não</button></div>`;
}
exportBackup = (function (prev) { return function () { const r = prev.apply(this, arguments); try { lsSet(BK_KEY, Date.now()); const n = document.getElementById('bkNag'); if (n) n.remove(); } catch (e) {} return r; }; })(exportBackup);
syncUp = (function (prev) { return async function () { const r = await prev.apply(this, arguments); try { const s = document.getElementById('syncStatus'); if (s && /✅/.test(s.textContent)) { lsSet(BK_KEY, Date.now()); const n = document.getElementById('bkNag'); if (n) n.remove(); } } catch (e) {} return r; }; })(syncUp);

renderPortal = (function (prev) {
  return function () {
    const r = prev.apply(this, arguments);
    try {
      const view = document.getElementById('view-portal'); if (!view) return r;
      const grid = view.querySelector('.portal-grid'); if (!grid) return r;
      ['hojePanel', 'bkNag'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
      const h = hojeHTML(), nag = backupNagHTML();
      if (h) grid.insertAdjacentHTML('beforebegin', h);
      if (nag) grid.insertAdjacentHTML('beforebegin', nag);
      // o mosaico do Scouting deixa de prometer «10 + 10» do dossiê antigo
      view.querySelectorAll('.tile').forEach(t => { if (/Scouting/.test(t.textContent) && /10 \+ 10/.test(t.textContent)) { const tv = t.querySelector('.tv'), ts = t.querySelector('.ts'); if (tv) tv.textContent = 'Época real'; if (ts) ts.textContent = 'Fortes em casa · fracos fora · em subida'; } });
    } catch (e) { console.warn(e); }
    return r;
  };
})(renderPortal);
fmGo = (function (prev) {
  return function (view) {
    const r = prev.apply(this, arguments);
    if (view === 'scout') { try { renderScout(); } catch (e) { console.warn(e); } }
    return r;
  };
})(fmGo);
