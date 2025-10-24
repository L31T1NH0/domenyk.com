import { NextResponse } from "next/server";
import { clientPromise } from "../../../../lib/mongo"; // Use clientPromise, que agora estÃ¡ exportado
import { remark } from "remark";
import html from "remark-html";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const paramsData = await params;
  const id = paramsData.id;

  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { error: "Post ID is required and must be a string" },
      { status: 400 }
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db("blog");
    const postsCollection = db.collection("posts");

    const post = await postsCollection.findOne({ postId: id });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    if ((post as any).hidden === true) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    let htmlContent = post.htmlContent;
    if (htmlContent) {
      const processedContent = await remark().use(html).process(htmlContent);
      htmlContent = processedContent.toString();
    }

    // Incrementa as visualizaÃ§Ãµes e define o cookie, como no Pages Router
    const cookieName = `viewed_${id}`;
    const viewedCookie = req.headers
      .get("cookie")
      ?.split(";")
      .find((c) => c.trim().startsWith(`${cookieName}=true`));

    let views = post.views || 0;
    if (!viewedCookie) {
      await postsCollection.updateOne({ postId: id }, { $inc: { views: 1 } });
      views += 1;

      const response = NextResponse.json(
        {
          postId: post.postId,
          date: post.date,
          title: post.title,
          htmlContent,
          views,
          audioUrl: post.audioUrl,
          cape: post.cape, // Campo existente
          friendImage: post.friendImage, // Novo campo para a foto do amigo
        },
        { status: 200 }
      );
      response.headers.set(
        "Set-Cookie",
        `${cookieName}=true; Max-Age=86400; Path=/; HttpOnly; SameSite=Lax`
      );
      return response;
    }

    const postData = {
      postId: post.postId,
      date: post.date,
      title: post.title,
      htmlContent,
      views,
      audioUrl: post.audioUrl,
      cape: post.cape, // Campo existente
      friendImage: post.friendImage, // Novo campo para a foto do amigo
    };

    console.log("Post data from API for postId:", id, postData);

    return NextResponse.json(postData, { status: 200 });
  } catch (error) {
    console.error("Error fetching post from MongoDB for postId:", id, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

