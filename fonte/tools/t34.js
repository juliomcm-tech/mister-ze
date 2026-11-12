const {JSDOM,VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push('JSERR '+e.message));
const FILE=process.argv[2]||'/home/claude/work/dossie_do_dia_v50.html';
const TXT=fs.readFileSync(__dirname+'/ocr/phone.txt','utf8');
const dom=new JSDOM(fs.readFileSync(FILE,'utf8'),{runScripts:'dangerously',virtualConsole:vc,url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){w.scrollTo=()=>{};w.alert=m=>errs.push('ALERT '+m);w.HTMLElement.prototype.scrollIntoView=()=>{};w.fetch=async()=>{throw new TypeError('offline')}}});
setTimeout(()=>{const w=dom.window;try{
 const s=w.parseAny(TXT); s.legs.forEach(w.snapSel);
 console.log('legs',s.legs.length,'| totalOdd',s.totalOdd,'| stake',s.stake,'| declared',s.declared,'| source',w.detectSource(TXT));
 s.legs.forEach((l,i)=>console.log(' ',i+1,JSON.stringify({home:l.home,away:l.away,sel:l.sel,odd:l.odd,market:l.market})));
 // condições de liquidação para 3 resultados
 const l=s.legs[0]; if(l){ const c=w.selConds(l.sel||'',{home:l.home||'A',away:l.away||'B'}); console.log('liquidação 2-1:',c&&c.every(f=>f(2,1)),'| 3-0:',c&&c.every(f=>f(3,0)),'| 1-1:',c&&c.every(f=>f(1,1))); }
}catch(e){errs.push(e.stack)} console.log(errs.join('\n')||'NO ERRORS');},500);
