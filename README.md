# fastify-api

A [Fastify](https://fastify.dev/) server on one **Cloudflare Worker**. The
app (`apps/api/src/server.ts`) is one Fastify instance; the Worker's entry
(`apps/api/src/worker.ts`) starts it with `fastify.listen({ port: 3000 })` when
the Worker starts, and the Workers runtime's Node.js HTTP server support
(`httpServerHandler` from `cloudflare:node`) hands it every request. Every
merge to `main` deploys it to stage, then prod.

Built from Vercel's Fastify on Vercel template (vercel/vercel, Apache-2.0 —
the licence is `apps/api/LICENSE.md`).

## Live deployment

<!-- 02-docs:begin -->
This app is **live**. Verified URLs, identity and the secrets it uses are
recorded in [ai/context/deployment.md](ai/context/deployment.md) (re-rendered
by the `02-docs` phase); how it deploys and how to operate it:
[ai/context/operations.md](ai/context/operations.md).
<!-- 02-docs:end -->

## Routes

| Route | Answers |
|---|---|
| `GET /` | the welcome page, titled with the site's name (`SITE_NAME`) |
| `GET /health` | `{"status":"ok","name":"<SITE_NAME>","environment":"<env>"}` — what the deploy's smoke and an operator's probe read |
| anything else | Fastify's JSON `404` (`{"message":"Route GET:/x not found","error":"Not Found","statusCode":404}`); a malformed JSON body gets Fastify's `400` |

## What is here

| Surface | Where |
|---|---|
| The app and its routes (one Fastify instance, its logger on) | `apps/api/src/server.ts` |
| The Worker's entry (`fastify.listen` at startup, then `httpServerHandler`) | `apps/api/src/worker.ts` |
| The site's name (the welcome page's title and heading, and `/health`) | `apps/api/src/identity.ts` |
| Worker config (name, `nodejs_compat`, `src/worker.ts` as the entry, pino's Node build by alias, per-environment vars) | `apps/api/wrangler.jsonc` |
| Deploy contract | `apps/api/component.yaml` (`cloudflare-worker-turbo`) |
| Tests | `tests/api` (vitest: the same Fastify instance listening on Node, called over HTTP) |

## Getting started

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build            # wrangler's dry run → apps/api/dist (the Worker's one bundle)
```

Run the Worker under workerd and call it:

```bash
pnpm --filter @app/api dev                 # wrangler dev, http://localhost:8787
curl http://localhost:8787/                # the welcome page
curl http://localhost:8787/health          # {"status":"ok",…,"environment":"local"}
```

Add a route in `apps/api/src/server.ts`, before the instance is exported:
`fastify.get('/hello', async () => 'hi')` answers `/hello`,
`fastify.get('/users/:id', async (request) => (request.params as { id: string }).id)`
answers `/users/42`, and `fastify.post('/echo', async (request) => request.body)`
echoes a JSON body. Group routes in plugins (`fastify.register(...)`) as the app
grows. Keep `/health`: the deploy's smoke reads it.

Two rules come from running Fastify in a Worker:

- **Declare every route before the Worker starts.** Fastify compiles its router
  while it boots, with `new Function`; a Worker may generate code while it
  starts up, never inside a request. `src/worker.ts` awaits `fastify.listen` at
  the top level so the boot finishes at startup, once per isolate. A route
  registered later — from inside a request handler, say — fails with an
  `EvalError`.
- **Keep `pluginTimeout: 0`.** avvio's per-plugin watchdog is a timer, and a
  Worker cannot set one while it starts up; with it on, the boot never ends.

On the Worker, the vars are in `process.env` (as `/health` reads
`ENVIRONMENT`), and the logger is upstream's: each request writes a pino line
to the Worker's log. pino comes from its Node build: `wrangler.jsonc` aliases
it, because wrangler's bundler would otherwise take pino's browser build, which
Fastify cannot load. Plugins that read files from disk (`@fastify/static`)
need Workers Static Assets instead (an `assets` directory in `wrangler.jsonc`).

## How it deploys

Merges to `main` converge through [Orun](https://github.com/sourceplane/orun):
`.github/workflows/ci.yml` plans the changed components and runs each lane
against the workspace in `intent.yaml`. The app deploys to `stage`, then to
`prod` once stage has converged on the same commit; `dev` only verifies. The
Worker is `fastify-api-api-<env>` on your account's workers.dev subdomain, and
every deploy is smoke-tested over HTTP: `/health` must answer `"status":"ok"`
for that environment. A pull request runs the same pipeline's verify lanes:
the Worker bundled, type-checked and dry-deployed for each environment, with
nothing deployed. They do not lint or run the tests, so run `pnpm typecheck`,
`pnpm lint` and `pnpm test` before you push. (A push to `main` builds,
deploys and smoke-tests.)

The pipeline holds one credential, GitHub's own `GITHUB_TOKEN`. The
Cloudflare token and account id are brokered per run from the workspace's
Cloudflare connection; nothing provider-shaped is stored in the repository
or in GitHub.

**Deploy by hand.** Orunbase's **Deploy** button on a component, or **Run
workflow** on the CI workflow in GitHub's Actions tab (on `main`), runs
`ci.yml` for the environment and components you pick, and each one deploys
exactly as a merge would deploy it. Leave the component blank to redeploy
every component in that environment, with nothing changed: after rotating a
secret, say. A component with nothing to run in that environment (a test
suite in `prod`) is left out with a notice.

## Adding a binding or a secret

The Worker binds nothing of its own today, so `wrangler.jsonc` is committed
as it deploys. To give it a KV namespace, a D1 database or an R2 bucket, add the
resource under `infra/` as its own component and have `apps/api/component.yaml`
depend on it; `tooling/wire/` renders a wrangler template from the ids that
component publishes. A runtime secret (an API key for a service the app
calls) is an Orun secret: `orun secrets set <KEY> --org <ws> --env <env>`,
declared in the component's `optionalSecretEnv` and named in its
`runtimeSecrets`, then pushed to the Worker after each deploy. Until it is
set, the route that needs it should say so rather than fail. On the Worker
a secret is in `process.env`, beside the vars.

## Custom domain

The app answers on workers.dev from its first deploy. To serve it on your own
domain, add the domain to the Cloudflare account the app deploys into and
attach it to the Worker (dashboard → Workers & Pages → `fastify-api-api-prod` →
Settings → Domains & Routes → Add → Custom domain); do the same for stage
with a subdomain if you want one. The workers.dev URL keeps answering, and the
deploy's smoke keeps reading it — unless the environment sets `DEPLOYED_URL`
in `intent.yaml`, which the smoke reads instead:

```yaml
environments:
  prod:
    env:
      DEPLOYED_URL: https://fastify-api.example.com
```

The repository names the domain in one place, `BASE_DOMAIN` in `intent.yaml`
(one line per environment), which the app was born with as the reserved
placeholder `fastify-api.example.com` — the example above carries it too.
Replace it with your domain in the same change that attaches it.
