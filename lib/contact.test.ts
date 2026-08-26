import { describe, expect, it } from "vitest"
import {
  buildCartInquiryUrl,
  buildGeneralInquiryUrl,
  buildInquiryUrl,
  WHATSAPP_NUMBER,
  type CartLine,
} from "@/lib/contact"
import type { Product } from "@/lib/products"

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "robu-1",
  name: "ESP32 Dev Board",
  category: "ESP Boards & Shields",
  description: "",
  price: 449,
  image: "",
  inStock: true,
  ...overrides,
})

function decodeWaText(url: string): string {
  expect(url).toContain(`https://wa.me/${WHATSAPP_NUMBER}?text=`)
  const text = new URL(url).searchParams.get("text")
  expect(text).toBeTruthy()
  return text!
}

describe("buildInquiryUrl", () => {
  it("includes product name, category and price", () => {
    const text = decodeWaText(buildInquiryUrl(product()))
    expect(text).toContain("ESP32 Dev Board")
    expect(text).toContain("Category: ESP Boards & Shields")
    expect(text).toContain("\u20B9449.00")
  })

  it("appends optional qty, name and note", () => {
    const text = decodeWaText(
      buildInquiryUrl(product(), { qty: 3, name: "Priya", note: "Need by Friday" }),
    )
    expect(text).toContain("Quantity: 3")
    expect(text).toContain("From: Priya")
    expect(text).toContain("Note: Need by Friday")
  })
})

describe("buildGeneralInquiryUrl", () => {
  it("builds a generic wa.me link without product details", () => {
    const url = buildGeneralInquiryUrl()
    const text = decodeWaText(url)
    expect(text).toContain("I'd like to inquire about your products.")
    expect(text).not.toContain("Category:")
  })
})

describe("buildCartInquiryUrl", () => {
  const lines: CartLine[] = [
    { product: product({ id: "a", price: 100 }), qty: 2 },
    { product: product({ id: "b", price: 250 }), qty: 1 },
  ]

  it("lists each line with per-line and extended prices", () => {
    const text = decodeWaText(buildCartInquiryUrl(lines))
    expect(text).toContain("\u20B9100.00 each (\u20B9200.00)")
    expect(text).toContain("\u20B9250.00 each (\u20B9250.00)")
  })

  it("computes the cart total", () => {
    const text = decodeWaText(buildCartInquiryUrl(lines))
    expect(text).toContain("Total: \u20B9450.00")
  })

  it("accepts delivery mode as a plain string", () => {
    const buzz = decodeWaText(buildCartInquiryUrl(lines, "buzz"))
    expect(buzz).toContain("Buzz Delivery")
    expect(buzz).not.toContain("Normal Delivery")

    const normal = decodeWaText(buildCartInquiryUrl(lines, "normal"))
    expect(normal).toContain("Normal Delivery (Standard 1-2 days)")
  })

  it("accepts an options object with customer details", () => {
    const text = decodeWaText(
      buildCartInquiryUrl(lines, {
        deliveryMode: "buzz",
        name: "Sugeeth",
        phone: "9123456780",
        mapsUrl: "https://maps.app.goo.gl/xyz",
      }),
    )
    expect(text).toContain("Customer: Sugeeth")
    expect(text).toContain("Phone: 9123456780")
    expect(text).toContain("Location Link: https://maps.app.goo.gl/xyz")
  })

  it("omits customer fields when not provided", () => {
    const text = decodeWaText(buildCartInquiryUrl(lines))
    expect(text).not.toContain("Customer:")
    expect(text).not.toContain("Location Link:")
  })
})
