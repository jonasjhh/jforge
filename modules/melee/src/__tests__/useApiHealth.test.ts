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
  it("is loading, then the body the endpoint answered", async () => {
    answer(Response.json({ status: "ok" }));
    const { result } = renderHook(() => useApiHealth("/api/health"));
    expect(result.current).toEqual({ state: "loading" });
    await waitFor(() =>
      expect(result.current).toEqual({
        state: "ok",
        body: { status: "ok" },
      }),
    );
    expect(fetch).toHaveBeenCalledWith("/api/health");
  });

  it("is an error for a status that isn't OK", async () => {
    answer(new Response("down", { status: 503 }));
    const { result } = renderHook(() => useApiHealth("/api/health"));
    await waitFor(() =>
      expect(result.current).toEqual({
        state: "error",
        message: "Error: HTTP 503",
      }),
    );
  });

  it("is an error when the request fails", async () => {
    answer(new Error("offline"));
    const { result } = renderHook(() => useApiHealth("/api/health"));
    await waitFor(() =>
      expect(result.current).toEqual({
        state: "error",
        message: "Error: offline",
      }),
    );
  });

  it("ignores an answer that comes after it is gone", async () => {
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
