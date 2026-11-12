const __mz=u=>{u=decodeURIComponent(String(u)); return u.replace(/dates=(\d{4})(\d{2})?(?=&|$)/,(m,y,mo)=>{ if(mo){const last=new Date(Date.UTC(+y,+mo,0)).getUTCDate(); return 'dates='+y+mo+'01-'+y+mo+String(last).padStart(2,'0');} return 'dates='+y+'0101-'+y+'1231';});};
// Época inteira simulada: Liga Portugal fictícia (18 equipas, 34 jornadas), relógio a andar de ago/2026 a jun/2027, e depois nov/2027
const {JSDOM, VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const FILE=process.argv[2]||'/home/claude/work/dossie_do_dia_v50.html';
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push('JSERR '+e.message));
let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const pois=l=>{let L=Math.exp(-l),k=0,p=1;do{k++;p*=rnd();}while(p>L);return k-1;};
const NAMES=['Benfica','FC Porto','Sporting CP','SC Braga','Vitória SC','Famalicão','Gil Vicente','Moreirense','Rio Ave','Estoril','Casa Pia','Arouca','Santa Clara','Nacional','Estrela Amadora','AVS','Tondela','Alverca'];
// força verdadeira: casa/fora diferentes (algumas equipas muito fortes em casa)
const TEAMS=NAMES.map((n,i)=>{const q=i<3?1.9-i*0.1:i<5?1.3:1.0-0.02*i+rnd()*0.2; const homeBoost=[4,9,13].includes(i)?1.45:1.12; return {id:String(7000+i),n,att:q,def:1/q,hb:homeBoost};});
// calendário duplo round-robin
const rounds=[];{const ids=TEAMS.map((_,i)=>i);const n=ids.length;let arr=ids.slice();for(let r=0;r<n-1;r++){const ps=[];for(let k=0;k<n/2;k++){const a=arr[k],b=arr[n-1-k];ps.push(r%2?[b,a]:[a,b]);}rounds.push(ps);arr=[arr[0],arr[n-1],...arr.slice(1,n-1)];}rounds.push(...rounds.map(ps=>ps.map(([a,b])=>[b,a])));}
const start=Date.UTC(2026,7,15,18,0); // sáb 15 ago 2026
const FIX=[];rounds.forEach((ps,r)=>{let t=start+r*7*864e5; if(r>=17) t+=2*7*864e5; /* pausa de Natal */ ps.forEach(([h,a],k)=>{const H=TEAMS[h],A=TEAMS[a];const lh=1.25*H.att*H.hb*A.def, la=1.05*A.att*H.def; FIX.push({id:'e'+r+'_'+k,r,t:t+(k%3)*3600e3*(k%2?24:2.5),h:H,a:A,lh,la,hg:pois(lh),ag:pois(la)});});});
let NOW=Date.UTC(2026,7,10,10,0);
const RealDate=Date;
const iso=t=>new RealDate(t).toISOString();
const evJSON=(f)=>{const done=f.t+2*3600e3<NOW;return {id:f.id,date:iso(f.t),status:{type:{completed:done,state:done?'post':'pre'}},competitions:[{competitors:[{homeAway:'home',team:{id:f.h.id,displayName:f.h.n,shortDisplayName:f.h.n,abbreviation:f.h.n.slice(0,3).toUpperCase(),color:'225588'},score:done?String(f.hg):undefined},{homeAway:'away',team:{id:f.a.id,displayName:f.a.n,shortDisplayName:f.a.n,abbreviation:f.a.n.slice(0,3).toUpperCase(),color:'882222'},score:done?String(f.ag):undefined}],details:[]}]};};
const standings=()=>{const T={};TEAMS.forEach(t=>T[t.id]={gp:0,gf:0,ga:0,pts:0});FIX.filter(f=>f.t+2*3600e3<NOW).forEach(f=>{const H=T[f.h.id],A=T[f.a.id];H.gp++;A.gp++;H.gf+=f.hg;H.ga+=f.ag;A.gf+=f.ag;A.ga+=f.hg;if(f.hg>f.ag)H.pts+=3;else if(f.hg<f.ag)A.pts+=3;else{H.pts++;A.pts++;}});return {children:[{standings:{entries:TEAMS.map(t=>({team:{id:t.id,displayName:t.n},stats:[{name:'gamesPlayed',value:T[t.id].gp},{name:'pointsFor',value:T[t.id].gf},{name:'pointsAgainst',value:T[t.id].ga},{name:'points',value:T[t.id].pts}]}))}}]};};
const odds=f=>{let p1=0,pX=0;const P=(l,k)=>Math.exp(-l)*l**k/[1,1,2,6,24,120,720,5040][k];for(let i=0;i<8;i++)for(let j=0;j<8;j++){const q=P(f.lh,i)*P(f.la,j);if(i>j)p1+=q;else if(i===j)pX+=q;}const p2=1-p1-pX;const mg=1.06;const ML=d=>d>=2?Math.round((d-1)*100):Math.round(-100/(d-1));return {pickcenter:[{provider:{name:'ESPN BET'},overUnder:2.5,homeTeamOdds:{moneyLine:ML(1/(p1*mg))},drawOdds:{moneyLine:ML(1/(pX*mg))},awayTeamOdds:{moneyLine:ML(1/(p2*mg))},overOdds:-120,underOdds:100}],headToHeadGames:[],rosters:[]};};
let fetches=0;
const dom=new JSDOM(fs.readFileSync(FILE,'utf8'),{runScripts:'dangerously',virtualConsole:vc,url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){
 class FakeDate extends RealDate{constructor(...a){if(!a.length)super(NOW);else super(...a);} static now(){return NOW;}}
 w.Date=FakeDate; w.scrollTo=()=>{};w.alert=m=>errs.push('ALERT '+m);w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.fetch=async(u)=>{u=__mz(u);fetches++;u=decodeURIComponent(String(u));let m;const R=x=>({ok:true,json:async()=>x,text:async()=>JSON.stringify(x)});
  if(/news\.google/.test(u)) return {ok:true,text:async()=>'<rss><channel></channel></rss>',json:async()=>({})};
  if((m=u.match(/soccer\/([a-z.0-9]+)\/scoreboard\?dates=(\d{8})-(\d{8})/))){ if(m[1]!=='por.1') return R({events:[]}); const a=RealDate.UTC(+m[2].slice(0,4),+m[2].slice(4,6)-1,+m[2].slice(6)), b=RealDate.UTC(+m[3].slice(0,4),+m[3].slice(4,6)-1,+m[3].slice(6))+864e5; return R({events:FIX.filter(f=>f.t>=a&&f.t<b).map(evJSON)});}
  if((m=u.match(/soccer\/([a-z.0-9]+)\/scoreboard/))){ return R({events:[]}); }
  if(/por\.1\/standings/.test(u)) return R(standings());
  if((m=u.match(/teams\/(\d+)\/schedule/))) return R({events:FIX.filter(f=>(f.h.id===m[1]||f.a.id===m[1])).map(evJSON)});
  if((m=u.match(/summary\?event=([a-z0-9_]+)/))){const f=FIX.find(x=>x.id===m[1]);return R(f?odds(f):{});}
  if(/roster/.test(u)) return R({athletes:[]});
  return {ok:false,status:404,json:async()=>({}),text:async()=>''};};}});
const w=dom.window; const wait=ms=>new Promise(r=>setTimeout(r,ms));
const bad=[];const chk=(c,msg)=>{if(!c&&bad.length<40)bad.push(msg);};
const lsSize=()=>{let t=0;const per={};for(let i=0;i<w.localStorage.length;i++){const k=w.localStorage.key(i);const v=w.localStorage.getItem(k);t+=k.length+v.length;const g=k.replace(/^(ze_odds_).*/,'$1*');per[g]=(per[g]||0)+k.length+v.length;}return {t,per};};
setTimeout(async()=>{try{
 w.localStorage.clear(); w.__calNow=true;
 let week=0, tRefresh=0, nRefresh=0, betsYou=0, betsZe=0, settledSeen=0;
 const youStake={};
 for(let r=0;r<34;r++){
  const fx=FIX.filter(f=>f.r===r); const t0=Math.min(...fx.map(f=>f.t));
  NOW=t0-1.5*864e5; // quinta antes da jornada
  let a=RealDate.now(); await w.atualizarTudo({quiet:true}); await wait(30); tRefresh+=RealDate.now()-a; nRefresh++;
  const M=w.eval('matches'); const live=M.map((m,i)=>[m,i]).filter(([m])=>m.espn&&!m.past&&!m.aviso&&fx.some(f=>f.id===m.espn.ev));
  chk(live.length===9,`jornada ${r+1}: ${live.length} jogos no radar (esperava 9) em ${new RealDate(NOW).toISOString().slice(0,10)}`);
  // estuda 2, duelo em 3, tu apostas em 2
  for(const [m,i] of live.slice(0,2)){ w.fmGo('jogos'); w.openMatchIdx(i); const b=w.document.querySelector('#studyBox button'); if(b) await w.studyInModal(b); w.closeModal(); }
  for(const [m,i] of live.slice(2,5)){ w.prepararDuelo(i); await wait(5); if(!w.document.getElementById('odd_1')?.value){ ['1','X','2'].forEach((k,j)=>{const el=w.document.getElementById('odd_'+k); if(el) el.value=[2.1,3.3,3.4][j];}); } w.zeDecidirUI(); const d=w.eval('dueloAtual').decision; if(d&&d.pick){ w.confirmarDueloZe(); betsZe++; } }
  for(const [m,i] of live.slice(5,7)){ const r1=w.modelo(m); const fav=r1.mk['1']>r1.mk['2']; const sel=fav?m.home:m.away; const odd=+(1/(fav?r1.mk['1']:r1.mk['2'])*0.95).toFixed(2); w.addBet({match:m.home+' vs '+m.away,pick:sel+' vence',odd,stake:1,legs:[{home:m.home,away:m.away,sel,odd}]},'you'); betsYou++; }
  // segunda-feira depois: resultados
  NOW=Math.max(...fx.map(f=>f.t))+1.2*864e5;
  a=RealDate.now(); await w.atualizarTudo({quiet:true}); tRefresh+=RealDate.now()-a; nRefresh++;
  const B=w.loadBank(); const open=B.bets.concat(B.zeBets).filter(x=>x.status==='open');
  chk(open.length===0,`jornada ${r+1}: ${open.length} apostas por liquidar depois dos resultados (${open.map(x=>x.match+' '+x.date).slice(0,2).join(' | ')})`);
  chk(B.you>=0&&B.ze>=0,'saldo negativo');
  if(r%6===5||r===33){ const s=lsSize(); console.log(`J${String(r+1).padStart(2)} ${new RealDate(NOW).toISOString().slice(0,10)} · tu ${B.you.toFixed(2)}€ (${B.bets.length} apostas) · Zé ${B.ze.toFixed(2)}€ (${B.zeBets.length}) · armazenamento ${(s.t/1024).toFixed(0)} KB · aprendeu ${w.learnLoad().n} jogos · atualizar média ${(tRefresh/nRefresh).toFixed(0)} ms`); }
 }
 const s=lsSize(); console.log('\nARMAZENAMENTO no fim da época:',(s.t/1024).toFixed(0),'KB →',Object.entries(s.per).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>k+' '+(v/1024).toFixed(1)+'KB').join(' · '));
 const B=w.loadBank(); const L1=w.buildLedger(B,'you'),L2=w.buildLedger(B,'ze'); console.log('extratos reconciliados:',L1.reconciled,L2.reconciled); chk(L1.reconciled&&L2.reconciled,'extrato não reconcilia');
 ['portal','dia','duelo','jogos','scout','banca','ze','config'].forEach(v=>{w.fmGo(v);const t=w.document.getElementById('view-'+v)?.textContent||'';const mm=t.match(/.{0,40}(NaN|undefined|Infinity).{0,30}/);if(mm)bad.push('fim época '+v+': «'+mm[0].replace(/\s+/g,' ')+'»');});
 const lw=w.learnWeights(); console.log('aprendizagem: n',lw.L.n,'| peso do modelo vs mercado',lw.wModel.toFixed(2),'| skill',lw.skill&&lw.skill.toFixed(3));
 // ---------- viragem de época ----------
 const up=d=>{NOW=d;return w.upcoming(10).map(x=>x.m.home+'-'+x.m.away+' '+x.m.date+(x.m.live?'':' [dossiê]'));};
 console.log('\n15 jan 2027 · próximos (sem rede nova):',JSON.stringify(up(RealDate.UTC(2027,0,15,12)).slice(0,4)));
 const st=up(RealDate.UTC(2027,10,5,12)).filter(x=>/dossiê/.test(x)); console.log('5 nov 2027 · jogos do dossiê de 2026 a aparecer como «próximos»:',st.length,JSON.stringify(st.slice(0,3)));
 chk(st.length===0,'dossiê da época passada volta a aparecer na época seguinte');
 const dec=up(RealDate.UTC(2027,0,3,12)); 
 NOW=RealDate.UTC(2027,0,3,12); const pd=w.parseDayLabel('Dom 27 Dez'); console.log('em 3 jan 2027, «Dom 27 Dez» →',pd&&pd.toDateString()); chk(pd&&pd.getFullYear()===2026,'«27 Dez» lido como '+(pd&&pd.getFullYear()));
 console.log('pedidos de rede simulados:',fetches);
}catch(e){errs.push('EXC '+e.stack)}
 console.log('\n=== PROBLEMAS ===');console.log(bad.concat(errs).join('\n')||'NENHUM');process.exit(0);},500);
