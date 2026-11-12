const {JSDOM,VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const HTML=fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8');
const bad=[],chk=(c,m)=>{if(!c)bad.push(m)}; const errs=[];
const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://juliomcm-tech.github.io/mister-ze/',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.fetch=async()=>({ok:false,status:404,json:async()=>({}),text:async()=>''});}});
const w=dom.window;
setTimeout(async()=>{try{
  for (const [lh,la,label] of [[2.28,1.27,'Viking 2.28-1.27'],[1.9,1.45,'mais equilibrado'],[1.2,1.1,'quase igual']]) {
    w.eval(`(()=>{const dt=new Date(Date.now()+864e5); matches.push({phase:'imediato',type:'best',live:true,home:'Viking FK',away:'Sabah',date:dayLabel(dt),league:'Champions',prob:'~70%',analysis:'',note:'',lambdas:{lh:${lh},la:${la}},bet:'—',kickoff:'20:00'}); MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear();})()`);
    const M=w.eval('matches'); const m=M[M.length-1];
    w.eval('dueloAtual={m:matches[matches.length-1]}'); 
    const box=w.document.getElementById('dueloBox')||w.document.body; 
    if(!w.document.getElementById('zeDecision')){ const d=w.document.createElement('div'); d.id='zeDecision'; box.appendChild(d);} 
    const odds={'1':1.40,X:5.00,'2':6.50,'1X':1.11,X2:2.75,'O3.5':1.90};
    w.eval('ZE_MARKETS').forEach(k=>{let el=w.document.getElementById('odd_'+k.replace('.','_')); if(!el){el=w.document.createElement('input'); el.id='odd_'+k.replace('.','_'); w.document.body.appendChild(el);} el.value=odds[k]||'';});
    w.zeDecidirUI();
    const d=w.eval('dueloAtual.decision'); const t=w.document.getElementById('zeDecision').innerText||w.document.getElementById('zeDecision').textContent;
    const r=w.eval('modelo(dueloAtual.m)').mk;
    console.log(`\n[${label}] modelo 1 ${Math.round(r['1']*100)} X ${Math.round(r.X*100)} 2 ${Math.round(r['2']*100)} → pick: ${d.pick?d.pick.label+' ev '+(d.pick.ev*100).toFixed(1):'nenhum'} · contraSkip ${d.contraSkip?d.contraSkip.label:'-'}`);
    console.log(t.replace(/\s+/g,' ').match(/Porquê\?.*/)?.[0].slice(0,600));
    chk(/Porquê\?/.test(t),'porquê '+label);
    if(d.pick && ['X2','2','X'].includes(d.pick.k)) chk(d.pick.ev>=0.10,'contra exige 10% '+label);
    M.pop();
  }
}catch(e){bad.push('EXC '+e.stack)}
 console.log(errs.length?'ERRS '+errs.join(' | '):'NO ERRORS'); console.log('=== PROBLEMAS ===\n'+(bad.join('\n')||'NENHUM')); process.exit(0);},2000);
