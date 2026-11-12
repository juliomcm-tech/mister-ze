# Layout de teste «Estádio»: a mesma app (index) + a pele por cima. Corre a partir de /home/claude/work
src=open('dossie_do_dia_v50.html',encoding='utf-8').read()
skin=open('skin_rivals.js',encoding='utf-8').read()
j=src.rindex('</body>')
out=src[:j]+'<script>\n'+skin+'\n</script>\n'+src[j:]
out=out.replace('<title>','<title>Estádio · ',1)
open('estadio.html','w',encoding='utf-8').write(out)
print('ok',len(out))
