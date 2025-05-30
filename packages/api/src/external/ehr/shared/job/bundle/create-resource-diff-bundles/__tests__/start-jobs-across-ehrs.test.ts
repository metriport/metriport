import { getAthenaPracticeId } from "../start-jobs-across-ehrs";

describe("getPraacticeid", () => {
  describe("getAthenaPracticeId", () => {
    it("should throw an error if ehrPatientId is an empty string", () => {
      expect(() => getAthenaPracticeId("")).toThrow();
    });

    it("should throw an error if ehrPatientId is an not valid - 1", () => {
      expect(() => getAthenaPracticeId("a-1959384")).toThrow();
    });

    it("should throw an error if ehrPatientId is an not valid - 2", () => {
      expect(() => getAthenaPracticeId("1959384.E-859173")).toThrow();
    });

    it("should work when gets valid ehrPatientId", () => {
      const res = getAthenaPracticeId("a-1959384.E-859173");
      expect(res).toEqual("a-1.Practice-1959384");
    });
  });
});
