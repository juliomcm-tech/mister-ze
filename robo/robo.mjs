/* =====================================================================
   Robô do Mister Zé
   Corre a própria app (classico.html) sem ecrã, de 15 em 15 minutos, no GitHub Actions:
   1) «Atualizar» → dados/live.json   (jogos, resultados e classificações, prontos a usar pela app)
   2) odds das casas, com histórico   → dados/odds.json  + dados/hist/AAAA-MM.json (jogos acabados)
   3) piloto automático na nuvem      → dados/piloto.json (+ piloto-hist.json e piloto.csv: histórico completo)
   4) estado do robô                  → dados/robo.json  (+ dados/estado.json: a memória do robô)
   Só fala com a ESPN. Não guarda nada pessoal: só jogos, odds e as apostas virtuais do piloto.
   ===================================================================== */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const T0 = Date.now();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.ROBO_DADOS || 'dados';
const APP = process.env.ROBO_APP || path.join(HERE, '..', 'classico.html');
const START = Number(process.env.ROBO_BANCA) || 250;               // capital de cada uma das 4 estratégias: o piloto é UM apostador com 1000 € ao todo
const MAX_ODDS = Number(process.env.ROBO_MAX_ODDS) || 90;           // pedidos de odds por corrida, no máximo
const MOCK = process.env.ROBO_MOCK ? (await import(process.env.ROBO_MOCK)).default : null;
const UA = 'Mozilla/5.0 (compatible; MisterZeRobo/1.0; +https://github.com/juliomcm-tech/mister-ze)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rd = (f, def) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { return def; } };
const wr = (f, o) => { const p = path.join(DIR, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o)); return fs.statSync(p).size; };
const erros = [];
const nota = (t) => { erros.push(String(t).slice(0, 300)); console.log('⚠️ ', String(t).slice(0, 300)); };

/* ---------- rede: só ESPN, com calma ---------- */
const net = { n: 0, ok: 0, falhas: 0, s429: 0, bloqueados: 0, ligas: {} };
const ALLOW = /^https:\/\/(site\.api|sports\.core\.api|site\.web\.api)\.espn\.com\//;
let fila = 0, pausa = false;
async function roboFetch(u, o) {
  u = String(u);
  if (!ALLOW.test(u)) { net.bloqueados++; return new Response('{}', { status: 599 }); }
  if (pausa) { net.falhas++; return new Response('{}', { status: 429 }); }
  const wait = Math.max(0, fila + 120 - Date.now()); fila = Date.now() + wait; if (wait) await sleep(wait);
  net.n++;
  const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), 15000);
  try { if (o && o.signal) o.signal.addEventListener('abort', () => ctrl.abort()); } catch (e) {}
  const lg = (/\/soccer\/([a-z0-9._]+)\/scoreboard/.exec(u) || [])[1];
  try {
    const r = MOCK ? await MOCK(u) : await fetch(u, { signal: ctrl.signal, headers: { 'user-agent': UA, accept: 'application/json' } });
    if (r.ok) net.ok++; else { net.falhas++; if (r.status === 429 || r.status === 503) { net.s429++; if (net.s429 >= 3) pausa = true; } }
    if (lg) { const L = net.ligas[lg] = net.ligas[lg] || { ok: 0, mal: 0 }; r.ok ? L.ok++ : L.mal++; }
    return r;
  } catch (e) { net.falhas++; if (lg) { const L = net.ligas[lg] = net.ligas[lg] || { ok: 0, mal: 0 }; L.mal++; } throw e; }
  finally { clearTimeout(tm); }
}

/* ---------- arrancar a app com a memória da corrida anterior ---------- */
const estado = rd('estado.json', { ls: {} });
const jsErros = [];
const vc = new VirtualConsole(); vc.on('jsdomError', e => jsErros.push(String(e && e.message).slice(0, 200)));
const SEM_GUARDAR = new Set(['ze_live_v1', 'ze_last_report']);
const dom = new JSDOM(fs.readFileSync(APP, 'utf8'), {
  runScripts: 'dangerously', url: 'https://juliomcm-tech.github.io/mister-ze/', pretendToBeVisual: true, virtualConsole: vc, storageQuota: 60e6,
  beforeParse(w) {
    w.scrollTo = () => {}; w.fetch = roboFetch; w.alert = () => {}; w.confirm = () => true; w.__ROBO = true;
    for (const [k, v] of Object.entries(estado.ls || {})) { try { w.localStorage.setItem(k, v); } catch (e) {} }
    // o piloto passou a ter 1000 € ao todo (4 × 250): carteiras antigas são reduzidas na mesma proporção, apostas incluídas
    for (const k of ['ze_auto_v1', 'ze_auto_valor_v1', 'ze_auto_todos_v1', 'ze_auto_cai_v1']) {
      try {
        const a = JSON.parse(w.localStorage.getItem(k) || 'null'); if (!a || !a.start || a.start === START) continue;
        const f = START / a.start, r = x => Math.round(x * f * 100) / 100;
        a.bets.forEach(b => { b.stake = r(b.stake); if (b.ret != null) b.ret = r(b.ret); });
        (a.topups || []).forEach(t => { t.amount = r(t.amount); });
        const cap = START + (a.topups || []).reduce((s, t) => s + t.amount, 0);
        a.bank = Math.round((cap - a.bets.reduce((s, b) => s + b.stake, 0) + a.bets.reduce((s, b) => s + (b.st === 'win' ? (b.ret != null ? b.ret : b.stake * b.o) : b.st === 'void' ? b.stake : 0), 0)) * 100) / 100;
        a.start = START; w.localStorage.setItem(k, JSON.stringify(a)); console.log('carteira', k, 'reduzida ×', f);
      } catch (e) { console.log('migração', k, e.message); }
    }
    // carteiras do piloto na nuvem: nascem ligadas, todas com o mesmo capital
    if (!w.localStorage.getItem('ze_auto_v1')) {
      const base = () => ({ start: START, bank: START, bets: [], topups: [], since: new Date().toISOString() });
      w.localStorage.setItem('ze_auto_v1', JSON.stringify({ ...base(), perDay: 2, on: true }));
      w.localStorage.setItem('ze_auto_valor_v1', JSON.stringify({ ...base(), perDay: 3 }));
      w.localStorage.setItem('ze_auto_todos_v1', JSON.stringify({ ...base(), perDay: 4 }));
    }
  }
});
const w = dom.window;
await sleep(1500);
const ev = async code => { const r = w.eval(code); return (r && typeof r.then === 'function') ? await r : r; };
const VER = await ev('typeof APP_VER !== "undefined" ? APP_VER : "?"');
console.log('app', VER, '· memória', Object.keys(estado.ls || {}).length, 'chaves');

/* ---------- 0) perfil das equipas: tabelas da época passada (uma vez por época, como no telemóvel) ---------- */
try { if (await ev('zePrevSeasonAuto()')) console.log('perfil das equipas: época passada carregada · pedidos', net.n); } catch (e) { nota('época passada: ' + (e && e.message)); }

/* ---------- 1) Atualizar ---------- */
let payload = null, liveOk = false;
try {
  await ev('atualizarTudo({ quiet: true })');
  payload = JSON.parse(await ev('JSON.stringify(lsGet(LIVE_KEY, null))'));
  liveOk = !!(payload && Array.isArray(payload.matches) && payload.matches.length && new Date(payload.generatedAt).getTime() >= T0 - 5000);
  if (!liveOk) nota('Atualizar sem dados novos: ' + String(await ev('(document.getElementById("liveStatus")||{}).textContent||""')).slice(0, 160));
} catch (e) { nota('Atualizar: ' + (e && e.message)); }
const ligasOk = Object.keys(net.ligas).filter(c => net.ligas[c].ok > 0 && net.ligas[c].mal === 0).sort();
const resumo = { porJogar: 0, resultados: 0, aoVivo: 0 };
if (liveOk) {
  payload.matches.forEach(x => { if (x.status === 'FINISHED') resumo.resultados++; else if (x.status === 'IN_PLAY') resumo.aoVivo++; else if (x.status === 'TIMED') resumo.porJogar++; });
  payload.source = 'robo'; payload.robo = { ligas: ligasOk, ver: VER };
  wr('live.json', payload);
}
console.log('atualizar', liveOk ? 'ok' : 'FALHOU', JSON.stringify(resumo), 'ligas', ligasOk.length, 'pedidos', net.n);

/* ---------- 2) odds com histórico ---------- */
const odds = rd('odds.json', { v: 1, ev: {} });
const agora = Date.now(), H = 3600e3;
const oddsInfo = { emCurso: 0, pedidos: 0, comOdds: 0, fecho: 0, arquivados: 0 };
const frescos = {};
const compacto = b => { const o = {}; Object.keys(b.odds || {}).forEach(k => { o[k] = b.odds[k]; }); return o; };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function lerOdds(code, id) {
  try { return JSON.parse(await ev(`coreOdds(${JSON.stringify(code)}, ${JSON.stringify(String(id))}, true).then(b => JSON.stringify(b || []))`)); }
  catch (e) { return null; }
}
function guardar(E, books, campo) {
  const tMin = Math.round(Date.now() / 60000);
  books.forEach(b => {
    const o = compacto(b);
    if (campo === 'cl') { E.cl = E.cl || { t: tMin, p: {} }; E.cl.p[b.provider] = o; }
    else { E.s = E.s || {}; const L = E.s[b.provider] = E.s[b.provider] || []; const u = L[L.length - 1]; if (!u || !igual(u[1], o)) L.push([tMin, o]); }
    if (b.oc) E.oc = b.oc;
  });
  E.n = Date.now();
}
if (liveOk && !pausa) {
  const M = payload.matches.filter(x => x.sport !== 'nba' && x.competition && x.competition.code);
  // a) jogos por jogar, até 4 dias: quanto mais perto do jogo, mais vezes se vê a odd
  const due = [];
  M.forEach(x => {
    const ko = new Date(x.utcDate).getTime(), tk = ko - agora, id = String(x.id);
    let E = odds.ev[id];
    if (x.status === 'TIMED' && tk > 0 && tk <= 96 * H) {
      if (!E) E = odds.ev[id] = { c: x.competition.code, ko, h: x.homeTeam.shortName || x.homeTeam.name, a: x.awayTeam.shortName || x.awayTeam.name, n: 0 };
      E.ko = ko;
      const cada = tk > 48 * H ? 12 * H : tk > 24 * H ? 6 * H : tk > 6 * H ? 3 * H : tk > 2 * H ? H : 0;
      if (agora - (E.n || 0) >= cada - 5 * 60e3) due.push({ id, tk, E, tipo: 's' });
    } else if (E) {
      if (x.status === 'FINISHED' && x.score && x.score.fullTime && x.score.fullTime.home != null) E.fin = { h: x.score.fullTime.home, a: x.score.fullTime.away, d: x.score.duration || undefined };
      if (x.status === 'POSTPONED') E.adiado = 1;
      // b) odd de fecho: uma leitura depois de o jogo começar
      if (!E.cl && !E.adiado && tk < -10 * 60e3 && tk > -3 * 24 * H && (E.clTry || 0) < 3) due.push({ id, tk: Math.abs(tk) + 96 * H, E, tipo: 'cl' });
    }
  });
  oddsInfo.emCurso = due.length;
  due.sort((a, b) => a.tk - b.tk);
  for (const d of due.slice(0, MAX_ODDS)) {
    if (pausa) break;
    const books = await lerOdds(d.E.c, d.id); oddsInfo.pedidos++;
    if (d.tipo === 'cl') d.E.clTry = (d.E.clTry || 0) + 1;
    if (!books) continue;
    if (books.length) { guardar(d.E, books, d.tipo); if (d.tipo === 'cl') oddsInfo.fecho++; else { oddsInfo.comOdds++; frescos[d.id] = books[0]; } }
    else d.E.n = Date.now();
  }
  // c) jogos acabados → arquivo do mês (para os testes do laboratório); saem do ficheiro vivo ao fim de 3 dias
  const porMes = {};
  Object.keys(odds.ev).forEach(id => {
    const E = odds.ev[id], idade = agora - E.ko;
    if ((E.fin || E.adiado) && !E.arq && (E.cl || idade > 12 * H)) {
      const mes = new Date(E.ko).toISOString().slice(0, 7); (porMes[mes] = porMes[mes] || []).push([id, E]); E.arq = 1;
    }
    if (idade > 3 * 24 * H && (E.arq || idade > 6 * 24 * H)) delete odds.ev[id];
  });
  Object.keys(porMes).forEach(mes => {
    const A = rd(`hist/${mes}.json`, { v: 1, mes, ev: {} });
    porMes[mes].forEach(([id, E]) => { const c = { ...E }; delete c.arq; delete c.n; delete c.clTry; A.ev[id] = c; oddsInfo.arquivados++; });
    wr(`hist/${mes}.json`, A);
  });
  odds.at = new Date().toISOString();
  wr('odds.json', odds);
}
console.log('odds', JSON.stringify(oddsInfo), 'pedidos', net.n);

/* ---------- 3) piloto na nuvem ---------- */
let piloto = null;
if (liveOk) {
  try {
    const books = {};
    Object.keys(odds.ev).forEach(id => {
      const E = odds.ev[id]; if (frescos[id]) { books[id] = { ...frescos[id], scorers: [] }; return; }
      const prov = E.s && (E.s.Bet365 ? 'Bet365' : Object.keys(E.s)[0]); const L = prov && E.s[prov]; const u = L && L[L.length - 1];
      if (u && agora - u[0] * 60000 < 13 * H) books[id] = { provider: prov, odds: u[1], scorers: [], oc: E.oc };
    });
    w.__ROBO_IN = JSON.stringify({ books, maxEstudos: pausa ? 0 : 8, testeEstudo: Number(process.env.ROBO_TESTE_ESTUDO) || 0, hist: rd('piloto-hist.json', { v: 1, bets: {} }).bets });
    piloto = JSON.parse(await ev(fs.readFileSync(path.join(HERE, 'piloto.js'), 'utf8')));
    (piloto.out.log || []).forEach(nota);
    // histórico completo do piloto, para estudo e para imprimir: JSON + CSV (abre no Excel)
    if (piloto.hist) wr('piloto-hist.json', { v: 1, at: new Date().toISOString(), bets: piloto.hist });
    if (piloto.csv) { fs.writeFileSync(path.join(DIR, 'piloto.csv'), piloto.csv); }
    const antes = rd('piloto.json', null);
    wr('piloto.json', { at: new Date().toISOString(), ver: VER, regras: piloto.regras, nomes: piloto.nomes, carteiras: piloto.wallets, desde: (antes && antes.desde) || new Date().toISOString() });
  } catch (e) { nota('piloto: ' + (e && e.message)); }
  // segunda fonte de odds: só mede a Betano contra o preço justo da Pinnacle (não aposta)
  try {
    const { valor } = await import('./valor.mjs');
    const rv = await valor({ DIR, payload: liveOk ? payload : rd('live.json', null), piloto: rd('piloto.json', null), key: process.env.ODDSPAPI_KEY || '', maxDia: Number(process.env.ROBO_VALOR_DIA) || 6 });
    console.log('valor', JSON.stringify(rv));
  } catch (e) { console.log('valor: ' + (e && e.message)); }
  // fecho de mês: no primeiro dia em que o mês anterior já acabou, o resumo do piloto por liga fica gravado e não volta a mudar
  try {
    const M = JSON.parse(await ev('typeof stAccMonths === "function" ? JSON.stringify(stAccMonths("auto")) : "{}"'));
    const agoraMes = new Date().toISOString().slice(0, 7), idx = rd('fecho/indice.json', { v: 1, meses: [] });
    for (const mes of Object.keys(M).sort()) {
      if (mes >= agoraMes || idx.meses.includes(mes)) continue;
      const n = v => (Math.round(v * 100) / 100).toFixed(2).replace('.', ','), pc = (a, b) => b ? (a / b * 100).toFixed(1).replace('.', ',') : '';
      const lin = (lg, o) => [mes, lg, o.n, o.win, o.n - o.win, pc(o.win, o.n), n(o.stake), n(o.pr), pc(o.pr, o.stake), o.cn ? pc(o.cs, o.cn) : '', o.cn || 0].join(';');
      const linhas = ['mês;liga;apostas;ganhas;perdidas;acerto %;apostado €;resultado €;por € apostado %;odd apanhada vs fecho %;apostas com odd de fecho']
        .concat(Object.entries(M[mes].lg).sort((a, b) => b[1].n - a[1].n).map(([lg, o]) => lin(lg, o)), [lin('TOTAL', M[mes].tot)]);
      fs.mkdirSync(path.join(DIR, 'fecho'), { recursive: true });
      fs.writeFileSync(path.join(DIR, 'fecho', mes + '.csv'), '\ufeff' + linhas.join('\r\n'));
      wr(`fecho/${mes}.json`, { v: 1, mes, fechado: new Date().toISOString(), ver: VER, piloto: M[mes] });
      idx.meses.push(mes); console.log('fecho de mês gravado:', mes);
    }
    idx.meses.sort(); wr('fecho/indice.json', idx);
  } catch (e) { nota('fecho: ' + (e && e.message)); }
}
console.log('piloto', piloto ? JSON.stringify(piloto.out) : 'não correu');

/* ---------- 4) memória e estado ---------- */
const ls = {}; let bytes = 0;
for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); if (SEM_GUARDAR.has(k)) continue; const v = w.localStorage.getItem(k); if (v.length > 1.5e6) { nota('memória: «' + k + '» grande demais (' + v.length + '), não guardo'); continue; } ls[k] = v; bytes += v.length; }
wr('estado.json', { at: new Date().toISOString(), ls });
const saude = {
  at: new Date().toISOString(), ms: Date.now() - T0, ver: VER, ok: liveOk && !pausa,
  rede: { pedidos: net.n, ok: net.ok, falhas: net.falhas, pausaEspn: net.s429, bloqueados: net.bloqueados },
  jogos: { ...resumo, ligas: ligasOk.length }, odds: { ...oddsInfo, seguidos: Object.keys(odds.ev).length },
  piloto: piloto ? piloto.out : null, memoria: { chaves: Object.keys(ls).length, kb: Math.round(bytes / 1024) },
  erros: erros.concat(jsErros.slice(0, 5)).slice(0, 12)
};
delete (saude.piloto || {}).log;
// histórico curto das corridas (para ver se o robô anda a falhar)
const antes = rd('robo.json', null);
saude.corridas = ((antes && antes.corridas) || []).concat([[saude.at, saude.ok ? 1 : 0, net.n, saude.ms]]).slice(-60);
wr('robo.json', saude);
console.log('fim', JSON.stringify({ ms: saude.ms, rede: saude.rede, memoria: saude.memoria, erros: saude.erros }));
process.exit(0);
