const __mz=u=>{u=decodeURIComponent(String(u)); return u.replace(/dates=(\d{4})(\d{2})?(?=&|$)/,(m,y,mo)=>{ if(mo){const last=new Date(Date.UTC(+y,+mo,0)).getUTCDate(); return 'dates='+y+mo+'01-'+y+mo+String(last).padStart(2,'0');} return 'dates='+y+'0101-'+y+'1231';});};
// Época inteira simulada: Liga Portugal fictícia (18 equipas, 34 jornadas), relógio a andar de ago/2026 a jun/2027, e depois nov/2027
const {JSDOM, VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const FILE=process.argv[2]||'/home/claude/work/dossie_do_dia_v50.html';
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push('JSERR '+e.message+' '+((e.detail&&e.detail.stack)||'').split('\n').slice(0,3).join(' | ')));
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
const w=dom.window; const wait=ms=>new Promise(r=>setTimeout(r,ms)); try{w.eval('zePrevSeasonAuto=async()=>false; zeEuroRefresh=async()=>false;')}catch(e){}
const bad=[];const chk=(c,msg)=>{if(!c&&bad.length<40)bad.push(msg);};
const lsSize=()=>{let t=0;const per={};for(let i=0;i<w.localStorage.length;i++){const k=w.localStorage.key(i);const v=w.localStorage.getItem(k);t+=k.length+v.length;const g=k.replace(/^(ze_odds_).*/,'$1*');per[g]=(per[g]||0)+k.length+v.length;}return {t,per};};

const say=async q=>{w.document.getElementById('chatInput').value=q;w.enviarChat();await wait(60);const b=[...w.document.querySelectorAll('#chatLog .cmsg.bot .bubble')].pop();return b?b.textContent.replace(/\s+/g,' ').trim():'';};
setTimeout(async()=>{try{
 console.log('LOAD ERRS',errs.join('\n')); w.localStorage.clear();
 // 3 jornadas para haver perfis e jogos ao vivo
 for(let r=0;r<3;r++){const fx=FIX.filter(f=>f.r===r);NOW=Math.max(...fx.map(f=>f.t))+1.2*864e5;await w.atualizarTudo({quiet:true});}
 const fx3=FIX.filter(f=>f.r===3); NOW=Math.min(...fx3.map(f=>f.t))-1.5*864e5; await w.atualizarTudo({quiet:true});
 console.log('MONEY:',['40 milhões','€12.5m','12,00 M €','£30m','500 mil €','1,20 mil milhões €','Custo zero','1,5 bi €','18,00 mi. €'].map(x=>x+' → '+w.parseMoney(x)).join(' | '));
 chk(w.parseMoney('40 milhões')===40&&w.parseMoney('£30m')===35.1&&w.parseMoney('500 mil €')===0.5&&w.parseMoney('12,00 M €')===12,'parseMoney');
 console.log('JANELA hoje:',w.windowTxt().replace(/<[^>]+>/g,''),'| 20 jul:',w.windowTxt(w.transferWindow(new RealDate(2027,6,20))).replace(/<[^>]+>/g,''),'| 15 jan:',w.windowTxt(w.transferWindow(new RealDate(2027,0,15))).replace(/<[^>]+>/g,''));
 const M=w.eval('matches'); const bm=M.find(m=>m.live&&/Benfica/.test(m.home+m.away)); const lam0=w.modelo(bm); console.log('\nJOGO',bm.home,'vs',bm.away,'λ antes',lam0.lh,lam0.la);
 w.fmGo('ze');
 for(const q of ['O Benfica vendeu Pavlidis ao FC Porto por 40 milhões','Sporting CP contratou Fulano Silva ao SC Braga por 15M','O Benfica perdeu com o FC Porto','Benfica 2-1 FC Porto','Gil Vicente foi buscar Rúben Lopes por empréstimo','Benfica contratou Zé Carlos a custo zero','transferências do Benfica','quando abre o mercado?']){ console.log('» '+q+'\n   '+(await say(q)).slice(0,260)); }
 const ben=w.profFind('Benfica'); chk(ben.squad.filter(e=>e.dir).length===2,'Benfica devia ter 2 transferências (venda + custo zero), tem '+ben.squad.length);
 const por=w.profFind('FC Porto'); chk(por.squad.some(e=>e.dir==='in'&&/Pavlidis/.test(e.player)),'Porto sem Pavlidis');
 const lam1=w.modelo(w.eval('matches').find(m=>m.live&&m.home===bm.home&&m.away===bm.away)); console.log('λ depois das transferências',lam1.lh,lam1.la); chk((bm.home==='Benfica'?lam1.lh<lam0.lh:lam1.la<lam0.la),'venda do Benfica não baixou os golos esperados');
 // print de página de transferências (texto como sai do OCR)
 const TM=`Sporting CP - Transferências 26/27
Chegadas
Fulano Silva Médio Centro 24 SC Braga 15,00 M €
Kevin Okafor Extremo Esquerdo 21 Nigéria Custo zero
João Duarte Defesa Central 27 Famalicão Empréstimo
Saídas
Viktor Novak Ponta de Lança 26 Inglaterra 65,00 M €
Mário Neto Guarda-Redes 33 Estoril Custo zero
Total 140,00 M € 65,00 M €`;
 w.parseAny(TM); const h=w.batchHTML([]); console.log('\nPRINT transferências →',h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,420));
 const log=w.document.getElementById('chatLog'); const d=w.document.createElement('div'); d.innerHTML=h; log.appendChild(d); w.transferDraftSave(); await wait(30);
 console.log('   guardado →',[...log.querySelectorAll('.cmsg.bot .bubble')].pop().textContent.replace(/\s+/g,' ').slice(0,260));
 const sp=w.profFind('Sporting CP'); console.log('   Sporting saldo',JSON.stringify(w.netSpend(sp)),'| tags',w.teamProfile(sp).tags.join(' '));
 chk(sp.squad.filter(e=>e.src==='print').length===4&&sp.squad.filter(e=>/Fulano/.test(e.player||'')&&e.dir==='in').length===1,'print: esperava 4 novas + Fulano Silva sem duplicar');
 // print da tabela de valores da liga
 const VAL='Liga Portugal - Valor de mercado\n'+NAMES.map((n,i)=>`${i+1} ${n} 28 26,4 ${Math.max(20,Math.round(400/(i+1)))},00 M € ${(10/(i+1)).toFixed(2)} M €`).join('\n');
 w.parseAny(VAL); const hv=w.batchHTML([]); const d2=w.document.createElement('div'); d2.innerHTML=hv; log.appendChild(d2); w.transferDraftSave(); await wait(30);
 console.log('\nPRINT valores →',[...log.querySelectorAll('.cmsg.bot .bubble')].pop().textContent.trim(),'|',Object.keys(w.prof().values||{}).length,'equipas');
 const bp=w.teamProfile(w.profFind('Benfica')), al=w.teamProfile(w.profFind('Alverca')); console.log('   Benfica plantel:',bp.sq.list.map(e=>e.txt+' '+(e.v*100).toFixed(1)+'%').join(' · '),'| tags',bp.tags.join(' '));
 console.log('   Alverca:',al.sq.list.map(e=>e.txt+' '+(e.v*100).toFixed(1)+'%').join(' · '));
 chk(w.prof().values && Object.keys(w.prof().values).length>=17,'valores não guardados');
 console.log('   chat «valor do plantel do Benfica é 380 milhões» →',(await say('valor do plantel do Benfica é 380 milhões')).slice(0,200));
 const mB=w.eval('matches').find(m=>m.live&&/Benfica/.test(m.home+m.away)); const its=[{title:'Benfica contrata Kokcu ao Feyenoord por 25 milhões',source:'Record',link:'https://x/1',date:new Date().toUTCString()},{title:'Benfica vence e convence',source:'A Bola',link:'https://x/2',date:new Date().toUTCString()}]; const sg=w.newsSignals(mB,its).filter(s=>s.k==='transfer'); console.log('\nJORNAL:',JSON.stringify(sg.map(s=>[s.label,s.player,s.side,s.fee]))); chk(sg.length===1&&sg[0].player==='Kokcu'&&sg[0].fee===25,'sinal de mercado no jornal');
 // decaimento: avança 10 jornadas e vê o efeito
 w.eval('zePrevSeasonAuto=async()=>false; zeEuroRefresh=async()=>false;'); /* datas falsas do teste ≠ época real */
 const eff0=w.squadDelta(w.profFind('Benfica')).eff;
 for(let r=3;r<13;r++){const fx=FIX.filter(f=>f.r===r);NOW=Math.max(...fx.map(f=>f.t))+1.2*864e5;await w.atualizarTudo({quiet:true});}
 const eff1=w.squadDelta(w.profFind('Benfica')).eff; console.log('\nefeito do plantel do Benfica: agora',(eff0*100).toFixed(1)+'% → 10 jornadas depois',(eff1*100).toFixed(1)+'%'); chk(Math.abs(eff1)<Math.abs(eff0),'efeito não decai');
 w.fmGo('config'); const cfg=w.document.getElementById('cfgTeams').textContent.replace(/\s+/g,' '); console.log('\nPAINEL:',cfg.slice(0,520));
 ['portal','jogos','ze','config','banca'].forEach(v=>{w.fmGo(v);const t=w.document.getElementById('view-'+v)?.textContent||'';const mm=t.match(/.{0,40}(NaN|undefined|Infinity).{0,30}/);if(mm)bad.push(v+': «'+mm[0].replace(/\s+/g,' ')+'»');});
}catch(e){errs.push('EXC '+e.stack)}
 console.log('\n=== PROBLEMAS ===');console.log(bad.concat(errs).join('\n')||'NENHUM');process.exit(0);},500);
