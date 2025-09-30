import { replacePathParams } from "../replace-path-params";

describe("replaceUrlParams", () => {
  it("replaces single parameter", () => {
    const result = replacePathParams("/medical/v1/cohort/:id/patient", {
      id: "01999943-5fab-7a11-8243-7443f9fa20cd",
    });
    expect(result).toBe("/medical/v1/cohort/01999943-5fab-7a11-8243-7443f9fa20cd/patient");
  });

  it("replaces multiple parameters", () => {
    const result = replacePathParams("/api/:version/cohort/:id/patient/:patientId", {
      version: "v1",
      id: "cohort-123",
      patientId: "patient-456",
    });
    expect(result).toBe("/api/v1/cohort/cohort-123/patient/patient-456");
  });

  it("handles URL with no parameters", () => {
    const result = replacePathParams("/medical/v1/cohort/patient", {});
    expect(result).toBe("/medical/v1/cohort/patient");
  });

  it("throws error for missing parameter", () => {
    expect(() => {
      replacePathParams("/medical/v1/cohort/:id/patient", {});
    }).toThrow("Missing parameter 'id' for URL template '/medical/v1/cohort/:id/patient'");
  });

  it("ignores extra parameters", () => {
    const result = replacePathParams("/medical/v1/cohort/:id/patient", {
      id: "123",
      extra: "ignored",
    });
    expect(result).toBe("/medical/v1/cohort/123/patient");
  });
});
