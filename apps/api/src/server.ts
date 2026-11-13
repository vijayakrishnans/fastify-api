import Fastify from 'fastify'
import { SITE_NAME } from './identity'

// Vercel's Fastify example (vercel/vercel examples/fastify, Apache-2.0; see
// ../LICENSE.md), modified for Cloudflare Workers. The app is upstream's
// server.ts: one Fastify instance, its logger on, one route. Changed from
// upstream:
// - `pluginTimeout: 0`. The Worker boots Fastify at startup (src/worker.ts),
//   and avvio's per-plugin watchdog is a timer, which a Worker cannot set at
//   startup: its error is swallowed and the boot never finishes. Fastify's
//   plugins still load in order; only the "did not start in time" guard is off.
// - the page's title and heading read the site's name; its logo is Fastify's
//   own (fastify.dev) and its links are Cloudflare's Node.js HTTP page and
//   Fastify's docs, where upstream's were Vercel's;
// - a /health route, what the deploy's smoke reads;
// - `fastify.listen` moved to src/worker.ts, the Worker's entry, and this file
//   exports the instance, so tests on Node listen on a port of their own.

// The site's name goes into HTML: escape it, so a name with `&` or `<` in it
// stays text.
const siteName = SITE_NAME.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const fastify = Fastify({ logger: true, pluginTimeout: 0 })

// Declare a route
fastify.get('/', async function handler (request, reply) {
  reply.type('text/html')
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${siteName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: linear-gradient(135deg, #000 0%, #111 100%);
          color: #fff;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          text-align: center;
          max-width: 600px;
          padding: 2rem;
        }
        .logo {
          width: 120px;
          height: 120px;
          border-radius: 12px;
          margin: 0 auto 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 1.5rem;
        }
        h1 {
          font-size: 3rem;
          font-weight: 700;
          margin-bottom: 1rem;
          color: white;
        }
        p {
          font-size: 1.125rem;
          color: #888;
          margin-bottom: 2rem;
          line-height: 1.6;
        }
        .features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-top: 2rem;
        }
        .feature {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 1rem;
          backdrop-filter: blur(10px);
        }
        .feature h3 {
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .feature a {
          font-size: 1rem;
          color: white;
          margin: 0;
          text-decoration: none;
        }
        .feature a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <img src="https://fastify.dev/favicon.svg" alt="Fastify logo" class="logo" />
        <h1>Welcome to ${siteName}</h1>
        <p>A fast and low overhead web framework running on Cloudflare Workers</p>
        <div class="features">
          <div class="feature">
            <a href="https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/" target="_blank" rel="noreferrer">Cloudflare docs</a>
          </div>
          <div class="feature">
            <a href="https://fastify.dev" target="_blank" rel="noreferrer">Fastify docs</a>
          </div>
        </div>
      </div>
    </body>
    </html>
    `
})

// The deploy's contract: the site's name and the environment whose config the
// Worker runs — wrangler's `env.<name>.vars.ENVIRONMENT`, which nodejs_compat
// puts in process.env — so a 200 here is this site, deployed to that
// environment.
fastify.get('/health', async () => {
  return { status: 'ok', name: SITE_NAME, environment: process.env.ENVIRONMENT ?? 'unknown' }
})

export default fastify
