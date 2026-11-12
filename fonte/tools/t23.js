const __mz=u=>{u=decodeURIComponent(String(u)); return u.replace(/dates=(\d{4})(\d{2})?(?=&|$)/,(m,y,mo)=>{ if(mo){const last=new Date(Date.UTC(+y,+mo,0)).getUTCDate(); return 'dates='+y+mo+'01-'+y+mo+String(last).padStart(2,'0');} return 'dates='+y+'0101-'+y+'1231';});};
const {JSDOM, VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(e.message));
const RSS=(items)=>'<?xml version="1.0"?><rss><channel>'+items.map(([t,src,h])=>`<item><title>${t} - ${src}</title><link>https://news.example/${encodeURIComponent(t)}</link><pubDate>${new Date(Date.now()-h*3600e3).toUTCString()}</pubDate><source url="https://x">${src}</source></item>`).join('')+'</channel></rss>';
const FEEDS={
 'ES:es': RSS([['Nico Williams, baja ante el Espanyol por lesión','Marca',6],['El Athletic hará rotaciones pensando en la Europa League','AS',9],['Puado sancionado: no jugará en San Mamés','Mundo Deportivo',12]]),
 'GB:en': RSS([['Athletic Club v Espanyol: team news and predictions','Sports Mole',5],['Inter: Lautaro Martinez ruled out of Venezia clash with hamstring injury','Football Italia',4],['Man City boss: Haaland a doubt for derby','BBC Sport',3],['Man United sack manager after derby defeat','Sky Sports',7]]),
 'IT:it': RSS([['Inter, Thuram in dubbio per il Venezia','Gazzetta',8],['Venezia, squalificato il difensore Idzes','Corriere dello Sport',10]]),
 'PT:pt-150': RSS([['Athletic Bilbao recebe Espanyol','Record',5]])
};
const dom=new JSDOM(fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8'),{runScripts:'dangerously',virtualConsole:vc,url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){w.scrollTo=()=>{};w.alert=m=>errs.push('ALERT '+m);w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.fetch=async(u)=>{u=__mz(u);u=decodeURIComponent(String(u)); const m=u.match(/ceid=([A-Z]{2}:[a-z0-9-]+)/); if(/news\.google/.test(u)&&m) return {ok:true,text:async()=>FEEDS[m[1]]||RSS([]),json:async()=>({})}; throw new TypeError('offline');};}});
const w=dom.window;
setTimeout(async()=>{try{
 const M=w.eval('matches');
 console.log('KB Man United →', JSON.stringify((w.getTeamKB('Man United')||{}).marcadores||null), '| Man City →', JSON.stringify((w.getTeamKB('Man City')||{}).marcadores||null), '| Benfica →', !!w.getTeamKB('SL Benfica'));
 for (const pair of [['Athletic','Espanyol'],['Inter','Venezia'],['Man City','Man United']]) {
  const m=M.find(x=>x.home===pair[0]&&x.away===pair[1]); if(!m){console.log('no match',pair);continue;}
  const n=await w.zeNews(m);
  console.log(`\n${m.home} vs ${m.away} (${m.league}) editions ${n.editions.join('')} items ${n.items.length}`);
  n.signals.forEach(s=>console.log('  ',s.label,'|',s.player||'-','|',s.side,'|',n.items[s.i].flag,n.items[s.i].source));
 }
}catch(e){errs.push(e.stack)} console.log(errs.join('\n')||'NO ERRORS');},400);
