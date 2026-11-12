/* =====================================================================
   v56b · auditoria: rapidez do Calendário
   - O Calendário era desenhado 2 vezes ao abrir (o Estádio e o clássico pediam os dois) → agora 1.
   - As contas do Zé para os jogos da semana são feitas aos bocadinhos quando o telemóvel está parado
     (depois de abrir a app e de cada Atualizar). Ao abrir Jogos ordenados por %, já está tudo pronto.
   ===================================================================== */
let ZW_RUN = 0;
function zeWarm() {
  if (/jsdom/i.test(navigator.userAgent || '') || window.__ZE_LAB) return;
  const run = ++ZW_RUN, now = Date.now(), wk = now + 7 * 864e5;
  const list = matches.filter(m => !m.past && !m.aviso).map(m => ({ m, k: kickOf(m) })).filter(x => x.k && x.k.getTime() > now - 2 * 3600e3).sort((a, b) => (a.k.getTime() < wk ? 0 : 1) - (b.k.getTime() < wk ? 0 : 1) || a.k - b.k).slice(0, 400).map(x => x.m);   // os mesmos jogos que o Calendário mostra (primeiro a semana)
  let i = 0;
  const idle = window.requestIdleCallback || (f => setTimeout(() => f({ timeRemaining: () => 8 }), 60));
  const step = dl => {
    if (run !== ZW_RUN) return;                       // houve dados novos: recomeça
    const t0 = performance.now();
    while (i < list.length && (dl.timeRemaining() > 4 || performance.now() - t0 < 6)) { try { zeLogical(list[i]); } catch (e) {} i++; if (performance.now() - t0 > 12) break; }
    if (i < list.length) idle(step, { timeout: 1500 });
  };
  idle(step, { timeout: 1500 });
}
applyLive = (function (prev) { return function () { const r = prev.apply(this, arguments); setTimeout(zeWarm, 1500); return r; }; })(applyLive);
setTimeout(zeWarm, 2500);

/* O «modelo» lia e recalculava a memória de aprendizagem (e o diário) em cada chamada, mesmo com a
   resposta já guardada: ~1,2 ms × centenas de chamadas por ecrã. Agora reaproveita durante 5 s ou até mudar. */
const LS_VER = {};
lsSet = (function (prev) { return function (k) { LS_VER[k] = (LS_VER[k] || 0) + 1; return prev.apply(this, arguments); }; })(lsSet);
let LW_IN = 0, LW_MEMO = null, DP_MEMO = null;
learnLoad = (function (prev) {
  return function () {
    if (!LW_IN) return prev.apply(this, arguments);
    const v = LS_VER[LEARN_KEY] || 0;
    if (LW_MEMO && LW_MEMO.v === v && Date.now() - LW_MEMO.t < 5000) return LW_MEMO.r;
    const r = prev.apply(this, arguments); LW_MEMO = { v, t: Date.now(), r }; return r;
  };
})(learnLoad);
if (typeof diaryPro === 'function') diaryPro = (function (prev) {
  return function () {
    if (!LW_IN) return prev.apply(this, arguments);
    const v = (LS_VER[DIARY_KEY] || 0) + '|' + (LS_VER[LEARN_KEY] || 0);
    if (DP_MEMO && DP_MEMO.v === v && Date.now() - DP_MEMO.t < 5000) return DP_MEMO.r;
    const r = prev.apply(this, arguments); DP_MEMO = { v, t: Date.now(), r }; return r;
  };
})(diaryPro);
learnWeights = (function (prev) { return function () { LW_IN++; try { return prev.apply(this, arguments); } finally { LW_IN--; } }; })(learnWeights);
/* depois de estudar jogos (odds novas), volta a preparar as contas aos bocadinhos */
zeStudy = (function (prev) { return async function () { const r = await prev.apply(this, arguments); clearTimeout(window.__zwT); window.__zwT = setTimeout(zeWarm, 2500); return r; }; })(zeStudy);
