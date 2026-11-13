// The Worker's entry. The app (./server) is upstream's Fastify instance, and
// this is upstream's last line, `fastify.listen({ port: 3000 })`, awaited at
// the top level: the Workers runtime's Node.js HTTP server support —
// `httpServerHandler` from `cloudflare:node`, on with nodejs_compat — hands
// every request the Worker receives to the server listening on that port.
//
// Why at the top level, and awaited: `listen` runs Fastify's boot (avvio), and
// the boot compiles each route's matcher with `new Function` (find-my-way). A
// Worker may generate code while it starts up, not while it serves a request,
// so the boot must finish before the first request — and it does, once per
// isolate, in about a millisecond. Every request after that reuses the same
// instance and its compiled routes.
import { httpServerHandler } from 'cloudflare:node'
import app from './server'

const PORT = 3000

await app.listen({ port: PORT })
export default httpServerHandler({ port: PORT })
