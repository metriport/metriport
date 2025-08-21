/* eslint-disable @typescript-eslint/no-empty-function */
import { decodeCwPatientId } from "../util";

describe("util", () => {
  describe("decodeCwPatientId", () => {
    it("returns decoded patient id with all components when valid", async () => {
      const res = decodeCwPatientId("601^^^&2.16.840.1.113883.3.2611.9.99.101.1&ISO");
      expect(res).toBeTruthy();
      expect(res.value).toBe("601");
      expect(res.assignAuthority).toBe("2.16.840.1.113883.3.2611.9.99.101.1");
      expect(res.assignAuthorityType).toBe("ISO");
    });

    it("returns value and assignAuthority when assignAuthType is not provided", async () => {
      const res = decodeCwPatientId("601^^^&2.16.840.1.113883.3.2611.9.99.101.1");
      expect(res).toBeTruthy();
      expect(res.value).toBe("601");
      expect(res.assignAuthority).toBe("2.16.840.1.113883.3.2611.9.99.101.1");
      expect(res.assignAuthorityType).toBeUndefined();
    });

    it("doesnt return value when assignAuthority is not provided", async () => {
      const res = decodeCwPatientId("601^^^&&ISO");
      expect(res).toBeTruthy();
      expect(res.value).toBeUndefined();
      expect(res.assignAuthority).toBeUndefined();
      expect(res.assignAuthorityType).toBeUndefined();
    });

    it("doesnt return value when assignAuthority and assignAuthType are not provided", async () => {
      const res = decodeCwPatientId("601^^^");
      expect(res).toBeTruthy();
      expect(res.value).toBeUndefined();
      expect(res.assignAuthority).toBeUndefined();
      expect(res.assignAuthorityType).toBeUndefined();
    });

    it("doesnt return assigningAuthority when value is not provided", async () => {
      const res = decodeCwPatientId("^^^&2.16.840.1.113883.3.2611.9.99.101.1&ISO");
      expect(res).toBeTruthy();
      expect(res.value).toBeUndefined();
      expect(res.assignAuthority).toBeUndefined();
      expect(res.assignAuthorityType).toBeUndefined();
    });

    it("returns emtpy object when value is empty string", async () => {
      const res = decodeCwPatientId("");
      expect(res).toBeTruthy();
      expect(res.value).toBeUndefined();
      expect(res.assignAuthority).toBeUndefined();
      expect(res.assignAuthorityType).toBeUndefined();
    });
  });
});
