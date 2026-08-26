#!/usr/bin/env node
/**
 * Build-time catalog snapshot generator.
 *
 * Fetches the full GoRoBo catalog from the AmazeCC API once and writes it as
 * content-hashed static JSON under public/data/catalog/. GitHub Pages (Fastly)
 * then serves these files from edge cache — the API/DB are never touched by
 * site visitors for catalog browsing.
 *
 * Output:
 *   public/data/catalog/index.<hash>.json   full item list (card-render fields)
 *   public/data/catalog/manifest.json       { rev, generatedAt, api, files }
 *
 * The hash is derived from file content, so unchanged data keeps its URL
 * (browsers cache forever) while any change produces a fresh URL.
 *
 * Usage: node scripts/build-catalog-data.mjs
 * Env:   NEXT_PUBLIC_AMAZE_API_URL (default https://api.amazecc.com)
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const API_BASE = (
  process.env.NEXT_PUBLIC_AMAZE_API_URL || "https://api.amazecc.com"
).replace(/\/+$/, "");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "data", "catalog");
const DESC_MAX = 160;

function fail(msg) {
  console.error(`[build-catalog-data] ${msg}`);
  process.exit(1);
}

// Cloudflare sits in front of api.amazecc.com and blocks datacenter IPs
// (e.g. GitHub Actions runners) when requests look like bare scripts —
// typically a missing/odd User-Agent. Send browser-ish headers.
const REQUEST_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
}

async function fetchJson(url, timeoutMs = 30000, retries = 4) {
  let lastErr
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: REQUEST_HEADERS,
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) {
        const body = (await res.text().catch(() => "")).slice(0, 200)
        const hint =
          res.status === 403 || res.status === 503
            ? " — likely Cloudflare blocking the runner IP. Fix: add a Cloudflare WAF exception (Skip) rule for hostname api.amazecc.com, path starts with /api/gorobo/"
            : ""
        throw new Error(
          `${url} -> HTTP ${res.status}${hint}${body ? ` :: ${body}` : ""}`,
        )
      }
      return await res.json()
    } catch (e) {
      lastErr = e
      console.warn(`[build-catalog-data] attempt ${attempt}/${retries} failed: ${e.message}`)
      if (attempt < retries) {
        const waitMs = attempt * 8000
        console.warn(`[build-catalog-data] retrying in ${waitMs / 1000}s ...`)
        await new Promise((r) => setTimeout(r, waitMs))
      }
    }
  }
  throw lastErr
}

async function main() {
  console.log(`[build-catalog-data] fetching catalog from ${API_BASE} ...`);

  const payload = await fetchJson(`${API_BASE}/api/gorobo/items`);
  if (!payload?.success || !Array.isArray(payload.items)) {
    fail("unexpected /api/gorobo/items payload");
  }

  // Probe version info (best-effort — snapshot still valid without it).
  let lastUpdate = null;
  try {
    const v = await fetchJson(`${API_BASE}/api/gorobo/version`, 10000);
    if (v?.success) lastUpdate = v.lastUpdate;
  } catch {
    console.warn("[build-catalog-data] version probe failed (continuing)");
  }

  const items = payload.items.map((it) => ({
    id: String(it.id),
    name: String(it.name ?? ""),
    category: String(it.category ?? ""),
    price: Number(it.price) || 0,
    image: String(it.image ?? "/images/products/_placeholder.svg"),
    inStock: it.inStock !== false,
    description: String(it.description ?? "").slice(0, DESC_MAX),
  }));

  if (items.length === 0) fail("catalog came back empty — refusing to write a blank snapshot");

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Remove stale hashed files so out/ doesn't accumulate old snapshots.
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/^(index|items)\.[0-9a-f]{10}\.json$/.test(f)) fs.rmSync(path.join(OUT_DIR, f));
  }

  const indexBody = Buffer.from(JSON.stringify(items), "utf8");
  const hash = crypto.createHash("sha256").update(indexBody).digest("hex").slice(0, 10);
  const indexFile = `index.${hash}.json`;
  fs.writeFileSync(path.join(OUT_DIR, indexFile), indexBody);

  const manifest = {
    rev: hash,
    generatedAt: new Date().toISOString(),
    apiLastUpdate: lastUpdate,
    count: items.length,
    source: "amazecc-api",
    files: { index: `./${indexFile}` },
  };
  fs.writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  const kb = (indexBody.length / 1024).toFixed(1);
  console.log(
    `[build-catalog-data] wrote ${items.length} items -> public/data/catalog/${indexFile} (${kb} KB raw), manifest rev=${hash}`,
  );
}

main().catch((e) => fail(e.message));
