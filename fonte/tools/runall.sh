#!/bin/bash
export NODE_PATH_JSDOM=/home/claude/.npm-global/lib/node_modules/jsdom
cd /home/claude/work/tools
H=/home/claude/work/dossie_do_dia_v50.html
pass=0; fail=0; failed=""
for t in "$@"; do
  out=$(timeout 150 node $t.js $H 2>&1)
  if echo "$out" | grep -qE "^FAIL|✗|PROBLEMAS ===" && ! echo "$out" | grep -A1 "PROBLEMAS ===" | grep -q NENHUM; then bad=1; else bad=0; fi
  if echo "$out" | grep -qE "^ERRORS|jsdomError|TypeError|ReferenceError|SyntaxError|^Error|ENOENT|^FAIL|❌ FAIL"; then bad=1; fi
  if [ $bad = 1 ]; then fail=$((fail+1)); failed="$failed $t"; echo "--- $t"; echo "$out" | tail -8; else pass=$((pass+1)); fi
done
echo "PASS $pass FAIL $fail :$failed"
