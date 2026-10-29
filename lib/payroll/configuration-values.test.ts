import { expect, test } from "bun:test";
import { fromConfigurationInput, toConfigurationInput } from "./configuration-values";

test("converts social security percentages exactly and preserves other values", () => {
  for (const [input, stored] of [["5", "0.05"], ["0.01", "0.0001"], ["99.99", "0.9999"], ["100", "1"], ["0", "0"]]) {
    expect(fromConfigurationInput("SOCIAL_SECURITY_RATE", input)).toBe(stored);
    expect(toConfigurationInput("SOCIAL_SECURITY_RATE", stored)).toBe(input);
  }
  expect(() => fromConfigurationInput("SOCIAL_SECURITY_RATE", "100.01")).toThrow();
  expect(() => fromConfigurationInput("SOCIAL_SECURITY_RATE", "0.001")).toThrow();
  expect(fromConfigurationInput("OT_HOURLY_RATE", "1.5")).toBe("1.5");
  expect(toConfigurationInput("OT_HOURLY_RATE", "1.5000")).toBe("1.5");
});
