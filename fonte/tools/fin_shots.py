import asyncio, json, sys
from playwright.async_api import async_playwright
SEED_PILOT = """(()=>{const day=864e5, now=Date.now();
 const T=[['Benfica','Arouca','Liga Portugal','1X','Benfica ou empate'],['Arsenal','Everton','Premier League','O1.5','Mais de 1.5 golos'],['Inter','Lecce','Serie A','1','Inter vence'],['PSV','Heracles','Eredivisie','O1.5','Mais de 1.5 golos'],['Bayern','Mainz','Bundesliga','1X','Bayern ou empate'],['Lyon','Metz','Ligue 1','X2','Empate ou Metz'],['Betis','Getafe','La Liga','U3.5','Menos de 3.5 golos']];
 const mk=(w,i,st,o_,p,daysAgo,stake)=>{const t=T[i%T.length];return {id:w+i,at:new Date(now-daysAgo*day-3*36e5).toISOString(),day:isoDay(new Date(now-daysAgo*day)),ev:w+'e'+i,code:'eng.1',h:t[0],a:t[1],lg:t[2],ko:now-daysAgo*day,k:t[3],label:t[4],p,o:o_,book:'Bet365',od:i%3===0?1:0,stake,how:'1% (pela probabilidade)',evp:0.01,kind:w==='ouro'?'ouro':'desafio',st,res:st==='win'?'2-0':st==='loss'?'0-1':undefined,ret:st==='win'?Math.round(stake*o_*100)/100:st==='void'?stake:st==='loss'?0:undefined,rv:'R1'}};
 const fill=(w,n,start,stake,openN)=>{const bets=[];let bank=start;const add=x=>{bets.unshift(x);bank-=x.stake;if(x.ret)bank+=x.ret;};
  for(let i=0;i<n;i++) add(mk(w,i,i%4===0?'loss':'win',1.28+((i*7)%12)/100,0.74,14-i*(13/n),stake));
  for(let j=0;j<openN;j++) add(mk(w,100+j,'open',1.30+j*0.04,0.75,-0.2-j*0.3,stake));
  lsSet(AUTO_W[w].key,Object.assign({start,bank:Math.round(bank*100)/100,bets,topups:[],perDay:AUTO_W[w].perDay,since:new Date(now-15*day).toISOString()},w==='ouro'?{on:true}:{}));};
 fill('ouro',9,100,1,1); fill('valor',6,100,1.2,0); fill('todos',18,100,1,3); if(AUTO_W.cai) fill('cai',4,100,1,1);
 try{AUTO_ALL_MEMO=null}catch(e){} try{lsSet(AUTO_MODE_KEY,'local')}catch(e){} })()"""
async def main(tag, views):
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(**p.devices['Pixel 7']); await ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('file:') else r.abort())
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.add_init_script(path='/home/claude/work/tools/seed.js')
        await pg.goto('file:///home/claude/work/estadio.html'); await pg.wait_for_timeout(1500)
        await pg.evaluate("window.__seed&&window.__seed()"); await pg.reload(); await pg.wait_for_timeout(2500)
        await pg.evaluate(SEED_PILOT)
        for name, js in views:
            await pg.evaluate(js); await pg.wait_for_timeout(700)
            await pg.evaluate('window.scrollTo(0,0)'); await pg.screenshot(path=f'/tmp/fin_{tag}_{name}.png')
            await pg.evaluate('window.scrollTo(0,620)'); await pg.wait_for_timeout(150); await pg.screenshot(path=f'/tmp/fin_{tag}_{name}_b.png'); await pg.evaluate('window.scrollTo(0,0)')
        print('ERRS', errs); await b.close()
if __name__=='__main__':
    tag=sys.argv[1] if len(sys.argv)>1 else 'antes'
    V=[('tu_emjogo',"fmGo('banca'); finAcc('you'); wlSetTab('emjogo')"),('tu_decididas',"wlSetTab('decididas')"),('tu_extrato',"wlSetTab('extrato')"),('tu_resumo',"wlSetTab('resumo')"),
       ('ze_emjogo',"finAcc('ze'); wlSetTab('emjogo')"),('ze_decididas',"wlSetTab('decididas')"),
       ('auto_emjogo',"finAcc('auto'); wlSetTab('emjogo')"),('auto_decididas',"wlSetTab('decididas')"),('auto_extrato',"wlSetTab('extrato')"),('auto_resumo',"wlSetTab('resumo')"),('auto_w',"finSetW('todos'); wlSetTab('emjogo')"),('config',"fmGo('config')"),('home',"fmGo('portal')")]
    if tag=='antes': V=[('resumo',"fmGo('banca'); wlSetTab('resumo')")]
    asyncio.run(main(tag,V))
