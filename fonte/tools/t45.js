const {JSDOM,VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const HTML=fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8');
const bad=[],chk=(c,m)=>{if(!c)bad.push(m)}; const errs=[]; const log=[];
const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
const now=Date.now(), iso=k=>new Date(now+k*864e5).toISOString();
const T=(id,n,ab)=>({id,displayName:n,shortDisplayName:n,name:n,abbreviation:ab});
const EV=(id,d,h,a,st='pre',sc)=>({id,date:d,status:{type:{state:st,completed:st==='post'}},competitions:[{competitors:[{homeAway:'home',team:h,score:sc?String(sc[0]):undefined},{homeAway:'away',team:a,score:sc?String(sc[1]):undefined}]}]});
const BEN=T('1929','Benfica','BEN'),POR=T('437','FC Porto','POR'),CP=T('9999','Casa Pia','CPA'),ALV=T('8888','Alverca','ALV'),COMO=T('2572','Como','COM'),JUV=T('111','Juventus','JUV'),DER=T('374','Derby County','DER'),BOL=T('358','Bolton Wanderers','BOL'),CHA=T('372','Charlton Athletic','CHA');
const SB={'por.1':[EV('a1',iso(4),ALV,CP),EV('a2',iso(5),BEN,POR),EV('p1',iso(-7),BEN,CP,'post',[3,0]),EV('p2',iso(-14),POR,ALV,'post',[2,0]),EV('p3',iso(-21),CP,BEN,'post',[0,2]),EV('p4',iso(-28),ALV,POR,'post',[1,1])],
 'ita.1':[EV('c1',iso(3),COMO,JUV)],'eng.2':[EV('d1',iso(3),DER,BOL),EV('d2',iso(4),CHA,BOL)]};
const STAND={children:[{standings:{entries:[[BEN,25],[POR,27],[ALV,10],[CP,8]].map(([t,p])=>({team:t,stats:[{name:'gamesPlayed',value:10},{name:'pointsFor',value:p},{name:'pointsAgainst',value:8},{name:'points',value:p}]}))}}]};
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://juliomcm-tech.github.io/mister-ze/',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.scrollTo=()=>{};
  w.fetch=async(u,o)=>{u=String(u); log.push(u); const J=(x,s=200)=>({ok:s<300,status:s,json:async()=>x,text:async()=>JSON.stringify(x)});
    if(u.startsWith('https://api.rss2json.com')) return J({status:'error',message:'You are converting new feeds in a very short period, please use an API key'},429);
    if(u.startsWith('https://r.jina.ai/')){ const f=u.slice(18); const xml=/youtube/.test(f)?`<feed><title>Fabrizio Romano</title><entry><title>HERE WE GO! Gonçalo Ramos to Benfica, done deal</title><link rel="alternate" href="https://youtu.be/x"/><published>${new Date().toISOString()}</published></entry></feed>`:`<?xml version="1.0"?><rss xmlns:News="https://www.bing.com/news/search?q=x&format=rss"><channel><title>x</title><item><title>Benfica: Otamendi lesionado para o clássico</title><link>http://www.bing.com/news/apiclick.aspx?url=https%3a%2f%2fwww.record.pt%2fa</link><pubDate>${new Date().toUTCString()}</pubDate><News:Source>Record</News:Source></item></channel></rss>`;
      return {ok:true,status:200,text:async()=>xml,json:async()=>({})}; }
    let m; if((m=u.match(/soccer\/([a-z.0-9]+)\/scoreboard\?dates=(\d+)/))) return J({events:(SB[m[1]]||[])});
    if(/por\.1\/standings/.test(u)) return J(STAND);
    if(/standings/.test(u)) return J({});
    return J({},404);}
}});
const w=dom.window; const say=async q=>{let r=w.zeTalk(q); let h=r&&r.html||''; if(r&&r.later){const r2=await r.later(); h+=' → '+(r2&&r2.html||'');} return h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();};
setTimeout(async()=>{try{
  await w.atualizarTudo();
  w.eval(`[['Benfica','FC Porto','por.1','1929','437',5,'Liga Portugal'],['Como','Juventus','ita.1','2572','111',3,'Serie A'],['Derby County','Bolton Wanderers','eng.2','374','358',3,'Championship'],['Charlton Athletic','Bolton Wanderers','eng.2','372','358',4,'Championship']].forEach(([h,a,c,hi,ai,d,lg])=>{ if(matches.some(m=>m.home===h&&m.away===a)) return; const dt=new Date(Date.now()+d*864e5); matches.push({phase:'imediato',type:'best',fav:false,live:true,home:h,away:a,date:dayLabel(dt),league:lg,h2h:'—',team:h,stats:'',prob:'~50%',analysis:'',note:'',risk:false,lambdas:{lh:1.5,la:1.1},espn:{h:hi,a:ai,code:c,ev:'e'+hi},bet:'—',kickoff:'20:00'}); })`);
  const M=w.eval('matches'); console.log('jogos',M.filter(m=>m.live).map(m=>m.home+'-'+m.away).join(', '));
  // notícias com o rss2json a recusar
  try{ const r=await w.eval('timedFetch')('https://r.jina.ai/https://www.bing.com/news/search?q=B&format=rss',8000,{headers:{'X-Return-Format':'html'}}); const t=await r.text(); console.log('jina',r.ok,t.slice(0,60)); console.log('parse',JSON.stringify(w.eval('xmlToItems')(t)).slice(0,200)); }catch(e){console.log('dbg ERR',e.stack)}
  try{ const jj=await w.rssJson('https://www.bing.com/news/search?q=Benfica&format=rss'); console.log('rssJson',JSON.stringify(jj).slice(0,200)); }catch(e){console.log('rssJson ERR',e.message)}
  const m=M.find(x=>x.home==='Benfica'); const nw=await w.zeNews(m); console.log('notícias',nw.items.length,nw.err||'',JSON.stringify(nw.items[0]||{}).slice(0,160));
  chk(nw.items.length>=1&&!nw.err,'notícias via jina'); chk(nw.items[0]&&nw.items[0].link==='https://www.record.pt/a','link desembrulhado');
  const nR2J=log.filter(u=>u.includes('rss2json')).length; console.log('pedidos rss2json',nR2J,'jina',log.filter(u=>u.includes('jina')).length);
  chk(nR2J<=2,'rss2json em pausa depois do 429');
  const nw2=await w.zeNews(m); const before=log.length; await w.zeNews(m); console.log('2.ª vez novos pedidos:',log.slice(before).map(u=>u.slice(0,90)).join(' | ')); chk(log.slice(before).filter(u=>/jina|rss2json/.test(u)).length<=2,'2.ª vez vem da memória');
  // chat
  w.eval('zeLastMatch=matches.find(m=>m.home==="Derby County")');
  let h=await say('casa vence'); console.log('casa vence →',h.slice(0,90)); chk(!/Casa Pia/.test(h)||/Derby/.test(h),'casa vence não salta para o Casa Pia');
  h=await say('como está o duelo'); console.log('como está o duelo →',h.slice(0,90)); chk(!/\bComo\b.*em casa/.test(h),'como ≠ Como');
  h=await say('o que achas do derby charlton bolton'); console.log('derby →',h.slice(0,100)); chk(/Charlton/.test(h),'derby charlton bolton → Charlton');
  h=await say('e o Como vs Juventus?'); console.log('Como →',h.slice(0,80)); chk(/Como/.test(h),'Como a sério reconhecido');
  const P0=JSON.stringify(w.eval('prof().teams')).length;
  h=await say('quem é mais forte benfica ou porto?'); console.log('compara →',h.slice(0,200)); chk(/Só respondi/.test(h),'comparação'); chk(/FC Porto/.test(h)&&/Mais forte agora|parecidos/.test(h),'comparação usa a classificação'); chk(!/Registei/.test(h),'não regista');
  chk(!JSON.stringify(w.eval('prof().teams')).includes('plantel mais forte'),'força não mudou');
  h=await say('classificação liga portugal'); console.log('classificação →',h.slice(0,160)); chk(/Liga Portugal/.test(h)&&/FC Porto/.test(h)&&h.indexOf('FC Porto')<h.indexOf('Benfica'),'tabela ordenada');
  h=await say('em que lugar está o benfica'); chk(/Benfica/.test(h)&&/1\.|2\./.test(h),'lugar do benfica');
  h=await say('transferências benfica'); console.log('transf →',h.slice(0,120)); chk(/Benfica/.test(h)&&!/Lech|Dossiê: /.test(h),'transferências benfica');
  h=await say('mercado'); console.log('mercado →',h.slice(0,160)); chk(/Mercado/.test(h),'mercado');
  h=await say('odds juventus'); h=await say('odds villarreal'); console.log('odds villarreal →',h.slice(0,120)); chk(!/Derby|Benfica|Charlton|Como/.test(h)||/Não encontro/.test(h),'odds de equipa sem jogo');
  // versão
  w.fmGo('config'); chk(/v72/.test(w.document.getElementById('appVer')?.textContent||''),'versão nas definições');
}catch(e){bad.push('EXC '+e.stack)}
 console.log(errs.length?'ERRS '+errs.join(' | '):'NO ERRORS'); console.log('=== PROBLEMAS ===\n'+(bad.join('\n')||'NENHUM')); process.exit(0);},2000);
