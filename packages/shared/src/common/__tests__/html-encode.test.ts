import { encodeToHtml } from "../html";

describe("encodeToHtml", () => {
  it("should encode ampersand in text", () => {
    const input = "Zig & Sharko";
    const expected = "Zig &amp; Sharko";
    expect(encodeToHtml(input)).toBe(expected);
  });

  it("should encode special HTML characters", () => {
    const input = "&<>\"'";
    const expected = "&amp;&lt;&gt;&quot;&#39;";
    expect(encodeToHtml(input)).toBe(expected);
  });

  it("should not double-encode already encoded sequences", () => {
    const input = "&amp;&lt;&gt;&quot;&#39;";
    expect(encodeToHtml(input)).toBe(input);
  });

  it("should preserve UTF-8 multibyte characters", () => {
    const input = "Hello 世界 🌍";
    expect(encodeToHtml(input)).toBe(input);
  });

  it("should handle empty string", () => {
    expect(encodeToHtml("")).toBe("");
  });

  it("should handle string with no special characters", () => {
    const input = "Hello World";
    expect(encodeToHtml(input)).toBe(input);
  });
});
