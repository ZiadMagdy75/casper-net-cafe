import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { PNG } from "pngjs";
import jsQR from "jsqr";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const printDir = path.join(root, "print");
const marginModules = 4;
const minPixels = 2400;

const requiredHrefs = [
  "https://www.tiktok.com/@casper.netcafe",
  "https://www.instagram.com/casper.netcafe",
  "https://www.facebook.com/share/1Ae7Lu9hPu/",
  "https://wa.me/201099101365",
  "https://maps.app.goo.gl/M37ATTRgbqHuvhDWA",
];

const files = {
  png: "casper-net-cafe-qr.png",
  svg: "casper-net-cafe-qr.svg",
  card: "casper-net-cafe-card.svg",
  page: "index.html",
  meta: "source-url.txt",
};

function fail(message) {
  const error = new Error(message);
  error.isGate = true;
  throw error;
}

function assertUrlShape(input) {
  if (typeof input !== "string" || input.trim() === "") {
    fail("Pass the published https URL.");
  }

  let url;
  try {
    url = new URL(input.trim());
  } catch {
    fail("That is not a valid URL.");
  }

  if (url.username || url.password) fail("The QR address cannot include a username or password.");
  if (url.protocol !== "https:") fail("The QR code must use the published https address.");

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const reserved = [".local", ".localhost", ".invalid", ".test", ".example"];
  const banned = ["placeholder", "your-site", "yourdomain", "change-me", "changeme", "localhost"];
  const exampleHosts = new Set(["example.com", "example.org", "example.net", "example.edu"]);

  if (
    host === "" ||
    banned.some((word) => host.includes(word)) ||
    exampleHosts.has(host) ||
    reserved.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix)) ||
    /^\d+$/.test(host) ||
    isBlockedIp(host)
  ) {
    fail("Refusing a local, private, or placeholder address. Publish the site first, then use that https URL.");
  }

  return url;
}

function isBlockedIp(host) {
  const bare = host.replace(/^\[|\]$/g, "");
  if (bare === "::1" || bare === "0:0:0:0:0:0:0:1") return true;
  const match = bare.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function assertSourcePage() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  if (!html.includes('data-site="casper-net-cafe"') || !html.includes("CASPER NET CAFE")) {
    fail("index.html is not the CASPER NET CAFE link page.");
  }
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  for (const href of requiredHrefs) {
    if (!hrefs.includes(href)) fail(`index.html is missing ${href}`);
  }
  if (/localhost|127\.0\.0\.1/i.test(html)) fail("index.html still points at a local address.");
}

async function readHtml(response) {
  if (!response.ok) fail(`The site responded with HTTP ${response.status}.`);
  const html = (await response.text()).slice(0, 500000);
  if (/this site is private/i.test(html)) {
    fail("That site is still private. Make the project public, then run this again.");
  }
  const missing = ["CASPER NET CAFE", 'data-site="casper-net-cafe"', ...requiredHrefs].filter(
    (snippet) => !html.includes(snippet),
  );
  if (missing.length) {
    fail("That URL is live, but it is not the CASPER NET CAFE link page. The QR code was not created.");
  }
  return html;
}

async function assertLivePage(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        accept: "text/html",
        "user-agent": "CasperNetCafeQR/1.0",
      },
      signal: AbortSignal.timeout(20000),
    });
    const type = response.headers.get("content-type") || "";
    if (!type.includes("text/html") && !type.includes("application/xhtml")) {
      fail("That URL did not return an HTML page.");
    }
    await readHtml(response);
    return assertUrlShape(response.url).toString();
  } catch (error) {
    if (error.isGate) throw error;
  }

  let reader;
  try {
    reader = await fetch(`https://r.jina.ai/${url}`, {
      redirect: "follow",
      headers: {
        accept: "text/html",
        "x-return-format": "html",
        "user-agent": "CasperNetCafeQR/1.0",
      },
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    fail("Could not reach that site. Wait until the deploy is public, then run this again with the live https URL.");
  }
  await readHtml(reader);
  return url;
}

function modulePixels(count) {
  const cells = count + marginModules * 2;
  return Math.max(10, Math.ceil(minPixels / cells));
}

function renderPng(qr, modulePx) {
  const count = qr.modules.size;
  const size = (count + marginModules * 2) * modulePx;
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y += 1) {
    const row = Math.floor(y / modulePx) - marginModules;
    for (let x = 0; x < size; x += 1) {
      const col = Math.floor(x / modulePx) - marginModules;
      const dark = row >= 0 && col >= 0 && row < count && col < count && qr.modules.get(row, col);
      const index = (size * y + x) << 2;
      const value = dark ? 0 : 255;
      png.data[index] = value;
      png.data[index + 1] = value;
      png.data[index + 2] = value;
      png.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function qrBody(qr) {
  const count = qr.modules.size;
  const size = count + marginModules * 2;
  let rects = "";
  for (let row = 0; row < count; row += 1) {
    let col = 0;
    while (col < count) {
      if (!qr.modules.get(row, col)) {
        col += 1;
        continue;
      }
      let end = col;
      while (end + 1 < count && qr.modules.get(row, end + 1)) end += 1;
      rects += `<rect x="${col + marginModules}" y="${row + marginModules}" width="${end - col + 1}" height="1"/>`;
      col = end + 1;
    }
  }
  const body = `<rect width="${size}" height="${size}" fill="#ffffff"/><g fill="#000000">${rects}</g>`;
  return { size, body };
}

function standaloneSvg(qr, pageUrl) {
  const { size, body } = qrBody(qr);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="82mm" height="82mm" shape-rendering="crispEdges" role="img">
  <title>CASPER NET CAFE QR code</title>
  <desc>Opens ${escapeXml(pageUrl)}</desc>
  ${body}
</svg>
`;
}

function cardSvg(qr, pageUrl) {
  const { size, body } = qrBody(qr);
  const lines = urlLines(pageUrl);
  const longest = Math.max(...lines.map((line) => line.length));
  const urlSize = longest > 48 ? 2.05 : longest > 36 ? 2.35 : 2.6;
  const urlStart = lines.length === 1 ? 122.4 : 119.4;
  const urlText = lines
    .map((line, index) => `<text x="52.5" y="${(urlStart + index * 4.3).toFixed(2)}" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="${urlSize}" fill="#222222">${escapeXml(line)}</text>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="105mm" height="148mm" viewBox="0 0 105 148" role="img">
  <title>CASPER NET CAFE printable QR card</title>
  <desc>Scan the code to open ${escapeXml(pageUrl)}</desc>
  <rect width="105" height="148" fill="#ffffff"/>
  <defs>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#14d8ea"/>
      <stop offset="0.55" stop-color="#7a4dff"/>
      <stop offset="1" stop-color="#e14bff"/>
    </linearGradient>
  </defs>
  <rect width="105" height="3.2" fill="url(#bar)"/>
  <path fill="#111111" d="M46.2 13.2C46.2 9.2 48.8 6.4 52.5 6.4s6.3 2.8 6.3 6.8V17.2l-2.1 1.6-2.1-1.6-2.1 1.6-2.1-1.6-2.1 1.6-2.1-1.6V13.2z"/>
  <circle cx="50.3" cy="12.6" r="0.7" fill="#ffffff"/>
  <circle cx="54.7" cy="12.6" r="0.7" fill="#ffffff"/>
  <text x="52.5" y="26.2" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="7.2" font-weight="700" letter-spacing="1.35" fill="#111111">CASPER</text>
  <text x="52.5" y="31.2" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="3.1" font-weight="700" letter-spacing="0.72" fill="#111111">NET CAFE</text>
  <svg x="16.5" y="35" width="72" height="72" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${body}</svg>
  <text x="52.5" y="114.6" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="3.2" font-weight="700" letter-spacing="0.42" fill="#111111">SCAN TO CONNECT</text>
  ${urlText}
  <text x="52.5" y="137.2" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="2.15" letter-spacing="0.08" fill="#333333">TIKTOK · INSTAGRAM · FACEBOOK · WHATSAPP · MAPS</text>
</svg>
`;
}

function printPage(pageUrl) {
  const safe = escapeHtml(pageUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#07060d">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; base-uri 'self'; form-action 'none'; object-src 'none'">
  <title>Print QR code — CASPER NET CAFE</title>
  <link rel="stylesheet" href="../css/print.css">
</head>
<body>
  <main class="wrap">
    <header class="noprint">
      <p class="eyebrow">CASPER NET CAFE</p>
      <h1>Print the QR code</h1>
      <p class="lead">Scanning this code opens the link page. It does not print the social addresses as the code itself.</p>
      <p class="url"><a href="${safe}">${safe}</a></p>
      <div class="actions">
        <button type="button" id="print-btn">Print card</button>
        <a class="btn" href="${files.png}" download>PNG</a>
        <a class="btn" href="${files.svg}" download>SVG</a>
        <a class="btn" href="${files.card}" download>Card</a>
      </div>
      <ol class="steps">
        <li>Print at 100% scale on A6, or larger if you prefer.</li>
        <li>Keep the printed code at least 3 cm wide.</li>
        <li>Scan it with a phone before you print a stack.</li>
      </ol>
    </header>
    <img class="card" src="${files.card}" alt="Printable QR card for CASPER NET CAFE. Scanning it opens ${safe}.">
  </main>
  <script src="../js/print.js" defer></script>
</body>
</html>
`;
}

function metaText(requested, finalUrl, pixels) {
  return [
    "CASPER NET CAFE QR target",
    `url: ${finalUrl}`,
    `requested: ${requested}`,
    `generated: ${new Date().toISOString()}`,
    "errorCorrection: H",
    `png: ${pixels}x${pixels}`,
    "verifiedDecode: true",
    "",
  ].join("\n");
}

function urlLines(value) {
  if (value.length <= 46) return [value];
  const parsed = new URL(value);
  const tail = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (!tail || tail === "/") return [parsed.origin];
  return [parsed.origin, tail];
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeHtml(value) {
  return escapeXml(value);
}

function decodePng(buffer) {
  const png = PNG.sync.read(buffer);
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, {
    inversionAttempts: "dontInvert",
  });
  return code ? code.data : null;
}

function assertPngMatches(buffer, qr, modulePx) {
  const png = PNG.sync.read(buffer);
  const count = qr.modules.size;
  const expected = (count + marginModules * 2) * modulePx;
  if (png.width !== expected || png.height !== expected) fail("PNG size does not match the QR matrix.");
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      const x = (col + marginModules) * modulePx + Math.floor(modulePx / 2);
      const y = (row + marginModules) * modulePx + Math.floor(modulePx / 2);
      const index = (png.width * y + x) << 2;
      const dark = png.data[index] < 128;
      if (dark !== Boolean(qr.modules.get(row, col))) fail(`PNG pixel mismatch at module ${col},${row}.`);
    }
  }
  const corner = png.data[0];
  if (corner !== 255) fail("PNG quiet zone is not white.");
}

function readUrlArg(args) {
  const inline = args.find((arg) => arg.startsWith("--url="));
  if (inline) return inline.slice("--url=".length);
  const index = args.indexOf("--url");
  if (index !== -1) return args[index + 1];
  return args.find((arg) => /^https?:\/\//i.test(arg));
}

async function selfTest() {
  assertSourcePage();
  const rejected = [
    "http://127.0.0.1:4173",
    "https://localhost/cafe",
    "https://127.0.0.1/",
    "https://10.0.0.8/",
    "https://192.168.1.20/",
    "https://172.16.0.4/",
    "https://example.com",
    "https://my-placeholder.netlify.app",
    "https://change-me.github.io/cafe",
    "https://cafe.local/",
    "https://preview.invalid/casper",
    "https://user:pass@casper-net-cafe.netlify.app/",
    "notaurl",
    "",
  ];
  for (const sample of rejected) {
    let threw = false;
    try {
      assertUrlShape(sample);
    } catch {
      threw = true;
    }
    if (!threw) fail(`Self-test expected a rejection for ${sample || "(empty)"}`);
  }

  const accepted = assertUrlShape("https://casper-net-cafe.netlify.app/links");
  if (accepted.hostname !== "casper-net-cafe.netlify.app") fail("Self-test accepted the wrong host.");

  const payload = "https://qr-self-test.invalid/casper-net-cafe";
  const qr = QRCode.create(payload, { errorCorrectionLevel: "H" });
  const small = renderPng(qr, 8);
  if (decodePng(small) !== payload) fail("Self-test could not decode the sample QR code.");
  const modulePx = modulePixels(qr.modules.size);
  const printBuffer = renderPng(qr, modulePx);
  assertPngMatches(printBuffer, qr, modulePx);
  if (decodePng(printBuffer) !== payload) fail("Self-test could not decode the high-resolution sample.");
  if (printBuffer.length < 5000) fail("Self-test PNG was unexpectedly small.");

  const before = listPrint();
  if (before.join() !== listPrint().join()) fail("Self-test wrote print files.");
  console.log("QR generator self-test passed.");
  console.log("No QR file was written. Run this with the published https URL after deploy.");
}

function listPrint() {
  if (!fs.existsSync(printDir)) return [];
  return fs.readdirSync(printDir).sort();
}

async function generate(requestedInput) {
  assertSourcePage();
  const requested = assertUrlShape(requestedInput).toString();
  const finalUrl = await assertLivePage(requested);
  const qr = QRCode.create(finalUrl, { errorCorrectionLevel: "H" });
  const modulePx = modulePixels(qr.modules.size);
  const png = renderPng(qr, modulePx);
  assertPngMatches(png, qr, modulePx);
  const decoded = decodePng(png);
  if (decoded !== finalUrl) {
    fail(`The PNG did not scan back to the live URL. Decoder returned: ${decoded || "nothing"}`);
  }

  const svg = standaloneSvg(qr, finalUrl);
  const card = cardSvg(qr, finalUrl);
  if (!svg.includes("<svg") || !svg.includes(escapeXml(finalUrl))) fail("SVG QR code was incomplete.");
  if (!card.includes(escapeXml(finalUrl)) || !card.includes("<rect")) fail("Print card was incomplete.");

  const pngImage = PNG.sync.read(png);
  const tmp = path.join(printDir, ".tmp-qr");
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const written = [
    [files.png, png],
    [files.svg, svg],
    [files.card, card],
    [files.page, printPage(finalUrl)],
    [files.meta, metaText(requested, finalUrl, pngImage.width)],
  ];
  try {
    for (const [name, contents] of written) {
      fs.writeFileSync(path.join(tmp, name), contents);
    }
    for (const [name] of written) {
      const destination = path.join(printDir, name);
      if (fs.existsSync(destination)) fs.rmSync(destination);
      fs.renameSync(path.join(tmp, name), destination);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log("QR code verified.");
  console.log(`Opens: ${finalUrl}`);
  console.log(`PNG:   print/${files.png} (${pngImage.width}×${pngImage.height})`);
  console.log(`SVG:   print/${files.svg}`);
  console.log(`Card:  print/${files.card}`);
  console.log(`Print: print/${files.page}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    await selfTest();
    return;
  }
  const url = readUrlArg(args);
  if (!url) {
    fail("Usage: npm run qr -- https://your-published-site");
  }
  await generate(url);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
