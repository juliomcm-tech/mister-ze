/* Segunda fonte de odds (OddsPapi) — SÓ MEDE, não aposta.
   Para poucos jogos por dia (os do piloto primeiro), perto da hora do jogo, guarda:
   a odd da Pinnacle (a «régua»), o preço justo sem margem, e a odd da Betano de Portugal.
   Quando o jogo acaba, anota se cada resultado saiu. Tudo fica em dados/valor.json.
   Se a chave faltar, a quota acabar ou o serviço falhar, não acontece nada ao resto do robô. */
import fs from 'node:fs';
import path from 'node:path';

const B = 'https://api.oddspapi.io/v4';
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\b(fc|cf|sc|ac|cd|ud|fk|sk|afc|club|de|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
const same = (a, b) => { a = norm(a); b = norm(b); if (!a || !b) return false; if (a === b || a.includes(b) || b.includes(a)) return true; const A = a.split(' ').filter(x => x.length >= 4), Bt = new Set(b.split(' ').filter(x => x.length >= 4)); return A.some(x => Bt.has(x)); };
const price = (bk, m, o) => { try { const p = bk.markets[m].outcomes[o].players['0']; return p && p.active !== false && p.price > 1 ? p.price : null; } catch (e) { return null; } };

export async function valor({ DIR, payload, piloto, key, maxDia = 6, log = console.log }) {
  const out = { pedidos: 0, novos: 0, fechados: 0, nota: '' };
  const f = path.join(DIR, 'valor.json');
  let V; try { V = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { V = { v: 1, desde: new Date().toISOString(), uso: {}, jogos: [] }; }
  const save = () => { V.at = new Date().toISOString(); fs.writeFileSync(f, JSON.stringify(V)); };
  const now = Date.now(), dia = new Date().toISOString().slice(0, 10), mes = dia.slice(0, 7);
  const usadoMes = () => Object.keys(V.uso).filter(d => d.startsWith(mes)).reduce((s, d) => s + V.uso[d], 0);
  const conta = () => { V.uso[dia] = (V.uso[dia] || 0) + 1; out.pedidos++; };
  const get = async (p, q) => {
    const u = new URL(B + p); Object.entries({ ...q, apiKey: key }).forEach(([k, v]) => u.searchParams.set(k, v));
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 20000);
    try { conta(); const r = await fetch(u, { signal: ac.signal }); if (!r.ok) throw new Error('estado ' + r.status); return await r.json(); } finally { clearTimeout(t); }
  };
  const M = (payload && payload.matches) || [];
  // carteira «Preço justo» do piloto (dinheiro virtual): aposta 1% da banca quando a Betano paga pelo menos 3% acima do preço justo,
  // só em odds entre 1,25 e 4,00 (acima disso a régua é menos fiável), uma aposta por jogo. Regra fixada a 12/11/2026.
  const REGRA = { minVantagem: 0.03, minOdd: 1.25, maxOdd: 4, parte: 0.01 };
  if (!V.carteira) V.carteira = { start: 250, bank: 250, bets: [], topups: [], perDay: 6, since: new Date().toISOString(), on: true, regra: REGRA };
  const C = V.carteira, r2 = x => Math.round(x * 100) / 100;
  const apostar = row => {
    const ks = ['1', 'X', '2']; let best = -1;
    row.valor.forEach((v, i) => { if (v >= REGRA.minVantagem && row.bet[i] >= REGRA.minOdd && row.bet[i] <= REGRA.maxOdd && (best < 0 || v > row.valor[best])) best = i; });
    if (best < 0) return;
    const stake = r2(Math.max(0.1, C.bank * REGRA.parte)); if (stake > C.bank) return;
    C.bank = r2(C.bank - stake);
    C.bets.push({ id: 'pj' + row.fx + ks[best], at: new Date().toISOString(), day: dia, ev: 'op' + row.fx, code: '', h: row.h, a: row.a, lg: row.lg, ko: row.ko, k: ks[best],
      label: best === 0 ? row.h + ' vence' : best === 1 ? 'Empate' : row.a + ' vence', p: row.justo[best], o: row.bet[best], book: 'Betano', stake, how: '1% da banca', evp: row.valor[best], kind: 'justo', st: 'open', rv: 'PJ1', pin: row.pin[best] });
    row.apostou = ks[best]; out.apostas = (out.apostas || 0) + 1;
  };

  // 1) fechar os jogos já medidos que entretanto acabaram (sem pedidos: usa os resultados que o robô já tem)
  V.jogos.forEach(j => {
    if (j.res) return;
    const e = M.find(x => x.status === 'FINISHED' && Math.abs(Date.parse(x.utcDate) - j.ko) < 3 * 3600e3 && same(x.homeTeam.name, j.h) && same(x.awayTeam.name, j.a));
    if (!e || !e.score || !e.score.fullTime || e.score.fullTime.home == null) return;
    const hg = e.score.fullTime.home, ag = e.score.fullTime.away;
    j.res = hg + '-' + ag; j.saiu = hg > ag ? '1' : hg === ag ? 'X' : '2'; out.fechados++;
    C.bets.forEach(b => { if (b.st !== 'open' || b.ev !== 'op' + j.fx) return; b.st = b.k === j.saiu ? 'win' : 'loss'; b.res = j.res; b.settledAt = new Date().toISOString(); if (b.st === 'win') { b.ret = r2(b.stake * b.o); C.bank = r2(C.bank + b.ret); } else b.ret = 0; });
  });

  if (!key) { out.nota = 'sem chave'; save(); return out; }
  if ((V.uso[dia] || 0) >= maxDia + 1) { out.nota = 'limite do dia'; save(); return out; }
  if (usadoMes() >= 190) { out.nota = 'limite do mês'; save(); return out; }

  // 2) que jogos medir agora: começam nas próximas 4 horas, ainda não medidos; os do piloto primeiro
  const pil = []; try { Object.values((piloto && piloto.carteiras) || {}).forEach(a => a.bets.forEach(b => { if (b.st === 'open') pil.push(b); })); } catch (e) {}
  const ja = j => V.jogos.some(x => Math.abs(x.ko - j.ko) < 3 * 3600e3 && same(x.h, j.h) && same(x.a, j.a));
  const cand = M.filter(x => x.status === 'TIMED' && Date.parse(x.utcDate) - now > 20 * 60e3 && Date.parse(x.utcDate) - now < 4 * 3600e3)
    .map(x => ({ h: x.homeTeam.name, a: x.awayTeam.name, ko: Date.parse(x.utcDate), lg: (x.competition && x.competition.name) || '', pil: pil.some(b => same(b.h, x.homeTeam.name) && same(b.a, x.awayTeam.name)) }))
    .filter(j => !ja(j)).sort((p, q) => (q.pil - p.pil) || (p.ko - q.ko));
  const livres = Math.max(0, maxDia - Math.max(0, (V.uso[dia] || 0) - 1));
  const alvo = cand.slice(0, Math.min(3, livres));
  if (!alvo.length) { out.nota = cand.length ? 'limite do dia' : 'nada por medir'; save(); return out; }

  try {
    // lista de jogos da fonte (1 pedido por dia, guardada)
    let L = V.lista && V.lista.dia === dia ? V.lista.jogos : null;
    if (!L) {
      const d = n => new Date(now + n * 864e5).toISOString().slice(0, 10);
      const r = await get('/fixtures', { sportId: 10, from: d(0), to: d(1) });
      L = (Array.isArray(r) ? r : []).filter(x => x.hasOdds).map(x => ({ id: x.fixtureId, h: x.participant1Name, a: x.participant2Name, t: Date.parse(x.startTime) }));
      V.lista = { dia, jogos: L };
    }
    for (const j of alvo) {
      const fx = L.find(x => Math.abs(x.t - j.ko) < 20 * 60e3 && same(x.h, j.h) && same(x.a, j.a)) || L.find(x => Math.abs(x.t - j.ko) < 20 * 60e3 && (same(x.h, j.h) || same(x.a, j.a)));
      if (!fx) { V.jogos.push({ ...j, at: now, falta: 'jogo não encontrado na segunda fonte' }); continue; }
      const r = await get('/odds', { fixtureId: fx.id });
      const bo = (r && r.bookmakerOdds) || {}, pin = bo.pinnacle, bet = bo['betano.pt'] || bo.betano, bf = bo['betfair-ex'];
      const row = { ...j, at: now, fx: fx.id, casas: Object.keys(bo).length, betano: bo['betano.pt'] ? 'pt' : bo.betano ? 'geral' : null };
      if (!pin || !bet) { row.falta = !pin ? 'sem Pinnacle' : 'sem Betano'; V.jogos.push(row); continue; }
      const P = ['101', '102', '103'].map(o => price(pin, '101', o)), Bt = ['101', '102', '103'].map(o => price(bet, '101', o)), F = ['101', '102', '103'].map(o => bf ? price(bf, '101', o) : null);
      if (P.some(x => !x) || Bt.some(x => !x)) { row.falta = 'sem 1X2 completo'; V.jogos.push(row); continue; }
      const inv = P.reduce((s, x) => s + 1 / x, 0), justo = P.map(x => (1 / x) / inv);
      row.pin = P; row.bet = Bt; row.bf = F; row.margemPin = +(inv - 1).toFixed(4); row.margemBet = +(Bt.reduce((s, x) => s + 1 / x, 0) - 1).toFixed(4);
      row.justo = justo.map(x => +x.toFixed(4)); row.valor = Bt.map((x, i) => +(x * justo[i] - 1).toFixed(4));   // >0 = a Betano paga acima do preço justo
      apostar(row); V.jogos.push(row); out.novos++;
      log('valor', j.h, '-', j.a, '| Pinnacle', P.join('/'), '| Betano', Bt.join('/'), '| vantagem', row.valor.map(x => (x * 100).toFixed(1) + '%').join(' '));
    }
  } catch (e) { out.nota = 'falhou: ' + String(e && e.message).slice(0, 80); }
  if (V.jogos.length > 4000) V.jogos = V.jogos.slice(-4000);
  Object.keys(V.uso).sort().slice(0, -70).forEach(d => delete V.uso[d]);
  save(); return out;
}
