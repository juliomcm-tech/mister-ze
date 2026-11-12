/* =====================================================================
   v50 · clareza no telemóvel
   1) Chips do chat em 3 grupos (Jogo · Apostas · Zé)
   2) Botões e chips com altura de dedo (44 px) em ecrãs táteis
   3) «Testar ligação» testa só o que a app usa hoje: ESPN direta, odds e notícias
   ===================================================================== */
(function () {
  const css = `
.chip-tabs{display:flex;gap:6px;margin-bottom:8px;}
.chip-tab{flex:1;background:transparent;border:1px solid var(--line2);color:var(--muted);border-radius:10px;padding:8px 6px;font-weight:700;font-size:.8rem;cursor:pointer;}
.chip-tab.active{background:var(--tile);color:var(--text);border-color:var(--lime,#c6f432);}
#chipRow .ze-chip[hidden]{display:none;}
@media (pointer:coarse){
  .ze-chip,.chip-tab,.btn-sm,.ifilter{min-height:44px;}
  .btn{min-height:44px;}
  #chipRow .ze-chip{padding:8px 13px;font-size:.8rem;}
  .needs .ze-chip{min-height:36px;}
}`;
  try { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); } catch (e) {}
})();
function chipGroup(g) {
  try { localStorage.setItem('ze_chip_group', g); } catch (e) {}
  document.querySelectorAll('.chip-tab').forEach(b => b.classList.toggle('active', b.dataset.g === g));
  document.querySelectorAll('#chipRow .ze-chip').forEach(c => { c.hidden = c.dataset.g !== g; });
}
(function () { let g = 'jogo'; try { g = localStorage.getItem('ze_chip_group') || 'jogo'; } catch (e) {} if (!/^(jogo|apostas|ze)$/.test(g)) g = 'jogo'; try { chipGroup(g); } catch (e) {} })();

/* ---------- 🩺 Testar ligação: o que a app usa hoje ---------- */
netTest = async function (btn) {
  const box = document.getElementById('netTestBox'); if (!box) return;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ A testar…'; }
  const line = (ok, txt) => `<div>${ok ? '✅' : '❌'} ${txt}</div>`;
  const out = [];
  const time = async (f) => { const t0 = Date.now(); try { const v = await f(); return { ok: true, v, ms: Date.now() - t0 }; } catch (e) { return { ok: false, err: e && (e.status || e.message) || 'falhou', ms: Date.now() - t0 }; } };
  box.innerHTML = '<div class="muted">⏳ A testar jogos, odds e notícias…</div>';
  const now = new Date(), ym = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0');
  const g = await time(async () => { const j = await getJSONany(`https://site.api.espn.com/apis/site/v2/sports/soccer/por.1/scoreboard?dates=${ym}&limit=1000`); return (j.events || []); });
  out.push(line(g.ok && g.v.length, g.ok ? `<b>Jogos e resultados</b> (ESPN): ${g.v.length} jogos da Liga Portugal este mês · ${g.ms} ms` : `<b>Jogos e resultados</b> (ESPN): ${esc(String(g.err))}`));
  const ev = g.ok ? (g.v.find(e => e.status && e.status.type && e.status.type.state === 'pre') || g.v[0]) : null;
  if (ev) {
    const o = await time(() => coreOdds('por.1', ev.id, true));
    out.push(line(o.ok, o.ok ? `<b>Odds</b> (ESPN/Bet365): ${o.v.length ? o.v.map(b => esc(b.provider)).join(', ') : 'este jogo ainda sem odds publicadas'} · ${o.ms} ms` : `<b>Odds</b>: ${esc(String(o.err))}`));
  }
  const n = await time(async () => { const t = await fetchText(gnToBing('https://news.google.com/rss/search?q=Benfica&hl=pt-PT&gl=PT&ceid=PT:pt-150')); const k = (String(t).match(/<item[\s>]/g) || []).length; if (!k) throw new Error('sem notícias'); return k; });
  out.push(line(n.ok, n.ok ? `<b>Notícias</b> (Bing): ${n.v} títulos · ${n.ms} ms` : `<b>Notícias</b>: ${esc(String(n.err))} <span class="muted">(o resto funciona na mesma)</span>`));
  const allOk = g.ok && g.v.length;
  box.innerHTML = `<div style="font-size:.84rem;line-height:1.6;">${out.join('')}</div><div style="margin-top:6px;font-size:.86rem;">${allOk ? '👍 A ligação está boa. Se algo não aparecer, carrega em 📡 Atualizar.' : '⚠️ Sem jogos da ESPN neste momento. Confirma a internet e tenta outra vez; se continuar, manda-me print disto.'}</div>`;
  if (btn) { btn.disabled = false; btn.textContent = '🩺 Testar ligação'; }
};
