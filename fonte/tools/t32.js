const __mz=u=>{u=decodeURIComponent(String(u)); return u.replace(/dates=(\d{4})(\d{2})?(?=&|$)/,(m,y,mo)=>{ if(mo){const last=new Date(Date.UTC(+y,+mo,0)).getUTCDate(); return 'dates='+y+mo+'01-'+y+mo+String(last).padStart(2,'0');} return 'dates='+y+'0101-'+y+'1231';});};
// Ligações: ESPN direto 400, corsproxy 403, allorigins em baixo → tem de funcionar por outra ponte/formato
const {JSDOM,VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const SCEN=process.argv[2]||'S1';
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push('JSERR '+e.message));
const RealDate=Date; const NOW=RealDate.UTC(2026,10,2,22,0);
const EV={id:'e1',date:new RealDate(RealDate.UTC(2026,10,1,20)).toISOString(),status:{type:{completed:true,state:'post'}},competitions:[{competitors:[{homeAway:'home',team:{id:'1',displayName:'Benfica',shortDisplayName:'Benfica'},score:'3'},{homeAway:'away',team:{id:'2',displayName:'Alverca',shortDisplayName:'Alverca'},score:'0'}],details:[]}]};
let calls={};
function espn(u){ // resposta da «ESPN»
  const m=u.match(/soccer\/([a-z._0-9]+)\/scoreboard\?dates=(\d{8})(?:-(\d{8}))?(.*)$/);
  if(m){ const days=m[3]?Math.round((new RealDate(+m[3].slice(0,4),+m[3].slice(4,6)-1,+m[3].slice(6))-new RealDate(+m[2].slice(0,4),+m[2].slice(4,6)-1,+m[2].slice(6)))/864e5)+1:1;
    if(SCEN==='S2'&&/limit=/.test(m[4])) return {st:400,body:'{"code":400}'};
    if(SCEN==='S4'&&days>1) return {st:400,body:'{"code":400}'};
    const inR=m[1]==='por.1'&&('20261101'>=m[2])&&('20261101'<=(m[3]||m[2]));
    return {st:200,body:JSON.stringify({events:inR?[EV]:[]})}; }
  if(/standings/.test(u)) return {st:200,body:'{"children":[]}'};
  return {st:404,body:''};
}
const dom=new JSDOM(fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8'),{runScripts:'dangerously',virtualConsole:vc,url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){
 class FakeDate extends RealDate{constructor(...a){if(!a.length)super(NOW);else super(...a);} static now(){return NOW;}} w.Date=FakeDate;
 w.scrollTo=()=>{};w.alert=m=>errs.push('ALERT '+m);w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.fetch=async(u)=>{u=__mz(u);u=String(u); const key=/codetabs/.test(u)?'codetabs':/allorigins.win\/get/.test(u)?'ao-get':/allorigins/.test(u)?'ao-raw':/corsproxy/.test(u)?'corsproxy':/thingproxy/.test(u)?'thing':/espn/.test(u)?'direto':'outro'; calls[key]=(calls[key]||0)+1;
  const inner=decodeURIComponent(u.replace(/^.*?(quest=|url=|fetch\/)/,''));
  const resp=(st,body)=>({ok:st>=200&&st<300,status:st,text:async()=>body,json:async()=>JSON.parse(body)});
  if(SCEN==='S3') { if(key==='direto') return resp(400,''); throw new TypeError('Failed to fetch'); }
  if(key==='direto'){ if(SCEN==='S1') return resp(400,'{"code":400}'); const r=espn(u); return resp(r.st,r.body); }
  if(key==='corsproxy') return resp(403,'Forbidden');
  if(key==='ao-raw'||key==='ao-get'||key==='thing') throw new TypeError('Failed to fetch');
  if(key==='codetabs'){ if(SCEN==='S2'||SCEN==='S4') throw new TypeError('Failed to fetch'); const r=espn(inner); return resp(r.st,r.body); }
  throw new TypeError('x');};}});
const w=dom.window;const wait=ms=>new Promise(r=>setTimeout(r,ms));const bad=[];const chk=(c,m)=>{if(!c)bad.push(m);};
setTimeout(async()=>{try{
 w.localStorage.clear();
 const B=w.loadBank(); B.bets.push({id:'b1',match:'Benfica vs Alverca',pick:'Benfica vence',odd:1.3,stake:2,legs:[{home:'Benfica',away:'Alverca',sel:'Benfica',odd:1.3}],at:new RealDate(RealDate.UTC(2026,10,1,10)).toISOString(),status:'open'}); B.you-=2; w.saveBank(B);
 await w.atualizarTudo(); await wait(50);
 const st=w.document.getElementById('liveStatus').textContent.replace(/\s+/g,' ').trim();
 const bet=w.loadBank().bets.find(x=>x.id==='b1');
 console.log(SCEN,'| estado:',st.slice(0,230),'\n   aposta:',bet.status,'| ponte guardada:',w.eval('BRIDGES')[w.lsGet('ze_bridge',0)].n,'| formato:',w.eval('ESPN_VARIANTS')[w.lsGet('ze_espn_variant',0)].n,'| pedidos:',JSON.stringify(calls));
 if(SCEN!=='S3') chk(bet.status==='win','aposta não liquidou'); else chk(/Testar ligação/.test(st),'S3 sem dica');
 calls={}; await w.atualizarTudo(); console.log('   2.º atualizar pedidos:',JSON.stringify(calls));
 w.fmGo('config'); const btn=w.document.getElementById('netTestBtn'); chk(!!btn,'botão testar'); if(btn){ await w.netTest(btn); console.log('   🩺',w.document.getElementById('netTestBox').textContent.replace(/\s+/g,' ').slice(0,420)); }
}catch(e){errs.push('EXC '+e.stack)} console.log('   PROBLEMAS:',bad.concat(errs).join(' | ')||'NENHUM');process.exit(0);},500);
