import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// The Fastify app on Node, served the way upstream's `fastify.listen` serves
// it — a real HTTP server on a free port, called over fetch — so this is the
// template's behaviour, independent of the runtime. The e2e tier serves the
// same app under workerd, through the Workers runtime's Node.js HTTP server
// support, booted at startup as src/worker.ts does.
const apiDir = path.resolve(__dirname, "../../../apps/api");
let app: (typeof import("@/server"))["default"];
let base: string;

beforeAll(async () => {
  ({ default: app } = await import("@/server"));
  base = await app.listen({ port: 0, host: "127.0.0.1" });
});

afterAll(async () => {
  await app.close();
});

const get = (route: string, init?: RequestInit) => fetch(base + route, init);
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

describe("the Fastify app (apps/api/src/server.ts)", () => {
  it("answers / with upstream's welcome page, named by the site's name", async () => {
    const { SITE_NAME } = await import("@/identity");
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html");
    const html = await res.text();
    // The name is text in the page: escaped, so a name with `&` or `<` in it
    // (an owner's, after the rename) stays text.
    const name = escapeHtml(SITE_NAME);
    expect(html).toContain(`<title>${name}</title>`);
    expect(html).toContain(`<h1>Welcome to ${name}</h1>`);
    expect(html).toContain("<p>A fast and low overhead web framework running on Cloudflare Workers</p>");
    // Fastify's own logo and links, where upstream's were Vercel's.
    expect(html).toContain('<img src="https://fastify.dev/favicon.svg" alt="Fastify logo" class="logo" />');
    expect(html).toContain('href="https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/"');
    expect(html).toContain('href="https://fastify.dev"');
    expect(html).not.toMatch(/vercel/i);
    // Upstream's look: its dark gradient and feature cards, unchanged.
    expect(html).toContain("background: linear-gradient(135deg, #000 0%, #111 100%);");
    expect(html).toContain("grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));");
  });

  it("answers HEAD / with the page's headers and no body, as Fastify exposes HEAD routes", async () => {
    const res = await get("/", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html");
    expect(Number(res.headers.get("content-length"))).toBeGreaterThan(1000);
    expect(await res.text()).toBe("");
  });

  it("answers an unknown path with Fastify's own JSON 404", async () => {
    const res = await get("/nope");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await res.json()).toEqual({ message: "Route GET:/nope not found", error: "Not Found", statusCode: 404 });
  });

  it("refuses a malformed JSON body with Fastify's 400, before any route runs", async () => {
    const res = await get("/", { method: "POST", headers: { "content-type": "application/json" }, body: '{"a":' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ statusCode: 400, code: "FST_ERR_CTP_INVALID_JSON_BODY" });
  });

  it("declares the routes the Worker serves: / and /health, GET with HEAD", () => {
    for (const url of ["/", "/health"]) {
      expect(app.hasRoute({ method: "GET", url })).toBe(true);
      expect(app.hasRoute({ method: "HEAD", url })).toBe(true);
      expect(app.hasRoute({ method: "POST", url })).toBe(false);
    }
  });
});

describe("GET /health — what the deploy's smoke and the bootstrap's probe read", () => {
  const saved = process.env.ENVIRONMENT;
  afterEach(() => {
    if (saved === undefined) delete process.env.ENVIRONMENT;
    else process.env.ENVIRONMENT = saved;
  });

  it("names the site and the environment the Worker runs as", async () => {
    const { SITE_NAME } = await import("@/identity");
    // What wrangler's `env.stage.vars` hands the deployed Worker, and
    // nodejs_compat puts in process.env.
    process.env.ENVIRONMENT = "stage";
    const res = await get("/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await res.json()).toEqual({ status: "ok", name: SITE_NAME, environment: "stage" });
  });

  it("still answers when the Worker has no ENVIRONMENT var", async () => {
    delete process.env.ENVIRONMENT;
    const res = await get("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", environment: "unknown" });
  });
});

describe("what lets Fastify boot inside a Worker", () => {
  it("turns avvio's plugin watchdog off: a Worker cannot set a timer while it starts up", () => {
    expect(app.initialConfig.pluginTimeout).toBe(0);
  });

  it("keeps upstream's logger on", () => {
    expect(app.log.level).toBe("info");
  });

  it("boots in src/worker.ts with upstream's listen, awaited at the top level, before the handler is exported", () => {
    const worker = readFileSync(path.join(apiDir, "src/worker.ts"), "utf8");
    const listen = worker.indexOf("\nawait app.listen({ port: PORT })\n");
    const handler = worker.indexOf("\nexport default httpServerHandler({ port: PORT })\n");
    expect(listen).toBeGreaterThan(0);
    expect(handler).toBeGreaterThan(listen);
  });

  it("aliases pino to its Node build, the same copy Fastify itself loads", () => {
    const wrangler = readFileSync(path.join(apiDir, "wrangler.jsonc"), "utf8");
    const alias = /"alias":\s*\{\s*"pino":\s*"([^"]+)"/.exec(wrangler)?.[1];
    expect(alias).toBe("./node_modules/pino/pino.js");
    const aliased = realpathSync(path.join(apiDir, alias as string));
    // pino's own browser field is why the alias is needed: wrangler's bundler
    // would take browser.js, which has no `pino.symbols`.
    const pkg = JSON.parse(readFileSync(path.join(path.dirname(aliased), "package.json"), "utf8"));
    expect(pkg.browser).toBe("./browser.js");
    expect(pkg.main).toBe("pino.js");
    // One pino: the alias's file is the one Fastify resolves.
    const fromFastify = createRequire(realpathSync(path.join(apiDir, "node_modules/fastify/fastify.js"))).resolve("pino");
    expect(realpathSync(fromFastify)).toBe(aliased);
  });
});

describe("the site's identity (apps/api/src/identity.ts)", () => {
  it("names the site", async () => {
    const { SITE_NAME } = await import("@/identity");
    expect(SITE_NAME.trim()).not.toBe("");
  });
});
