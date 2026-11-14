using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    ( name = "do-disk",
      disk = ( path = "/data/v3/do",
               writable = true ) ),
    ( name = "assets-disk",
      disk = ( path = "/app/public",
               writable = false ) ),
    ( name = "kv-service",
      worker = (
        modules = [
          ( name = "kv-service.js", esModule = embed "kv-service.js" ),
          ( name = "kv-store.js", esModule = embed "kv-store.js" ),
          ( name = "kv-protocol.js", esModule = embed "kv-protocol.js" )
        ],
        compatibilityDate = "2025-05-26",
        bindings = [
          ( name = "KV_STORE", durableObjectNamespace = "KvStore" )
        ],
        durableObjectNamespaces = [
          ( className = "KvStore",
            uniqueKey = "critique-kv-v1",
            enableSql = true )
        ],
        durableObjectStorage = ( localDisk = "do-disk" )
      ) ),
    ( name = "main",
      worker = (
        modules = [
          ( name = "worker.js", esModule = embed "worker.js" )
        ],
        compatibilityDate = "2025-05-26",
        compatibilityFlags = [ "nodejs_compat" ],
        bindings = [
          ( name = "PUBLIC_URL", fromEnvironment = "PUBLIC_URL" ),
          ( name = "CRITIQUE_WIDGET_WEBHOOKS", fromEnvironment = "CRITIQUE_WIDGET_WEBHOOKS" ),
          ( name = "STRIPE_SECRET_KEY", fromEnvironment = "STRIPE_SECRET_KEY" ),
          ( name = "STRIPE_WEBHOOK_SECRET", fromEnvironment = "STRIPE_WEBHOOK_SECRET" ),
          ( name = "RESEND_API_KEY", fromEnvironment = "RESEND_API_KEY" ),
          ( name = "RESEND_FROM", fromEnvironment = "RESEND_FROM" ),
          ( name = "MIGRATE_SECRET", fromEnvironment = "MIGRATE_SECRET" ),
          ( name = "CRITIQUE_KV", kvNamespace = "kv-service" ),
          ( name = "CommentRoom", durableObjectNamespace = "CommentRoom" )
        ],
        durableObjectNamespaces = [
          ( className = "CommentRoom",
            uniqueKey = "critique-web-CommentRoom",
            enableSql = true )
        ],
        durableObjectStorage = ( localDisk = "do-disk" )
      )
    ),
    ( name = "router",
      worker = (
        modules = [
          ( name = "router.js", esModule = embed "router.js" )
        ],
        compatibilityDate = "2025-05-26",
        bindings = [
          ( name = "ASSETS", service = "assets-disk" ),
          ( name = "MAIN", service = "main" )
        ]
      )
    )
  ],
  sockets = [
    ( name = "http",
      address = "0.0.0.0:8787",
      http = (),
      service = "router" )
  ]
);
