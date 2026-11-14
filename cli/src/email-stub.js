// cloudflare:email is a Cloudflare-internal module that open-source workerd
// does not provide. CommentRoom never sends email; the agents SDK imports it
// for unrelated features. Fail loudly if a future path actually tries to use it.
export class EmailMessage {
  constructor() {
    throw new Error("cloudflare:email is not available in self-hosted workerd")
  }
}
