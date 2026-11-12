const __mz=u=>{u=decodeURIComponent(String(u)); return u.replace(/dates=(\d{4})(\d{2})?(?=&|$)/,(m,y,mo)=>{ if(mo){const last=new Date(Date.UTC(+y,+mo,0)).getUTCDate(); return 'dates='+y+mo+'01-'+y+mo+String(last).padStart(2,'0');} return 'dates='+y+'0101-'+y+'1231';});};
const {JSDOM, VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(e.message));
const iso=d=>d.toISOString(); const later=new Date(Date.now()+2*3600e3); const past=k=>new Date(Date.now()-k*864e5);
let FINISHED=false;
const RSS=(items)=>'<?xml version="1.0"?><rss><channel>'+items.map(([t,src,h])=>`<item><title>${t} - ${src}</title><link>https://news.example/${encodeURIComponent(t)}</link><pubDate>${new Date(Date.now()-h*3600e3).toUTCString()}</pubDate><source url="https://x">${src}</source></item>`).join('')+'</channel></rss>';
const NEWS=RSS([['Pavlidis em dúvida para a receção ao Alverca','Record',5],['Benfica vai poupar titulares a pensar na Champions','A Bola',8],['Alverca: Dawda Camara castigado frente ao Benfica','O Jogo',20],['Aursnes regressa aos convocados','Maisfutebol',30],['Benfica e o mercado de inverno','A Bola',40]]);

const ev=(id,hid,h,aid,a,hs,as,done,dt)=>({id,date:iso(dt),status:{type:{completed:done,state:done?'post':'pre'}},competitions:[{competitors:[{homeAway:'home',team:{id:hid,displayName:h,shortDisplayName:h,abbreviation:h.slice(0,3).toUpperCase(),color:'d1102b'},score:done?String(hs):undefined},{homeAway:'away',team:{id:aid,displayName:a,shortDisplayName:a},score:done?String(as):undefined}],details:[]}]});
const sched=(id,name,rows)=>({events:rows.map(([home,gf,ga],k)=>home?ev('x'+id+k,id,name,'o'+k,'Opp'+k,gf,ga,true,past(k*6+3)):ev('y'+id+k,'o'+k,'Opp'+k,id,name,ga,gf,true,past(k*6+3)))});
const SCH={'1929':sched('1929','Benfica',[[1,3,0],[0,2,1],[1,4,1],[0,1,1],[1,2,0],[1,3,1],[0,0,1],[1,2,2]]),'21613':sched('21613','Alverca',[[0,0,2],[1,1,1],[0,1,3],[1,2,0],[0,0,1],[0,1,2],[1,1,0]])};
const SUM={pickcenter:[{provider:{name:'ESPN BET'},overUnder:2.5,homeTeamOdds:{moneyLine:-400},awayTeamOdds:{moneyLine:+1000},drawOdds:{moneyLine:+450},overOdds:-130,underOdds:+100}],
 headToHeadGames:[{events:[{gameDate:iso(past(200)),homeTeamId:'1929',awayTeamId:'21613',homeTeamScore:'2',awayTeamScore:'1'},{gameDate:iso(past(380)),homeTeamId:'21613',awayTeamId:'1929',homeTeamScore:'0',awayTeamScore:'2'},{gameDate:iso(past(560)),homeTeamId:'1929',awayTeamId:'21613',homeTeamScore:'1',awayTeamScore:'1'}]}],
 rosters:[{team:{id:'1929'},formation:'4-2-3-1',roster:[{starter:true,athlete:{displayName:'Fredrik Aursnes'}},{starter:false,athlete:{displayName:'Vangelis Pavlidis'}}]},{team:{id:'21613'},roster:[{starter:true,athlete:{displayName:'Dawda Camara'}}]}]};
const ROS={'1929':{athletes:[{displayName:'Vangelis Pavlidis',position:{abbreviation:'F'}},{displayName:'Fredrik Aursnes',position:{abbreviation:'M'}}]},'21613':{athletes:[{displayName:'Dawda Camara',position:{abbreviation:'F'}}]}};
const goal=(n)=>({scoringPlay:true,type:{text:'Goal'},team:{id:'1929'},athletesInvolved:[{displayName:n}]});
const SEASON={events:[1,2,3,4,5,6].map(k=>{const e=ev('s'+k,'1929','Benfica','o'+k,'Opp'+k,2,0,true,past(k*7)); e.competitions[0].details=[goal('Vangelis Pavlidis'),goal(k<3?'Fredrik Aursnes':'Vangelis Pavlidis')]; return e;})};
const dom=new JSDOM(fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8'),{runScripts:'dangerously',virtualConsole:vc,url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){w.scrollTo=()=>{};w.alert=m=>errs.push('ALERT '+m);w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.fetch=async(u)=>{u=__mz(u);u=decodeURIComponent(String(u)); let m; const R=x=>({ok:true,json:async()=>x,text:async()=>JSON.stringify(x)});
  if(/news\.google\.com\/rss/.test(u)) return {ok:true,text:async()=>NEWS,json:async()=>({})};
  if((m=u.match(/teams\/(\d+)\/schedule/))) return R(SCH[m[1]]||{events:[]});
  if((m=u.match(/teams\/(\d+)\/roster/))) return R(ROS[m[1]]||{athletes:[]});
  if(/summary\?event=777/.test(u)) return R(SUM);
  if((m=u.match(/soccer\/([a-z.0-9]+)\/scoreboard\?dates=(\d{8})/))){ if(m[1]!=='por.1') return R({events:[]}); if(m[2].slice(4,6)==='07') return R(SEASON); return R({events:[FINISHED?ev('777','1929','Benfica','21613','Alverca',3,0,true,new Date(Date.now()-3600e3)):ev('777','1929','Benfica','21613','Alverca',0,0,false,later)]}); }
  if(/standings/.test(u)) return R({children:[{standings:{entries:[]}}]});
  return {ok:false,status:404,json:async()=>({})};};}});
const w=dom.window; const wait=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(async()=>{try{dom.window.eval("CAL_STATIC.forEach(m=>{m.calSt='ok';if(m.aviso===CAL_PENDING_TXT)m.aviso=m._orig.aviso||null;delete m.calNote;if(!matches.includes(m))matches.push(m)})");
 const M=w.eval('matches'); const i=M.findIndex(m=>m.home==='Benfica'&&m.away==='Alverca'); const m=M[i];
 const before=w.modelo(m); console.log('BEFORE', before.lh, before.la, before.src, '1', before.mk['1'].toFixed(3));
 w.fmGo('jogos'); w.openMatchIdx(i);
 console.log('modal has study btn', !!w.document.querySelector('#studyBox button'));
 await w.studyInModal(w.document.querySelector('#studyBox button'));
 const after=w.modelo(m); console.log('AFTER', after.lh, after.la, after.src, 'conf', after.conf, '1', after.mk['1'].toFixed(3), 'O2.5', after.mk['O2.5'].toFixed(3));
 console.log('NEWS:', [...w.document.querySelectorAll('#studyBox .news .need')].map(x=>x.textContent.replace(/\s+/g,' ').trim().slice(0,150)).join('\n  '));
 const j=w.studyFor(m).news.signals.findIndex(s=>s.k==='doubt'||s.k==='out'); console.log('signals', JSON.stringify(w.studyFor(m).news.signals.map(s=>[s.k,s.player,s.side]))); w.newsApply(i,j,'out'); w.newsApply(i,w.studyFor(m).news.signals.findIndex(s=>s.k==='rot'),'rot'); console.log('NOTES after confirm', JSON.stringify(w.notesFor(m)), 'model 1', w.modelo(m).mk['1'].toFixed(3));
 console.log('REASON:\n'+[...w.document.querySelectorAll('#studyBox .rz, #studyBox .rz-head, #studyBox > .reason > div')].map(x=>x.textContent.replace(/\s+/g,' ').trim()).join('\n').slice(0,1400));
 w.closeModal(); w.fmGo('ze'); w.document.getElementById('chatInput').value='porquê?'; w.enviarChat(); await wait(300);
 console.log('CHAT:', [...w.document.querySelectorAll('#chatLog .cmsg.bot .bubble')].pop().textContent.replace(/\s+/g,' ').slice(0,200));
 w.prepararDuelo(i); await wait(600);
 console.log('DUEL study shown', !!w.document.getElementById('dueloStudy'), '| odd_1 prefilled', w.document.getElementById('odd_1').value, '| O2.5', w.document.getElementById('odd_O2_5').value);
 const preds=JSON.parse(w.localStorage.getItem('ze_preds_v1')||'{}'); console.log('snapshots', Object.keys(preds).length, JSON.stringify(Object.values(preds).find(p=>/Benfica/.test(p.home))));
 FINISHED=true; await w.atualizarTudo({quiet:true}); await wait(300);
 const L=JSON.parse(w.localStorage.getItem('ze_learn_v1')||'{}'); console.log('LEARN n',L.n,'nMkt',L.nMkt,'log',JSON.stringify(L.log));
 w.fmGo('config'); w.renderConfig(); console.log('BRAIN:', w.document.getElementById('cfgBrain').textContent.replace(/\s+/g,' ').slice(-420));
}catch(e){errs.push(e.stack)} console.log(errs.join('\n')||'NO ERRORS');},400);
