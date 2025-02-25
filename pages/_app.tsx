import { AppProps } from "next/app";
import "../styles/global.css";
import { JSX } from "react";
import { DefaultSeo } from "next-seo"; // Importe DefaultSeo
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Head from "next/head"; // Para scripts adicionais

const defaultSEO = {
  title: "Dou minhas opiniões aqui - Blog",
  description: "Minhas opiniões.", // Descrição mais detalhada para SEO
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
        {/* Script único do Google Analytics GA4 com depuração avançada */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-9XX47JFHX6" // Substitua pelo seu ID GA4 real
          onLoad={() =>
            console.log("Google Analytics script loaded for G-9XX47JFHX6")
          }
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              console.log("Initializing Google Analytics with ID: G-9XX47JFHX6, checking dataLayer:", window.dataLayer.length);
              gtag('js', new Date());
              gtag('config', 'G-9XX47JFHX6', {
                cookie_flags: 'SameSite=None;Secure', // Mantém None para cross-site, teste com Lax se necessário
                cookie_domain: 'blog-roan-nu.vercel.app', // Domínio correto no Vercel
                debug_mode: true, // Adiciona modo de depuração para logs no console
                send_page_view: false, // Desativa envio automático de page_view para evitar chamadas duplicadas
              });
              // Envie manualmente o page_view após a configuração
              gtag('event', 'page_view', {
                page_path: window.location.pathname,
                page_location: window.location.href,
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
