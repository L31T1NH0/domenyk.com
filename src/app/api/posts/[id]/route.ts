import { NextResponse } from "next/server";
import { clientPromise } from "../../../../lib/mongo"; // Use clientPromise, que agora está exportado
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

    let htmlContent = post.htmlContent;
    if (
      typeof htmlContent === "string" &&
      (htmlContent.includes("\n") ||
        htmlContent.includes("![") ||
        htmlContent.includes("["))
    ) {
      const processedContent = await remark().use(html).process(htmlContent);
      htmlContent = processedContent.toString();
    }

    // Incrementa as visualizações e define o cookie, como no Pages Router
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
