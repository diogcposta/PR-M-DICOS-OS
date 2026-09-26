/**
 * Servidor estático mínimo para a pré-visualização (`npm run gas:preview`).
 * Abre http://localhost:3400 — no iPhone, use o IP do computador na mesma rede.
 */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3400);

createServer((req, res) => {
  if (req.url && !req.url.startsWith("/?") && req.url !== "/") {
    res.writeHead(404).end("Não encontrado");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(readFileSync(path.join(here, ".preview/index.html")));
}).listen(port, () => {
  const ips = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
  console.log(`Pré-visualização em http://localhost:${port}${ips.length ? ` (rede: ${ips.map((ip) => `http://${ip}:${port}`).join(", ")})` : ""}`);
});
