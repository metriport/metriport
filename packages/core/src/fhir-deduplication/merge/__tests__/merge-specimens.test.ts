import { CodeableConcept, Identifier, Specimen } from "@medplum/fhirtypes";
import { buildSpecimenMergeFunction } from "../resource/specimen";

function makeSpecimen({
  id,
  lastUpdated,
  code,
  source,
  identifier,
}: {
  id: string;
  lastUpdated: string;
  code: CodeableConcept;
  source?: string;
  identifier?: Identifier[];
}): Specimen {
  return {
    resourceType: "Specimen",
    id,
    meta: {
      lastUpdated,
      ...(source ? { source } : {}),
    },
    ...(code ? { code } : {}),
    ...(identifier ? { identifier } : {}),
  };
}

describe("Specimen merge test", () => {
  const mergeSpecimens = buildSpecimenMergeFunction();

  it("should merge specimens", () => {
    const specimen1 = makeSpecimen({
      id: "1",
      lastUpdated: "2024-01-01T00:00:00.000Z",
      code: {
        text: "Specimen 1",
        coding: [{ code: "a", system: "b" }],
      },
    });
    const specimen2 = makeSpecimen({
      id: "2",
      lastUpdated: "2024-01-02T00:00:00.000Z",
      code: {
        text: "Specimen 2",
        coding: [{ code: "c", system: "d" }],
      },
      identifier: [{ system: "e", value: "f" }],
    });

    const result = mergeSpecimens([specimen1, specimen2]);
    expect(result).toEqual(specimen2);

    const anotherResult = mergeSpecimens([specimen2, specimen1]);
    expect(anotherResult).toEqual(specimen2);
  });
});
