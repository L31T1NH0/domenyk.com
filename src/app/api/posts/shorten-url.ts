import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const response = await axios.get(`https://is.gd/create.php?format=simple&url=${url}`);
    res.status(200).send(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to shorten URL" });
  }
}
