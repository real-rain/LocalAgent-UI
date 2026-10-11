import { describe, expect, it, vi } from "vitest";
import { getEnabledTools, getSystemToolPrompt, getTool } from "./registry";

describe("tool registry", () => {
  it("exposes JSON Schema definitions and the enabled tool prompt", () => {
    expect(getEnabledTools().map((tool) => tool.name)).toEqual([
      "get_current_weather",
      "calculator",
      "web_search",
    ]);
    expect(getSystemToolPrompt()).toContain('"name": "calculator"');
    expect(getSystemToolPrompt()).toContain('"required": [');
  });

  it("evaluates arithmetic with exact decimal inputs", async () => {
    const calculator = getTool("calculator");
    if (!calculator) throw new Error("Calculator tool is not registered.");

    await expect(
      calculator.execute({ expression: "0.1 + 0.2 * 3" }),
    ).resolves.toMatchObject({ result: "0.7" });
    await expect(
      calculator.execute({ expression: "1 / 3" }),
    ).resolves.toMatchObject({
      result: "0.333333333333333333333333333333",
    });
  });

  it("rejects invalid calculator input instead of evaluating arbitrary code", async () => {
    const calculator = getTool("calculator");
    if (!calculator) throw new Error("Calculator tool is not registered.");
    await expect(
      calculator.execute({ expression: "globalThis.alert(1)" }),
    ).rejects.toThrow("Use numbers");
  });

  it("returns mock weather when the Open-Meteo request fails", async () => {
    const weather = getTool("get_current_weather");
    if (!weather) throw new Error("Weather tool is not registered.");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Network unavailable"));

    try {
      await expect(weather.execute({ city: "Beijing" })).resolves.toEqual({
        city: "Beijing",
        temperature: "22°C",
        weather: "Sunny (Mock Fallback)",
        note: "Live API unavailable, returned fallback weather.",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.open-meteo.com/v1/forecast?latitude=39.9042&longitude=116.4074&current_weather=true",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("returns mock weather when the request exceeds its three-second timeout", async () => {
    const weather = getTool("get_current_weather");
    if (!weather) throw new Error("Weather tool is not registered.");
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => new Promise(() => undefined));

    try {
      const result = weather.execute({ city: "Beijing" });
      await vi.advanceTimersByTimeAsync(3_000);
      await expect(result).resolves.toMatchObject({
        city: "Beijing",
        weather: "Sunny (Mock Fallback)",
      });
    } finally {
      fetchMock.mockRestore();
      vi.useRealTimers();
    }
  });
});
