# api-tests

The app's vitest suite (the welcome page and HEAD, /health and its environment, Fastify's 404 and 400, the boot contract a Worker needs, the site's name), the Fastify instance served on Node with fastify.listen and called over HTTP, run with pnpm test

The test suite for **api**. It deploys nothing: its lane installs, builds and runs the tests.

|              |                      |
| ------------ | -------------------- |
| Type         | `turbo-package`      |
| Source       | `tests/api`          |
| Package      | `@app/api-tests`     |
| Environments | `dev`: `quick-check` |

## Depends on

- (none)

## Depended on by

- (none)
