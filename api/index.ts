import { handleRequest } from "../src/router";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;

  const response = await handleRequest(req, origin, process.env);

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}
