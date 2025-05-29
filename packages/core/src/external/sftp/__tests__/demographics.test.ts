import {
  makeNameDemographics,
  shiftMiddleNameToFirstName,
  makeGenderDemographics,
} from "../../surescripts/shared";

describe("makeNameDemographics", () => {
  it("should parse simple names", () => {
    const johnDoe = makeNameDemographics({
      firstName: "John",
      lastName: "Doe",
    });
    expect(johnDoe).toEqual({
      lastName: "Doe",
      firstName: "John",
      middleName: "",
      prefix: "",
      suffix: "",
    });
  });

  it("should parse middle names", () => {
    const johnDoe = makeNameDemographics({
      firstName: "John Jacob",
      lastName: "Doe",
    });
    expect(johnDoe).toEqual({
      lastName: "Doe",
      firstName: "John",
      middleName: "Jacob",
      prefix: "",
      suffix: "",
    });
  });

  it("should shift middle name parts to first name", () => {
    let johnDoe = makeNameDemographics({
      firstName: "John Jacob",
      lastName: "Doe",
    });
    johnDoe = shiftMiddleNameToFirstName(johnDoe);
    expect(johnDoe).toEqual({
      lastName: "Doe",
      firstName: "John Jacob",
      middleName: "",
      prefix: "",
      suffix: "",
    });
  });

  it("should produce a new object from shifting middle name parts to first name", () => {
    const johnDoe = makeNameDemographics({
      firstName: "John Jacob",
      lastName: "Doe",
    });
    const johnJacobDoe = shiftMiddleNameToFirstName(johnDoe);
    expect(johnDoe).not.toBe(johnJacobDoe);
  });

  it("should parse prefixes and suffixes", () => {
    const mrJohnKennedy = makeNameDemographics({
      firstName: "Mr. John F",
      lastName: "Kennedy Jr.",
    });
    expect(mrJohnKennedy).toEqual({
      firstName: "John",
      prefix: "Mr.",
      lastName: "Kennedy",
      middleName: "F",
      suffix: "Jr.",
    });
  });

  it("should parse suffixes", () => {
    const juniorSuffix = makeNameDemographics({
      firstName: "Alvin Cornelius",
      lastName: "Johnson III",
    });

    expect(juniorSuffix).toEqual({
      firstName: "Alvin",
      prefix: "",
      lastName: "Johnson",
      middleName: "Cornelius",
      suffix: "III",
    });
  });

  it("should parse prefixes", () => {
    const mrJohnKennedy = makeNameDemographics({
      firstName: "Mr. John F",
      lastName: "Kennedy",
    });
    expect(mrJohnKennedy).toEqual({
      firstName: "John",
      prefix: "Mr.",
      lastName: "Kennedy",
      middleName: "F",
      suffix: "",
    });
  });

  it("should assign unknown gender", () => {
    expect(makeGenderDemographics(undefined)).toBe("U");
  });

  it("should assign male gender", () => {
    expect(makeGenderDemographics("M")).toBe("M");
  });

  it("should assign female gender", () => {
    expect(makeGenderDemographics("F")).toBe("F");
  });

  it("should handle non-binary and unknown gender", () => {
    expect(makeGenderDemographics("O")).toBe("N");
    expect(makeGenderDemographics("U")).toBe("U");
  });
});
