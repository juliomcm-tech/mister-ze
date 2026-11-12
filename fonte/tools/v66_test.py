import asyncio, json, sys
from playwright.async_api import async_playwright
sys.path.insert(0,'/home/claude/work/tools')
from fin_shots import SEED_PILOT
async def run(html, dev):
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(**(p.devices['Pixel 7'] if dev=='mob' else {'viewport':{'width':1280,'height':900}})); await ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('file:') else r.abort())
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.add_init_script(path='/home/claude/work/tools/seed.js')
        await pg.goto('file://'+html); await pg.wait_for_timeout(1200); await pg.evaluate("window.__seed&&window.__seed()"); await pg.reload(); await pg.wait_for_timeout(2200)
        await pg.evaluate(SEED_PILOT)
        r=await pg.evaluate("""(async()=>{const o={}, W=ms=>new Promise(r=>setTimeout(r,ms)), $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], vis=el=>!!el&&el.offsetParent!==null;
        fmGo('banca'); await W(300);
        o.tabInicial=wlTab; o.mosaicos=$$('#finAccs .fin-acc').map(e=>e.innerText.replace(/\\s+/g,' ')); o.tabs=$$('#view-banca .wl-tab').map(e=>e.textContent.trim());
        const b=loadBank(); o.tuAbertas=b.bets.filter(x=>x.status==='open').length; o.cartoesTu=$$('#finOpen .fin-bet').length; o.roastEscondido=!vis($('#zeRoast'));
        o.badge=$('#wlOpenBadge').textContent; o.registarBtn=!!$('#finTools [onclick*=registar]');
        wlSetTab('apostas'); await W(100); o.aliasApostas=wlTab;
        wlSetTab('decididas'); await W(150); const dec=b.bets.filter(x=>['win','loss','void'].includes(x.status)); o.decTu=dec.length+' vs linhas '+$$('#finDone .fin-row').length; o.kpis=$$('#finDone .fin-kpi').map(e=>e.innerText.replace(/\\s+/g,' '));
        const prof=Math.round(dec.reduce((s,x)=>s+(x.status==='win'?x.stake*x.odd-x.stake:x.status==='loss'?-x.stake:0),0)*100)/100; o.resultadoConfere=prof+' vs '+$$('#finDone .fin-kpi')[3].innerText.replace(/\\s+/g,' ');
        finSetFilt('win'); await W(100); o.filtroGanhas=$$('#finDone .fin-row').length+' = '+dec.filter(x=>x.status==='win').length; finSetFilt('tudo');
        wlSet('period','7d'); await W(100); o.periodo7d=$$('#finDone .fin-row').length; wlSet('period','epoca'); await W(100);
        wlSetTab('extrato'); await W(150); o.extratoTu=$$('#wlExtratoBody tbody tr').length+' linhas · piloto escondido '+!vis($('#finAutoExt'));
        wlSetTab('resumo'); await W(300); o.resumoTu=$$('#wlCards .wcard').length+' cartão · '+($('#wlCards .wcard')||{className:''}).className+' · gráfico '+!!$('#wlChart svg')+' · raioX '+vis($('#wlRaioX'))+' · dobrados '+$$('#finSumBank details.fin-fold').length;
        finAcc('ze'); await W(200); o.resumoZe=($('#wlCards .wcard')||{className:''}).className+' · raioX visível '+vis($('#wlRaioX'));
        wlSetTab('emjogo'); await W(150); o.zeEmJogo=$$('#finOpen .fin-bet').length+' · registar '+!!$('#finTools [onclick*=registar]');
        wlSetTab('extrato'); await W(150); o.extratoZe=$('#wlExtratoHead').innerText.replace(/\\s+/g,' ').slice(0,40);
        // piloto
        finAcc('auto'); wlSetTab('emjogo'); await W(200); const all=autoAllBets(); o.pilotoAbertas=all.filter(x=>x.st==='open').length+' vs cartões '+$$('#finOpen .fin-bet').length+' · chips '+$$('#finTools .fin-chip').map(e=>e.textContent).join('|');
        o.somaEmJogo=$('#finOpen .fin-sum').innerText.replace(/\\s+/g,' ')+' (esperado '+all.filter(x=>x.st==='open').reduce((s,x)=>s+x.stake,0).toFixed(2)+')';
        finSetW('todos'); await W(150); o.pilotoDesafios=$$('#finOpen .fin-bet').length+' vs '+autoLoad('todos').bets.filter(x=>x.st==='open').length;
        wlSetTab('decididas'); await W(150); o.pilotoDec=$$('#finDone .fin-row').length+' vs '+Math.min(40,autoLoad('todos').bets.filter(x=>x.st!=='open').length);
        wlSetTab('extrato'); await W(150); const L1=autoLedger('todos'); o.extPiloto=$$('#finAutoExt tbody tr').length+' linhas (de '+L1.entries.length+') · saldo final '+L1.entries[L1.entries.length-1].bal+' = carteira '+autoLoad('todos').bank;
        finSetW('all'); await W(150); const LA=finAutoLedger(); const sumBank=Object.keys(AUTO_W).reduce((s,w)=>s+autoLoad(w).bank,0); o.extTodas=LA.entries.length+' mov · saldo final '+LA.entries[LA.entries.length-1].bal+' = soma carteiras '+sumBank.toFixed(2);
        if($('#finAutoExt .fin-foot button')){ $('#finAutoExt .fin-foot button').click(); await W(150); o.verMais=$$('#finAutoExt tbody tr').length; }
        wlSetTab('resumo'); await W(200); o.resumoPiloto=!!$('#finAutoSum .wcard.auto')+' · estratégias '+$$('#finAutoSum .auto-card').length+' · banco escondido '+!vis($('#finSumBank'))+' · raioX '+vis($('#wlRaioX'));
        const sp=finPilotStats('all'); o.pilotoNumeros=JSON.stringify({capital:sp.capital,valor:sp.value,res:sp.result,open:sp.open,certas:sp.w+'/'+sp.n});
        // exportar e imprimir
        const cap=[]; window.zeDownload=(n,t)=>cap.push([n,t.split('\\r\\n').length,t.split('\\r\\n')[0].slice(1,60)]);
        const A=document.createElement; let dl=[]; URL.createObjectURL=()=>'blob:x'; HTMLAnchorElement.prototype.click=function(){dl.push(this.download)};
        wlSetTab('emjogo'); finExport(); wlSetTab('extrato'); finExport(); finAcc('ze'); wlSetTab('decididas'); finExport(); wlSetTab('extrato'); finExport(); finAcc('you'); wlSetTab('emjogo'); finExport(); await W(100);
        o.exportes=cap.map(c=>c.join(' · ')); o.extratoCSVlegado=dl;
        const pr=[]; window.print=()=>{const z=document.getElementById('zePrint'); pr.push(z.querySelector('.zp-head b').textContent+' · tabelas '+z.querySelectorAll('table').length+' · h3 '+[...z.querySelectorAll('h3')].map(h=>h.textContent).join(' | '))};
        for(const a of ['you','ze','auto']){ finAcc(a); finPrint(); await W(200); window.dispatchEvent(new Event('afterprint')); await W(50); }
        o.impressao=pr; o.limpo=!document.getElementById('zePrint');
        // registar e voltar
        finAcc('ze'); wlSetTab('registar'); await W(150); o.registar=FIN.acc+' · painel '+vis($('#boletimPanel'))+' · voltar '+!!$('#finTools [onclick*=emjogo]'); finAcc('auto'); await W(100); o.saiDoRegistar=wlTab;
        // fechar à mão pelo cartão
        finAcc('you'); wlSetTab('emjogo'); await W(150); const before=loadBank().you; const btn=$('#finOpen .fin-bet .mini.w'); btn.click(); await W(300); const nb=loadBank();
        o.fecharMao='saldo '+before+' → '+nb.you+' · abertas '+nb.bets.filter(x=>x.status==='open').length+' · cartões '+$$('#finOpen .fin-bet').length+' · vazio '+!!$('#finOpen .fin-empty');
        // definições: painel do piloto sem listas, com atalho
        fmGo('config'); await W(400); const ap=$('#autoPanel'); o.config='painel '+!!ap+' · listas '+/Em jogo agora|Últimas decididas/.test(ap.innerText)+' · atalho '+!!ap.querySelector('[onclick*=finOpenAcc]')+' · extrato antigo '+/Extrato, exportar e imprimir/.test(ap.innerText);
        ap.querySelector('[onclick*=finOpenAcc]').click(); await W(300); o.atalho=currentView+' '+FIN.acc+' '+wlTab;
        // nuvem simulada
        const mkW=(w)=>{const a=_autoLoadLocal(w); return {start:1000,bank:1000+a.bank-100,bets:a.bets,topups:[],perDay:a.perDay,since:a.since}};
        CLOUD={at:new Date().toISOString(),desde:new Date(Date.now()-5*864e5).toISOString(),carteiras:{ouro:mkW('ouro'),valor:mkW('valor'),todos:mkW('todos'),cai:mkW('cai')}}; ROBO_SAUDE={at:new Date().toISOString(),ok:true,corridas:[]}; lsSet(AUTO_MODE_KEY,'nuvem'); try{lsSet(ROBO_CFG_KEY,{})}catch(e){}
        o.modo=autoMode(); renderWallet(); await W(200); o.mosaicoNuvem=$('#finAccs .fin-acc.auto').innerText.replace(/\\s+/g,' '); wlSetTab('resumo'); await W(200); o.resumoNuvem=$('#finAutoSum').innerText.replace(/\\s+/g,' ').slice(0,150)+' … robô '+/Robô na nuvem/.test($('#finAutoSum').innerText);
        o.overflow=document.documentElement.scrollWidth-document.documentElement.clientWidth;
        return JSON.stringify(o)})()""")
        o=json.loads(r)
        for k,v in o.items(): print(' ',k,':',v if not isinstance(v,list) else '\n      '+'\n      '.join(map(str,v)))
        print('  ERRS',errs); await b.close()
for html,dev in [('/home/claude/work/estadio.html','mob'),('/home/claude/work/dossie_do_dia_v50.html','desk')]:
    print('=====',html.split('/')[-1],dev); asyncio.run(run(html,dev))
