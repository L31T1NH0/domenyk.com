import { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../../lib/mongo"; // Importa a conexão com o MongoDB
import { remark } from "remark";
import html from "remark-html";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res
      .status(400)
      .json({ error: "Post ID is required and must be a string" });
  }

  try {
    const client = await clientPromise;
    const db = client.db("blog");
    const postsCollection = db.collection("posts");

    const post = await postsCollection.findOne({ postId: id });
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    let htmlContent = post.htmlContent;
    // Processa o htmlContent se ainda estiver como Markdown ou com quebras de linha
    if (
      typeof htmlContent === "string" &&
      (htmlContent.includes("\n") ||
        htmlContent.includes("![") ||
        htmlContent.includes("["))
    ) {
      const processedContent = await remark().use(html).process(htmlContent);
      htmlContent = processedContent.toString();
    }

    const postData = {
      postId: post.postId,
      date: post.date,
      title: post.title,
      htmlContent,
    };

    res.status(200).json(postData);
  } catch (error) {
    console.error("Error fetching post from MongoDB:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
