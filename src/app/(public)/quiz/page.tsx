import { BackHome } from "@/components/BackHome"
import { buildPageMetadata } from "@/lib/seo"
import { PoliticalQuiz } from "./PoliticalQuiz"

export const metadata = buildPageMetadata({
  title: "Quiz de posicionamento político",
  description: "60 perguntas para explorar sua posição econômica, liberdade e autoridade, com 12 dimensões e diagnósticos. Modelo experimental v0.2.",
  path: "/quiz",
})

export default function QuizPage() {
  return (
    <>
      <PoliticalQuiz />
      <div id="quiz-content-boundary" />
      <BackHome boundaryId="quiz-content-boundary" label="Voltar para a página inicial" />
    </>
  )
}
