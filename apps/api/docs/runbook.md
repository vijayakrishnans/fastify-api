# api — runbook

## How it runs

Pull requests verify it; a merge to `main` deploys it to `stage`, `prod`.
CI plans what changed (`orun plan --changed`) and runs each lane with `orun run`;
the plan orders a component after everything it depends on.

## Local commands

```bash
pnpm --filter @app/api dev
pnpm --filter @app/api build
pnpm --filter @app/api typecheck
pnpm --filter @app/api lint
```

## Verify

After a deploy the lane runs this smoke against the environment it
deployed (`ORUN_ENVIRONMENT`); `DEPLOYED_URL` overrides the URL:

```bash
base="${DEPLOYED_URL:-https://fastify-api-api-${ORUN_ENVIRONMENT}.vijayakrishnan12994.workers.dev}" && health="$(curl -sf --max-time 20 "${base}/health")" && echo "${health}" | grep -q "\"status\":\"ok\"" && echo "${health}" | grep -q "\"environment\":\"${ORUN_ENVIRONMENT}\""
```

## Rollback

Revert the commit on `main`. The next convergence applies the previous desired
state; nothing was changed out of band, so there is nothing else to undo.

## Common failures

- **The smoke fails right after a first deploy**: a new workers.dev route can
  answer 4xx for a few seconds and the lane retries. A failure that persists
  is a regression in the deployed code.
