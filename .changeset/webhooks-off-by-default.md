---
"critique": minor
---

Webhooks in the comments widget are now off by default for self-hosted deployments: the settings panel no longer offers a webhook URL, so annotation text cannot be pointed at a third-party endpoint. Set `CRITIQUE_WIDGET_WEBHOOKS=on` in the container environment to restore the upstream behaviour. When disabled, the manual Send control stays hidden and hidden or previously saved webhook URLs are never called.
