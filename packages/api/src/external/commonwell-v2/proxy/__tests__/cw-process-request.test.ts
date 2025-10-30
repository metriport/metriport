import { BadRequestError, uuidv7 } from "@metriport/shared";
import { Request } from "express";
import { getOrgOIDAndPatientId } from "../cw-process-request";

// Mock the Request type for testing
type MockRequest = {
  query: Record<string, string | string[] | undefined>;
};

describe("getOrgOIDAndPatientId", () => {
  function createMockRequest(query: Record<string, string | string[] | undefined>): MockRequest {
    return {
      query,
    };
  }

  describe("Basic functionality", () => {
    it("should extract orgOID and patientId from patient.identifier param", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `1.2.3.4.5|${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should extract orgOID and patientId from patient.id param", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.id": `1.2.3.4.5|${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should extract orgOID and patientId from patient param", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        patient: `1.2.3.4.5|${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should extract orgOID and patientId from subject param", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        subject: `1.2.3.4.5|${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should extract orgOID and patientId from subject.id param", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "subject.id": `1.2.3.4.5|${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should prioritize first valid param in order", () => {
      const patientId1 = uuidv7();
      const patientId2 = uuidv7();
      const patientId3 = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `1.2.3.4.5|${patientId1}`,
        "patient.id": `6.7.8.9.0|${patientId2}`,
        patient: `1.1.1.1.1|${patientId3}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId1.toLowerCase(),
      });
    });
  });

  describe("URN prefix handling", () => {
    it("should strip urn:oid: prefix from orgOID (lowercase)", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `urn:oid:1.2.3.4.5|${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should strip URN:OID: prefix from orgOID (uppercase)", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `URN:OID:1.2.3.4.5|${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should strip Urn:Oid: prefix from orgOID (mixed case)", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `Urn:Oid:1.2.3.4.5|${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should strip urn:uuid: prefix from patientId (lowercase)", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `1.2.3.4.5|urn:uuid:${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should strip URN:UUID: prefix from patientId (uppercase)", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `1.2.3.4.5|URN:UUID:${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should strip Urn:Uuid: prefix from patientId (mixed case)", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `1.2.3.4.5|Urn:Uuid:${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should strip urn:oid: prefix from patientId when present", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `1.2.3.4.5|urn:oid:${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should handle URN prefixes in middle of string", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `prefix-urn:oid:1.2.3.4.5-suffix|${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "prefix-1.2.3.4.5-suffix",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should handle both URN prefixes in same param", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `urn:oid:1.2.3.4.5|urn:uuid:${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });
  });

  describe("Case normalization", () => {
    it("should convert both orgOID and patientId to lowercase", () => {
      const patientId = uuidv7();
      const orgOID = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `${orgOID.toUpperCase()}|${patientId.toUpperCase()}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: orgOID.toLowerCase(),
        patientId: patientId.toLowerCase(),
      });
    });
  });

  describe("Whitespace handling", () => {
    it("should trim whitespace from orgOID and patientId", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `  1.2.3.4.5  |  ${patientId}  `,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should handle tabs and newlines", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `\t1.2.3.4.5\n|\t${patientId}\n`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should handle URN prefixes with whitespace", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `  urn:oid:1.2.3.4.5  |  urn:uuid:${patientId}  `,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle empty strings gracefully", () => {
      const req = createMockRequest({
        "patient.identifier": "||",
      });
      expect(() => getOrgOIDAndPatientId(req as Request)).toThrow(BadRequestError);
    });

    it("should handle only orgOID without patientId", () => {
      const req = createMockRequest({
        "patient.identifier": "1.2.3.4.5|",
      });
      expect(() => getOrgOIDAndPatientId(req as Request)).toThrow(BadRequestError);
    });

    it("should handle only patientId without orgOID", () => {
      const req = createMockRequest({
        "patient.identifier": "|patient123",
      });
      expect(() => getOrgOIDAndPatientId(req as Request)).toThrow(BadRequestError);
    });

    it("should handle whitespace-only values", () => {
      const req = createMockRequest({
        "patient.identifier": "   |   ",
      });
      expect(() => getOrgOIDAndPatientId(req as Request)).toThrow(BadRequestError);
    });

    it("should handle more than 2 pipe-separated values", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `1.2.3.4.5|${patientId}|extra|data`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should handle no pipe separator", () => {
      const req = createMockRequest({
        "patient.identifier": "1.2.3.4.5patient123",
      });
      expect(() => getOrgOIDAndPatientId(req as Request)).toThrow(BadRequestError);
    });
  });

  describe("Parameter type handling", () => {
    it("should skip string array parameters", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": [`1.2.3.4.5|${patientId}`],
        patient: `1.2.3.4.5|${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should skip non-string parameters", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": 123 as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        patient: `1.2.3.4.5|${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should skip undefined parameters", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": undefined,
        patient: `1.2.3.4.5|${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "1.2.3.4.5",
        patientId: patientId.toLowerCase(),
      });
    });
  });

  describe("Error scenarios", () => {
    it("should throw BadRequestError when no valid parameters are found", () => {
      const req = createMockRequest({});

      expect(() => getOrgOIDAndPatientId(req as Request)).toThrow(
        new BadRequestError("Could not determine Org OID and Patient ID from query params")
      );
    });

    it("should throw BadRequestError when all parameters are invalid", () => {
      const req = createMockRequest({
        "patient.identifier": "",
        "patient.id": "|",
        patient: "invalid",
        subject: "||",
        "subject.id": "   ",
      });

      expect(() => getOrgOIDAndPatientId(req as Request)).toThrow(
        new BadRequestError("Could not determine Org OID and Patient ID from query params")
      );
    });

    it("should throw BadRequestError when all parameters are non-string", () => {
      const req = createMockRequest({
        "patient.identifier": 123 as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        "patient.id": true as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        patient: null as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        subject: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        "subject.id": [] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      expect(() => getOrgOIDAndPatientId(req as Request)).toThrow(
        new BadRequestError("Could not determine Org OID and Patient ID from query params")
      );
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle CommonWell v1 format with URNs", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `urn:oid:2.16.840.1.113883.3.7204.1|urn:uuid:${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "2.16.840.1.113883.3.7204.1",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should handle CommonWell v2 format without URNs", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `2.16.840.1.113883.3.7204.1|${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "2.16.840.1.113883.3.7204.1",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should handle mixed URN formats", () => {
      const patientId = uuidv7();
      const req = createMockRequest({
        "patient.identifier": `URN:OID:2.16.840.1.113883.3.7204.1|Urn:Uuid:${patientId}`,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "2.16.840.1.113883.3.7204.1",
        patientId: patientId.toLowerCase(),
      });
    });

    it("should handle URL-encoded parameters", () => {
      const patientId = uuidv7();
      const encodedUrl = `2.16.840.1.113883.3.9621.5.1234%7C${patientId}`;
      const identifier = decodeURIComponent(encodedUrl);
      const req = createMockRequest({
        "patient.identifier": identifier,
      });

      const result = getOrgOIDAndPatientId(req as Request);

      expect(result).toEqual({
        orgOID: "2.16.840.1.113883.3.9621.5.1234",
        patientId: patientId.toLowerCase(),
      });
    });
  });
});
