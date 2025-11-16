Domenyk.com

Este repositório contém o código do Domenyk.com, um blog moderno construído com Next.js (App Router).
O site exibe posts escritos em Markdown, permite leitura interativa, conta views e possui dois sistemas de comentários:
um no final do post e outro diretamente em cada parágrafo.

-----------------------------------------
O que o projeto faz
-----------------------------------------

• Lista posts com busca, ordenação e paginação.
• Renderiza conteúdo Markdown/MDX em HTML.
• Mostra tempo de leitura, data, capa e player de áudio (quando existe).
• Injeta minimapa, referências internas e widgets dentro do próprio conteúdo.
• Possui:
  – Comentários globais em árvore (Mongo + dados antigos de Redis).
  – Comentários por parágrafo, com login via Clerk e undo de deleção.
• Registra views, progresso de leitura e analytics.
• Suporta permissões (visitante, usuário autenticado, admin/staff).

Em resumo: cada post vira uma página interativa, onde o conteúdo controla vários recursos do site.

-----------------------------------------
Tecnologias principais
-----------------------------------------

• Next.js (App Router)
• React + TailwindCSS
• MongoDB
• Redis (legado)
• Clerk (autenticação)
• MDX / Remark / Rehype
• Vercel Analytics

-----------------------------------------
Como rodar localmente
-----------------------------------------

1. Clonar o repositório
git clone https://github.com/SEU-USUARIO/SEU-REPO.git
cd SEU-REPO

2. Instalar dependências
npm install
ou:
yarn
ou:
pnpm install

3. Configurar variáveis de ambiente
Criar um arquivo .env.local com:

MONGODB_URI=...

REDIS_URL=...

CLERK_PUBLISHABLE_KEY=...

CLERK_SECRET_KEY=...

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...

NEXT_PUBLIC_SITE_URL=http://localhost:3000

4. Rodar o projeto
npm run dev

Abrir no navegador:
http://localhost:3000

-----------------------------------------
Build para produção
-----------------------------------------

npm run build
npm start

-----------------------------------------
Licença
-----------------------------------------

Código aberto para estudo. Direitos reservados ao autor.
