import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { Header } from "@components/header";
import { Layout } from "@components/layout";
import HomeClient from "./home-client";
import { getPostsCached } from "../lib/posts";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;
const BASE_URL = "https://domenyk.com";
const DEFAULT_SOCIAL_IMAGE = `${BASE_URL}/images/profile.jpg`;
const HOMEPAGE_DESCRIPTION =
  "Textos diretos sobre liberdade, economia e política, dou minhas opiniões aqui com análises objetivas e estilo claro.";

function parsePage(p: unknown): number {
  const num = typeof p === "string" ? parseInt(p, 10) : 1;
  if (Number.isNaN(num) || num < 1) return 1;
  return num;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const page = parsePage(sp?.page as string | undefined);
  const query = (sp?.query as string | undefined)?.trim() || "";

  const baseTitle = "Domenyk - Blog";
  const title = query ? `${baseTitle} – Busca: ${query}${page > 1 ? ` (página ${page})` : ""}` : `${baseTitle}${page > 1 ? ` – Página ${page}` : ""}`;
  const description = HOMEPAGE_DESCRIPTION;

  const params = new URLSearchParams();
  if (query) params.set("query", query);
  const canonical = `${BASE_URL}/${params.toString() ? `?${params.toString()}` : ""}`;

  const spPrev = new URLSearchParams(params);
  const spNext = new URLSearchParams(params);
  if (page > 1) spPrev.set("page", String(page - 1));
  if (page >= 1) spNext.set("page", String(page + 1));

  return {
    metadataBase: new URL(BASE_URL),
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      siteName: "Domenyk",
      locale: "pt_BR",
      images: [
        {
          url: DEFAULT_SOCIAL_IMAGE,
          alt: "Retrato de Domenyk",
        },
      ],
    },
    twitter: {
      site: "@l31t1",
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
    // Note: Next Metadata API does not natively support link rel=prev/next.
  };
}

async function resolveIsAdmin(): Promise<boolean> {
  try {
    const user = await currentUser();
    return user?.publicMetadata?.role === "admin";
  } catch (error) {
    console.error("Failed to resolve admin role on the server:", error);
    return false;
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = (await searchParams) ?? {};
  const page = parsePage(sp.page as string | undefined);
  const query = (sp.query as string | undefined)?.trim() || "";
  const sort = (sp.sort as "date" | "views" | undefined) ?? undefined;
  const order = (sp.order as "asc" | "desc" | undefined) ?? undefined;

  const isAdmin = await resolveIsAdmin();

  const { posts, hasNext, total } = await getPostsCached({
    page,
    pageSize: PAGE_SIZE,
    query,
    sort,
    order,
    includeHidden: isAdmin,
  });

  if (typeof total === "number" && total >= 0) {
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > maxPage) {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (sort) params.set("sort", sort);
      if (order) params.set("order", order);
      params.set("page", String(maxPage));
      redirect(`/${params.toString() ? `?${params.toString()}` : ""}`);
    }
  }

  return (
    <Layout home>
      <Header home={true} />
      <section className="text-xl flex flex-col gap-3 py-6 text-primary items-center text-center">
        <h1 className="text-3xl font-semibold">Domenyk</h1>
        <p className="text-lg text-zinc-200">dou minhas opiniões aqui</p>
      </section>
      <section aria-label="Lista de posts" className="flex flex-col gap-4">
        <HomeClient
          posts={posts}
          isAdmin={isAdmin}
          page={page}
          hasNext={hasNext}
          total={total}
        />
      </section>
    </Layout>
  );
}


