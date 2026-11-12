// ESPN com travão: depois de 25 pedidos num minuto responde 503 (sem CORS = «Failed to fetch»)
const __mz=u=>{u=decodeURIComponent(String(u)); return u.replace(/dates=(\d{4})(\d{2})?(?=&|$)/,(m,y,mo)=>{ if(mo){const last=new Date(Date.UTC(+y,+mo,0)).getUTCDate(); return 'dates='+y+mo+'01-'+y+mo+String(last).padStart(2,'0');} return 'dates='+y+'0101-'+y+'1231';});};
const {JSDOM,VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const LIMIT=+(process.argv[2]||25);
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push('JSERR '+e.message));
let espnCalls=0, proxyCalls=0, blocked=0;
const ev={id:'e1',date:new Date(Date.UTC(2026,10,1,20)).toISOString(),status:{type:{completed:true,state:'post'}},competitions:[{competitors:[{homeAway:'home',team:{id:'1',displayName:'Benfica',shortDisplayName:'Benfica'},score:'3'},{homeAway:'away',team:{id:'2',displayName:'Alverca',shortDisplayName:'Alverca'},score:'0'}],details:[]}]};
const dom=new JSDOM(fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8'),{runScripts:'dangerously',virtualConsole:vc,url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){w.scrollTo=()=>{};w.alert=m=>errs.push('ALERT '+m);w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.fetch=async(u)=>{u=String(u); if(!/espn/.test(u)) throw new TypeError('x'); if(!/^https:\/\/site\.api\.espn/.test(u)){proxyCalls++; throw new TypeError('Failed to fetch');}
  espnCalls++; if(espnCalls>LIMIT){blocked++; throw new TypeError('Failed to fetch');}
  const dec=__mz(u); if(/dates=\d{8}-\d{8}/.test(decodeURIComponent(u))) return {ok:false,status:400,text:async()=>'{}',json:async()=>({})};
  const body=/por\.1\/scoreboard/.test(dec)?{events:[ev]}:/standings/.test(dec)?{children:[]}:{events:[]};
  return {ok:true,status:200,text:async()=>JSON.stringify(body),json:async()=>body};};}});
const w=dom.window;
setTimeout(async()=>{try{
 const B=w.loadBank(); B.bets.push({id:'b1',match:'Benfica vs Alverca',pick:'Benfica vence',odd:1.3,stake:2,legs:[{home:'Benfica',away:'Alverca',sel:'Benfica',odd:1.3}],at:new Date(Date.UTC(2026,10,1,10)).toISOString(),status:'open'}); B.you-=2; w.saveBank(B);
 const t0=Date.now(); await w.atualizarTudo(); const t1=Date.now();
 console.log(`limite ${LIMIT}: pedidos à ESPN ${espnCalls} (bloqueados ${blocked}) · pontes ${proxyCalls} · ${((t1-t0)/1000).toFixed(1)} s`);
 console.log('estado:',w.document.getElementById('liveStatus').textContent.replace(/\s+/g,' ').slice(0,260));
 console.log('aposta:',w.loadBank().bets.find(x=>x.id==='b1').status);
 const c0=espnCalls; await w.atualizarTudo(); console.log('2.º atualizar logo a seguir: +',espnCalls-c0,'pedidos ·',w.document.getElementById('liveStatus').textContent.replace(/\s+/g,' ').slice(0,140));
}catch(e){errs.push('EXC '+e.stack)} console.log(errs.join('\n')||'NO ERRORS');process.exit(0);},500);
