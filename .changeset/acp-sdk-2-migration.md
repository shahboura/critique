---
"critique": patch
---

Migrate the ACP client to `@agentclientprotocol/sdk` 2.x. Model selection now uses the agent's `model` config option (`session/set_config_option`) instead of the removed `session/set_model` method, so `critique review --model` works with current OpenCode ACP servers again.
