const {JSDOM,VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push('JSERR '+e.message));
const RealDate=Date; const NOW=RealDate.UTC(2026,10,3,12,49);
const dom=new JSDOM(fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8'),{runScripts:'dangerously',virtualConsole:vc,url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){class FD extends RealDate{constructor(...a){if(!a.length)super(NOW);else super(...a);} static now(){return NOW;}} w.Date=FD; w.scrollTo=()=>{};w.fetch=async()=>{throw new TypeError('x')}}});
setTimeout(()=>{const w=dom.window;try{
 for(let i=1;i<=11;i++){ const t=fs.readFileSync(__dirname+'/ocr/tip'+i+'.txt','utf8'); const r=w.parseTipCards(t); if(!r){console.log('tip'+i,'NADA');continue;}
  console.log(`tip${i} dia ${r.date&&r.date.getDate()} · ${r.cards.length} cartões`); r.cards.forEach(c=>console.log(`   ${c.done?(c.won===true?'✅':c.won===false?'❌':'•'):'⏳'} ${c.home} [${c.score}] ${c.away} | ${c.pick} → ${c.sel} @${c.odd}${c.sport?' ('+c.sport+')':''}`)); }
}catch(e){errs.push(e.stack)} console.log(errs.join('\n')||'NO ERRORS');},500);
