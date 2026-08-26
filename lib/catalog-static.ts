import type { Product } from "@/lib/products"

/**
 * Static-first catalog loader.
 *
 * The deploy pipeline snapshots the full catalog into /data/catalog/ at build
 * time (see scripts/build-catalog-data.mjs). Those files are content-hashed
 * and served from the GitHub Pages CDN, so loading them is fast, free, and
 * never touches the API or database. This module fetches the snapshot with a
 * sessionStorage cache; callers fall back to the live API when it is
 * unavailable (e.g. fresh local dev before the snapshot step has run).
 */

export type CatalogManifest = {
  rev: string
  generatedAt: string
  apiLastUpdate: string | null
  count: number
  source: string
  files: { index: string }
}

const SESSION_KEY = "gorobo-catalog-static-v1"
const REFETCH_TTL_MS = 30 * 60 * 1000

type SessionEntry = { rev: string; cachedAt: number; products: Product[] }

function sessionRead(): SessionEntry | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionEntry
    if (
      !parsed ||
      typeof parsed.rev !== "string" ||
      !Array.isArray(parsed.products) ||
      parsed.products.length === 0
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function sessionWrite(entry: SessionEntry) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(entry))
  } catch {
    // Storage full/unavailable — cache is best-effort.
  }
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

function toProduct(raw: Record<string, unknown>): Product {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ""),
    category: String(raw.category ?? ""),
    description: String(raw.description ?? ""),
    price: Number(raw.price) || 0,
    image: String(raw.image ?? "/images/products/_placeholder.svg"),
    inStock: raw.inStock !== false,
  }
}

/**
 * Loads the static snapshot.
 * - Same rev in sessionStorage → instant, zero network.
 * - Otherwise fetches manifest + hashed index (CDN-cached) and caches them.
 * Returns null when no valid snapshot exists (caller falls back to the API).
 */
export async function loadStaticCatalog(): Promise<Product[] | null> {
  const cached = sessionRead()
  if (cached && Date.now() - cached.cachedAt < REFETCH_TTL_MS) {
    return cached.products
  }

  try {
    // Cache-busting on the manifest only — the hashed index URL is immutable.
    const manifest = await fetchJson<CatalogManifest>(
      `/data/catalog/manifest.json?t=${Math.floor(Date.now() / 60000)}`,
      8000,
    )
    if (!manifest?.files?.index || typeof manifest.rev !== "string") return null

    if (cached && cached.rev === manifest.rev) {
      sessionWrite({ ...cached, cachedAt: Date.now() })
      return cached.products
    }

    const rawItems = await fetchJson<Record<string, unknown>[]>(
      `/data/catalog/${manifest.files.index.replace(/^\.?\//, "")}`,
      20000,
    )
    if (!Array.isArray(rawItems) || rawItems.length === 0) return null

    const products = rawItems.map(toProduct)
    sessionWrite({ rev: manifest.rev, cachedAt: Date.now(), products })
    return products
  } catch {
    // No snapshot deployed yet, or offline — caller decides the fallback.
    return cached ? cached.products : null
  }
}
