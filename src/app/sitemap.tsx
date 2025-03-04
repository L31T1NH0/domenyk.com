import { GetServerSideProps } from "next";
import axios from "axios";

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/api/posts`
    );
    const posts = response.data;

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://blog-roan-nu.vercel.app/</loc>
          <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
          <changefreq>daily</changefreq>
          <priority>1.0</priority>
        </url>
        ${posts
          .map(
            (post: any) => `
          <url>
            <loc>https://blog-roan-nu.vercel.app/posts/${post.id}</loc>
            <lastmod>${
              new Date(post.date).toISOString().split("T")[0]
            }</lastmod>
            <changefreq>weekly</changefreq>
            <priority>0.8</priority>
          </url>
        `
          )
          .join("")}
      </urlset>`;

    res.setHeader("Content-Type", "text/xml");
    res.write(sitemap);
    res.end();

    return {
      props: {},
      revalidate: 3600, // Revalida o sitemap a cada hora (ajuste conforme necessário)
    };
  } catch (error) {
    console.error("Error generating sitemap:", error);
    res.statusCode = 500;
    res.end("Error generating sitemap");
    return {
      props: {},
    };
  }
};

export default function Sitemap() {
  return null; // Este componente não renderiza nada no frontend, apenas gera o sitemap no SSR/SSG
}
