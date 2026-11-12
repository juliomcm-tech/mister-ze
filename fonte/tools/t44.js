const {JSDOM,VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const HTML=fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8');
const bad=[],chk=(c,m)=>{if(!c)bad.push(m)}; const errs=[];
const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
const B365={provider:{name:'Bet 365'},bettingOdds:{teamOdds:{preMatchFullTimeResultHome:{value:'24/25'},preMatchFullTimeResultDraw:{value:'5/2'},preMatchFullTimeResultAway:{value:'13/5'},preMatchDoubleChanceHomeOrDraw:{value:'2/7'},preMatchDoubleChanceDrawOrAway:{value:'4/5'},preMatchDoubleChanceHomeOrAway:{value:'2/7'},preMatchOverUnderHandicap:{value:'2.5'},preMatchGoalLineOver:{value:'19/20'},preMatchGoalLineUnder:{value:'9/10'}},playerOdds:{preMatchAnyTimeGoalScorer:[{player:'Vangelis Pavlidis',value:'6/5'},{player:'Fulano Tal',value:'9/2'}]}}};
const DK={provider:{name:'DraftKings'},homeTeamOdds:{moneyLine:105},awayTeamOdds:{moneyLine:240},drawOdds:{moneyLine:240},overUnder:2.5,overOdds:-115,underOdds:-105};
const DKL={provider:{name:'DraftKings - Live Odds'},homeTeamOdds:{moneyLine:-500},awayTeamOdds:{moneyLine:900},drawOdds:{moneyLine:600}};
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://juliomcm-tech.github.io/mister-ze/',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.scrollTo=()=>{}; w.localStorage.setItem('ze_user_v1',JSON.stringify({name:'Júlio Melo',photo:''}));
  w.fetch=async(u)=>{u=String(u); const J=(o,s=200)=>({ok:s<300,status:s,json:async()=>o,text:async()=>JSON.stringify(o)});
    if(/sports\.core\.api\.espn\.com.*\/odds/.test(u)) return J({count:3,items:[DK,B365,DKL]});
    return J({},404);}
}});
const w=dom.window;
setTimeout(async()=>{try{
  // avatar
  const svg=w.humanFace(46); chk(/clipPath/.test(svg)&&/clip-path="url\(#hfc/.test(svg),'avatar com clip'); chk(/>JM</.test(svg),'iniciais JM');
  // calendário: nada do dossiê por confirmar
  const st=w.eval('CAL_STATIC'); const M=w.eval('matches');
  const pend=st.filter(m=>m.calSt==='pending').length; const inM=st.filter(m=>M.includes(m)&&m.calSt==='pending').length;
  console.log('estáticos',st.length,'pendentes',pend,'na lista',inM,'matches',M.length);
  chk(pend===st.length-st.filter(m=>m.past).length||pend>0,'pendentes marcados'); chk(inM===0,'pendentes fora da lista');
  chk(!M.some(m=>m.home==='Bayern'&&m.away==='Benfica'),'Bayern-Benfica fora');
  chk(w.pickDueloMatch()===null||!w.pickDueloMatch().aviso,'duelo só jogo verdadeiro');
  // simula verificação: confirma 1, dá outro como inexistente
  const a=st.find(m=>m.home==='Bayern'&&m.away==='Benfica'), b=st.find(m=>!m.past&&m!==a);
  const items={}; items[w.eval('calKey')(a)]={st:'missing'}; items[w.eval('calKey')(b)]={st:'moved',utc:new Date(Date.now()+3*864e5).toISOString(),espn:{h:'1',a:'2',code:'por.1',ev:'777'},league:'Liga Portugal'};
  w.eval('lsSet')('ze_calfix_v1',{at:new Date().toISOString(),items}); w.eval('calApply()'); w.eval('renderCalendar()');
  const M2=w.eval('matches'); chk(M2.includes(b),'confirmado entra'); chk(!M2.includes(a),'inexistente fica fora'); chk(!b.aviso,'confirmado sem aviso');
  console.log('confirmado:',b.home,b.away,b.date,'| duelo:',w.pickDueloMatch()&&w.pickDueloMatch().home);
  chk(w.pickDueloMatch()===b,'duelo usa o confirmado');
  chk(/calendário oficial/.test(w.document.getElementById('calPendNote')?.textContent||''),'nota do calendário');
  // odds
  const books=await w.eval('coreOdds')('por.1','777'); console.log(JSON.stringify(books.map(x=>[x.provider,x.odds,x.scorers.length])));
  chk(books.length===2,'2 casas (sem live)'); chk(books[0].provider==='Bet365','Bet365 primeiro'); chk(Math.abs(books[0].odds['1']-1.96)<0.01&&books[0].odds['X2']===1.8&&books[0].odds['O2.5']===1.95,'frações bet365');
  chk(Math.abs(books[1].odds['1']-2.05)<0.01&&Math.abs(books[1].odds['O2.5']-1.87)<0.01,'americanas DK');
  w.eval('STUDY')[w.eval('mKey')(b)]={t:Date.now(),m:{home:b.home,away:b.away},sources:[]};
  const S=w.studyFor(b); await w.eval('oddsInto')(S,b); chk(S.market&&S.market.provider==='Bet365','market bet365'); 
  const h=w.reasoningHTML(b); chk(/Odds das casas/.test(h)&&/Bet365/.test(h)&&/odds-t/.test(h),'tabela odds no estudo');
  console.log('valor:',w.eval('oddsValue')(b).slice(0,3).map(x=>x.k+'@'+x.o+' ev'+Math.round(x.ev*100)).join(' '));
  // chat
  w.eval('zeLastMatch=matches.find(m=>m.home===' + JSON.stringify(b.home) + ')');
  const r=w.zeTalk('odds'); chk(r&&/Odds das casas|Vou ver as odds/.test(r.html),'chat odds');
  // nav telemóvel
  chk(w.document.getElementById('mNav')&&w.document.querySelectorAll('#mNav button').length===5,'barra telemóvel');
  w.document.querySelector('#mNav [data-m="duelo"]').click(); chk(w.eval('currentView')==='duelo','nav duelo');
  w.document.querySelector('#mNav [data-m="mais"]').click(); chk(w.document.getElementById('mMore').classList.contains('open'),'mais abre');
  w.document.querySelector('#mMore [data-g="jogos"]').click(); chk(w.eval('currentView')==='jogos'&&!w.document.getElementById('mMore').classList.contains('open'),'mais→calendário');
}catch(e){bad.push('EXC '+e.stack)}
 console.log(errs.length?'ERRS '+errs.join(' | '):'NO ERRORS'); console.log('=== PROBLEMAS ===\n'+(bad.join('\n')||'NENHUM')); process.exit(0);},2000);
