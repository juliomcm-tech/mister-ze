import re, sys
orig=open('orig.html',encoding='utf-8').read()
shell=open('shell.html',encoding='utf-8').read()
newjs=open('newjs.js',encoding='utf-8').read()+'\n\n'+open('newjs2.js',encoding='utf-8').read()+'\n\n'+open('newjs4.js',encoding='utf-8').read()+'\n\n'+open('newjs3.js',encoding='utf-8').read()+'\n\n'+open('newjs5.js',encoding='utf-8').read()+'\n\n'+open('newjs6.js',encoding='utf-8').read()+'\n\n'+open('newjs7.js',encoding='utf-8').read()+'\n\n'+open('newjs8.js',encoding='utf-8').read()+'\n\n'+open('newjs9.js',encoding='utf-8').read()+'\n\n'+open('newjs10.js',encoding='utf-8').read()+'\n\n'+open('newjs11.js',encoding='utf-8').read()+'\n\n'+open('newjs12.js',encoding='utf-8').read()+'\n\n'+open('newjs13.js',encoding='utf-8').read()+'\n\n'+open('newjs14.js',encoding='utf-8').read()+'\n\n'+open('newjs15.js',encoding='utf-8').read()+'\n\n'+open('newjs16.js',encoding='utf-8').read()+'\n\n'+open('newjs17.js',encoding='utf-8').read()+'\n\n'+open('newjs18.js',encoding='utf-8').read()+'\n\n'+open('newjs19.js',encoding='utf-8').read()+'\n\n'+open('newjs20.js',encoding='utf-8').read()+'\n\n'+open('newjs21.js',encoding='utf-8').read()+'\n\n'+open('newjs22.js',encoding='utf-8').read()+'\n\n'+open('newjs23.js',encoding='utf-8').read()+'\n\n'+open('newjs24.js',encoding='utf-8').read()+'\n\n'+open('newjs25.js',encoding='utf-8').read()+'\n\n'+open('newjs26.js',encoding='utf-8').read()+'\n\n'+open('newjs27.js',encoding='utf-8').read()+'\n\n'+open('newjs28.js',encoding='utf-8').read()+'\n\n'+open('newjs29.js',encoding='utf-8').read()+'\n\n'+open('newjs30.js',encoding='utf-8').read()+'\n\n'+open('newjs31.js',encoding='utf-8').read()+'\n\n'+open('newjs32.js',encoding='utf-8').read()+'\n\n'+open('newjs33.js',encoding='utf-8').read()+'\n\n'+open('newjs34.js',encoding='utf-8').read()+'\n\n'+open('newjs35.js',encoding='utf-8').read()+'\n\n'+open('newjs36.js',encoding='utf-8').read()+'\n\n'+open('newjs37.js',encoding='utf-8').read()+'\n\n'+open('newjs38.js',encoding='utf-8').read()+'\n\n'+open('newjs39.js',encoding='utf-8').read()+'\n\n'+open('newjs40.js',encoding='utf-8').read()+'\n\n'+open('newjs41.js',encoding='utf-8').read()+'\n\n'+open('newjs42.js',encoding='utf-8').read()+'\n\n'+open('newjs43.js',encoding='utf-8').read()+'\n\n'+open('newjs44.js',encoding='utf-8').read()+'\n\n'+open('newjs45.js',encoding='utf-8').read()+'\n\n'+open('newjs46.js',encoding='utf-8').read()+'\n\n'+open('newjs47.js',encoding='utf-8').read()+'\n\n'+open('newjs48.js',encoding='utf-8').read()+'\n\n'+open('newjs49.js',encoding='utf-8').read()+'\n\n'+open('newjs50.js',encoding='utf-8').read()+'\n\n'+open('newjs51.js',encoding='utf-8').read()+'\n\n'+open('newjs52.js',encoding='utf-8').read()+'\n\n'+open('newjs53.js',encoding='utf-8').read()+'\n\n'+open('newjs54.js',encoding='utf-8').read()+'\n\n'+open('newjs55.js',encoding='utf-8').read()+'\n\n'+open('newjs56.js',encoding='utf-8').read()+'\n\n'+open('newjs57.js',encoding='utf-8').read()+'\n\n'+open('newjs58.js',encoding='utf-8').read()+'\n\n'+open('newjs59.js',encoding='utf-8').read()+'\n\n'+open('newjs60.js',encoding='utf-8').read()+'\n\n'+open('newjs61.js',encoding='utf-8').read()+'\n\n'+open('newjs62.js',encoding='utf-8').read()+'\n\n'+open('newjs63.js',encoding='utf-8').read()+'\nrenderWallet(); renderUpdateInfo();\n'

def between(s,a,b):
    i=s.index(a); j=s.index(b,i); return s[i:j]

scout=between(orig,'  <!-- MELHORES -->','  <!-- CALENDÁRIO -->')
cal=between(orig,'  <div class="calendar-section">','\n</div>\n\n<div class="modal-overlay"')
cal=cal.replace('    <h2>📅 Calendário de Jogos</h2>\n','')
script=orig[orig.index('<script>\n')+len('<script>\n'):orig.rindex('\n</script>')]

def remove_func(src,name):
    m=re.search(r'\nfunction '+re.escape(name)+r'\s*\(',src)
    if not m: sys.exit('func not found '+name)
    i=m.start()+1; j=src.index('{',m.end()); depth=0; k=j
    while True:
        c=src[k]
        if c=='{': depth+=1
        elif c=='}':
            depth-=1
            if depth==0: break
        k+=1
    return src[:i]+'/* '+name+'() → reescrita mais abaixo (v14) */'+src[k+1:]

for f in ['fmGo','renderBanca','addChat','toggleAssistente','toggleBanca','copyAnalysis','copyDay','settleBet','prepararDuelo','confirmarDueloZe','loadBank','resetBanca','preverPlacar','enviarChat']:
    script=remove_func(script,f)

def rep(old,new,count=1):
    global script
    n=script.count(old)
    if n!=count: sys.exit(f'expected {count} got {n}: {old[:60]!r}')
    script=script.replace(old,new)

# 1) TDZ: chamada prematura de renderCalendar() + DOMContentLoaded
rep("document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });\nrenderCalendar();",
    "document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });\n// (renderCalendar inicial passou para initApp() no fim — antes rebentava: monthsMap ainda não existia)")
rep("""// default: hide scout/calendar until chosen
document.addEventListener('DOMContentLoaded', () => {
  fmGo('portal');
});""","// arranque: ver initApp() no fim do script")
# 2) constantes de banca em falta + stopwords do Zé
script="""/* ===== v14: constantes que faltavam (BANK_KEY/BANK_START nunca tinham sido definidas) ===== */
const BANK_KEY = 'dossie_bank_v1';
const BANK_START = 20;
const ZE_STOP = new Set(['casa','vence','over','under','golos','ambas','marcam','marca','marcador','quem','placar','seguro','jogo','hoje','mais','menos','aposta','apostar','vale','pena','confiança','confianca','acertos','resultado','ganha','liga','qual','como','isso','esse','este','para','contra','dia','sugestão']);
"""+script
# 3) pesquisa de jogos ignora palavras de mercado (ex. "casa vence" apanhava o Casa Pia)
rep("return s.split(/[\\s,?]+/).filter(w => w.length > 3).some(w => blob.includes(w));",
    "return s.split(/[\\s,?]+/).filter(w => w.length > 3 && !ZE_STOP.has(w)).some(w => blob.includes(w));")
# 4) glossário só dispara em perguntas de definição (antes "over 2.5" devolvia a definição de over)
rep("""  for (const [k, v] of Object.entries(gloss)) {
    if (q.includes(k) || (k === 'cartoes' && /cart[oõ]es/.test(q)) || (k === 'xg' && /expected goals/.test(q))) {""",
"""  const isDefQ = /o que [eé]|que [eé] (o|um|uma)|explica|significa|defini/.test(q);
  for (const [k, v] of Object.entries(gloss)) {
    const kHit = new RegExp('(^|[^a-zà-ú])' + k + '([^a-zà-ú]|$)').test(q) || (k === 'cartoes' && /cart[oõ]es/.test(q)) || (k === 'xg' && /expected goals/.test(q));
    if (kHit && (isDefQ || q.replace(/[?!.\\s]/g, '') === k.replace(/\\s/g, ''))) {""")
# 5) "placar?" pedia o placar do jogo mas devolvia o placar de acertos
rep("if (/placar|acertos|score|performance/.test(q) && !/golos|over|marca/.test(q)) {",
    "if (/acertos|performance|placar de acertos/.test(q) && !/golos|over|marca/.test(q)) {")
# 6) perguntas de mercado sem jogo em memória → usa o jogo do duelo
rep("""  if (!found.length && zeLastMatch && /over|golos|ambas|btts|marca|casa|ganha|under|aposta|prob|e se|mais de|\\?/.test(q)) {
    found = [zeLastMatch];
  }""","""  if (!found.length && /over|golos|ambas|btts|marca|casa vence|ganha|under|aposta|prob|e se|mais de|placar|seguro|confian|cen[aá]rio/.test(q)) {
    const fb = zeLastMatch || pickDueloMatch();
    if (fb) found = [fb];
  }""")
rep("  if (e.key === 'Enter') { e.preventDefault(); enviarChat(); }","  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarChat(); e.target.style.height = 'auto'; }")
# 9) localStorage seguro
rep("function saveTrack(t) { localStorage.setItem('dossie_track_v1', JSON.stringify(t)); }",
    "function saveTrack(t) { try { localStorage.setItem('dossie_track_v1', JSON.stringify(t)); } catch (e) {} }")
rep("function saveBank(b) { localStorage.setItem(BANK_KEY, JSON.stringify(b)); }",
    "function saveBank(b) { try { localStorage.setItem(BANK_KEY, JSON.stringify(b)); } catch (e) { alert('Não consegui gravar a banca neste browser.'); } }")
# v15: jogos fora do radar + modelo nos cartões e no chat
n_past = script.count("matches.filter(m => !m.past)")
script = script.replace("matches.filter(m => !m.past)", "matches.filter(m => !m.past && !m.aviso)")
print('filters patched', n_past)
rep("""        ${m.risk ? '<div class="chip-risk">⚠️ Risco goleada</div>' : ''}""",
    """        ${m.risk ? '<div class="chip-risk">⚠️ Risco goleada</div>' : ''}
        ${m.aviso ? `<div class="chip-risk" style="color:var(--yellow)">⚠️ ${m.aviso}</div>` : ''}
        ${m.live ? '<div class="chip-risk" style="color:var(--blue)">📡 API · modelo automático</div>' : ''}""")
rep("""    <div class="h2h"><strong>H2H recente:</strong> ${m.h2h}</div>""",
    """    ${m.aviso ? `<div class="note" style="border-left-color:var(--yellow);color:var(--yellow);"><strong>⚠️ Por confirmar:</strong> ${m.aviso}. O Zé não aposta neste jogo.</div>` : ''}
    <div class="h2h"><strong>H2H recente:</strong> ${m.h2h}</div>""")
rep("""    ${pitchXI(m)}""","""    ${modelBlock(m)}
    ${pitchXI(m)}""")
rep("""      ${betHtml}""","""      ${betHtml}
      ${modelLine(m)}""")
rep("""(diff rating ~${pred.diff || '?'})""","""(golos esperados ${modelo(m).lh.toFixed(2)}–${modelo(m).la.toFixed(2)})""")
rep("""    ans += `<br>🎯 <strong>Over ${line}:</strong> `;""","""    ans += `<br>🎯 <strong>Over ${line}:</strong> modelo <b>${pct(modelo(m).mk['O' + line])}</b> (odd justa ${fairOdd(modelo(m).mk['O' + line])}) — `;""")
rep("""    ans += `<br>🔄 <strong>BTTS:</strong> `;""","""    ans += `<br>🔄 <strong>BTTS:</strong> modelo <b>${pct(modelo(m).mk.BTTS)}</b> (justa ${fairOdd(modelo(m).mk.BTTS)}) — `;""")
rep("""    ans += `<br>🏠 <strong>Casa vence:</strong> `;""","""    ans += `<br>🏠 <strong>Casa vence:</strong> modelo <b>${pct(modelo(m).mk['1'])}</b> (justa ${fairOdd(modelo(m).mk['1'])}) — `;""")
# jogos marcados como errados (verificação 2 Nov 2026)
def flag(line):
    import re as _re
    mh=_re.search(r"home:'([^']*)',away:'([^']*)'",line); ml=_re.search(r"league:'([^']*)'",line)
    if not mh or not ml: return line
    h,a,L=mh.group(1),mh.group(2),ml.group(1); t=h+'|'+a
    av=None
    if 'Heidenheim' in t: av='Heidenheim desceu à 2. Bundesliga em 2026'
    elif 'Verona' in t: av='Verona não está na Serie A 2026/27'
    elif 'Palermo' in t and ('Sassuolo' in t or 'Frosinone' in t): av=('Sassuolo' if 'Sassuolo' in t else 'Frosinone')+' está na Serie A — não joga com o Palermo na Serie B'
    elif 'Lourosa' in t: av='Lourosa está na Liga 2, não na Liga 3'
    elif 'Almería' in t and 'Segunda' in L: av='Almería subiu à La Liga'
    elif 'Championship' in L and any(x in t for x in ['Leeds','Hull','Man United']): av='Leeds/Hull/Man United estão na Premier League'
    elif 'Premier' in L and any(x in t for x in ['West Ham','Wolves','Burnley']): av='West Ham/Wolves desceram ao Championship'
    elif L=='Champions': av='não está na jornada 4 da Champions 2026/27'
    if av and "past:true" not in line:
        line=line.replace("{phase:","{aviso:'"+av+"',phase:",1)
    return line
ls=script.split('\n'); cnt=0
for k,l in enumerate(ls):
    if l.lstrip().startswith("{phase:"):
        nl=flag(l)
        if nl!=l: cnt+=1
        ls[k]=nl
script='\n'.join(ls); print('flagged', cnt)
# 10) service worker só em http(s) (em file:// no Android dá erro)
rep("if ('serviceWorker' in navigator) {","if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {")
# 11) instalar: botão no header
rep("if (btn) btn.style.display = 'inline-flex';","if (btn) btn.style.display = 'inline-flex';")
rep("const text = card.innerText.toLowerCase();","const text = (card.innerText || card.textContent || '').toLowerCase();")
rep('        <div class="chip-teams">${m.home} vs ${m.away}</div>','        <div class="chip-teams">${vsHTML(m.home, m.away, 18)}</div>')
rep('    <div style="font-size:1.05rem;font-weight:700;margin-bottom:5px;">${m.home} vs ${m.away}</div>','    <div style="font-size:1.15rem;font-weight:800;margin-bottom:5px;">${vsHTML(m.home, m.away, 28)}</div>')
rep('    <button class="copy-btn" onclick="copyAnalysis(this)">📋 Copiar análise</button>', '    <div style="display:flex;gap:8px;"><button class="copy-btn" style="flex:1" onclick="copyAnalysis(this)">📋 Copiar análise</button><button class="copy-btn" style="flex:1;background:var(--lime);color:#14081f;" onclick="shareMatch(matchIndex(window._modalMatch))">📤 Partilhar</button></div>')
rep("function openModal(m) {\n  const body","function openModal(m) {\n  window._modalMatch = m;\n  const body")
# 12) cores antigas (slate) → paleta FM
for a,b in [('#0f172a','var(--bg2)'),('#1e293b','var(--tile)'),('#334155','var(--line2)'),('#94a3b8','var(--muted)'),('#64748b','var(--muted2)'),('#e2e8f0','var(--text)'),('#cbd5e1','var(--text)'),('#f1f5f9','var(--text)'),('#a78bfa','var(--purple)'),('#c4b5fd','var(--purple)')]:
    script=script.replace(a,b)
script=script.replace("background:linear-gradient(135deg,#0c4a6e,#0369a1);","background:var(--accent);").replace("background:linear-gradient(135deg,#7c3aed,#db2777);","background:var(--accent);").replace("background:linear-gradient(135deg,#0f766e,#0369a1);","background:var(--accent);")

out=shell.replace('%%CAL%%',cal).replace('%%SCOUT%%',scout).replace('%%SCRIPT%%',script).replace('%%NEWJS%%',newjs)
open('dossie_do_dia_v50.html','w',encoding='utf-8').write(out)
print('ok', len(out))
