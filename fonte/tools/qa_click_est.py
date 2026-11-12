import asyncio, json, sys
from playwright.async_api import async_playwright
SP='/home/claude/work/tools'
seed=open(SP+'/seed.js').read()
VIEWS=['portal','dia','duelo','jogos','scout','banca','ze','config']
SKIP=['finPrint','finShare','finExport','stPanelPrint','stPanelShare','stAllPrint','stYearPrint','accCreate','accSwitch','accDel','accRemove','slipFile','zeSlipFile','cfgPhotoFile','backupFile','instalarApp','extratoPrint','novaEpoca','resetBanca','syncUp','syncDown','window.print','atualizarTudo','atualizarJogos','liveRefresh','verificarAtualizacoes','exportBackup','extratoCSV']
async def run(mobile, seeded):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ctx = await b.new_context(viewport={'width':390 if mobile else 1366,'height':860}, is_mobile=mobile, has_touch=mobile)
        await ctx.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())  # offline: sem rede
        pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append('PAGEERROR '+str(e)))
        pg.on('console', lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' and 'Failed to load resource' not in m.text and 'net::' not in m.text else None)
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept('2')))
        if seeded: await pg.add_init_script(seed+"\nif(!sessionStorage.getItem('s')){window.__seed();sessionStorage.setItem('s','1');}")
        await pg.goto('file:///home/claude/work/estadio.html'); await pg.wait_for_timeout(600); await pg.evaluate("CAL_STATIC.forEach(m=>{m.calSt='ok';if(m.aviso===CAL_PENDING_TXT)m.aviso=m._orig.aviso||null;delete m.calNote;if(!matches.includes(m))matches.push(m)}); renderPortal()")
        clicked=0; overflow=[]
        for v in VIEWS:
            await pg.evaluate(f"fmGo('{v}')"); await pg.wait_for_timeout(150)
            if v=='banca':
                tabs=['emjogo','decididas','extrato','resumo','registar','auto:emjogo','auto:decididas','auto:extrato','auto:resumo','ze:emjogo','ze:decididas']
            else: tabs=[None]
            for t in tabs:
                if t:
                    acc,tt=(t.split(':')+[None])[:2] if ':' in t else ('you',t)
                    await pg.evaluate(f"finAcc('{acc}'); wlSetTab('{tt}')"); await pg.wait_for_timeout(120)
                sw = await pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                if sw>2: overflow.append((v,t,sw))
                n = await pg.evaluate("document.querySelectorAll('#view-%s [onclick]').length" % v)
                for i in range(min(n,80)):
                    info = await pg.evaluate("""(i)=>{ const els=[...document.querySelectorAll('#view-%s [onclick]')].filter(e=>e.offsetParent!==null); const e=els[i]; if(!e) return null; return {oc:e.getAttribute('onclick'), txt:(e.textContent||'').trim().slice(0,30)}; }""" % v, i)
                    if not info: continue
                    if any(s in info['oc'] for s in SKIP): continue
                    try:
                        await pg.evaluate("""(i)=>{ const els=[...document.querySelectorAll('#view-%s [onclick]')].filter(e=>e.offsetParent!==null); const e=els[i]; if(e) e.click(); }""" % v, i)
                        clicked+=1
                        await pg.wait_for_timeout(60)
                    except Exception as ex:
                        errs.append(f'CLICK {v} {info} {ex}')
                    # close modal if opened, return to view/tab
                    await pg.evaluate(f"(()=>{{ try{{closeModal()}}catch(e){{}}; if(currentView!=='{v}') fmGo('{v}'); {("finAcc(%r); wlSetTab(%r)"%((t.split(':')[0],t.split(':')[1]) if ':' in t else ('you',t))) if t else ''} }})()")
        # modal internals
        await pg.evaluate("CAL_STATIC.forEach(m=>{m.calSt='ok';if(m.aviso===CAL_PENDING_TXT)m.aviso=m._orig.aviso||null;if(!matches.includes(m))matches.push(m)}); fmGo('jogos'); openMatchIdx(matches.findIndex(m=>!m.past))"); await pg.wait_for_timeout(200)
        for sel in ['#modal-body .copy-btn']:
            try: await pg.click(sel, timeout=1000)
            except Exception as ex: errs.append('MODAL '+str(ex)[-700:])
        sw = await pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        await b.close()
        return clicked, errs, overflow
async def main():
    for mobile in [False, True]:
        for seeded in [False, True]:
            c,e,o = await run(mobile, seeded)
            print(('MOBILE' if mobile else 'DESKTOP'), ('seeded' if seeded else 'empty'), 'clicked', c, 'errors', len(e), 'overflow', o)
            for x in dict.fromkeys(e): print('   ', x[:220])
asyncio.run(main())
