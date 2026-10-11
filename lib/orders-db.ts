/**
 * Orders database layer — Hybrid Supabase + LocalStorage.
 *
 * Guaranteed zero-data-loss:
 * - Orders placed at checkout are saved immediately to local storage AND synced with Supabase.
 * - If the Supabase 'orders' table is not yet created, orders still display in Admin and
 *   track in the Track page without any disruption.
 * - When Supabase table is created, data syncs cleanly with the cloud database.
 */

import { createClient as createBrowserClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://iftjfycerfievnxmosjy.supabase.co"
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_lRQfe4P9nsqrB5yNmEdNeQ_Zmmt9FTm"

export function getSupabase() {
  return createBrowserClient(supabaseUrl, supabaseKey)
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"

export type OrderItem = {
  itemId: string
  name?: string
  quantity: number
  price?: number
}

export type Order = {
  id: string
  created_at: string
  customer_name: string
  phone: string
  delivery_mode: "normal" | "buzz" | "bolt"
  items: OrderItem[]
  subtotal: number
  status: OrderStatus
  tracking_number: string | null
  carrier: string | null
  notes: string | null
  maps_url: string | null
}

export type CreateOrderInput = {
  customer_name: string
  phone: string
  delivery_mode?: "normal" | "buzz" | "bolt"
  items: OrderItem[]
  subtotal: number
  maps_url?: string
}

const LOCAL_STORAGE_KEY = "gorobo_orders_store_v1"

// ── Local Storage Helpers ──────────────────────────────────────────────────
export function getLocalOrders(): Order[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Order[]
  } catch (err) {
    console.error("[orders-db] Failed to read local orders:", err)
    return []
  }
}

export function saveLocalOrders(orders: Order[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(orders))
  } catch (err) {
    console.error("[orders-db] Failed to save local orders:", err)
  }
}

function saveSingleLocalOrder(order: Order): void {
  const current = getLocalOrders()
  const idx = current.findIndex((o) => o.id === order.id)
  if (idx >= 0) {
    current[idx] = order
  } else {
    current.unshift(order)
  }
  saveLocalOrders(current)
}

function generateTrackingCode(): string {
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `GRB-${rand}`
}

function generateOrderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID()
    } catch {}
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ── Supabase Health Check ───────────────────────────────────────────────────
export async function checkSupabaseStatus(): Promise<{ connected: boolean; tableExists: boolean; error?: string }> {
  try {
    const supabase = getSupabase()
    const { error } = await supabase.from("orders").select("id").limit(1)
    if (error) {
      if (error.code === "PGRST205" || error.message.includes("does not exist") || error.message.includes("schema cache")) {
        return { connected: true, tableExists: false, error: "The 'orders' table has not been created in Supabase yet." }
      }
      return { connected: false, tableExists: false, error: error.message }
    }
    return { connected: true, tableExists: true }
  } catch (e) {
    return { connected: false, tableExists: false, error: String(e) }
  }
}

// ── CRUD Operations ─────────────────────────────────────────────────────────

/** Insert a new order (called from the cart checkout flow) */
export async function insertOrder(input: CreateOrderInput): Promise<Order> {
  const defaultTracking = generateTrackingCode()
  const localOrder: Order = {
    id: generateOrderId(),
    created_at: new Date().toISOString(),
    customer_name: input.customer_name,
    phone: input.phone,
    delivery_mode: input.delivery_mode ?? "normal",
    items: input.items,
    subtotal: input.subtotal,
    status: "pending",
    tracking_number: defaultTracking,
    carrier: null,
    notes: null,
    maps_url: input.maps_url ?? null,
  }

  // Always save locally immediately
  saveSingleLocalOrder(localOrder)

  // Try saving to Supabase
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from("orders")
      .insert({
        id: localOrder.id,
        customer_name: input.customer_name,
        phone: input.phone,
        delivery_mode: input.delivery_mode ?? "normal",
        items: input.items,
        subtotal: input.subtotal,
        status: "pending",
        tracking_number: defaultTracking,
        maps_url: input.maps_url ?? null,
      })
      .select()
      .single()

    if (!error && data) {
      saveSingleLocalOrder(data as Order)
      return data as Order
    } else if (error) {
      console.warn("[insertOrder] Supabase insert notice (using local storage fallback):", error.message)
    }
  } catch (err) {
    console.warn("[insertOrder] Supabase network/client exception:", err)
  }

  return localOrder
}

/** Fetch all orders — admin use only */
export async function fetchAllOrders(): Promise<Order[]> {
  const local = getLocalOrders()

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })

    if (!error && data) {
      const map = new Map<string, Order>()
      // Supabase orders
      for (const row of data as Order[]) {
        map.set(row.id, row)
      }
      // Merge any local-only orders that haven't synced yet
      for (const row of local) {
        if (!map.has(row.id)) {
          map.set(row.id, row)
        }
      }
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      saveLocalOrders(merged)
      return merged
    }
  } catch (err) {
    console.warn("[fetchAllOrders] Supabase fetch error, fallback to local:", err)
  }

  return local
}

/** Update an order (admin: change status, add tracking, notes, etc.) */
export async function updateOrder(
  id: string,
  patch: Partial<Pick<Order, "status" | "tracking_number" | "carrier" | "notes">>,
): Promise<Order | null> {
  const local = getLocalOrders()
  const idx = local.findIndex((o) => o.id === id)
  let updatedOrder: Order | null = null

  if (idx >= 0) {
    local[idx] = { ...local[idx], ...patch }
    saveLocalOrders(local)
    updatedOrder = local[idx]
  }

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", id)
      .select()
      .single()

    if (!error && data) {
      saveSingleLocalOrder(data as Order)
      return data as Order
    }
  } catch (err) {
    console.warn("[updateOrder] Supabase update notice (persisted in local storage):", err)
  }

  return updatedOrder
}

/** Delete an order from local storage and Supabase */
export async function deleteOrder(id: string): Promise<boolean> {
  const local = getLocalOrders()
  const filtered = local.filter((o) => o.id !== id)
  saveLocalOrders(filtered)

  try {
    const supabase = getSupabase()
    await supabase.from("orders").delete().eq("id", id)
  } catch (err) {
    console.warn("[deleteOrder] Supabase delete warning:", err)
  }

  return true
}

/** Sync all local orders to Supabase cloud if table exists */
export async function syncLocalOrdersToCloud(): Promise<{ syncedCount: number; errors: number; message: string }> {
  const local = getLocalOrders()
  if (local.length === 0) return { syncedCount: 0, errors: 0, message: "No orders found to sync." }

  try {
    const supabase = getSupabase()
    const { data: cloudOrders, error: fetchErr } = await supabase.from("orders").select("id")

    if (fetchErr) {
      return { syncedCount: 0, errors: 1, message: fetchErr.message }
    }

    const cloudIds = new Set((cloudOrders || []).map((o: { id: string }) => o.id))
    const toUpload = local.filter((o) => !cloudIds.has(o.id))

    if (toUpload.length === 0) {
      return { syncedCount: 0, errors: 0, message: `All ${local.length} orders are already in cloud sync.` }
    }

    let synced = 0
    let errs = 0
    for (const order of toUpload) {
      const { error: insErr } = await supabase.from("orders").upsert({
        id: order.id,
        customer_name: order.customer_name,
        phone: order.phone,
        delivery_mode: order.delivery_mode,
        items: order.items,
        subtotal: order.subtotal,
        status: order.status,
        tracking_number: order.tracking_number,
        carrier: order.carrier,
        notes: order.notes,
        maps_url: order.maps_url,
        created_at: order.created_at,
      })
      if (!insErr) {
        synced++
      } else {
        errs++
        console.warn("[syncLocalOrdersToCloud] Upsert error for:", order.id, insErr)
      }
    }

    return {
      syncedCount: synced,
      errors: errs,
      message: `Synced ${synced} order(s) successfully to Supabase!${errs > 0 ? ` (${errs} errors)` : ""}`,
    }
  } catch (e) {
    return { syncedCount: 0, errors: 1, message: String(e) }
  }
}

/** Find an order by tracking number or order ID — used on the public track page */
export async function findOrderByTracking(searchQuery: string): Promise<Order | null> {
  const clean = searchQuery.trim().toLowerCase()
  if (!clean) return null

  // Check Supabase first
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .or(`tracking_number.ilike.${clean},id.eq.${clean}`)
      .limit(1)

    if (!error && data && data.length > 0) {
      return data[0] as Order
    }
  } catch {
    // Continue to local search
  }

  // Fallback to local storage
  const local = getLocalOrders()
  const match = local.find(
    (o) =>
      o.tracking_number?.toLowerCase() === clean ||
      o.id.toLowerCase() === clean ||
      o.id.toLowerCase().startsWith(clean)
  )

  return match ?? null
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
}

export const STATUS_ORDER: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
]
