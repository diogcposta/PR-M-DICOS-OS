/**
 * Compila a versão Google Apps Script do Clinical Production Dashboard.
 *
 *   node apps-script/build.mjs            → apps-script/dist/ (4 ficheiros para o Apps Script)
 *   node apps-script/build.mjs --preview  → também apps-script/.preview/index.html (teste local)
 *
 * O domínio (cálculos, validação Zod, dados de demonstração) é o mesmo da app
 * Next: é importado de src/modules/production e empacotado aqui.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dist = path.join(here, "dist");
const previewDir = path.join(here, ".preview");
const withPreview = process.argv.includes("--preview");

/**
 * O Zod exporta todas as traduções de mensagens (≈250 KB). As mensagens deste
 * projeto são todas próprias, em português; só o inglês (predefinição) é preciso.
 */
const zodLocalesOnlyEnglish = {
  name: "zod-locales-en",
  setup(b) {
    b.onResolve({ filter: /locales\/index\.js$/ }, (args) =>
      args.importer.includes(`${path.sep}zod${path.sep}`) ? { path: "zod-locales-en", namespace: "stub" } : undefined,
    );
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: `export { default as en } from ${JSON.stringify(path.join(root, "node_modules/zod/v4/locales/en.js"))};`,
      resolveDir: root,
    }));
  },
};

const common = {
  plugins: [zodLocalesOnlyEnglish],
  bundle: true,
  write: false,
  absWorkingDir: root,
  tsconfig: path.join(root, "tsconfig.json"),
  legalComments: "none",
  charset: "utf8",
  logLevel: "warning",
  define: { "process.env.NODE_ENV": '"production"' },
};

async function bundle(entry, options) {
  const result = await build({ ...common, entryPoints: [path.join(here, entry)], ...options });
  return result.outputFiles[0].text;
}

const banner = (what) =>
  `// ${what}\n// GERADO por apps-script/build.mjs a partir do código TypeScript do repositório. Não editar à mão.\n`;

const server = await bundle("src/server/entry.ts", { format: "iife", globalName: "PM", target: "es2019", platform: "neutral", mainFields: ["module", "main"], minifySyntax: true, minifyWhitespace: true });
const client = await bundle("src/client/main.ts", { format: "iife", target: ["ios15", "safari15", "chrome100"], platform: "browser", minify: true });
const styles = readFileSync(path.join(here, "src/client/styles.css"), "utf8");
const template = readFileSync(path.join(here, "src/Index.template.html"), "utf8");

/** Um `</script>` dentro do bundle fecharia o elemento antes do tempo. */
const inlineScript = (js) => js.replace(/<\/script/gi, "<\\/script");
const page = (clientJs, extraScripts = "") =>
  template.replace("/*__STYLES__*/", () => styles).replace("/*__CLIENT__*/", () => `${extraScripts}${inlineScript(clientJs)}`);

mkdirSync(dist, { recursive: true });
writeFileSync(path.join(dist, "Servidor.gs"), banner("Clinical Production Dashboard — servidor (Apps Script)") + server);
writeFileSync(path.join(dist, "Index.html"), page(client));
copyFileSync(path.join(here, "src/Codigo.gs"), path.join(dist, "Codigo.gs"));
copyFileSync(path.join(here, "src/appsscript.json"), path.join(dist, "appsscript.json"));

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(0)} KB`;
console.log(`Apps Script: dist/Servidor.gs (${kb(server)}), dist/Index.html (${kb(page(client))}), dist/Codigo.gs, dist/appsscript.json`);

if (withPreview) {
  const shim = await bundle("src/preview/preview.ts", { format: "iife", target: "es2020", platform: "browser" });
  mkdirSync(previewDir, { recursive: true });
  writeFileSync(path.join(previewDir, "index.html"), page(client, `${inlineScript(shim)}\n`));
  console.log("Pré-visualização: apps-script/.preview/index.html");
}
