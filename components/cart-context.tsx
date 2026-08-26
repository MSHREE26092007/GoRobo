"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { products as localProducts, type Product } from "@/lib/products"
import { useCatalog } from "@/components/catalog-context"

export type CartItem = { productId: string; qty: number }
export type CartLine = { product: Product; qty: number }

export type Cart = {
  id: string
  name: string
  items: CartItem[]
}

type StoredState = {
  activeId: string
  carts: Cart[]
}

const STORAGE_KEY = "gorobo-carts-v3"
const LEGACY_KEY = "gorobo-cart-v2"
const DEFAULT_CART_NAME = "My Cart"

type CartContextValue = {
  // Active cart state
  items: CartItem[]
  lines: CartLine[]
  count: number
  total: number
  addItem: (product: Product, qty?: number) => void
  setQty: (productId: string, qty: number) => void
  removeItem: (productId: string) => void
  clear: () => void

  // Multi-cart management
  carts: Cart[]
  activeCartId: string | null
  activeCartName: string
  createCart: (name?: string) => string
  switchCart: (cartId: string) => void
  renameCart: (cartId: string, name: string) => void
  deleteCart: (cartId: string) => void
}

const CartContext = createContext<CartContextValue | null>(null)

function sanitizeItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (entry): entry is CartItem =>
      !!entry &&
      typeof entry.productId === "string" &&
      typeof entry.qty === "number" &&
      entry.qty > 0,
  )
}

function makeId(): string {
  return `cart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function loadStored(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredState>
      const carts = Array.isArray(parsed.carts)
        ? parsed.carts
            .filter(
              (c): c is Cart =>
                !!c && typeof c.id === "string" && typeof c.name === "string",
            )
            .map((c) => ({ id: c.id, name: c.name, items: sanitizeItems(c.items) }))
        : []
      if (carts.length > 0) {
        const activeId =
          typeof parsed.activeId === "string" && carts.some((c) => c.id === parsed.activeId)
            ? parsed.activeId
            : carts[0].id
        return { activeId, carts }
      }
    }
  } catch {
    // fall through to legacy migration
  }

  // Migrate the legacy single-cart format (gorobo-cart-v2) into a default cart.
  try {
    const legacyRaw = localStorage.getItem(LEGACY_KEY)
    if (legacyRaw) {
      const items = sanitizeItems(JSON.parse(legacyRaw))
      const cart: Cart = { id: makeId(), name: DEFAULT_CART_NAME, items }
      localStorage.removeItem(LEGACY_KEY)
      return { activeId: cart.id, carts: [cart] }
    }
  } catch {
    // ignore
  }

  const cart: Cart = { id: makeId(), name: DEFAULT_CART_NAME, items: [] }
  return { activeId: cart.id, carts: [cart] }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { items: catalogItems } = useCatalog()
  const [state, setState] = useState<StoredState>({ activeId: "", carts: [] })

  // Restore persisted carts AFTER hydration so the server HTML always
  // matches the first client render.
  useEffect(() => {
    setState(loadStored())
  }, [])

  useEffect(() => {
    if (!state.activeId) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore
    }
  }, [state])

  const activeCart = useMemo(
    () => state.carts.find((c) => c.id === state.activeId) ?? state.carts[0],
    [state],
  )

  const mutateActive = useCallback(
    (fn: (items: CartItem[]) => CartItem[]) => {
      setState((prev) => ({
        ...prev,
        carts: prev.carts.map((c) =>
          c.id === prev.activeId ? { ...c, items: fn(c.items) } : c,
        ),
      }))
    },
    [],
  )

  const addItem = useCallback(
    (product: Product, qty = 1) => {
      mutateActive((prev) => {
        const existing = prev.find((entry) => entry.productId === product.id)
        if (existing) {
          return prev.map((entry) =>
            entry.productId === product.id ? { ...entry, qty: entry.qty + qty } : entry,
          )
        }
        return [...prev, { productId: product.id, qty }]
      })
    },
    [mutateActive],
  )

  const setQty = useCallback(
    (productId: string, qty: number) => {
      mutateActive((prev) =>
        qty <= 0
          ? prev.filter((entry) => entry.productId !== productId)
          : prev.map((entry) => (entry.productId === productId ? { ...entry, qty } : entry)),
      )
    },
    [mutateActive],
  )

  const removeItem = useCallback(
    (productId: string) => {
      mutateActive((prev) => prev.filter((entry) => entry.productId !== productId))
    },
    [mutateActive],
  )

  const clear = useCallback(() => mutateActive(() => []), [mutateActive])

  const createCart = useCallback((name?: string) => {
    const id = makeId()
    setState((prev) => {
      const count = prev.carts.length + 1
      const cart: Cart = {
        id,
        name: name?.trim() || `${DEFAULT_CART_NAME} ${count}`,
        items: [],
      }
      return { activeId: id, carts: [...prev.carts, cart] }
    })
    return id
  }, [])

  const switchCart = useCallback((cartId: string) => {
    setState((prev) =>
      prev.carts.some((c) => c.id === cartId) ? { ...prev, activeId: cartId } : prev,
    )
  }, [])

  const renameCart = useCallback((cartId: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setState((prev) => ({
      ...prev,
      carts: prev.carts.map((c) => (c.id === cartId ? { ...c, name: trimmed } : c)),
    }))
  }, [])

  const deleteCart = useCallback((cartId: string) => {
    setState((prev) => {
      const remaining = prev.carts.filter((c) => c.id !== cartId)
      if (remaining.length === 0) {
        const fresh: Cart = { id: makeId(), name: DEFAULT_CART_NAME, items: [] }
        return { activeId: fresh.id, carts: [fresh] }
      }
      const activeId =
        prev.activeId === cartId ? remaining[0].id : prev.activeId
      return { activeId, carts: remaining }
    })
  }, [])

  const items = activeCart?.items ?? []

  // Resolve product details from the live catalog (API-loaded, includes all
  // Robu items), falling back to the bundled static list.
  const productById = useMemo(() => {
    const map = new Map<string, Product>()
    for (const p of localProducts) map.set(p.id, p)
    for (const p of catalogItems) map.set(p.id, p)
    return map
  }, [catalogItems])

  const lines = useMemo<CartLine[]>(
    () =>
      items
        .map((entry) => {
          const product = productById.get(entry.productId)
          return product ? { product, qty: entry.qty } : null
        })
        .filter((line): line is CartLine => line !== null),
    [items, productById],
  )

  const count = useMemo(() => items.reduce((sum, entry) => sum + entry.qty, 0), [items])
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + line.product.price * line.qty, 0),
    [lines],
  )
  const activeCartName = activeCart?.name ?? ""

  return (
    <CartContext.Provider
      value={{
        items,
        lines,
        count,
        total,
        addItem,
        setQty,
        removeItem,
        clear,
        carts: state.carts,
        activeCartId: state.activeId || null,
        activeCartName,
        createCart,
        switchCart,
        renameCart,
        deleteCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within CartProvider")
  return ctx
}
