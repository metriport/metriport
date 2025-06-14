import {
  makeNameDemographics,
  shiftMiddleNameToFirstName,
  genderMapperFromDomain,
  genderMapperToDomain,
} from "../demographics";

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

  it("should always produce a new object from shifting middle name part back and forth", () => {
    const johnDoe = makeNameDemographics({
      firstName: "John Jacob",
      lastName: "Doe",
    });
    expect(johnDoe).toEqual({
      firstName: "John",
      middleName: "Jacob",
      lastName: "Doe",
      prefix: "",
      suffix: "",
    });

    const johnJacobDoe = shiftMiddleNameToFirstName(johnDoe);
    expect(johnDoe).not.toBe(johnJacobDoe);
    expect(johnJacobDoe).toEqual({
      firstName: "John Jacob",
      lastName: "Doe",
      middleName: "",
      prefix: "",
      suffix: "",
    });
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

  it("should map domain gender to an external type", () => {
    // Includes "N" for non-binary
    type ExternalGender = "M" | "F" | "N" | "U";
    const genderMap = genderMapperFromDomain<ExternalGender>(
      {
        M: "M",
        F: "F",
        U: "U",
        O: "N",
      },
      "U"
    );
    expect(genderMap("M")).toBe("M");
    expect(genderMap("F")).toBe("F");
    expect(genderMap("O")).toBe("N");
    expect(genderMap("U")).toBe("U");
  });

  it("should map external gender to domain type", () => {
    // Includes "N" for non-binary
    type ExternalGender = "M" | "F" | "N" | "U";
    const genderMap = genderMapperToDomain<ExternalGender>({
      M: "M",
      F: "F",
      U: "U",
      N: "O",
    });
    expect(genderMap("M")).toBe("M");
    expect(genderMap("F")).toBe("F");
    expect(genderMap("N")).toBe("O");
    expect(genderMap("U")).toBe("U");
  });
});
