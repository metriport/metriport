import { Condition } from "@medplum/fhirtypes";
import { makeBundle } from "../../__tests__/bundle";
import { makePatient } from "../../__tests__/patient";
import { ensurePatientInBundle } from "../ensure-patient-in-bundle";

describe("ensurePatientInBundle", () => {
  it("returns same bundle and patientWasInjected false when bundle already has a Patient", () => {
    const patient = makePatient({ id: "pt-123" });
    const bundle = makeBundle({
      entries: [patient],
      type: "batch",
    });
    const result = ensurePatientInBundle(bundle, "pt-123");

    expect(result.patientWasInjected).toBe(false);
    expect(result.bundle).toBe(bundle);
    expect(result.bundle.entry?.length).toBe(1);
    expect(result.bundle.entry?.[0]?.resource).toMatchObject({
      resourceType: "Patient",
      id: "pt-123",
    });
  });

  it("injects minimal Patient and returns patientWasInjected true when bundle has no Patient", () => {
    const condition: Condition = {
      resourceType: "Condition",
      id: "cond-1",
      clinicalStatus: {
        coding: [
          { system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" },
        ],
      },
      code: { coding: [] },
      subject: { reference: "Patient/unknown" },
    };
    const bundle = makeBundle({
      entries: [condition],
      type: "batch",
    });
    const result = ensurePatientInBundle(bundle, "expected-id");

    expect(result.patientWasInjected).toBe(true);
    expect(result.bundle.entry?.length).toBe(2);
    expect(result.bundle.entry?.[0]?.resource).toMatchObject({
      resourceType: "Patient",
      id: "expected-id",
    });
    expect(result.bundle.entry?.[1]?.resource).toEqual(condition);
  });

  it("handles empty entry array", () => {
    const bundle = makeBundle({ entries: [], type: "batch" });
    const result = ensurePatientInBundle(bundle, "pt-456");

    expect(result.patientWasInjected).toBe(true);
    expect(result.bundle.entry?.length).toBe(1);
    expect(result.bundle.entry?.[0]?.resource).toMatchObject({
      resourceType: "Patient",
      id: "pt-456",
    });
  });

  it("handles missing entry and does not mutate input bundle", () => {
    const bundle: ReturnType<typeof makeBundle> = {
      resourceType: "Bundle",
      type: "batch",
    };
    const result = ensurePatientInBundle(bundle, "pt-789");

    expect(result.patientWasInjected).toBe(true);
    expect(result.bundle.entry?.length).toBe(1);
    expect(result.bundle.entry?.[0]?.resource).toMatchObject({
      resourceType: "Patient",
      id: "pt-789",
    });
    expect(result.bundle).not.toBe(bundle);
    expect(bundle.entry).toBeUndefined();
  });

  it("does not mutate input bundle when injecting Patient", () => {
    const condition: Condition = {
      resourceType: "Condition",
      id: "c1",
      clinicalStatus: {
        coding: [
          { system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" },
        ],
      },
      code: { coding: [] },
      subject: { reference: "Patient/unknown" },
    };
    const bundle = makeBundle({ entries: [condition], type: "batch" });
    const originalEntryLength = bundle.entry?.length ?? 0;

    const result = ensurePatientInBundle(bundle, "injected-id");

    expect(result.bundle).not.toBe(bundle);
    expect(result.bundle.entry).not.toBe(bundle.entry);
    expect(bundle.entry?.length).toBe(originalEntryLength);
  });
});
