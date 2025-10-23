import { formatBytes } from "../bytes";

describe("bytes", () => {
  describe("formatBytes", () => {
    it("returns '0 Bytes' for zero", () => {
      const result = formatBytes(0);
      expect(result).toBe("0 Bytes");
    });

    it("formats to MB with decimal units", () => {
      const result = formatBytes(1500000);
      expect(result).toBe("1.5 MB");
    });

    it("formats to GB with decimal units", () => {
      const result = formatBytes(1500000000);
      expect(result).toBe("1.5 GB");
    });

    it("formats to KiB with binary units", () => {
      const result = formatBytes(1536, true);
      expect(result).toBe("1.5 KiB");
    });

    it("correctly differentiates binary vs decimal for 1024 bytes", () => {
      const decimal = formatBytes(1024, false);
      const binary = formatBytes(1024, true);
      expect(decimal).toBe("1.02 KB");
      expect(binary).toBe("1 KiB");
    });
  });
});
