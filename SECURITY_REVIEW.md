# Revisão de Segurança e Estrutura de Rotas

## Visão geral da arquitetura de rotas
- **Middleware (`src/middleware.ts`)**: usa Clerk para autenticação. Rotas públicas são `/`, `/sign-in`, `/sign-up`, `/posts/*` e um conjunto explícito de APIs (`/api/analytics/collect`, `/api/posts*`, `/api/search-posts`, `/api/comments*`, `/api/post-references*`). Demais rotas de API exigem usuário autenticado. Rotas administrativas são `/admin`, `/admin/editor*`, `/staff*` e `/admin/api*`; acessos não admin são redirecionados para `/`.
- **Páginas públicas**: home (`/`), listagem e leitura de posts (`/posts/[id]`), `robots.txt`, `sitemap`, erro 404. A home e posts ajustam a visibilidade de posts escondidos apenas para admins.
- **Páginas protegidas de admin**: dashboard (`/admin`), gestão de usuários (`/admin/users`), editor de posts (`/admin/editor`), analytics (`/admin/analytics`), checagem (`/admin/check`). Cada página revalida o papel via `resolveAdminStatus` e retorna 404 se não for admin.
- **Rotas de API**:
  - `/api/posts` (GET) — retorna posts com paginação, respeitando `hidden` para visitantes; admins podem pedir `includeHidden=true`.
  - `/api/search-posts` (GET) — busca posts públicos com limites de tamanho, paginação e rate limit.
  - `/staff/[...action]` (POST) — ações internas (ex.: `deletePost`) via whitelist; exige admin e valida entradas.
  - `/api/admin/analytics/toggle` (GET/POST) — só admins; lê e atualiza o flag `analyticsEnabled` salvo na coleção `settings`.

## Avaliação de autenticação/autorização
- **Aplicação de papéis**: o middleware deriva o papel da sessão Clerk e exige autenticação para qualquer API fora da lista pública. Rotas administrativas de página também chamam `resolveAdminStatus` no servidor, reforçando a checagem. Apenas admins acessam `/admin` e `/staff`.
- **Rotas de API públicas controladas**: apenas as APIs listadas como públicas aceitam visitantes; demais requerem login. `/api/posts` e `/api/search-posts` agora têm rate limit e filtros de visibilidade.
- **Papel moderator**: o papel continua definido, mas privilégios são claros no código (`ROLE_PRIVILEGES`), sem acesso ao painel admin.

## Superfícies de ataque e validações
- **Divulgação de posts ocultos via API**: `/api/posts` agora respeita `hidden` para visitantes e só mostra ocultos a admins com `includeHidden=true`.
- **Validação de entrada fortalecida**:
  - `/api/posts` valida paginação e aplica limite máximo, com rate limit.
  - `/api/search-posts` limita tamanho de `query`, aplica paginação/rate limit e usa regex escapada para evitar padrões pesados.
  - `/staff/[...action]` utiliza whitelist de ações e validação estrita do payload.
- **Formulários e ações do admin**: ações de role (`setRole`, `removeRole`) dependem do `resolveAdminStatus`; não há CSRF tokens além da proteção implícita de Server Actions.
- **Suspensão de analytics**: o flag `analyticsEnabled` fica no MongoDB e desliga imediatamente `/api/analytics/collect`, que passa a responder 403/204 sem persistir eventos.

## Exposição de informações sensíveis
- **Logs de servidor**: logs das APIs foram reduzidos para evitar vazamento de dados de posts ou stack traces completos.
- **Env vars**: não há mais uso de `XAI_API_KEY`; o chatbot foi removido.
- **Dados internos**: `/admin/check` consome `/admin/api/check` que não existe; eventual implementação poderá ficar exposta se não houver guard adequado.

## Rotas soltas/inconsistentes
- `/api/posts` agora respeita `hidden` para visitantes e limita o volume retornado.
- Middleware separa explicitamente APIs públicas de privadas, exigindo autenticação por padrão.
- Papel "moderator" não possui acesso ao painel admin; privilégios estão documentados em `ROLE_PRIVILEGES`.

## Recomendações
1. **Endurecer middleware de API**: concluído – `/api/*` não é mais público por padrão; apenas rotas whitelisted aceitam visitantes.
2. **Proteger APIs administrativas/privadas**: concluído – `/api/posts` respeita `hidden` e só mostra ocultos a admins; `/staff/[...action]` exige admin.
3. **Respeitar flag `hidden`**: concluído – filtro aplicado em `/api/posts` e buscas.
4. **Sanitização de HTML no chat**: concluído via remoção do chatbot/XAI e sanitização do renderer Markdown.
5. **Rate limiting e auditoria**: concluído – rate limit em `/api/posts` e `/api/search-posts`; logs sensíveis reduzidos.
6. **Whitelisting de ações internas**: concluído – whitelist explícita em `/staff/[...action]`.
7. **Alinhamento de papéis**: concluído – papéis e privilégios definidos em `ROLE_PRIVILEGES`; apenas admin acessa painel.
8. **Redução de logs sensíveis**: concluído – removidos logs de payloads e env vars sensíveis.
