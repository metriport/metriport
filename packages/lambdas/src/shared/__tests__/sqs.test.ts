import { toMessageGroupId } from "../sqs";
import { faker } from "@faker-js/faker";

describe("sqs", () => {
  describe("toMessageGroupId", () => {
    it("returns the input when it only contains letters, numbers, and period", async () => {
      const value = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.";
      const res = toMessageGroupId(value);
      expect(res).toBeTruthy();
      expect(res).toEqual(value);
    });

    it("wraps the input at 128 chars", async () => {
      const value = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.";
      const input = value + value + value;
      const expected = input.slice(0, 128);
      const res = toMessageGroupId(value + value + value);
      expect(res).toBeTruthy();
      expect(res).toEqual(expected);
    });

    it("removes invalid chars", async () => {
      const res = toMessageGroupId("abc_-+=?,<>\\/|{}[]()!@#$%^&*~`");
      expect(res).toBeTruthy();
      expect(res).toEqual("abc");
    });

    it("returns empty when it gets empty", async () => {
      const value = "";
      const res = toMessageGroupId(value);
      expect(res).toEqual(value);
    });

    it("prioritizes left part of value by default", async () => {
      const value = faker.string.alpha({ length: { min: 130, max: 130 } });
      const res = toMessageGroupId(value);
      expect(res).toEqual(value.slice(0, 128));
    });

    it("prioritizes left part of value when asked to", async () => {
      const value = faker.string.alpha({ length: { min: 130, max: 130 } });
      const res = toMessageGroupId(value, "left-to-right");
      expect(res).toEqual(value.slice(0, 128));
    });

    it("prioritizes right part of value when asked to", async () => {
      const value = faker.string.alpha({ length: { min: 130, max: 130 } });
      const res = toMessageGroupId(value, "right-to-left");
      expect(res).toEqual(value.slice(0, -128));
    });
  });
});
