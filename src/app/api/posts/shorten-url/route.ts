import { NextResponse } from "next/server";

// Bloqueia hostnames privados / loopback para evitar SSRF.
function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();

  // Loopback e nomes reservados
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") {
    return true;
  }

  // Link-local (169.254.x.x)
  if (h.startsWith("169.254.")) return true;

  // Redes privadas RFC-1918
  if (h.startsWith("10.")) return true;
  if (h.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;

  // Metadata de nuvem (AWS, GCP, Azure)
  if (h === "metadata.google.internal" || h === "169.254.169.254") return true;

  return false;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Valida e bloqueia URLs privadas / não-HTTP(S) para prevenir SSRF.
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json(
      { error: "Apenas URLs HTTP e HTTPS são permitidas" },
      { status: 400 }
    );
  }

  if (isPrivateHostname(parsedUrl.hostname)) {
    return NextResponse.json({ error: "URL não permitida" }, { status: 400 });
  }

  try {
    // Faz a requisição para a API do is.gd
    const isGdUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`;
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
