const {JSDOM}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const dom=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){w.scrollTo=()=>{};w.fetch=async()=>{throw new TypeError('x')}}});
setTimeout(()=>{const w=dom.window;const E=(h,a)=>({homeTeam:{name:h,shortName:h},awayTeam:{name:a,shortName:a}});const bad=[];
const cases=[
 [['Man City','Man Utd'],['Manchester City','Manchester United'],true],[['Man City','Man Utd'],['Manchester United','Manchester City'],false],
 [['Man City','Man United'],['Manchester United','Manchester City'],false],[['Manchester City','Manchester United'],['Manchester United','Manchester City'],false],
 [['Inter','Milan'],['Internazionale','AC Milan'],true],[['Inter','Milan'],['AC Milan','Internazionale'],false],[['Inter Milan','AC Milan'],['AC Milan','Internazionale'],false],[['Inter Milan','AC Milan'],['Internazionale','AC Milan'],true],
 [['Real Madrid','Atletico Madrid'],['Real Madrid','Atlético Madrid'],true],[['Real Madrid','Atletico Madrid'],['Atlético Madrid','Real Madrid'],false],[['Real Madrid','Atlético'],['Atlético Madrid','Real Madrid'],false],
 [['Man Utd','Roma'],['Manchester United','AS Roma'],true],[['Bodo/Glimt','Lille'],['Bodø/Glimt','Lille'],true],[['Feyenoord','Inter Milan'],['Feyenoord','Internazionale'],true],[['LASK Linz','Slovan Bratislava'],['LASK','Slovan Bratislava'],true],
 [['Bayern Munich','Benfica'],['Bayern Munich','Benfica'],true],[['Bayern','Benfica'],['Bayern Munich','Benfica'],true],[['Atletico Madrid','Bayern Munich'],['Atlético Madrid','Bayern Munich'],true],
 [['Sporting','Braga'],['Sporting CP','SC Braga'],true],[['Sporting CP','SC Braga'],['SC Braga','Sporting CP'],false],[['Benflca','Alverca'],['Benfica','Alverca'],true],[['Man City','Liverpool'],['Manchester City','Liverpool'],true]];
cases.forEach(([[h,a],[eh,ea],exp])=>{const r=w.evMatchesLeg(E(eh,ea),{home:h,away:a});const ok=r===exp;if(!ok)bad.push(`${h} v ${a} ≟ ${eh} v ${ea}: ${r} (esperava ${exp})`);});
console.log(cases.length,'casos ·',bad.length?'FALHAS:\n'+bad.join('\n'):'todos certos');},400);
