import asyncio,json
from playwright.async_api import async_playwright
T=open('/tmp/ocr_6b503780.txt').read()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(**p.devices['Pixel 7'], timezone_id='Europe/Lisbon')
        calls=[]
        async def route(r):
            u=r.request.url
            if u.startswith('file:'): return await r.continue_()
            if 'api.github.com/gists' in u:
                calls.append((r.request.method,u,r.request.post_data,r.request.headers.get('authorization')))
                if r.request.method in('POST','PATCH'): return await r.fulfill(status=200,content_type='application/json',body=json.dumps({'id':'g1'}))
                return await r.fulfill(status=200,content_type='application/json',body=json.dumps({'id':'g1','files':{'mister-ze.json':{'content':calls[0][2] and json.loads(calls[0][2])['files']['mister-ze.json']['content']}}}))
            await r.abort()
        await ctx.route('**/*',route)
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:asyncio.ensure_future(d.accept()))
        await pg.goto('file:///home/claude/work/estadio.html'); await pg.wait_for_timeout(3000)
        r=await pg.evaluate("""async (T)=>{const o={};
          const E=(id,h,a,iso,hg,ag,st)=>({id,status:st||'FINISHED',utcDate:iso,homeTeam:{name:h,shortName:h},awayTeam:{name:a,shortName:a},score:{fullTime:{home:hg,away:ag}},scorers:[]});
          const k17=new Date(2026,10,12,17,0).toISOString(), k1945=new Date(2026,10,12,19,45).toISOString();
          const fin=[E(1,'England','Croatia',k1945,2,1),E(2,'Türkiye','Belgium',k17,1,1),E(3,'Czechia','Spain',k1945,0,2)];
          o.kick=zeSlipKick('1 ee 12/11/2026, 17:00')===k17;
          // sem jogos conhecidos: nada inventado
          lsSet(LIVE_KEY,{matches:[]}); let s=parseSlip(T); o.semPool=s.legs.map(l=>(l.home||'∅')+' v '+(l.away||'∅')+' k='+(l.kick?1:0));
          // com um único jogo às 17:00 → preenche
          lsSet(LIVE_KEY,{matches:fin}); s=parseSlip(T); o.comPool=s.legs.map(l=>l.sel+' | '+(l.home||'∅')+' v '+(l.away||'∅')+(l.byKick?' (hora)':''));
          o.res=s.legs.map(l=>{const r=resolveLeg(l,fin,new Date(2026,10,12,12).toISOString()); return r?(r.e.homeTeam.name+' '+r.score+' '+(r.win?'GANHA':'PERDE')):'sem jogo'});
          // dois jogos à mesma hora → não adivinha
          lsSet(LIVE_KEY,{matches:fin.concat([E(9,'Armenia','Cyprus',k17,0,0)])}); s=parseSlip(T); o.doisJogos=s.legs.map(l=>(l.home||'∅')+' v '+(l.away||'∅'));
          // aposta gravada só com hora
          o.gravada=!!resolveLeg({sel:'Mais de 1.5 golos',market:'Total de Golos Mais/Menos',home:'',away:'',odd:1.14,kick:k17},fin,new Date(2026,10,12,12).toISOString());
          o.gravada2=resolveLeg({sel:'Mais de 1.5 golos',market:'',home:'',away:'',odd:1.14,kick:k17},fin.concat([E(9,'Armenia','Cyprus',k17,0,0)]),new Date(2026,10,12,12).toISOString());
          // backup
          lsSet('ze_diary_v1',{v:1,items:{a:{home:'A',away:'B',kick:k17,cs:'2-1',pick:{label:'1',p:.6}}}}); lsSet('ze_notes_v1',{x:1}); lsSet('ze_live_cfg_v1',{token:'SEGREDO-FD'});
          const bk=buildBackup(); o.bkKeys=Object.keys(bk.extra); o.semToken=!/SEGREDO-FD|ghp_TESTE/.test(JSON.stringify(bk));
          lsSet(SYNC_KEY,{token:'ghp_TESTE'}); o.auto1=await gistAutoBackup(); o.auto2=await gistAutoBackup(); o.semToken2=!/SEGREDO-FD|ghp_TESTE/.test(JSON.stringify(buildBackup()));
          lsSet('ze_diary_v1',{v:1,items:{}}); lsSet('ze_notes_v1',null);
          applyBackup(bk); o.restD=Object.keys(lsGet('ze_diary_v1',{items:{}}).items).length; o.restN=JSON.stringify(lsGet('ze_notes_v1',null));
          // backup antigo (sem extra) não apaga nada
          const old=Object.assign({},bk); delete old.extra; applyBackup(old); o.oldKeeps=Object.keys(lsGet('ze_diary_v1',{items:{}}).items).length;
          o.pend=/placar previsto <b>2-1/.test(diaryPendHTML());
          return o}""",T)
        print(json.dumps(r,ensure_ascii=False,indent=1)); print('gist calls',[(c[0],c[1][-12:],bool(c[3])) for c in calls]); print('errs',errs); await b.close()
asyncio.run(main())
