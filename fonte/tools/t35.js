const __mz=u=>{u=decodeURIComponent(String(u)); return u.replace(/dates=(\d{4})(\d{2})?(?=&|$)/,(m,y,mo)=>{ if(mo){const last=new Date(Date.UTC(+y,+mo,0)).getUTCDate(); return 'dates='+y+mo+'01-'+y+mo+String(last).padStart(2,'0');} return 'dates='+y+'0101-'+y+'1231';});};
// Simulação: jornada 4 da Champions, 3 nov 2026 (jogos reais; odds, forma e resultados inventados)
const {JSDOM, VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const FILE=process.argv[2]||'/home/claude/work/dossie_do_dia_v50.html';
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push('JSERR '+e.message));vc.on('error',e=>errs.push('CONSOLE.ERROR '+e));
const iso=d=>d.toISOString(); const past=k=>new Date(Date.now()-k*864e5);
const T=(h,mi)=>new Date(Date.UTC(2026,10,3,h,mi));
const FIX=[ // id, home, hid, away, aid, kickoff, odds 1/X/2, O2.5, result
 ['901','Barcelona','83','Aston Villa','362',T(20,0),[1.45,4.8,6.5],1.55,[3,1],['Lamine Yamal','Raphinha','Lewandowski'],['Ollie Watkins']],
 ['902','Atlético Madrid','1068','Bayern Munich','132',T(20,0),[2.9,3.5,2.35],1.72,[1,1],['Julián Álvarez'],['Harry Kane']],
 ['903','Bodø/Glimt','5776','Lille','166',T(20,0),[2.3,3.6,2.9],1.70,[2,1],['Kasper Høgh','Hauge'],['Jonathan David']],
 ['904','Feyenoord','142','Internazionale','110',T(20,0),[3.6,3.6,1.95],1.80,[0,2],[],['Lautaro Martínez','Marcus Thuram']],
 ['905','Galatasaray','432','VfB Stuttgart','134',T(17,45),[2.2,3.6,3.1],1.60,[2,2],['Victor Osimhen','Barış Alper Yılmaz'],['Deniz Undav','Ermedin Demirović']],
 ['906','LASK','2720','Slovan Bratislava','3998',T(20,0),[1.9,3.5,4.0],1.85,[1,0],['Moses Usor'],[]],
 ['907','Manchester United','360','AS Roma','104',T(20,0),[1.95,3.6,3.8],1.75,[2,1],['Bruno Fernandes','Bryan Mbeumo'],['Paulo Dybala']],
 ['908','Shakhtar Donetsk','493','Sporting CP','2250',T(17,45),[3.1,3.5,2.25],1.68,[1,2],['Eguinaldo'],['Francisco Trincão','Luis Suárez']],
 ['909','Villarreal','102','Paris Saint-Germain','160',T(20,0),[3.9,3.9,1.85],1.62,[1,3],['Gerard Moreno'],['Ousmane Dembélé','Khvicha Kvaratskhelia','Vitinha']],
];
const ML=d=>d>=2?Math.round((d-1)*100):Math.round(-100/(d-1));
let PHASE=1;
const ev=(f,done)=>{const [id,h,hid,a,aid,dt,,,res,sh,sa]=f;return {id,date:iso(dt),status:{type:{completed:done,state:done?'post':'pre'}},competitions:[{competitors:[
 {homeAway:'home',team:{id:hid,displayName:h,shortDisplayName:h,abbreviation:h.slice(0,3).toUpperCase(),color:'0b4ea2'},score:done?String(res[0]):undefined},
 {homeAway:'away',team:{id:aid,displayName:a,shortDisplayName:a,abbreviation:a.slice(0,3).toUpperCase(),color:'c8102e'},score:done?String(res[1]):undefined}],
 details:done?[...sh.map(n=>({scoringPlay:true,type:{text:'Goal'},team:{id:hid},athletesInvolved:[{displayName:n}]})),...sa.map(n=>({scoringPlay:true,type:{text:'Goal'},team:{id:aid},athletesInvolved:[{displayName:n}]}))]:[]}]};};
// forma: equipas mais fortes marcam mais (semente fixa)
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const STR={'83':2.3,'362':1.5,'1068':1.6,'132':2.3,'5776':1.6,'166':1.4,'142':1.4,'110':1.9,'432':1.8,'134':1.5,'2720':1.4,'3998':1.0,'360':1.6,'104':1.3,'493':1.3,'2250':1.8,'102':1.5,'160':2.4};
const pois=l=>{let L=Math.exp(-l),k=0,p=1;do{k++;p*=rnd();}while(p>L);return k-1;};
const sched=(id,name)=>({events:Array.from({length:8},(_,k)=>{const gf=pois(STR[id]),ga=pois(1.2);const home=k%2===0;const f=home?['x'+id+k,name,id,'Opp'+k,'o'+k,past(k*6+3),0,0,[gf,ga],[],[]]:['y'+id+k,'Opp'+k,'o'+k,name,id,past(k*6+3),0,0,[ga,gf],[],[]];return ev(f,true);})});
const SUM=f=>({pickcenter:[{provider:{name:'ESPN BET'},overUnder:2.5,homeTeamOdds:{moneyLine:ML(f[6][0])},drawOdds:{moneyLine:ML(f[6][1])},awayTeamOdds:{moneyLine:ML(f[6][2])},overOdds:ML(f[7]),underOdds:ML(1/(1-1/f[7]+0.05))}],headToHeadGames:[],rosters:[]});
const ROS={'2250':{athletes:[{displayName:'Luis Suárez',position:{abbreviation:'F'}},{displayName:'Francisco Trincão',position:{abbreviation:'F'}},{displayName:'Morten Hjulmand',position:{abbreviation:'M'}}]},'493':{athletes:[{displayName:'Eguinaldo',position:{abbreviation:'F'}}]}};
const RSS=(items)=>'<?xml version="1.0"?><rss><channel>'+items.map(([t,src,h])=>`<item><title>${t} - ${src}</title><link>https://news.example/${encodeURIComponent(t)}</link><pubDate>${new Date(Date.now()-h*3600e3).toUTCString()}</pubDate><source url="https://x">${src}</source></item>`).join('')+'</channel></rss>';
const NEWS={'PT':RSS([['Sporting: Hjulmand em dúvida para a deslocação ao Shakhtar','Record',6],['Shakhtar-Sporting: leões querem vencer na Polónia','A Bola',9]]),
 'GB':RSS([['Man United v Roma: Dybala a doubt for Old Trafford trip','BBC Sport',5],['Barcelona boss confirms Pedri ruled out against Aston Villa','The Guardian',7],['Bayern Munich: Kane returns to training before Atletico Madrid clash','Sky Sports',4]]),
 'ES':RSS([['El Barcelona, sin Pedri ante el Aston Villa por lesión','Marca',6],['Villarreal-PSG: el submarino busca la sorpresa','AS',8]]),
 'IT':RSS([['Roma, Dybala in dubbio per il Manchester United','Gazzetta',5]])};
const dom=new JSDOM(fs.readFileSync(FILE,'utf8'),{runScripts:'dangerously',virtualConsole:vc,url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){const __RD=w.Date,__S=Date.now(),__F=Date.UTC(2026,10,3,12,0); w.Date=class extends __RD{constructor(...a){if(!a.length)super(__F+(__RD.now()-__S));else super(...a);} static now(){return __F+(__RD.now()-__S);}};w.scrollTo=()=>{};w.alert=m=>errs.push('ALERT '+m);w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:(t,k)=>k==='measureText'?()=>({width:10}):k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}})};
 w.HTMLCanvasElement.prototype.toDataURL=()=>'data:image/png;base64,AAAA';w.HTMLCanvasElement.prototype.toBlob=function(cb){cb(new w.Blob(['x'],{type:'image/png'}))};
 w.URL.createObjectURL=()=>'blob:x'; w.URL.revokeObjectURL=()=>{}; w.Tesseract={createWorker:async()=>({setParameters:async()=>{},recognize:async()=>({data:{text:require('fs').readFileSync(__dirname+'/ocr/phone.txt','utf8'),words:[]}}),terminate:async()=>{}})};
 w.fetch=async(u)=>{u=__mz(u);u=decodeURIComponent(String(u)); let m; const R=x=>({ok:true,json:async()=>x,text:async()=>JSON.stringify(x)});
  if(/news\.google/.test(u)){const e=(u.match(/ceid=([A-Z]{2})/)||[])[1];return {ok:true,text:async()=>NEWS[e]||RSS([]),json:async()=>({})};}
  if((m=u.match(/teams\/(\d+)\/schedule/))){const f=FIX.find(x=>x[2]===m[1]||x[4]===m[1]);return R(f?sched(m[1],f[2]===m[1]?f[1]:f[3]):{events:[]});}
  if((m=u.match(/teams\/(\d+)\/roster/))) return R(ROS[m[1]]||{athletes:[]});
  if((m=u.match(/summary\?event=(\d+)/))){const f=FIX.find(x=>x[0]===m[1]);return R(f?SUM(f):{});}
  if((m=u.match(/soccer\/([a-z.0-9]+)\/scoreboard/))){ if(m[1]!=='uefa.champions') return R({events:[]}); return R({events:FIX.map(f=>ev(f,PHASE===2))}); }
  if(/standings/.test(u)) return R({children:[{standings:{entries:FIX.flatMap(f=>[[f[2],f[1]],[f[4],f[3]]]).map(([id,n],k)=>({team:{id,displayName:n},stats:[{name:'gamesPlayed',value:3},{name:'pointsFor',value:Math.round(STR[id]*3)},{name:'pointsAgainst',value:4},{name:'points',value:Math.round(STR[id]*3)}]}))}}]});
  return {ok:false,status:404,json:async()=>({}),text:async()=>''};};}});
const w=dom.window; const wait=ms=>new Promise(r=>setTimeout(r,ms));
const bad=[]; const chk=(c,msg)=>{ if(!c) bad.push(msg); };
setTimeout(async()=>{try{
 w.localStorage.clear(); w.localStorage.setItem('ze_user_v1',JSON.stringify({name:'Spongy'}));
 await w.atualizarTudo(); await wait(50);
 w.eval("normFiles=async f=>f; prepImageInk=async()=>({width:10,height:10}); prepImage=async()=>({width:10,height:10}); prepImageWhite=async()=>({canvas:{width:10,height:10},dark:false}); prepImageReceipt=async()=>({width:10,height:10});");
 w.fmGo('ze');
 const f=new w.File(['x'],'slip.jpg',{type:'image/jpeg'});
 await w.zeChatSlip([f]); await wait(100);
 const bubbles=[...w.document.querySelectorAll('#chatLog .cmsg.bot .bubble')]; const last=bubbles[bubbles.length-1];
 const txt=last.textContent.replace(/\s+/g,' ');
 console.log('ANÁLISE DO ZÉ:\n',txt.slice(0,1500));
 const st=w.eval('slipState'); console.log('\nslipState: legs',st.legs.length,'| odd total',st.totalOdd,'| stake',st.stake,'| moeda',st.currency);
 const ev=st.legs.map(l=>{const e=w.legEval(l);return (e.m?'✅':'❌')+' '+l.home+'–'+l.away+' p='+(e.p*100).toFixed(0)+'% ('+e.src+')';}); console.log(ev.join('\n'));
 chk(st.legs.length===9,'9 seleções'); chk(st.legs.every(l=>w.legEval(l).m),'nem todos os jogos encontrados no radar');
 w.slipRegistar(); const B1=w.loadBank(); const bet=B1.bets[0]&&B1.bets.reduce((a,b)=>new Date(a.at)>new Date(b.at)?a:b); console.log('\nREGISTADA:',bet.pick,'| odd',bet.odd,'| stake',bet.stake,'| legs',bet.legs.length,'| nota',bet.note); chk(bet.legs.length===9,'aposta com 9');
 PHASE=2; await w.atualizarTudo(); await wait(80); const B2=w.loadBank(); const bb=B2.bets.find(x=>x.id===bet.id); console.log('DEPOIS DOS JOGOS:',bb.status,'|',bb.finalScores); chk(bb.status==='loss','devia perder (Atlético 1-1)');
 const legsR=bb.legs.map(l=>{const r=w.resolveLeg(l,JSON.parse(w.localStorage.getItem('ze_live_v1')).matches.filter(x=>x.status==='FINISHED'),bb.at);return l.home+': '+(r?(r.win?'✅':'❌')+' '+r.score:'?');}); console.log('por jogo:',legsR.join(' · ')); chk(legsR.every(x=>!/\?$/.test(x)),'há jogos por encontrar');
 const btns=[...last.querySelectorAll('button')].map(b=>b.textContent.trim()+' → '+(b.getAttribute('onclick')||'')); console.log('\nBOTÕES:',btns.join(' | '));
}catch(e){errs.push('EXC '+e.stack)} console.log('\n=== PROBLEMAS ===');console.log(bad.concat(errs).join('\n')||'NENHUM');process.exit(0);},600);
