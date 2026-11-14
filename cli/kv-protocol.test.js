import { describe, expect, test } from "bun:test"
import { createKvHandler } from "./kv-protocol.js"

const NOW = 1_700_000_000_000

function memoryStore() {
  const entries = new Map()
  return {
    get: (key) => entries.get(key) ?? null,
    put: (key, entry) => entries.set(key, entry),
    delete: (key) => entries.delete(key),
    keys: () => [...entries.keys()],
  }
}

function request(path, init) {
  return new Request(`https://kv.test${path}`, init)
}

function setup(now = () => NOW) {
  const store = memoryStore()
  return { store, handle: createKvHandler(store, now) }
}

describe("KV protocol", () => {
  test("round-trips bytes, metadata and a relative TTL", async () => {
    const { store, handle } = setup()
    const value = new Uint8Array([0, 1, 2, 255])
    const put = await handle(request("/diff-id?expiration_ttl=60", {
      method: "PUT",
      headers: { "CF-KV-Metadata": "{\"contentType\":\"text/html\",\"contentEncoding\":\"gzip\"}" },
      body: value,
    }))
    expect(put.status).toBe(200)

    const get = await handle(request("/diff-id"))
    expect(get.status).toBe(200)
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(value)
    expect(get.headers.get("CF-KV-Metadata")).toBe("{\"contentType\":\"text/html\",\"contentEncoding\":\"gzip\"}")
    expect(get.headers.get("CF-Expiration")).toBe(String(NOW / 1000 + 60))
    expect(store.get("diff-id")?.expiration).toBe(NOW + 60_000)
  })

  test("round-trips an absolute expiration", async () => {
    const { store, handle } = setup()
    const expires = NOW / 1000 + 120
    await handle(request(`/absolute?expiration=${expires}`, { method: "PUT", body: "value" }))
    const get = await handle(request("/absolute"))
    expect(get.status).toBe(200)
    expect(get.headers.get("CF-Expiration")).toBe(String(expires))
    expect(store.get("absolute")?.expiration).toBe(expires * 1000)
  })

  test("accepts a value without metadata", async () => {
    const { handle } = setup()
    await handle(request("/plain", { method: "PUT", body: "value" }))
    const get = await handle(request("/plain"))
    expect(get.status).toBe(200)
    expect(get.headers.get("CF-KV-Metadata")).toBeNull()
    expect(await get.text()).toBe("value")
  })

  test("expires lazily and forgets the entry", async () => {
    let now = NOW
    const { store, handle } = setup(() => now)
    await handle(request("/short?expiration_ttl=60", { method: "PUT", body: "value" }))
    now = NOW + 60_000
    const get = await handle(request("/short"))
    expect(get.status).toBe(404)
    expect(store.get("short")).toBeNull()
  })

  test("deletes", async () => {
    const { handle } = setup()
    await handle(request("/gone", { method: "PUT", body: "value" }))
    expect((await handle(request("/gone", { method: "DELETE" }))).status).toBe(200)
    expect((await handle(request("/gone"))).status).toBe(404)
  })

  test("decodes keys", async () => {
    const { handle } = setup()
    await handle(request("/license%3Aabc", { method: "PUT", body: "value" }))
    expect((await handle(request("/license%3Aabc"))).status).toBe(200)
    expect((await handle(request("/license:abc"))).status).toBe(200)
  })

  test("rejects empty keys and unsupported list/bulk operations", async () => {
    const { handle } = setup()
    expect((await handle(request("/", { method: "PUT", body: "value" }))).status).toBe(400)
    expect((await handle(request("/", { method: "GET" }))).status).toBe(501)
    expect((await handle(request("/bulk/get", { method: "POST" }))).status).toBe(501)
  })
})
