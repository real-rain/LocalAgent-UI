import { describe, expect, it } from "vitest";
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
});
