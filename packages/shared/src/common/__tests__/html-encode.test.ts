import { encodeToHtml } from "../html";

describe("encodeToHtml", () => {
  it("should encode ampersand in text", () => {
    const input = "Expert Opinion & Recommendations";
    const expected = "Expert Opinion &amp; Recommendations";
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

  it("should handle mixed content correctly", () => {
    const input = "Hello <world> & 'quotes' \"double quotes\"";
    const expected = "Hello &lt;world&gt; &amp; &#39;quotes&#39; &quot;double quotes&quot;";
    expect(encodeToHtml(input)).toBe(expected);
  });

  it("should handle empty string", () => {
    expect(encodeToHtml("")).toBe("");
  });

  it("should handle string with no special characters", () => {
    const input = "Hello World";
    expect(encodeToHtml(input)).toBe(input);
  });

  it("should handle string with only ampersands", () => {
    const input = "&&&";
    const expected = "&amp;&amp;&amp;";
    expect(encodeToHtml(input)).toBe(expected);
  });

  it("should handle string with only angle brackets", () => {
    const input = "<<<>>>";
    const expected = "&lt;&lt;&lt;&gt;&gt;&gt;";
    expect(encodeToHtml(input)).toBe(expected);
  });
});
