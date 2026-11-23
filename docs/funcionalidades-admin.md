# Funcionalidades do painel de admin

Inventário das funcionalidades das 12 áreas principais do painel, incluindo as telas de criação, detalhes e edição. Serve como referência funcional, sem avaliação visual ou da construção técnica.

A interface foi reconstruída com Astryx. As consultas permanecem em arquivos `data.ts` e as ações e os estados em hooks `use*.ts`, separados dos componentes visuais. APIs, autenticação e regras de dados continuam preservadas.

## 1. Visão geral

Rota: `/admin`.

- Consultar visualizações, visitantes, comentários, quantidade de posts e ações autenticadas.
- Acompanhar visualizações e comentários dos últimos 14 dias.
- Consultar os posts mais lidos e abrir suas páginas públicas.
- Ver atividades recentes, com conteúdo acessado, identificação do visitante e horário.
- Criar um novo post.
- Baixar um backup do banco de dados.

## 2. O que estou escrevendo

Rota: `/admin/escrevendo`.

- Cadastrar títulos de textos em andamento.
- Definir e atualizar manualmente o progresso de 0% a 100%.
- Editar os títulos cadastrados.
- Marcar um texto como concluído, retirando-o da lista pública da home.
- Retomar a escrita de um texto concluído.
- Consultar separadamente os textos em andamento e concluídos.

Chegar a 100% não conclui o texto automaticamente: existe uma ação específica para isso.

## 3. Posts

Rota: `/admin/posts`.

- Listar posts publicados e rascunhos.
- Buscar por título, endereço, identificador, resumo, tags e informações das traduções.
- Filtrar por publicação e visibilidade na timeline.
- Consultar visualizações, tempo de leitura, data, estilo e situação das traduções.
- Identificar posts fixados, ocultos e pertencentes a séries.
- Publicar, despublicar, fixar e desafixar posts.
- Selecionar vários posts para ocultar da timeline, exportar ou excluir.
- Exportar textos em Markdown.
- Escolher quais colunas aparecem na listagem.
- Abrir os detalhes, editar ou criar posts.

### Detalhes do post

Rota: `/admin/posts/[id]`.

- Consultar resumo, endereço, datas de criação, publicação e atualização.
- Ver visualizações, tempo de leitura e estilo.
- Consultar situação de publicação, fixação, timeline e comentários por parágrafo.
- Ver a situação do SEO e os temas relacionados.
- Abrir o post publicado ou acessar sua edição.

### Criação e edição de posts

Rotas: `/admin/posts/new` e `/admin/posts/[id]/edit`.

- Escrever título, descrição editorial, resumo e conteúdo.
- Preparar versões em português, inglês, alemão e indonésio.
- Salvar, publicar e despublicar cada versão.
- Identificar alterações não salvas e traduções que precisam de revisão.
- Definir endereço, título SEO e descrição SEO, com prévia de busca.
- Cadastrar tags e fontes de referência.
- Escolher o estilo do post.
- Controlar sua presença na timeline.
- Vincular o post a uma série e a temas.
- Selecionar coautor e informar sua imagem.
- Enviar ou informar uma imagem de capa e controlar sua exibição na timeline.
- Informar uma URL de áudio.

O editor também oferece formatação de texto e parágrafos, títulos, citações, imagens, bloco “Leia também”, escolha entre Markdown e HTML e, no modo HTML, edição de código e CSS com prévia.

## 4. Séries

Rota: `/admin/series`.

- Consultar as séries, sua situação de publicação e quantidade de capítulos.
- Criar uma série ou abrir uma existente.

### Criação e edição de séries

Rotas: `/admin/series/new` e `/admin/series/[id]`.

- Definir título, endereço e apresentação.
- Buscar e adicionar posts como capítulos.
- Reordenar e remover capítulos.
- Transferir um post que pertence a outra série.
- Consultar quantidade de capítulos e tempo total de leitura.
- Publicar ou manter a série em rascunho.
- Iniciar um novo post já associado à série existente.
- Abrir a série publicada.
- Excluir a série, preservando os posts.

## 5. Notas

Rota: `/admin/notes`.

- Listar e buscar notas pelo título, título SEO e conteúdo.
- Consultar data de publicação, visualizações diretas e situação de indexação.
- Identificar notas pertencentes a threads.
- Exportar as notas encontradas em Markdown.
- Importar um pacote de revisão editorial, conferir a prévia e confirmar atualizações e exclusões.
- Importar títulos e descrições SEO em lote, com prévia.
- Baixar o guia do formato de importação SEO.

### Edição de notas

Rota: `/admin/notes/[id]`.

- Editar o título opcional e o conteúdo com o editor de texto.
- Preencher título e descrição SEO para liberar a indexação.
- Consultar uma prévia de resultado de busca.
- Ver visualizações diretas e exposições na home e na página de notas.
- Consultar estimativa de leitura, complexidade e critérios de exposição na timeline.
- Abrir a nota no site e acessar a thread, quando houver.
- Salvar alterações ou excluir a nota.

## 6. Links

Rota: `/admin/links`.

A área possui quatro abas.

| Aba | Funcionalidades |
| --- | --- |
| Links | Criar, editar e excluir links; adicionar conteúdo do próprio site; cadastrar até 50 endereços por vez; escolher seção, ícone, descrição e imagem; habilitar publicação; agendar início e fim de exibição; ordenar por setas ou arraste; abrir e verificar o endereço; identificar duplicados e situação de publicação. |
| Página e seções | Editar chamada principal, apresentação, título e descrição para buscas e compartilhamento; criar, renomear, ordenar e excluir seções; escolher entre links em linha e cartões. |
| Destaques e leituras | Incluir automaticamente a publicação mais recente; selecionar até dois destaques manuais; escolher até 20 leituras fixas; personalizar títulos, descrições quando disponíveis e capas; ordenar e remover seleções. |
| Cliques | Consultar totais dos últimos 7, 30 ou 90 dias, distribuição diária e ranking de conteúdos clicados. |

Também permite mostrar ou ocultar a prévia da página, abrir a versão pública e escolher imagens por envio, biblioteca ou endereço.

## 7. Temas

Rota: `/admin/temas`.

Aqui, “temas” são coleções de textos.

- Consultar os temas existentes, sua situação e quantidade de posts.
- Criar um tema ou editar um existente.

### Criação e edição de temas

Rotas: `/admin/temas/new` e `/admin/temas/[id]`.

- Definir nome, endereço e descrição.
- Buscar posts e adicioná-los à coleção.
- Ordenar os textos e retirar itens da seleção.
- Ativar ou desativar a página pública e sua indexação.
- Abrir o tema ativo no site.
- Excluir o tema, preservando os posts.

Um mesmo post pode participar de vários temas.

## 8. Comentários

Rota: `/admin/comments`.

- Consultar comentários recentes de posts e notas.
- Buscar por autor, conteúdo ou título do conteúdo comentado.
- Filtrar entre comentários de posts e de notas.
- Identificar comentários vinculados a parágrafos.
- Abrir o conteúdo correspondente no admin ou a conversa no site.
- Consultar os detalhes completos do registro do comentário.
- Excluir comentários.

## 9. Mensagens

Rota: `/admin/messages`.

- Consultar a caixa de entrada e as conversas arquivadas.
- Abrir conversas e carregar assuntos anteriores.
- Ler mensagens e enviar respostas.
- Consultar datas e confirmação de leitura das próprias respostas.
- Aceitar ou negar sugestões.
- Encerrar e reabrir conversas.
- Arquivar e desarquivar assuntos.
- Exportar uma conversa em Markdown.
- Excluir o assunto e todas as respostas.

## 10. Notificações

Rota: `/admin/notificacoes`.

- Consultar quantidades de dispositivos e inscritos em posts e notas.
- Controlar se visitas ao site ficam salvas na central de notificações.
- Controlar o envio de visitas por push.
- Consultar a situação da configuração de avisos de novas contas.
- Selecionar um post ou nota publicado para divulgação.
- Personalizar título e mensagem do push, visualizar a prévia e confirmar o envio.
- Ativar ou desativar notificações no dispositivo atual.
- Escolher quais eventos administrativos receber: contas, comentários, conversas, respostas e visitas.
- Listar dispositivos administrativos e revogar seus alertas privados, individualmente ou em conjunto.
- Consultar disparos recentes, com origem manual ou automática, envios e falhas.

## 11. Mídia

Rota: `/admin/media`.

- Enviar imagens por seleção de arquivo ou arraste.
- Usar arquivos SVG, PNG, JPG e WebP.
- Consultar as imagens da biblioteca, seus nomes e tamanhos.
- Copiar o endereço de uma imagem.
- Excluir arquivos da biblioteca.

## 12. Pessoas

Rota: `/admin/users`.

- Consultar contas cadastradas.
- Ver nome, foto, e-mail e identificador.
- Consultar papel da conta, quantidade de comentários e data de cadastro.

Essa página oferece consulta, sem ações para editar contas ou alterar permissões.

## Recursos compartilhados do painel

- Navegação entre as áreas.
- Retorno ao site público.
- Alternância entre tema claro e escuro.
- Gerenciamento da própria conta e saída da sessão.
- Em caso de erro, tentativa de recarregamento ou retorno à visão geral.

## Escopo da verificação

As funcionalidades foram identificadas nos arquivos das páginas e seus componentes. As ações não foram executadas no navegador; este levantamento descreve os recursos presentes, sem validar seu funcionamento em uso.
