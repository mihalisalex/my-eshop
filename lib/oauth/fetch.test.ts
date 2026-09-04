import { describe, expect, it, vi, afterEach } from "vitest";
import { oauthFetch } from "@/lib/oauth/fetch";
import { OAuthError } from "@/lib/oauth/types";

/**
 * REL-001. The value of a timeout is entirely in what it does on the bad path, and that path
 * never runs in normal use — so without a test the only evidence it works is that it compiles,
 * which is precisely the state OPS-001 is about.
 *
 * `fetch` is stubbed rather than pointed at a real stalling server: the assertion is about how
 * this helper translates an abort, not about whether the platform implements AbortSignal.
 */
afterEach(() => {
  vi.unstubAllGlobals();
});

/** What the runtime actually throws when `AbortSignal.timeout` fires. */
function timeoutError(): DOMException {
  return new DOMException("The operation was aborted due to timeout", "TimeoutError");
}

describe("oauthFetch", () => {
  it("passes an abort signal, so a stalled provider cannot hang the request forever", async () => {
    const spy = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);

    await oauthFetch("https://example.test/token", { method: "POST" }, "Test exchange");

    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    // The caller's own options must survive being merged with the signal.
    expect(init.method).toBe("POST");
  });

  it("turns a timeout into an OAuthError naming the provider and the limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutError()));

    await expect(oauthFetch("https://example.test/token", undefined, "Google token exchange")).rejects.toThrow(
      OAuthError
    );
    await expect(
      oauthFetch("https://example.test/token", undefined, "Google token exchange")
    ).rejects.toThrow(/Google token exchange timed out after \d+ms/);
  });

  it("distinguishes a network fault from a timeout", async () => {
    // A DNS or TLS failure is a different problem with a different fix, and a log line that
    // calls it a timeout sends whoever reads it looking in the wrong place.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(oauthFetch("https://example.test/token", undefined, "Apple token exchange")).rejects.toThrow(
      /could not reach the provider: fetch failed/
    );
  });

  it("returns the response untouched when the provider answers", async () => {
    const response = new Response('{"ok":true}', { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const result = await oauthFetch("https://example.test/token", undefined, "Test exchange");
    expect(result).toBe(response);
    expect(await result.json()).toEqual({ ok: true });
  });
});
