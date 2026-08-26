# Robu.in Catalog Scraping Guide

## Summary
Robu.in is a **Next.js** storefront. Category / product HTML is **client-side rendered** – the data is fetched via XHR to
`https://robu.in/api/proxy/graphql/` (declared `Allow` in `robots.txt:1` for `Googlebot`, `Bingbot` and `*`).
Scraping the product catalog therefore means **calling the same GraphQL endpoint** the site's own JS uses, not parsing HTML.

Relevant endpoint discovered via `curl.exe -s -L "https://robu.in/robots.txt"`:
```
Allow: /api/proxy/graphql
Sitemap: https://robu.in/sitemap.xml
```

## GraphQL Queries (reverse-engineered from chunks)

Chunks inspected:
- `/_next/static/chunks/app/shop/page-aa94d70d1015e7ab.js` – `ShopCategories` (`scripts/robu-scrape.py:22`)
- `/_next/static/chunks/app/product-category/%5Bslug%5D/page-8b9c6d4ecce455ac.js` – `CategoryMeta` + `CategoryProducts` (`scripts/robu-scrape.py:25-52`)

```graphql
# 1. Top 12 categories shown on homepage
query { homeCategories { status data { id name slug imageUrl } } }

# 2. Category metadata + children (used for tree traversal)
query CategoryMeta($slug: String!) {
  visibleMenuCategories(slug: $slug parent: true limit: 1 page: 1 sort: "latest" search: "") {
    status message data {
      id name slug description banner
      price_range { min max }
      has_children
      children { id name slug products_count }
      categories { breadcrumb { id name slug } }
    }
  }
}

# 3. Paginated products for any category
query CategoryProducts(
  $slug: String! $limit: Int $categoryId: ID $page: Int
  $sort: String! $search: String! $filters: [AttributeFilterInput!] $minPrice: Float $maxPrice: Float
) {
  visibleMenuCategories(parent: true limit: $limit categoryId: $categoryId slug: $slug page: $page sort: $sort search: $search filters: $filters minPrice: $minPrice maxPrice: $maxPrice) {
    status message data {
      products {
        id sku name slug price sale_price moq_price images in_stock mpn categories is_backorder
        special_price_from special_price_to reviews_rating reviews_total
      }
      pagination { current_page per_page total last_page }
    }
  }
}

# 4. Search (also works for discovery)
query ProductSearch($search: String!) {
  productSearch(search: $search) {
    status data { total_products products { id name slug price } categories { id name slug } }
  }
}
```

### Key findings from `scripts/robu-scrape.py:85-120`
- `visibleMenuCategories` is reused for both meta and product listing; `parent:true` is required.
- If `has_children==true` the product list returned by `CategoryProducts` is the **aggregate of all children** (e.g., `drone-parts` total 1159 ≈ sum of its 15 children, `drone-motor` 849 ≈ sum of 9 KV sub-categories). To avoid duplicates, **scrape only leaf categories** (`has_children==false`).
- Pagination defaults `per_page=20`, `last_page = ceil(total / per_page)`. `sort` supports `latest`, `name`, `price_asc`, `price_desc`.
- No auth needed for these queries; `product` (singular) is `admin-api` guarded (`scripts/robu-scrape.py:130`).

## Scale estimate
- `homeCategories` → 12 roots
- `drone-parts` → 41 nodes (35 leafs) – example run `C:\Users\sugee\AppData\Local\Temp\opencode\robu-drone-parts-leaf.json:1` (105 products sampled, 3 per leaf)
- `microcontroller-development-board` → 83 nodes (71 leafs)
- Full catalog ≈ **300+ leaf categories**, each `total` shown in `products_count` (e.g., `sensor-modules` 2268, `drone-parts` 1159). Total **~10–15k SKUs**.

## Scripts provided

### Python (stdlib only)
`scripts/robu-scrape.py:1`

```bash
# minimal demo – 1 leaf, 1 page, 3 items
python scripts/robu-scrape.py --category drone-motor --limit-pages 1 --limit 3 --output robu-demo.json

# leaf-only full drone branch (35 leaves, 1 page each ≈ 27s with --sleep 0.4)
python scripts/robu-scrape.py --top-slugs drone-parts --limit-pages 1 --limit 20 --output robu-drone.json --sleep 0.4

# full catalog (takes ~8-15 min, ~300 leaves × pagination)
python scripts/robu-scrape.py --leaf-only --limit 50 --sleep 0.5 --output robu-catalog.json

# search mode (alternative discovery)
python scripts/robu-scrape.py --search "esp32"
```

Outputs (auto):
- `*.json` – `{generated_at, source, count, categories_meta[], products[]}`
- `*.csv` – flattened (`id,sku,name,slug,price,sale_price,in_stock,categories,category_slug,image,product_url`)
- `lib/robu-products.ts` – `export const robuProducts: Product[]` matching `lib/products.ts:1`

### Node.js (Node ≥18)
`scripts/robu-scrape.mjs:1`

```bash
node scripts/robu-scrape.mjs --limit-categories 1 --limit-pages 1 --limit 2 --output robu-node.json
```

### Integration with GoRobo `components/catalog.tsx:62`
```ts
// before
import { products as staticProducts } from "@/lib/products"

// after – generated from Robu
import { robuProducts } from "@/lib/robu-products"
const items = robuProducts.map(p => ({ ...p, price: applyMargin(p.price) }))
```

Use `lib/products.ts:18` `applyMargin()` to keep existing pricing strategy.

To produce XLSX (project already has `xlsx@0.18.5` in `package.json:24`):
```js
import * as XLSX from "xlsx"
const data = JSON.parse(fs.readFileSync("robu-catalog.json","utf8")).products
const ws = XLSX.utils.json_to_sheet(data)
XLSX.writeFile({ Sheets:{Catalog:ws}, SheetNames:["Catalog"] }, "robu-catalog.xlsx")
```

## Ethical / Legal notes
- Respect `robots.txt`: only hit `Allow: /api/proxy/graphql`, not `/api/` otherwise.
- Rate limit `300–600 ms` between requests (default `0.45s` in `scripts/robu-scrape.py:200`). The site is behind Cloudflare; aggressive scraping triggers `403 / Just a moment` challenges (seen when fetching `https://robu.in/product/...` via `urllib`).
- Cache `CategoryMeta` results; do not re-fetch same slug (`seen` set in `scripts/robu-scrape.py:132`).
- For production, ask Robu for an official feed / affiliate API before redistributing images/prices.

## Verified runs
- `python scripts/robu-scrape.py --category drone-motor --limit-pages 1 --limit 3` → 3 products, `total 849` (`C:\Users\sugee\AppData\Local\Temp\opencode\robu-drone-motor.json`)
- `python scripts/robu-scrape.py --category 60300-kv-agriculture-heavy-lift-drone-motors --limit-pages 2 --limit 4` → 8 products, `total 88` (`C:\Users\sugee\AppData\Local\Temp\opencode\robu-leaf.json`)
- `python scripts/robu-scrape.py --top-slugs drone-parts --limit-pages 1 --limit 3` → 105 unique, 35 leafs (`C:\Users\sugee\AppData\Local\Temp\opencode\robu-drone-parts-leaf.json`)
