"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, MessageCircle, Minus, Plus, ShoppingBag, Trash2, Truck, Zap } from "lucide-react"
import {
  Badge,
  Button,
  Image,
  Input,
  Label,
  Modal,
  Text,
  View,
} from "@amazecontinuityprojects/amazeui"
import { formatINR } from "@/lib/products"
import { buildCartInquiryUrl } from "@/lib/contact"
import { placeOrder } from "@/lib/gorobo-api"
import { insertOrder } from "@/lib/orders-db"
import { SHOW_BUZZ_EXTRA_CHARGES } from "@/lib/site"
import { useCart } from "@/components/cart-context"

type CartPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CartPanel({ open, onOpenChange }: CartPanelProps) {
  const router = useRouter()
  const { lines, count, total, setQty, removeItem, clear } = useCart()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [deliveryMode, setDeliveryMode] = useState<"normal" | "buzz">("normal")
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle")
  const [error, setError] = useState("")

  const enquire = async () => {
    setError("")
    if (!name.trim()) {
      setError("Please enter your name.")
      return
    }
    const digits = phone.replace(/[\s\-()]/g, "").replace(/^\+?91(?=\d{10}$)/, "")
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError("Enter a valid 10-digit mobile number.")
      return
    }

    setStatus("submitting")

    // Always save to Supabase (for admin tracking) regardless of backend API status
    const orderSubtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0)
    insertOrder({
      customer_name: name.trim(),
      phone: digits,
      delivery_mode: deliveryMode,
      items: lines.map((l) => ({
        itemId: l.product.id,
        name: l.product.name,
        quantity: l.qty,
        price: l.product.price,
      })),
      subtotal: orderSubtotal,
    }).catch((err) => console.warn("[CartPanel] Supabase order save failed (non-fatal):", err))

    try {
      await placeOrder({
        name: name.trim(),
        phone: digits,
        items: lines.map((l) => ({ itemId: l.product.id, quantity: l.qty })),
        deliveryMode,
      })
    } catch {
      // Backend API unavailable — we already saved to Supabase, continue to WhatsApp
    }

    window.open(buildCartInquiryUrl(lines, deliveryMode), "_blank", "noopener,noreferrer")
    clear()
    setStatus("done")
  }

  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={`Your Cart${count > 0 ? ` (${count})` : ""}`}
      maxWidth="max-w-xl"
      noPadding
      className="overflow-hidden"
    >
      <div className="flex max-h-[90vh] flex-col">
        {lines.length === 0 ? (
          status === "done" ? (
            <View className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <View className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="size-7 text-emerald-500" aria-hidden="true" />
              </View>
              <Text className="text-sm font-semibold text-foreground">
                Inquiry placed — sent on WhatsApp
              </Text>
              <Text className="text-xs text-muted-foreground">
                Go RoBo has your details. Expect a reply on WhatsApp shortly.
              </Text>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false)
                    router.push("/track")
                  }}
                >
                  <Truck className="size-4 mr-1.5" />
                  Track Order
                </Button>
                <Button size="sm" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </div>
            </View>
          ) : (
            <View className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <View className="flex size-14 items-center justify-center rounded-full bg-secondary">
                <ShoppingBag className="size-6 text-muted-foreground" aria-hidden="true" />
              </View>
              <Text className="text-sm font-semibold text-foreground">Your cart is empty</Text>
              <Text className="text-xs text-muted-foreground">
                Add products from the catalog, then enquire in one message.
              </Text>
              <Button size="sm" className="mt-2" onClick={() => onOpenChange(false)}>
                Browse components
              </Button>
            </View>
          )
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex flex-col divide-y divide-border">
                {lines.map(({ product, qty }) => (
                  <div key={product.id} className="flex items-center gap-3 py-3">
                    <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary/40 p-1.5">
                      <Image
                        src={product.image || "/placeholder.svg"}
                        alt={product.name}
                        className="size-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Text className="truncate text-sm font-medium text-foreground">
                        {product.name}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {formatINR(product.price)} each · {formatINR(product.price * qty)}
                      </Text>
                    </div>
                    <View className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Decrease quantity of ${product.name}`}
                        onClick={() => setQty(product.id, qty - 1)}
                      >
                        <Minus className="size-3.5" aria-hidden="true" />
                      </Button>
                      <span className="w-7 text-center text-sm font-semibold tabular-nums text-foreground">
                        {qty}
                      </span>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Increase quantity of ${product.name}`}
                        onClick={() => setQty(product.id, qty + 1)}
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </Button>
                    </View>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${product.name} from cart`}
                      onClick={() => removeItem(product.id)}
                    >
                      <Trash2 className="size-4 text-muted-foreground" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <View className="flex flex-col gap-3 border-t border-border px-6 py-4">
              <View className="flex items-center justify-between">
                <Text className="text-sm text-muted-foreground">Subtotal</Text>
                <Text className="font-mono text-base font-semibold text-foreground">
                  {formatINR(total)}
                </Text>
              </View>
              <Badge variant="success" size="sm" className="self-start">
                Flat 2% promo applied on final quote
              </Badge>
              <Text className="text-xs text-muted-foreground">
                Prices exclude GST &mdash; the flat 2% promo discount and applicable taxes will be applied when the final official quote is sent.
              </Text>

              {/* Delivery Mode Selection */}
              <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-secondary/30 p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">Delivery Option</Label>
                  {deliveryMode === "buzz" && (
                    <Badge variant="warning" size="sm" className="gap-1">
                      <Zap className="size-3 fill-amber-500 text-amber-500" />
                      Chennai Only
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("normal")}
                    className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all cursor-pointer ${
                      deliveryMode === "normal"
                        ? "border-primary bg-primary/10 text-primary shadow-xs dark:bg-primary/15"
                        : "border-border bg-card text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold">
                        <Truck className="size-3.5" aria-hidden="true" />
                        Normal Delivery
                      </span>
                      <Badge variant="default" size="sm">
                        1&ndash;2 Days
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground">Standard fulfillment timeline</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryMode("buzz")}
                    className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all cursor-pointer ${
                      deliveryMode === "buzz"
                        ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-xs dark:bg-amber-500/15"
                        : "border-border bg-card text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold">
                        <Zap className="size-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
                        Buzz Delivery
                      </span>
                      <Badge variant="warning" size="sm">
                        ⚡ Chennai Only
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground">Express priority dispatch within Chennai</span>
                  </button>
                </div>

                {deliveryMode === "buzz" && (
                  <div className="flex items-start gap-1.5 rounded-md bg-amber-500/10 p-2 text-[11px] leading-tight text-amber-700 dark:text-amber-300">
                    <Zap className="mt-0.5 size-3 shrink-0 fill-amber-500 text-amber-500" aria-hidden="true" />
                    <span>
                      <strong>⚡ Buzz Delivery (Chennai Only):</strong> Fast priority dispatch available exclusively within Chennai.{SHOW_BUZZ_EXTRA_CHARGES ? " Extra delivery fees apply." : ""}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-1 grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cart-name">Your name</Label>
                  <Input
                    id="cart-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Priya Kumar"
                    autoComplete="name"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cart-phone">Phone number</Label>
                  <Input
                    id="cart-phone"
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9XXXX XXXXX"
                    autoComplete="tel"
                  />
                </div>
              </div>

              {error && <Text className="text-xs text-red-600">{error}</Text>}

              <Button className="w-full gap-1.5" disabled={status === "submitting"} onClick={enquire}>
                <MessageCircle className="size-4" aria-hidden="true" />
                {status === "submitting" ? "Placing inquiry..." : "Enquire on WhatsApp"}
              </Button>
              <button
                type="button"
                onClick={clear}
                className="cursor-pointer text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Clear cart
              </button>
            </View>
          </>
        )}
      </div>
    </Modal>
  )
}