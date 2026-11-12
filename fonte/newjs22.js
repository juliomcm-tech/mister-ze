
/* =====================================================================
   v35 · ligações à prova de bala
   Visto no PC do Júlio: ESPN direto → 400, corsproxy.io → 403 (deixou de ser grátis), allorigins → em baixo.
   Agora: várias pontes, várias formas de pedir à ESPN, e o Zé lembra-se da que funcionou.
   ===================================================================== */
const BRIDGES = [
  { n: 'direto', f: u => u },
  { n: 'codetabs', f: u => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u) },
  { n: 'allorigins (json)', f: u => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u), wrap: 'contents' },
  { n: 'allorigins', f: u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u) },
  { n: 'thingproxy', f: u => 'https://thingproxy.freeboard.io/fetch/' + u },
  { n: 'corsproxy.io', f: u => 'https://corsproxy.io/?url=' + encodeURIComponent(u) }
];
const NET_LOG = [];
const BRIDGE_DOWN = {}, BRIDGE_FAIL = {};
function bridgeFail(i) { BRIDGE_FAIL[i] = (BRIDGE_FAIL[i] || 0) + 1; if (BRIDGE_FAIL[i] >= 3) { BRIDGE_DOWN[i] = Date.now() + 10 * 60e3; BRIDGE_FAIL[i] = 0; } }
function bridgeOk(i) { BRIDGE_FAIL[i] = 0; delete BRIDGE_DOWN[i]; }
function netLog(x) { NET_LOG.unshift({ t: Date.now(), ...x }); NET_LOG.length = Math.min(NET_LOG.length, 60); }
/** Vai buscar texto: tenta a melhor ponte primeiro; 400/404 é resposta da ESPN (não adianta mudar de ponte) */
async function rawGet(url, timeoutMs) {
  const best = Math.min(lsGet('ze_bridge', 0), BRIDGES.length - 1);
  let order = [best].concat(BRIDGES.map((_, i) => i).filter(i => i !== best));
  const up = order.filter(i => !(BRIDGE_DOWN[i] > Date.now()));
  order = up.length ? up : [best];
  let last = null, refused = 0;
  for (const i of order) {
    const B = BRIDGES[i];
    try {
      const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), timeoutMs || 12000);
      const r = await fetch(B.f(url), { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(tm);
      let text = await r.text();
      if (B.wrap && r.ok) { try { const j = JSON.parse(text); const st = j.status && j.status.http_code; text = j[B.wrap] || ''; if (st && st >= 400) { netLog({ url, bridge: B.n, status: st }); if (st === 400 || st === 404) return { status: st, text, bridge: i }; throw new Error('HTTP ' + st); } } catch (e) { if (/HTTP/.test(e.message)) throw e; } }
      netLog({ url, bridge: B.n, status: r.status });
      if (r.ok && text) { bridgeOk(i); if (i !== best) lsSet('ze_bridge', i); return { status: r.status, text, bridge: i }; }
      if (r.status === 403 || r.status === 429 || r.status >= 500) bridgeFail(i);
      if (r.status === 400 || r.status === 404) {
        // pedido direto recusado pode ser só por a app estar aberta como ficheiro: experimenta as pontes;
        // se uma ponte também der 400, então é mesmo a ESPN a recusar este formato
        if (i === order[0] && i === 0) { refused = r.status; last = new Error(`${B.n}: HTTP ${r.status}`); continue; }
        if (i !== 0) return { status: r.status, text, bridge: i };
        refused = r.status;
      }
      last = new Error(`${B.n}: HTTP ${r.status}`);
    } catch (e) { if (!/HTTP/.test(e.message)) bridgeFail(i); netLog({ url, bridge: B.n, status: 0, err: e.name === 'AbortError' ? 'tempo esgotado' : 'bloqueado/sem rede' }); last = new Error(`${B.n}: ${e.name === 'AbortError' ? 'tempo esgotado' : 'bloqueado'}`); }
  }
  if (refused) return { status: refused, text: '', bridge: 0 };
  throw last || new Error('sem ligação');
}
async function getJSONany(url) {
  const r = await rawGet(url);
  if (r.status >= 400) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
  return JSON.parse(r.text);
}
/* formas de pedir o calendário/resultados à ESPN (se uma der 400, tenta a seguinte e guarda a que funcionou) */
const ESPN_VARIANTS = [
  { n: 'intervalo + limit', f: (base, a, b) => `${base}?dates=${a}-${b}&limit=300` },
  { n: 'intervalo', f: (base, a, b) => `${base}?dates=${a}-${b}` },
  { n: 'intervalo + limit 100', f: (base, a, b) => `${base}?dates=${a}-${b}&limit=100` },
  { n: 'semana a semana', split: 7 },
  { n: 'dia a dia', split: 1 }
];
const ymdParse = s => new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
async function espnScoreboard(url) {
  const m = url.match(/^(.*\/scoreboard)\?dates=(\d{8})-(\d{8})/);
  if (!m) return getJSONany(url);
  const [, base, a, b] = m;
  const pref = Math.min(lsGet('ze_espn_variant', 0), ESPN_VARIANTS.length - 1);
  const order = [pref].concat(ESPN_VARIANTS.map((_, i) => i).filter(i => i !== pref));
  let last = null;
  for (const vi of order) {
    const V = ESPN_VARIANTS[vi];
    try {
      let out;
      if (V.split) {
        const A = ymdParse(a), Bd = ymdParse(b), days = Math.round((Bd - A) / 864e5) + 1;
        if (V.split === 1 && days > 12) continue;          // dia a dia só para períodos curtos
        const parts = [];
        for (let d = new Date(A); d <= Bd; d = new Date(d.getTime() + V.split * 864e5)) { const e = new Date(Math.min(Bd.getTime(), d.getTime() + (V.split - 1) * 864e5)); parts.push([ymd(d), ymd(e)]); }
        const res = [];
        for (let i = 0; i < parts.length; i += 4) res.push(...await Promise.all(parts.slice(i, i + 4).map(([x, y]) => getJSONany(x === y ? `${base}?dates=${x}` : `${base}?dates=${x}-${y}`))));
        const seen = new Set(); out = { events: res.flatMap(j => j.events || []).filter(e => !seen.has(e.id) && seen.add(e.id)) };
      } else out = await getJSONany(V.f(base, a, b));
      if (vi !== pref) lsSet('ze_espn_variant', vi);
      return out;
    } catch (e) {
      last = e;
      if (e.status !== 400 && e.status !== 404) throw e;   // problema de ligação: mudar a forma do pedido não ajuda
    }
  }
  throw last || new Error('ESPN recusou todos os formatos');
}
fetchJSON = async function (url) {
  if (/site\.api\.espn\.com\/apis\/site\/v2\/sports\/[^?]+\/scoreboard\?dates=/.test(url)) return espnScoreboard(url);
  return getJSONany(url);
};
fetchText = async function (url) {
  const r = await rawGet(url);
  if (r.status >= 400) throw new Error('HTTP ' + r.status);
  if (!/<rss|<feed|<item|<entry/i.test(r.text)) throw new Error('resposta sem notícias');
  return r.text;
};

/* ---------- 🩺 Testar ligação (para saberes o que se passa no teu aparelho) ---------- */
async function netTest(btn) {
  const box = document.getElementById('netTestBox'); if (!box) return;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ A testar…'; }
  const now = new Date(), a = ymd(new Date(now.getTime() - 2 * 864e5)), b = ymd(new Date(now.getTime() + 2 * 864e5));
  const base = 'https://site.api.espn.com/apis/site/v2/sports/soccer/por.1/scoreboard';
  const rows = [];
  box.innerHTML = '<span class="muted">A testar cada ponte e cada forma de pedido (≈20 s)…</span>';
  for (let bi = 0; bi < BRIDGES.length; bi++) {
    for (const vi of [0, 1, 3]) {
      const V = ESPN_VARIANTS[vi];
      const url = V.split ? `${base}?dates=${a}` : V.f(base, a, b);
      const t0 = Date.now();
      try {
        const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 10000);
        const r = await fetch(BRIDGES[bi].f(url), { signal: ctrl.signal, cache: 'no-store' }); clearTimeout(tm);
        let txt = await r.text(); if (BRIDGES[bi].wrap) { try { txt = JSON.parse(txt)[BRIDGES[bi].wrap] || ''; } catch (e) {} }
        let n = null; try { n = (JSON.parse(txt).events || []).length; } catch (e) {}
        rows.push({ bi, vi, ok: r.ok && n != null, st: r.status, n, ms: Date.now() - t0 });
      } catch (e) { rows.push({ bi, vi, ok: false, st: e.name === 'AbortError' ? 'tempo' : 'bloqueado', ms: Date.now() - t0 }); }
    }
  }
  const good = rows.filter(r => r.ok).sort((x, y) => x.ms - y.ms)[0];
  Object.keys(BRIDGE_DOWN).forEach(k => delete BRIDGE_DOWN[k]); Object.keys(BRIDGE_FAIL).forEach(k => delete BRIDGE_FAIL[k]);
  if (good) { lsSet('ze_bridge', good.bi); lsSet('ze_espn_variant', good.vi); }
  box.innerHTML = `<div style="font-size:.8rem;line-height:1.5;">${BRIDGES.map((B, bi) => `<b>${esc(B.n)}</b>: ${[0, 1, 3].map(vi => { const r = rows.find(x => x.bi === bi && x.vi === vi); return `${esc(ESPN_VARIANTS[vi].n)} ${r.ok ? `✅ ${r.n} jogos (${r.ms} ms)` : `❌ ${esc(String(r.st))}`}`; }).join(' · ')}`).join('<br>')}</div>
    <div style="margin-top:6px;font-size:.86rem;">${good ? `✅ Vou usar <b>${esc(BRIDGES[good.bi].n)}</b> + <b>${esc(ESPN_VARIANTS[good.vi].n)}</b>. Carrega em 📡 Atualizar.` : '❌ Nenhuma ligação funcionou neste aparelho. Manda-me print disto.'}</div>
    <div class="muted" style="font-size:.74rem;">Aberto como ficheiro (file://) alguns serviços recusam o pedido. Instalada a partir de um endereço http(s), a app liga-se melhor.</div>`;
  if (btn) { btn.disabled = false; btn.textContent = '🩺 Testar ligação'; }
}
const _renderConfigV35 = renderConfig;
renderConfig = function () {
  _renderConfigV35();
  try {
    const st = document.getElementById('liveStatus'); if (!st || document.getElementById('netTestBtn')) return;
    st.insertAdjacentHTML('afterend', `<div style="margin-top:8px;"><button id="netTestBtn" class="btn btn-sm" onclick="netTest(this)">🩺 Testar ligação</button> <span class="muted" style="font-size:.76rem;">Se o Atualizar falhar, isto descobre que ligação funciona no teu aparelho.</span><div id="netTestBox" style="margin-top:6px;"></div></div>`);
  } catch (e) {}
};
/* mensagem de erro do Atualizar mais útil */
const _atualizarTudoV35 = atualizarTudo;
atualizarTudo = async function (opts) {
  const r = await _atualizarTudoV35(opts);
  try {
    const st = document.getElementById('liveStatus');
    if (st && /Não consegui ligar/.test(st.textContent)) {
      const last = NET_LOG.slice(0, 12);
      const espn400 = last.some(x => x.bridge === 'direto' && x.status === 400), blocked = last.filter(x => x.status === 0 || x.status === 403).length;
      st.insertAdjacentHTML('beforeend', `<br><span class="muted" style="font-size:.8rem;">${espn400 ? 'A ESPN recusou o pedido direto (400). ' : ''}${blocked ? `${blocked} tentativas por pontes bloqueadas. ` : ''}Vai a <b>Definições → 🩺 Testar ligação</b> e manda-me print se nada funcionar.</span>`);
    }
  } catch (e) {}
  return r;
};
