# Limitações conhecidas

## Reconhecimento visual

- **Ainda não foi testado com fotos reais de celular.** O teste usa cartas e imagens nunca vistas
  pelo modelo, mas a parte da "câmera" é simulada (perspectiva, reflexo, tremor, compressão).
  A rodada com aparelho e objetos físicos é a próxima validação importante.
- **Brinquedos, pelúcias e figuras 3D têm pouca representação no treino.** O acerto tende a ser menor
  do que o medido em cartas e ilustrações.
- **Um Pokémon por vez.** O modelo classifica a imagem inteira e não localiza objetos. Com vários
  Pokémon, responde sobre o que predomina. Cartas com dois Pokémon ficaram fora do treino.
- **Identifica a espécie, não a forma.** Mega, formas regionais e Shiny são reconhecidas como a
  espécie base. A ficha aberta é sempre a forma padrão.
- **Espécies parecidas se confundem**, como estágios de uma mesma evolução. As alternativas
  mostradas no resultado existem para isso.
- **Personagens que não são Pokémon, mas têm visual parecido** (outras franquias, fan art), podem
  ser confundidos. A classe negativa aprendeu com fotos e cartas de Treinador, não com outros desenhos.
- **Gerações mais novas têm desempenho um pouco menor**, porque há menos arte disponível para treino.
- A confiança é calibrada com cartas e simulação. Em objetos físicos, ela pode ficar otimista.

## Dados e texto

- **A PokéAPI não tem textos em português.** Foi preciso traduzir:
  - nomes de Pokémon: seguem o padrão internacional usado no Brasil, igual ao inglês;
  - categorias ("Pokémon Semente"), tipos, regiões, formas e efeitos de habilidade: tradução manual,
    sem revisão por fonte oficial, então pode haver diferenças em relação aos termos dos jogos;
  - nomes de habilidades: mantidos em inglês;
  - **descrições: tradução automática**, rotulada na tela, com link para o original. Há frases
    estranhas e unidades do original, como pés e Fahrenheit.
- Condições de evolução por local aparecem como "Em local específico", porque variam por jogo.
- Formas alternativas herdam a raridade e a descrição da espécie.
- A raridade é uma criação do projeto, baseada em dados dos jogos. Não reflete preço de mercado.
- Os dados são um retrato do momento do build. Novidades da PokéAPI exigem `npm run data:update`.

## Narração

- Depende das vozes instaladas no aparelho. Qualidade e sotaque variam, e pode não haver voz em
  português. Testada com vozes reais no Windows (Edge e Chrome). No Android, foi testada com um
  simulador baseado no código do Chromium; ainda falta confirmar em aparelhos reais, Android e iOS.
- Nomes de Pokémon são lidos com pronúncia portuguesa, que nem sempre é a usual.
- O texto é falado em trechos de até 150 caracteres. Algumas vozes fazem uma pequena pausa entre eles.
- **Nunca use `speechSynthesis.pause()` neste projeto.** No Chrome para Android, ele encerra a fala em
  vez de pausar, e a página não recebe nenhum evento (`tts_android.cc`). Por isso não há botão de pausa,
  só parar e repetir.
- Ao trocar de app ou bloquear a tela, o celular pode interromper a voz. A narração espera e retoma do
  trecho interrompido quando a pessoa volta, o que pode repetir uma frase.
- Na primeira abertura depois de uma nova versão, o app se atualiza e recarrega uma vez, o que encerra
  uma narração iniciada naquele instante.

## Câmera e plataforma

- **A câmera exige HTTPS.** No GitHub Pages isso é automático. Pela rede local é preciso usar
  `DEV_HTTPS=1` e aceitar o aviso de certificado. O envio de foto funciona em qualquer caso.
- O pedido de permissão foi conferido no Chrome para Windows, no site publicado, e o fluxo completo foi testado com câmera simulada. A janela de permissão de
  celulares ainda precisa ser conferida em aparelhos reais, especialmente Safari no iOS.
- **WASM com uma thread.** O GitHub Pages não permite os cabeçalhos COOP/COEP, necessários para
  várias threads. O tempo de análise é aceitável, mas celulares antigos podem ficar lentos no modo ao vivo.
- O primeiro uso do scanner baixa cerca de 14 MB (modelo de 10,4 MB e motor comprimido de 3,9 MB). Depois fica em cache.
- A lista de instalação do PWA varia: no iOS, é preciso usar "Adicionar à Tela de Início".

## Offline

- Funciona sem internet: aplicativo, busca, filtros, favoritos e fichas já visitadas.
- O scanner funciona sem internet depois de usado uma vez.
- Fichas nunca abertas e artes em alta resolução não visitadas precisam de conexão. As miniaturas
  só ficam disponíveis depois de exibidas.

## Riscos da publicação

- **Direitos autorais.** Pokémon, nomes, imagens e textos pertencem à Nintendo, Creatures Inc. e
  GAME FREAK. Este é um projeto de fã, sem fins lucrativos, mas um repositório público contém
  miniaturas e um modelo treinado com essas imagens, e os detentores podem pedir a remoção.
  Não use comercialmente nem colete dinheiro com o projeto.
- **Licenças dos dados de treino.** O conjunto `JJMack/pokemon-classification-gen1-9`
  (CC BY-NC-SA) ficou de fora do treino de propósito e foi usado só como referência de avaliação.
- O código não tem licença definida. Sem uma, outras pessoas não têm permissão formal de reutilizá-lo.
