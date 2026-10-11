import { BackHome } from "@/components/BackHome"
import { Header } from "@/components/Header"
import { buildPageMetadata } from "@/lib/seo"
import { PoliticalQuiz } from "./PoliticalQuiz"

export const metadata = buildPageMetadata({
  title: "Quiz de posicionamento político",
  description: "60 perguntas para explorar sua posição econômica, liberdade e autoridade, com 12 dimensões e diagnósticos. Modelo experimental v0.1.",
  path: "/quiz",
})

export default function QuizPage() {
  return (
    <>
      <Header />
      <PoliticalQuiz />
      <div id="quiz-content-boundary" />
      <BackHome boundaryId="quiz-content-boundary" label="Voltar para a página inicial" />
    </>
  )
}
