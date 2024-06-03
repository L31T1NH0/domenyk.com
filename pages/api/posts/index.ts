import { NextApiRequest, NextApiResponse } from "next";
import { getSortedPostsData } from "../../../lib/posts";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const allPostsData = await getSortedPostsData();
    res.status(200).json(allPostsData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch posts data" });
  }
}
