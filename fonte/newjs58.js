/* ===== v62 · 🌍 Seleções: Liga das Nações, Qualificações, Euro e Mundial =====
   Simulação (635 jogos: Mundial 2026, Euro 2024, Liga das Nações 24/25 e 26/27, Qualificação Mundial):
   - o Zé sozinho (só a tabela da prova) promete demais: 72% vs 77%, ROI −9% com odd ≥ 1.25;
   - com as odds das casas (jogo estudado) fica ao nível do mercado: 82% vs 77%, ROI +2.5% (167);
   - perto do Selo de ouro: 79% vs 73%, ROI +2.9% (124); a Qualificação Mundial foi a pior (−6.5%).
   Regras: só se sugere/aposta depois de estudado com odds; 1.ª jornada fica de fora (sem tabela não há
   previsão); qualificações sem Selo de ouro; tudo marcado com 🌍. */
const INTL_LEAGUES = {
  'uefa.nations': '🌍 Liga das Nações', 'fifa.worldq.uefa': '🌍 Qualificação Mundial', 'uefa.euroq': '🌍 Qualificação Euro',
  'uefa.euro': '🌍 Euro', 'fifa.world': '🌍 Mundial'
};
const INTL_QUAL = ['fifa.worldq.uefa', 'uefa.euroq'];
function isIntl(m) { return !!(m && m.espn && INTL_LEAGUES[m.espn.code]); }
function intlStudied(m) { const st = studyFor(m); return !!(st && st.books && st.books.length); }
// só nos meses com jogos de seleções (março, junho, julho, setembro, outubro, novembro) — menos pedidos à ESPN
function intlWindow(d) { return [2, 5, 6, 8, 9, 10].includes((d || new Date()).getMonth()); }
(function () {
  if (typeof EXTRA_LEAGUES !== 'undefined') Object.keys(INTL_LEAGUES).forEach(k => { if (EXTRA_LEAGUES[k]) EXTRA_LEAGUES[k] = INTL_LEAGUES[k]; });
  LEAGUE_HINTS.unshift([/qualifica[cç][aã]o mundial|world cup qual/i, 'fifa.worldq.uefa'], [/qualifica[cç][aã]o euro|euro(pean championship)? qual/i, 'uefa.euroq'],
    [/liga das na[cç][oõ]es|nations league/i, 'uefa.nations'], [/^🌍 euro$|^uefa euro|european championship$/i, 'uefa.euro'], [/^🌍 mundial$|^fifa world cup$/i, 'fifa.world']);
})();
const _refreshLeaguesV62 = refreshLeagues;
refreshLeagues = function () {
  const L = _refreshLeaguesV62.apply(this, arguments);
  if (intlWindow()) Object.keys(INTL_LEAGUES).forEach(c => { if (!L.includes(c)) L.push(c); });
  return L;
};
// os nomes só entram durante o Atualizar (o resto da app — épocas passadas, calendário — não passa a pedir estas provas)
atualizarTudo = (function (prev) {
  return async function () {
    const add = intlWindow() ? Object.keys(INTL_LEAGUES).filter(k => !_ESPN_ALL[k]) : [];
    add.forEach(k => { _ESPN_ALL[k] = INTL_LEAGUES[k]; });
    try { return await prev.apply(this, arguments); }
    finally { add.forEach(k => { delete _ESPN_ALL[k]; delete ESPN_LEAGUES[k]; }); }
  };
})(atualizarTudo);
/* 1) sem odds não há sugestão nem aposta do Zé (desafios, piloto, boletins dos desafios) */
const _zeChallengesRawV62 = zeChallengesRaw;
zeChallengesRaw = function () { return _zeChallengesRawV62.apply(this, arguments).filter(c => !isIntl(c.m) || intlStudied(c.m)); };
/* o diário (estatísticas do Zé) só grava a opinião depois de o jogo estar estudado com odds */
const _diarySnapV62 = diarySnap;
diarySnap = function (m) { if (isIntl(m) && !intlStudied(m)) return false; return _diarySnapV62.apply(this, arguments); };
/* 2) qualificações: nada de Selo de ouro */
const _zeSeloV62 = zeSelo;
zeSelo = function (m) {
  const r = _zeSeloV62.apply(this, arguments);
  if (r && m && m.espn && INTL_QUAL.includes(m.espn.code)) { r.bad = (r.bad || []).concat('🌍 qualificação de seleções — jogos muito desiguais (na simulação perdia)'); r.grade = null; }
  return r;
};
/* 3) o Zé estuda sozinho até 2 jogos de seleções por hora (para ter as odds) */
let INTL_STUDY_AT = 0, INTL_STUDY_RUN = false;
async function intlAutoStudy(force) {
  if (INTL_STUDY_RUN || /jsdom/i.test(navigator.userAgent || '') || window.__ZE_LAB || navigator.onLine === false) return 0;
  if (!force && Date.now() - INTL_STUDY_AT < 60 * 60e3) return 0;
  if (typeof espnCooling === 'function' && espnCooling()) return 0;
  const now = Date.now();
  const C = matches.filter(m => isIntl(m) && m.live && !m.past && m.espn && m.espn.ev && !intlStudied(m)).map(m => ({ m, k: kickOf(m) }))
    .filter(x => x.k && x.k.getTime() > now + 15 * 60e3 && x.k.getTime() < now + 36 * 3600e3)
    .filter(x => { const st = studyFor(x.m); return !(st && st.oddsTried && now - st.oddsTried < 3 * 3600e3); })
    .sort((a, b) => a.k - b.k).slice(0, 2);
  if (!C.length) return 0;
  INTL_STUDY_RUN = true; INTL_STUDY_AT = now; let n = 0;
  try {
    for (const x of C) {
      try { await zeStudy(x.m); n++; } catch (e) {}
      if (typeof espnCooling === 'function' && espnCooling()) break;
      await new Promise(r => setTimeout(r, 2500));
    }
  } finally { INTL_STUDY_RUN = false; }
  if (n) { try { CH_MEM = null; } catch (e) {} setTimeout(() => { try { zeAutoRun().catch(() => {}); } catch (e) {} }, 1500); }
  return n;
}
seloAutoStudy = (function (prev) { return async function (force) { const n = await prev.apply(this, arguments); let k = 0; try { k = await intlAutoStudy(force); } catch (e) {} return n + k; }; })(seloAutoStudy);
/* 4) no cartão do jogo: aviso enquanto não houver odds */
function intlNote(m) {
  if (!isIntl(m) || m.past) return '';
  return intlStudied(m) ? '<div class="muted" style="font-size:.72rem;margin-top:4px;">🌍 Seleções · com odds das casas — o Zé já pode sugerir.</div>'
    : '<div class="muted" style="font-size:.72rem;margin-top:4px;">🌍 Seleções · o Zé só sugere depois de ver as odds das casas (sozinho promete demais nestes jogos).</div>';
}

/* ===== v62 · ligas novas que passaram no teste (época 26/27, sem ver o futuro, odds da altura) =====
   2. Bundesliga: aposta lógica 79% (prometia 78%), ouro 83% em 29 (prometia 70%)
   Ligue 2:       aposta lógica 74% (76%), ouro 76% em 17 (71%)
   Ficaram de fora por agora (ouro abaixo do prometido): Bélgica, Turquia, Escócia, Áustria, LaLiga 2.
   Polónia, Chéquia, Croácia, Suíça e Liga Portugal 2: a ESPN não tem dados. */
['ger.2', 'fra.2'].forEach(c => { if (!CORE_LEAGUES.includes(c)) CORE_LEAGUES.push(c); });
