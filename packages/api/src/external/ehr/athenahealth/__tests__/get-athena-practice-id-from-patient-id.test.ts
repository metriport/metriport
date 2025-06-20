import { getAthenaPracticeIdFromPatientId } from "../shared";

describe("getAthenaPracticeIdFromPatientId", () => {
  it("should throw an error if ehrPatientId is an empty string", () => {
    expect(() => getAthenaPracticeIdFromPatientId("")).toThrow();
  });

  it("should throw an error if ehrPatientId is an not valid - 1", () => {
    expect(() => getAthenaPracticeIdFromPatientId("a-1959384")).toThrow();
  });

  it("should throw an error if ehrPatientId is an not valid - 2", () => {
    expect(() => getAthenaPracticeIdFromPatientId("1959384.E-859173")).toThrow();
  });

  it("should work when gets valid ehrPatientId", () => {
    const res = getAthenaPracticeIdFromPatientId("a-1959384.E-859173");
    expect(res).toEqual("a-1.Practice-1959384");
  });
});
