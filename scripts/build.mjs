// Assembles dist/ = game/ (ritual-editable) + platform/client/ (protected).
// The overlay is injected here rather than referenced from game/index.html so
// that no ritual can remove it, and the CSP keeps game code from talking to any
// host other than this one.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
cpSync(join(root, "game"), dist, { recursive: true });

if (existsSync(join(dist, "rsi")) || existsSync(join(dist, "_headers")) || existsSync(join(dist, "api"))) {
  throw new Error("game/ may not contain rsi/, api/ or _headers (reserved for the platform)");
}
cpSync(join(root, "platform", "client"), join(dist, "rsi"), { recursive: true });

const indexPath = join(dist, "index.html");
let html = readFileSync(indexPath, "utf8");
// The charset goes first: without it browsers decode the overlay's UTF-8 text
// (·, “ ”, …) as Windows-1252.
const inject = '\n    <meta charset="utf-8">\n    <link rel="stylesheet" href="/rsi/rsi.css">\n    <script src="/rsi/rsi.js"></script>';
html = /<head[^>]*>/i.test(html)
  ? html.replace(/<head[^>]*>/i, (m) => m + inject)
  : inject + "\n" + html;
writeFileSync(indexPath, html);

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");
writeFileSync(join(dist, "_headers"), `/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n`);

console.log("Built dist/");
