/* =====================================================================
   v30 · Notícias de todos os países: Google Notícias da liga (língua
   local) + Portugal; sinais em 9 línguas. Só títulos + link.
   ===================================================================== */
const EDITIONS = {
  PT: { q: 'hl=pt-PT&gl=PT&ceid=PT:pt-150', lang: 'pt', flag: '🇵🇹', kw: 'lesão OR castigo OR convocados OR poupar OR treinador' },
  GB: { q: 'hl=en-GB&gl=GB&ceid=GB:en', lang: 'en', flag: '🇬🇧', kw: 'injury OR injured OR suspended OR "ruled out" OR doubt OR rotation OR sacked' },
  ES: { q: 'hl=es&gl=ES&ceid=ES:es', lang: 'es', flag: '🇪🇸', kw: 'lesión OR baja OR sancionado OR duda OR rotaciones OR destituido' },
  IT: { q: 'hl=it&gl=IT&ceid=IT:it', lang: 'it', flag: '🇮🇹', kw: 'infortunio OR squalificato OR "in dubbio" OR turnover OR esonerato' },
  DE: { q: 'hl=de&gl=DE&ceid=DE:de', lang: 'de', flag: '🇩🇪', kw: 'verletzt OR gesperrt OR fraglich OR Rotation OR entlassen' },
  FR: { q: 'hl=fr&gl=FR&ceid=FR:fr', lang: 'fr', flag: '🇫🇷', kw: 'blessé OR suspendu OR incertain OR forfait OR rotation OR limogé' },
  NL: { q: 'hl=nl&gl=NL&ceid=NL:nl', lang: 'nl', flag: '🇳🇱', kw: 'geblesseerd OR geschorst OR twijfelachtig OR rotatie OR ontslagen' },
  TR: { q: 'hl=tr&gl=TR&ceid=TR:tr', lang: 'tr', flag: '🇹🇷', kw: 'sakat OR cezalı OR rotasyon OR kadroda' },
  DK: { q: 'hl=da&gl=DK&ceid=DK:da', lang: 'da', flag: '🇩🇰', kw: 'skadet OR karantæne OR tvivl OR fyret' },
  FI: { q: 'hl=fi&gl=FI&ceid=FI:fi', lang: 'fi', flag: '🇫🇮', kw: 'loukkaantunut OR pelikielto OR epävarma' },
  BE: { q: 'hl=fr&gl=BE&ceid=BE:fr', lang: 'fr', flag: '🇧🇪', kw: 'blessé OR suspendu OR incertain OR forfait' }
};
const CODE_ED = { 'por': 'PT', 'eng': 'GB', 'sco': 'GB', 'esp': 'ES', 'ita': 'IT', 'ger': 'DE', 'fra': 'FR', 'ned': 'NL', 'tur': 'TR', 'den': 'DK', 'fin': 'FI', 'bel': 'BE', 'alg': 'FR', 'ukr': 'GB', 'ksa': 'GB', 'afc': 'GB', 'uefa': 'GB' };
function leagueEditions(m) {
  let ed = null;
  if (m.espn && m.espn.code) ed = CODE_ED[m.espn.code.split('.')[0]];
  if (!ed) {
    const L = normTxt(m.league || '');
    ed = /liga portugal|liga 3|liga 2 pt|portugal/.test(L) ? 'PT' : /premier|championship|scotland|escocia/.test(L) ? 'GB'
      : /la ?liga|segunda|espanha/.test(L) ? 'ES' : /serie [ab]|italia/.test(L) ? 'IT' : /bundesliga|alemanha/.test(L) ? 'DE'
      : /ligue 1|franca/.test(L) ? 'FR' : /eredivisie|eerste|holanda/.test(L) ? 'NL' : /super ?lig|turquia/.test(L) ? 'TR'
      : /superliga|dinamarca/.test(L) ? 'DK' : /veikkaus|finlandia/.test(L) ? 'FI' : 'GB';
  }
  const list = [ed];
  if (ed !== 'PT') list.push('PT');            // a imprensa portuguesa também fala dos grandes estrangeiros
  if (ed !== 'GB' && ed !== 'PT') list.push('GB');
  return list.map(k => ({ k, ...EDITIONS[k] }));
}

/* Sinais em 9 línguas (texto já sem acentos, minúsculas) */
NEWS_SIGNALS.length = 0;
NEWS_SIGNALS.push(
  { k: 'out', label: '🚑 Possível ausência', re: /\b(lesao|lesionad|lesionou|rotura|entorse|fratura|operad|baixa|fora do jogo|fora da convocatoria|nao convocad|nao recupera|falha o jogo|falha a partida|ausencia|ausente|injur|ruled out|sidelined|out for|will miss|set to miss|to miss|misses|hamstring|surgery|lesion|se pierde|infortun|salta |out per|verletz|fallt aus|fehlt|bless|forfait|manquera|geblesseerd|blessure|ontbreekt|sakat|skade|loukkaant)/ },
  { k: 'doubt', label: '❓ Em dúvida', re: /\b(em duvida|duvida|incerto|condicionad|tocado|queixas|doubt|fitness test|race to be fit|uncertain|knock|en el aire|in dubbio|da valutare|acciaccat|fraglich|angeschlagen|incertain|douteux|twijfel|tvivl|epavarma)/ },
  { k: 'susp', label: '🟥 Castigo', re: /\b(castigad|suspens|expuls|cartao vermelho|suspend|banned|ban for|red card|sent off|sancion|suspendid|roja|squalific|espuls|gesperrt|sperre|rote karte|suspendu|carton rouge|geschorst|schorsing|cezali|karantaene|pelikielto)/ },
  { k: 'back', label: '✅ Regresso', re: /\b(regressa|recuperad|volta aos convocados|apto|de volta|returns|back in training|fit again|available again|recovered|vuelve|alta medica|rientra|recuperat|torna a disposizione|zuruck|wieder fit|einsatzbereit|de retour|retour de|weer fit|terug in)/ },
  { k: 'rot', label: '🔄 Poupança', re: /\b(poupa|poupar|poupanca|rotacao|gestao de esforco|titulares no banco|equipa alternativa|segundas linhas|rotat|rested|resting|weakened side|rotacion|descanso|suplentes|turnover|rotazion|riposo|geschont|schonen|menag|rotatie|rotasyon)/ },
  { k: 'coach', label: '🧑‍💼 Treinador', re: /\b(despedid|demitid|chicotada|interino|novo treinador|saida do treinador|sack|fired|interim|new manager|new head coach|destituid|cesad|nuevo entrenador|esonerat|nuovo allenatore|entlassen|neuer trainer|interims|limog|nouvel entraineur|ontslagen|nieuwe trainer|fyret|kovulan|gorevden)/ },
  { k: 'motiv', label: '🔥 Motivação', re: /\b(decisiv|titulo|despromocao|manutencao|derbi|derby|classico|title race|relegation|must win|decider|descenso|scudetto|salvezza|retrocession|abstieg|meisterschaft|maintien|degradatie|kampioen)/ }
);

zeNews = async function (m) {
  const H = cleanTeamQ(m.home), A = cleanTeamQ(m.away);
  const eds = leagueEditions(m);
  const jobs = [];
  eds.forEach((e, i) => {
    jobs.push({ e, q: `"${H}" "${A}"` });
    if (i === 0) { jobs.push({ e, q: `"${H}" (${e.kw})` }); jobs.push({ e, q: `"${A}" (${e.kw})` }); }
    else if (e.k === 'PT') jobs.push({ e, q: `("${H}" OR "${A}") (${e.kw})` });
  });
  const res = await Promise.all(jobs.slice(0, 6).map(j => fetchText(`https://news.google.com/rss/search?q=${encodeURIComponent(j.q + ' when:4d')}&${j.e.q}`)
    .then(x => parseRSS(x).map(it => ({ ...it, flag: j.e.flag, lang: j.e.lang }))).catch(() => null)));
  if (res.every(x => x == null)) throw new Error('sem acesso às notícias');
  const seen = new Set(), items = [];
  res.flat().filter(Boolean).forEach(x => { const k = normTxt(x.title).slice(0, 80); if (!seen.has(k)) { seen.add(k); items.push(x); } });
  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  // só títulos que falam de uma das duas equipas (o Google às vezes mistura outros jogos)
  const about = x => { const t = expandAliases(normTxt(x.title)); return teamIn(m.home, t) > 0 || teamIn(m.away, t) > 0; };
  const recent = items.filter(x => (!x.date || Date.now() - new Date(x.date).getTime() < 5 * 864e5) && about(x)).slice(0, 16);
  return { t: Date.now(), items: recent, signals: newsSignals(m, recent), editions: eds.map(e => e.flag) };
};
/* bandeira da edição ao lado da fonte */
const _newsHTMLV29 = newsHTML;
newsHTML = function (m) {
  let h = _newsHTMLV29(m);
  const st = studyFor(m);
  if (!st || !st.news || !st.news.items) return h;
  st.news.items.forEach(it => { if (it.flag) h = h.split(`(${esc(it.source)}, `).join(`(${it.flag} ${esc(it.source)}, `); });
  if (st.news.editions) h = h.replace('📰 Nos jornais (últimos dias)', `📰 Nos jornais ${st.news.editions.join(' ')} (últimos dias)`);
  return h;
};

/* ---------- Correção: «Man United» já não apanha a ficha do «Man City» ---------- */
getTeamKB = function (name) {
  if (!name) return null;
  if (TEAM_KB[name]) return TEAM_KB[name];
  // todas as palavras de um nome têm de estar no outro (Man United ≠ Man City; SL Benfica = Benfica)
  const ex = x => ' ' + expandAliases(normTxt(x).replace(/\./g, '')) + ' ';
  const allIn = (a, b) => { const tk = teamTokens(a); return tk.length > 0 && tk.every(t => b.includes(' ' + t + ' ')); };
  const k = Object.keys(TEAM_KB).find(k => allIn(k, ex(name)) || allIn(name, ex(k)));
  return k ? TEAM_KB[k] : null;
};

/* ---------- Sinais: plantel conhecido ou nome tirado do próprio título ---------- */
const HEAD_STOP = new Set(['ao', 'no', 'na', 'em', 'the', 'el', 'la', 'los', 'las', 'il', 'lo', 'gli', 'der', 'die', 'das', 'le', 'les', 'de', 'do', 'da', 'o', 'a', 'os', 'as', 'un', 'una', 'um', 'uma', 'fc', 'sc', 'cf', 'ac', 'sl', 'ud', 'cd', 'liga', 'league', 'premier', 'serie', 'champions', 'bundesliga', 'janeiro', 'fevereiro', 'novembro', 'dezembro', 'monday', 'sunday', 'saturday', 'domingo', 'sabado', 'segunda', 'news', 'live', 'video', 'official', 'oficial', 'breaking', 'update', 'exclusive', 'exclusivo']);
function guessPlayer(title, m) {
  const words = String(title).split(/[\s:,;—–\-'"«»“”‘’()!?|/]+/).filter(Boolean);
  const isTeamWord = w => { const t = normTxt(w); return !t || teamTokens(m.home).concat(teamTokens(m.away), normTxt(m.home).split(' '), normTxt(m.away).split(' ')).includes(t) || /^(man|utd)$/.test(t); };
  const seqs = []; let cur = [];
  words.forEach((w, i) => {
    const cap = /^[A-ZÀ-ÝŁŚŻ][a-zà-ÿłśżćńó'.]{2,}$/.test(w) && !HEAD_STOP.has(normTxt(w)) && !isTeamWord(w);
    if (cap) cur.push({ w, i }); else { if (cur.length) seqs.push(cur); cur = []; }
  });
  if (cur.length) seqs.push(cur);
  const s = seqs.find(x => x.length <= 3 && x.some(y => y.w.length >= 4));
  if (!s) return null;
  const name = s.map(x => x.w).join(' ');
  const t = normTxt(title);
  const ih = teamTokens(m.home).map(x => t.indexOf(x)).filter(x => x >= 0), ia = teamTokens(m.away).map(x => t.indexOf(x)).filter(x => x >= 0);
  let side = null;
  if (ih.length && !ia.length) side = 'h'; else if (ia.length && !ih.length) side = 'a';
  else if (ih.length && ia.length) { const pos = t.indexOf(normTxt(name)); side = Math.abs(Math.min(...ih) - pos) <= Math.abs(Math.min(...ia) - pos) ? 'h' : 'a'; }
  // «Nico Williams, baixa frente ao Espanyol» → é do outro lado
  if (side && (ih.length + ia.length) && !(ih.length && ia.length)) {
    const pos = Math.min(...(side === 'h' ? ih : ia));
    if (/(^| )(ante|contra|frente|vs|v|against|contro|gegen|face|tegen|versus|diante)( (o|a|ao|el|al|la|le|il|lo|the|den|die|der|de))? $/.test(t.slice(Math.max(0, pos - 22), pos))) side = side === 'h' ? 'a' : 'h';
  }
  return side ? { name, side } : null;
}
function teamIn(name, t) {
  t = String(t).replace(/[.,+\-/]/g, ' ').replace(/\s+/g, ' ');   // «Venezia,» também é Venezia
  const sc = teamScore(name, t); if (sc > 0) return sc;
  const tk = teamTokens(name);   // «Athletic», «Sporting»: nome só com palavra genérica
  return tk.length && tk.every(x => TEAM_GENERIC.has(x)) && tk.every(x => new RegExp('(^| )' + x + '( |$)').test(t)) ? 1 : 0;
}
function teamSide(m, t) {
  const tx = expandAliases(t), h = teamIn(m.home, tx), a = teamIn(m.away, tx);
  return h > a ? 'h' : a > h ? 'a' : null;
}
newsSignals = function (m, items) {
  const b = boardFor(m) || (studyFor(m) && studyFor(m).board);
  const players = b ? b.home.map(p => ({ ...p, side: 'h' })).concat(b.away.map(p => ({ ...p, side: 'a' })))
    : playersOf(m.home).map(p => ({ ...p, side: 'h' })).concat(playersOf(m.away).map(p => ({ ...p, side: 'a' })));
  const out = [];
  items.forEach((it, i) => {
    const t = normTxt(it.title).replace(/[.,+\-/]/g, ' ').replace(/\s+/g, ' ');
    const sigs = NEWS_SIGNALS.filter(s => s.re.test(t));
    if (!sigs.length) return;
    let pl = players.find(p => normTxt(p.name).split(' ').filter(x => x.length >= 5).some(s => new RegExp('(^| )' + s + '( |$)').test(t))) || null;
    let guessed = false;
    if (!pl && sigs.some(s => ['out', 'doubt', 'susp', 'back'].includes(s.k))) { const g = guessPlayer(it.title, m); if (g) { pl = g; guessed = true; } }
    const team = teamSide(m, t) || (pl ? pl.side : null);
    sigs.forEach(s => {
      if (['out', 'doubt', 'susp', 'back'].includes(s.k) && !pl) return;
      if (['rot', 'coach', 'motiv'].includes(s.k) && !team) return;
      out.push({ i, k: s.k, label: s.label + (guessed && ['out', 'doubt', 'susp', 'back'].includes(s.k) ? ' (nome lido do título)' : ''), player: pl ? pl.name : null, side: pl ? pl.side : team, guessed });
    });
  });
  const seen = new Set();
  return out.filter(s => { const key = s.k === 'motiv' ? 'motiv' : s.k + '|' + (s.player || s.side); if (seen.has(key)) return false; seen.add(key); return true; });
};

/* ---------- Nome lido do título: o Zé diz de que equipa acha que é, e deixa trocar ---------- */
const _newsApplyV30 = newsApply;
newsApply = function (idx, j, what) {
  if (what === 'swap') {
    const m = matches[idx], st = m && studyFor(m), sg = st && st.news && st.news.signals[j];
    if (!sg) return;
    sg.side = sg.side === 'h' ? 'a' : 'h';
    ['studyBox', 'dueloStudy'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = reasoningHTML(m); });
    const last = [...document.querySelectorAll('#chatLog .reason')].pop();
    if (last && last.parentNode) last.parentNode.innerHTML = reasoningHTML(m);
    return;
  }
  return _newsApplyV30(idx, j, what);
};
const _newsHTMLV30b = newsHTML;
newsHTML = function (m) {
  let h = _newsHTMLV30b(m);
  const st = studyFor(m); if (!st || !st.news) return h;
  const idx = matchIndex(m);
  st.news.signals.forEach((sg, j) => {
    if (!sg.guessed) return;
    const key = `onclick="newsApply(${idx},${j},'ignore')"`;
    h = h.replace(`<button class="mini x" ${key}`, `<button class="mini" onclick="newsApply(${idx},${j},'swap')" title="Li o nome no título — confirma a equipa">Equipa: ${esc(sg.side === 'h' ? m.home : m.away)} ↔</button><button class="mini x" ${key}`);
  });
  return h;
};
