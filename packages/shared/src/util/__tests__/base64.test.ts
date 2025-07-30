import { base64ToString, stringToBase64 } from "../base64";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("base64", () => {
  describe("stringToBase64", () => {
    it("returns empty string when gets empty string", async () => {
      const original = "";
      const expected = "";
      const res = stringToBase64(original);
      expect(res).toEqual(expected);
    });

    it("encodes simple, ascii only string", async () => {
      const original = "hello world";
      const expected = "aGVsbG8gd29ybGQ=";
      const res = stringToBase64(original);
      expect(res).toEqual(expected);
    });

    it("encodes non-ascii string", async () => {
      const original = "a Ā 𐀀 文 🦄";
      const expected = "YSDEgCDwkICAIOaWhyDwn6aE";
      const res = stringToBase64(original);
      expect(res).toEqual(expected);
    });
  });

  describe("base64ToString", () => {
    it("returns empty string when gets empty string", async () => {
      const original = "";
      const expected = "";
      const res = base64ToString(original);
      expect(res).toEqual(expected);
    });

    it("encodes simple, ascii only string", async () => {
      const original = "aGVsbG8gd29ybGQ=";
      const expected = "hello world";
      const res = base64ToString(original);
      expect(res).toEqual(expected);
    });

    it("encodes non-ascii string", async () => {
      const original = "YSDEgCDwkICAIOaWhyDwn6aE";
      const expected = "a Ā 𐀀 文 🦄";
      const res = base64ToString(original);
      expect(res).toEqual(expected);
    });
  });

  describe("encode and decode together", () => {
    it("returns empty string when gets empty string", async () => {
      const original = "";
      const res = base64ToString(stringToBase64(original));
      expect(res).toEqual(original);
    });

    it("encodes simple, ascii only string", async () => {
      const original = "hello world";
      const res = base64ToString(stringToBase64(original));
      expect(res).toEqual(original);
    });

    it("encodes non-ascii string", async () => {
      const original = "a Ā 𐀀 文 🦄";
      const res = base64ToString(stringToBase64(original));
      expect(res).toEqual(original);
    });
  });
});
