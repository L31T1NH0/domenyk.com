import { AppProps } from "next/app";
import "../styles/global.css";
import { JSX } from "react";
import { DefaultSeo } from "next-seo"; // Importe DefaultSeo
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Head from "next/head"; // Para scripts adicionais

const defaultSEO = {
  title: "Dou minhas opiniões aqui - Blog",
  description: "Minhas opiniões.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://blog-roan-nu.vercel.app",
    siteName: "Dou minhas opiniões aqui",
  },
  twitter: {
    handle: "@l31t1",
  },
};

export default function MyApp({ Component, pageProps }: AppProps): JSX.Element {
  return (
    <>
      <Head>
        {/* Script único do Google Analytics GA4 */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-9XX47JFHX6" // Substitua pelo seu ID GA4 real
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-9XX47JFHX6', {
                cookie_flags: 'SameSite=None;Secure', // Mantém para cross-site, ajusto para Lax se necessário
                cookie_domain: 'blog-roan-nu.vercel.app', // Domínio correto no Vercel
              });
            `,
          }}
        />
      </Head>
      <DefaultSeo {...defaultSEO} />
      <Component {...pageProps} />
      <Analytics />
      <SpeedInsights />
    </>
  );
}
