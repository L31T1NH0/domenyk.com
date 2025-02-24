import { AppProps } from "next/app";
import "../styles/global.css";
import { JSX } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function MyApp({ Component, pageProps }: AppProps): JSX.Element {
  return (
    <div>
      <Component {...pageProps} />
      <Analytics />
      <SpeedInsights />
    </div>
  );
}
