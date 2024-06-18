import { isValidUuid } from "../validate-uuid";
// import { uuidv7 } from "@metriport/core/util/uuid-v7";

const validUuid = "01902d03-8560-78ef-9566-f0b133de4a65";
const allNumberValidUuid = "01902203-8560-7821-9566-202133224111";
const idWithInvalidLength = "01902d03-8560-78ef-9566-f0b133de4a65111";
const idWithUnexpectedCharacters = "01902d03-8560-78ef-9566-f0b133de4XYZ";

describe("isValidUuid", () => {
  it("should recognize valid uuids as such", () => {
    expect(isValidUuid(validUuid)).toBe(true);
    expect(isValidUuid(allNumberValidUuid)).toBe(true);
  });

  it("should recognize invalid uuids as such", () => {
    expect(isValidUuid(idWithInvalidLength)).toBe(false);
    expect(isValidUuid(idWithUnexpectedCharacters)).toBe(false);
  });

  // it("should validate all the uuids created with uuidv7()", () => {
  //   for (let i = 0; i < 1000; i++) {
  //     const id = uuidv7();
  //     expect(isValidUuid(id)).toBe(true);
  //   }
  // });
});
