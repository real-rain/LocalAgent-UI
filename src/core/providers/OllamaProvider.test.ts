import { afterEach, describe, expect, it, vi } from "vitest";
import { OllamaProvider } from "./OllamaProvider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OllamaProvider", () => {
  it("sends a configured API key as a bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 401, statusText: "Unauthorized" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OllamaProvider("http://localhost:11434", " cloud-key ");

    await expect(
      provider.chatStream("model", [{ role: "user", content: "Hello" }]).next(),
    ).rejects.toThrow(
      "401 Unauthorized: Ollama 接口鉴权失败，请检查模型权限或 API Key 配置。",
    );

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer cloud-key",
    });
  });

  it("returns a clear authentication error for a JSON 401 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          statusText: "Unauthorized",
        }),
      ),
    );

    await expect(
      new OllamaProvider()
        .chatStream("model", [{ role: "user", content: "Hello" }])
        .next(),
    ).rejects.toThrow(
      "401 Unauthorized: Ollama 接口鉴权失败，请检查模型权限或 API Key 配置。",
    );
  });

  it.each([
    { status: 403, statusText: "Forbidden", detail: "model access denied" },
    { status: 500, statusText: "Internal Server Error", detail: "upstream failed" },
  ])(
    "extracts API error details for HTTP $status failures",
    async ({ status, statusText, detail }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: detail }), {
            status,
            statusText,
          }),
        ),
      );

      await expect(
        new OllamaProvider()
          .chatStream("model", [{ role: "user", content: "Hello" }])
          .next(),
      ).rejects.toThrow(`${status} ${statusText}: ${detail}`);
    },
  );
});
