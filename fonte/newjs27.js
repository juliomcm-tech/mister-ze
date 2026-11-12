
/* =====================================================================
   v40 · contas separadas no mesmo aparelho
   - cada conta: o seu nome, foto, carteira, apostas, duelo com o Zé, notas, histórico de dicas, backup
   - partilhado: jogos/resultados descarregados, calendário confirmado e o «cérebro» do Zé
   - PIN opcional (só impede espreitar — não é segurança bancária)
   ===================================================================== */
const ACC_KEY = 'ze_accounts_v1';
const accRawGet = k => { try { return window.__rawGet ? window.__rawGet(k) : localStorage.getItem(k); } catch (e) { return null; } };
const accRawSet = (k, v) => { try { window.__rawSet ? window.__rawSet(k, v) : localStorage.setItem(k, v); } catch (e) {} };
const accRawDel = k => { try { window.__rawDel ? window.__rawDel(k) : localStorage.removeItem(k); } catch (e) {} };
const accPre = id => id === 'main' ? '' : 'acc:' + id + ':';
function accList() {
  let L = []; try { L = JSON.parse(accRawGet(ACC_KEY) || '[]'); } catch (e) {}
  if (!Array.isArray(L)) L = [];
  if (!L.some(a => a.id === 'main')) L.unshift({ id: 'main', created: new Date().toISOString() });
  return L;
}
function accSave(L) { accRawSet(ACC_KEY, JSON.stringify(L)); }
function accCur() { return window.ZE_ACCOUNT || 'main'; }
function accRead(id, key) { try { return JSON.parse(accRawGet(accPre(id) + key) || 'null'); } catch (e) { return null; } }
function accName(a) { const u = accRead(a.id, 'ze_user_v1'); return (u && u.name && u.name.trim()) || a.name || (a.id === 'main' ? 'Conta principal' : 'Sem nome'); }
function accBank(a) { const b = accRead(a.id, 'dossie_bank_v1'); return b && typeof b.you === 'number' ? b : null; }
/* PIN: só um travão para quem pega no telemóvel (guardado como resumo, não em claro) */
function pinHash(id, pin) { let h = 5381; const s = 'mz|' + id + '|' + pin; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); }
function accSwitch(id) {
  const a = accList().find(x => x.id === id); if (!a) return;
  if (id === accCur()) { toast('Já estás nessa conta.'); return; }
  if (a.pin) {
    const p = prompt(`PIN da conta «${accName(a)}»:`);
    if (p == null) return;
    if (pinHash(a.id, p.trim()) !== a.pin) { alert('PIN errado.'); return; }
    try { sessionStorage.setItem('ze_unlocked_' + id, '1'); } catch (e) {}
  }
  accRawSet('ze_account_cur', id);
  location.reload();
}
function accCreate() {
  const name = (prompt('Nome da nova conta (ex.: Rui):') || '').trim();
  if (!name) return;
  const L = accList();
  if (L.length >= 12) { alert('Máximo de 12 contas neste aparelho.'); return; }
  if (L.some(a => normTxt(accName(a)) === normTxt(name))) { alert('Já existe uma conta com esse nome.'); return; }
  const bankTxt = prompt(`Banca inicial de ${name} e do Zé (€):`, '20');
  const bank = parseFloat(String(bankTxt || '20').replace(',', '.'));
  if (!(bank > 0)) { alert('Banca inválida.'); return; }
  const id = (normTxt(name).replace(/[^a-z0-9]/g, '').slice(0, 10) || 'conta') + Date.now().toString(36).slice(-4);
  L.push({ id, name, created: new Date().toISOString() });
  accSave(L);
  const pre = accPre(id);
  accRawSet(pre + 'ze_user_v1', JSON.stringify({ name, photo: '' }));
  accRawSet(pre + 'dossie_bank_v1', JSON.stringify({ you: bank, ze: bank, start: bank, startYou: bank, startZe: bank, bets: [], zeBets: [], seasons: [], season: 1, seasonStart: new Date().toISOString(), zePasses: 0, zePeak: bank }));
  if (confirm(`Conta «${name}» criada com ${bank.toFixed(2)} €. Entrar já?`)) { accRawSet('ze_account_cur', id); location.reload(); }
  else renderAccounts();
}
function accDelete(id) {
  if (id === 'main') { alert('A conta principal não se apaga (é onde estão os dados antigos).'); return; }
  if (id === accCur()) { alert('Sai desta conta antes de a apagar.'); return; }
  const L = accList(), a = L.find(x => x.id === id); if (!a) return;
  if (a.pin) { const p = prompt(`PIN da conta «${accName(a)}» para a apagar:`); if (p == null || pinHash(a.id, p.trim()) !== a.pin) { alert('PIN errado.'); return; } }
  if (!confirm(`Apagar a conta «${accName(a)}» e TODAS as apostas dela? Não dá para desfazer (faz backup antes).`)) return;
  const pre = accPre(id), del = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(pre)) del.push(k); }
  del.forEach(accRawDel);
  accSave(L.filter(x => x.id !== id));
  toast(`🗑️ Conta «${accName(a)}» apagada.`); renderAccounts();
}
function accSetPin() {
  const L = accList(), a = L.find(x => x.id === accCur()); if (!a) return;
  const p = prompt(a.pin ? 'Novo PIN (4 a 8 algarismos). Deixa vazio para tirar o PIN:' : 'PIN para esta conta (4 a 8 algarismos):');
  if (p == null) return;
  const v = p.trim();
  if (!v) { delete a.pin; accSave(L); toast('🔓 PIN retirado.'); renderAccounts(); return; }
  if (!/^\d{4,8}$/.test(v)) { alert('O PIN tem de ter 4 a 8 algarismos.'); return; }
  a.pin = pinHash(a.id, v); accSave(L);
  try { sessionStorage.setItem('ze_unlocked_' + a.id, '1'); } catch (e) {}
  toast('🔒 PIN guardado. Ao abrir a app nesta conta, pede o PIN.'); renderAccounts();
}
function renderAccounts() {
  const host = document.getElementById('cfgProfileZe'); if (!host) return;
  let box = document.getElementById('cfgAccounts');
  if (!box) { const panel = host.closest('.panel'); panel.insertAdjacentHTML('beforebegin', '<div class="panel"><div class="panel-h"><span>👥 Contas neste aparelho</span><span class="muted">cada uma com a sua carteira e o seu duelo</span></div><div class="panel-b" id="cfgAccounts"></div></div>'); box = document.getElementById('cfgAccounts'); }
  const L = accList(), cur = accCur();
  box.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;">${L.map(a => {
    const b = accBank(a), me = a.id === cur;
    return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 8px;border:1px solid ${me ? 'var(--lime)' : 'var(--line2)'};border-radius:8px;">
      <b style="min-width:110px;">${me ? '▶ ' : ''}${esc(accName(a))}</b>${a.pin ? ' 🔒' : ''}
      <span class="muted" style="font-size:.8rem;flex:1;min-width:140px;">${b ? `${b.you.toFixed(2)} € · Zé ${b.ze.toFixed(2)} € · ${(b.bets || []).length} apostas` : 'sem apostas'}</span>
      ${me ? '<span class="spill win">em uso</span>' : `<button class="mini l" onclick="accSwitch('${a.id}')">Entrar</button>`}
      ${a.id !== 'main' && !me ? `<button class="mini x" onclick="accDelete('${a.id}')">Apagar</button>` : ''}</div>`;
  }).join('')}</div>
    <div class="acts" style="margin-top:8px;"><button class="btn btn-sm btn-lime" onclick="accCreate()">➕ Nova conta</button><button class="btn btn-sm" onclick="accSetPin()">${(L.find(a => a.id === cur) || {}).pin ? '🔒 Mudar/tirar PIN' : '🔒 Pôr PIN nesta conta'}</button></div>
    <div class="hint" style="margin-top:6px;">Cada conta tem o seu nome, foto, carteira, apostas, duelo com o Zé, notas e backup. Partilham só os jogos descarregados e o «cérebro» do Zé (o que ele aprende com os resultados serve para todos). O PIN só impede espreitar — não é segurança de banco.</div>`;
}
renderConfig = (function (prev) { return function () { const r = prev.apply(this, arguments); try { renderAccounts(); } catch (e) {} return r; }; })(renderConfig);

/* topo: o nome é um atalho para mudar de conta */
function accBadge() {
  const you = document.querySelector('.fm-ticker .you, .you'); if (!you || you.dataset.acc) return;
  you.dataset.acc = '1'; you.style.cursor = 'pointer'; you.title = 'Mudar de conta';
  you.addEventListener('click', () => { fmGo('config'); setTimeout(() => { const el = document.getElementById('cfgAccounts'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 120); });
}
accBadge();

/* bloqueio com PIN ao abrir */
(function accLock() {
  const a = accList().find(x => x.id === accCur());
  let ok = false; try { ok = sessionStorage.getItem('ze_unlocked_' + accCur()) === '1'; } catch (e) {}
  if (!a || !a.pin || ok) return;
  const ov = document.createElement('div');
  ov.id = 'accLock';
  ov.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(8,4,16,.96);display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML = `<div class="panel" style="max-width:320px;width:100%;padding:18px;text-align:center;"><div style="font-size:1.1rem;font-weight:800;margin-bottom:8px;">🔒 ${esc(accName(a))}</div>
    <input id="accPin" class="inp" type="password" inputmode="numeric" placeholder="PIN" style="text-align:center;font-size:1.2rem;margin-bottom:8px;">
    <div class="acts" style="justify-content:center;"><button class="btn btn-lime" id="accPinOk">Entrar</button><button class="btn" id="accPinOther">Outra conta</button></div>
    <div id="accPinMsg" class="muted" style="margin-top:6px;font-size:.8rem;"></div></div>`;
  document.body.appendChild(ov);
  const go = () => {
    const v = (document.getElementById('accPin').value || '').trim();
    if (pinHash(a.id, v) === a.pin) { try { sessionStorage.setItem('ze_unlocked_' + a.id, '1'); } catch (e) {} ov.remove(); }
    else { document.getElementById('accPinMsg').textContent = 'PIN errado.'; }
  };
  document.getElementById('accPinOk').onclick = go;
  document.getElementById('accPin').onkeydown = e => { if (e.key === 'Enter') go(); };
  document.getElementById('accPinOther').onclick = () => { accRawSet('ze_account_cur', 'main'); location.reload(); };
})();
