# Auditoria do Mister Zé

Ferramentas da auditoria de novembro de 2026 (6.994 jogos, 10 ligas, 3 épocas; 158 hipóteses, 0 confirmadas).

- `preregisto.json` — os três testes marcados a 11/11/2026 para medir em maio de 2027. Não se afinam depois.
- `build.py <ano…>` — transforma os ficheiros do laboratório (`lab-dados/<ano>.json`, em `AUD_RAW`) em tabelas com 163 colunas (`AUD_DATA`). Play-offs ficam de fora.
- `evaluate.py regras.json --epocas 2024 2025 2026` — mede cada regra: n, taxa, odd média, taxa precisa para empatar, lucro por euro e z. Colunas `y_` (resultado do jogo) são proibidas dentro das regras.

Para repetir: `gh workflow run lab.yml -f epocas="2026"`, ir buscar o ficheiro ao ramo `lab-dados`, correr `build.py` e depois `evaluate.py preregisto.json`.
