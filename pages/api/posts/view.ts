import { NextApiRequest, NextApiResponse } from "next";
import { MongoClient } from "mongodb"; // Usando as configurações padrão do MongoClient
import { serialize } from "cookie"; // Para manipular cookies no backend

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
  console.log("Request received for postId:", req.body.id);

  if (req.method !== "POST") {
    console.log("Invalid method:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.body;

  if (!id) {
    console.log("Post ID is missing in request body");
    return res.status(400).json({ error: "Post ID is required" });
  }

  if (typeof id !== "string") {
    console.log("ID must be a string:", id);
    return res.status(400).json({ error: "ID must be a string" });
  }

  const cookieName = `viewed_post_${id}`;

  const viewedCookie = req.headers.cookie
    ? req.headers.cookie
        .split(";")
        .find((c) => c.trim().startsWith(`${cookieName}=`))
    : null;

  if (viewedCookie) {
    const cookieValue = decodeURIComponent(viewedCookie.split("=")[1]);
    const viewedData = JSON.parse(cookieValue);
    if (viewedData.viewed) {
      console.log("Existing cookie for postId:", id, "with data:", viewedData);
      return res
        .status(200)
        .json({
          message: "View not updated (already viewed)",
          views: viewedData.views || 0,
        });
    }
  }

  try {
    const client = await clientPromise;
    console.log("Connected to MongoDB successfully!");
    const database = client.db("blog");
    const posts = database.collection("posts");

    console.log("Checking if post exists with postId:", id);
    const existingPost = await posts.findOne({ postId: id });

    if (existingPost) {
      console.log(
        "Post found with postId:",
        id,
        "Current views before update:",
        existingPost.views
      );
      const result = await posts.updateOne(
        { postId: id },
        { $inc: { views: 1 } }
      );
      console.log(
        "Update result (MongoDB):",
        result,
        "Modified count:",
        result.modifiedCount
      );
      const newCookieData = {
        viewed: true,
        views: existingPost.views + 1,
        timestamp: Date.now(),
      };
      console.log(
        "Setting cookie for postId:",
        id,
        "with data:",
        newCookieData
      );
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
        .json({ message: "View count updated", views: existingPost.views + 1 });
    } else {
      console.log("Post not found, creating new post with postId:", id);
      const newPost = {
        postId: id,
        views: 1,
      };
      const insertResult = await posts.insertOne(newPost);
      console.log(
        "Insert result (MongoDB):",
        insertResult,
        "Inserted ID:",
        insertResult.insertedId
      );
      const newCookieData = {
        viewed: true,
        views: 1,
        timestamp: Date.now(),
      };
      console.log(
        "Setting cookie for postId:",
        id,
        "with data:",
        newCookieData
      );
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
      stack: err.stack, // Adiciona stack trace para depuração
    });
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: err.message });
  }
};
