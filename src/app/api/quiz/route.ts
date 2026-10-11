import { calculate, validateAnswers } from "@/lib/quiz/calculate.server"
import { QUIZ_VERSION, SCHEMA_VERSION } from "@/lib/quiz/types"
import { isSameOriginRequest } from "@/lib/csrf"
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({error:"Origem inválida."},{status:403})
  // O cálculo é puro e não grava respostas políticas em logs ou no banco.
  const reader = request.body?.getReader()
  let body = "", size = 0
  const decoder = new TextDecoder()
  if (reader) {
    try {
      while (true) {
        const {value,done} = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 8192) {
          await reader.cancel()
          return Response.json({error:"Envio muito grande."},{status:413})
        }
        body += decoder.decode(value,{stream:true})
      }
      body += decoder.decode()
    } catch { return Response.json({error:"Não foi possível ler o envio."},{status:400}) }
    finally { reader.releaseLock() }
  }
  let payload
  try { payload = JSON.parse(body) } catch { return Response.json({error:"Envio inválido."},{status:400}) }
  if (!payload || payload.quiz_version !== QUIZ_VERSION || payload.schema_version !== SCHEMA_VERSION || !validateAnswers(payload.answers)) {
    return Response.json({error:"Confira a versão e responda às 60 perguntas."},{status:400})
  }
  return Response.json(calculate(payload.answers),{headers:{"Cache-Control":"no-store"}})
}
