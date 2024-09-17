import { processDocumentReferences } from "../resources/document-reference";
import { DocumentReference, Period } from "@medplum/fhirtypes";

export function buildDocumentReference(period?: Period): DocumentReference {
  return {
    resourceType: "DocumentReference",
    context: period ? { period } : undefined,
  } as DocumentReference;
}

describe("processDocumentReference", () => {
  it("should swap start and end dates if start is after end", () => {
    const period: Period = { start: "2023-02-01", end: "2023-01-01" };
    const documentReference = buildDocumentReference(period);
    const result = processDocumentReferences([documentReference]);

    expect(result[0]?.context?.period).toEqual({
      start: "2023-01-01T00:00:00.000Z",
      end: "2023-02-01T00:00:00.000Z",
    });
  });

  it("should not modify period if start is before end", () => {
    const period: Period = { start: "2023-01-01", end: "2023-02-01" };
    const documentReference = buildDocumentReference(period);
    const result = processDocumentReferences([documentReference]);

    expect(result[0]?.context?.period).toEqual({
      start: "2023-01-01",
      end: "2023-02-01",
    });
  });

  it("should handle period with only start date", () => {
    const period: Period = { start: "2023-01-01" };
    const documentReference = buildDocumentReference(period);
    const result = processDocumentReferences([documentReference]);

    expect(result[0]?.context?.period).toEqual(period);
  });

  it("should handle period with only end date", () => {
    const period: Period = { end: "2023-01-01" };
    const documentReference = buildDocumentReference(period);
    const result = processDocumentReferences([documentReference]);

    expect(result[0]?.context?.period).toEqual(period);
  });

  it("should return undefined period when period is invalid", () => {
    const period: Period = {};
    const documentReference = buildDocumentReference(period);
    const result = processDocumentReferences([documentReference]);

    expect(result[0]?.context?.period).toEqual({});
  });

  it("should not update the period if context is undefined", () => {
    const documentReference = buildDocumentReference();
    const result = processDocumentReferences([documentReference]);

    expect(result[0]?.context).toBeUndefined();
  });
});
