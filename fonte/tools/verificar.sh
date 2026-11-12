#!/bin/bash
# Mister Zé · verificação completa antes de publicar. Um só comando: bash tools/verificar.sh
# Constrói as duas versões, confirma a sintaxe e corre todos os testes. Só publicar se acabar em «TUDO OK».
cd "$(dirname "$0")/.." || exit 1
ok=1
echo "1/5 construir"; python3 tools/build.py >/dev/null && python3 tools/build_estadio.py >/dev/null || { echo "  ✗ a construção falhou"; exit 1; }
echo "2/5 sintaxe"; node tools/sintaxe.js || ok=0
echo "3/5 versões alinhadas"
v=$(grep -o "APP_VER = 'v[0-9]*'" newjs32.js | grep -o "v[0-9]*"); s=$(grep -o "ze-v[0-9]*" pwa/sw.js | head -1)
[ "ze-$v" = "$s" ] && grep -q "/$v/" tools/t45.js && echo "  $v" || { echo "  ✗ app=$v sw=$s (ou teste t45 desatualizado)"; ok=0; }
echo "4/5 testes (demora uns minutos)"
A=$(bash tools/runall.sh t22 t23 t24 t25 t26 t27 t28 t29 t30 t31 t32 t33 t34 t35 | tail -1)
B=$(bash tools/runall.sh t36 t37 t38 t39 t40 t41 t42 t43 t44 t45 t46 t47 t48 t49 t50 | tail -1)
echo "  $A"; echo "  $B"
echo "$A" | grep -q "PASS 14 FAIL 0" || ok=0; echo "$B" | grep -q "PASS 15 FAIL 0" || ok=0
echo "5/5 testes de ecrã (v66, v72)"
for t in v66_test v72_test; do python3 tools/$t.py > /tmp/$t.out 2>&1; if grep -q "Traceback\|errs \['" /tmp/$t.out; then echo "  ✗ $t (ver /tmp/$t.out)"; ok=0; else echo "  $t ok"; fi; done
[ $ok = 1 ] && echo "TUDO OK" || { echo "HÁ FALHAS — não publicar"; exit 1; }
