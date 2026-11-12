const __mz=u=>{u=decodeURIComponent(String(u)); return u.replace(/dates=(\d{4})(\d{2})?(?=&|$)/,(m,y,mo)=>{ if(mo){const last=new Date(Date.UTC(+y,+mo,0)).getUTCDate(); return 'dates='+y+mo+'01-'+y+mo+String(last).padStart(2,'0');} return 'dates='+y+'0101-'+y+'1231';});};
// Liquidação: boletim registado depois do jogo, atualizar 8 dias depois, Serie B, cantos, jogo duplo, nomes PT
const {JSDOM,VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push('JSERR '+e.message));
const RealDate=Date; let NOW=RealDate.UTC(2026,10,2,21,0);
const D=(d,h)=>RealDate.UTC(2026,10,d,h||20);
const E=(id,code,h,a,t,hs,as)=>({id,code,h,a,t,hs,as});
const EV=[ E('a1','por.1','Benfica','FC Porto',RealDate.UTC(2026,9,25,20),2,1),   // 8 dias antes
  E('a2','esp.1','Atlético Madrid','Bayern Munich',D(1,20),1,1),
  E('a3','ita.2','Sassuolo','Palermo',D(1,15),0,2),
  E('a4','eng.1','Arsenal','Chelsea',D(1,17),3,0),
  E('a5','por.1','Sporting CP','SC Braga',D(1,18),1,0),
  E('a6','por.1','Sporting CP','SC Braga',D(5,20),null,null),      // jogo igual por jogar (taça) — 5 nov
  E('a7','eng.1','Liverpool','Everton',D(2,15),2,2) ];
const ev=e=>{const done=e.hs!=null&&e.t<NOW;return {id:e.id,date:new RealDate(e.t).toISOString(),status:{type:{completed:done,state:done?'post':'pre'}},competitions:[{competitors:[{homeAway:'home',team:{id:'h'+e.id,displayName:e.h,shortDisplayName:e.h},score:done?String(e.hs):undefined},{homeAway:'away',team:{id:'a'+e.id,displayName:e.a,shortDisplayName:e.a},score:done?String(e.as):undefined}],details:[]}]};};
const dom=new JSDOM(fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8'),{runScripts:'dangerously',virtualConsole:vc,url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){
 class FakeDate extends RealDate{constructor(...a){if(!a.length)super(NOW);else super(...a);} static now(){return NOW;}} w.Date=FakeDate;
 w.scrollTo=()=>{};w.alert=m=>errs.push('ALERT '+m);w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.fetch=async(u)=>{u=__mz(u);u=decodeURIComponent(String(u));let m;const R=x=>({ok:true,json:async()=>x,text:async()=>JSON.stringify(x)});
  if((m=u.match(/soccer\/([a-z._0-9]+)\/scoreboard\?dates=(\d{8})-(\d{8})/))){const a=RealDate.UTC(+m[2].slice(0,4),+m[2].slice(4,6)-1,+m[2].slice(6)),b=RealDate.UTC(+m[3].slice(0,4),+m[3].slice(4,6)-1,+m[3].slice(6))+864e5;return R({events:EV.filter(e=>e.code===m[1]&&e.t>=a&&e.t<b).map(ev)});}
  if(/standings/.test(u)) return R({children:[]});
  return {ok:false,status:404,json:async()=>({}),text:async()=>''};};}});
const w=dom.window;const wait=ms=>new Promise(r=>setTimeout(r,ms));const bad=[];const chk=(c,m)=>{if(!c)bad.push(m);};
setTimeout(async()=>{try{
 w.localStorage.clear();
 const at=t=>new RealDate(t).toISOString();
 const B=w.loadBank();
 const mk=(id,match,pick,odd,stake,legs,atT,who)=>({id,match,pick,odd,stake,legs,at:at(atT),status:'open',who});
 B.bets.push(mk('b1','Benfica vs FC Porto','Benfica vence',2.1,2,[{home:'Benfica',away:'FC Porto',sel:'Benfica',odd:2.1}],RealDate.UTC(2026,9,24,12)));            // 9 dias
 B.bets.push(mk('b2','Atl. Madrid vs Bayern Munique','Empate',3.4,1,[{home:'Atl. Madrid',away:'Bayern Munique',sel:'Empate',odd:3.4}],D(2,10)));                   // registado DEPOIS do jogo
 B.bets.push(mk('b3','Sassuolo vs Palermo','Palermo vence',3.0,1,[{home:'Sassuolo',away:'Palermo',sel:'Palermo',odd:3.0}],D(1,10)));                             // Serie B
 B.bets.push(mk('b4','Arsenal vs Chelsea','Mais de 9.5 cantos',1.9,1,[{home:'Arsenal',away:'Chelsea',sel:'Mais de 9.5 cantos',odd:1.9}],D(1,10)));               // cantos
 B.bets.push(mk('b5','Sporting CP vs SC Braga','Sporting CP vence',1.8,1,[{home:'Sporting CP',away:'SC Braga',sel:'Sporting CP',odd:1.8}],D(2,12)));             // é o jogo de 5 nov!
 B.bets.push(mk('b6','Equipa X vs Equipa Y','Equipa X vence',1.5,1,[{home:'Equipa X',away:'Equipa Y',sel:'Equipa X',odd:1.5}],D(1,9)));
 B.zeBets.push(mk('z1','Liverpool vs Everton','Liverpool vence',1.6,0.5,[{home:'Liverpool',away:'Everton',sel:'Liverpool',odd:1.6}],D(2,9)));
 B.you-=7; B.ze-=0.5; w.saveBank(B);
 const you0=w.loadBank().you, ze0=w.loadBank().ze;
 await w.atualizarTudo(); await wait(100);
 console.log('ESTADO:',w.document.getElementById('liveStatus').textContent.trim());
 const S=w.loadBank(); const st=id=>(S.bets.concat(S.zeBets).find(x=>x.id===id)||{}).status;
 console.log('b1 (9 dias):',st('b1'),'| b2 (registado depois):',st('b2'),'| b3 Serie B:',st('b3'),'| b4 cantos:',st('b4'),'| b5 jogo de 5 nov:',st('b5'),'| b6 inexistente:',st('b6'),'| z1 Zé:',st('z1'));
 chk(st('b1')==='win','b1'); chk(st('b2')==='win','b2'); chk(st('b3')==='win','b3'); chk(st('b4')==='open','b4'); chk(st('b5')==='open','b5 fechou com o jogo errado'); chk(st('b6')==='open','b6'); chk(st('z1')==='loss','z1');
 const exp=you0+2*2.1+1*3.4+1*3.0; console.log('saldo tu',S.you.toFixed(2),'esperado',exp.toFixed(2),'| Zé',S.ze.toFixed(2),'esperado',ze0.toFixed(2)); chk(Math.abs(S.you-exp)<0.01,'saldo');
 w.fmGo('ze'); w.document.getElementById('chatInput').value='porque não fechou?'; w.enviarChat(); await wait(80);
 const bb=[...w.document.querySelectorAll('#chatLog .cmsg.bot .bubble')].pop(); console.log('\nCHAT:',bb.textContent.replace(/\s+/g,' ').slice(0,900));
 const btn=[...bb.querySelectorAll('button')].find(b=>/Perdeu/.test(b.textContent)); btn.click(); await wait(30); console.log('fechar à mão (cantos → perdeu):',w.loadBank().bets.find(x=>x.id==='b4').status);
 await w.atualizarTudo(); const S2=w.loadBank(); chk(Math.abs(S2.you-w.loadBank().you)<1e-9,'2.ª atualização'); console.log('2.ª atualização sem mexer:',S2.bets.map(x=>x.status).join(','));
 chk(w.buildLedger(S2,'you').reconciled&&w.buildLedger(S2,'ze').reconciled,'extrato');
}catch(e){errs.push('EXC '+e.stack)} console.log('\n=== PROBLEMAS ===');console.log(bad.concat(errs).join('\n')||'NENHUM');process.exit(0);},500);
