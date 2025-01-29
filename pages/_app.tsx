import { AppProps } from "next/app";
import "../styles/global.css";
import { JSX } from "react";
import { Analytics } from "@vercel/analytics/react";
import ThemeSwitcher from "../components/ThemeSwitcher";

export default function App({ Component, pageProps }: AppProps): JSX.Element {
  return (
    <div>
      <Component {...pageProps} />
      <Analytics />
    </div>
  );
}
