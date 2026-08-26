"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { products as localProducts, type Product } from "@/lib/products"
import { fetchItems } from "@/lib/gorobo-api"
import { loadStaticCatalog } from "@/lib/catalog-static"

type CatalogContextValue = {
  activeCategory: string | null
  setActiveCategory: (category: string | null) => void
  isSidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  items: Product[]
  /** Where the current items came from — useful for debugging. */
  source: "static" | "api" | "bundled" | "loading"
}

const CatalogContext = createContext<CatalogContextValue | null>(null)

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [items, setItems] = useState<Product[]>(localProducts)
  const [source, setSource] = useState<CatalogContextValue["source"]>("loading")

  // Restore the persisted collapsed state AFTER hydration so the server
  // HTML (expanded) always matches the first client render.
  useEffect(() => {
    try {
      if (localStorage.getItem("gorobo-sidebar") === "collapsed") {
        setIsSidebarOpen(false)
      }
    } catch {
      // ignore
    }
  }, [])

  // Catalog loading order (first success wins):
  //   1. Static CDN snapshot (/data/catalog/*) — fast, free, no API hit.
  //   2. Live API full list — fallback when no snapshot exists yet.
  //   3. Bundled list — already rendered while loading; kept on total failure.
  useEffect(() => {
    let cancelled = false

    async function load() {
      const staticProducts = await loadStaticCatalog()
      if (!cancelled && staticProducts?.length) {
        setItems(staticProducts)
        setSource("static")
        return
      }

      const apiItems = await fetchItems()
      if (!cancelled && apiItems?.length) {
        setItems(apiItems)
        setSource("api")
      } else if (!cancelled) {
        setSource("bundled")
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const setSidebarOpen = useCallback((open: boolean) => {
    setIsSidebarOpen(open)
    try {
      localStorage.setItem("gorobo-sidebar", open ? "expanded" : "collapsed")
    } catch {
      // ignore
    }
  }, [])

  return (
    <CatalogContext.Provider value={{ activeCategory, setActiveCategory, isSidebarOpen, setSidebarOpen, items, source }}>
      {children}
    </CatalogContext.Provider>
  )
}

export function useCatalog() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error("useCatalog must be used within CatalogProvider")
  return ctx
}
