This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Use Node.js 22 (see `.nvmrc`) and configure these environment variables in `.env.local`:

- `MONGODB_URI`
- `BLOB_READ_WRITE_TOKEN`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SIGNING_SECRET` (signing secret for the Clerk webhook)
- `ADMIN_USER_ID`
- `NEXT_PUBLIC_SITE_URL`
- `CLERK_AUTHORIZED_PARTIES` (comma-separated trusted origins, when using previews or extra domains)
- `REQUEST_IDENTITY_SECRET` (recommended separate HMAC secret for rate limits and view deduplication; falls back to `CLERK_SECRET_KEY`)
- `VAPID_PUBLIC_KEY` (public Web Push key)
- `VAPID_PRIVATE_KEY` (private Web Push key; never expose it to the browser)
- `VAPID_SUBJECT` (a contact URI such as `mailto:you@example.com`)
- `INDEXNOW_KEY` (8–128 hexadecimal characters; enables best-effort URL notifications to IndexNow)

Generate the Web Push key pair once with:

```bash
npm run push:keys
```

Copy the generated values to `.env.local` and to the corresponding Vercel environment variables. Keep the same pair across deployments; replacing it invalidates existing browser subscriptions.

## API Go externa — integração inicial

A página `/links` e o painel `/admin/links` usam a API Go. O painel permite
cadastrar, editar, ocultar e excluir links, buscar entre 25 ícones e definir
seção e ordem. O cadastro aceita domínios sem HTTPS, sugere o título pelo domínio,
mostra uma prévia e coloca novos links no fim da seção. O ícone padrão é o favicon:
links internos usam `/favicon.ico`; externos usam o serviço Google S2, enviando
apenas o hostname, sem caminhos ou parâmetros. Se a imagem falhar, aparece um globo. Os dados são persistidos pelo Go na coleção MongoDB `links`.
Configure `GO_ADMIN_API_URL` para as operações administrativas e a leitura
dos links. A leitura pública usa `CONTENT_API_URL` se a primeira estiver ausente.
Não há fallback de escrita direto no MongoDB para os links.
Se a API tiver proteção de automação na Vercel, configure no servidor Next
`GO_API_AUTOMATION_BYPASS_SECRET` com a credencial de bypass do projeto da API.
Ela segue apenas no cabeçalho das chamadas à API e não substitui a autenticação Clerk.
Os links já publicados continuam visíveis antes de salvar a configuração inicial da página.

A página pública usa abertura tipográfica sem retrato, links em linha, capas
opcionais e seções configuráveis. Todo o conteúdo pessoal da página é salvo
pelo painel; não há slogan, seleção de posts ou títulos de seções fixos na renderização.

O carrossel combina o texto ou nota mais recente com até duas escolhas manuais,
sem repetir conteúdos. Leituras guarda escolhas fixas de textos, notas ou links.
O painel também oferece envio de capas e biblioteca via Go, inclusão de conteúdos
do site, cadastro em lote, ordenação por arraste ou setas, horários opcionais de
publicação, avisos de duplicação, verificação de endereços e contagem de cliques.

Publique primeiro a versão correspondente de `domenyk-api`, com os endpoints
`/v1/links/page`, `/v1/links/click` e `/v1/admin/links/{settings,content,order,stats}`,
além do CRUD e `POST /v1/admin/links/{id}/check`. A configuração usa `link_pages`;
`link_clicks` mantém contagens agregadas, sem identificação dos visitantes.
Nenhuma escrita da nova página usa MongoDB diretamente pelo Next.js.

Após publicar, abra `/admin/links`, preencha “Página e seções” e salve. Escolha os
conteúdos em “Destaques e leituras”. A prévia não publica nem conta cliques.
Conteúdo removido, despublicado ou fora do período não é exibido publicamente.
A administração exige a sessão Clerk do `ADMIN_USER_ID` configurado nos dois projetos.
A API antiga `/api/links/latest-note` permanece disponível por compatibilidade.

O admin de artigos pode usar o Go por `GO_ADMIN_API_URL` (somente servidor).
A integração cobre listagem, editor, gravação, publicação, exclusão, traduções
e vínculos com séries/temas. Os tokens são obtidos da sessão Clerk e validados
novamente pelo Go. Sem essa variável, o painel mantém o caminho anterior;
falhas da API configurada não acionam fallback de escrita.

Para desenvolvimento local, use `pk_test_...` e `sk_test_...` da mesma instância
Development, com o `ADMIN_USER_ID` dessa instância. `MONGODB_DATABASE` permite
usar um banco isolado (`blog` permanece o padrão). `ADMIN_LOCAL_PREVIEW=true`
mostra o aviso de ambiente de teste, somente em desenvolvimento.

Configure `CONTENT_API_URL` no servidor Next com a origem HTTPS da API Go,
por exemplo `https://domenyk-api.vercel.app`. A variável não deve usar o prefixo
`NEXT_PUBLIC_`. O mural e a seção de textos em escrita passam a consultar
`/v1/mural` e `/v1/writing` pelo servidor. A renderização do conteúdo continua
usando o editor e o sanitizador existentes do blog.

Sem essa variável, os dois fluxos continuam consultando MongoDB diretamente.
Com a variável configurada, erros da API são propagados; não há fallback
silencioso. Para reverter a integração, remova a variável e faça novo deploy.
Em desenvolvimento, também é permitida uma origem HTTP em localhost.

As consultas públicas de artigos, notas, timeline, temas e séries ainda usam
a implementação atual do Next. A administração de artigos usa Go somente
quando `GO_ADMIN_API_URL` está configurada; as outras áreas permanecem no Next.
O `MONGODB_URI` do blog deve ser mantido durante esta migração.

O callback opcional `POST /api/internal/revalidate` recebe invalidações do Go.
Defina o mesmo `NEXT_REVALIDATE_SECRET` (ao menos 32 caracteres) nos dois
projetos, e `NEXT_REVALIDATE_URL=https://domenyk.com/api/internal/revalidate`
na API. O callback exige Bearer e aceita somente caminhos locais limitados.

Configure a Clerk webhook endpoint at `https://your-domain.example/api/webhooks/clerk`, subscribe it to `user.created`, and store its signing secret in `CLERK_WEBHOOK_SIGNING_SECRET`. Account notifications are deduplicated automatically when Clerk retries a delivery.

When `INDEXNOW_KEY` is configured, the site exposes it at `/indexnow-key.txt` and notifies IndexNow after publishing, updating, hiding, unpublishing, changing a URL, or deleting indexable content. Failed notifications never block an editorial save.

## Importação da Mesa Editorial

Em `/admin/notes`, a seção **Importar revisão editorial** aceita o arquivo `domenyk-editorial-import.json` exportado pela ferramenta local `/home/leite/wiki/tools/editorial-workbench`. O site mostra uma prévia antes de aplicar qualquer mudança.

O pacote encontra cada nota por `sha256(normalize(content))`, porque os IDs do arquivo bruto e os IDs MongoDB são diferentes. Correspondências ausentes, duplicadas ou ambíguas bloqueiam a aplicação. Depois da confirmação, unidades revisadas atualizam o conteúdo das partes correspondentes; unidades arquivadas são excluídas junto com seus comentários e imagens associadas. O cache público e o IndexNow são invalidados após a operação.

## SEO data migration

Preview the additive post migration without writing to the database:

```bash
npm run seo:migrate:dry
```

Applying it requires a new, empty backup directory outside the repository and `MIGRATION_BACKUP_PASSPHRASE` with at least 16 characters. Every collection is exported as encrypted canonical EJSON with restricted permissions, collection options, indexes, document counts, and SHA-256 hashes before any post is changed:

```bash
node --env-file-if-exists=.env.local scripts/migrate-post-seo.mjs --apply --backup-dir=/safe/path/new-backup
npm run seo:migrate:verify -- --backup-dir=/safe/path/new-backup
```

Mongo validators can be reviewed with `npm run db:validators:dry`. Applying them requires a separate database-administration credential in `MONGODB_ADMIN_URI` and the explicit `--apply --confirm=APLICAR-VALIDADORES` flags; the application credential remains restricted to `readWrite` on `blog`.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/(public)/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

O card de músicas em `/links` consulta `/api/links/music` a cada 15 segundos.
Usa a mesma origem Go configurada para links (`GO_ADMIN_API_URL` ou
`CONTENT_API_URL`). O segredo do dispositivo pertence somente ao Music Go e ao
projeto Go da API; nenhuma variável pública de música é necessária no Next.
O card mostra somente a música em reprodução, com capa, título, artista e uma
busca no YouTube baseada no título. Não reproduz áudio nem exibe o ranking.
Quando a reprodução para ou expira, o card fica oculto. Configuração e contrato
completos estão em `../domenyk-api/docs/deployment.md`, na seção de Music Go.

O bloco “Assistindo agora” segue o mesmo fluxo com o backend Go: a extensão
própria para Brave envia eventos autenticados para `/v1/watching/events`; o
site consulta `/api/links/watching` a cada 15 segundos. Pausar mantém o bloco;
terminar ou sair do player o oculta. O estado expira após 45 segundos sem sinal. Instalação e configuração
em [extensions/netflix/README.md](extensions/netflix/README.md).
A API Go completa capas ausentes com o TVmaze, sem chave adicional, e mantém
o resultado em cache por 24 horas. Títulos ambíguos não recebem capa automática;
o crédito e a licença da fonte estão na página “Sobre”.

## Dashboard de administração

A visão geral (`/admin`) usa componentes incorporados manualmente do
[shadcn/ui, estilo New York](https://ui.shadcn.com/blocks/dashboard), adaptados em
`src/components/ui` (licença MIT incluída). Os componentes de origem são
[Button](https://ui.shadcn.com/r/styles/new-york/button.json),
[Card](https://ui.shadcn.com/r/styles/new-york/card.json) e
[Table](https://ui.shadcn.com/r/styles/new-york/table.json).
As variantes de botão usam classes diretas, sem Slot ou `asChild`; links usam
`next/link` com `buttonVariants`. A navegação móvel usa `<dialog>` nativo.

Os tokens e utilitários têm o namespace `admin-`, em
`src/app/admin/admin.css`, para conviver com o tema público e com Astryx.
Ao incorporar outros componentes shadcn, adapte seus tokens para esse namespace.
As telas de gestão internas continuam usando Astryx e seus providers; a
navegação compartilhada e a visão geral usam a nova interface. Os dados vêm do
mesmo `loadAdminDashboard`, e a autorização continua no layout do admin.
