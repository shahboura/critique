import { describe, expect, it } from "bun:test"
import { boolVar, readWidgetOptions } from "./widget-options.js"

describe("boolVar", () => {
  it.each([
    ["1", true],
    ["true", true],
    ["TRUE", true],
    [" on ", true],
    ["yes", true],
    ["0", false],
    ["false", false],
    ["off", false],
    ["no", false],
  ])("parses %p", (value, expected) => {
    expect(boolVar(value, !expected)).toBe(expected)
  })

  it("falls back when unset, empty or unrecognised", () => {
    expect(boolVar(undefined, true)).toBe(true)
    expect(boolVar("", true)).toBe(true)
    expect(boolVar("   ", false)).toBe(false)
    expect(boolVar("flase", true)).toBe(true)
  })
})

describe("readWidgetOptions", () => {
  it("disables webhooks when nothing is configured", () => {
    expect(readWidgetOptions({})).toEqual({ webhooks: false })
  })

  it("enables webhooks only for an explicit truthy value", () => {
    expect(readWidgetOptions({ CRITIQUE_WIDGET_WEBHOOKS: "on" })).toEqual({ webhooks: true })
    expect(readWidgetOptions({ CRITIQUE_WIDGET_WEBHOOKS: "off" })).toEqual({ webhooks: false })
  })

  it("keeps an unrecognised value fail-closed", () => {
    expect(readWidgetOptions({ CRITIQUE_WIDGET_WEBHOOKS: "flase" })).toEqual({ webhooks: false })
  })
})
