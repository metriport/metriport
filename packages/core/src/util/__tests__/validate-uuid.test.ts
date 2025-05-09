import { isValidUuid, uuidv4, uuidv7 } from "../uuid-v7";

const validUuid = "01902d03-8560-78ef-9566-f0b133de4a65";
const allNumberValidUuid = "01902203-8560-7821-9566-202133224111";
const idWithInvalidLength = "01902d03-8560-78ef-9566-f0b133de4a65111";
const idWithUnexpectedCharacters = "01902d03-8560-78ef-9566-f0b133de4XYZ";

describe("isValidUuid", () => {
  it("should return false on empty string", () => {
    expect(isValidUuid("")).toBe(false);
  });

  it("should recognize valid uuids as such", () => {
    expect(isValidUuid(validUuid)).toBe(true);
    expect(isValidUuid(allNumberValidUuid)).toBe(true);
  });

  it("should recognize invalid uuids as such", () => {
    expect(isValidUuid(idWithInvalidLength)).toBe(false);
    expect(isValidUuid(idWithUnexpectedCharacters)).toBe(false);
  });

  describe("uuidv7", () => {
    for (let i = 0; i < 10; i++) {
      const id = uuidv7();
      it("should validate uuidv7 " + id, () => {
        expect(isValidUuid(id)).toBe(true);
      });
    }
  });

  describe("uuidv4", () => {
    for (let i = 0; i < 10; i++) {
      const id = uuidv4();
      it("should validate uuidv4 " + id, () => {
        expect(isValidUuid(id)).toBe(true);
      });
    }
  });
});
