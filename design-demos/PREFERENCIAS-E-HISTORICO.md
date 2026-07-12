# Preferências e histórico de design

Atualizado em 12 de julho de 2026.

Este arquivo registra os pedidos, decisões e padrões de gosto do Domenyk. Consulte-o antes de criar ou alterar interfaces do site. Atualize o documento quando um novo feedback mudar ou detalhar alguma preferência.

## Pedido que originou o protótipo Opinion

> “Tem um outro estilo chamado ‘Opinion’. Seja criativo e gere um protótipo em HTML de como seria ele. Não preserve nada do que já fizemos antes. A única regra: ele deve obedecer ao container, não deve fugir da regra como o Editorial.”

Resultado aprovado: [`opinion-coluna-conviccao.html`](./opinion-coluna-conviccao.html).

Feedback recebido:

> “Isso ficou muito bom. Ainda tem melhorias que eu faria, mas ficou muito bom mesmo.”

O que funcionou nesse protótipo:

- identidade visual própria para o tipo de post;
- título forte sem ultrapassar o container;
- posição do autor tratada como parte da interface;
- argumentos numerados, contraponto e conclusão;
- cor ácida usada com intenção;
- interação final que pergunta a posição do leitor;
- liberdade criativa sem copiar os estilos anteriores.

## Histórico dos pedidos

### SEO e estrutura pública

1. Analisar o SEO do projeto e sugerir melhorias.
2. Explicar quais mudanças afetariam o visual antes de aplicá-las.
3. Corrigir todos os problemas encontrados.
4. Remover o breadcrumb visível dos posts. Dados estruturados podem existir sem aparecer na interface.
5. Criar página Sobre, páginas de temas, metadados e sitemaps sem poluir o site.

### Notas, imagens e estabilidade

1. Restaurar o `border-radius` das imagens das notas.
2. Reduzir o espaço excessivo entre a nota e o conteúdo acima.
3. Reservar a largura da scrollbar para evitar layout shift entre páginas curtas e longas.
4. Remover o grayscale da imagem usada no menu.
5. Manter capas importantes em cores quando o filtro não acrescentar significado.

### Editorial

1. Desenvolver um estilo de leitura inspirado em jornal, com capitular, divisão da página, tipografia forte e integração inteligente com o site.
2. Criar protótipos HTML antes da integração.
3. Explorar estilos além das primeiras opções e propor caminhos não solicitados quando fizerem sentido.
4. Corrigir a capa quando ela parecer encaixada ou apertada.
5. Usar um artigo completo no protótipo para avaliar ritmo, não apenas uma abertura curta.
6. Diferenciar posts editoriais já na home sem alterar a estrutura geral da timeline.
7. Na home, mostrar a capa acima e o título abaixo, sem data, em fonte mono, caixa alta e próxima da Geist Mono.
8. Integrar o estilo “Dossiê de argumentos” como tela real de posts editoriais.

Protótipos relacionados:

- [`editorial-jornal-contemporaneo.html`](./editorial-jornal-contemporaneo.html)
- [`editorial-revista-analise.html`](./editorial-revista-analise.html)
- [`editorial-dossie-argumentos.html`](./editorial-dossie-argumentos.html)

### Timeline, busca e paginação

1. Redesenhar a paginação para reduzir o peso do estado ativo e organizar melhor anterior, páginas e próxima.
2. Corrigir a janela numérica da paginação. Na página 2, mostrar `1, 2, 3`, não `2, 3, 4`.
3. Transformar os filtros Tudo, Posts e Notas em uma dock inspirada na densidade visual da Linear.
4. No desktop, manter a dock fixa à esquerda da timeline, vertical e com ícones.
5. Mostrar nome e quantidade em tooltip no hover ou foco.
6. No celular, usar uma dock horizontal fixa na parte inferior.
7. Deixar a cápsula arredondada, estreita e rente aos itens.
8. Usar itens menores no desktop e um pouco maiores no celular.
9. Indicar o filtro selecionado com fundo próprio e um ponto rosa.
10. Afinar o campo de busca.
11. Aplicar a busca sem depender de Enter, usando uma pausa segura para não disparar a cada tecla.
12. Manter Enter e o botão de limpar como ações imediatas.

### Menu público e conta

1. Na home, deixar apenas Tema e Sobre como opções de navegação.
2. Dentro de posts, acrescentar Início e Notas.
3. Colocar Tema acima de Sobre.
4. Substituir a linha “Gerenciar conta” por uma engrenagem compacta ao lado dos dados do usuário.
5. Fazer a engrenagem abrir uma segunda tela dentro do próprio menu.
6. Na tela de conta, oferecer Gerenciar conta, Sair e um controle para voltar.
7. Abrir o Clerk somente depois que o usuário escolher Gerenciar conta nessa segunda tela.

### Opinion

1. Criar uma linguagem nova, sem herdar a composição do Editorial.
2. Respeitar o container padrão de `36rem` em todos os elementos.
3. Assumir liberdade criativa e apresentar uma ideia que o pedido não descreveu em detalhes.
4. Tratar opinião como voz, posição e margem de dúvida, não como versão reduzida de uma matéria jornalística.

## Como Domenyk prefere trabalhar

### Processo

- Para mudanças grandes, criar HTMLs isolados antes de integrar ao site.
- Usar conteúdo completo nos protótipos. Uma tela bonita com texto curto não demonstra a leitura real.
- Mostrar diferenças visuais concretas. Domenyk decide melhor vendo versões do que escolhendo descrições abstratas.
- Integrar depois da aprovação da direção.
- Aceitar iteração por screenshot e corrigir o detalhe apontado sem refazer áreas aprovadas.
- Quando houver liberdade criativa explícita, propor uma linguagem própria em vez de recombinar soluções anteriores.

### Aparência

- Preferir interfaces compactas, textuais e com pouco chrome.
- Evitar controles altos, largos ou com padding sobrando.
- Usar arredondamento com proporção. Cápsulas e botões circulares devem abraçar o conteúdo.
- Dar um indicador inequívoco ao item selecionado.
- Manter a identidade escura e monocromática do site, mas permitir uma cor forte quando ela define um tipo de conteúdo.
- Usar rosa como acento funcional do sistema existente.
- Permitir outra cor em estilos autorais quando ela tiver uma função clara, como o verde ácido do Opinion.
- Não exibir elementos técnicos de SEO na interface.
- Evitar grayscale em imagens de identidade e capas quando a cor fizer parte da imagem.

### Layout e responsividade

- Respeitar o container estreito do site por padrão.
- Expandir além dele somente quando o estilo aprovado exigir isso, como no Editorial.
- Projetar desktop e celular como composições próprias, não apenas reduzir tamanhos.
- No desktop, controles auxiliares podem ocupar a lateral sem deslocar o conteúdo.
- No celular, controles fixos devem ficar ao alcance do polegar e preservar a área segura inferior.
- Evitar layout shift, overflow horizontal e mudanças de largura causadas pela scrollbar.

### Tipografia e conteúdo

- Gostar de títulos fortes e composições tipográficas com personalidade.
- Manter corpo de texto confortável para artigos completos.
- Usar mono e caixa alta quando isso sinalizar um tipo de post, não como decoração genérica.
- Diferenciar cada estilo de post pela experiência de leitura, não apenas por uma etiqueta ou cor.
- Preservar dúvidas, contrapontos e voz autoral quando o formato for Opinion.

## Checklist para futuras mudanças

Antes de entregar uma nova interface:

- [ ] A mudança respeita o container definido para esse tipo de página?
- [ ] O estado ativo está claro?
- [ ] Os controles estão compactos e sem padding sobrando?
- [ ] Desktop e celular foram avaliados separadamente?
- [ ] A página foi testada com conteúdo longo e realista?
- [ ] A mudança preserva funcionalidades já aprovadas?
- [ ] Elementos de SEO continuam invisíveis para o leitor?
- [ ] Não há layout shift nem overflow horizontal?
- [ ] Se a direção for grande, existe um protótipo HTML aprovado?
- [ ] A solução tem identidade própria ou apenas repete um estilo anterior?
