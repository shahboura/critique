import { describe, expect, test } from "bun:test"
import type { SessionConfigOption } from "@agentclientprotocol/sdk"
import { resolveModelSelection } from "./acp-client.js"

describe("resolveModelSelection", () => {
  test("reads a flat model config option", () => {
    const result = resolveModelSelection({
      configOptions: [{
        id: "model",
        name: "Model",
        category: "model",
        type: "select",
        currentValue: "anthropic/x",
        options: [{ value: "anthropic/x", name: "X" }],
      }] satisfies SessionConfigOption[],
    })

    expect(result.configId).toBe("model")
    expect(result.availableModels.map(m => m.value)).toEqual(["anthropic/x"])
  })

  test("flattens grouped model options", () => {
    const result = resolveModelSelection({
      configOptions: [{
        id: "model",
        name: "Model",
        category: "model",
        type: "select",
        currentValue: "b/y",
        options: [{
          group: "g",
          name: "G",
          options: [
            { value: "a/x", name: "A" },
            { value: "b/y", name: "B" },
          ],
        }],
      }] satisfies SessionConfigOption[],
    })

    expect(result.configId).toBe("model")
    expect(result.availableModels.map(m => m.value)).toEqual(["a/x", "b/y"])
  })

  test("falls back to the legacy model list", () => {
    const result = resolveModelSelection({
      models: { availableModels: [{ modelId: "claude-sonnet" }] },
    })

    expect(result.configId).toBeUndefined()
    expect(result.availableModels.map(m => m.value)).toEqual(["claude-sonnet"])
  })

  test("uses legacy models when the model config option has no values", () => {
    const result = resolveModelSelection({
      configOptions: [{
        id: "model",
        name: "Model",
        category: "model",
        type: "boolean",
        currentValue: false,
      }] satisfies SessionConfigOption[],
      models: { availableModels: [{ modelId: "claude-sonnet" }] },
    })

    expect(result.configId).toBeUndefined()
    expect(result.availableModels.map(m => m.value)).toEqual(["claude-sonnet"])
  })

  test("returns nothing when no models are advertised", () => {
    expect(resolveModelSelection({})).toEqual({
      availableModels: [],
      configId: undefined,
    })
  })
})
