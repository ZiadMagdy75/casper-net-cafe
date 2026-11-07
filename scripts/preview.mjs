import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT) || 4173;
const host = "127.0.0.1";

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".woff2", "font/woff2"],
  [".txt", "text/plain; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".ico", "image/x-icon"],
]);

function insideRoot(candidate) {
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  const file = candidate.toLowerCase();
  const base = root.toLowerCase();
  const prefix = rootWithSep.toLowerCase();
  if (file !== base && !file.startsWith(prefix)) return false;
  const relative = path.relative(root, candidate);
  return !relative.split(path.sep).includes("node_modules");
}

function resolveRequest(urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(urlPath, "http://127.0.0.1").pathname);
  } catch {
    return null;
  }
  const candidate = path.resolve(root, pathname.replace(/^\/+/, ""));
  if (!insideRoot(candidate)) return null;
  return candidate;
}

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

function notFound(res) {
  const file = path.join(root, "404.html");
  if (fs.existsSync(file)) {
    send(res, 404, fs.readFileSync(file), "text/html; charset=utf-8");
    return;
  }
  send(res, 404, "Not found");
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method not allowed");
    return;
  }

  const resolved = resolveRequest(req.url || "/");
  if (!resolved) {
    send(res, 400, "Bad request");
    return;
  }

  let file = resolved;
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    notFound(res);
    return;
  }

  if (stat.isDirectory()) {
    file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      notFound(res);
      return;
    }
  }

  const type = types.get(path.extname(file).toLowerCase()) || "application/octet-stream";
  const body = req.method === "HEAD" ? undefined : fs.readFileSync(file);
  res.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
});

server.listen(port, host, () => {
  console.log(`Local preview only: http://${host}:${port}`);
  console.log("Do not generate the QR code from this address.");
});
