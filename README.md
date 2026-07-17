This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Use Node.js 22 (see `.nvmrc`) and configure these environment variables in `.env.local`:

- `MONGODB_URI`
- `BLOB_READ_WRITE_TOKEN`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
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

When someone creates an account through the site, the first authenticated page load stores a notification in the admin notification center and also delivers it by Web Push when admin push subscriptions are configured. Repeated page loads are deduplicated automatically.

When `INDEXNOW_KEY` is configured, the site exposes it at `/indexnow-key.txt` and notifies IndexNow after publishing, updating, hiding, unpublishing, changing a URL, or deleting indexable content. Failed notifications never block an editorial save.

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
