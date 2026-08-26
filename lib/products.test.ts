import { describe, expect, it } from "vitest"
import { applyMargin, formatINR } from "@/lib/products"

describe("applyMargin", () => {
  const cases: Array<[number, number]> = [
    // [basePrice, expected margin]
    [0, 1],
    [9, 1],
    [10, 3],
    [29, 3],
    [30, 7],
    [69, 7],
    [70, 15],
    [149, 15],
    [150, 20],
    [229, 20],
    [230, 35],
    [399, 35],
    [400, 50],
    [998, 50],
    [999, 70],
    [2999, 70],
    [3000, 150],
    [250000, 150],
  ]

  it.each(cases)("base %i adds margin tier correctly", (base, margin) => {
    expect(applyMargin(base)).toBe(base + margin)
  })
})

describe("formatINR", () => {
  it("formats whole rupees with two decimals", () => {
    expect(formatINR(280)).toBe("\u20B9280.00")
  })

  it("uses Indian digit grouping (lakh/crore)", () => {
    expect(formatINR(230000)).toBe("\u20B92,30,000.00")
    expect(formatINR(12345678)).toBe("\u20B91,23,45,678.00")
  })

  it("keeps paise", () => {
    expect(formatINR(99.5)).toBe("\u20B999.50")
  })
})
