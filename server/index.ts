import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadConfig } from "./config.js";
import { loadContentEntries } from "./content.js";
import { listRemoteDrafts, saveRemoteDraft } from "./drafts.js";

const MAX_BODY_BYTES = 1024 * 1024;
const config = loadConfig();

type RouteHandler = (request: IncomingMessage, response: ServerResponse) => Promise<unknown> | unknown;

function corsHeaders(request: IncomingMessage): Record<string, string> {
  const origin = request.headers.origin;
  if (!origin || !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function sendJson(request: IncomingMessage, response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...corsHeaders(request),
  });
  response.end(JSON.stringify(payload));
}

function sendError(request: IncomingMessage, response: ServerResponse, status: number, message: string): void {
  sendJson(request, response, status, { error: message });
}

function readJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    request.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });

    request.on("error", reject);
  });
}

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders(request));
    response.end();
    return;
  }

  const key = `${request.method || "GET"} ${url.pathname}`;
  const routes: Record<string, RouteHandler> = {
    "GET /api/health": () => ({ ok: true }),
    "GET /api/content": () => loadContentEntries(config),
    "GET /api/drafts": () => listRemoteDrafts(config),
    "PUT /api/drafts": async (req) => saveRemoteDraft(config, await readJson(req)),
  };

  const handler = routes[key];
  if (!handler) {
    sendError(request, response, 404, "Not found.");
    return;
  }

  try {
    const payload = await handler(request, response);
    sendJson(request, response, 200, payload);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Internal server error.";
    const status = message.startsWith("Invalid") || message.includes("too large") ? 400 : 500;
    sendError(request, response, status, message);
  }
}

createServer((request, response) => {
  void route(request, response);
}).listen(config.port, config.host, () => {
  console.log(`fuwari-admin API listening on http://${config.host}:${config.port}`);
});
