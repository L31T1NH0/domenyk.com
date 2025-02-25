import { AppProps } from "next/app";
import "../styles/global.css";
import { JSX } from "react";
import { DefaultSeo } from "next-seo"; // Importe DefaultSeo
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Head from "next/head"; // Para scripts adicionais

const defaultSEO = {
  title: "Dou minhas opiniões aqui - Blog",
  description: "opinioes politicas.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://blog-roan-nu.vercel.app/",
    siteName: "Domenyk Blog",
  },
  twitter: {
    handle: "@l31t1",
    cardType: "summary_large_image",
  },
};

export default function MyApp({ Component, pageProps }: AppProps): JSX.Element {
  return (
    <>
      <Head>
        {/* Adicione o script do Google Analytics (substitua YOUR_GOOGLE_ANALYTICS_ID pelo seu ID) */}
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=G-9XX47JFHX6`}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-9XX47JFHX6');
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
