/* =====================================================================
   v60b · aposta lógica estável (a mesma no Início, nos Jogos e nas Estatísticas)
   Porquê mudava: a aposta lógica é o mercado mais provável entre 55% e 85%. «1X» e «Mais de 1.5» andam
   muitas vezes colados (ex. 83% vs 84%); quando o Zé estuda o jogo (odds novas) ou aprende com um
   resultado, a ordem trocava e o Início (desenhado antes) mostrava um, os Jogos (depois) outro.
   Agora: a escolha que o Zé já registou para o jogo mantém-se, a não ser que outro mercado passe à frente
   por mais de 3 pontos. As estatísticas contam essa mesma escolha (a última antes do apito).
   ===================================================================== */
let DIARY_MEMO = null;
function diaryItemsFast() {
  const v = (typeof LS_VER !== 'undefined' && LS_VER[DIARY_KEY]) || 0;
  if (DIARY_MEMO && DIARY_MEMO.v === v && Date.now() - DIARY_MEMO.t < 10e3) return DIARY_MEMO.items;
  let items = {}; try { items = diaryLoad().items || {}; } catch (e) {}
  DIARY_MEMO = { v, t: Date.now(), items };
  return items;
}
matchBestMarket = (function (prev) {
  return function (m) {
    const best = prev.apply(this, arguments);
    try {
      if (!best || !m || m.past) return best;
      const old = diaryItemsFast()[diaryKey(m)];
      const k0 = old && !old.res && old.pick && old.pick.k;
      if (!k0 || k0 === best.k) return best;
      const r = modelo(m), p0 = r.mk[k0];
      if (p0 >= 0.55 && p0 <= 0.85 && p0 >= best.p - 0.03) return { k: k0, p: p0 };
    } catch (e) {}
    return best;
  };
})(matchBestMarket);
