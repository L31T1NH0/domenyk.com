import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { currentUser } from "@clerk/nextjs/server";

// Configura o cliente da xAI usando o OpenAI SDK
const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY, // Fornecido pela integração com a Vercel
  baseURL: "https://api.x.ai/v1", // Endpoint da xAI
});

export async function POST(req: NextRequest) {
  try {
    // Verifica se o usuário está autenticado e é admin
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Você precisa estar logado para gerar tags." },
        { status: 401 }
      );
    }

    const isAdmin = user.publicMetadata?.role === "admin";
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem gerar tags." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { content } = body;

    // Validação do conteúdo
    if (!content || typeof content !== "string" || content.trim() === "") {
      return NextResponse.json(
        { error: "Conteúdo do post é obrigatório e não pode estar vazio." },
        { status: 400 }
      );
    }

    // Faz uma requisição ao Grok usando o OpenAI SDK
    const completion = await client.chat.completions.create({
      model: "grok-2-latest", // Usa o modelo Grok-2 mais recente
      messages: [
        {
          role: "system",
          content: `Você é Grok, um especialista em análise de texto, criado para ajudar a gerar tags relevantes para posts de blog. Sua tarefa é analisar o conteúdo do post fornecido e gerar até 5 tags (palavras-chave) que resumam os principais temas ou tópicos abordados. As tags devem ser palavras em letras minúsculas, separadas por vírgulas, sem espaços extras. Por exemplo: "tecnologia, ia, programação". Baseie-se exclusivamente no texto do post: "${content}". Evite tags genéricas ou irrelevantes, e priorize termos específicos e úteis para categorizar o conteúdo. Responda apenas com as tags, sem explicações adicionais.`,
        },
        {
          role: "user",
          content: "Gere até 5 tags para o conteúdo do post fornecido.",
        },
      ],
    });

    const reply = completion.choices[0]?.message?.content || "";
    if (!reply) {
      return NextResponse.json(
        { error: "Não foi possível gerar tags." },
        { status: 500 }
      );
    }

    // Processa a resposta do Grok para extrair as tags
    const tags = reply
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0)
      .slice(0, 5); // Limita a 5 tags

    if (tags.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma tag válida foi gerada." },
        { status: 500 }
      );
    }

    return NextResponse.json({ tags }, { status: 200 });
  } catch (error) {
    console.error("Erro ao chamar o Grok para gerar tags:", error);
    return NextResponse.json(
      { error: "Erro ao processar a requisição: " + (error as Error).message },
      { status: 500 }
    );
  }
}