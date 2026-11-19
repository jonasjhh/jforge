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
  it("lists every module at /api/health", async () => {
    const res = await app.request("/api/health", {}, assets([]).env);
    expect(await res.json()).toEqual({
      status: "ok",
      modules: ["melee", "jrpg", "char"],
    });
  });

  it.each(["melee", "jrpg", "char"])(
    "mounts %s at /api/<name>",
    async (name) => {
      const res = await app.request(`/api/${name}/health`, {}, assets([]).env);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ module: name, status: "ok" });
    },
  );

  it("has jrpg report a demo battle", async () => {
    const res = await app.request("/api/jrpg/health", {}, assets([]).env);
    const body = (await res.json()) as { demo: { actions: number } };
    expect(body.demo.actions).toBeGreaterThan(0);
  });

  it("answers an unknown API path with a JSON 404, not a page", async () => {
    const { env, asked } = assets(["/"]);
    const res = await app.request("/api/nothing", html, env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
    expect(asked).toEqual([]);
  });
});

describe("the Worker's pages", () => {
  it("serves an asset that exists", async () => {
    const { env } = assets(["/melee/app.js"]);
    const res = await app.request("/melee/app.js", {}, env);
    expect(await res.text()).toBe("asset /melee/app.js");
  });

  it("loads a module's app for a deep link inside it", async () => {
    const { env, asked } = assets(["/jrpg/"]);
    const res = await app.request("/jrpg/run/3", html, env);
    expect(res.status).toBe(200);
    expect(asked).toEqual(["/jrpg/run/3", "/jrpg/"]);
  });

  it("loads the landing page for a path outside every module", async () => {
    const { env, asked } = assets(["/"]);
    await app.request("/elsewhere/page", html, env);
    expect(asked).toEqual(["/elsewhere/page", "/"]);
  });

  it("keeps the 404 for a missing file that isn't a page", async () => {
    const { env, asked } = assets(["/melee/"]);
    const res = await app.request("/melee/missing.png", {}, env);
    expect(res.status).toBe(404);
    expect(asked).toEqual(["/melee/missing.png"]);
  });

  it("keeps the 404 for anything but a GET", async () => {
    const { env } = assets(["/melee/"]);
    const res = await app.request("/melee/x", { ...html, method: "POST" }, env);
    expect(res.status).toBe(404);
  });
});
