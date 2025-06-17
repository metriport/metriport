import { makeTcmEncounterModel } from "./tcm-encounter";

describe("TcmEncounterModel", () => {
  it("creates a model with default values", () => {
    const model = makeTcmEncounterModel();
    expect(model.id).toBeDefined();
    expect(model.cxId).toBeDefined();
    expect(model.patientId).toBeDefined();
    expect(model.facilityName).toBeDefined();
    expect(model.latestEvent).toBe("Admitted");
    expect(model.class).toBe("Inpatient");
    expect(model.admitTime).toBeDefined();
    expect(model.dischargeTime).toBeNull();
    expect(model.clinicalInformation).toEqual({});
    expect(model.createdAt).toBeDefined();
    expect(model.updatedAt).toBeDefined();
    expect(model.version).toBe(0);
  });

  it("creates a model with custom values", () => {
    const customValues = {
      id: "test-id",
      cxId: "test-cx-id",
      patientId: "test-patient-id",
      facilityName: "Test Hospital",
      latestEvent: "Discharged" as const,
      class: "Emergency",
      admitTime: new Date("2024-01-01"),
      dischargeTime: new Date("2024-01-02"),
      clinicalInformation: { test: "data" },
    };
    const model = makeTcmEncounterModel(customValues);
    expect(model.id).toBe(customValues.id);
    expect(model.cxId).toBe(customValues.cxId);
    expect(model.patientId).toBe(customValues.patientId);
    expect(model.facilityName).toBe(customValues.facilityName);
    expect(model.latestEvent).toBe(customValues.latestEvent);
    expect(model.class).toBe(customValues.class);
    expect(model.admitTime).toEqual(customValues.admitTime);
    expect(model.dischargeTime).toEqual(customValues.dischargeTime);
    expect(model.clinicalInformation).toEqual(customValues.clinicalInformation);
  });
});
