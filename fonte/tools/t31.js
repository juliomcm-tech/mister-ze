const __mz=u=>{u=decodeURIComponent(String(u)); return u.replace(/dates=(\d{4})(\d{2})?(?=&|$)/,(m,y,mo)=>{ if(mo){const last=new Date(Date.UTC(+y,+mo,0)).getUTCDate(); return 'dates='+y+mo+'01-'+y+mo+String(last).padStart(2,'0');} return 'dates='+y+'0101-'+y+'1231';});};
const {JSDOM,VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push('JSERR '+e.message));
const RealDate=Date; let NOW=RealDate.UTC(2026,10,2,19,0);
const U=(y,mo,d,h,mi)=>RealDate.UTC(y,mo-1,d,h,mi||0);
const EV=[['por.1','Benfica','Alverca',U(2026,11,2,20,15)],['por.1','FC Porto','Estoril',U(2026,8,16,18),2,0],['por.1','Santa Clara','Vitória Guimarães',U(2026,11,8,15,30)],
 ['por.1','Benfica','Vitória Guimarães',U(2027,1,10,20,30)],['por.1','FC Porto','Sporting CP',U(2027,1,24,20,30)],['por.1','Sporting CP','Estoril',U(2027,4,11,18)],
 ['eng.1','Chelsea','Manchester United',U(2026,11,8,16,30)],['ita.1','Internazionale','AC Milan',U(2027,1,24,19,45)],['esp.1','Real Madrid','Barcelona',U(2027,5,9,20)]];
const ev=(e,i)=>{const done=e[4]!=null;return {id:'c'+i,date:new RealDate(e[3]).toISOString(),status:{type:{completed:done,state:done?'post':'pre'}},competitions:[{competitors:[{homeAway:'home',team:{id:'h'+e[1],displayName:e[1],shortDisplayName:e[1]},score:done?String(e[4]):undefined},{homeAway:'away',team:{id:'a'+e[2],displayName:e[2],shortDisplayName:e[2]},score:done?String(e[5]):undefined}],details:[]}]};};
const dom=new JSDOM(fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8'),{runScripts:'dangerously',virtualConsole:vc,url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){
 class FakeDate extends RealDate{constructor(...a){if(!a.length)super(NOW);else super(...a);} static now(){return NOW;}} w.Date=FakeDate;
 w.scrollTo=()=>{};w.alert=m=>errs.push('ALERT '+m);w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.fetch=async(u)=>{u=__mz(u);u=decodeURIComponent(String(u));let m;const R=x=>({ok:true,json:async()=>x,text:async()=>JSON.stringify(x)});
  if((m=u.match(/soccer\/([a-z._0-9]+)\/scoreboard\?dates=(\d{8})-(\d{8})/))){const a=RealDate.UTC(+m[2].slice(0,4),+m[2].slice(4,6)-1,+m[2].slice(6)),b=RealDate.UTC(+m[3].slice(0,4),+m[3].slice(4,6)-1,+m[3].slice(6))+864e5;return R({events:EV.map((e,i)=>[e,i]).filter(([e])=>e[0]===m[1]&&e[3]>=a&&e[3]<b).map(([e,i])=>ev(e,i))});}
  if(/standings/.test(u)) return R({children:[]});
  return {ok:false,status:404,json:async()=>({}),text:async()=>''};};}});
const w=dom.window;const wait=ms=>new Promise(r=>setTimeout(r,ms));const bad=[];const chk=(c,m)=>{if(!c)bad.push(m);};
setTimeout(async()=>{try{
 w.localStorage.clear(); w.__calNow=true; w.fmGo('jogos');
 console.log('ANTES:',w.document.getElementById('calCheck')?.textContent.replace(/\s+/g,' ').slice(0,120));
 const chips0=w.document.querySelectorAll('#view-jogos .match-chip').length;
 await w.atualizarTudo(); await wait(1500);
 const M=w.eval('matches').filter(m=>!m.live);
 const show=(h,a)=>{const m=M.find(x=>x.home===h&&x.away===a);return m?`${h}-${a}: ${m._orig.date} → ${m.date} [${m.calSt}] ${m.phase}${m.past?' (jogado '+m.resultado+')':''}`:'?';};
 [['Benfica','Alverca'],['FC Porto','Estoril'],['Porto','Estoril'],['Santa Clara','Vitória SC'],['Benfica','Vitória SC'],['Porto','Sporting'],['Sporting','Estoril'],['Santa Clara','Sporting'],['Chelsea','Man United'],['Inter','Milan'],['Real Madrid','Barcelona'],['Sassuolo','Palermo'],['Lourosa','Fafe'],['Real Madrid','Milan']].forEach(x=>console.log('  '+show(...x)));
 const g=(h,a)=>M.find(x=>x.home===h&&x.away===a)||w.eval('CAL_STATIC').find(x=>x.home===h&&x.away===a);
 chk(g('Benfica','Alverca').calSt==='ok','ok'); chk(g('Santa Clara','Vitória SC').date==='Dom 8 Nov','moved'); chk(g('Porto','Sporting').date==='Dom 24 Jan','weekday'); chk(w.parseDayLabel('Dom 24 Jan').getFullYear()===2027,'ano 2027');
 chk(g('Benfica','Vitória SC').phase==='inverno','fase'); chk(g('Santa Clara','Sporting').calSt==='missing','missing'); chk(g('Lourosa','Fafe').calSt==='unknown','unknown');
 chk([g('FC Porto','Estoril').calSt,g('Porto','Estoril').calSt].sort().join()==='dup,played','played/dup');
 const chips1=w.document.querySelectorAll('#view-jogos .match-chip').length;
 console.log('\ncartões no calendário: antes',chips0,'→ depois',chips1,'|',w.document.getElementById('calCheck').textContent.replace(/\s+/g,' ').slice(0,260));
 w.CAL_SHOW_ALL=true; w.eval('CAL_SHOW_ALL=true'); w.renderCalendar(); console.log('a mostrar os inventados:',w.document.querySelectorAll('#view-jogos .match-chip').length); w.eval('CAL_SHOW_ALL=false'); w.renderCalendar();
 w.openModal(g('Porto','Sporting')); console.log('ficha:',w.document.getElementById('modal-body').textContent.replace(/\s+/g,' ').slice(0,120)); w.closeModal();
 // recarregar a página offline: as correções ficam
 const saved=w.localStorage.getItem('ze_calfix_v1');
 const dom2=new JSDOM(fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8'),{runScripts:'dangerously',virtualConsole:vc,url:'https://x.test/',pretendToBeVisual:true,beforeParse(w2){class FD extends RealDate{constructor(...a){if(!a.length)super(NOW);else super(...a);} static now(){return NOW;}} w2.Date=FD;w2.localStorage.setItem('ze_calfix_v1',saved);w2.scrollTo=()=>{};w2.fetch=async()=>{throw new TypeError('offline')};}});
 await wait(400); const w2=dom2.window; const P2=w2.eval('matches').find(x=>x.home==='Porto'&&x.away==='Sporting'); console.log('\noffline depois de recarregar: Porto-Sporting',P2.date,P2.calSt,'| cartões',w2.document.querySelectorAll('#view-jogos .match-chip').length); chk(P2.date==='Dom 24 Jan','persistência');
 ['portal','jogos','duelo','ze'].forEach(v=>{w.fmGo(v);const t=w.document.getElementById('view-'+v)?.textContent||'';const mm=t.match(/.{0,40}(NaN|undefined|Infinity).{0,30}/);if(mm)bad.push(v+': «'+mm[0].replace(/\s+/g,' ')+'»');});
}catch(e){errs.push('EXC '+e.stack)} console.log('\n=== PROBLEMAS ===');console.log(bad.concat(errs).join('\n')||'NENHUM');process.exit(0);},500);
