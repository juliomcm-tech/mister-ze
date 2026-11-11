/* Laboratório: constrói o ficheiro de uma época para auditoria.
   Corre a app sem ecrã e, para cada jogo já acabado, guarda o resultado, as odds (com abertura e fecho),
   e o que o Zé teria escolhido nesse dia SEM ver o futuro (só usa jogos anteriores).
   uso: node robo/lab.mjs 2024      (= época 2024/25)   saída: <ROBO_DADOS>/<época>.json */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ANO = Number(process.argv[2]); if (!(ANO > 2015)) { console.error('uso: node robo/lab.mjs 2024'); process.exit(1); }
const DIR = process.env.ROBO_DADOS || 'lab';
const APP = process.env.ROBO_APP || path.join(HERE, '..', 'classico.html');
const LIGAS = (process.env.LAB_LIGAS || 'por.1 eng.1 eng.2 esp.1 ita.1 ger.1 fra.1 ned.1 ger.2 fra.2').split(/\s+/).filter(Boolean);
const MOCK = process.env.ROBO_MOCK ? (await import(process.env.ROBO_MOCK)).default : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ALLOW = /^https:\/\/(site\.api|sports\.core\.api)\.espn\.com\//;
const net = { n: 0, ok: 0, mal: 0 }; let fila = 0;
async function labFetch(u, o) {
  u = String(u); if (!ALLOW.test(u)) return new Response('{}', { status: 599 });
  const wait = Math.max(0, fila + 90 - Date.now()); fila = Date.now() + wait; if (wait) await sleep(wait);
  net.n++; const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), 20000);
  try { const r = MOCK ? await MOCK(u) : await fetch(u, { signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; MisterZeRobo/1.0; +https://github.com/juliomcm-tech/mister-ze)', accept: 'application/json' } }); r.ok ? net.ok++ : net.mal++; return r; }
  catch (e) { net.mal++; throw e; } finally { clearTimeout(tm); }
}
const meses = []; for (let m = 8; m <= 12; m++) meses.push(`${ANO}${String(m).padStart(2, '0')}`); for (let m = 1; m <= 5; m++) meses.push(`${ANO + 1}0${m}`);
const agora = new Date(), ymAgora = agora.getFullYear() * 100 + agora.getMonth() + 1;
const MESES = meses.filter(m => Number(m) <= ymAgora);
const vc = new VirtualConsole(); const jsErr = []; vc.on('jsdomError', e => jsErr.push(String(e && e.message).slice(0, 160)));
const dom = new JSDOM(fs.readFileSync(APP, 'utf8'), { runScripts: 'dangerously', url: 'https://juliomcm-tech.github.io/mister-ze/', pretendToBeVisual: true, virtualConsole: vc, storageQuota: 60e6,
  beforeParse(w) { w.scrollTo = () => {}; w.fetch = labFetch; w.alert = () => {}; w.confirm = () => true; w.__ROBO = true; w.__ZE_LAB = true; } });
const w = dom.window; await sleep(1500);
w.__FL_LG = LIGAS; w.__FL_MONTHS = MESES; w.__FL_CAP = 5000; w.__FL_END = Date.now() - 6 * 3600e3;
const T0 = Date.now();
const tick = setInterval(() => console.log(`[${Math.round((Date.now() - T0) / 1000)}s]`, String(w.__FLMSG || ''), '· pedidos', net.n, 'falhas', net.mal), 30000);
await w.eval(fs.readFileSync(path.join(HERE, 'lab_dentro.js'), 'utf8'));
clearInterval(tick);
console.log('fim:', String(w.__FLMSG), '· pedidos', net.n, 'falhas', net.mal, '· falhas de odds', w.__FL_FAIL || 0);
const rows = JSON.parse(w.eval('JSON.stringify(window.__FL || [])'));
const all = JSON.parse(w.eval('JSON.stringify((window.__FL_ALL || []).map(x => ({ id: String(x.id), t: x.utcDate, c: x.competition.code, hid: String(x.homeTeam.id), aid: String(x.awayTeam.id), h: x.homeTeam.shortName || x.homeTeam.name, a: x.awayTeam.shortName || x.awayTeam.name, i: x.score.fullTime.home, j: x.score.fullTime.away, dur: x.score.duration || undefined })))'));
const ver = w.eval('typeof APP_VER !== "undefined" ? APP_VER : "?"');
fs.mkdirSync(DIR, { recursive: true });
const out = path.join(DIR, `${ANO}.json`);
fs.writeFileSync(out, JSON.stringify({ meta: { epoca: `${ANO}/${String(ANO + 1).slice(2)}`, feito: new Date().toISOString(), app: ver, ligas: LIGAS, meses: MESES, pedidos: net.n, falhas: net.mal, falhasOdds: w.__FL_FAIL || 0, erro: /^error/.test(String(w.__FLMSG)) ? String(w.__FLMSG) : null, jsErr: jsErr.slice(0, 5) }, rows, all }));
console.log('escrito', out, 'linhas', rows.length, 'jogos', all.length, Math.round(fs.statSync(out).size / 1024) + ' KB');
process.exit(0);
