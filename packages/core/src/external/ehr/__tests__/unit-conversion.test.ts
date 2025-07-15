import { convertCodeAndValue } from "../unit-converion";

const loincCodeMap = new Map<string, { codeKey: string; targetUnits: string }>();
loincCodeMap.set("8310-5", { codeKey: "VITALS.TEMPERATURE", targetUnits: "degf" });
loincCodeMap.set("8867-4", { codeKey: "VITALS.HEARTRATE", targetUnits: "bpm" });
loincCodeMap.set("9279-1", { codeKey: "VITALS.RESPIRATIONRATE", targetUnits: "bpm" });
loincCodeMap.set("2708-6", { codeKey: "VITALS.INHALEDO2CONCENTRATION", targetUnits: "%" });
loincCodeMap.set("59408-5", { codeKey: "VITALS.INHALEDO2CONCENTRATION", targetUnits: "%" });
loincCodeMap.set("8462-4", { codeKey: "VITALS.BLOODPRESSURE.DIASTOLIC", targetUnits: "mmHg" });
loincCodeMap.set("8480-6", { codeKey: "VITALS.BLOODPRESSURE.SYSTOLIC", targetUnits: "mmHg" });
loincCodeMap.set("85354-9", { codeKey: "VITALS.BLOODPRESSURE", targetUnits: "mmHg" });
loincCodeMap.set("29463-7", { codeKey: "VITALS.WEIGHT", targetUnits: "g" });
loincCodeMap.set("29463-7-kg", { codeKey: "VITALS.WEIGHT", targetUnits: "kg" });
loincCodeMap.set("29463-7-lb_av", { codeKey: "VITALS.WEIGHT", targetUnits: "lb_av" });
loincCodeMap.set("8302-2", { codeKey: "VITALS.HEIGHT", targetUnits: "cm" });
loincCodeMap.set("8302-2-in_i", { codeKey: "VITALS.HEIGHT", targetUnits: "in_i" });
loincCodeMap.set("56086-2", { codeKey: "VITALS.WAISTCIRCUMFERENCE", targetUnits: "cm" });
loincCodeMap.set("39156-5", { codeKey: "VITALS.BMI", targetUnits: "kg/m2" });

describe("convertCodeAndValue", () => {
  it("returns undefined for unknown loincCode", () => {
    const result = convertCodeAndValue("unknown", loincCodeMap, 100, "g");
    expect(result).toBeUndefined();
  });

  describe("weight conversions to g", () => {
    it("converts kg to g", () => {
      const result = convertCodeAndValue("29463-7", loincCodeMap, 2, "kg");
      expect(result).toEqual({ units: "g", codeKey: "VITALS.WEIGHT", value: 2000 });
    });

    it("converts pounds to g", () => {
      const result = convertCodeAndValue("29463-7", loincCodeMap, 2, "pounds");
      expect(result).toEqual({ units: "g", codeKey: "VITALS.WEIGHT", value: 907.184 });
    });

    it("returns value unchanged if already in g", () => {
      const result = convertCodeAndValue("29463-7", loincCodeMap, 5000, "g");
      expect(result).toEqual({ units: "g", codeKey: "VITALS.WEIGHT", value: 5000 });
    });

    it("handles string input for value", () => {
      const result = convertCodeAndValue("29463-7", loincCodeMap, "2", "kg");
      expect(result).toEqual({ units: "g", codeKey: "VITALS.WEIGHT", value: 2000 });
    });
  });

  describe("weight conversions to kg", () => {
    it("converts g to kg", () => {
      const result = convertCodeAndValue("29463-7-kg", loincCodeMap, 2000, "g");
      expect(result).toEqual({ units: "kg", codeKey: "VITALS.WEIGHT", value: 2 });
    });

    it("converts lb_av to kg", () => {
      const result = convertCodeAndValue("29463-7-kg", loincCodeMap, 2, "lb_av");
      expect(result).toEqual({ units: "kg", codeKey: "VITALS.WEIGHT", value: 0.907184 });
    });

    it("returns value unchanged if already in kg", () => {
      const result = convertCodeAndValue("29463-7-kg", loincCodeMap, 5, "kg");
      expect(result).toEqual({ units: "kg", codeKey: "VITALS.WEIGHT", value: 5 });
    });

    it("handles string input for value", () => {
      const result = convertCodeAndValue("29463-7-kg", loincCodeMap, "2000", "g");
      expect(result).toEqual({ units: "kg", codeKey: "VITALS.WEIGHT", value: 2 });
    });
  });

  describe("weight conversions to lb_av", () => {
    it("converts g to lb_av", () => {
      const result = convertCodeAndValue("29463-7-lb_av", loincCodeMap, 1000, "g");
      expect(result).toEqual({ units: "lb_av", codeKey: "VITALS.WEIGHT", value: 2.20462 });
    });

    it("converts kg to lb_av", () => {
      const result = convertCodeAndValue("29463-7-lb_av", loincCodeMap, 2, "kg");
      expect(result).toEqual({ units: "lb_av", codeKey: "VITALS.WEIGHT", value: 4.40924 });
    });

    it("returns value unchanged if already in lb_av", () => {
      const result = convertCodeAndValue("29463-7-lb_av", loincCodeMap, 3, "lb_av");
      expect(result).toEqual({ units: "lb_av", codeKey: "VITALS.WEIGHT", value: 3 });
    });

    it("handles string input for value", () => {
      const result = convertCodeAndValue("29463-7-lb_av", loincCodeMap, "1000", "g");
      expect(result).toEqual({ units: "lb_av", codeKey: "VITALS.WEIGHT", value: 2.20462 });
    });
  });

  describe("height conversions to cm", () => {
    it("converts inches to cm", () => {
      const result = convertCodeAndValue("8302-2", loincCodeMap, 10, "in_i");
      expect(result).toEqual({ units: "cm", codeKey: "VITALS.HEIGHT", value: 25.399986284007404 });
    });

    it("returns value unchanged if already in cm", () => {
      const result = convertCodeAndValue("8302-2", loincCodeMap, 180, "cm");
      expect(result).toEqual({ units: "cm", codeKey: "VITALS.HEIGHT", value: 180 });
    });

    it("handles string input for value", () => {
      const result = convertCodeAndValue("8302-2", loincCodeMap, "10", "in_i");
      expect(result).toEqual({ units: "cm", codeKey: "VITALS.HEIGHT", value: 25.399986284007404 });
    });
  });

  describe("height conversions to in_i", () => {
    it("converts cm to in_i", () => {
      const result = convertCodeAndValue("8302-2-in_i", loincCodeMap, 25.4, "cm");
      expect(result).toEqual({ units: "in_i", codeKey: "VITALS.HEIGHT", value: 10.0000054 });
    });

    it("returns value unchanged if already in in_i", () => {
      const result = convertCodeAndValue("8302-2-in_i", loincCodeMap, 10, "in_i");
      expect(result).toEqual({ units: "in_i", codeKey: "VITALS.HEIGHT", value: 10 });
    });

    it("handles string input for value", () => {
      const result = convertCodeAndValue("8302-2-in_i", loincCodeMap, "25.4", "cm");
      expect(result).toEqual({ units: "in_i", codeKey: "VITALS.HEIGHT", value: 10.0000054 });
    });
  });

  describe("temperature conversions", () => {
    it("converts Celsius to Fahrenheit", () => {
      const result = convertCodeAndValue("8310-5", loincCodeMap, 0, "c");
      expect(result).toEqual({ units: "degf", codeKey: "VITALS.TEMPERATURE", value: 32 });
    });

    it("returns value unchanged if already in Fahrenheit", () => {
      const result = convertCodeAndValue("8310-5", loincCodeMap, 98.6, "degf");
      expect(result).toEqual({ units: "degf", codeKey: "VITALS.TEMPERATURE", value: 98.6 });
    });

    it("handles string input for value", () => {
      const result = convertCodeAndValue("8310-5", loincCodeMap, "0", "celsius");
      expect(result).toEqual({ units: "degf", codeKey: "VITALS.TEMPERATURE", value: 32 });
    });
  });

  describe("BMI conversions", () => {
    it("returns value unchanged if already in kg_m2", () => {
      const result = convertCodeAndValue("39156-5", loincCodeMap, 30, "kg_m2");
      expect(result).toEqual({ units: "kg/m2", codeKey: "VITALS.BMI", value: 30 });
    });

    it("returns value unchanged if already in kg/m2", () => {
      const result = convertCodeAndValue("39156-5", loincCodeMap, 25, "kg/m2");
      expect(result).toEqual({ units: "kg/m2", codeKey: "VITALS.BMI", value: 25 });
    });

    it("handles string input for value", () => {
      const result = convertCodeAndValue("39156-5", loincCodeMap, "25", "kg_m2");
      expect(result).toEqual({ units: "kg/m2", codeKey: "VITALS.BMI", value: 25 });
    });
  });

  describe("error handling", () => {
    it("throws BadRequestError for unknown units", () => {
      expect(() => convertCodeAndValue("29463-7", loincCodeMap, 100, "stone")).toThrowError(
        "Unknown units"
      );
    });
  });

  describe("other units", () => {
    it("returns value unchanged for matching units (bpm)", () => {
      const result = convertCodeAndValue("8867-4", loincCodeMap, 70, "bpm");
      expect(result).toEqual({ units: "bpm", codeKey: "VITALS.HEARTRATE", value: 70 });
    });

    it("returns value unchanged for matching units (%)", () => {
      const result = convertCodeAndValue("2708-6", loincCodeMap, 95, "%");
      expect(result).toEqual({ units: "%", codeKey: "VITALS.INHALEDO2CONCENTRATION", value: 95 });
    });

    it("returns value unchanged for matching units (mmHg)", () => {
      const result = convertCodeAndValue("8462-4", loincCodeMap, 120, "mmHg");
      expect(result).toEqual({
        units: "mmHg",
        codeKey: "VITALS.BLOODPRESSURE.DIASTOLIC",
        value: 120,
      });
    });

    it("returns value unchanged for matching units (mmHg) with string input", () => {
      const result = convertCodeAndValue("85354-9", loincCodeMap, "120/80 mmHg", "mmHg");
      expect(result).toEqual({
        units: "mmHg",
        codeKey: "VITALS.BLOODPRESSURE",
        value: "120/80 mmHg",
      });
    });

    it("returns value unchanged for matching units (mmHg) with string input and extra spaces", () => {
      const result = convertCodeAndValue("85354-9", loincCodeMap, " 120/80 mmHg ", "mmHg");
      expect(result).toEqual({
        units: "mmHg",
        codeKey: "VITALS.BLOODPRESSURE",
        value: "120/80 mmHg",
      });
    });
  });
});
