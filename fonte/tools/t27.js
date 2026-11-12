const __mz=u=>{u=decodeURIComponent(String(u)); return u.replace(/dates=(\d{4})(\d{2})?(?=&|$)/,(m,y,mo)=>{ if(mo){const last=new Date(Date.UTC(+y,+mo,0)).getUTCDate(); return 'dates='+y+mo+'01-'+y+mo+String(last).padStart(2,'0');} return 'dates='+y+'0101-'+y+'1231';});};
// Duas épocas: 2026/27 completa + arranque de 2027/28 (2 despromovidos, 2 promovidos, Benfica vende, Vitória compra)
const {JSDOM, VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const FILE=process.argv[2]; const TALK=process.argv[3]!=='notalk';
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push('JSERR '+e.message));
let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const pois=l=>{let L=Math.exp(-l),k=0,p=1;do{k++;p*=rnd();}while(p>L);return k-1;};
const NAMES=['Benfica','FC Porto','Sporting CP','SC Braga','Vitória SC','Famalicão','Gil Vicente','Moreirense','Rio Ave','Estoril','Casa Pia','Arouca','Santa Clara','Nacional','Estrela Amadora','AVS','Tondela','Alverca'];
const ALL=NAMES.map((n,i)=>{const q=i<3?1.9-i*0.1:i<5?1.3:1.0-0.02*i+rnd()*0.2;const hb=[4,9,13].includes(i)?1.45:1.12;return {id:String(7000+i),n,att:q,def:1/q,hb};});
const PROMO=[{id:'7100',n:'Académico Viseu',att:0.78,def:1.3,hb:1.12},{id:'7101',n:'Leixões',att:0.8,def:1.25,hb:1.12}];
function season(teams,startUTC,xmasGap){const rounds=[];const n=teams.length;let arr=teams.map((_,i)=>i);for(let r=0;r<n-1;r++){const ps=[];for(let k=0;k<n/2;k++){const a=arr[k],b=arr[n-1-k];ps.push(r%2?[b,a]:[a,b]);}rounds.push(ps);arr=[arr[0],arr[n-1],...arr.slice(1,n-1)];}rounds.push(...rounds.map(ps=>ps.map(([a,b])=>[b,a])));
 const F=[];rounds.forEach((ps,r)=>{let t=startUTC+r*7*864e5;if(r>=17&&xmasGap)t+=14*864e5;ps.forEach(([h,a],k)=>{const H=teams[h],A=teams[a];const lh=1.25*H.att*H.hb*A.def,la=1.05*A.att*H.def;F.push({id:'s'+startUTC%1000+'e'+r+'_'+k,r,t:t+(k%3)*3600e3*(k%2?24:2.5),h:H,a:A,lh,la,hg:pois(lh),ag:pois(la)});});});return F;}
const RealDate=Date;
const S1=season(ALL,RealDate.UTC(2026,7,15,18),true);
// época 2: Benfica perde força (vendas), Vitória ganha; despromovidos: os 2 mais fracos (verdade)
const weakest=ALL.slice().sort((a,b)=>a.att-b.att).slice(0,2).map(t=>t.id);
const T2=ALL.filter(t=>!weakest.includes(t.id)).map(t=>({...t})).concat(PROMO);
T2.find(t=>t.n==='Benfica').att*=0.8; T2.find(t=>t.n==='Benfica').def*=1.15; T2.find(t=>t.n==='Vitória SC').att*=1.2;
const S2=season(T2,RealDate.UTC(2027,7,14,18),false);
let FIX=S1;
let NOW=RealDate.UTC(2026,7,10,10);
const iso=t=>new RealDate(t).toISOString();
const evJSON=f=>{const done=f.t+2*3600e3<NOW;return {id:f.id,date:iso(f.t),status:{type:{completed:done,state:done?'post':'pre'}},competitions:[{competitors:[{homeAway:'home',team:{id:f.h.id,displayName:f.h.n,shortDisplayName:f.h.n,abbreviation:f.h.n.slice(0,3).toUpperCase(),color:'225588'},score:done?String(f.hg):undefined},{homeAway:'away',team:{id:f.a.id,displayName:f.a.n,shortDisplayName:f.a.n,abbreviation:'X',color:'882222'},score:done?String(f.ag):undefined}],details:[]}]};};
const standingsOf=(F,teams,cut)=>{const T={};teams.forEach(t=>T[t.id]={gp:0,gf:0,ga:0,pts:0});F.filter(f=>f.t+2*3600e3<cut).forEach(f=>{const H=T[f.h.id],A=T[f.a.id];H.gp++;A.gp++;H.gf+=f.hg;H.ga+=f.ag;A.gf+=f.ag;A.ga+=f.hg;if(f.hg>f.ag)H.pts+=3;else if(f.hg<f.ag)A.pts+=3;else{H.pts++;A.pts++;}});return {children:[{standings:{entries:teams.map(t=>({team:{id:t.id,displayName:t.n},stats:[{name:'gamesPlayed',value:T[t.id].gp},{name:'pointsFor',value:T[t.id].gf},{name:'pointsAgainst',value:T[t.id].ga},{name:'points',value:T[t.id].pts}]}))}}]};};
const odds=f=>{let p1=0,pX=0;const P=(l,k)=>Math.exp(-l)*l**k/[1,1,2,6,24,120,720,5040][k];for(let i=0;i<8;i++)for(let j=0;j<8;j++){const q=P(f.lh,i)*P(f.la,j);if(i>j)p1+=q;else if(i===j)pX+=q;}const p2=1-p1-pX,mg=1.06,ML=d=>d>=2?Math.round((d-1)*100):Math.round(-100/(d-1));return {pickcenter:[{provider:{name:'ESPN BET'},overUnder:2.5,homeTeamOdds:{moneyLine:ML(1/(p1*mg))},drawOdds:{moneyLine:ML(1/(pX*mg))},awayTeamOdds:{moneyLine:ML(1/(p2*mg))},overOdds:-120,underOdds:100}],headToHeadGames:[],rosters:[]};};
const dom=new JSDOM(fs.readFileSync(FILE,'utf8'),{runScripts:'dangerously',virtualConsole:vc,url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){
 class FakeDate extends RealDate{constructor(...a){if(!a.length)super(NOW);else super(...a);} static now(){return NOW;}}
 w.Date=FakeDate;w.scrollTo=()=>{};w.alert=m=>errs.push('ALERT '+m);w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.fetch=async(u)=>{u=__mz(u);u=decodeURIComponent(String(u));let m;const R=x=>({ok:true,json:async()=>x,text:async()=>JSON.stringify(x)});
  if(/news\.google/.test(u)) return {ok:true,text:async()=>'<rss><channel></channel></rss>'};
  if((m=u.match(/por\.1\/scoreboard\?dates=(\d{8})-(\d{8})/))){const a=RealDate.UTC(+m[1].slice(0,4),+m[1].slice(4,6)-1,+m[1].slice(6)),b=RealDate.UTC(+m[2].slice(0,4),+m[2].slice(4,6)-1,+m[2].slice(6))+864e5;return R({events:FIX.filter(f=>f.t>=a&&f.t<b).map(evJSON)});}
  if(/scoreboard/.test(u)) return R({events:[]});
  if((m=u.match(/por\.1\/standings\?season=(\d{4})/))){ return +m[1]===2026?R(standingsOf(S1,ALL,1e15)):R({children:[]}); }
  if(/por\.1\/standings/.test(u)) return R(FIX===S1?standingsOf(S1,ALL,NOW):standingsOf(S2,T2,NOW));
  if(/standings/.test(u)) return R({children:[]});
  if((m=u.match(/teams\/(\d+)\/schedule/))) return R({events:FIX.filter(f=>f.h.id===m[1]||f.a.id===m[1]).map(evJSON)});
  if((m=u.match(/summary\?event=([a-z0-9_]+)/))){const f=FIX.find(x=>x.id===m[1]);return R(f?odds(f):{});}
  if(/roster/.test(u)) return R({athletes:[]});
  return {ok:false,status:404,json:async()=>({}),text:async()=>''};};}});
const w=dom.window;const bad=[];const chk=(c,msg)=>{if(!c&&bad.length<30)bad.push(msg);};
let AB=[];const hasP=()=>{try{return w.eval('typeof PROF_W_SCALE')==='number'}catch(e){return false}};
const brier=(r,f)=>{const o=f.hg>f.ag?[1,0,0]:f.hg===f.ag?[0,1,0]:[0,0,1];return (r.mk['1']-o[0])**2+(r.mk['X']-o[1])**2+(r.mk['2']-o[2])**2;};
async function playRound(fx,opts){
 const t0=Math.min(...fx.map(f=>f.t)); NOW=t0-1.5*864e5; await w.atualizarTudo({quiet:true});
 const M=w.eval('matches'); const live=M.map((m,i)=>[m,i]).filter(([m])=>m.espn&&!m.past&&!m.aviso&&fx.some(f=>f.id===m.espn.ev));
 if(opts.study) for(const [m,i] of live.slice(0,opts.study)){ w.fmGo('jogos'); w.openMatchIdx(i); const b=w.document.querySelector('#studyBox button'); if(b) await w.studyInModal(b); w.closeModal(); }
 let B=0,n=0;const rows=[];
 const SC=[0,0.5,1,1.5]; const ab=SC.map(()=>0);
 if(hasP()) SC.forEach((sc,j)=>{ w.eval('PROF_W_SCALE='+sc+'; MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear(); ZE_NOTE_CACHE.clear();'); live.forEach(([m])=>{const f=fx.find(f=>f.id===m.espn.ev);if(f) ab[j]+=brier(w.modelo(m),f);}); });
 if(hasP()) w.eval('PROF_W_SCALE=1; MODEL_CACHE.clear(); ZE_MODEL_CACHE.clear(); ZE_NOTE_CACHE.clear();');
 AB.push(ab);
 live.forEach(([m])=>{const f=fx.find(f=>f.id===m.espn.ev);if(!f)return;const r=w.modelo(m);B+=brier(r,f);n++;rows.push([m,r,f]);});
 NOW=Math.max(...fx.map(f=>f.t))+1.2*864e5; await w.atualizarTudo({quiet:true});
 return {B,n,rows,live:live.length};
}
setTimeout(async()=>{try{
 w.localStorage.clear(); w.__calNow=true;
 let b1=0,n1=0;
 for(let r=0;r<34;r++){const x=await playRound(S1.filter(f=>f.r===r),{study:r<4?9:2});b1+=x.B;n1+=x.n;}
 const sumAB=(a,b)=>[0,1,2,3].map(j=>AB.slice(a,b).reduce((s,x)=>s+x[j],0)); if(hasP()){const q=sumAB(0,34); console.log('A/B época 1 (peso do perfil ×0 / ×0.5 / ×1 / ×1.5):',q.map(x=>(x/AB.slice(0,34).length/9).toFixed(4)).join(' / '));}
 console.log(`ÉPOCA 1 completa · Brier médio ${(b1/n1).toFixed(4)} (${n1} jogos) · aprendeu ${w.learnLoad().n.toFixed(0)}`);
 const hasProf=typeof w.teamProfile==='function';
 if(hasProf){ const P=w.prof(); const ts=Object.values(P.teams).filter(t=>t.cur); console.log('perfis época 1:',ts.length,'equipas');
  console.log('  ',w.profRank('casa').replace(/<[^>]+>/g,'').slice(0,330)); }
 // ---------- defeso ----------
 FIX=S2; NOW=RealDate.UTC(2027,6,25,12);
 if(hasProf){ await w.atualizarTudo({quiet:true});
  w.fmGo('config'); const btn=[...w.document.querySelectorAll('#cfgTeams button')].find(b=>/época passada/.test(b.textContent)); chk(!!btn,'botão «Carregar época passada» em falta'); if(btn) await w.profPrevUI(btn);
  console.log('defeso:',w.document.getElementById('cfgTeamsStatus').textContent.trim().slice(0,160));
  if(TALK){ w.fmGo('ze'); for(const q of ['O Benfica vendeu Pavlidis','Vitória SC contratou Gustavo Silva','o Vitória SC está mais forte']){ w.document.getElementById('chatInput').value=q; w.enviarChat(); await new Promise(r=>setTimeout(r,80)); const bb=[...w.document.querySelectorAll('#chatLog .cmsg.bot .bubble')].pop(); console.log('  chat «'+q+'» →',bb.textContent.replace(/\s+/g,' ').slice(0,150)); } }
 }
 // ---------- época 2: primeiras 8 jornadas ----------
 let b2=0,n2=0,bEarly=0,nEarly=0;
 for(let r=0;r<8;r++){const x=await playRound(S2.filter(f=>f.r===r),{study:2});b2+=x.B;n2+=x.n;if(r<4){bEarly+=x.B;nEarly+=x.n;} chk(x.live===9,`época 2 jornada ${r+1}: ${x.live} jogos no radar`);
  if(r===0&&hasProf){ const ben=x.rows.find(([m])=>/Benfica|Viseu|Leix/.test(m.home+m.away)); if(ben){const [m]=ben; w.fmGo('jogos'); w.openMatchIdx(w.eval('matches').indexOf(m)); const b=w.document.querySelector('#studyBox button'); if(b) await w.studyInModal(b); const txt=w.document.getElementById('studyBox').textContent.replace(/\s+/g,' '); const pm=txt.match(/🧬.{0,600}/); console.log('\nJORNADA 1 de 2027/28 —',m.home,'vs',m.away,'\n  ',pm?pm[0]:'(sem bloco de perfil)'); const bm=txt.match(/.{0,30}(NaN|undefined|Infinity).{0,20}/); if(bm) bad.push('perfil: «'+bm[0]+'»'); w.closeModal();}}
 }
 if(hasP()){const q1=sumAB(34,38),q2=sumAB(38,42); console.log('A/B época 2 j1–4:',q1.map(x=>(x/36).toFixed(4)).join(' / '),'| j5–8:',q2.map(x=>(x/36).toFixed(4)).join(' / '));}
 console.log(`\nÉPOCA 2 · jornadas 1–4: Brier ${(bEarly/nEarly).toFixed(4)} · jornadas 1–8: ${(b2/n2).toFixed(4)}  (menor = melhor; ao calhas ≈ 0.667)`);
 if(hasProf){ const P=w.prof(); const promo=Object.values(P.teams).filter(t=>/Viseu|Leix/.test(t.name)).map(t=>w.teamProfile(t)); promo.forEach(p=>console.log('  promovido',p.t.name,'→',p.prior.src,'| tags',p.tags.join(' '))); chk(promo.some(p=>p.prior.promoted),'promovidos não detetados');
  const ben=w.teamProfile(w.profFind('Benfica')); console.log('  Benfica plantel',JSON.stringify(ben.sq.list.map(s=>s.txt)),'raw',ben.sq.raw,'efeito agora',ben.sq.eff.toFixed(3),'(n',ben.n+')'); console.log('  época do perfil:',P.season,'| aprendizagem depois da viragem n=',w.learnLoad().n.toFixed(0));
  ['portal','jogos','ze','config'].forEach(v=>{w.fmGo(v);const t=w.document.getElementById('view-'+v)?.textContent||'';const mm=t.match(/.{0,40}(NaN|undefined|Infinity).{0,30}/);if(mm)bad.push(v+': «'+mm[0].replace(/\s+/g,' ')+'»');});
  const sz=w.localStorage.getItem('ze_teams_v1').length; console.log('  ze_teams_v1',(sz/1024).toFixed(1),'KB');
 }
}catch(e){errs.push('EXC '+e.stack)}
 console.log('\n=== PROBLEMAS ===');console.log(bad.concat(errs).join('\n')||'NENHUM');process.exit(0);},500);
