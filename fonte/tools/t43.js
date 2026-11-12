const {JSDOM,VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const HTML=fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8');
const bad=[],chk=(c,m)=>{if(!c)bad.push(m)}; const errs=[]; const log=[];
const vc=new VirtualConsole(); vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://juliomcm-tech.github.io/mister-ze/',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.scrollTo=()=>{}; w.__calNow=false;
  w.fetch=async(u)=>{u=String(u); log.push(u);
    const J=(o,s=200)=>({ok:s<300,status:s,json:async()=>o,text:async()=>JSON.stringify(o)});
    if(u.startsWith('https://api.rss2json.com')){ const f=decodeURIComponent(u.split('rss_url=')[1]);
      if(/bing\.com\/news/.test(f)) return J({status:'ok',items:[{title:'Benfica: Otamendi lesionado, falha jogo com o Porto',link:'http://www.bing.com/news/apiclick.aspx?ref=FexRss&url=https%3a%2f%2fwww.record.pt%2fx&c=1',pubDate:new Date(Date.now()-3600e3).toISOString().slice(0,19).replace('T',' '),author:'Record'},{title:'Porto prepara receção ao Benfica',link:'https://www.ojogo.pt/y',pubDate:new Date().toISOString().slice(0,19).replace('T',' '),author:''}]});
      if(/youtube/.test(f)) return J({status:'ok',feed:{title:'Fabrizio Romano'},items:[{title:'HERE WE GO! Gyökeres to Arsenal, done deal',link:'https://www.youtube.com/watch?v=abc',pubDate:new Date().toISOString().slice(0,19).replace('T',' ')}]});
      return J({status:'error',message:'x'},422);}
    if(/espn\.com.*por\.2/.test(u)) return {ok:false,status:400,text:async()=>'{"code":400}',json:async()=>({})};
    if(/espn\.com/.test(u)) return J({events:[],leagues:[]});
    throw new TypeError('Failed to fetch');}
}});
const w=dom.window;
setTimeout(async()=>{try{dom.window.eval("CAL_STATIC.forEach(m=>{m.calSt='ok';if(m.aviso===CAL_PENDING_TXT)m.aviso=m._orig.aviso||null;delete m.calNote;if(!matches.includes(m))matches.push(m)})");
  // 1) notícias via Bing
  const txt=await w.fetchText('https://news.google.com/rss/search?q='+encodeURIComponent('Benfica lesão when:4d')+'&hl=pt-PT&gl=PT&ceid=PT:pt-150');
  const items=w.parseRSS(txt); console.log('news',items.length,JSON.stringify(items[0]));
  chk(items.length===2,'2 notícias'); chk(items[0].link==='https://www.record.pt/x','link bing desembrulhado'); chk(/Record/.test(items[0].source||''),'fonte');
  chk(log.some(u=>/bing\.com%2Fnews%2Fsearch%3Fq%3DBenfica%2520les%25C3%25A3o%2520futebol%26format%3Drss%26mkt%3Dpt-PT/.test(u)),'url bing pt-PT sem when: '+log.filter(u=>/rss2json/.test(u))[0]);
  // 2) YouTube
  const yt=await w.ytFetch(true); console.log('yt',yt.length,yt[0]&&yt[0].title);
  chk(yt.some(x=>/Gy.keres/.test(x.title)),'yt via rss2json');
  // 3) por.2 → 400 → fica de fora
  w.eval('ESPN_OK_AT=Date.now()');
  const n0=log.length; const r1=await w.espnScoreboard('https://site.api.espn.com/apis/site/v2/sports/soccer/por.2/scoreboard?dates=20261101-20261110&limit=300');
  const used=log.length-n0; const n1=log.length; await w.espnScoreboard('https://site.api.espn.com/apis/site/v2/sports/soccer/por.2/scoreboard?dates=20261101-20261110&limit=300');
  console.log('por.2 pedidos 1.ª vez',used,'2.ª vez',log.length-n1, JSON.stringify(w.lsGet('ze_espn_bad',{})));
  chk(used<=2,'por.2 poucos pedidos'); chk(log.length-n1===0,'por.2 não insiste'); chk((r1.events||[]).length===0,'vazio');
  // 4) estudo de jogo com notícias
  const M=w.eval('matches'); const m=M.find(x=>/Benfica|Porto|Sporting/.test(x.home+x.away))||M[0];
  const t0=Date.now(); const nw=await w.zeNews(m); console.log('zeNews',m.home,m.away,(nw.items||[]).length,'itens',Date.now()-t0,'ms',nw.err||'');
  chk(!nw.err,'zeNews sem erro');
}catch(e){bad.push('EXC '+e.stack)}
 console.log(errs.length?'ERRS '+errs.join(' | '):'NO ERRORS'); console.log('=== PROBLEMAS ===\n'+(bad.join('\n')||'NENHUM')); process.exit(0);},2500);
