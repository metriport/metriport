import { faker } from "@faker-js/faker";
import { makeBaseDomain } from "../../../domain/__tests__/base-domain";
import { MedicalDataSource } from "../../../external";
import { isDataPipelineCompleted } from "../get-patient-state";
import { PatientState, Status } from "../types";

describe("isDataPipelineCompleted", () => {
  let baseState: PatientState;
  beforeEach(() => {
    baseState = {
      ...makeBaseDomain(),
      patientId: faker.string.uuid(),
      cxId: faker.string.uuid(),
      network: MedicalDataSource.EHEX,
      requestId: faker.string.uuid(),
      ttl: 123,
      createdAt: faker.date.recent().toISOString(),
    };
  });

  it("returns true when state has no pd, dq, dr, or conversion", () => {
    expect(isDataPipelineCompleted(baseState)).toBe(true);
  });

  it("returns false when pd status is processing", () => {
    const state = {
      ...baseState,
      pd: { status: Status.processing },
    } as PatientState;
    expect(isDataPipelineCompleted(state)).toBe(false);
  });

  it("returns false when dq status is processing", () => {
    const state = {
      ...baseState,
      dq: { status: Status.processing },
    } as PatientState;
    expect(isDataPipelineCompleted(state)).toBe(false);
  });

  it("returns false when dr status is processing", () => {
    const state = {
      ...baseState,
      dr: { status: Status.processing },
    } as PatientState;
    expect(isDataPipelineCompleted(state)).toBe(false);
  });

  it("returns false when conversion status is processing and isConsiderConversion is true", () => {
    const state = {
      ...baseState,
      conversion: { status: Status.processing },
    } as PatientState;
    expect(isDataPipelineCompleted(state, true)).toBe(false);
  });

  it("returns true when conversion status is processing but isConsiderConversion is false", () => {
    const state = {
      ...baseState,
      conversion: { status: Status.processing },
    } as PatientState;
    expect(isDataPipelineCompleted(state, false)).toBe(true);
  });

  it("returns true when all statuses are completed", () => {
    const state = {
      ...baseState,
      pd: { status: Status.completed },
      dq: { status: Status.completed },
      dr: { status: Status.completed },
      conversion: { status: Status.completed },
    } as PatientState;
    expect(isDataPipelineCompleted(state)).toBe(true);
  });

  it("returns true when all statuses are failed", () => {
    const state = {
      ...baseState,
      pd: { status: Status.failed },
      dq: { status: Status.failed },
      dr: { status: Status.failed },
      conversion: { status: Status.failed },
    } as PatientState;
    expect(isDataPipelineCompleted(state)).toBe(true);
  });

  it("returns false when any single step is processing", () => {
    const withPdProcessing = {
      ...baseState,
      pd: { status: Status.processing },
      dq: { status: Status.completed },
      dr: { status: Status.completed },
    } as PatientState;
    expect(isDataPipelineCompleted(withPdProcessing)).toBe(false);

    const withDqProcessing = {
      ...baseState,
      pd: { status: Status.completed },
      dq: { status: Status.processing },
      dr: { status: Status.completed },
    } as PatientState;
    expect(isDataPipelineCompleted(withDqProcessing)).toBe(false);

    const withDrProcessing = {
      ...baseState,
      pd: { status: Status.completed },
      dq: { status: Status.completed },
      dr: { status: Status.processing },
    } as PatientState;
    expect(isDataPipelineCompleted(withDrProcessing)).toBe(false);
  });
});
