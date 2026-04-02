# Domenyk.com

A modern, interactive blog platform built with **Next.js 15** and **React 19**. Features rich Markdown/MDX content rendering, real-time comments, paragraph-level annotations, and analytics tracking.

## ✨ Features

- **Interactive Posts** — Markdown/MDX rendering with support for embeds, audio players, and custom widgets
- **Dual Comment Systems** — Global threaded comments + paragraph-level inline comments with Clerk authentication
- **Reading Analytics** — Automatic view tracking, reading progress, estimated reading time, and Vercel analytics
- **Content Organization** — Search, filtering, pagination, and metadata management (cover images, audio)
- **Permission System** — Support for visitor, authenticated user, and admin/staff roles
- **Dynamic Minimap** — Auto-generated table of contents and internal reference linking
- **Admin Dashboard** — Control analytics collection and manage site settings in real-time

## 🚀 Tech Stack

- **Framework** — [Next.js 15](https://nextjs.org) with App Router
- **UI** — [React 19](https://react.dev) + [TailwindCSS 4](https://tailwindcss.com)
- **Content** — [MDX](https://mdxjs.com), [Remark](https://remark.js.org), [Rehype](https://rehype.js.org)
- **Database** — [MongoDB](https://mongodb.com) (primary) + [Redis](https://redis.io) (legacy)
- **Authentication** — [Clerk](https://clerk.com)
- **Observability** — [Vercel Analytics](https://vercel.com/analytics) + [Speed Insights](https://vercel.com/insights)

## 📦 Getting Started

### Prerequisites
- Node.js 18+ 
- npm, yarn, or pnpm
- MongoDB and Redis instances (or connection strings)
- Clerk application credentials

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/l31t1nh0/domenyk.com.git
   cd domenyk.com
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or: yarn install / pnpm install
   ```

3. **Configure environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   # Database
   MONGODB_URI=mongodb+srv://...
   REDIS_URL=redis://...
   
   # Authentication (Clerk)
   CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   
   # Site Configuration
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   
   # Analytics (optional, defaults to true)
   ANALYTICS_ENABLED=true
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔨 Build & Deploy

**Development:**
```bash
npm run dev
```

**Production build:**
```bash
npm run build
npm start
```

## ⚙️ Configuration

### Analytics Settings

Analytics collection is controlled by the `analyticsEnabled` flag in MongoDB:
- **Source of truth** — `settings` collection in MongoDB, key `analyticsEnabled`
- **Default fallback** — Environment variable `ANALYTICS_ENABLED` (defaults to `true`)
- **Admin control** — Toggle real-time from `/admin/analytics` page
- **API endpoint** — `POST /api/admin/analytics/toggle` (admin-only)

This allows you to enable/disable analytics collection without redeploying.

## 📋 Project Structure

```
├── app/                 # Next.js App Router
├── components/          # React components
├── lib/                 # Utilities, API clients, database helpers
├── public/              # Static assets
├── styles/              # Global CSS and Tailwind configuration
└── content/             # Blog posts in Markdown/MDX
```

## 🔐 Permissions & Access Control

Three permission levels:
- **Visitor** — Read-only access to posts and public features
- **Authenticated User** — Can comment, create paragraph annotations, mark progress
- **Admin/Staff** — Full access to settings, analytics, and moderation tools

## 💬 Comment System Details

### Global Comments
- Tree-structured threaded comments
- Stored in MongoDB
- Legacy data also pulled from Redis

### Paragraph Comments
- Inline annotations on specific paragraphs
- Requires Clerk authentication
- Features soft-delete with undo capability
- Attached to exact paragraph anchors

## 📝 Contributing

Contributions are welcome! Please feel free to submit a pull request.

## 📄 License

Open source for educational purposes. All rights reserved to the author.

---

**Built with ❤️ using Next.js & React**
