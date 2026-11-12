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
const ago=h=>new RealDate(NOW-h*3600e3).toISOString();
const ATOM=()=>`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015"><title>Fabrizio Romano</title>${[
 ['Pavlidis to FC Porto, here we go! 🚨',3],['Benfica sign Kokcu from Feyenoord for €25m, here we go!',5],['Why Liverpool want Rafael Leão',8],['Sporting CP agree deal for Fulano Silva',10],['OFFICIAL: Viktor Novak joins Arsenal from Sporting CP',12],['My thoughts on the Champions League',14]
].map(([t,h],i)=>`<entry><id>yt:video:v${i}</id><title>${t}</title><link rel="alternate" href="https://www.youtube.com/watch?v=v${i}"/><published>${ago(h)}</published></entry>`).join('')}</feed>`;

const dom=new JSDOM(fs.readFileSync(FILE,'utf8'),{runScripts:'dangerously',virtualConsole:vc,url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){
 class FakeDate extends RealDate{constructor(...a){if(!a.length)super(NOW);else super(...a);} static now(){return NOW;}}
 w.Date=FakeDate; w.scrollTo=()=>{};w.alert=m=>errs.push('ALERT '+m);w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.fetch=async(u)=>{u=__mz(u);fetches++;u=decodeURIComponent(String(u));let m;const R=x=>({ok:true,json:async()=>x,text:async()=>JSON.stringify(x)});
  if(/youtube\.com\/feeds/.test(u)) return {ok:true,text:async()=>ATOM(),json:async()=>({})};
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


const say=async (q,ms)=>{w.document.getElementById('chatInput').value=q;w.enviarChat();await wait(ms||60);const b=[...w.document.querySelectorAll('#chatLog .cmsg.bot .bubble')].pop();return b?b.textContent.replace(/\s+/g,' ').trim():'';};
setTimeout(async()=>{try{
 w.localStorage.clear();
 for(let r=0;r<3;r++){const fx=FIX.filter(f=>f.r===r);NOW=Math.max(...fx.map(f=>f.t))+1.2*864e5;await w.atualizarTudo({quiet:true});}
 const fx3=FIX.filter(f=>f.r===3); NOW=Math.min(...fx3.map(f=>f.t))-1.5*864e5; await w.atualizarTudo({quiet:true});
 ['Pavlidis to FC Porto, here we go! 🚨','Benfica sign Kokcu from Feyenoord for €25m, here we go!','Why Liverpool want Rafael Leão','Sporting CP agree deal for Fulano Silva','OFFICIAL: Viktor Novak joins Arsenal from Sporting CP'].forEach(t=>{const d=w.readDeal(t);console.log('«'+t+'» →',d?JSON.stringify({done:d.done,buyer:d.buyer,seller:d.seller,player:d.player,fee:d.fee}):'null');});
 const d1=w.readDeal('Benfica sign Kokcu from Feyenoord for €25m, here we go!'); chk(d1&&d1.done&&/Benfica/.test(d1.buyer)&&d1.player==='Kokcu'&&d1.fee===25,'Kokcu');
 const d2=w.readDeal('Pavlidis to FC Porto, here we go! 🚨'); chk(d2&&d2.done&&/Porto/.test(d2.buyer)&&d2.player==='Pavlidis','Pavlidis');
 const d3=w.readDeal('Why Liverpool want Rafael Leão'); chk(!d3||!d3.done,'rumor tratado como fechado'); const d5=w.readDeal('OFFICIAL: Viktor Novak joins Arsenal from Sporting CP'); chk(d5&&/Arsenal/.test(d5.buyer)&&/Sporting/.test(d5.seller),'Novak direção');
 // painel
 w.fmGo('config'); const btn=[...w.document.querySelectorAll('#cfgTeams button')].find(b=>/YouTube/.test(b.textContent)); chk(!!btn,'botão YouTube');
 await w.ytPanelLoad(btn); const box=w.document.getElementById('ytBox'); console.log('\nPAINEL YT:',box.textContent.replace(/\s+/g,' ').slice(0,600));
 const regs=[...box.querySelectorAll('button')]; console.log('botões registar:',regs.length);
 const kb=regs.find(b=>/Benfica/.test(b.textContent)); if(kb){kb.click(); await wait(30);} 
 const ben=w.profFind('Benfica'), fey=w.profFind('Feyenoord'); console.log('Benfica squad:',JSON.stringify((ben.squad||[]).map(e=>e.txt+' '+e.v)), '| Feyenoord:',fey?JSON.stringify(fey.squad.map(e=>e.txt)):'(sem perfil)');
 chk((ben.squad||[]).some(e=>e.src==='youtube'&&/Kokcu/.test(e.player)),'registo YouTube');
 // chat
 w.fmGo('ze'); const a=await say('novidades do mercado',300); console.log('\nCHAT:',a.slice(0,300));
 // notícias de um jogo do Benfica
 const mB=w.eval('matches').find(m=>m.live&&/Benfica/.test(m.home+m.away)); const n=await w.zeNews(mB); console.log('\nNOTÍCIAS',mB.home,'vs',mB.away,'edições',n.editions.join(''),'| itens yt',n.items.filter(x=>x.yt).length,'| sinais',JSON.stringify(n.signals.map(s=>[s.label,s.player,s.side])));
 chk(n.items.some(x=>x.yt),'YouTube não entrou nas notícias do jogo');
 ['portal','jogos','ze','config'].forEach(v=>{w.fmGo(v);const t=w.document.getElementById('view-'+v)?.textContent||'';const mm=t.match(/.{0,40}(NaN|undefined|Infinity).{0,30}/);if(mm)bad.push(v+': «'+mm[0].replace(/\s+/g,' ')+'»');});
}catch(e){errs.push('EXC '+e.stack)}
 console.log('\n=== PROBLEMAS ===');console.log(bad.concat(errs).join('\n')||'NENHUM');process.exit(0);},500);
