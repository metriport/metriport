import { getMedicationForm } from "../medication-form";

describe("Medication form test", () => {
  it("should parse medication form", () => {
    const medicationForm = getMedicationForm("tablet");
    expect(medicationForm).toEqual("385055001");
  });
});
