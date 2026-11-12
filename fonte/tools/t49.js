const {JSDOM,VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const HTML=fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8');
const bad=[],chk=(c,m)=>{if(!c)bad.push(m)}; const errs=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://juliomcm-tech.github.io/mister-ze/',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.scrollTo=()=>{};w.fetch=async()=>({ok:false,status:404,json:async()=>({}),text:async()=>''});}});
const w=dom.window;
setTimeout(()=>{try{
  w.eval(`(()=>{const dt=new Date(Date.now()+864e5); matches.push({phase:'imediato',live:true,home:'Viking FK',away:'Sabah',date:dayLabel(dt),league:'Champions',lambdas:{lh:2,la:1},espn:{h:'1',a:'2',code:'uefa.champions',ev:'9'}}); matches.push({phase:'imediato',live:true,home:'Newcastle United',away:'Everton',date:dayLabel(dt),league:'Premier League',lambdas:{lh:1.5,la:1},espn:{h:'3',a:'4',code:'eng.1',ev:'8'}});})()`);
  const g=w.ocrPost({legs:[{sel:'Viking FK - Sabah',market:'Resultado Final',home:'Viking FK',away:'',odd:1.4},{sel:'Newcastle United',home:'Newcastle United',away:'',odd:2.1},{sel:'aa',home:'Malorca',away:'Cad 1Siiint',odd:''},{sel:'x',home:'Maiorca',away:'Cadis',odd:1.42}]});
  console.log(JSON.stringify(g.legs.map(l=>[l.home,l.away,l.sel,l.odd])));
  chk(g.legs[0].home==='Viking FK'&&g.legs[0].away==='Sabah'&&g.legs[0].sel==='Viking FK','jogo vs seleção');
  chk(g.legs[1].away==='Everton','equipa de fora do calendário');
  chk(g.legs.length===3,'repetido mal lido removido');
  chk(typeof w.ocrSelfTest==='function','teste do leitor existe');
  w.fmGo('config'); chk(w.document.getElementById('ocrTestBtn'),'botão nas definições');
  chk(/Testar o leitor/.test(w.ocrErrorHTML(new Error('x'),null)),'botão no erro');
}catch(e){bad.push('EXC '+e.stack)}
 console.log(errs.length?'ERRS '+errs.join(' | '):'NO ERRORS'); console.log('=== PROBLEMAS ===\n'+(bad.join('\n')||'NENHUM')); process.exit(0);},1500);
