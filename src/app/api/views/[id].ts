import { NextApiRequest, NextApiResponse } from "next";
import { MongoClient } from "mongodb";
import { serialize } from "cookie";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error(
    "MONGODB_URI não está definida no arquivo .env.local ou no ambiente."
  );
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (!globalThis._mongoClientPromise) {
  client = new MongoClient(uri);
  globalThis._mongoClientPromise = client.connect();
}
clientPromise = globalThis._mongoClientPromise;

const COOKIE_EXPIRY = 24 * 60 * 60; // 24 horas em segundos

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res
      .status(400)
      .json({ error: "Post ID is required and must be a string" });
  }

  if (req.method === "POST") {
    const cookieName = `viewed_${id}`;

    const viewedCookie = req.headers.cookie
      ? req.headers.cookie
          .split(";")
          .find((c) => c.trim().startsWith(`${cookieName}=true`))
      : null;

    if (viewedCookie) {
      console.log("Existing cookie for postId:", id);
      return res.status(200).json({
        message: "View not updated (already viewed)",
        views:
          JSON.parse(decodeURIComponent(viewedCookie.split("=")[1])).views || 0,
      });
    }

    try {
      const client = await clientPromise;
      console.log("Connected to MongoDB successfully!");
      const database = client.db("blog");
      const posts = database.collection("posts");

      const existingPost = await posts.findOne({ postId: id });

      if (existingPost) {
        const result = await posts.updateOne(
          { postId: id },
          { $inc: { views: 1 } }
        );
        const newViews = existingPost.views + 1;
        const newCookieData = {
          viewed: true,
          views: newViews,
          timestamp: Date.now(),
        };
        res.setHeader(
          "Set-Cookie",
          serialize(cookieName, JSON.stringify(newCookieData), {
            path: "/",
            maxAge: COOKIE_EXPIRY,
            httpOnly: true,
            sameSite: "lax",
          })
        );
        return res
          .status(200)
          .json({ message: "View count updated", views: newViews });
      } else {
        const newPost = {
          postId: id,
          views: 1,
          date: new Date().toISOString().split("T")[0],
          title: "Untitled Post",
          htmlContent: "",
        };
        const insertResult = await posts.insertOne(newPost);
        const newCookieData = {
          viewed: true,
          views: 1,
          timestamp: Date.now(),
        };
        res.setHeader(
          "Set-Cookie",
          serialize(cookieName, JSON.stringify(newCookieData), {
            path: "/",
            maxAge: COOKIE_EXPIRY,
            httpOnly: true,
            sameSite: "lax",
          })
        );
        return res
          .status(201)
          .json({ message: "Post created with 1 view", postId: id, views: 1 });
      }
    } catch (error) {
      const err = error as Error;
      console.error("Failed to process request. Error details:", {
        message: err.message,
        type: err.name,
        stack: err.stack,
      });
      return res
        .status(500)
        .json({ error: "Internal Server Error", details: err.message });
    }
  } else if (req.method === "GET") {
    try {
      const client = await clientPromise;
      const database = client.db("blog");
      const posts = database.collection("posts");

      const post = await posts.findOne({ postId: id });
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      return res.status(200).json({ views: post.views || 0 });
    } catch (error) {
      const err = error as Error;
      console.error("Failed to fetch views. Error details:", {
        message: err.message,
        type: err.name,
        stack: err.stack,
      });
      return res
        .status(500)
        .json({ error: "Internal Server Error", details: err.message });
    }
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
};
