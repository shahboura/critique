// Service in front of the KV Durable Object. workerd's `kvNamespace` binding
// sends the KV HTTP protocol to this worker; all keys live in one object.
export { KvStore } from "./kv-store.js"

export default {
  fetch(request, env) {
    const id = env.KV_STORE.idFromName("kv")
    return env.KV_STORE.get(id).fetch(request)
  },
}
