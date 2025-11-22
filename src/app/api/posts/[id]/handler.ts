import { NextResponse } from "next/server";
import { clientPromise } from "../../../../lib/mongo";
import { resolveAdminStatus } from "../../../../lib/admin";

export type GetPostDependencies = {
  clientPromise: typeof clientPromise;
  resolveAdminStatus: typeof resolveAdminStatus;
  now: () => Date;
};

export const defaultDependencies: GetPostDependencies = {
  clientPromise,
  resolveAdminStatus,
  now: () => new Date(),
};

export async function resolvePostResponse(
  req: Request,
  params: { id: string },
  dependencies: GetPostDependencies
) {
  const { clientPromise, resolveAdminStatus, now: nowFactory } = dependencies;
  const id = params.id;

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
    const { isAdmin, userId } = await resolveAdminStatus();

    const post = await postsCollection.findOne({ postId: id });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if ((post as any).hidden === true && !isAdmin) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const cookieName = `viewed_${id}`;
    const viewedCookie = req.headers
      .get("cookie")
      ?.split(";")
      .find((c) => c.trim().startsWith(`${cookieName}=true`));
    const hasViewedCookie = Boolean(viewedCookie);

    let views = post.views || 0;
    let shouldSetCookie = false;

    if (userId) {
      const postViewsCollection = db.collection("postViews");
      const now = nowFactory();
      const updateResult = await postViewsCollection.updateOne(
        { postId: id, viewerId: userId },
        {
          $setOnInsert: {
            postId: id,
            viewerId: userId,
            createdAt: now,
          },
          $set: {
            lastViewedAt: now,
          },
        },
        { upsert: true }
      );

      if (updateResult.upsertedCount && updateResult.upsertedCount > 0) {
        await postsCollection.updateOne({ postId: id }, { $inc: { views: 1 } });
        views += 1;
        shouldSetCookie = true;
      } else if (!hasViewedCookie) {
        shouldSetCookie = true;
      }
    } else if (!hasViewedCookie) {
      await postsCollection.updateOne({ postId: id }, { $inc: { views: 1 } });
      views += 1;
      shouldSetCookie = true;
    }

    const responseData = { postId: post.postId, views };

    const response = NextResponse.json(responseData, { status: 200 });

    if (shouldSetCookie) {
      const cookieAttributes = [
        "Max-Age=86400",
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
      ];
      if (process.env.NODE_ENV === "production") {
        cookieAttributes.push("Secure");
      }
      response.headers.set(
        "Set-Cookie",
        `${cookieName}=true; ${cookieAttributes.join("; ")}`
      );
    }

    return response;
  } catch (error) {
    console.error("Error fetching post from MongoDB for postId:", id, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
