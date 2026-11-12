const {JSDOM}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const dom=new JSDOM(fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8'),{runScripts:'dangerously',url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){w.scrollTo=()=>{};w.fetch=async()=>{throw new TypeError('x')}}});
setTimeout(()=>{const w=dom.window;
const T=`Your Bets
Arsenal v Chelsea, Sat 15:00
Arsenal - Match Result 5/4
Liverpool v Everton, Tomorrow 12:30
Draw - Full Time Result EVS
Leeds vs Burnley, 15 Nov 17:30
Over 2.5 Goals - Over/Under 2.5 Goals 4/5
Brentford v Fulham, Today 20:00
No - Both Teams To Score 1.90
Stake: £5.00 Potential Returns: £53.20`;
const s=w.parseAny(T); s.legs.forEach(l=>{const c=w.selConds(l.sel,{home:l.home,away:l.away});console.log(l.home,'v',l.away,'|',l.sel,'|',l.odd,'| 2-1:',c&&c.every(f=>f(2,1)),'1-1:',c&&c.every(f=>f(1,1)),'| PT:',w.selPT(l.sel));});
console.log('total',s.totalOdd,'stake',s.stake,'returns',s.returns,'check',s.oddCheck&&s.oddCheck.toFixed(3));
// boletim português continua igual
const P='Benfica - Alverca\nResultado Final\nBenfica 1.16\nSporting - Braga\nTotal de Golos Mais/Menos\nMais de 2.5 1.85\nAposta 5,00€';
const p=w.parseAny(P); console.log('PT:',JSON.stringify(p.legs.map(l=>[l.home,l.away,l.sel,l.odd])),p.source);
},400);
