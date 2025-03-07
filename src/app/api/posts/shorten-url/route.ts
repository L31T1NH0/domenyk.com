import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    // Faz a requisição para a API do is.gd
    const isGdUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(
      url
    )}`;
    const response = await fetch(isGdUrl, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Erro ao encurtar a URL com is.gd: ${response.status}`);
    }

    const shortUrl = await response.text();

    // Verifica se a resposta é uma URL válida
    if (!shortUrl.startsWith("https://is.gd/")) {
      throw new Error("Resposta inválida do is.gd");
    }

    return new NextResponse(shortUrl, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("Erro ao encurtar a URL:", error);
    return NextResponse.json(
      { error: "Failed to shorten URL" },
      { status: 500 }
    );
  }
}
