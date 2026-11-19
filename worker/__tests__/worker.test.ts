import { describe, expect, it } from "vitest";
import app from "../index";

/** Static assets that know only these paths; every other path is a 404. */
function assets(paths: string[]) {
  const asked: string[] = [];
  const fetcher = {
    fetch: async (request: Request) => {
      const { pathname } = new URL(request.url);
      asked.push(pathname);
      return paths.includes(pathname)
        ? new Response(`asset ${pathname}`, { status: 200 })
        : new Response("missing", { status: 404 });
    },
  };
  return { env: { ASSETS: fetcher }, asked };
}

const html = { headers: { accept: "text/html" } };

describe("the Worker's API", () => {
  it("given the Worker, when /api/health is asked for, then it lists every module", async () => {
    const { env } = assets([]);

    const res = await app.request("/api/health", {}, env);

    expect(await res.json()).toEqual({
      status: "ok",
      modules: ["melee", "jrpg", "char", "autob"],
    });
  });

  it.each(["melee", "jrpg", "char", "autob"])(
    "given the %s module, when its health is asked for, then it answers ok under /api/<name>",
    async (name) => {
      const { env } = assets([]);

      const res = await app.request(`/api/${name}/health`, {}, env);

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ module: name, status: "ok" });
    },
  );

  it("given the jrpg module, when its health is asked for, then it reports a demo battle", async () => {
    const { env } = assets([]);

    const res = await app.request("/api/jrpg/health", {}, env);

    const body = (await res.json()) as { demo: { actions: number } };
    expect(body.demo.actions).toBeGreaterThan(0);
  });

  it("given an unknown API path, when a page is asked for there, then it answers a JSON 404 without loading assets", async () => {
    const { env, asked } = assets(["/"]);

    const res = await app.request("/api/nothing", html, env);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
    expect(asked).toEqual([]);
  });
});

describe("the Worker's pages", () => {
  it("given an asset that exists, when it is asked for, then it is served", async () => {
    const { env } = assets(["/melee/app.js"]);

    const res = await app.request("/melee/app.js", {}, env);

    expect(await res.text()).toBe("asset /melee/app.js");
  });

  it("given a deep link inside a module, when a page is asked for, then the module's app loads", async () => {
    const { env, asked } = assets(["/jrpg/"]);

    const res = await app.request("/jrpg/run/3", html, env);

    expect(res.status).toBe(200);
    expect(asked).toEqual(["/jrpg/run/3", "/jrpg/"]);
  });

  it("given a path outside every module, when a page is asked for, then the landing page loads", async () => {
    const { env, asked } = assets(["/"]);

    await app.request("/elsewhere/page", html, env);

    expect(asked).toEqual(["/elsewhere/page", "/"]);
  });

  it("given a missing file that isn't a page, when it is asked for, then it stays a 404", async () => {
    const { env, asked } = assets(["/melee/"]);

    const res = await app.request("/melee/missing.png", {}, env);

    expect(res.status).toBe(404);
    expect(asked).toEqual(["/melee/missing.png"]);
  });

  it("given a missing path, when it is posted to, then it stays a 404", async () => {
    const { env } = assets(["/melee/"]);

    const res = await app.request("/melee/x", { ...html, method: "POST" }, env);

    expect(res.status).toBe(404);
  });
});
