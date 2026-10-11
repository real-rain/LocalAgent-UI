export type JsonSchema = {
  type: "object" | "string" | "number";
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
};

export interface Tool {
  name: string;
  description: string;
  parameters: JsonSchema;
  execute: (
    args: Record<string, unknown>,
    context?: { signal?: AbortSignal },
  ) => Promise<unknown>;
}

function requireString(
  args: Record<string, unknown>,
  key: string,
): string {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`The "${key}" argument must be a non-empty string.`);
  }
  return value.trim();
}

interface Fraction {
  numerator: bigint;
  denominator: bigint;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a || 1n;
}

function fraction(numerator: bigint, denominator = 1n): Fraction {
  if (denominator === 0n) throw new Error("Division by zero.");
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: (numerator / divisor) * sign,
    denominator: (denominator / divisor) * sign,
  };
}

function formatFraction(value: Fraction): string {
  const scale = 10n ** 30n;
  const scaled = (value.numerator * scale) / value.denominator;
  const negative = scaled < 0n;
  const digits = (negative ? -scaled : scaled).toString().padStart(31, "0");
  const whole = digits.slice(0, -30);
  const decimal = digits.slice(-30).replace(/0+$/, "");
  const result = decimal ? `${whole}.${decimal}` : whole;
  return `${negative ? "-" : ""}${result}`;
}

function evaluateExpression(expression: string): string {
  if (expression.length > 256) {
    throw new Error("The expression must be no longer than 256 characters.");
  }
  const tokens = expression.match(/\d+(?:\.\d*)?|\.\d+|[()+\-*/%]/g) ?? [];
  if (tokens.join("") !== expression.replace(/\s+/g, "")) {
    throw new Error("Use numbers, parentheses, and +, -, *, /, or % only.");
  }

  let position = 0;
  const parsePrimary = (): Fraction => {
    const token = tokens[position++];
    if (token === "+" || token === "-") {
      const value = parsePrimary();
      return token === "-"
        ? fraction(-value.numerator, value.denominator)
        : value;
    }
    if (token === "(") {
      const value = parseSum();
      if (tokens[position++] !== ")") throw new Error("Missing closing parenthesis.");
      return value;
    }
    if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) {
      throw new Error("Expected a number.");
    }
    const [whole, decimal = ""] = token.split(".");
    return fraction(
      BigInt(`${whole || "0"}${decimal}`),
      10n ** BigInt(decimal.length),
    );
  };
  const parseProduct = (): Fraction => {
    let value = parsePrimary();
    while (["*", "/", "%"].includes(tokens[position] ?? "")) {
      const operator = tokens[position++];
      const right = parsePrimary();
      if (operator === "*") {
        value = fraction(
          value.numerator * right.numerator,
          value.denominator * right.denominator,
        );
      } else if (operator === "/") {
        value = fraction(
          value.numerator * right.denominator,
          value.denominator * right.numerator,
        );
      } else {
        if (right.numerator === 0n) throw new Error("Division by zero.");
        const quotient =
          (value.numerator * right.denominator) /
          (value.denominator * right.numerator);
        value = fraction(
          value.numerator * right.denominator -
            quotient * right.numerator * value.denominator,
          value.denominator * right.denominator,
        );
      }
    }
    return value;
  };
  const parseSum = (): Fraction => {
    let value = parseProduct();
    while (tokens[position] === "+" || tokens[position] === "-") {
      const operator = tokens[position++];
      const right = parseProduct();
      value = fraction(
        value.numerator * right.denominator +
          (operator === "+" ? 1n : -1n) *
            right.numerator *
            value.denominator,
        value.denominator * right.denominator,
      );
    }
    return value;
  };

  if (tokens.length === 0) throw new Error("Enter an expression to calculate.");
  const result = parseSum();
  if (position !== tokens.length) throw new Error("Unexpected token in expression.");
  return formatFraction(result);
}

const tools: Tool[] = [
  {
    name: "get_current_weather",
    description: "Get the current weather and temperature for a city.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name, preferably in English." },
      },
      required: ["city"],
    },
    execute: async (args, { signal } = {}) => {
      const city = requireString(args, "city");
      const geocodingUrl = new URL(
        "https://geocoding-api.open-meteo.com/v1/search",
      );
      geocodingUrl.searchParams.set("name", city);
      geocodingUrl.searchParams.set("count", "1");
      geocodingUrl.searchParams.set("language", "en");
      geocodingUrl.searchParams.set("format", "json");
      const geocodingResponse = await fetch(geocodingUrl, { signal });
      if (!geocodingResponse.ok) {
        throw new Error(`Weather location lookup failed (HTTP ${geocodingResponse.status}).`);
      }
      const locations = (await geocodingResponse.json()) as {
        results?: Array<{ name: string; latitude: number; longitude: number; country?: string }>;
      };
      const location = locations.results?.[0];
      if (!location) throw new Error(`No weather location found for "${city}".`);

      const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
      weatherUrl.searchParams.set(
        "latitude",
        String(location.latitude),
      );
      weatherUrl.searchParams.set(
        "longitude",
        String(location.longitude),
      );
      weatherUrl.searchParams.set("current", "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m");
      weatherUrl.searchParams.set("timezone", "auto");
      const weatherResponse = await fetch(weatherUrl, { signal });
      if (!weatherResponse.ok) {
        throw new Error(`Weather lookup failed (HTTP ${weatherResponse.status}).`);
      }
      const weather = (await weatherResponse.json()) as {
        current?: Record<string, number | string>;
        current_units?: Record<string, string>;
      };
      if (!weather.current) throw new Error("The weather service returned no current conditions.");
      return {
        location: [location.name, location.country].filter(Boolean).join(", "),
        current: weather.current,
        units: weather.current_units,
        source: "Open-Meteo",
      };
    },
  },
  {
    name: "calculator",
    description:
      "Evaluate an arithmetic expression with arbitrary-precision decimal inputs.",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Arithmetic using numbers, parentheses, +, -, *, /, and %.",
        },
      },
      required: ["expression"],
    },
    execute: async (args) => ({
      expression: requireString(args, "expression"),
      result: evaluateExpression(requireString(args, "expression")),
      precision: "Exact rational arithmetic; decimal output is truncated to 30 places.",
    }),
  },
  {
    name: "web_search",
    description: "Run a basic simulated web search when no search service is configured.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search terms." },
      },
      required: ["query"],
    },
    execute: async (args) => ({
      query: requireString(args, "query"),
      results: [],
      message:
        "No web search service is configured in this local frontend. Use the query to guide a response and tell the user that search results are simulated.",
      simulated: true,
    }),
  },
];

export function getEnabledTools(): readonly Tool[] {
  return tools;
}

export function getTool(name: string): Tool | undefined {
  return tools.find((tool) => tool.name === name);
}

export function getSystemToolPrompt(): string {
  const definitions = tools.map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));
  return [
    "You may call the following frontend tools when useful.",
    "To call a tool, output exactly one JSON object in <tool_call>...</tool_call> tags using {\"name\":\"tool_name\",\"arguments\":{...}}. Do not invent tool names or arguments.",
    "After receiving a tool result, continue with a useful answer. A web_search result may be simulated and must not be presented as verified web research.",
    "Enabled tools (JSON Schema):",
    JSON.stringify(definitions, null, 2),
  ].join("\n\n");
}
