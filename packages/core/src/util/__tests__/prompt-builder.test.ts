import { z } from "zod";
import { createPromptBuilder } from "../prompt-template";

describe("Prompt builder test", () => {
  it("should build a prompt with a variable", () => {
    const prompt = createPromptBuilder("Hello, {{ name }}!", z.object({ name: z.string() }));
    expect(prompt({ name: "John" })).toBe("Hello, John!");
  });

  it("should build a prompt with multiple variables", () => {
    const prompt = createPromptBuilder(
      "Hello, {{ name }} of age {{ age }}!",
      z.object({ name: z.string(), age: z.number() })
    );
    expect(prompt({ name: "John", age: 30 })).toBe("Hello, John of age 30!");
    expect(prompt({ name: "Jane", age: 25 })).toBe("Hello, Jane of age 25!");
  });

  it("should throw an error when template variables are not in schema", () => {
    expect(() =>
      createPromptBuilder("Hello, {{ name }} and {{ invalidVar }}!", z.object({ name: z.string() }))
    ).toThrow("Template variables not in schema: invalidVar");
  });

  it("should throw an error for invalid variables", () => {
    const prompt = createPromptBuilder(
      "Hello, {{ name }} of age {{ age }}!",
      z.object({ name: z.string(), age: z.number() })
    );
    expect(() => prompt({ name: "John", age: "invalid" as unknown as number })).toThrow();
  });
});
