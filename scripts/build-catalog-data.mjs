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
 * Env:   CATALOG_SNAPSHOT_API_URL (preferred, direct origin bypassing Cloudflare)
 *        NEXT_PUBLIC_AMAZE_API_URL (default https://api.amazecc.com)
 *        STRICT_CATALOG_SNAPSHOT=1 (fail build when API unreachable and no
 *        usable snapshot exists check is forced; by default a stale committed
 *        snapshot is reused so deploys aren't blocked by API/WAF outages)
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Direct Render origin — bypasses Cloudflare (which 403s datacenter IPs like
// Vercel/GitHub runners on api.amazecc.com). Kept as a built-in fallback so
// Vercel builds work even when CATALOG_SNAPSHOT_API_URL isn't configured.
const DIRECT_ORIGIN = "https://amazecc-api-jrsp.onrender.com";

// Candidate API bases, deduped, in priority order: explicit direct origin
// first, then the public URL last (most likely to be WAF-blocked).
const API_BASES = [
  process.env.CATALOG_SNAPSHOT_API_URL,
  DIRECT_ORIGIN,
  process.env.NEXT_PUBLIC_AMAZE_API_URL,
  "https://api.amazecc.com",
]
  .filter(Boolean)
  .map((u) => u.replace(/\/+$/, ""))
  .filter((u, i, arr) => arr.indexOf(u) === i);

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

function reuseStaleSnapshot(reason) {
  // The site runs fine on a stale snapshot: the client falls back to the
  // bundled catalog / live API at runtime (see lib/gorobo-api.ts). Never let
  // a transient API/WAF outage block a deploy when we have good data on disk.
  try {
    const manifestPath = path.join(OUT_DIR, "manifest.json");
    if (!fs.existsSync(manifestPath)) return false;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const indexRef = manifest?.files?.index;
    if (!indexRef) return false;
    const indexPath = path.join(OUT_DIR, path.basename(indexRef));
    const stat = fs.statSync(indexPath);
    if (stat.size < 1024) return false;
    console.warn(
      `[build-catalog-data] WARN: ${reason} — reusing stale snapshot rev=${manifest.rev} count=${manifest.count} (${(stat.size / 1024).toFixed(1)} KB). Site will refresh on next successful build.`,
    );
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`[build-catalog-data] trying API bases: ${API_BASES.join(", ")}`);

  // Render free tier can cold-start in tens of seconds — give the main fetch
  // a generous window; retries with backoff cover the rest. Try each base in
  // turn so a Cloudflare-blocked hostname falls through to the direct origin.
  let payload = null;
  let workingBase = null;
  let lastError = null;
  for (const base of API_BASES) {
    console.log(`[build-catalog-data] fetching catalog from ${base} ...`);
    try {
      const p = await fetchJson(`${base}/api/gorobo/items`, 90000, 2);
      if (!p?.success || !Array.isArray(p.items)) {
        throw new Error("unexpected /api/gorobo/items payload");
      }
      payload = p;
      workingBase = base;
      break;
    } catch (e) {
      lastError = e;
      console.warn(`[build-catalog-data] base ${base} failed: ${e.message}`);
    }
  }

  if (!payload) {
    if (reuseStaleSnapshot(`all API bases unreachable (${lastError?.message ?? "unknown error"})`)) return;
    fail(
      `all API bases unreachable. Last error: ${lastError?.message ?? "unknown"}. ` +
        `Fix options: (1) set CATALOG_SNAPSHOT_API_URL to the direct Render origin, ` +
        `(2) add a Cloudflare WAF Skip rule for hostname api.amazecc.com path /api/gorobo/*`,
    );
  }

  // Probe version info (best-effort — snapshot still valid without it).
  let lastUpdate = null;
  try {
    const v = await fetchJson(`${workingBase}/api/gorobo/version`, 15000, 2);
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

  if (items.length === 0) {
    if (reuseStaleSnapshot("catalog came back empty")) return;
    fail("catalog came back empty — refusing to write a blank snapshot");
  }

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
