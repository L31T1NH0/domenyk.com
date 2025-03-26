import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { currentUser } from "@clerk/nextjs/server"; // Importa a função currentUser do Clerk

// Configura o cliente da xAI usando o OpenAI SDK
const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY, // Fornecido pela integração com a Vercel
  baseURL: "https://api.x.ai/v1", // Endpoint da xAI
});

export async function POST(req: NextRequest) {
  try {
    // Verifica se o usuário está autenticado
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Você precisa estar logado para usar o chat." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { message, htmlContent } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Mensagem é obrigatória" },
        { status: 400 }
      );
    }

    if (!htmlContent) {
      return NextResponse.json(
        { error: "Conteúdo do post (htmlContent) é obrigatório" },
        { status: 400 }
      );
    }

    // Faz uma requisição ao Grok usando o OpenAI SDK
    const completion = await client.chat.completions.create({
      model: "grok-2-latest", // Usa o modelo Grok-2 mais recente
      messages: [
        {
          role: "system",
          content: `Você é Grok, um especialista em política e lógica, criado para ser um assistente de IA útil no meu blog. Responda de forma clara, amigável e concisa, sempre priorizando respostas úteis e verdadeiras. Baseie suas respostas no texto do post: ${htmlContent}. Se a pergunta não estiver diretamente relacionada ao texto, tente relacioná-la de forma lógica e criativa, mas informe o usuário se o tópico estiver fora do escopo do post. Eu penso de forma lógica e gosto de conectar política com contexto histórico, então sempre que possível, inclua referências históricas relevantes para enriquecer suas respostas. Evite vieses polarizados, opiniões pessoais, especulações ou respostas excessivamente longas (máximo de 3-4 frases, a menos que a pergunta exija mais detalhes). Use um tom analítico e objetivo, mas com leveza e acessibilidade, para engajar os leitores do blog.`,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const reply = completion.choices[0]?.message?.content || "Desculpe, não consegui responder.";
    return NextResponse.json({ reply }, { status: 200 });
  } catch (error) {
    console.error("Erro ao chamar o Grok:", error);
    return NextResponse.json(
      { error: "Erro ao processar a requisição" },
      { status: 500 }
    );
  }
}