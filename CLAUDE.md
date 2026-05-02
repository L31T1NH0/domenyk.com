# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Never make changes beyond exactly what the user requested. If an adjacent or extra change seems useful, ask first.
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# domenyk-v2 — Plano do Projeto

## Stack
- Next.js 15 (App Router, Turbopack)
- React 19
- TypeScript
- Tailwind v4
- MongoDB
- Clerk (auth)
- Vercel Blob (imagens novas)
- Cloudinary (fallback — posts antigos apenas, sem migração)
- Vercel Analytics (nativo, sem implementação custom)
- Lexical (editor rico → serializa para Markdown)
- `@chenglou/pretext` (layout tipográfico responsivo)

## Regra de ouro
`app/` só roteia → `lib/` só acessa dados → `components/` só renderiza.
Nenhum fetch dentro de componente. Nenhuma lógica de negócio fora de `lib/`.

## Conteúdo

### Posts
- Escritos no editor Lexical do admin
- Armazenados como Markdown no MongoDB
- Renderizados com pipeline: Markdown → HTML com paragraph IDs estáveis
- Metadados: título, slug, tags, cover (Blob URL), background (cor ou imagem Blob)
- O background aparece tanto na página do post quanto no card da home

### Notes
- Textos curtos, estilo Twitter
- Compositor na própria página pública `/notes` (visível só pro admin logado)
- Suportam imagens (Vercel Blob)
- Sem draft — postou, publicou

### Imagens
- Novas: Vercel Blob (posts + notes + media library)
- Antigas: Cloudinary (fallback, sem migração)

## Tipografia — pretext
`@chenglou/pretext` é usado para calcular o tamanho de fonte ideal para o conteúdo do post.
Funciona com binary search: encontra o maior font-size onde a média de linhas por parágrafo
ainda cabe dentro de `maxLinesPerParagraph`. Usa a Canvas API internamente para medir texto
com precisão, sem depender do DOM renderizado.

**Como implementar:**
- Hook `usePostContentFontSize(containerRef, options)` no `PostContent` client wrapper
- Opções: `minSize` (padrão 12), `maxSize` (padrão 18), `maxLinesPerParagraph` (padrão 6)
- Precisa de `document.fonts.ready` antes de medir — já tratado no hook
- ResizeObserver + MutationObserver para re-calcular em resize ou mudança de conteúdo
- Cache de medições por `font + text` para evitar re-medição desnecessária

## Paragraph Comments
- Cada `<p>` renderizado recebe `data-pid` = hash SHA1 (8 chars) dos primeiros 80 chars do texto
- `PostContent` é Server Component puro (renderiza HTML estático)
- `ParagraphCommentsLayer` é Client Component que lê `[data-pid]` do DOM e injeta interação
- Comments e paragraph comments unificados em uma coleção `comments` no MongoDB
  - `paragraphId` presente = paragraph comment; ausente = comment geral
- Índice composto `{ postId: 1, paragraphId: 1 }` cobre os dois casos de leitura

## Admin
- `/admin/posts` — listar, publicar/despublicar, pin, deletar
- `/admin/posts/new` e `/admin/posts/[id]/edit` — editor Lexical + metadados
- `/admin/notes` — listar, deletar (criação é na página pública)
- `/admin/comments` — ver recentes, deletar (moderação)
- `/admin/media` — upload → Vercel Blob → URL copiada na hora, grid de assets

## Estrutura de pastas
```
src/
  app/
    (public)/
      page.tsx                    → home (lista de posts com cards)
      notes/page.tsx              → timeline de notas + compositor (admin)
      posts/[slug]/page.tsx       → post individual
    admin/
      layout.tsx                  → proteção Clerk
      page.tsx                    → dashboard
      posts/page.tsx
      posts/new/page.tsx
      posts/[id]/edit/page.tsx
      notes/page.tsx
      comments/page.tsx
      media/page.tsx
    api/
      posts/route.ts
      posts/[slug]/route.ts
      notes/route.ts
      comments/[postId]/route.ts
      comments/[postId]/paragraph/[paragraphId]/route.ts
      admin/posts/route.ts
      admin/posts/[id]/route.ts
      admin/notes/route.ts
      admin/notes/[id]/route.ts
      admin/comments/[id]/route.ts
      admin/media/route.ts
  lib/
    db/
      client.ts                   → singleton MongoDB
      posts.ts
      notes.ts
      comments.ts
    mdx.ts                        → Markdown → HTML com paragraph IDs
    auth.ts                       → isAdmin(), requireAuth() via Clerk
    reading-time.ts
    blob.ts                       → helpers Vercel Blob
components/
  post/
    PostContent.tsx               → Server Component
    PostContentWrapper.tsx        → Client Component (aplica pretext font size)
    ParagraphCommentsLayer.tsx    → Client Component
    ParagraphThread.tsx           → Client Component
  notes/
    Timeline.tsx
    NoteCard.tsx
    NoteComposer.tsx              → Client Component (só admin)
  comments/
    CommentThread.tsx
    CommentForm.tsx
  editor/
    LexicalEditor.tsx             → editor rico para posts
    ImagePickerPlugin.tsx         → plugin de imagem com media library
  ui/                             → primitivos (Button, Input, Avatar...)
```

## Estilos de página de post — NÃO IMPLEMENTADO, documentado para o futuro

O sistema de post suportará múltiplos estilos de apresentação, definidos por um campo
`style` no documento do post. Cada estilo altera layout, tipografia e comportamento
visual da página, mantendo dados e lógica iguais.

### Estilos planejados

**`standard`** (padrão)
- Layout centralizado, coluna única
- Tipografia de leitura confortável com pretext
- Paragraph comments na margem

**`editorial`**
- Layout mais largo, com uso de margens
- Tipografia com mais contraste (serifa para corpo, sans para títulos)
- Imagens com tratamento de destaque (full-bleed ou legenda proeminente)
- Ideal para textos com muitas imagens ou estrutura visual rica

**`opinion`**
- Layout mais estreito, mais íntimo
- Tipografia maior, mais espaçada
- Sem muitos elementos visuais — foco total no texto
- Possível uso de epígrafe no topo

### Como implementar quando chegar a hora
1. Adicionar `style: 'standard' | 'editorial' | 'opinion'` no schema de posts (padrão: 'standard')
2. Criar variantes em `src/app/(public)/posts/[slug]/layouts/`
   - `Standard.tsx`, `Editorial.tsx`, `Opinion.tsx`
3. A página do post seleciona o layout com base em `post.style`
4. O editor expõe um seletor de estilo nos metadados

## MongoDB — Schemas

### posts
```typescript
{
  _id: ObjectId
  slug: string           // único, URL-safe
  title: string
  content: string        // Markdown
  excerpt?: string
  cover?: { url: string; alt?: string }
  background?: { color?: string; imageUrl?: string }
  tags: string[]
  pinned: boolean
  published: boolean
  publishedAt?: Date
  readingTimeMinutes: number
  style: 'standard' | 'editorial' | 'opinion'  // padrão: 'standard'
  createdAt: Date
  updatedAt: Date
}
```

### notes
```typescript
{
  _id: ObjectId
  content: string        // texto simples ou Markdown leve
  images?: string[]      // Vercel Blob URLs
  publishedAt: Date
  createdAt: Date
}
```

### comments
```typescript
{
  _id: ObjectId
  postId: ObjectId
  paragraphId?: string   // presente = paragraph comment
  authorId: string       // Clerk user ID
  authorName: string
  authorImageUrl: string
  content: string
  createdAt: Date
  updatedAt: Date
}
// Índice composto: { postId: 1, paragraphId: 1 }
```
