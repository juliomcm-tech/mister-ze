/* =====================================================================
   v15 · MISTER ZÉ CONVERSADOR
   Segue o jogo em foco, responde a cada pergunta da mensagem,
   calcula marcadores, rotação, próximo jogo e aceita desafios de aposta.
   ===================================================================== */
const ZE_PROPOSALS = {};
let zePending = null, zeLastProposal = null, zeLastHead = null;
function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }

/** «Jogo do dia» em modo conversa */
function zeJogosDoDia() {
  const list = upcoming(3).slice(0, 4);
  if (!list.length) return { mood: 'pensativo', html: 'Hoje e nos próximos dias não tenho jogos confirmados no radar. Carrega em <b>📡 Jogos reais</b> e eu vou buscar a agenda.' };
  zeLastMatch = list[0].m;
  const rows = list.map((x, k) => {
    const r = modelo(x.m);
    const best = ['1', '1X', 'O1.5', 'O2.5', 'BTTS', 'U2.5', 'X2', '2'].map(kk => ({ kk, p: r.mk[kk] })).filter(o => o.p >= 0.55 && o.p <= 0.85).sort((a, b) => b.p - a.p)[0];
    return `${k === 0 ? '⭐' : '•'} <b>${esc(x.m.home)} vs ${esc(x.m.away)}</b> (${whenTxt(x.m)}${x.m.kickoff ? ', ' + x.m.kickoff : ''}) — ${best ? `${esc(marketName(best.kk, x.m))} ${pct(best.p)} · só a ≥ <b>${((1.03) / best.p).toFixed(2)}</b>` : 'jogo equilibrado, só com odd boa'}${x.m.live ? ' 📡' : ''}`;
  }).join('<br>');
  return { mood: 'feliz', html: `${pickOne(['Ora bem, o menu de hoje:', 'O que me interessa:', 'Radar ligado:'])}<br>${rows}<br><br>Fico de olho no <b>${esc(list[0].m.home)} vs ${esc(list[0].m.away)}</b>. Pergunta-me o que quiseres sobre ele, ou diz «duelo».` };
}

function zeNorm(msg) { return expandAliases(normTxt(msg).replace(/\.(?!\d)/g, ' ')); }
function teamInMatch(m, t) {
  if (!m || !t) return false;
  if (m.home === t || m.away === t) return true;
  const n = normTxt(t);
  return teamScore(m.home, n) > 0 || teamScore(m.away, n) > 0;
}
function teamsMentioned(q) {
  const out = [];
  const add = n => { if (n && !out.some(x => normTxt(x) === normTxt(n) || teamScore(x, normTxt(n)) > 0)) out.push(n); };
  Object.keys(TEAM_KB).forEach(n => { if (teamScore(n, q) > 0) add(n); });
  matches.forEach(m => { [m.home, m.away].forEach(n => { if (teamScore(n, q) > 0) add(n); }); });
  return out;
}
function upcomingWith(team, includeFlagged) {
  return matches.map((m, i) => {
    if (m.past || (!includeFlagged && m.aviso) || !teamInMatch(m, team)) return null;
    const d = parseDayLabel(m.date);
    return d ? { m, i, days: daysFromToday(d) } : null;
  }).filter(x => x && x.days >= 0).sort((a, b) => a.days - b.days);
}
/** Escolhe o jogo de que estamos a falar */
function resolveFocus(q, teams) {
  if (!teams.length) return zeLastMatch || pickDueloMatch();
  if (zeLastMatch && teams.every(t => teamInMatch(zeLastMatch, t))) return zeLastMatch;
  const cand = [];
  teams.forEach(t => upcomingWith(t).forEach(x => cand.push(x)));
  const both = cand.filter(x => teams.filter(t => teamInMatch(x.m, t)).length >= Math.min(2, teams.length)).sort((a, b) => a.days - b.days);
  if (both.length) return both[0].m;
  if (zeLastMatch && teams.some(t => teamInMatch(zeLastMatch, t))) return zeLastMatch;
  cand.sort((a, b) => a.days - b.days);
  return cand.length ? cand[0].m : null;
}
/** Equipa que vem logo a seguir a uma palavra («ataque do Alverca», «poupar o Benfica») */
function teamAfter(q, words, m) {
  const re = new RegExp('(' + words + ')\\s+(?:d[oae]s?\\s+|o\\s+|a\\s+)?([a-z0-9 ]{3,40})');
  const mm = q.match(re);
  if (!mm) return null;
  const tail = mm[2].split(' ').slice(0, 3).join(' ');
  const cand = [m.home, m.away].find(t => teamScore(t, tail) > 0);
  return cand || (teamsMentioned(tail)[0] || null);
}
function sameMatch(a, b) { return !!a && !!b && a.home === b.home && a.away === b.away && a.date === b.date; }
function whenTxt(m) {
  const d = parseDayLabel(m.date);
  const n = d ? daysFromToday(d) : null;
  return n === 0 ? 'hoje' : n === 1 ? 'amanhã' : m.date;
}
function oddsInMsg(msg) {
  const s = ' ' + String(msg).toLowerCase().replace(/,/g, '.') + ' ';
  const out = [];
  const re = /(\d{1,2}\.\d{1,2})/g; let mm;
  while ((mm = re.exec(s))) {
    const before = s.slice(Math.max(0, mm.index - 12), mm.index);
    if (/(over|mais de|menos de|under|\+|-)\s*$/.test(before)) continue;
    const v = parseFloat(mm[1]);
    if (v >= 1.01 && v <= 50) out.push(v);
  }
  return out;
}
/* ---------- Marcadores ---------- */
function playersOf(team) {
  const kb = getTeamKB(team);
  if (!kb || !Array.isArray(kb.marcadores)) return [];
  return kb.marcadores.map((s, rank) => {
    const name = s.split('(')[0].trim();
    const g = (s.match(/~?\s*(\d+)\s*golos?/) || [])[1];
    return { name, rank, goals: g ? +g : null, raw: s, team };
  }).filter(p => p.name && !/^[—-]$/.test(p.name) && !/refer[eê]ncia|linha|ataque/i.test(p.name));
}
function playerMentioned(q, m) {
  const all = playersOf(m.home).concat(playersOf(m.away));
  return all.find(p => p.name.split(/\s+/).some(t => t.length >= 4 && new RegExp('(^| )' + normTxt(t) + '( |$)').test(q))) || null;
}
function scorerProb(m, p) {
  const r = modelo(m);
  const isHome = p.team === m.home || teamScore(m.home, normTxt(p.team)) > 0;
  const lam = isHome ? r.lh : r.la;
  const share = [0.34, 0.2, 0.14][p.rank] || 0.1;
  return 1 - Math.exp(-lam * share * 0.92);
}
/* ---------- Proposta de aposta do Zé (pode haver várias por jogo) ---------- */
function zePropose(m, label, pModel, odd, extra) {
  const dup = zeHasSame(m.home + ' vs ' + m.away, label);
  if (dup) return `🙅 Já tenho <b>${esc(label)}</b> @ ${Number(dup.odd).toFixed(2)} neste jogo. A mesma aposta duas vezes é só aumentar o risco — não repito.`;
  const b = loadBank();
  const cal = zeCalib();
  const minEdge = 0.03 + cal.extraEdge;
  const p = 0.75 * pModel + 0.25 * (1 / odd);
  const ev = p * odd - 1, kelly = (p * odd - 1) / (odd - 1);
  const key = m.home + ' vs ' + m.away;
  const onMatch = b.zeBets.filter(x => x.status === 'open' && x.match === key);
  const openMatch = onMatch.reduce((s, x) => s + Number(x.stake), 0);
  const totalBank = b.ze + openStake(b.zeBets);
  const matchCap = Math.max(0, r2(totalBank * 0.08 - openMatch));
  const globalCap = Math.max(0, r2(totalBank * 0.15 - openStake(b.zeBets)));
  const corr = onMatch.length ? 0.5 : 1;
  if (ev < minEdge) {
    return `🛑 <b>${esc(label)} @ ${odd.toFixed(2)}</b>: não entro. Dou-lhe ${pct(p)} → valor ${(ev * 100).toFixed(1)}%. Medo não, chefe — matemática. Só aceito a <b>≥ ${((1 + minEdge) / pModel).toFixed(2)}</b>.`;
  }
  let stake = r2(Math.min(0.05, kelly * 0.25) * cal.mult * corr * b.ze);
  stake = Math.min(stake, matchCap, globalCap, r2(b.ze));
  if (stake < 0.1) {
    return `🤏 <b>${esc(label)} @ ${odd.toFixed(2)}</b> tem valor (+${(ev * 100).toFixed(1)}%), mas já tenho ${openMatch.toFixed(2)} € neste jogo e não passo de 8% da banca por jogo. Fico de fora.`;
  }
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  ZE_PROPOSALS[id] = { m, label, pModel, p, odd, ev, stake, market: extra && extra.market || label };
  zeLastProposal = id;
  return `✅ <b>Aceito o desafio:</b> ${esc(label)} @ ${odd.toFixed(2)} — dou-lhe ${pct(p)} (justa ${fairOdd(p)}), valor <b class="ev-pos">+${(ev * 100).toFixed(1)}%</b>.<br>
    Stake: <b style="color:var(--lime)">${stake.toFixed(2)} €</b>${corr < 1 ? ' (cortada a meio: já tenho aposta neste jogo e estão correlacionadas)' : ''}.
    <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;"><button class="btn btn-lime btn-sm" onclick="zeAcceptProposal('${id}', this)">🤖 Registar aposta do Zé</button>
    <button class="btn btn-sm" onclick="zeHumanCopy('${id}')">👤 Eu também vou</button></div>`;
}
function zeAcceptProposal(id, btn) {
  const pr = ZE_PROPOSALS[id];
  if (!pr) { toast('Proposta expirada — pede de novo.'); return; }
  if (zeHasSame(pr.m.home + ' vs ' + pr.m.away, pr.label)) { toast('O Zé já tem essa aposta.'); delete ZE_PROPOSALS[id]; return; }
  const ok = addBet({
    match: pr.m.home + ' vs ' + pr.m.away, pick: pr.label, odd: pr.odd, stake: pr.stake, source: 'chat-ze', market: pr.market,
    pModel: +pr.pModel.toFixed(4), pUsed: +pr.p.toFixed(4), ev: +pr.ev.toFixed(4),
    zeCompare: `Desafio no chat · EV +${(pr.ev * 100).toFixed(1)}% · prob ${pct(pr.p)}`
  }, 'ze');
  if (!ok) return;
  delete ZE_PROPOSALS[id];
  zeLastProposal = null;
  if (btn) { btn.disabled = true; btn.textContent = '✔ Registada'; }
  renderBanca();
  addChat('bot', `Feito: <b>${esc(pr.label)}</b> @ ${pr.odd.toFixed(2)} · ${pr.stake.toFixed(2)} €. Banca Zé: ${loadBank().ze.toFixed(2)} €. Agora é contigo. 😏`, 'gozao');
}
function zeHumanCopy(id) {
  const pr = ZE_PROPOSALS[id];
  if (!pr) return;
  fmGo('duelo');
  prepararDuelo(matchIndex(pr.m));
  setTimeout(() => {
    const a = document.getElementById('dueloPickYou'), o = document.getElementById('dueloOddYou');
    if (a) a.value = pr.label; if (o) o.value = pr.odd;
    const s = document.getElementById('dueloStakeYou'); if (s) s.focus();
  }, 60);
}

/* ---------- O cérebro da conversa ---------- */
function zeTalk(raw, opts) {
  opts = opts || {};
  const ctxBox = document.getElementById('pasteCtx');
  const ctx = ctxBox ? ctxBox.value : '';
  const q = zeNorm(raw);
  if (!q) return null;
  if (/^(ajuda|help|comandos)\b|acertos|performance|^o que e |^o que sao |^explica|significa/.test(q)) return null; // deixa o motor antigo

  const oddsNow = oddsInMsg(raw);
  // seguimento: «sim», «bora», «regista» → aceita a última proposta
  if (/^(sim|bora|siga|regista|registar|aceito|vai|venha|ok|força|forca|claro|aposta)( la| ai| isso| entao)?[!.\s]*$/.test(q) && zeLastProposal && ZE_PROPOSALS[zeLastProposal]) {
    zeAcceptProposal(zeLastProposal);
    return { mood: 'gozao', html: '' };
  }
  if (/^(nao|deixa|esquece|cancela|nem pensar)\b/.test(q) && (zeLastProposal || zePending)) {
    zeLastProposal = null; zePending = null;
    return { mood: 'neutro', html: pickOne(['Ok, fica para a próxima. Eu não me ofendo… muito.', 'Combinado, não mexo em nada.', 'Está bem. Dinheiro parado também não perde.']) };
  }
  // seguimento: só uma odd («2.10», «está a 1.95») → aplica ao que eu tinha pedido
  if (zePending && oddsNow.length && !teamsMentioned(q).length && q.replace(/[\d.,@a ]|esta|odd|paga|dao|da/g, '').trim().length < 8) {
    const p = zePending; zePending = null;
    zeLastMatch = p.m;
    return { mood: 'pensativo', html: `${pickOne(['Deixa-me fazer contas…', 'Ok, a essa odd:', 'Vamos ver se vale:'])}<br>` + zePropose(p.m, p.label, p.pModel, oddsNow[oddsNow.length - 1], { market: p.market }) };
  }
  if (/^(jogo do dia|jogos do dia|hoje|o que ha hoje|que jogos ha|sugestao|sugestoes|o que jogas hoje|bora la)\b/.test(q)) return zeJogosDoDia();
  if (/boletim do ze|o teu boletim|propoe|propõe|faz.me um boletim|monta.me|qual o teu boletim|como (ias|irias)/.test(q)) return { mood: 'feliz', html: proposalsHTML() };
  if (/melhores do dia|melhores (selecoes|apostas)|se fosse(s)? parvo|o que vale a pena|qual(is)? (vale|devo)|dos prints|de todos os prints/.test(q)) return zeMelhoresDoDia();
  if (/analisa-?me|analisa me|como estou|o meu perfil|meu desempenho|relatorio|avalia-?me|como jogo|sou bom|sou mau|que tal estou|feedback/.test(q)) return { mood: 'gozao', html: zeProfileHTML() };

  let teams = teamsMentioned(q);
  if (!teams.length && /flashscore/.test(raw + ctx)) {
    const fl = parseFlashscoreUrl((raw + ' ' + ctx).toLowerCase());
    if (fl && fl[0] !== '__espn__') teams = teamsMentioned(fl.join(' '));
  }
  const I = {
    hi: /^(oi|ola|hey|boas|bom dia|boa tarde|boa noite|e ai|entao)\b/.test(q) && q.split(' ').length <= 4,
    scorer: /marcador|quem marca|ja marcou|marcou|a marcar|vai marcar|goleador|golo d[oe] |\bmarca\b|\bmarcar\b|faz golo/.test(q),
    attack: /ataque|ofensiv|marca muito|faz golos|e forte|perigos/.test(q),
    defense: /defesa|sofre|defensiv/.test(q),
    next: /proximo jogo|proximos jogos|a seguir|depois joga|joga quando|calendario/.test(q),
    rot: /poup|rotac|descans|gestao|rodar|titulares/.test(q),
    over: /(mais de|over|\+)\s*\d|(menos de|under)\s*\d|golos\?|quantos golos/.test(q),
    btts: /ambas|btts|ambos marcam/.test(q),
    win: /casa vence|ganha|vitoria|vence|1x2|\b1x\b|\bx2\b|empate/.test(q),
    score: /placar|resultado|como acaba|score/.test(q),
    conf: /seguro|confian|risco|vale a pena/.test(q),
    duel: /duelo|medo|desafi|single|outra aposta|registas|apost|entras|metes|vamos a isso|aceitas|jogas nisso|te atreves|cobarde/.test(q),
    full: /analise completa|tudo sobre|detalhe/.test(q),
    lineup: /ficha|onze|titular|escala|lesionad|lesoes|quem joga|convocad|plantel|alinhamento/.test(q)
  };
  const m = resolveFocus(q, teams);
  const playerEarly = m ? playerMentioned(q, m) : null;
  if (playerEarly) I.scorer = true;
  const anyIntent = Object.keys(I).some(k => k !== 'hi' && I[k]);

  if (I.hi && !anyIntent) {
    const f = m;
    return { mood: 'feliz', html: `Boas, chefe! 👋 ${f ? `Hoje estou de olho em <b>${f.home} vs ${f.away}</b> (${whenTxt(f)}). Pergunta-me o que quiseres: golos, marcadores, se vão poupar, ou desafia-me para um duelo.` : 'Diz-me o jogo e eu trato do resto.'}` };
  }
  if (!m) {
    if (teams.length) return { mood: 'pensativo', html: `Conheço o ${esc(teams[0])}, mas não tenho nenhum jogo dele no radar (ou está marcado como «por confirmar»). Liga os dados ao vivo em Definições e eu passo a ver os jogos reais.` };
    return null;
  }
  if (I.full) return null; // ficha completa → motor antigo
  // nome desconhecido? vai à ficha do jogo e tenta outra vez
  const wantsBoard = !opts.noAsync && !boardFor(m) && (typeof navigator === 'undefined' || navigator.onLine !== false) &&
    (I.scorer || I.lineup || (!anyIntent && !teams.length && q.split(' ').some(t => t.length >= 4 && /[a-z]{3}/.test(t) && !ZE_STOP.has(t) && !/^(qual|quem|como|onde|porque|achas|sera|esta|isso|hoje|amanha|jogo|golo|golos|marca)$/.test(t))));
  if (wantsBoard && playerEarly) { playerBoard(m).catch(() => {}); }
  else if (wantsBoard && (m.espn || !m.live)) {
    return {
      mood: 'pensativo', html: pickOne(['Deixa-me ver a ficha do jogo… 🧐', 'Vou espreitar o plantel e os golos da época…', 'Um segundo, a cruzar com a ficha…']),
      later: async () => {
        await playerBoard(m).catch(() => null);
        const again = zeTalk(raw, { noAsync: true });
        if (again && again.html) return again;
        const word = q.split(' ').filter(t => t.length >= 4 && !ZE_STOP.has(t)).pop() || raw;
        return { mood: 'pensativo', html: boardFor(m) ? `Não encontro «${esc(word)}» no plantel do ${esc(m.home)} nem do ${esc(m.away)}. Escreve o apelido como aparece na ficha (ex.: «Pavlidis»).` : 'Não consegui ir à ficha do jogo (sem internet ou jogo fora da minha cobertura). Uso só o dossiê.' };
      }
    };
  }
  if (!anyIntent && !teams.length && boardFor(m)) {
    const word = q.split(' ').filter(t => t.length >= 4 && !ZE_STOP.has(t) && !/^(qual|quem|como|onde|porque|achas|sera|esta|isso|hoje|amanha|jogo|golo|golos|marca)$/.test(t)).pop();
    if (word) return { mood: 'pensativo', html: `Não encontro «${esc(word)}» no plantel do <b>${esc(m.home)}</b> nem do <b>${esc(m.away)}</b>. ${pickOne(['Se é de outro jogo, diz-me qual.', 'Escreve o apelido como aparece na ficha.', 'Talvez esteja noutra equipa — diz-me o jogo.'])}` };
  }
  if (!anyIntent && !teams.length) return null;

  zeLastMatch = m;
  const r = modelo(m);
  const parts = [];
  const odds = oddsInMsg(raw);
  const flag = m.aviso ? ` <span style="color:var(--yellow)">⚠️ ${esc(m.aviso)}</span>` : '';
  const zeOnMatch = loadBank().zeBets.filter(x => x.status === 'open' && x.match === m.home + ' vs ' + m.away);
  const head = (teams.length || !zeLastHead || zeLastHead !== m.home + m.away ? pickOne(['Sobre ', 'Olha, sobre ', 'Vou ser direto sobre ', 'Pela minha conta, sobre ']) : 'Ainda sobre ') + `<b>${vsHTML(m.home, m.away, 18)}</b> (${whenTxt(m)}${m.kickoff ? ', ' + m.kickoff : ''})${flag}:`;
  const player = playerEarly;
  zeLastHead = m.home + m.away;

  if (I.scorer || player) {
    const side = teams.filter(t => teamInMatch(m, t));
    const onlyOne = side.length === 1 ? side[0] : null;
    const ps = player ? [player]
      : onlyOne ? playersOf(teamScore(m.home, normTxt(onlyOne)) > 0 ? m.home : m.away).slice(0, 3)
      : playersOf(m.home).slice(0, 2).concat(playersOf(m.away).slice(0, 1));
    if (ps.length) {
      const b0 = boardFor(m);
      const list = player ? [player] : (b0 ? (onlyOne ? (teamScore(m.home, normTxt(onlyOne)) > 0 ? b0.home : b0.away).map(p => ({ ...p, team: teamScore(m.home, normTxt(onlyOne)) > 0 ? m.home : m.away })).slice(0, 4)
        : b0.home.slice(0, 3).map(p => ({ ...p, team: m.home })).concat(b0.away.slice(0, 2).map(p => ({ ...p, team: m.away })))) : ps);
      parts.push(`👟 ${list.map(p => playerLine(m, p)).join('<br>')}`);
      if (player && player.status === 'fora') parts.push('❌ Não está na ficha de jogo — aposta nele morre à partida.');
      else if (player && player.status === 'suplente') parts.push('🪑 Começa no banco: a probabilidade cai muito (conta com ~25 minutos).');
      else if (player && !boardFor(m)) parts.push('<span class="muted">(Sem a ficha do jogo — estimativa pelo dossiê. Com internet eu cruzo com golos da época e o onze.)</span>');
      else if (player && b0 && !b0.lineupKnown) parts.push('<span class="muted">Onze ainda não saiu: assumi que joga a maior parte do jogo. Pergunta outra vez ~1h antes.</span>');
      if (/ja marcou|marcou contra/.test(q)) parts.push(`📒 Histórico jogador-vs-equipa não tenho guardado — não vou inventar. Do confronto sei: ${esc(m.h2h)}${getTeamKB(m.home) && getTeamKB(m.home).h2h_tips && getTeamKB(m.home).h2h_tips !== '—' ? ' · ' + esc(getTeamKB(m.home).h2h_tips.replace(/\.$/, '')) : ''}.`);
    } else parts.push('👟 Não tenho marcadores fiáveis destas equipas no dossiê.');
  }
  if (I.lineup) parts.push(lineupHTML(m, boardFor(m)));
  if (I.attack || I.defense) {
    const t = teamAfter(q, 'ataque|defesa|sofre', m) || teams.find(x => teamInMatch(m, x)) || m.away;
    const isHome = teamScore(m.home, normTxt(t)) > 0;
    const lam = isHome ? r.lh : r.la, other = isHome ? r.la : r.lh;
    const [ah, aa] = leagueAvg(m.league);
    const avg = isHome ? ah : aa;
    const kb = getTeamKB(t);
    const nome = isHome ? m.home : m.away;
    if (I.attack) parts.push(`⚔️ Ataque do <b>${esc(nome)}</b>: espero <b>${lam.toFixed(2)}</b> golos neste jogo (média da liga ${isHome ? 'em casa' : 'fora'} ≈ ${avg.toFixed(2)}) → ${lam > avg * 1.15 ? '<b>forte</b>' : lam < avg * 0.75 ? '<b>fraco</b> aqui' : 'normal'}.${kb ? ` Estilo: ${esc(kb.estilo || '—')}${kb.marcadores && kb.marcadores[0] && !/—/.test(kb.marcadores[0]) ? ` · ${esc(kb.marcadores.slice(0, 2).join(', '))}` : ''}.` : ''} Hipótese de marcar pelo menos 1: ${pct(1 - Math.exp(-lam))}.`);
    if (I.defense) parts.push(`🧱 Defesa do <b>${esc(nome)}</b>: o adversário deve fazer ~${other.toFixed(2)} golos · baliza a zero ${pct(Math.exp(-other))}.`);
  }
  if (I.next || I.rot) {
    const t = teamAfter(q, 'proximo jogo|proximos jogos|depois joga|poupar|poupa|rodar|descansa', m) || teams.find(x => teamInMatch(m, x)) || (getTeamKB(m.home) ? m.home : m.away);
    const nexts = upcomingWith(t, true).filter(x => !sameMatch(x.m, m)).slice(0, 2);
    if (I.next) parts.push(nexts.length
      ? `📅 A seguir, ${esc(t)}: ${nexts.map(x => `<b>${esc(x.m.home)} vs ${esc(x.m.away)}</b> (${esc(x.m.date)}${x.m.aviso ? ' · ⚠️ ' + esc(x.m.aviso) : ''})`).join(' · ')}.`
      : `📅 Não tenho mais jogos do ${esc(t)} no radar.`);
    if (I.rot) {
      const kb = getTeamKB(t);
      const soon = nexts.find(x => x.days - (daysFromToday(parseDayLabel(m.date)) || 0) <= 4);
      const risk = (kb && /rota|europa|poupar/i.test(kb.notas || '')) || (soon && /champ|europa|conference|ucl/i.test(soon.m.league));
      if (risk) {
        const isHome = t === m.home || teamScore(m.home, normTxt(t)) > 0;
        const M2 = scoreMatrix(isHome ? r.lh * 0.92 : r.lh, isHome ? r.la : r.la * 0.92, 10);
        const mk2 = marketsFrom(M2);
        parts.push(`🔄 Rotação: <b>risco leve</b>${soon ? ` (tem ${esc(soon.m.home)} vs ${esc(soon.m.away)} a ${esc(soon.m.date)})` : ''}${kb && kb.notas ? ` · ${esc(kb.notas.replace(/\.$/, ''))}` : ''}. Se poupar, tiro ~8% aos golos dele: Over 2.5 passa de ${pct(r.mk['O2.5'])} para ${pct(mk2['O2.5'])} e a vitória de ${pct(isHome ? r.mk['1'] : r.mk['2'])} para ${pct(isHome ? mk2['1'] : mk2['2'])}. Mercados de golos perdem mais do que o 1X2.`);
      } else parts.push(`🔄 Rotação: não vejo sinais (sem jogo grande nos 4 dias seguintes no meu radar). Confirma o onze ~1h antes.`);
    }
  }
  if (I.over) {
    const mm = q.match(/(mais de|over|\+|menos de|under)\s*(\d+)(?:[.,](\d))?/);
    let line = 2.5, under = false;
    if (mm) { under = /menos|under/.test(mm[1]); line = mm[3] ? +(mm[2] + '.' + mm[3]) : +mm[2] + 0.5; }
    if (line > 4.5) line = 4.5;
    const key = 'O' + line;
    const p = r.mk[key] != null ? (under ? 1 - r.mk[key] : r.mk[key]) : null;
    parts.push(`🎯 ${under ? 'Menos' : 'Mais'} de ${line} golos: <b>${pct(p)}</b> (odd justa ${fairOdd(p)}). Golos esperados no total: ${(r.lh + r.la).toFixed(2)}.${!under && line >= 3.5 ? ' Linha alta — precisas de jogo partido.' : ''}`);
  }
  if (I.btts) parts.push(`🔄 Ambas marcam: <b>${pct(r.mk.BTTS)}</b> (justa ${fairOdd(r.mk.BTTS)}). ${r.mk.BTTS < 0.45 ? 'O mais provável é uma baliza ficar a zero.' : 'Bom candidato.'}`);
  if (I.win) parts.push(`🏠 1X2: ${esc(m.home)} <b>${pct(r.mk['1'])}</b> · empate ${pct(r.mk['X'])} · ${esc(m.away)} ${pct(r.mk['2'])} — odds justas ${fairOdd(r.mk['1'])} / ${fairOdd(r.mk['X'])} / ${fairOdd(r.mk['2'])}. 1X: ${pct(r.mk['1X'])}.`);
  if (I.score) parts.push(`📊 Placares: ${r.mk.cs.slice(0, 4).map(c => `<b>${c.s}</b> ${pct(c.p)}`).join(' · ')}. Nenhum placar passa de ~20% — é sempre lotaria.`);
  if (I.conf) parts.push(`🎚️ «Seguro» não existe. A leitura do dossiê é <i>${esc(deriveBet(m))}</i>; o meu modelo dá ${pct(r.mk['1'])} à vitória da casa. Só vale a pena se a odd for maior que ${fairOdd(r.mk['1'])} + margem.`);

  if (I.duel) {
    let label = null, pModel = null, market = null;
    if (player) { label = `${player.name} marca`; pModel = scorerProb(m, player); market = 'scorer'; }
    else {
      const c = selConds(raw, m);
      if (c && (I.over || I.btts || I.win || teams.length)) {
        pModel = mprob(r.M, (i, j) => c.every(f => f(i, j)));
        const mm = q.match(/(mais de|over|menos de|under)\s*(\d+)[.,]5/);
        label = mm ? `${/menos|under/.test(mm[1]) ? 'Menos' : 'Mais'} de ${mm[2]}.5 golos` : I.btts ? 'Ambas marcam' : /1x/.test(q) ? `${m.home} ou empate` : /x2/.test(q) ? `${m.away} ou empate` : /empate/.test(q) ? 'Empate' : teamScore(m.away, q) > 0 && teamScore(m.home, q) === 0 ? `${m.away} vence` : `${m.home} vence`;
        market = 'chat';
      }
    }
    if (m.aviso) parts.push(`⚔️ Não aposto em jogos «por confirmar». Escolhe um jogo real.`);
    else if (label && odds.length) parts.push(zePropose(m, label, pModel, odds[odds.length - 1], { market }));
    else if (label && zeHasSame(m.home + ' vs ' + m.away, label)) parts.push(`🙅 Já tenho <b>${esc(label)}</b> neste jogo. Não repito a mesma aposta — provoca-me noutro mercado.`);
    else if (label) {
      zePending = { m, label, pModel, market };
      parts.push(`⚔️ ${pickOne(['Medo? Eu não tenho sistema nervoso. 😏', 'Gosto do desafio.', 'Não fujo, mas também não pago caro.'])} Para mim <b>${esc(label)}</b> vale ${pct(pModel)} → odd justa <b>${fairOdd(pModel)}</b>. A quanto está? Escreve só a odd (ex.: <b>2.10</b>) e eu decido.`);
    }
    else {
      const top = ['1', '1X', 'O1.5', 'O2.5', 'BTTS', 'U2.5'].map(k => ({ k, p: r.mk[k] })).sort((a, b) => b.p - a.p).slice(0, 4);
      if (zeOnMatch.length) parts.push(`📌 Neste jogo já tenho: ${zeOnMatch.map(x => `<b>${esc(x.pick)}</b> @ ${Number(x.odd).toFixed(2)}`).join(', ')}.`);
      parts.push(`⚔️ Medo? Não tenho sistema nervoso. 😏 Dá-me uma odd e eu decido. Neste jogo só entro acima destas odds justas: ${top.map(x => `${esc(marketName(x.k, m))} <b>${fairOdd(x.p)}</b>`).join(' · ')}.<br><button class="btn btn-sm btn-lime" style="margin-top:6px;" onclick="prepararDuelo(${matchIndex(m)})">⚔️ Abrir duelo completo</button>`);
    }
  }

  if (!parts.length) {
    // só o nome do jogo/equipa: resumo curto em vez de despejar a ficha toda
    parts.push(`💡 Dossiê: <i>${esc(deriveBet(m))}</i> (${esc(m.prob)}).`);
    parts.push(`🧠 Modelo: 1 ${pct(r.mk['1'])} · X ${pct(r.mk['X'])} · 2 ${pct(r.mk['2'])} · Over 2.5 ${pct(r.mk['O2.5'])} · Ambas ${pct(r.mk.BTTS)} · placar ${r.mk.cs[0].s}.`);
    parts.push(`<span class="muted">Pergunta-me por golos, marcadores, rotação, próximo jogo — ou «análise completa».</span>`);
  }
  const mood = I.duel ? (parts.some(p => /Aceito o desafio/.test(p)) ? 'gozao' : 'pensativo') : 'pensativo';
  return { mood, html: head + '<br>' + parts.map(p => `<div style="margin-top:6px;">${p}</div>`).join('') };
}

/* enviarChat v2: boletim → conversa → motor antigo */
function enviarChat() {
  const input = document.getElementById('chatInput');
  const msg = (input.value || '').trim();
  if (!msg) return;
  addChat('user', msg);
  input.value = '';
  const odds = msg.match(/\b\d{1,2}[.,]\d{2}\b/g) || [];
  if (odds.length >= 2 || (odds.length >= 1 && /vou assim|boletim|m[uú]ltipla|vou por|que achas/i.test(msg))) {
    const slip = /resultado final|total de golos|m[uú]ltipla|combinadas|1x2| vs /i.test(msg) && /\n/.test(msg) ? parseAny(msg) : parseSlipText(msg);
    if (slip.legs.length >= 2 || /vou assim|boletim|m[uú]ltipla|vou por|que achas/i.test(msg)) {
      slip.source = detectSource(msg) === 'Boletim' ? 'Conversa' : detectSource(msg);
      slipState = slip;
      addChat('bot', '<span id="zeOcrStatus">Deixa-me cruzar isto com os dados de hoje… 🧐</span>', 'pensativo');
      crossCheckSlip(slip, t => setText('zeOcrStatus', t)).catch(() => {}).then(() => {
        setText('zeOcrStatus', 'Feito. A minha opinião:');
        const c = zeCritiqueSlip(slip, loadBank().you);
        addChat('bot', c.html, c.mood);
        updateZeContext();
      });
      return;
    }
  }
  let res = null;
  try { res = zeTalk(msg); } catch (e) { console.error(e); }
  if (res && res.later) {
    addChat('bot', res.html, res.mood);
    res.later().then(r2 => { if (r2 && r2.html) addChat('bot', r2.html, r2.mood); updateZeContext(); })
      .catch(() => addChat('bot', 'Não consegui ir buscar a ficha agora. Tenta outra vez daqui a nada.', 'chateado'));
    updateZeContext();
    return;
  }
  if (res) { if (res.html) addChat('bot', res.html, res.mood); }
  else { const ans = assistenteResposta(msg); addChat('bot', ans, /^Olá/.test(ans) ? 'feliz' : 'pensativo'); }
  updateZeContext();
}

