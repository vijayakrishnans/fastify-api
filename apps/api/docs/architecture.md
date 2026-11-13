# api — architecture

Built by the turbo pipeline from `apps/api` and deployed with wrangler.

|                     |                           |
| ------------------- | ------------------------- |
| Worker config       | `apps/api/wrangler.jsonc` |
| Entry               | `src/worker.ts`           |
| Compatibility date  | `2026-10-01`              |
| Compatibility flags | `nodejs_compat`           |

## Bindings

None: the Worker binds no storage or service.

## Variables

`ENVIRONMENT` — overridden per environment (`dev`, `prod`, `stage`).
