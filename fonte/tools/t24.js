const __mz=u=>{u=decodeURIComponent(String(u)); return u.replace(/dates=(\d{4})(\d{2})?(?=&|$)/,(m,y,mo)=>{ if(mo){const last=new Date(Date.UTC(+y,+mo,0)).getUTCDate(); return 'dates='+y+mo+'01-'+y+mo+String(last).padStart(2,'0');} return 'dates='+y+'0101-'+y+'1231';});};
// Simulação: jornada 4 da Champions, 3 nov 2026 (jogos reais; odds, forma e resultados inventados)
const {JSDOM, VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const FILE=process.argv[2]||'/home/claude/work/dossie_do_dia_v50.html';
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push('JSERR '+e.message));vc.on('error',e=>errs.push('CONSOLE.ERROR '+e));
const iso=d=>d.toISOString(); const past=k=>new Date(Date.now()-k*864e5);
const T=(h,mi)=>new Date(Date.UTC(2026,10,3,h,mi));
const FIX=[ // id, home, hid, away, aid, kickoff, odds 1/X/2, O2.5, result
 ['901','Barcelona','83','Aston Villa','362',T(20,0),[1.45,4.8,6.5],1.55,[3,1],['Lamine Yamal','Raphinha','Lewandowski'],['Ollie Watkins']],
 ['902','Atlético Madrid','1068','Bayern Munich','132',T(20,0),[2.9,3.5,2.35],1.72,[1,1],['Julián Álvarez'],['Harry Kane']],
 ['903','Bodø/Glimt','5776','Lille','166',T(20,0),[2.3,3.6,2.9],1.70,[2,1],['Kasper Høgh','Hauge'],['Jonathan David']],
 ['904','Feyenoord','142','Internazionale','110',T(20,0),[3.6,3.6,1.95],1.80,[0,2],[],['Lautaro Martínez','Marcus Thuram']],
 ['905','Galatasaray','432','VfB Stuttgart','134',T(17,45),[2.2,3.6,3.1],1.60,[2,2],['Victor Osimhen','Barış Alper Yılmaz'],['Deniz Undav','Ermedin Demirović']],
 ['906','LASK','2720','Slovan Bratislava','3998',T(20,0),[1.9,3.5,4.0],1.85,[1,0],['Moses Usor'],[]],
 ['907','Manchester United','360','AS Roma','104',T(20,0),[1.95,3.6,3.8],1.75,[2,1],['Bruno Fernandes','Bryan Mbeumo'],['Paulo Dybala']],
 ['908','Shakhtar Donetsk','493','Sporting CP','2250',T(17,45),[3.1,3.5,2.25],1.68,[1,2],['Eguinaldo'],['Francisco Trincão','Luis Suárez']],
 ['909','Villarreal','102','Paris Saint-Germain','160',T(20,0),[3.9,3.9,1.85],1.62,[1,3],['Gerard Moreno'],['Ousmane Dembélé','Khvicha Kvaratskhelia','Vitinha']],
];
const ML=d=>d>=2?Math.round((d-1)*100):Math.round(-100/(d-1));
let PHASE=1;
const ev=(f,done)=>{const [id,h,hid,a,aid,dt,,,res,sh,sa]=f;return {id,date:iso(dt),status:{type:{completed:done,state:done?'post':'pre'}},competitions:[{competitors:[
 {homeAway:'home',team:{id:hid,displayName:h,shortDisplayName:h,abbreviation:h.slice(0,3).toUpperCase(),color:'0b4ea2'},score:done?String(res[0]):undefined},
 {homeAway:'away',team:{id:aid,displayName:a,shortDisplayName:a,abbreviation:a.slice(0,3).toUpperCase(),color:'c8102e'},score:done?String(res[1]):undefined}],
 details:done?[...sh.map(n=>({scoringPlay:true,type:{text:'Goal'},team:{id:hid},athletesInvolved:[{displayName:n}]})),...sa.map(n=>({scoringPlay:true,type:{text:'Goal'},team:{id:aid},athletesInvolved:[{displayName:n}]}))]:[]}]};};
// forma: equipas mais fortes marcam mais (semente fixa)
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const STR={'83':2.3,'362':1.5,'1068':1.6,'132':2.3,'5776':1.6,'166':1.4,'142':1.4,'110':1.9,'432':1.8,'134':1.5,'2720':1.4,'3998':1.0,'360':1.6,'104':1.3,'493':1.3,'2250':1.8,'102':1.5,'160':2.4};
const pois=l=>{let L=Math.exp(-l),k=0,p=1;do{k++;p*=rnd();}while(p>L);return k-1;};
const sched=(id,name)=>({events:Array.from({length:8},(_,k)=>{const gf=pois(STR[id]),ga=pois(1.2);const home=k%2===0;const f=home?['x'+id+k,name,id,'Opp'+k,'o'+k,past(k*6+3),0,0,[gf,ga],[],[]]:['y'+id+k,'Opp'+k,'o'+k,name,id,past(k*6+3),0,0,[ga,gf],[],[]];return ev(f,true);})});
const SUM=f=>({pickcenter:[{provider:{name:'ESPN BET'},overUnder:2.5,homeTeamOdds:{moneyLine:ML(f[6][0])},drawOdds:{moneyLine:ML(f[6][1])},awayTeamOdds:{moneyLine:ML(f[6][2])},overOdds:ML(f[7]),underOdds:ML(1/(1-1/f[7]+0.05))}],headToHeadGames:[],rosters:[]});
const ROS={'2250':{athletes:[{displayName:'Luis Suárez',position:{abbreviation:'F'}},{displayName:'Francisco Trincão',position:{abbreviation:'F'}},{displayName:'Morten Hjulmand',position:{abbreviation:'M'}}]},'493':{athletes:[{displayName:'Eguinaldo',position:{abbreviation:'F'}}]}};
const RSS=(items)=>'<?xml version="1.0"?><rss><channel>'+items.map(([t,src,h])=>`<item><title>${t} - ${src}</title><link>https://news.example/${encodeURIComponent(t)}</link><pubDate>${new Date(Date.now()-h*3600e3).toUTCString()}</pubDate><source url="https://x">${src}</source></item>`).join('')+'</channel></rss>';
const NEWS={'PT':RSS([['Sporting: Hjulmand em dúvida para a deslocação ao Shakhtar','Record',6],['Shakhtar-Sporting: leões querem vencer na Polónia','A Bola',9]]),
 'GB':RSS([['Man United v Roma: Dybala a doubt for Old Trafford trip','BBC Sport',5],['Barcelona boss confirms Pedri ruled out against Aston Villa','The Guardian',7],['Bayern Munich: Kane returns to training before Atletico Madrid clash','Sky Sports',4]]),
 'ES':RSS([['El Barcelona, sin Pedri ante el Aston Villa por lesión','Marca',6],['Villarreal-PSG: el submarino busca la sorpresa','AS',8]]),
 'IT':RSS([['Roma, Dybala in dubbio per il Manchester United','Gazzetta',5]])};
const dom=new JSDOM(fs.readFileSync(FILE,'utf8'),{runScripts:'dangerously',virtualConsole:vc,url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){const __RD=w.Date,__S=Date.now(),__F=Date.UTC(2026,10,3,12,0); w.Date=class extends __RD{constructor(...a){if(!a.length)super(__F+(__RD.now()-__S));else super(...a);} static now(){return __F+(__RD.now()-__S);}};w.scrollTo=()=>{};w.alert=m=>errs.push('ALERT '+m);w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:(t,k)=>k==='measureText'?()=>({width:10}):k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}})};
 w.HTMLCanvasElement.prototype.toDataURL=()=>'data:image/png;base64,AAAA';w.HTMLCanvasElement.prototype.toBlob=function(cb){cb(new w.Blob(['x'],{type:'image/png'}))};
 w.fetch=async(u)=>{u=__mz(u);u=decodeURIComponent(String(u)); let m; const R=x=>({ok:true,json:async()=>x,text:async()=>JSON.stringify(x)});
  if(/news\.google/.test(u)){const e=(u.match(/ceid=([A-Z]{2})/)||[])[1];return {ok:true,text:async()=>NEWS[e]||RSS([]),json:async()=>({})};}
  if((m=u.match(/teams\/(\d+)\/schedule/))){const f=FIX.find(x=>x[2]===m[1]||x[4]===m[1]);return R(f?sched(m[1],f[2]===m[1]?f[1]:f[3]):{events:[]});}
  if((m=u.match(/teams\/(\d+)\/roster/))) return R(ROS[m[1]]||{athletes:[]});
  if((m=u.match(/summary\?event=(\d+)/))){const f=FIX.find(x=>x[0]===m[1]);return R(f?SUM(f):{});}
  if((m=u.match(/soccer\/([a-z.0-9]+)\/scoreboard/))){ if(m[1]!=='uefa.champions') return R({events:[]}); return R({events:FIX.map(f=>ev(f,PHASE===2))}); }
  if(/standings/.test(u)) return R({children:[{standings:{entries:FIX.flatMap(f=>[[f[2],f[1]],[f[4],f[3]]]).map(([id,n],k)=>({team:{id,displayName:n},stats:[{name:'gamesPlayed',value:3},{name:'pointsFor',value:Math.round(STR[id]*3)},{name:'pointsAgainst',value:4},{name:'points',value:Math.round(STR[id]*3)}]}))}}]});
  return {ok:false,status:404,json:async()=>({}),text:async()=>''};};}});
const w=dom.window; const wait=ms=>new Promise(r=>setTimeout(r,ms));
const bad=[]; const chk=(c,msg)=>{ if(!c) bad.push(msg); };
const scanText=(tag)=>{['portal','dia','duelo','jogos','scout','banca','ze','config'].forEach(v=>{try{w.fmGo(v);}catch(e){bad.push(tag+' fmGo '+v+' '+e.message);} const t=w.document.getElementById('view-'+v)?.textContent||''; const mm=t.match(/.{0,40}(NaN|undefined|\[object Object\]|Infinity|null €).{0,30}/); if(mm) bad.push(`${tag} view ${v}: «${mm[0].replace(/\s+/g,' ')}»`);});};
setTimeout(async()=>{try{
 w.localStorage.clear(); 
 const b0=w.loadBank(); console.log('START banca tu',b0.you,'zé',b0.ze);
 // ---------- Véspera: atualizar ----------
 await w.atualizarTudo(); await wait(100);
 console.log('LIVE:',w.document.getElementById('liveStatus')?.textContent.trim());
 const M=w.eval('matches'); const idx=FIX.map(f=>M.findIndex(m=>m.live && w.teamScore(m.home,w.normTxt(f[1]))>0 && w.teamScore(m.away,w.normTxt(f[3]))>0));
 console.log('no radar amanhã:',idx.filter(i=>i>=0).length,'/9', '| exemplo:', M[idx[7]] && [M[idx[7]].date, M[idx[7]].time, M[idx[7]].home, M[idx[7]].away, M[idx[7]].league].join(' · '));
 idx.forEach((i,k)=>chk(i>=0,'jogo em falta '+FIX[k][1]));
 const cal=w.document.getElementById('view-jogos')?.textContent||''; chk(/Shakhtar/.test(cal),'calendário sem Shakhtar');
 scanText('véspera');
 // ---------- Estudo de cada jogo ----------
 console.log('\nESTUDO (λ casa–fora | 1 X 2 | O2.5 | mercado 1 | notícias)');
 for (const [k,i] of idx.entries()) { if(i<0) continue; const m=M[i];
  w.fmGo('jogos'); w.openMatchIdx(i); const btn=w.document.querySelector('#studyBox button'); if(btn) await w.studyInModal(btn);
  const r=w.modelo(m); const s=r.mk['1']+r.mk['X']+r.mk['2'];
  chk(Math.abs(s-1)<0.02,`${m.home}: 1X2 soma ${s}`); chk(r.lh>0.2&&r.lh<4.5&&r.la>0.2&&r.la<4.5,`${m.home}: λ ${r.lh} ${r.la}`);
  const box=w.document.getElementById('studyBox')?.textContent||''; const bm=box.match(/.{0,30}(NaN|undefined|Infinity).{0,20}/); if(bm) bad.push(`${m.home} estudo: «${bm[0]}»`);
  const st=w.studyFor(m); const sig=(st&&st.news&&st.news.signals||[]).map(s=>s.label.slice(0,2)+(s.player||s.side)).join(' ');
  const impl=1/FIX[k][6][0]/(1/FIX[k][6][0]+1/FIX[k][6][1]+1/FIX[k][6][2]);
  console.log(`  ${(m.home+' – '+m.away).padEnd(36)} ${r.lh.toFixed(2)}–${r.la.toFixed(2)} | ${(r.mk['1']*100).toFixed(0)} ${(r.mk['X']*100).toFixed(0)} ${(r.mk['2']*100).toFixed(0)} | ${(r.mk['O2.5']*100).toFixed(0)}% | mkt ${(impl*100).toFixed(0)}% | conf ${r.conf||'-'} | ${sig}`);
  w.closeModal();
 }
 // confirmar notícia do Hjulmand (dúvida) e do Pedri
 const iS=idx[7], mS=M[iS], stS=w.studyFor(mS); const jH=stS.news.signals.findIndex(s=>/Hjulmand/.test(s.player||'')); if(jH>=0) w.newsApply(iS,jH,'out'); chk(jH>=0,'sinal Hjulmand não encontrado');
 const iB=idx[0], stB=w.studyFor(M[iB]); const jP=stB.news.signals.findIndex(s=>/Pedri/.test(s.player||'')); chk(jP>=0,'sinal Pedri não encontrado'); if(jP>=0) { chk(stB.news.signals[jP].side==='h','Pedri do lado errado'); w.newsApply(iB,jP,'out'); }
 // ---------- Duelo ----------
 console.log('\nDUELO (odds pré-preenchidas → decisão do Zé)');
 for (const i of idx) { if(i<0) continue; const m=M[i];
  w.prepararDuelo(i); await wait(250);
  const o1=w.document.getElementById('odd_1')?.value, oO=w.document.getElementById('odd_O2_5')?.value;
  if(!o1){ bad.push(m.home+': odds não pré-preenchidas'); continue; }
  w.zeDecidirUI(); const d=w.eval('dueloAtual').decision; const zt=w.document.getElementById('zeDecision').textContent; if(/🦓/.test(zt)) console.log('     '+zt.match(/🦓.*/)[0].slice(0,140));
  if(d && d.pick){ const before=w.loadBank().zeBets.length; w.confirmarDueloZe(); await wait(50); const zb=w.loadBank().zeBets; const nb=zb.find(x=>x.match===m.home+' vs '+m.away)||zb[0];
    console.log(`  ${(m.home+' – '+m.away).padEnd(36)} odds 1=${o1} O2.5=${oO} → Zé: ${d.pick.label} @${d.pick.odd} EV ${(d.pick.ev*100).toFixed(1)}% stake ${zb.length>before?nb.stake.toFixed(2)+'€':'(não registou)'}`);
  } else console.log(`  ${(m.home+' – '+m.away).padEnd(36)} odds 1=${o1} O2.5=${oO} → Zé passa`);
 }
 const B1=w.loadBank(); const zeOpen=B1.zeBets.filter(x=>x.status==='open'); const zeStart=b0.ze;
 const exp=zeOpen.reduce((a,x)=>a+x.stake,0);
 console.log(`  Zé: ${zeOpen.length} apostas, exposição ${exp.toFixed(2)}€ = ${(exp/zeStart*100).toFixed(1)}% da banca inicial; maior ${Math.max(0,...zeOpen.map(x=>x.stake)).toFixed(2)}€`);
 chk(exp/zeStart<=0.1501,'exposição do Zé > 15%'); zeOpen.forEach(x=>chk(x.stake/zeStart<=0.0501,'aposta do Zé > 5%: '+x.stake));
 const perMatch={}; zeOpen.forEach(x=>perMatch[x.match]=(perMatch[x.match]||0)+x.stake); Object.entries(perMatch).forEach(([k,v])=>chk(v/zeStart<=0.0801,'jogo > 8%: '+k));
 // ---------- Apostas do humano ----------
 const you0=w.loadBank().you;
 w.addBet({match:'Shakhtar Donetsk vs Sporting CP',pick:'Sporting CP vence',odd:2.25,stake:3,legs:[{home:'Shakhtar Donetsk',away:'Sporting CP',sel:'Sporting CP',odd:2.25}]},'you');
 w.addBet({match:'Barcelona vs Aston Villa + Feyenoord vs Internazionale',pick:'Barcelona + Internazionale',odd:2.83,stake:2,legs:[{home:'Barcelona',away:'Aston Villa',sel:'Barcelona',odd:1.45},{home:'Feyenoord',away:'Internazionale',sel:'Internazionale',odd:1.95}]},'you');
 w.addBet({match:'Atlético Madrid vs Bayern Munich',pick:'Bayern Munich vence',odd:2.35,stake:2,legs:[{home:'Atlético Madrid',away:'Bayern Munich',sel:'Bayern Munich',odd:2.35}]},'you');
 w.addBet({match:'Villarreal vs Paris Saint-Germain',pick:'Mais de 2.5 golos',odd:1.62,stake:1.5,legs:[{home:'Villarreal',away:'Paris Saint-Germain',sel:'Over 2.5',odd:1.62}]},'you');
 w.addBet({match:'Galatasaray vs VfB Stuttgart',pick:'Galatasaray vence',odd:2.2,stake:1,legs:[{home:'Galatasaray',away:'VfB Stuttgart',sel:'Galatasaray',odd:2.2}]},'you');
 let B2=w.loadBank(); const last=B2.bets.find(x=>/Galatasaray/.test(x.match)); w.cancelUserBet(last.id); await wait(50);
 B2=w.loadBank(); console.log('\nTU: apostas abertas',B2.bets.filter(x=>x.status==='open').length,'| canceladas',B2.bets.filter(x=>x.status==='cancel').length,'| saldo',B2.you.toFixed(2),'(antes',you0.toFixed(2)+')');
 chk(Math.abs(B2.you-(you0-3-2-2-1.5))<0.005,'saldo depois das apostas/estorno errado: '+B2.you);
 scanText('com apostas');
 w.shareCalendar && w.shareCalendar(); await wait(50); w.shareDuel && w.shareDuel(); await wait(50);
 // ---------- Dia seguinte: resultados ----------
 PHASE=2; await w.atualizarTudo(); await wait(150);
 console.log('\nRESULTADOS:',w.document.getElementById('liveStatus')?.textContent.trim());
 const B3=w.loadBank();
 const exp_you = you0 + 3*2.25 + 2*2.83 + 0 + 1.5*1.62 - 0 /*gala cancel*/ - 3 - 2 - 2 - 1.5;
 console.log('TU: saldo',B3.you.toFixed(2),'| esperado',(you0-8.5+6.75+5.66+2.43).toFixed(2), '| estados', B3.bets.map(x=>x.status).join(','));
 chk(Math.abs(B3.you-(you0-8.5+6.75+5.66+2.43))<0.02,'saldo final do humano errado');
 chk(B3.bets.filter(x=>x.status==='open').length===0,'ficaram apostas do humano por liquidar');
 const zs=B3.zeBets.filter(x=>x.match&&FIX.some(f=>x.match.includes(f[1].split(' ')[0])));
 zs.forEach(x=>console.log(`  Zé ${x.match} · ${x.pick} @${x.odd} → ${x.status} ${x.status==='win'?'+'+(x.stake*(x.odd-1)).toFixed(2):x.status==='loss'?'-'+x.stake.toFixed(2):''}`));
 chk(zs.every(x=>x.status!=='open'),'ficaram apostas do Zé por liquidar');
 const zeExp=zeStart + zs.reduce((a,x)=>a+(x.status==='win'?x.stake*(x.odd-1):x.status==='loss'?-x.stake:0),0);
 console.log('ZÉ: saldo',B3.ze.toFixed(2),'| esperado',zeExp.toFixed(2)); chk(Math.abs(B3.ze-zeExp)<0.02,'saldo final do Zé errado');
 const L1=w.buildLedger(B3,'you'), L2=w.buildLedger(B3,'ze'); console.log('extrato reconciliado: tu',L1.reconciled,'| zé',L2.reconciled); chk(L1.reconciled&&L2.reconciled,'extrato não reconcilia');
 const lr=w.learnLoad(); console.log('APRENDIZAGEM:',JSON.stringify(lr).slice(0,260));
 // repetir atualização não pode liquidar duas vezes
 await w.atualizarTudo(); const B4=w.loadBank(); chk(Math.abs(B4.you-B3.you)<1e-9&&Math.abs(B4.ze-B3.ze)<1e-9,'segunda atualização mexeu nos saldos');
 scanText('depois');
 const chat=[...w.document.querySelectorAll('#chatLog .cmsg.bot .bubble')].map(x=>x.textContent.replace(/\s+/g,' ')); console.log('\nRELATÓRIO NO CHAT:', (chat.find(t=>/liquidad/i.test(t))||'(nenhum)').slice(0,500));
}catch(e){errs.push('EXC '+e.stack)}
 console.log('\n=== PROBLEMAS ==='); console.log(bad.concat(errs).join('\n')||'NENHUM'); process.exit(0);},500);
