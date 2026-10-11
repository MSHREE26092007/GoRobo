"use client"

import { useState, useEffect, Suspense, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { findOrderByTracking, type Order, type OrderStatus, STATUS_LABELS, STATUS_ORDER } from "@/lib/orders-db"
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  ArrowRight,
  MapPin,
  Phone,
  Zap,
  Hash,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
} from "lucide-react"
import Link from "next/link"

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
}
function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)
}

function statusIcon(status: OrderStatus, className = "size-5") {
  switch (status) {
    case "pending": return <Clock className={className} />
    case "confirmed": return <CheckCircle2 className={className} />
    case "processing": return <Package className={className} />
    case "shipped": case "out_for_delivery": return <Truck className={className} />
    case "delivered": return <CheckCircle2 className={className} />
    case "cancelled": return <XCircle className={className} />
  }
}

function statusBgColor(status: OrderStatus) {
  switch (status) {
    case "pending": return "bg-amber-500"
    case "confirmed": return "bg-blue-500"
    case "processing": return "bg-violet-500"
    case "shipped": return "bg-cyan-500"
    case "out_for_delivery": return "bg-orange-500"
    case "delivered": return "bg-emerald-500"
    case "cancelled": return "bg-red-500"
  }
}

function TrackingTimeline({ order }: { order: Order }) {
  if (order.status === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
        <XCircle className="size-5 shrink-0 text-red-400" />
        <div>
          <p className="font-semibold text-red-400">Order Cancelled</p>
          {order.notes && <p className="text-sm text-red-400/70">{order.notes}</p>}
        </div>
      </div>
    )
  }

  const currentIdx = STATUS_ORDER.indexOf(order.status)

  return (
    <div className="space-y-0">
      {STATUS_ORDER.map((s, idx) => {
        const done = idx <= currentIdx
        const active = idx === currentIdx
        const last = idx === STATUS_ORDER.length - 1

        return (
          <div key={s} className="flex gap-4">
            {/* Spine */}
            <div className="flex flex-col items-center">
              <div className={`flex size-9 items-center justify-center rounded-full border-2 transition-all ${
                active
                  ? `${statusBgColor(s)} border-transparent text-white shadow-lg`
                  : done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-white/10 bg-white/5 text-white/20"
              }`}>
                {statusIcon(s, "size-4")}
              </div>
              {!last && (
                <div className={`mt-1 mb-1 w-0.5 flex-1 min-h-[2rem] rounded-full transition-all ${done && currentIdx > idx ? "bg-emerald-500/50" : "bg-white/8"}`} />
              )}
            </div>

            {/* Label */}
            <div className={`pb-6 flex-1 ${last ? "pb-0" : ""}`}>
              <p className={`mt-1.5 text-sm font-semibold ${active ? "text-white" : done ? "text-emerald-400" : "text-white/25"}`}>
                {STATUS_LABELS[s]}
              </p>
              {active && (
                <p className="mt-0.5 text-xs text-white/50">
                  {s === "pending" && "Your order has been received and is awaiting confirmation."}
                  {s === "confirmed" && "Your order has been confirmed and is being prepared."}
                  {s === "processing" && "Your order is being packed and processed."}
                  {s === "shipped" && `Shipped via ${order.carrier ?? "courier"} · Tracking: ${order.tracking_number ?? "—"}`}
                  {s === "out_for_delivery" && "Out for delivery — expect it today!"}
                  {s === "delivered" && "Your order has been delivered. Thank you! 🎉"}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TrackContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get("q") ?? searchParams.get("tracking") ?? searchParams.get("id") ?? ""

  const [trackingInput, setTrackingInput] = useState(initialQuery)
  const [order, setOrder] = useState<Order | null | "not-found">(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState("")

  const executeSearch = useCallback(async (code: string) => {
    const val = code.trim()
    if (!val) { setError("Please enter a tracking number."); return }
    setError(""); setSearching(true)
    const result = await findOrderByTracking(val)
    setSearching(false)
    setOrder(result ?? "not-found")
  }, [])

  useEffect(() => {
    if (initialQuery) {
      executeSearch(initialQuery)
    }
  }, [initialQuery, executeSearch])

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    executeSearch(trackingInput)
  }

  const foundOrder = order && order !== "not-found" ? order as Order : null

  return (
    <div className="min-h-screen bg-gradient-to-b from-[oklch(0.12_0.03_155)] via-[oklch(0.14_0.025_155)] to-[oklch(0.11_0.02_155)] text-white">
      {/* Nav */}
      <nav className="border-b border-white/8 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white transition">
            <div className="flex size-7 items-center justify-center rounded-lg bg-[oklch(0.58_0.16_155)]">
              <Package className="size-4 text-white" />
            </div>
            Go RoBo
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition">
              <ShieldCheck className="size-3.5" />Admin
            </Link>
            <Link href="/" className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition">
              Back to store <ChevronRight className="size-3" />
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-2xl px-4 py-12">
        {/* Hero */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-[oklch(0.58_0.16_155)]/20 border border-[oklch(0.58_0.16_155)]/30">
            <Truck className="size-8 text-[oklch(0.7_0.16_155)]" />
          </div>
          <h1 className="text-3xl font-bold" style={{fontFamily:"DM Sans, sans-serif"}}>Track Your Order</h1>
          <p className="mt-2 text-white/50">Enter your tracking number or order ID to see real-time status.</p>
        </div>

        {/* Search form */}
        <form onSubmit={handleFormSubmit} className="mb-8">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Hash className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/30" />
              <input
                id="tracking-number-input"
                value={trackingInput}
                onChange={(e) => { setTrackingInput(e.target.value); setError(""); setOrder(null) }}
                placeholder="e.g. GRB-ABCDE or order ID"
                autoFocus
                className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-base text-white placeholder-white/25 outline-none transition focus:border-[oklch(0.58_0.16_155)]/60 focus:ring-2 focus:ring-[oklch(0.58_0.16_155)]/25"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              id="track-submit-btn"
              className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[oklch(0.58_0.16_155)] px-7 py-4 font-semibold text-white shadow-lg shadow-[oklch(0.58_0.16_155)]/25 transition hover:bg-[oklch(0.62_0.17_155)] active:scale-[0.98] disabled:opacity-60"
            >
              {searching ? (
                <><Search className="size-5 animate-pulse" />Searching…</>
              ) : (
                <><Search className="size-5" />Track</>
              )}
            </button>
          </div>
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-red-400">
              <AlertCircle className="size-4" />{error}
            </p>
          )}
        </form>

        {/* Not found */}
        {order === "not-found" && (
          <div className="rounded-2xl border border-white/8 bg-white/4 p-8 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-red-500/15">
              <AlertCircle className="size-6 text-red-400" />
            </div>
            <h2 className="mb-1 font-semibold text-white">Order Not Found</h2>
            <p className="text-sm text-white/50">
              No order matches <span className="font-mono text-white/70">{trackingInput}</span>. Check the number and try again, or contact us on WhatsApp.
            </p>
            <a
              href="https://wa.me/919150474495"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition"
            >
              Contact Go RoBo on WhatsApp <ArrowRight className="size-4" />
            </a>
          </div>
        )}

        {/* Found order */}
        {foundOrder && (
          <div className="space-y-4">
            {/* Status hero */}
            <div className={`rounded-2xl border p-6 ${
              foundOrder.status === "delivered"
                ? "border-emerald-500/30 bg-emerald-500/8"
                : foundOrder.status === "cancelled"
                  ? "border-red-500/30 bg-red-500/8"
                  : "border-[oklch(0.58_0.16_155)]/20 bg-[oklch(0.58_0.16_155)]/8"
            }`}>
              <div className="flex items-center gap-4">
                <div className={`flex size-14 items-center justify-center rounded-xl ${statusBgColor(foundOrder.status)} shadow-lg`}>
                  {statusIcon(foundOrder.status, "size-7")}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/50 mb-0.5">Order Status</p>
                  <h2 className="text-xl font-bold text-white" style={{fontFamily:"DM Sans,sans-serif"}}>
                    {STATUS_LABELS[foundOrder.status]}
                  </h2>
                </div>
              </div>
            </div>

            {/* Order meta */}
            <div className="rounded-2xl border border-white/8 bg-white/4 p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">Order Details</p>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="flex items-center gap-2 text-white/60">
                  <Clock className="size-4 shrink-0" />
                  <span>{formatDate(foundOrder.created_at)}</span>
                </div>
                <div className="flex items-center gap-2 text-white/60">
                  <Phone className="size-4 shrink-0" />
                  <span>+91 {foundOrder.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-white/60">
                  {foundOrder.delivery_mode === "buzz"
                    ? <><Zap className="size-4 shrink-0 text-amber-400" /><span className="text-amber-400">Buzz Express Delivery</span></>
                    : <><Truck className="size-4 shrink-0" /><span>Normal Delivery (1–2 days)</span></>
                  }
                </div>
                {foundOrder.tracking_number && (
                  <div className="flex items-center gap-2 text-white/60 font-mono text-xs">
                    <Hash className="size-4 shrink-0" />
                    {foundOrder.tracking_number}
                    {foundOrder.carrier && <span className="text-white/40">· {foundOrder.carrier}</span>}
                  </div>
                )}
                {foundOrder.maps_url && (
                  <a href={foundOrder.maps_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[oklch(0.7_0.16_155)] hover:underline">
                    <MapPin className="size-4 shrink-0" />View Location
                  </a>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="rounded-2xl border border-white/8 bg-white/4 p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">Items Ordered</p>
              <div className="space-y-2">
                {foundOrder.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="flex-1 truncate text-white/80">{item.name ?? item.itemId}</span>
                    <div className="ml-3 flex shrink-0 items-center gap-3">
                      <span className="text-white/40">×{item.quantity}</span>
                      {item.price ? <span className="font-mono text-white/70">{formatINR(item.price * item.quantity)}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
              {foundOrder.subtotal > 0 && (
                <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-3 text-sm font-semibold">
                  <span className="text-white/60">Subtotal</span>
                  <span className="font-mono text-white">{formatINR(foundOrder.subtotal)}</span>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="rounded-2xl border border-white/8 bg-white/4 p-5">
              <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-white/40">Delivery Timeline</p>
              <TrackingTimeline order={foundOrder} />
            </div>

            {/* Help */}
            <div className="rounded-2xl border border-white/8 bg-white/4 p-5 text-center">
              <p className="text-sm text-white/50">Need help with your order?</p>
              <a
                href={`https://wa.me/919150474495?text=${encodeURIComponent(`Hi Go RoBo, I'd like to check on my order (tracking: ${foundOrder.tracking_number ?? foundOrder.id.slice(0,8)}). Customer: ${foundOrder.customer_name}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[oklch(0.58_0.16_155)] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[oklch(0.58_0.16_155)]/25 transition hover:bg-[oklch(0.62_0.17_155)]"
              >
                Contact on WhatsApp <ArrowRight className="size-4" />
              </a>
            </div>
          </div>
        )}

        {/* Empty state tips */}
        {!order && (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: <Hash className="size-5" />, title: "Your Tracking Number", desc: "e.g. GRB-ABCDE shared on checkout or WhatsApp" },
              { icon: <Phone className="size-5" />, title: "No Number?", desc: "Message us on WhatsApp and we'll look up your order" },
              { icon: <Truck className="size-5" />, title: "Delivery Time", desc: "Normal: 1–2 days · Buzz Express: Same/next day (Chennai)" },
            ].map((tip, i) => (
              <div key={i} className="rounded-2xl border border-white/8 bg-white/4 p-4 text-center">
                <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-xl bg-[oklch(0.58_0.16_155)]/15 text-[oklch(0.7_0.16_155)]">
                  {tip.icon}
                </div>
                <p className="mb-1 text-sm font-semibold text-white">{tip.title}</p>
                <p className="text-xs text-white/45">{tip.desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default function TrackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[oklch(0.12_0.03_155)] flex items-center justify-center text-white/50 text-sm">
        Loading order tracking…
      </div>
    }>
      <TrackContent />
    </Suspense>
  )
}
