"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import {
  fetchAllOrders,
  updateOrder,
  insertOrder,
  deleteOrder,
  checkSupabaseStatus,
  syncLocalOrdersToCloud,
  type Order,
  type OrderStatus,
  STATUS_LABELS,
} from "@/lib/orders-db"
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Search,
  ChevronDown,
  LogOut,
  Eye,
  Edit3,
  X,
  Zap,
  ShieldCheck,
  AlertCircle,
  MapPin,
  Phone,
  Hash,
  Copy,
  Check,
  MessageCircle,
  ExternalLink,
  Database,
  PlusCircle,
  TrendingUp,
  Download,
  Trash2,
  ArrowUpDown,
  FileSpreadsheet,
  IndianRupee,
  Activity,
  Layers,
} from "lucide-react"

// ── Auth ─────────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "gorobo-admin-2024"
const SESSION_KEY = "gorobo-admin-session"

function getSession(): boolean {
  try {
    return localStorage.getItem(SESSION_KEY) === "1"
  } catch {
    return false
  }
}
function setSession(v: boolean) {
  try {
    if (v) localStorage.setItem(SESSION_KEY, "1")
    else localStorage.removeItem(SESSION_KEY)
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusColor(status: OrderStatus): string {
  const m: Record<OrderStatus, string> = {
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    confirmed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    processing: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    shipped: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    out_for_delivery: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    delivered: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
  }
  return m[status]
}

function StatusIcon({ status }: { status: OrderStatus }) {
  switch (status) {
    case "pending":
      return <Clock className="size-3.5" />
    case "confirmed":
      return <CheckCircle2 className="size-3.5" />
    case "processing":
      return <Package className="size-3.5" />
    case "shipped":
    case "out_for_delivery":
      return <Truck className="size-3.5" />
    case "delivered":
      return <CheckCircle2 className="size-3.5" />
    case "cancelled":
      return <XCircle className="size-3.5" />
  }
}

const ALL_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
]

// ── SQL Setup Script ──────────────────────────────────────────────────────────
const SETUP_SQL = `-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard):

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  delivery_mode text default 'normal',
  items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  maps_url text,
  status text not null default 'pending',
  tracking_number text,
  carrier text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security and allow public order submission & tracking:
alter table orders enable row level security;
create policy "Allow all operations" on orders for all using (true) with check (true);
`

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [pw, setPw] = useState("")
  const [err, setErr] = useState("")
  const [shake, setShake] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pw === ADMIN_PASSWORD) {
      setSession(true)
      onLogin()
    } else {
      setErr("Incorrect password.")
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[oklch(0.12_0.03_155)] via-[oklch(0.15_0.05_155)] to-[oklch(0.1_0.02_155)] px-4">
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-[oklch(0.58_0.16_155)] shadow-lg shadow-[oklch(0.58_0.16_155)]/30">
            <ShieldCheck className="size-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "DM Sans, sans-serif" }}>
            Go RoBo Admin
          </h1>
          <p className="mt-1 text-sm text-white/50">Order & Revenue Tracking Dashboard</p>
        </div>
        <form
          onSubmit={submit}
          style={shake ? { animation: "shake 0.4s ease-in-out" } : {}}
          className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md shadow-2xl"
        >
          <label className="mb-1.5 block text-sm font-medium text-white/70">Admin Password</label>
          <input
            type="password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value)
              setErr("")
            }}
            placeholder="Enter admin password…"
            autoFocus
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-[oklch(0.58_0.16_155)]/60 focus:ring-2 focus:ring-[oklch(0.58_0.16_155)]/20"
          />
          {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
          <button
            type="submit"
            className="mt-5 w-full rounded-xl bg-[oklch(0.58_0.16_155)] py-3 font-semibold text-white shadow-md shadow-[oklch(0.58_0.16_155)]/25 transition hover:bg-[oklch(0.62_0.17_155)] active:scale-[0.98]"
          >
            Sign In to Dashboard
          </button>
          <p className="mt-4 text-center text-xs text-white/30">Go RoBo Chennai · Default: gorobo-admin-2024</p>
        </form>
      </div>
    </div>
  )
}

// ── SQL Setup Modal ───────────────────────────────────────────────────────────
function SqlSetupModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function copySql() {
    navigator.clipboard.writeText(SETUP_SQL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[oklch(0.14_0.025_155)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[oklch(0.58_0.16_155)]/20 text-[oklch(0.7_0.16_155)]">
              <Database className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Supabase Cloud Database Sync</h2>
              <p className="text-xs text-white/50">One-time setup to synchronize orders and revenue across devices</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/8 hover:text-white transition">
            <X className="size-5" />
          </button>
        </div>

        <div className="relative my-4">
          <pre className="max-h-60 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-xs text-emerald-400">
            {SETUP_SQL}
          </pre>
          <button
            onClick={copySql}
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-white/20 transition"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copy SQL
              </>
            )}
          </button>
        </div>

        <div className="text-xs text-white/60 space-y-1.5 mb-5">
          <p>1. Open your <strong>Supabase Dashboard</strong> at <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">supabase.com</a>.</p>
          <p>2. Navigate to the <strong>SQL Editor</strong> tab on the left sidebar.</p>
          <p>3. Paste the code above and click <strong>Run</strong>.</p>
          <p className="text-white/40 italic">* Note: All orders are safely preserved in browser local storage automatically.</p>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl bg-[oklch(0.58_0.16_155)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[oklch(0.62_0.17_155)]">
            Got It
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Order Detail Modal ────────────────────────────────────────────────────────
function DetailModal({ order, onClose, onEdit }: { order: Order; onClose: () => void; onEdit: () => void }) {
  const [copiedLink, setCopiedLink] = useState(false)

  function copyTrackingLink() {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const url = `${origin}/track?q=${order.tracking_number ?? order.id}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const originUrl = typeof window !== "undefined" ? window.location.origin : ""
  const whatsappMessage = `Hi ${order.customer_name}, here is the update for your Go RoBo order:
Order Total: ${formatINR(order.subtotal)}
Status: ${STATUS_LABELS[order.status]}
Tracking Number: ${order.tracking_number ?? "Pending"}
${order.carrier ? `Carrier: ${order.carrier}` : ""}
Track online: ${originUrl}/track?q=${order.tracking_number ?? order.id}`

  const whatsappUrl = `https://wa.me/91${order.phone}?text=${encodeURIComponent(whatsappMessage)}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[oklch(0.14_0.025_155)] p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: "DM Sans,sans-serif" }}>
              {order.customer_name}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-white/40">Order ID: {order.id}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/8 hover:text-white transition">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusColor(order.status)}`}>
            <StatusIcon status={order.status} />
            {STATUS_LABELS[order.status]}
          </span>
          {order.tracking_number && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 font-mono text-xs text-white/80">
              <Hash className="size-3" />
              {order.tracking_number}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-medium text-emerald-400">
            <IndianRupee className="size-3" />
            Revenue: {formatINR(order.subtotal)}
          </span>
        </div>

        <div className="space-y-2 text-sm rounded-xl bg-white/4 p-4 border border-white/8">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-white/60">
              <Phone className="size-3.5" />
              Phone:
            </span>
            <span className="font-mono text-white">+91 {order.phone}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-white/60">
              {order.delivery_mode === "buzz" ? <Zap className="size-3.5 text-amber-400" /> : <Truck className="size-3.5" />}
              Delivery Mode:
            </span>
            <span className={order.delivery_mode === "buzz" ? "text-amber-400 font-medium" : "text-white"}>
              {order.delivery_mode === "buzz" ? "⚡ Buzz Express (2h Chennai)" : "🚚 Normal Delivery (1–2 days)"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-white/60">
              <Clock className="size-3.5" />
              Placed At:
            </span>
            <span className="text-white/80">{formatDate(order.created_at)}</span>
          </div>
          {order.carrier && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-white/60">
                <Truck className="size-3.5" />
                Carrier:
              </span>
              <span className="text-white">{order.carrier}</span>
            </div>
          )}
          {order.maps_url && (
            <div className="flex items-center justify-between pt-1">
              <span className="flex items-center gap-2 text-white/60">
                <MapPin className="size-3.5" />
                Location:
              </span>
              <a href={order.maps_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[oklch(0.7_0.16_155)] hover:underline text-xs">
                Open in Maps <ExternalLink className="size-3" />
              </a>
            </div>
          )}
        </div>

        {/* Quick customer actions */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
          >
            <MessageCircle className="size-4" />
            WhatsApp Customer
          </a>
          <button
            onClick={copyTrackingLink}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/10 transition"
          >
            {copiedLink ? (
              <>
                <Check className="size-4 text-emerald-400" />
                Link Copied!
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copy Track Link
              </>
            )}
          </button>
        </div>

        {/* Items & Revenue breakdown */}
        <div className="mt-4 rounded-xl bg-white/4 p-4 border border-white/8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">Items & Line Totals</p>
          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="flex-1 truncate text-white/80">{item.name ?? item.itemId}</span>
                <div className="ml-2 flex shrink-0 items-center gap-3">
                  <span className="text-white/40">×{item.quantity}</span>
                  {item.price ? <span className="font-mono text-white/70">{formatINR(item.price * item.quantity)}</span> : null}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-sm font-semibold">
            <span className="text-white/60">Order Revenue</span>
            <span className="font-mono text-emerald-400 text-base">{formatINR(order.subtotal)}</span>
          </div>
        </div>

        {order.notes && (
          <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/8 p-3 text-xs text-amber-300/80">
            <strong>Note:</strong> {order.notes}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-medium text-white/60 hover:bg-white/5 transition">
            Close
          </button>
          <button
            onClick={onEdit}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[oklch(0.58_0.16_155)] py-2.5 text-sm font-semibold text-white transition hover:bg-[oklch(0.62_0.17_155)] shadow-md shadow-[oklch(0.58_0.16_155)]/20"
          >
            <Edit3 className="size-4" />
            Update Status & Tracking
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Order Modal ──────────────────────────────────────────────────────────
function EditModal({
  order,
  onClose,
  onSaved,
}: {
  order: Order
  onClose: () => void
  onSaved: (o: Order) => void
}) {
  const [status, setStatus] = useState<OrderStatus>(order.status)
  const [tracking, setTracking] = useState(order.tracking_number ?? "")
  const [carrier, setCarrier] = useState(order.carrier ?? "")
  const [notes, setNotes] = useState(order.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  async function save() {
    setSaving(true)
    setErr("")
    const updated = await updateOrder(order.id, {
      status,
      tracking_number: tracking.trim() || null,
      carrier: carrier.trim() || null,
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (!updated) {
      setErr("Failed to save changes. Please try again.")
      return
    }
    onSaved(updated)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[oklch(0.14_0.025_155)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: "DM Sans,sans-serif" }}>
              Update Order Status & Tracking
            </h2>
            <p className="mt-0.5 font-mono text-xs text-white/40">
              {order.customer_name} · {formatINR(order.subtotal)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/8 hover:text-white transition">
            <X className="size-5" />
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-white/60">Fulfillment Status</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  status === s ? statusColor(s) : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">Tracking Number</label>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="e.g. GRB-ABCDE"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[oklch(0.58_0.16_155)]/60 focus:ring-1 focus:ring-[oklch(0.58_0.16_155)]/40 transition"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">Carrier / Courier</label>
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="e.g. Porter, DTDC, India Post"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[oklch(0.58_0.16_155)]/60 focus:ring-1 focus:ring-[oklch(0.58_0.16_155)]/40 transition"
            />
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-white/60">Admin Notes / Dispatched Remarks</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Internal delivery notes or dispatch references…"
            className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[oklch(0.58_0.16_155)]/60 focus:ring-1 focus:ring-[oklch(0.58_0.16_155)]/40 transition"
          />
        </div>

        {err && (
          <p className="mb-3 flex items-center gap-1.5 text-xs text-red-400">
            <AlertCircle className="size-3.5" />
            {err}
          </p>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-medium text-white/60 hover:bg-white/5 transition">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[oklch(0.58_0.16_155)] py-2.5 text-sm font-semibold text-white transition hover:bg-[oklch(0.62_0.17_155)] disabled:opacity-60 shadow-md shadow-[oklch(0.58_0.16_155)]/20"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
const STAT_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
]

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [syncingCloud, setSyncingCloud] = useState(false)
  const [syncNotice, setSyncNotice] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "all">("all")
  const [filterMode, setFilterMode] = useState<"all" | "buzz" | "normal">("all")
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "rev-desc" | "rev-asc">("date-desc")
  const [viewOrder, setViewOrder] = useState<Order | null>(null)
  const [editOrder, setEditOrder] = useState<Order | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [showSqlModal, setShowSqlModal] = useState(false)
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; tableExists: boolean; error?: string } | null>(null)

  useEffect(() => {
    setAuthed(getSession())
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [data, status] = await Promise.all([
      fetchAllOrders(),
      checkSupabaseStatus(),
    ])
    setOrders(data)
    setDbStatus(status)
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (authed) load()
  }, [authed, load])

  async function handleCloudSync() {
    setSyncingCloud(true)
    setSyncNotice(null)
    const res = await syncLocalOrdersToCloud()
    setSyncNotice(res.message)
    await load()
    setSyncingCloud(false)
    setTimeout(() => setSyncNotice(null), 5000)
  }

  async function handleDelete(orderId: string) {
    if (!window.confirm("Are you sure you want to delete this order?")) return
    await deleteOrder(orderId)
    setOrders((prev) => prev.filter((o) => o.id !== orderId))
  }

  async function createSampleOrder() {
    const sampleNames = ["Arun Kumar", "Priya Sharma", "Vignesh R", "Santhosh M", "Divya K", "Karthik Raja"]
    const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)]
    const randomPhone = `9840${Math.floor(100000 + Math.random() * 900000)}`
    const isBuzz = Math.random() > 0.4

    const sampleCatalogs = [
      { itemId: "arduino-uno-r3", name: "Arduino Uno R3 Compatible Board", quantity: 1, price: 450 },
      { itemId: "sg90-servo", name: "SG90 Micro Servo Motor 9g", quantity: 2, price: 85 },
      { itemId: "esp32-wroom", name: "ESP32 DevKit WROOM-32 WiFi + BLE", quantity: 1, price: 340 },
      { itemId: "l298n-driver", name: "L298N Dual Motor Driver Module", quantity: 1, price: 180 },
    ]

    const selectedItems = sampleCatalogs.slice(0, Math.floor(Math.random() * 3) + 1)
    const subtotal = selectedItems.reduce((acc, it) => acc + (it.price * it.quantity), 0)

    const newOrder = await insertOrder({
      customer_name: randomName,
      phone: randomPhone,
      delivery_mode: isBuzz ? "buzz" : "normal",
      items: selectedItems,
      subtotal,
    })

    setOrders((prev) => [newOrder, ...prev])
  }

  function exportCSV() {
    if (orders.length === 0) return
    const headers = [
      "Order ID",
      "Date",
      "Customer Name",
      "Phone",
      "Delivery Mode",
      "Status",
      "Revenue (INR)",
      "Tracking Number",
      "Carrier",
      "Items Count",
    ]
    const rows = orders.map((o) => [
      `"${o.id}"`,
      `"${o.created_at}"`,
      `"${o.customer_name.replace(/"/g, '""')}"`,
      `"+91 ${o.phone}"`,
      `"${o.delivery_mode}"`,
      `"${o.status}"`,
      o.subtotal,
      `"${o.tracking_number ?? ""}"`,
      `"${o.carrier ?? ""}"`,
      o.items.length,
    ])
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `gorobo_revenue_orders_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ── Calculated Revenue & Order Metrics ──────────────────────────────────────
  const revenueMetrics = useMemo(() => {
    let totalGrossRevenue = 0
    let deliveredRevenue = 0
    let pipelineRevenue = 0
    let pendingRevenue = 0
    let buzzRevenue = 0
    let normalRevenue = 0
    let validOrderCount = 0

    for (const o of orders) {
      if (o.status !== "cancelled") {
        totalGrossRevenue += o.subtotal
        validOrderCount += 1

        if (o.delivery_mode === "buzz") {
          buzzRevenue += o.subtotal
        } else {
          normalRevenue += o.subtotal
        }

        if (o.status === "delivered") {
          deliveredRevenue += o.subtotal
        } else if (o.status === "pending") {
          pendingRevenue += o.subtotal
        } else {
          pipelineRevenue += o.subtotal
        }
      }
    }

    const aov = validOrderCount > 0 ? Math.round(totalGrossRevenue / validOrderCount) : 0

    return {
      totalGrossRevenue,
      deliveredRevenue,
      pipelineRevenue,
      pendingRevenue,
      buzzRevenue,
      normalRevenue,
      aov,
      validOrderCount,
    }
  }, [orders])

  if (authed === null) return null
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />

  const filtered = orders
    .filter((o) => {
      const q = search.toLowerCase()
      const matchSearch =
        !search ||
        o.customer_name.toLowerCase().includes(q) ||
        o.phone.includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.tracking_number ?? "").toLowerCase().includes(q)
      const matchStatus = filterStatus === "all" || o.status === filterStatus
      const matchMode = filterMode === "all" || o.delivery_mode === filterMode
      return matchSearch && matchStatus && matchMode
    })
    .sort((a, b) => {
      if (sortBy === "date-desc") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === "date-asc") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortBy === "rev-desc") return b.subtotal - a.subtotal
      if (sortBy === "rev-asc") return a.subtotal - b.subtotal
      return 0
    })

  const stats = STAT_STATUSES.map((s) => ({
    label: STATUS_LABELS[s],
    count: orders.filter((o) => o.status === s).length,
    rev: orders.filter((o) => o.status === s).reduce((acc, o) => acc + o.subtotal, 0),
    status: s,
  }))

  return (
    <div className="min-h-screen bg-[oklch(0.11_0.02_155)] text-white font-sans selection:bg-[oklch(0.58_0.16_155)] selection:text-white pb-20">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[oklch(0.11_0.02_155)]/90 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[oklch(0.52_0.18_155)] to-[oklch(0.65_0.16_155)] shadow-md shadow-[oklch(0.58_0.16_155)]/30">
              <Activity className="size-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white leading-none" style={{ fontFamily: "DM Sans,sans-serif" }}>
                  Go RoBo Admin
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-none text-white/40">Real-Time Order Fulfillment & Revenue Tracking</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastRefresh && (
              <span className="hidden text-xs text-white/30 md:inline-block">
                Updated {lastRefresh.toLocaleTimeString("en-IN")}
              </span>
            )}

            {/* Cloud Sync Button */}
            <button
              onClick={handleCloudSync}
              disabled={syncingCloud}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 transition disabled:opacity-50"
              title="Force sync local orders with Supabase cloud database"
            >
              <Database className={`size-3.5 ${syncingCloud ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Sync Cloud</span>
            </button>

            {/* CSV Export Button */}
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 transition"
              title="Export order ledger & revenue to CSV"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {/* Test Order Button */}
            <button
              onClick={createSampleOrder}
              className="flex items-center gap-1.5 rounded-lg border border-[oklch(0.58_0.16_155)]/40 bg-[oklch(0.58_0.16_155)]/20 px-3 py-1.5 text-xs text-[oklch(0.75_0.16_155)] hover:bg-[oklch(0.58_0.16_155)]/30 transition font-medium"
              title="Add a test order to track live revenue"
            >
              <PlusCircle className="size-3.5" />
              <span className="hidden sm:inline">Test Order</span>
            </button>

            {/* Refresh */}
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white transition disabled:opacity-40"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Public Track Link */}
            <a
              href="/track"
              target="_blank"
              className="hidden items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white transition md:flex"
            >
              <Truck className="size-3.5" />
              Track Page
            </a>

            {/* Logout */}
            <button
              onClick={() => {
                setSession(false)
                setAuthed(false)
              }}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/25 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition"
            >
              <LogOut className="size-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Sync Toast Notice */}
        {syncNotice && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-500/15 p-3 text-xs text-cyan-200">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-cyan-400 shrink-0" />
              {syncNotice}
            </span>
            <button onClick={() => setSyncNotice(null)} className="text-cyan-400 hover:text-white">
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Supabase status banner */}
        {dbStatus && !dbStatus.tableExists && (
          <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <Database className="size-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-300">Dual-Storage Active: Browser Local Storage Safeguard</p>
                <p className="text-xs text-amber-300/70">
                  All orders and revenue metrics are safely preserved locally. Run the 1-click SQL in Supabase to sync live across devices.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSqlModal(true)}
              className="shrink-0 rounded-xl bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition border border-amber-500/30"
            >
              Setup Supabase Cloud Table
            </button>
          </div>
        )}

        {/* ── REVENUE METRICS SECTION ───────────────────────────────────────── */}
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-5 text-[oklch(0.7_0.16_155)]" />
              <h2 className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: "DM Sans, sans-serif" }}>
                Revenue & Financial Tracker
              </h2>
            </div>
            <span className="text-xs text-white/40">
              {revenueMetrics.validOrderCount} active orders · Live calculations
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Gross Revenue */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-5 backdrop-blur-sm shadow-lg shadow-emerald-500/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Total Gross Revenue</span>
                <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <IndianRupee className="size-4" />
                </div>
              </div>
              <p className="mt-2 font-mono text-3xl font-extrabold text-white tracking-tight">
                {formatINR(revenueMetrics.totalGrossRevenue)}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-emerald-300/70">
                <span>From {orders.length} total orders</span>
              </div>
            </div>

            {/* Delivered / Realized Revenue */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/4 p-5 backdrop-blur-sm hover:border-white/20 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Delivered (Realized)</span>
                <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="size-4" />
                </div>
              </div>
              <p className="mt-2 font-mono text-2xl font-bold text-white">
                {formatINR(revenueMetrics.deliveredRevenue)}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-white/40">
                <span>Completed fulfillments</span>
                {revenueMetrics.totalGrossRevenue > 0 && (
                  <span className="font-mono text-emerald-400">
                    {Math.round((revenueMetrics.deliveredRevenue / revenueMetrics.totalGrossRevenue) * 100)}%
                  </span>
                )}
              </div>
            </div>

            {/* Pipeline / In-Transit Revenue */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/4 p-5 backdrop-blur-sm hover:border-white/20 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Active In Pipeline</span>
                <div className="flex size-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
                  <Truck className="size-4" />
                </div>
              </div>
              <p className="mt-2 font-mono text-2xl font-bold text-white">
                {formatINR(revenueMetrics.pipelineRevenue)}
              </p>
              <p className="mt-2 text-xs text-white/40">Confirmed, processing, or in transit</p>
            </div>

            {/* Average Order Value (AOV) & Buzz Breakdown */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/4 p-5 backdrop-blur-sm hover:border-white/20 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Average Order Value</span>
                <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              <p className="mt-2 font-mono text-2xl font-bold text-white">
                {formatINR(revenueMetrics.aov)}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-white/40">
                <span>Buzz Express rev:</span>
                <span className="font-mono text-amber-400">{formatINR(revenueMetrics.buzzRevenue)}</span>
              </div>
            </div>
          </div>

          {/* Revenue Health Visual Progress Bar */}
          {revenueMetrics.totalGrossRevenue > 0 && (
            <div className="mt-3 rounded-xl border border-white/8 bg-white/3 p-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-white/60 font-medium">Revenue Fulfillment Breakdown</span>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="size-2 rounded-full bg-emerald-400" />
                    Delivered ({formatINR(revenueMetrics.deliveredRevenue)})
                  </span>
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <span className="size-2 rounded-full bg-cyan-400" />
                    In Pipeline ({formatINR(revenueMetrics.pipelineRevenue)})
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <span className="size-2 rounded-full bg-amber-400" />
                    Pending ({formatINR(revenueMetrics.pendingRevenue)})
                  </span>
                </div>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  style={{ width: `${(revenueMetrics.deliveredRevenue / revenueMetrics.totalGrossRevenue) * 100}%` }}
                  className="bg-emerald-500 transition-all duration-500"
                  title={`Delivered: ${formatINR(revenueMetrics.deliveredRevenue)}`}
                />
                <div
                  style={{ width: `${(revenueMetrics.pipelineRevenue / revenueMetrics.totalGrossRevenue) * 100}%` }}
                  className="bg-cyan-500 transition-all duration-500"
                  title={`Pipeline: ${formatINR(revenueMetrics.pipelineRevenue)}`}
                />
                <div
                  style={{ width: `${(revenueMetrics.pendingRevenue / revenueMetrics.totalGrossRevenue) * 100}%` }}
                  className="bg-amber-500 transition-all duration-500"
                  title={`Pending: ${formatINR(revenueMetrics.pendingRevenue)}`}
                />
              </div>
            </div>
          )}
        </section>

        {/* ── STATUS STATS ROW ──────────────────────────────────────────────── */}
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50">
              Orders By Fulfillment Stage
            </h3>
            {filterStatus !== "all" && (
              <button
                onClick={() => setFilterStatus("all")}
                className="text-xs text-[oklch(0.7_0.16_155)] hover:underline"
              >
                Clear Status Filter
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map(({ label, count, rev, status }) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(filterStatus === status ? "all" : status)}
                className={`rounded-2xl border p-4 text-left transition hover:scale-[1.02] active:scale-100 ${
                  filterStatus === status
                    ? "border-[oklch(0.58_0.16_155)]/60 bg-[oklch(0.58_0.16_155)]/20 shadow-md shadow-[oklch(0.58_0.16_155)]/10"
                    : "border-white/8 bg-white/4 hover:bg-white/6"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-mono text-2xl font-bold text-white">{count}</p>
                  <StatusIcon status={status} />
                </div>
                <p className="mt-1 text-xs text-white/60 font-medium">{label}</p>
                <p className="mt-0.5 font-mono text-[11px] text-white/40">{formatINR(rev)}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ── FILTERS & SEARCH CONTROLS ─────────────────────────────────────── */}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name, phone, order ID, or tracking code…"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-[oklch(0.58_0.16_155)]/50 focus:ring-1 focus:ring-[oklch(0.58_0.16_155)]/30 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as OrderStatus | "all")}
                className="appearance-none rounded-xl border border-white/10 bg-white/5 py-2.5 pl-3.5 pr-8 text-xs text-white outline-none focus:border-[oklch(0.58_0.16_155)]/50 transition cursor-pointer"
              >
                <option value="all" className="bg-[oklch(0.14_0.025_155)]">All Statuses</option>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s} className="bg-[oklch(0.14_0.025_155)]">
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/40" />
            </div>

            {/* Delivery Mode Filter */}
            <div className="relative">
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as "all" | "buzz" | "normal")}
                className="appearance-none rounded-xl border border-white/10 bg-white/5 py-2.5 pl-3.5 pr-8 text-xs text-white outline-none focus:border-[oklch(0.58_0.16_155)]/50 transition cursor-pointer"
              >
                <option value="all" className="bg-[oklch(0.14_0.025_155)]">All Delivery Modes</option>
                <option value="buzz" className="bg-[oklch(0.14_0.025_155)]">⚡ Buzz Express (Chennai)</option>
                <option value="normal" className="bg-[oklch(0.14_0.025_155)]">🚚 Normal Delivery</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/40" />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none rounded-xl border border-white/10 bg-white/5 py-2.5 pl-3.5 pr-8 text-xs text-white outline-none focus:border-[oklch(0.58_0.16_155)]/50 transition cursor-pointer"
              >
                <option value="date-desc" className="bg-[oklch(0.14_0.025_155)]">Newest First</option>
                <option value="date-asc" className="bg-[oklch(0.14_0.025_155)]">Oldest First</option>
                <option value="rev-desc" className="bg-[oklch(0.14_0.025_155)]">Highest Revenue (₹)</option>
                <option value="rev-asc" className="bg-[oklch(0.14_0.025_155)]">Lowest Revenue (₹)</option>
              </select>
              <ArrowUpDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/40" />
            </div>
          </div>
        </div>

        {/* ── ORDERS TABLE & LIST ───────────────────────────────────────────── */}
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/30">
            <RefreshCw className="mb-3 size-8 animate-spin" />
            <p className="text-sm">Loading synced orders and revenue…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/30 rounded-2xl border border-white/8 bg-white/3">
            <Package className="mb-3 size-10 opacity-40" />
            <p className="text-sm font-medium">
              {orders.length === 0 ? "No orders recorded yet." : "No orders match your filter criteria."}
            </p>
            {orders.length === 0 && (
              <button
                onClick={createSampleOrder}
                className="mt-4 flex items-center gap-1.5 rounded-xl bg-[oklch(0.58_0.16_155)] px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-[oklch(0.62_0.17_155)] transition"
              >
                <PlusCircle className="size-4" />
                Create First Test Order
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/2 shadow-xl">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/8 bg-white/4 text-xs uppercase tracking-wide text-white/40">
                  <tr>
                    <th className="px-4 py-3.5 font-medium">Customer & Date</th>
                    <th className="px-4 py-3.5 font-medium">Contact</th>
                    <th className="px-4 py-3.5 font-medium">Delivery Mode</th>
                    <th className="px-4 py-3.5 font-medium">Order Status</th>
                    <th className="px-4 py-3.5 font-medium">Order Revenue</th>
                    <th className="px-4 py-3.5 font-medium">Tracking #</th>
                    <th className="px-4 py-3.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((order) => (
                    <tr key={order.id} className="hover:bg-white/4 transition group">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-white group-hover:text-[oklch(0.75_0.16_155)] transition-colors">
                          {order.customer_name}
                        </p>
                        <p className="font-mono text-xs text-white/35 mt-0.5">{formatDate(order.created_at)}</p>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-white/70">
                        +91 {order.phone}
                      </td>
                      <td className="px-4 py-3.5">
                        {order.delivery_mode === "buzz" ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-semibold">
                            <Zap className="size-3" />
                            Buzz Express
                          </span>
                        ) : (
                          <span className="text-white/50 text-xs">Standard (1–2d)</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusColor(order.status)}`}>
                          <StatusIcon status={order.status} />
                          {STATUS_LABELS[order.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-sm font-bold text-emerald-400">
                        {formatINR(order.subtotal)}
                        <span className="block text-[10px] font-sans font-normal text-white/40">
                          {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">
                        {order.tracking_number ? (
                          <span className="rounded bg-white/6 px-2 py-0.5 text-white/80 border border-white/10">
                            {order.tracking_number}
                          </span>
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`https://wa.me/91${order.phone}?text=${encodeURIComponent(
                              `Hi ${order.customer_name}, regarding your Go RoBo order: Status is ${STATUS_LABELS[order.status]}. Tracking: ${order.tracking_number ?? "pending"}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg p-1.5 text-white/40 hover:bg-emerald-500/20 hover:text-emerald-400 transition"
                            title="WhatsApp Customer"
                          >
                            <MessageCircle className="size-4" />
                          </a>
                          <button
                            onClick={() => setViewOrder(order)}
                            className="rounded-lg p-1.5 text-white/40 hover:bg-white/8 hover:text-white transition"
                            title="View order details"
                          >
                            <Eye className="size-4" />
                          </button>
                          <button
                            onClick={() => setEditOrder(order)}
                            className="rounded-lg p-1.5 text-white/40 hover:bg-[oklch(0.58_0.16_155)]/20 hover:text-[oklch(0.7_0.16_155)] transition"
                            title="Edit status & tracking"
                          >
                            <Edit3 className="size-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(order.id)}
                            className="rounded-lg p-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-400 transition"
                            title="Delete order"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="divide-y divide-white/8 lg:hidden">
              {filtered.map((order) => (
                <div key={order.id} className="p-4 hover:bg-white/2 transition">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-white">{order.customer_name}</p>
                      <p className="text-xs text-white/40 mt-0.5">
                        +91 {order.phone} · {formatDate(order.created_at)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusColor(order.status)}`}>
                      <StatusIcon status={order.status} />
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>

                  <div className="mb-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-sm font-bold text-emerald-400">
                        {formatINR(order.subtotal)}
                      </span>
                      <span className="text-white/40 ml-2">({order.items.length} items)</span>
                    </div>
                    {order.delivery_mode === "buzz" ? (
                      <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                        <Zap className="size-3" /> Buzz Express
                      </span>
                    ) : (
                      <span className="text-white/40">Standard</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="font-mono text-xs text-white/60">
                      {order.tracking_number ? `#${order.tracking_number}` : "No tracking yet"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://wa.me/91${order.phone}?text=${encodeURIComponent(
                          `Hi ${order.customer_name}, regarding your Go RoBo order: Status is ${STATUS_LABELS[order.status]}. Tracking: ${order.tracking_number ?? "pending"}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-1.5 text-white/40 hover:bg-emerald-500/20 hover:text-emerald-400 transition"
                      >
                        <MessageCircle className="size-4" />
                      </a>
                      <button
                        onClick={() => setViewOrder(order)}
                        className="rounded-lg p-1.5 text-white/40 hover:bg-white/8 hover:text-white transition"
                      >
                        <Eye className="size-4" />
                      </button>
                      <button
                        onClick={() => setEditOrder(order)}
                        className="rounded-lg p-1.5 text-white/40 hover:bg-[oklch(0.58_0.16_155)]/20 hover:text-[oklch(0.7_0.16_155)] transition"
                      >
                        <Edit3 className="size-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(order.id)}
                        className="rounded-lg p-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-400 transition"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col items-center justify-between gap-2 text-xs text-white/30 sm:flex-row">
          <p>
            Showing {filtered.length} of {orders.length} orders · Go RoBo Robotics & Components Chennai
          </p>
          <p>Resilient Sync Active · Zero Data Loss Guarantee</p>
        </div>
      </main>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {viewOrder && !editOrder && (
        <DetailModal
          order={viewOrder}
          onClose={() => setViewOrder(null)}
          onEdit={() => {
            setEditOrder(viewOrder)
            setViewOrder(null)
          }}
        />
      )}
      {editOrder && (
        <EditModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={(u) => setOrders((prev) => prev.map((o) => (o.id === u.id ? u : o)))}
        />
      )}
      {showSqlModal && <SqlSetupModal onClose={() => setShowSqlModal(false)} />}
    </div>
  )
}
