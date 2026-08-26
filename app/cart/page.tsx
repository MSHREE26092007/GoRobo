"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  GitFork,
  MapPin,
  MessageCircle,
  Minus,
  PackageCheck,
  PackagePlus,
  Plus,
  Radio,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Trash2,
  Truck,
  User,
  Zap,
} from "lucide-react"
import {
  Alert,
  BackButton,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  IconBadge,
  Image,
  Input,
  Label,
  Modal,
  PageHeader,
  Text,
  View,
} from "@amazecontinuityprojects/amazeui"
import { formatINR } from "@/lib/products"
import { buildCartInquiryUrl } from "@/lib/contact"
import { placeOrder } from "@/lib/gorobo-api"
import { useCart } from "@/components/cart-context"
import { CartManagerBar } from "@/components/cart-manager-bar"
import { CartProductSearch } from "@/components/cart-product-search"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { GoRoboLogo } from "@/components/gorobo-logo"
import { ResponsiveButton } from "@/components/responsive-button"
import { CONTACT_EMAIL, CONTACT_PHONE, WHATSAPP_CHANNEL_URL } from "@/lib/contact"
import { GITHUB_REPO_URL, SHOW_BUZZ_EXTRA_CHARGES } from "@/lib/site"

const CUSTOMER_STORAGE_KEY = "gorobo-customer-details"

export default function CartPage() {
  const router = useRouter()
  const { lines, count, total, setQty, removeItem, clear } = useCart()

  // Persisted customer details
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [mapsUrl, setMapsUrl] = useState("")
  const [deliveryMode, setDeliveryMode] = useState<"normal" | "buzz">("normal")

  // Validation & confirmation flow states
  const [validationError, setValidationError] = useState("")
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [targetWhatsappUrl, setTargetWhatsappUrl] = useState<string>("")

  // Load customer details from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CUSTOMER_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.name) setName(parsed.name)
        if (parsed.phone) setPhone(parsed.phone)
        if (parsed.mapsUrl) setMapsUrl(parsed.mapsUrl)
      }
    } catch {
      // Ignore storage errors
    }
  }, [])

  // Auto-persist customer details
  useEffect(() => {
    try {
      localStorage.setItem(
        CUSTOMER_STORAGE_KEY,
        JSON.stringify({ name, phone, mapsUrl })
      )
    } catch {
      // Ignore storage errors
    }
  }, [name, phone, mapsUrl])

  // Handle 3-second redirect countdown after confirmation
  useEffect(() => {
    if (countdown === null) return

    if (countdown === 0) {
      if (targetWhatsappUrl) {
        window.open(targetWhatsappUrl, "_blank", "noopener,noreferrer")
      }
      clear()
      return
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null))
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown, targetWhatsappUrl, clear])

  const handleStartCheckout = () => {
    setValidationError("")
    if (!name.trim()) {
      setValidationError("Please enter your name.")
      return
    }
    const digits = phone.replace(/[\s\-()]/g, "").replace(/^\+?91(?=\d{10}$)/, "")
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setValidationError("Please enter a valid 10-digit Indian mobile number.")
      return
    }

    setConfirmModalOpen(true)
  }

  const handleFinalConfirmation = async () => {
    const digits = phone.replace(/[\s\-()]/g, "").replace(/^\+?91(?=\d{10}$)/, "")
    setIsSubmitting(true)

    const whatsappUrl = buildCartInquiryUrl(lines, {
      deliveryMode,
      name: name.trim(),
      phone: digits,
      mapsUrl: mapsUrl.trim() || undefined,
    })
    setTargetWhatsappUrl(whatsappUrl)

    try {
      await placeOrder({
        name: name.trim(),
        phone: digits,
        items: lines.map((l) => ({ itemId: l.product.id, quantity: l.qty })),
        deliveryMode,
        mapsUrl: mapsUrl.trim() || undefined,
      })
    } catch (err) {
      console.warn("Order recording failed, proceeding to WhatsApp inquiry:", err)
    }

    setIsSubmitting(false)
    setCountdown(3)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-2 pb-4 sm:px-6">
          <PageHeader
            icon={<GoRoboLogo className="h-7 w-auto" />}
            title=""
            meta={
              <div className="flex items-center gap-2">
                <Badge variant="info" size="sm">
                  {count} {count === 1 ? "item" : "items"} in cart
                </Badge>
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  Checkout &amp; Inquiries
                </span>
              </div>
            }
            actions={
              <div className="flex items-center gap-2">
                <BackButton onClick={() => router.push("/")} />
                <ThemeSwitcher />
                <ResponsiveButton
                  icon={<Radio className="size-4 shrink-0" aria-hidden="true" />}
                  label="Channel"
                  aria-label="Join the Go RoBo channel"
                  onClick={() => window.open(WHATSAPP_CHANNEL_URL, "_blank", "noopener,noreferrer")}
                />
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Open Source on GitFork"
                  title="Open Source on GitFork"
                  onClick={() => window.open(GITHUB_REPO_URL, "_blank", "noopener,noreferrer")}
                >
                  <GitFork className="size-4" aria-hidden="true" />
                </Button>
              </div>
            }
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Breadcrumb & Navigation */}
        <div className="mb-6 flex items-center justify-between">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-foreground">
              Catalog
            </Link>
            <span>/</span>
            <span className="font-semibold text-foreground">Shopping Cart</span>
          </nav>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Continue Shopping
          </Button>
        </div>

        {/* Multi-cart manager */}
        <div className="mb-6">
          <CartManagerBar />
        </div>

        {lines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center shadow-xs">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-secondary/80 text-muted-foreground shadow-inner">
              <ShoppingBag className="size-8" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Your cart is empty</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Search below to add products straight from this page, or explore the full catalogue of robotics parts.
            </p>
            <div className="mx-auto mt-6 max-w-xl text-left">
              <CartProductSearch />
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={() => router.push("/")} className="gap-2">
                <ShoppingCart className="size-4" aria-hidden="true" />
                Explore Catalog
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-12">
            {/* Left Column: Items List, Delivery Options & Customer Info */}
            <div className="flex flex-col gap-6 lg:col-span-7">
              {/* 1. Items Card */}
              <Card className="overflow-hidden">
                <CardHeader
                  action={
                    <button
                      type="button"
                      onClick={clear}
                      className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive cursor-pointer"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Clear all
                    </button>
                  }
                >
                  <div className="flex items-center gap-2">
                    <IconBadge color="purple" size="sm">
                      <ShoppingBag className="size-4" aria-hidden="true" />
                    </IconBadge>
                    <div>
                      <CardTitle>Cart Items</CardTitle>
                      <CardDescription>
                        {lines.length} {lines.length === 1 ? "product" : "products"} ({count} total units)
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="divide-y divide-border pt-0">
                  {lines.map(({ product, qty }) => (
                    <div
                      key={product.id}
                      className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between first:pt-0"
                    >
                      {/* Left: Thumbnail & Name info (Properly constrained with min-w-0 and flex-1) */}
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="size-14 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary/40 p-1.5 sm:size-16 sm:p-2">
                          <Image
                            src={product.image || "/placeholder.svg"}
                            alt={product.name}
                            className="size-full object-contain"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="mb-0.5 inline-block rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                            {product.category}
                          </span>
                          <h3 className="truncate text-sm font-semibold text-foreground" title={product.name}>
                            {product.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {formatINR(product.price)} each
                          </p>
                        </div>
                      </div>

                      {/* Right: Quantity Controls & Subtotal (shrink-0 to prevent compression or overflow) */}
                      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end sm:gap-4">
                        <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-1 shadow-xs">
                          <button
                            type="button"
                            aria-label={`Decrease quantity of ${product.name}`}
                            onClick={() => setQty(product.id, qty - 1)}
                            className="flex size-7 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted active:scale-90 cursor-pointer"
                          >
                            {qty === 1 ? (
                              <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
                            ) : (
                              <Minus className="size-3.5" aria-hidden="true" />
                            )}
                          </button>
                          <span className="w-8 text-center font-mono text-sm font-bold tabular-nums text-foreground">
                            {qty}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity of ${product.name}`}
                            onClick={() => setQty(product.id, qty + 1)}
                            className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 active:scale-90 cursor-pointer"
                          >
                            <Plus className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>

                        <div className="w-24 shrink-0 text-right">
                          <span className="font-mono text-sm font-bold text-foreground">
                            {formatINR(product.price * qty)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* 2. Find & Add Products Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <IconBadge color="emerald" size="sm">
                      <PackagePlus className="size-4" aria-hidden="true" />
                    </IconBadge>
                    <div>
                      <CardTitle>Add More Products</CardTitle>
                      <CardDescription>
                        Search the full catalog and add items without leaving this page
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CartProductSearch />
                </CardContent>
              </Card>

              {/* 3. Delivery Options Card (Stacked UI, Title above Subtitle, AmazeUI) */}
              <Card>
                <CardHeader
                  action={
                    deliveryMode === "buzz" ? (
                      <Badge variant="warning" size="sm" className="gap-1">
                        <Zap className="size-3 fill-amber-500 text-amber-500" />
                        Chennai Only
                      </Badge>
                    ) : (
                      <Badge variant="default" size="sm">
                        Standard
                      </Badge>
                    )
                  }
                >
                  <div className="flex items-center gap-2">
                    <IconBadge color={deliveryMode === "buzz" ? "amber" : "emerald"} size="sm">
                      {deliveryMode === "buzz" ? (
                        <Zap className="size-4 fill-current" aria-hidden="true" />
                      ) : (
                        <Truck className="size-4" aria-hidden="true" />
                      )}
                    </IconBadge>
                    <div>
                      <CardTitle>Delivery Options</CardTitle>
                      <CardDescription>
                        Select your preferred fulfillment speed and timeline
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-3">
                  {/* Normal Delivery Option */}
                  <div
                    onClick={() => setDeliveryMode("normal")}
                    className={`group relative flex flex-col gap-1.5 rounded-xl border p-4 transition-all cursor-pointer ${
                      deliveryMode === "normal"
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs dark:bg-primary/10"
                        : "border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex size-4 items-center justify-center rounded-full border transition-colors ${
                            deliveryMode === "normal"
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground"
                          }`}
                        >
                          {deliveryMode === "normal" && (
                            <div className="size-1.5 rounded-full bg-primary-foreground" />
                          )}
                        </div>
                        <Text className="text-sm font-bold text-foreground">
                          Normal Delivery
                        </Text>
                      </div>
                      <Badge variant="default" size="sm">
                        1&ndash;2 Days
                      </Badge>
                    </div>
                    <Text className="pl-6.5 text-xs text-muted-foreground">
                      Standard fulfillment timeline across Chennai &amp; India.
                    </Text>
                  </div>

                  {/* Buzz Delivery Option */}
                  <div
                    onClick={() => setDeliveryMode("buzz")}
                    className={`group relative flex flex-col gap-1.5 rounded-xl border p-4 transition-all cursor-pointer ${
                      deliveryMode === "buzz"
                        ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/30 shadow-xs dark:bg-amber-500/10"
                        : "border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex size-4 items-center justify-center rounded-full border transition-colors ${
                            deliveryMode === "buzz"
                              ? "border-amber-500 bg-amber-500 text-white"
                              : "border-muted-foreground"
                          }`}
                        >
                          {deliveryMode === "buzz" && (
                            <div className="size-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <Text className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                          <Zap className="size-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
                          Buzz Delivery
                        </Text>
                      </div>
                      <Badge variant="warning" size="sm">
                        ⚡ Chennai Only
                      </Badge>
                    </div>
                    <Text className="pl-6.5 text-xs text-muted-foreground">
                      Express priority dispatch available exclusively within Chennai.{SHOW_BUZZ_EXTRA_CHARGES ? " Extra delivery charges apply." : ""}
                    </Text>
                  </div>

                  {deliveryMode === "buzz" && (
                    <Alert variant="warning" className="text-xs">
                      <strong>⚡ Buzz Delivery (Chennai Only):</strong> Fast priority dispatch available exclusively within Chennai.{SHOW_BUZZ_EXTRA_CHARGES ? " Extra delivery fees apply based on location and courier rates." : ""}
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* 4. Customer & Location Details Card */}
              <Card>
                <CardHeader
                  action={
                    <Badge variant="default" size="sm">
                      Auto-Saved
                    </Badge>
                  }
                >
                  <div className="flex items-center gap-2">
                    <IconBadge color="blue" size="sm">
                      <User className="size-4" aria-hidden="true" />
                    </IconBadge>
                    <div>
                      <CardTitle>Customer &amp; Location Details</CardTitle>
                      <CardDescription>
                        Details are remembered across sessions for hassle-free reordering
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="cart-name" className="text-xs font-semibold">
                        Your Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="cart-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Priya Kumar"
                        autoComplete="name"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="cart-phone" className="text-xs font-semibold">
                        Mobile Number <span className="text-destructive">*</span>
                      </Label>
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

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="cart-maps" className="flex items-center gap-1.5 text-xs font-semibold">
                        <MapPin className="size-3.5 text-emerald-500" aria-hidden="true" />
                        Google Maps Location Link <span className="text-muted-foreground text-[10px] font-normal">(Optional)</span>
                      </Label>
                    </div>
                    <Input
                      id="cart-maps"
                      type="url"
                      value={mapsUrl}
                      onChange={(e) => setMapsUrl(e.target.value)}
                      placeholder="e.g. https://maps.app.goo.gl/... or pin location"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Paste a Google Maps share link or pin location to ensure direct doorstep delivery.
                    </p>
                  </div>

                  {validationError && (
                    <Alert variant="error" className="text-xs">
                      {validationError}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Sticky Order Summary */}
            <div className="lg:col-span-5">
              <Card className="sticky top-6 shadow-md">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                  <CardDescription>
                    Review items, estimated costs &amp; discounts
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Subtotal ({count} {count === 1 ? "item" : "items"})
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatINR(total)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span className="flex items-center gap-1">
                      <Sparkles className="size-3.5" />
                      Promo Discount (2%)
                    </span>
                    <span className="text-xs font-semibold">Applied on final quote</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Delivery Speed</span>
                    <span className="font-medium text-foreground">
                      {deliveryMode === "buzz" ? "⚡ Buzz Delivery (Chennai Only)" : "Normal Delivery"}
                    </span>
                  </div>

                  <div className="my-1 h-px bg-border" role="separator" />

                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-bold text-foreground">Estimated Total</span>
                    <div className="text-right">
                      <span className="font-mono text-xl font-bold text-foreground">
                        {formatINR(total)}
                      </span>
                      <p className="text-[10px] text-muted-foreground">excl. applicable GST</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-secondary/50 p-3 text-[11px] text-muted-foreground leading-relaxed">
                    Prices exclude GST. The flat 2% promo discount and applicable taxes will be applied when the final official quote is sent on WhatsApp.
                  </div>
                </CardContent>

                <CardFooter className="flex-col gap-3 pt-0">
                  <Button
                    className="w-full gap-2 py-6 text-base font-semibold shadow-md"
                    onClick={handleStartCheckout}
                  >
                    <PackageCheck className="size-5" aria-hidden="true" />
                    Confirm Order ({count})
                  </Button>

                  <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
                    <p className="flex items-center gap-1 font-medium">
                      <MessageCircle className="size-3.5 text-emerald-500" />
                      Direct confirmation with Go RoBo specialists
                    </p>
                    <p>Inquiries serviced across Chennai &amp; India</p>
                  </div>
                </CardFooter>
              </Card>
            </div>
          </div>
        )}

        {/* Footer info */}
        <View className="mt-16 flex flex-col items-center gap-2 border-t border-border py-6 text-center">
          <Text className="text-sm font-medium text-foreground">Go RoBo &mdash; Robotics &amp; DIY Electronics</Text>
          <Text className="text-xs text-muted-foreground">
            {CONTACT_PHONE} &middot; {CONTACT_EMAIL}
          </Text>
        </View>
      </main>

      {/* 2-Step Confirmation Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => {
          if (countdown === null) setConfirmModalOpen(false)
        }}
        title={countdown === null ? "Confirm Your Order" : "Order Placed"}
        maxWidth="max-w-lg"
      >
        {countdown === null ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Order Recap
              </h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items:</span>
                  <span className="font-semibold text-foreground">
                    {count} units ({lines.length} lines)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Speed:</span>
                  <span className="font-semibold text-foreground">
                    {deliveryMode === "buzz" ? "⚡ Buzz Delivery (Chennai Only)" : "Normal Delivery"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-semibold text-foreground">{name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-mono font-semibold text-foreground">{phone}</span>
                </div>
                {mapsUrl && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location Pin:</span>
                    <span className="truncate max-w-[200px] text-xs text-primary underline">
                      {mapsUrl}
                    </span>
                  </div>
                )}
                <div className="mt-2 border-t border-border pt-2 flex justify-between font-bold">
                  <span>Subtotal:</span>
                  <span className="font-mono text-base">{formatINR(total)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-primary/10 p-3 text-xs leading-relaxed text-foreground border border-primary/20">
              <strong>Please Note:</strong> Confirming the order will finalise your request with Go RoBo and automatically redirect you to WhatsApp to connect directly with our support engineer. The flat 2% promo discount and applicable taxes will be applied when the final official quote is sent.
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setConfirmModalOpen(false)}
                disabled={isSubmitting}
              >
                Go Back &amp; Edit
              </Button>
              <Button
                variant="primary"
                className="gap-2"
                onClick={handleFinalConfirmation}
                disabled={isSubmitting}
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                {isSubmitting ? "Placing Order..." : "Confirm & Proceed to WhatsApp"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="relative mb-4 flex size-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="size-10 animate-in zoom-in-50 duration-300" aria-hidden="true" />
            </div>

            <h3 className="text-lg font-bold text-foreground">Order Request Registered!</h3>
            <p className="mt-2 max-w-sm text-xs text-muted-foreground">
              Your inquiry has been stored. We are connecting you with the Go RoBo WhatsApp team in:
            </p>

            <div className="my-5 flex flex-col items-center gap-2">
              <span className="font-mono text-4xl font-extrabold text-primary animate-pulse">
                {countdown}s
              </span>
              <div className="w-48 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-1000 ease-linear"
                  style={{ width: `${((3 - countdown) / 3) * 100}%` }}
                />
              </div>
            </div>

            <Button
              className="mt-2 w-full gap-2"
              onClick={() => {
                if (targetWhatsappUrl) {
                  window.open(targetWhatsappUrl, "_blank", "noopener,noreferrer")
                }
                clear()
                setConfirmModalOpen(false)
                router.push("/")
              }}
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              Enquire on WhatsApp Now
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
