/* =====================================================================
   v26 · App no telemóvel (PWA): receber partilhas do Android
   (prints da Betano/Placard → Mister Zé), estado da instalação
   ===================================================================== */
function isInstalledApp() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
}
async function handleShareTarget() {
  let u;
  try { u = new URL(location.href); } catch (e) { return; }
  if (!u.searchParams.has('share')) return;
  try { history.replaceState(null, '', location.pathname + '#ze'); } catch (e) {}
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open('ze-share');
    const keys = await cache.keys();
    const files = [];
    let text = '';
    for (const req of keys) {
      const res = await cache.match(req);
      if (!res) continue;
      if (/\/shared\/text$/.test(req.url)) text = await res.text();
      else {
        const blob = await res.blob();
        const name = decodeURIComponent(req.url.split('/').pop() || 'print.png');
        files.push(new File([blob], name, { type: blob.type || 'image/png' }));
      }
      await cache.delete(req);
    }
    fmGo('ze');
    if (files.length) {
      zeSay(`📥 Recebi ${files.length > 1 ? `${files.length} prints` : 'o teu print'}. Deixa-me ler…`, 'pensativo', 5000);
      zeChatSlip(files);
    } else if (text) {
      const inp = document.getElementById('chatInput');
      if (inp) { inp.value = text; enviarChat(); }
    }
  } catch (e) { console.warn('share-target', e); }
}
function renderInstallPanel() {
  const el = document.getElementById('cfgInstall');
  if (!el) return;
  const https = /^https:$/.test(location.protocol);
  if (isInstalledApp()) {
    el.innerHTML = `✅ <b>Estás a usar a app instalada.</b> Para analisar um boletim: na Betano (ou galeria) carrega em <b>Partilhar</b> e escolhe <b>Mister Zé</b>.`;
  } else if (!https && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    el.innerHTML = `${location.protocol === 'file:' ? 'Estás a abrir o ficheiro diretamente' : 'Este link não é https'}. Para instalar como app no Samsung, o Mister Zé tem de estar num link <b>https</b> (GitHub Pages, por exemplo). Depois abres esse link no Chrome do telemóvel e carregas em <b>Instalar</b>.`;
  } else {
    el.innerHTML = `Abre este link no <b>Chrome</b> ou <b>Samsung Internet</b> do telemóvel e carrega no botão abaixo (ou menu ⋮ → <b>Instalar aplicação</b> / <b>Adicionar ao ecrã principal</b>).<div style="margin-top:8px;"><button class="btn btn-lime btn-sm" onclick="instalarApp()">📲 Instalar o Mister Zé</button></div>`;
  }
}
const _renderConfigV25 = renderConfig;
renderConfig = function () { _renderConfigV25(); try { renderInstallPanel(); } catch (e) {} };
window.addEventListener('appinstalled', () => { toast('📲 Mister Zé instalado! Procura o ícone no ecrã inicial.'); renderInstallPanel(); });
handleShareTarget();
