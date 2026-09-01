import type { NextApiRequest, NextApiResponse } from "next";

import app from "@/server/app";

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default function handler(request: NextApiRequest, response: NextApiResponse): void {
  app(request, response);
}

