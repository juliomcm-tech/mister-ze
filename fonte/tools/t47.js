const {JSDOM,VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const HTML=fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8');
const bad=[],chk=(c,m)=>{if(!c)bad.push(m)}; const errs=[];
const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://juliomcm-tech.github.io/mister-ze/',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.fetch=async()=>({ok:false,status:404,json:async()=>({}),text:async()=>''});}});
const w=dom.window;
setTimeout(async()=>{try{
  // 3 jogos amanhã com ids ESPN
  w.eval(`[['Viking FK','Sabah','uefa.champions','901',2.28,1.27],['PSV','Club Brugge','uefa.champions','902',1.9,1.2],['FC Porto','Napoli','uefa.champions','903',1.4,1.3]].forEach(([h,a,c,ev,lh,la])=>{ const dt=new Date(Date.now()+864e5); matches.push({phase:'imediato',type:'best',live:true,home:h,away:a,date:dayLabel(dt),league:'Champions',prob:'~70%',analysis:'',note:'',lambdas:{lh,la},bet:'—',kickoff:'20:00',espn:{h:'1',a:'2',code:c,ev}}); }); MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear();`);
  const n=w.diarySnapAll(); const D=w.diaryLoad(); console.log('gravados',n,Object.values(D.items).map(x=>x.home+': '+(x.pick&&x.pick.label)+' '+(x.pick&&x.pick.p)+' cs '+x.cs).join(' | '));
  chk(n===3,'grava 3 opiniões'); chk(D.items.ev901&&D.items.ev901.pick,'chave por id ESPN');
  chk(w.diarySnapAll()===0,'não regrava igual');
  // resultados
  const fin=(id,h,a,i,j)=>({id,status:'FINISHED',utcDate:new Date(Date.now()+864e5).toISOString(),homeTeam:{name:h,shortName:h},awayTeam:{name:a,shortName:a},score:{fullTime:{home:i,away:j}},competition:{code:'uefa.champions'}});
  const g=w.diaryGrade({matches:[fin('901','Viking FK','Sabah',2,1),fin('902','PSV','Club Brugge',0,0),fin('903','FC Porto','Napoli',1,3)]});
  const D2=w.diaryLoad(); console.log('corrigidos',g,Object.values(D2.items).map(x=>`${x.home} ${x.res} pick ${x.g.pick} fav ${x.g.fav} cs ${x.g.cs}`).join(' | '));
  chk(g===3,'corrige 3'); chk(D2.items.ev901.g.cs===1,'placar 2-1 certo'); chk(D2.items.ev901.g.fav===1,'favorito Viking ganhou');
  // depois do apito, não regrava
  chk(w.diaryGrade({matches:[fin('901','Viking FK','Sabah',2,1)]})===0,'não corrige 2 vezes');
  // muitos jogos: Mais de 1.5 sempre 82% e só 60% acerta → lição + correção
  w.eval(`(()=>{const D=diaryLoad(); for(let i=0;i<60;i++){ const ok=i%5<3; D.items['x'+i]={key:'x'+i,home:'A'+i,away:'B'+i,league:'Liga Teste',kick:new Date(Date.now()-(i+2)*864e5).toISOString(),pick:{k:'O1.5',label:'Mais de 1.5 golos',p:0.82,need:1.26},mk:{'1':0.5,'X':0.25,'2':0.25,'O1.5':0.82,'O2.5':0.6,'O3.5':0.35,'BTTS':0.55},cs:'2-1',res: ok?'2-1':'1-0',g:{pick:ok?1:0,fav:1,cs:ok?1:0,o25:ok?1:0,btts:ok?1:0,value:null}}; } diarySave(D); DIARY_FIX_CACHE=null;})()`);
  const S=w.diaryStats(); const L=w.diaryLessons(S); console.log('stats picks',S.picks.hit+'/'+S.picks.n,'lições:',L.map(x=>x.t.replace(/<[^>]+>/g,'')).join(' || ').slice(0,400));
  chk(L.some(x=>/Mais de 1.5/.test(x.t)&&/otimista/.test(x.t)),'lição otimista O1.5');
  const fx=w.diaryFix(); console.log('correção',JSON.stringify(fx)); chk(fx['O1.5']<-0.05,'corrige O1.5 para baixo');
  const m=w.eval('matches').find(x=>x.home==='PSV'); w.eval('MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear()'); const r=w.modelo(m); chk(r._dfix&&r.trace.some(t=>t.k==='Diário'),'modelo mostra correção');
  chk(Math.abs(r.mk['U1.5']-(1-r.mk['O1.5']))<1e-9,'complementares coerentes');
  // painel e chat
  w.fmGo('ze'); const p=w.document.getElementById('diaryBox'); chk(p&&/Diário|Aposta mais segura/.test(w.document.getElementById('diaryPanel').textContent),'painel'); console.log('painel:',p.textContent.replace(/\s+/g,' ').slice(0,300));
  const c=w.zeTalk('como estás a acertar?'); console.log('chat:',c.html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,240)); chk(/Diário/.test(c.html),'chat diário');
}catch(e){bad.push('EXC '+e.stack)}
 console.log(errs.length?'ERRS '+errs.join(' | '):'NO ERRORS'); console.log('=== PROBLEMAS ===\n'+(bad.join('\n')||'NENHUM')); process.exit(0);},2000);
