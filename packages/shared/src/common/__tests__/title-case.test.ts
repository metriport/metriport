import { toTitleCase } from "../title-case";

describe("toTitleCase", () => {
  it("returns empty string when input is empty", () => {
    const input = "";
    const result = toTitleCase(input);
    expect(result).toBe("");
  });

  it("capitalizes first letter of single word", () => {
    const input = "hello";
    const result = toTitleCase(input);
    expect(result).toBe("Hello");
  });

  it("capitalizes first letter of each word with spaces", () => {
    const input = "hello world";
    const result = toTitleCase(input);
    expect(result).toBe("Hello World");
  });

  it("capitalizes first letter of each word with spaces and punctuation", () => {
    const input = "hello world, d'angelo";
    const result = toTitleCase(input);
    expect(result).toBe("Hello World, D'Angelo");
  });

  it("does not capitalize first letter of each word with dashes", () => {
    const input = "hello-world";
    const result = toTitleCase(input);
    expect(result).toBe("Hello-world");
  });

  it("does not capitalize first letter of each word with underscores", () => {
    const input = "hello_world";
    const result = toTitleCase(input);
    expect(result).toBe("Hello_world");
  });

  it("handles camelCase input", () => {
    const input = "helloWorld";
    const result = toTitleCase(input);
    expect(result).toBe("Helloworld");
  });

  it("handles PascalCase input", () => {
    const input = "HelloWorld";
    const result = toTitleCase(input);
    expect(result).toBe("Helloworld");
  });

  it("trims whitespace from input", () => {
    const input = "  hello  world  ";
    const result = toTitleCase(input);
    expect(result).toBe("Hello World");
  });

  it("converts input to lowercase before processing", () => {
    const input = "HELLO WORLD";
    const result = toTitleCase(input);
    expect(result).toBe("Hello World");
  });

  it("handles words with numbers", () => {
    const input = "hello123 world456";
    const result = toTitleCase(input);
    expect(result).toBe("Hello123 World456");
  });

  it("handles words that start with numbers", () => {
    const input = "1st 2nd 3rd";
    const result = toTitleCase(input);
    expect(result).toBe("1st 2nd 3rd");
  });

  it("handles alphanumeric camelCase", () => {
    const input = "user123Name";
    const result = toTitleCase(input);
    expect(result).toBe("User123name");
  });
});
