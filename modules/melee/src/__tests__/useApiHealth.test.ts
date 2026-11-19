// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useApiHealth } from "../useApiHealth";

const answer = (response: Response | Error) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      response instanceof Error
        ? Promise.reject(response)
        : Promise.resolve(response),
    ),
  );

afterEach(() => vi.unstubAllGlobals());

describe("useApiHealth", () => {
  it("given a request in flight, when the hook first renders, then it is loading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );

    const { result } = renderHook(() => useApiHealth("/api/health"));

    expect(result.current).toEqual({ state: "loading" });
  });

  it("given an endpoint that answers OK, when the hook renders, then it is the body it answered", async () => {
    answer(Response.json({ status: "ok" }));

    const { result } = renderHook(() => useApiHealth("/api/health"));

    await waitFor(() =>
      expect(result.current).toEqual({
        state: "ok",
        body: { status: "ok" },
      }),
    );
    expect(fetch).toHaveBeenCalledWith("/api/health");
  });

  it("given an endpoint that answers 503, when the hook renders, then it is an error", async () => {
    answer(new Response("down", { status: 503 }));

    const { result } = renderHook(() => useApiHealth("/api/health"));

    await waitFor(() =>
      expect(result.current).toEqual({
        state: "error",
        message: "Error: HTTP 503",
      }),
    );
  });

  it("given the request fails, when the hook renders, then it is an error", async () => {
    answer(new Error("offline"));

    const { result } = renderHook(() => useApiHealth("/api/health"));

    await waitFor(() =>
      expect(result.current).toEqual({
        state: "error",
        message: "Error: offline",
      }),
    );
  });

  it("given the hook is gone, when the answer comes, then it is ignored", async () => {
    let reply: (r: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (reply = resolve))),
    );
    const { result, unmount } = renderHook(() => useApiHealth("/api/health"));
    unmount();

    reply(Response.json({ status: "ok" }));
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current).toEqual({ state: "loading" });
  });
});
