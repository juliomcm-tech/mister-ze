# Mister Zé · mapa do código

Esta pasta é a **fonte** da aplicação. O que está na raiz do repositório (`index.html`, `estadio.html`, `classico.html`, `sw.js`) é o resultado já construído — não se edita à mão.

## Como está montado

- `orig.html` — o dossiê original (scouting e calendário); o construtor aproveita partes dele.
- `shell.html` — a estrutura da página e todo o CSS.
- `newjs.js` … `newjs63.js` — o JavaScript, por ordem de carregamento. Cada ficheiro **acrescenta** ao anterior; quando muda um comportamento antigo fá-lo embrulhando a função (`f = (function (prev) { … })(f)`), nunca apagando. É por isso que a ordem importa e que não se devem fundir ficheiros.
- `skin_rivals.js` — a pele «Estádio» (fundo, mosaicos, barra de baixo), aplicada por cima do clássico.
- `pwa/` — `sw.js` (cache offline; a versão tem de acompanhar `APP_VER`).
- `tools/` — construtores e testes.

## Regras da casa

1. Nunca redeclarar uma função global que já existe: embrulhar.
2. Chaves e tokens só no aparelho do utilizador ou nos segredos do GitHub. Nada disso entra no código nem nas cópias de segurança.
3. Regras do Zé (`ZE_RULES`) congeladas desde 2026-11-09: só mudam com teste e aprovação. Os três testes pré-registados só se medem em maio de 2027.
4. Subir a versão em três sítios ao mesmo tempo: `APP_VER` (`newjs32.js`), `VERSION` (`pwa/sw.js`), regex do teste `tools/t45.js`.

## Antes de publicar

```
bash tools/verificar.sh      # constrói, verifica sintaxe e versões, corre os 29 testes + testes de ecrã
```

Só publicar se acabar em `TUDO OK`. Depois: copiar `estadio.html` → `index.html` e `estadio.html`, `dossie_do_dia_v50.html` → `classico.html`, `pwa/sw.js` → `sw.js`.

(Os caminhos dentro dos testes apontam para `/home/claude/work`; noutro computador, ajustar ou criar essa pasta. Os testes precisam de `jsdom` e `playwright`.)

## Ficheiro a ficheiro

| Ficheiro | Tamanho | O que traz |
|---|---|---|
| `newjs.js` | 33 KB | v14 · Layout FM + Duelo — utilitários, cara do Zé, Portal, navegação · A CARA DO MISTER ZÉ (SVG original) · BANCA — histórico, VS, liquidação · PORTAL: inbox + tiles + calendário 14 dias · CONTINUAR (como no FM) · … (+3) |
| `newjs2.js` | 64 KB | v15 · CÉREBRO DO MISTER ZÉ · Médias de golos por liga [casa, fora] · Poisson + correção Dixon-Coles (resultados baixos) · λ (golos esperados) de cada jogo · Mercados que o Zé avalia · … (+10) |
| `newjs3.js` | 27 KB | v15 · MISTER ZÉ CONVERSADOR · Marcadores · Proposta de aposta do Zé (pode haver várias por jogo) · O cérebro da conversa |
| `newjs4.js` | 20 KB | v16 · Resultados automáticos, OCR em 2 passes, Zé com seguimento · OCR: 2.º passe só com texto branco (odds em caixas coloridas) · Fontes de dados: ESPN público (sem token) · Liquidação automática · Botão «Atualizar»: jogos + resultados + liquidação · … (+3) |
| `newjs5.js` | 11 KB | v17 · BASE DE JOGADORES + FICHA DO JOGO · Overrides: reconhecer qualquer jogador |
| `newjs6.js` | 71 KB | v18 · Leitura por coordenadas (tabelas), «se fosse parvo», perfil do · Palavras com posição (tesseract.js) · OCR v3: normal → (texto branco) → (coordenadas) · «Se fosse parvo…» e melhores do dia (todos os prints) · Perfil do utilizador: nome + foto · … (+11) |
| `newjs7.js` | 36 KB | v22 · CARTEIRAS — contabilidade das duas contas (Tu e Mister Zé) · Razão (lançamentos) · Curva de património (saldo + em jogo) · Indicadores · Cartões das contas · … (+6) |
| `newjs8.js` | 9 KB | v23 · Anular apostas (estorno), registo pelo print, e o Zé a · Balão do Zé (visível em qualquer ecrã) · Anular uma aposta tua (não chegaste a jogá-la) · Gestão de banca: o Zé avalia a stake · Perfil: disciplina de stake · … (+1) |
| `newjs9.js` | 14 KB | v24 · Partilhar (WhatsApp) + atualizar resultados à vista · Texto de uma aposta · Imagem (cartão) para partilhar · Partilhar: imagem + texto → WhatsApp · Última atualização (visível) |
| `newjs10.js` | 8 KB | v25 · Partilhar cartão do jogo (análise) e calendário · Imagens: jogo e calendário |
| `newjs11.js` | 3 KB | v26 · App no telemóvel (PWA): receber partilhas do Android |
| `newjs12.js` | 24 KB | v27 · O ZÉ PENSA: estudo do jogo (forma, ficha, mercado, H2H), · Matéria-prima · Mercado → golos esperados equivalentes · Aprendizagem · O modelo, agora com estudo + aprendizagem · … (+2) |
| `newjs13.js` | 13 KB | v28 · Validações + o Zé PEDE e APRENDE informação do utilizador · Validações de apostas · Notas que o utilizador dá ao Zé (por jogo) · O modelo usa as notas · O que falta ao Zé (e como lho dar) · … (+1) |
| `newjs14.js` | 11 KB | v29 · O Zé lê os títulos dos jornais (Google Notícias PT) · Integração no estudo · O Zé conta o que leu |
| `newjs15.js` | 13 KB | v30 · Notícias de todos os países: Google Notícias da liga (língua · Correção: «Man United» já não apanha a ficha do «Man City» · Sinais: plantel conhecido ou nome tirado do próprio título · Nome lido do título: o Zé diz de que equipa acha que é, e deixa trocar |
| `newjs16.js` | 4 KB | v31 · revisão a fundo (análise de código + simulação da jornada) |
| `newjs17.js` | 30 KB | v32 · a época toda e a seguinte · Datas: o dia da semana diz o ano · Jogos do dossiê só se juntam ao jogo real da MESMA data · Memória cheia: arruma caches e tenta outra vez · PERFIS DAS EQUIPAS · … (+8) |
| `newjs18.js` | 27 KB | v33 · mercado de transferências · Dinheiro: «40 milhões», «€12.5m», «12,00 M €», «£30m», «500 mil €» → milhões de  · O que é «muito dinheiro» em cada liga (milhões €, compra típica de titular) · Janelas de mercado (datas típicas; cada federação fecha num dia ligeiramente dif · Força do plantel: transferências + valor de mercado + adaptação · … (+5) |
| `newjs19.js` | 11 KB | v34 · YouTube: Fabrizio Romano (e outros canais que quiseres) · Ler um título de mercado: quem compra, quem vende, fechado ou rumor · O Zé junta o YouTube às notícias de cada jogo · Painel «📺 Mercado no YouTube» · Chat |
| `newjs20.js` | 12 KB | v34 · liquidação que não deixa apostas penduradas · Mercados que o resultado NÃO decide: cantos, cartões, remates… · Que jogo é o desta aposta? · Varrimento extra depois do «Atualizar» · Diagnóstico: porque é que esta aposta não fechou? |
| `newjs21.js` | 11 KB | v34 · calendário verificado |
| `newjs22.js` | 10 KB | v35 · ligações à prova de bala · 🩺 Testar ligação (para saberes o que se passa no teu aparelho) |
| `newjs23.js` | 10 KB | v36 · telemóvel e liquidação do utilizador · Leitura no telemóvel · As tuas apostas fecham como as do Zé · Na aba Apostas: o que ficou por fechar, com botões · «Atualizar» falhou? tenta outra vez uma vez |
| `newjs24.js` | 10 KB | v37 · boletins ingleses (Sky Bet, William Hill, Paddy Power, bet365 UK…) |
| `newjs25.js` | 19 KB | v38 · prints de apps de dicas (cartões: liga + hora / casa  ✓  fora / pick + odd |
| `newjs26.js` | 6 KB | v39 · aposta mínima da casa + mercados combinados no «Boletim do Zé» · Aposta mínima (a casa do utilizador não aceita menos) · Mercados combinados («Ambas marcam e mais de 2.5») |
| `newjs27.js` | 9 KB | v40 · contas separadas no mesmo aparelho |
| `newjs28.js` | 4 KB | v41 · ESPN mudou (testado online a 3 nov 2026): intervalos de datas «AAAAMMDD-AA |
| `newjs29.js` | 9 KB | v42 · pedir pouco à ESPN (testado online: ~150 pedidos num minuto → ESPN respond · travão da ESPN · buscar ligas com calma |
| `newjs30.js` | 5 KB | v43 · notícias e YouTube que funcionam online (testado em juliomcm-tech.github.i · ligas que a ESPN não tem |
| `newjs31.js` | 25 KB | v44 · versão de telemóvel, online · 1) boneco dentro da bola · 2) odds das casas (ESPN «core»: Bet365 + DraftKings) · 3) telemóvel: barra em baixo + cabeçalho limpo · 4) calendário: só jogos confirmados pela ESPN · … (+1) |
| `newjs32.js` | 26 KB | v45 · testado online (3 nov 2026, 21h30) · 1) notícias e YouTube sem falhar · 2) nomes de equipas que também são palavras · 3) chat: classificação, comparação, transferências, mercado · 4) odds: quando ainda não há, dizer quando costumam sair · … (+2) |
| `newjs33.js` | 20 KB | v46 · o Zé estuda sozinho e tem um diário de acertos e falhas · 1) gravar a opinião final (até ao apito inicial) · 2) corrigir com os resultados · 3) estatísticas e lições · 4) painel «📒 Diário do Zé» · … (+1) |
| `newjs34.js` | 16 KB | v47 · o Zé como analista profissional · 1) forma de todas as competições + dias de descanso · 3) confiança honesta · 4) diário: Zé contra as casas e CLV · 5) duelo: procurar a melhor odd e apanhar erros de escrita · … (+1) |
| `newjs35.js` | 28 KB | v48 · leitura de boletins à prova de telemóvel · arrumar o que se leu · Boletim do Zé sem jogos que já acabaram · 🩺 testar o leitor · abrir imagens à prova de telemóvel · … (+1) |
| `newjs36.js` | 11 KB | v49 · dicas e boletins: resposta clara no telemóvel |
| `newjs37.js` | 13 KB | v50 · o que a simulação de 540 jogos ensinou · golos esperados: qualidade, nível das ligas, golos na Europa · confiança no mercado por tipo de jogo · «valor» mais apertado · marcadores puxados para as odds das casas · … (+1) |
| `newjs38.js` | 10 KB | v50 · Campo do jogo (substitui o «XI provável» desenhado à mão) |
| `newjs39.js` | 4 KB | v50 · clareza no telemóvel · 🩺 Testar ligação: o que a app usa hoje |
| `newjs40.js` | 15 KB | v50 · ecrãs com dados reais · 1) Scouting · 2) «Hoje» no Início · 3) lembrete de backup |
| `newjs41.js` | 4 KB | v50 · listas de previsões: o 1/X/2 dentro dos quadrados laranja |
| `newjs42.js` | 9 KB | v51 · marcadores: forma recente e defesa do adversário · defesa do adversário |
| `newjs43.js` | 25 KB | v52 · o teu lado do jogo (sem mexer no modelo do Zé) · comum: «unidades» de uma aposta (cada seleção) · 1) CLV: a tua odd contra a odd final · 2) Raio-X · 3) antes do apito · … (+4) |
| `newjs44.js` | 20 KB | v53 · coerência + boletim seguro + log · erros da app (só os últimos 15, curtos) · 1) aposta lógica do modelo atual · 2) «Verificar»: cartões limpos · 3) boletim seguro do Zé · … (+1) |
| `newjs45.js` | 10 KB | v53d · desafios do Zé + jogos adiados · 1) desafios · 2) jogos adiados: desfazer o 0-0 falso |
| `newjs46.js` | 56 KB | v55 · ESPN sem intervalos · H2H real · Continuar certo · Marcadores de hoje · Ao · 1) ESPN: intervalo de datas → mês a mês · 2) H2H real · 3) Continuar = jogo do dia · 4) ⚽ Marcadores de hoje · … (+3) |
| `newjs47.js` | 11 KB | v55c · rapidez (sem mudar contas) · regra do duelo: o Zé nunca aposta abaixo de 1.25 · desafio aceite sai da lista |
| `newjs48.js` | 18 KB | v56 · 📊 Estatísticas do Zé (no «Mais») + travão automático · travão automático · página |
| `newjs49.js` | 3 KB | v56b · auditoria: rapidez do Calendário |
| `newjs50.js` | 14 KB | v57 · 🥇 Selo de ouro + limpeza automática · limpeza automática (o telemóvel guarda dados velhos que já não servem) |
| `newjs51.js` | 9 KB | v58 · fase 1 (sem custos) · 🩺 saúde dos dados · reserva football-data.org quando a ESPN falha |
| `newjs52.js` | 26 KB | v58 · 🧪 Teste do mês (sem ver o futuro), dentro da app · selo de ouro, jogo a jogo por ordem de data (o hist\u00f3rico s\u00f3 tem o pass · poupan\u00e7as: o favorito joga pior quando a seguir tem Europa/Ta\u00e7a (ou ac |
| `newjs53.js` | 9 KB | v59 · 🔥 onde o Zé está quente / ❄️ onde falha (com contas de «é sorte ou é real? · painel nas Estatísticas |
| `newjs54.js` | 6 KB | v60 · 💰 Recarregar banca (sem fechar a época) · 🤖 o Zé também aposta o boletim seguro |
| `newjs55.js` | 2 KB | v60b · aposta lógica estável (a mesma no Início, nos Jogos e nas Estatísticas) |
| `newjs56.js` | 18 KB | v61 · 🤖 Zé em piloto automático · controlos (Definições) |
| `newjs57.js` | 4 KB | v61c · odds derivadas da casa (para o piloto e desafios) · v61c · o piloto liquida apostas antigas (fora da janela de 4 dias do Atualizar) |
| `newjs58.js` | 6 KB | v62 · 🌍 Seleções: Liga das Nações, Qualificações, Euro e Mundial · v62 · ligas novas que passaram no teste (época 26/27, sem ver o futuro, odds da  |
| `newjs59.js` | 3 KB | v62b · revisão das últimas estruturas |
| `newjs60.js` | 19 KB | v63 · medir melhor para decidir melhor · odd de um mercado a partir das odds de uma casa (real ou derivada, como no pilot · margem de erro (intervalo de Wilson a 95%) · regras congeladas · 1) 4.ª carteira: odd a cair (mercado a ir para o lado do Zé) · … (+5) |
| `newjs61.js` | 22 KB | v64 · ⏱️ só os 90 minutos · ☁️ robô na nuvem · ⏱️ jogos com prolongamento / penáltis: as casas pagam pelo resultado aos 90 minu · ☁️ Robô na nuvem · 1) «Atualizar» a partir do robô · 2) piloto na nuvem · … (+1) |
| `newjs62.js` | 26 KB | v65 · 🧾 extrato do piloto (ver, exportar, imprimir) · 🎲 sorte e azar · 📰 relatór · 🧾 extrato de uma carteira do piloto (movimentos com saldo corrente) · exportar: uma linha por aposta, com tudo o que serve para estudar · imprimir / PDF: uma folha limpa, à parte do resto da app · 🎲 sorte e azar: o que é normal acontecer, mesmo a jogar bem · … (+1) |
| `newjs63.js` | 105 KB | v66 · 💰 Finanças em três contas: Tu · Mister Zé · Piloto automático · contas: números de cada uma · apostas de qualquer conta, no mesmo formato · mosaicos das três contas · barra de ferramentas: carteiras do piloto, filtros, exportar, imprimir · … (+22) |
