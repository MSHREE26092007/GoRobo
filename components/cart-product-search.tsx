"use client"

import { useMemo, useRef, useState } from "react"
import { Check, Plus, SearchX } from "lucide-react"
import {
  Badge,
  Button,
  IconBadge,
  Image,
  Input,
  Text,
} from "@amazecontinuityprojects/amazeui"
import { formatINR, type Product } from "@/lib/products"
import { useCart } from "@/components/cart-context"
import { useCatalog } from "@/components/catalog-context"

const MAX_RESULTS = 8

export function CartProductSearch() {
  const { items: catalogItems } = useCatalog()
  const { addItem, lines } = useCart()
  const [query, setQuery] = useState("")
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const inCart = useMemo(() => new Set(lines.map((l) => l.product.id)), [lines])

  const results = useMemo<Product[]>(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const scored: { product: Product; score: number }[] = []
    for (const product of catalogItems) {
      const name = product.name.toLowerCase()
      const category = product.category.toLowerCase()
      let score = -1
      if (name === q) score = 100
      else if (name.startsWith(q)) score = 80
      else if (name.includes(q)) score = 60
      else if (category.includes(q)) score = 30
      if (score >= 0) scored.push({ product, score })
    }
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.product.inStock) - Number(a.product.inStock) ||
        a.product.price - b.product.price,
    )
    return scored.slice(0, MAX_RESULTS).map((s) => s.product)
  }, [query, catalogItems])

  const handleAdd = (product: Product) => {
    addItem(product)
    setJustAdded(product.id)
    if (addedTimer.current) clearTimeout(addedTimer.current)
    addedTimer.current = setTimeout(() => setJustAdded(null), 1200)
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the full catalog to add items (min. 2 characters)..."
        aria-label="Search products to add to cart"
      />

      {query.trim().length >= 2 && (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
          {results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <IconBadge color="pink" size="sm">
                <SearchX className="size-3.5" aria-hidden="true" />
              </IconBadge>
              No products match &ldquo;{query.trim()}&rdquo;
            </div>
          ) : (
            results.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40"
              >
                <div className="size-11 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary/40 p-1">
                  <Image
                    src={product.image || "/placeholder.svg"}
                    alt={product.name}
                    className="size-full object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Text className="truncate text-xs font-semibold text-foreground" title={product.name}>
                    {product.name}
                  </Text>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <Badge variant="default" size="sm" className="max-w-[140px] truncate">
                      {product.category}
                    </Badge>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {formatINR(product.price)}
                    </span>
                  </div>
                </div>
                <Button
                  variant={inCart.has(product.id) ? "outline" : "primary"}
                  size="sm"
                  className="shrink-0 gap-1"
                  aria-label={`Add ${product.name} to cart`}
                  onClick={() => handleAdd(product)}
                >
                  {inCart.has(product.id) && justAdded !== product.id ? (
                    <>
                      <Check className="size-3.5 text-emerald-500" aria-hidden="true" />
                      In cart
                    </>
                  ) : justAdded === product.id ? (
                    <>
                      <Check className="size-3.5" aria-hidden="true" />
                      Added
                    </>
                  ) : (
                    <>
                      <Plus className="size-3.5" aria-hidden="true" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
