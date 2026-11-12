const {JSDOM,VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const HTML=fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8');
const bad=[],chk=(c,m)=>{if(!c)bad.push(m)}; const errs=[];
const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
const day=k=>new Date(Date.now()+k*864e5).toISOString();
const T=(id,n)=>({id,displayName:n,shortDisplayName:n,name:n,abbreviation:n.slice(0,3).toUpperCase()});
const EV=(id,d,h,a,sc)=>({id,date:d,status:{type:{state:sc?'post':'pre',completed:!!sc}},competitions:[{competitors:[{homeAway:'home',team:h,score:sc?String(sc[0]):undefined},{homeAway:'away',team:a,score:sc?String(sc[1]):undefined}]}]});
const A=T('1','Viking FK'),B=T('2','Sabah'),X=T('9','Outro');
const sched=(t,lastDaysAgo)=>({events:[...Array(8)].map((_,i)=>EV('s'+t.id+i,day(-(lastDaysAgo+i*7)),i%2?X:t,i%2?t:X,[2,1])).concat([EV('n'+t.id,day(4),t,X)])});
let oddsBook={count:2,items:[{provider:{name:'Bet 365'},bettingOdds:{teamOdds:{preMatchFullTimeResultHome:{value:'2/5'},preMatchFullTimeResultDraw:{value:'4/1'},preMatchFullTimeResultAway:{value:'11/2'},preMatchDoubleChanceHomeOrDraw:{value:'1/9'},preMatchDoubleChanceDrawOrAway:{value:'7/4'},preMatchDoubleChanceHomeOrAway:{value:'1/6'},preMatchOverUnderHandicap:{value:'2.5'},preMatchGoalLineOver:{value:'4/5'},preMatchGoalLineUnder:{value:'1/1'}}}}]};
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://juliomcm-tech.github.io/mister-ze/',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.fetch=async(u)=>{u=String(u); const J=(o,s=200)=>({ok:s<300,status:s,json:async()=>o,text:async()=>JSON.stringify(o)}); let m;
  if((m=u.match(/soccer\/all\/teams\/(\d+)\/schedule/))) return J(m[1]==='1'?sched(A,1):sched(B,7));
  if((m=u.match(/teams\/(\d+)\/schedule/))) return J({events:[EV('c'+m[1],day(-14),m[1]==='1'?A:X,m[1]==='1'?X:B,[1,0])]});
  if(/core\.api.*odds/.test(u)) return J(oddsBook);
  return J({},404);}}});
const w=dom.window;
setTimeout(async()=>{try{
  w.eval(`(()=>{const dt=new Date(Date.now()+864e5); matches.push({phase:'imediato',type:'best',live:true,home:'Viking FK',away:'Sabah',date:dayLabel(dt),league:'Champions',prob:'~70%',analysis:'',note:'',lambdas:{lh:2.28,la:1.27},bet:'—',kickoff:'20:00',espn:{h:'1',a:'2',code:'uefa.champions',ev:'777'}}); MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear();})()`);
  const m=w.eval('matches').find(x=>x.home==='Viking FK');
  const r0=w.modelo(m); await w.zeStudy(m); const st=w.studyFor(m);
  console.log('rest H',JSON.stringify(st.restH),'A',JSON.stringify(st.restA),'formAll',st.formAll,'recentH',st.recentH.length,'fatigue:',st.fatigueNote);
  chk(st.formAll&&st.recentH.length>=8,'forma de todas as competições'); 
  const r=w.modelo(m); console.log('conf',r.conf,'trace:',r.trace.map(t=>t.k).join(','));
  chk(r.trace.some(t=>t.k==='Descanso'&&/só nota/.test(t.txt)),'trace descanso (só nota)'); chk(r.trace.some(t=>t.k==='Qualidade'),'trace qualidade'); chk(/Viking FK jogou há (2|3) dias/.test(st.fatigueNote||''),'cansaço detetado '+st.fatigueNote);
  // diário: grava, odd baixa → CLV
  w.diarySnapAll(); let it=w.diaryLoad().items.ev777; console.log('diário',JSON.stringify({pick:it.pick&&it.pick.label,value:it.value,valueFirst:it.valueFirst,close:it.close}));
  chk(w.diarySnapAll()===0,'não regrava sem mudanças');
  // odds mudam: away paga menos → fecho
  oddsBook.items[0].bettingOdds.teamOdds.preMatchDoubleChanceDrawOrAway.value='6/4'; w.eval('ODDS_MEM.clear()'); await w.oddsInto(st,m,true); w.diarySnapAll();
  it=w.diaryLoad().items.ev777; console.log('depois',JSON.stringify({valueFirst:it.valueFirst,close:it.close}));
  w.diaryGrade({matches:[{id:'777',status:'FINISHED',utcDate:day(1),homeTeam:{name:'Viking FK',shortName:'Viking FK'},awayTeam:{name:'Sabah',shortName:'Sabah'},score:{fullTime:{home:1,away:1}}}]});
  it=w.diaryLoad().items.ev777; console.log('nota',JSON.stringify(it.g));
  chk(it.g.bz!=null&&it.g.bm!=null,'brier Zé e casas'); if(it.valueFirst) chk(it.g.clv!=null,'CLV calculado');
  w.fmGo('ze'); const ph=w.document.getElementById('diaryBox').textContent; chk(/Medidas de profissional/.test(ph),'painel pro'); console.log('painel:',ph.replace(/\s+/g,' ').match(/Medidas de profissional.{0,220}/)?.[0]);
  // duelo: odd mal escrita e procura da melhor odd
  w.eval('dueloAtual={m:matches.find(x=>x.home==="Viking FK")}');
  if(!w.document.getElementById('zeDecision')){const d=w.document.createElement('div'); d.id='zeDecision'; w.document.body.appendChild(d);}
  w.eval('ZE_MARKETS').forEach(k=>{let el=w.document.getElementById('odd_'+k.replace('.','_')); if(!el){el=w.document.createElement('input'); el.id='odd_'+k.replace('.','_'); w.document.body.appendChild(el);} el.value='';});
  w.document.getElementById('odd_1').value='1.30'; w.document.getElementById('odd_X').value='45'; w.document.getElementById('odd_2').value='6.50';
  w.zeDecidirUI(); const dt=w.document.getElementById('zeDecision').textContent; console.log('comparar:',dt.replace(/\s+/g,' ').match(/Comparar odds.{0,300}/)?.[0]);
  chk(/confirma se não te enganaste/.test(dt),'apanha odd mal escrita'); chk(/a tua casa paga 1.30/.test(dt),'procura melhor odd');
  // jogo do dia
  const j=w.zeTalk('jogo do dia'); console.log('jogo do dia:',j.html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,300)); chk(/casas|sem odds/.test(j.html),'veredito no jogo do dia');
}catch(e){bad.push('EXC '+e.stack)}
 console.log(errs.length?'ERRS '+errs.join(' | '):'NO ERRORS'); console.log('=== PROBLEMAS ===\n'+(bad.join('\n')||'NENHUM')); process.exit(0);},2000);
