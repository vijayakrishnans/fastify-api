// The one Workers API this app imports. Declared here rather than through
// @cloudflare/workers-types, whose globals would retype Node's Request and
// Response under the Fastify and Node types the app is written against.
declare module 'cloudflare:node' {
  /** A Worker fetch handler that forwards each request to the node:http server listening on `port`. */
  export function httpServerHandler(options: { port: number }): {
    fetch(request: Request): Promise<Response>
  }
}
