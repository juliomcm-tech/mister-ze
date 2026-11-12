const {JSDOM,VirtualConsole}=require(process.env.NODE_PATH_JSDOM);const fs=require('fs');
const HTML=fs.readFileSync('/home/claude/work/dossie_do_dia_v50.html','utf8');
const errs=[];const bad=[];const chk=(c,m)=>{if(!c)bad.push(m);};
function open(store,answers){ const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push('JSERR '+e.message));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',virtualConsole:vc,url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){
  Object.entries(store||{}).forEach(([k,v])=>w.localStorage.setItem(k,v)); const q=(answers||[]).slice();
  w.prompt=()=>q.shift(); w.confirm=()=>false; w.alert=m=>errs.push('ALERT '+m); w.scrollTo=()=>{}; w.HTMLElement.prototype.scrollIntoView=()=>{}; w.fetch=async()=>{throw new TypeError('x')}; w.location.reload=()=>{}; }});
 return dom.window; }
// a localStorage do jsdom vê-se pela própria API: copiar as chaves «em bruto»
const dump=w=>{const o={};for(let i=0;i<w.localStorage.length;i++){const k=w.localStorage.key(i);o[k]=w.__rawGet(k);}return o;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{try{
 // A) conta principal
 let w=open({'ze_user_v1':JSON.stringify({name:'Spongy'})},['Rui','30']); await wait(400);
 w.addBet({match:'Benfica vs Alverca',pick:'Benfica vence',odd:1.3,stake:2},'you'); w.lsSet('ze_learn_v1',{v:1,n:7,nMkt:0,bModel:1,bMkt:0,bBase:2,bO25:0,bBTTS:0,nO:0,bins:{},byLeague:{},log:[]});
 w.fmGo('config'); console.log('A conta:',w.ZE_ACCOUNT,'| nome',w.pname(),'| banca',w.loadBank().you,'| apostas',w.loadBank().bets.length,'| painel',!!w.document.getElementById('cfgAccounts'));
 w.accCreate(); const L=w.accList(); console.log('contas:',JSON.stringify(L.map(a=>[a.id,w.accName(a)])));
 const rui=L.find(a=>a.id!=='main').id;
 console.log('lista:',w.document.getElementById('cfgAccounts').textContent.replace(/\s+/g,' ').slice(0,220));
 let S=dump(w);
 // B) entrar na conta do Rui
 S.ze_account_cur=rui; w=open(S,['1234']); await wait(400);
 console.log('\nB conta:',w.ZE_ACCOUNT,'| nome',w.pname(),'| cabeçalho',w.document.getElementById('hdrSub').textContent,'| banca',w.loadBank().you,'Zé',w.loadBank().ze,'| apostas',w.loadBank().bets.length,'| cérebro partilhado n=',w.learnLoad().n);
 chk(w.pname()==='Rui'&&w.loadBank().you===30&&w.loadBank().bets.length===0,'conta Rui não está separada'); chk(w.learnLoad().n===7,'cérebro não partilhado');
 w.addBet({match:'Porto vs Estoril',pick:'Porto vence',odd:1.4,stake:3},'you'); w.addBet({match:'Porto vs Estoril',pick:'Porto vence',odd:1.4,stake:0.5,source:'duelo-ze'},'ze');
 w.lsSet('ze_notes_v1',{x:{t:1,out:[{name:'Teste'}],rot:[]}}); w.accSetPin(); console.log('PIN posto:',!!w.accList().find(a=>a.id===rui).pin);
 S=dump(w);
 // C) voltar à principal
 S.ze_account_cur='main'; w=open(S); await wait(400);
 console.log('\nC conta:',w.ZE_ACCOUNT,'| nome',w.pname(),'| banca',w.loadBank().you,'| apostas',w.loadBank().bets.map(b=>b.match).join(','),'| notas',JSON.stringify(w.lsGet('ze_notes_v1',{})));
 chk(w.pname()==='Spongy'&&w.loadBank().bets.length===1&&w.loadBank().bets[0].match==='Benfica vs Alverca','principal misturada'); chk(!w.lsGet('ze_notes_v1',null)||!w.lsGet('ze_notes_v1',{}).x,'notas misturadas');
 // D) abrir a do Rui com PIN
 S.ze_account_cur=rui; w=open(S); await wait(400);
 const lock=w.document.getElementById('accLock'); console.log('\nD bloqueio:',!!lock); chk(!!lock,'sem bloqueio');
 w.document.getElementById('accPin').value='0000'; w.document.getElementById('accPinOk').click(); console.log('PIN errado →',w.document.getElementById('accPinMsg').textContent);
 w.document.getElementById('accPin').value='1234'; w.document.getElementById('accPinOk').click(); console.log('PIN certo → bloqueio',!!w.document.getElementById('accLock'),'| apostas Rui',w.loadBank().bets.length,'Zé',w.loadBank().zeBets.length);
 chk(!w.document.getElementById('accLock'),'PIN certo não desbloqueou');
 // E) apagar a conta do Rui a partir da principal
 S=dump(w); S.ze_account_cur='main'; w=open(S,['1234']); await wait(400); w.confirm=()=>true; w.accDelete(rui);
 const left=Object.keys(dump(w)).filter(k=>k.startsWith('acc:')); console.log('\nE chaves do Rui depois de apagar:',left.length,'| contas',w.accList().length,'| principal intacta',w.loadBank().bets.length);
 chk(left.length===0&&w.accList().length===1&&w.loadBank().bets.length===1,'apagar');
 // backup da conta (só dela)
 const bk=w.buildBackup(); console.log('backup principal: nome',bk.user.name,'| apostas',bk.bank.bets.length);
}catch(e){errs.push('EXC '+e.stack)} console.log('\n=== PROBLEMAS ===\n'+(bad.concat(errs.filter(e=>!/^ALERT/.test(e))).join('\n')||'NENHUM'));process.exit(0);})();
