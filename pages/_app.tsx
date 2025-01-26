import { AppProps } from "next/app";
import "../styles/global.css";
import { JSX } from "react";

export default function App({ Component, pageProps }: AppProps): JSX.Element {
  return <Component {...pageProps} />;
}
