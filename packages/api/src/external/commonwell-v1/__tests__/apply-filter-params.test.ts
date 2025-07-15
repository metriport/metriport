import { faker } from "@faker-js/faker";
import { DocumentReference } from "@medplum/fhirtypes";
import { queryToSearchParams } from "../../../routes/helpers/query";
import { applyFilterParams } from "../proxy/cw-process-request";

let docRef: DocumentReference;

beforeEach(() => {
  docRef = {
    resourceType: "DocumentReference",
    id: faker.string.uuid(),
  };
});

describe("applyFilterParams", () => {
  it("includes doc ref if date is equal", () => {
    const queryParams = {
      date: "eq2024-01-01",
    };
    docRef.date = "2024-01-01";
    const params = queryToSearchParams(queryParams);
    const result = applyFilterParams([docRef], params);
    expect(result.length).toBe(1);
  });

  it("does not include doc ref if date is not equal", () => {
    const queryParams = {
      date: "ne2024-01-01",
    };
    docRef.date = "2024-01-01";
    const params = queryToSearchParams(queryParams);
    const result = applyFilterParams([docRef], params);
    expect(result.length).toBe(0);
  });

  it("includes doc ref if date is greater than", () => {
    const queryParams = {
      date: "gt2024-01-01",
    };
    docRef.date = "2024-01-02";
    const params = queryToSearchParams(queryParams);
    const result = applyFilterParams([docRef], params);
    expect(result.length).toBe(1);
  });

  it("does not include doc ref if date is less than", () => {
    const queryParams = {
      date: "lt2024-01-01",
    };
    docRef.date = "2024-01-02";
    const params = queryToSearchParams(queryParams);
    const result = applyFilterParams([docRef], params);
    expect(result.length).toBe(0);
  });

  it("includes doc ref if date is greater than or equal", () => {
    const queryParams = {
      date: "ge2024-01-01",
    };
    docRef.date = "2024-01-01";
    const params = queryToSearchParams(queryParams);
    const result = applyFilterParams([docRef], params);
    expect(result.length).toBe(1);
  });

  it("includes doc ref if date is less than or equal", () => {
    const queryParams = {
      date: "le2024-01-01",
    };
    docRef.date = "2024-01-01";
    const params = queryToSearchParams(queryParams);
    const result = applyFilterParams([docRef], params);
    expect(result.length).toBe(1);
  });

  it("includes doc ref if status matches", () => {
    const queryParams = {
      status: "current",
    };
    docRef.status = "current";
    const params = queryToSearchParams(queryParams);
    const result = applyFilterParams([docRef], params);
    expect(result.length).toBe(1);
  });

  it("does not include doc ref if status does not match", () => {
    const queryParams = {
      status: "current",
    };
    docRef.status = "entered-in-error";
    const params = queryToSearchParams(queryParams);
    const result = applyFilterParams([docRef], params);
    expect(result.length).toBe(0);
  });

  it("limits the results based on count", () => {
    const queryParams = {
      count: "1",
    };
    const params = queryToSearchParams(queryParams);
    const docRefs = [
      { ...docRef, id: faker.string.uuid(), date: "2024-01-01" },
      { ...docRef, id: faker.string.uuid(), date: "2024-01-02" },
    ];
    const result = applyFilterParams(docRefs, params);
    expect(result.length).toBe(1);
  });

  it("does not limit results if count is higher than docRefs length", () => {
    const queryParams = {
      count: "5",
    };
    const params = queryToSearchParams(queryParams);
    const docRefs = [
      { ...docRef, id: faker.string.uuid(), date: "2024-01-01" },
      { ...docRef, id: faker.string.uuid(), date: "2024-01-02" },
    ];
    const result = applyFilterParams(docRefs, params);
    expect(result.length).toBe(2);
  });
});
