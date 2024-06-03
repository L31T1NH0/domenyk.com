import { NextApiRequest, NextApiResponse } from "next";
import { getPostData } from "../../../lib/posts";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  try {
    const postData = await getPostData(id as string);
    res.status(200).json(postData);
  } catch (error) {
    res.status(404).json({ error: "Post not found" });
  }
}
