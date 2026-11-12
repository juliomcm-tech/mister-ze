// confirma que todo o JavaScript das duas páginas construídas é válido
const fs = require('fs'), path = require('path'); let bad = 0;
for (const f of ['dossie_do_dia_v50.html', 'estadio.html']) {
  const h = fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); const re = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g; let m, i = 0;
  while ((m = re.exec(h))) { i++; try { new Function(m[1]); } catch (e) { bad++; console.log('  ✗', f, 'script', i, String(e)); } }
  console.log('  ' + f + ': ' + i + ' scripts');
}
process.exit(bad ? 1 : 0);
