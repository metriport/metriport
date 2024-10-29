import { USState } from "@metriport/shared";
import { Patient, PatientDemoData } from "@metriport/core/domain/patient";
import { LinkDemographics, LinkGender } from "@metriport/core/domain/patient-demographics";
import {
  normalizeAndStringfyAddress,
  normalizeAndStringifyDriversLicense,
  normalizeAndStringifyNames,
  checkDemoMatch,
  createAugmentedPatient,
  linkHasNewDemographics,
  patientToNormalizedCoreDemographics,
} from "../patient-demographics";
import { consolidatedLinkDemographics, coreDemographics, patient } from "./demographics.const";

describe("normalization", () => {
  describe("normalizeAndStringifyNames", () => {
    const name = { firstName: "john", lastName: "smith" };
    const expectedNameString = JSON.stringify(name, Object.keys(name).sort());
    const names = [
      name,
      { firstName: " john ", lastName: " smith " },
      { firstName: "John", lastName: "Smith" },
    ];
    for (const name of names) {
      it(`valid - ${JSON.stringify(name)}`, () => {
        const result = normalizeAndStringifyNames(name);
        expect(result).toBe(expectedNameString);
      });
    }

    it("invalid - no first name", () => {
      const result = normalizeAndStringifyNames({ firstName: "", lastName: "smith" });
      expect(result).toBeUndefined();
    });
    it("invalid - no first name w/ empty space", () => {
      const result = normalizeAndStringifyNames({ firstName: " ", lastName: "smith" });
      expect(result).toBeUndefined();
    });
    it("invalid - no last name", () => {
      const result = normalizeAndStringifyNames({ firstName: "john", lastName: "" });
      expect(result).toBeUndefined();
    });
    it("invalid - no last name w/ empty space", () => {
      const result = normalizeAndStringifyNames({ firstName: "john", lastName: " " });
      expect(result).toBeUndefined();
    });
    it("invalid - no first name or last name", () => {
      const result = normalizeAndStringifyNames({ firstName: "", lastName: "" });
      expect(result).toBeUndefined();
    });
    it("invalid - no first name or last name w/ empty space", () => {
      const result = normalizeAndStringifyNames({ firstName: " ", lastName: " " });
      expect(result).toBeUndefined();
    });
  });

  describe("normalizeAndStringfyAddress", () => {
    const address = {
      line: ["1 mordhaus st rd ave dr", "apt 1a", "2"],
      city: "mordhaus",
      state: "ny",
      zip: "66666",
      country: "usa",
    };
    const expectedAddressString = JSON.stringify(address, Object.keys(address).sort());
    const addresses = [
      address,
      {
        line: [" 1 mordhaus st rd ave dr ", " apt 1a ", " 2 "],
        city: " mordhaus ",
        state: " ny ",
        zip: " 66666 ",
        country: " usa ",
      },
      {
        line: ["1 Mordhaus St Rd Ave Dr", "Apt 1A", "2"],
        city: "Mordhaus",
        state: "NY",
        zip: "66666",
        country: "USA",
      },
      {
        line: ["1 Mordhaus Street Road Avenue Drive", "Apt 1A", "2"],
        city: "mordhaus",
        state: "ny",
        zip: "66666",
        country: "usa",
      },
    ];
    for (const address of addresses) {
      it(`valid - ${JSON.stringify(address)}`, () => {
        const result = normalizeAndStringfyAddress(address);
        expect(result).toBe(expectedAddressString);
      });
    }

    it("invalid - no line", () => {
      const result = normalizeAndStringfyAddress({
        line: undefined,
        city: "mordhaus",
        state: "ny",
        zip: "66666",
        country: "usa",
      });
      expect(result).toBeUndefined();
    });
    it("invalid - empty line", () => {
      const result = normalizeAndStringfyAddress({
        line: [],
        city: "mordhaus",
        state: "ny",
        zip: "66666",
        country: "usa",
      });
      expect(result).toBeUndefined();
    });
    it("invalid - empty line after normalization", () => {
      const result = normalizeAndStringfyAddress({
        line: [""],
        city: "mordhaus",
        state: "ny",
        zip: "66666",
        country: "usa",
      });
      expect(result).toBeUndefined();
    });
    it("invalid - empty line after normalization w/ empty space", () => {
      const result = normalizeAndStringfyAddress({
        line: [" "],
        city: "mordhaus",
        state: "ny",
        zip: "66666",
        country: "usa",
      });
      expect(result).toBeUndefined();
    });
    it("invalid - no city", () => {
      const result = normalizeAndStringfyAddress({
        line: ["1 mordhaus st rd ave dr", "apt 1a", "2"],
        city: undefined,
        state: "ny",
        zip: "66666",
        country: "usa",
      });
      expect(result).toBeUndefined();
    });
    it("invalid - empty city", () => {
      const result = normalizeAndStringfyAddress({
        line: ["1 mordhaus st rd ave dr", "apt 1a", "2"],
        city: "",
        state: "ny",
        zip: "66666",
        country: "usa",
      });
      expect(result).toBeUndefined();
    });
    it("invalid - empty city w/ empty space", () => {
      const result = normalizeAndStringfyAddress({
        line: ["1 mordhaus st rd ave dr", "apt 1a", "2"],
        city: " ",
        state: "ny",
        zip: "66666",
        country: "usa",
      });
      expect(result).toBeUndefined();
    });
    it("invalid - no state", () => {
      const result = normalizeAndStringfyAddress({
        line: ["1 mordhaus st rd ave dr", "apt 1a", "2"],
        city: "mordhaus",
        state: undefined,
        zip: "66666",
        country: "usa",
      });
      expect(result).toBeUndefined();
    });
    it("invalid - empty state", () => {
      const result = normalizeAndStringfyAddress({
        line: ["1 mordhaus st rd ave dr", "apt 1a", "2"],
        city: "mordhaus",
        state: "",
        zip: "66666",
        country: "usa",
      });
      expect(result).toBeUndefined();
    });
    it("invalid - empty state w/ empty space", () => {
      const result = normalizeAndStringfyAddress({
        line: ["1 mordhaus st rd ave dr", "apt 1a", "2"],
        city: "mordhaus",
        state: " ",
        zip: "66666",
        country: "usa",
      });
      expect(result).toBeUndefined();
    });
    it("invalid - invalid state", () => {
      const result = normalizeAndStringfyAddress({
        line: ["1 mordhaus st rd ave dr", "apt 1a", "2"],
        city: "mordhaus",
        state: "ZZ",
        zip: "66666",
        country: "usa",
      });
      expect(result).toBeUndefined();
    });
    it("invalid - no zip", () => {
      const result = normalizeAndStringfyAddress({
        line: ["1 mordhaus st rd ave dr", "apt 1a", "2"],
        city: "mordhaus",
        state: "ny",
        zip: undefined,
        country: "usa",
      });
      expect(result).toBeUndefined();
    });
    it("invalid - empty zip", () => {
      const result = normalizeAndStringfyAddress({
        line: ["1 mordhaus st rd ave dr", "apt 1a", "2"],
        city: "mordhaus",
        state: "ny",
        zip: "",
        country: "usa",
      });
      expect(result).toBeUndefined();
    });
    it("invalid - empty zip w/ empty space", () => {
      const result = normalizeAndStringfyAddress({
        line: ["1 mordhaus st rd ave dr", "apt 1a", "2"],
        city: "mordhaus",
        state: "ny",
        zip: " ",
        country: "usa",
      });
      expect(result).toBeUndefined();
    });
    it("invalid - valid zip", () => {
      const result = normalizeAndStringfyAddress({
        line: ["1 mordhaus st rd ave dr", "apt 1a", "2"],
        city: "mordhaus",
        state: "ny",
        zip: "12345-12345-1",
        country: "usa",
      });
      expect(result).toBeUndefined();
    });
  });

  describe("normalizeAndStringifyDriversLicense", () => {
    const dl = { value: "i1234568", state: "ca" };
    const expectedDlString = JSON.stringify(dl, Object.keys(dl).sort());
    const dls = [dl, { value: " i1234568 ", state: " ca " }, { value: "I1234568", state: "CA" }];
    for (const dl of dls) {
      it(`valid - ${JSON.stringify(dl)}`, () => {
        const result = normalizeAndStringifyDriversLicense(dl);
        expect(result).toBe(expectedDlString);
      });
    }

    it("invalid - no value", () => {
      const result = normalizeAndStringifyDriversLicense({ value: "", state: "ca" });
      expect(result).toBeUndefined();
    });
    it("invalid - no value w/ empty space", () => {
      const result = normalizeAndStringifyDriversLicense({ value: " ", state: "ca" });
      expect(result).toBeUndefined();
    });
    it("invalid - no state", () => {
      const result = normalizeAndStringifyDriversLicense({ value: "i1234568", state: "" });
      expect(result).toBeUndefined();
    });
    it("invalid - no stat w/ empty spacee", () => {
      const result = normalizeAndStringifyDriversLicense({ value: "i1234568", state: " " });
      expect(result).toBeUndefined();
    });
    it("invalid - no value or state", () => {
      const result = normalizeAndStringifyDriversLicense({ value: "", state: "" });
      expect(result).toBeUndefined();
    });
    it("invalid - no value or state w/ empty space", () => {
      const result = normalizeAndStringifyDriversLicense({ value: " ", state: " " });
      expect(result).toBeUndefined();
    });
  });
});

describe("total patient normalization", () => {
  it("check patient normalization", () => {
    const createdCoreDemographics = patientToNormalizedCoreDemographics(patient);
    const expectedCoreDemographics = coreDemographics;
    expect(createdCoreDemographics).toMatchObject(expectedCoreDemographics);
  });
});

describe("create augmented patient", () => {
  it("check augmented patient", () => {
    const augmentedPatient = createAugmentedPatient(patient);
    const expectedPatientDemoAugmented: PatientDemoData = {
      dob: patient.data.dob,
      genderAtBirth: patient.data.genderAtBirth,
      lastName: patient.data.lastName,
      firstName: patient.data.firstName,
      address: [
        ...patient.data.address,
        {
          zip: "66622",
          city: "ny",
          state: "ny" as USState,
          country: "usa",
          addressLine1: "88 75th st.",
          addressLine2: "apt 8",
        },
      ],
      personalIdentifiers: [
        ...(patient.data.personalIdentifiers ?? []),
        {
          type: "ssn",
          value: "123456789",
        },
      ],
      contact: [
        ...(patient.data.contact ?? []),
        {
          phone: "6194009999",
        },
        {
          email: "johnathan.george@gmail.com",
        },
      ],
    };
    const expectedPatientAugmented: Patient = {
      ...patient,
      data: {
        ...expectedPatientDemoAugmented,
        consolidatedLinkDemographics,
      },
    };
    expect(augmentedPatient).toMatchObject(expectedPatientAugmented);
  });
});

describe("link has new demographics", () => {
  it("new dob", () => {
    const newDob = "1901-04-28";
    const newData = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: {
        ...coreDemographics,
        dob: newDob,
      },
    });
    // new dob does NOT trigger new demopgraphics
    expect(newData.hasNewDemographics).toBe(false);
  });
  it("new gender", () => {
    const newGender = "female";
    const newData = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: {
        ...coreDemographics,
        gender: newGender,
      },
    });
    // new gender does NOT trigger new demopgraphics
    expect(newData.hasNewDemographics).toBe(false);
  });
  it("new name", () => {
    const newNames = [
      ...coreDemographics.names,
      ...[{ fistName: "jon", lastName: "smith" }].map(name =>
        JSON.stringify(name, Object.keys(name).sort())
      ),
    ];
    const newData = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: {
        ...coreDemographics,
        names: newNames,
      },
    });
    expect(newData.hasNewDemographics).toBe(true);
  });
  it("new address", () => {
    const newAddresses = [
      ...consolidatedLinkDemographics.addresses,
      ...[
        {
          line: ["44 hello blvd"],
          city: "los angeles",
          state: "ca",
          zip: "98765",
          country: "usa",
        },
      ].map(address => JSON.stringify(address, Object.keys(address).sort())),
    ];
    const newData = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: {
        ...coreDemographics,
        addresses: newAddresses,
      },
    });
    expect(newData.hasNewDemographics).toBe(true);
  });
  it("new telephone", () => {
    const newTelephone = [...consolidatedLinkDemographics.telephoneNumbers, "00000000"];
    const newData = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: {
        ...coreDemographics,
        telephoneNumbers: newTelephone,
      },
    });
    expect(newData.hasNewDemographics).toBe(true);
  });
  it("new email", () => {
    const newEmail = [...consolidatedLinkDemographics.emails, "test@gmail.com"];
    const newData = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: {
        ...coreDemographics,
        emails: newEmail,
      },
    });
    expect(newData.hasNewDemographics).toBe(true);
  });
  it("new dl", () => {
    const newDl = [
      ...consolidatedLinkDemographics.driversLicenses,
      ...[{ value: "p234212", state: "ri" }].map(dl => JSON.stringify(dl, Object.keys(dl).sort())),
    ];
    const newData = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: {
        ...coreDemographics,
        driversLicenses: newDl,
      },
    });
    expect(newData.hasNewDemographics).toBe(true);
  });
  it("new ssn", () => {
    const newSsn = [...consolidatedLinkDemographics.ssns, "999999999"];
    const newData = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: {
        ...coreDemographics,
        ssns: newSsn,
      },
    });
    expect(newData.hasNewDemographics).toBe(true);
  });
  it("link has no new demographics", () => {
    const noNewPatient = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: coreDemographics,
    });
    expect(noNewPatient.hasNewDemographics).toBe(false);
    const noNewConsolidated = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: {
        ...coreDemographics,
        ...consolidatedLinkDemographics,
      },
    });
    expect(noNewConsolidated.hasNewDemographics).toBe(false);
    const noNewEmpty = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: {
        dob: undefined,
        gender: undefined,
        names: [],
        addresses: [],
        telephoneNumbers: [],
        emails: [],
        driversLicenses: [],
        ssns: [],
      },
    });
    expect(noNewEmpty.hasNewDemographics).toBe(false);
  });
});

describe("check demo function", () => {
  const dob = {
    exact: "1900-02-28",
    partial: "1900-03-28",
    different: "1901-03-28",
  };
  const gender: { [key: string]: LinkGender } = {
    exact: "male",
    different: "female",
  };
  const names = {
    exact: [{ firstName: "john", lastName: "smith" }].map(name =>
      JSON.stringify(name, Object.keys(name).sort())
    ),
    different: [],
  };
  const addresses = {
    exact: [
      {
        line: ["1 mordhaus st", "apt 1a"],
        city: "mordhaus",
        state: "ny",
        zip: "66666",
        country: "usa",
      },
    ].map(address => JSON.stringify(address, Object.keys(address).sort())),
    partial: [
      {
        line: ["1 mordhaus st"],
        city: "mordhaus",
        state: "nj",
        zip: "66666",
        country: "usa",
      },
    ].map(address => JSON.stringify(address, Object.keys(address).sort())),
    different: [],
  };
  const telephoneNumbers = {
    exact: ["4150000000"],
    different: [],
  };
  const emails = {
    exact: ["john.smith@gmail.com"],
    different: [],
  };
  const ssns = {
    exact: ["123014442"],
    different: [],
  };
  const defaultDifferent: LinkDemographics = {
    dob: dob.different,
    gender: gender.different,
    names: names.different,
    addresses: addresses.different,
    telephoneNumbers: telephoneNumbers.different,
    emails: emails.different,
    driversLicenses: [],
    ssns: ssns.different,
  };
  it("fail w/ default different", () => {
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics: defaultDifferent,
    });
    expect(result.isMatched).toBe(false);
  });
  it("pass w/ dob (8), name (10), exact address (2)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      dob: dob.exact,
      names: names.exact,
      addresses: addresses.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(true);
  });
  it("pass w/ dob (8), name (10), partial address (1) and gender (1)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      dob: dob.exact,
      names: names.exact,
      addresses: addresses.partial,
      gender: gender.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(true);
  });
  it("pass w/ dob (8), name (10), exact phone (2)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      dob: dob.exact,
      names: names.exact,
      telephoneNumbers: telephoneNumbers.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(true);
  });
  it("pass w/ dob (8), name (10), exact email (2)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      dob: dob.exact,
      names: names.exact,
      emails: emails.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(true);
  });
  it("pass w/ dob (8), name (10), exact ssn (5)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      dob: dob.exact,
      names: names.exact,
      ssns: ssns.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(true);
  });
  it("pass w/ name (10), partial dob (2), exact address (2), exact phone (2), exact ssn (5)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      names: names.exact,
      dob: dob.partial,
      addresses: addresses.exact,
      telephoneNumbers: telephoneNumbers.exact,
      ssns: ssns.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(true);
  });
  it("pass w/ name (10), partial dob (2), exact address (2), exact email (2), exact ssn (5)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      names: names.exact,
      dob: dob.partial,
      addresses: addresses.exact,
      emails: emails.exact,
      ssns: ssns.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(true);
  });
  it("pass w/ name (10), partial dob (2), exact phone (2), exact email (2), exact ssn (5)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      names: names.exact,
      dob: dob.partial,
      telephoneNumbers: telephoneNumbers.exact,
      emails: emails.exact,
      ssns: ssns.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(true);
  });
  it("pass w/ name (10), exact address (2), exact phone (2), exact email (2), exact ssn (5)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      names: names.exact,
      addresses: addresses.exact,
      telephoneNumbers: telephoneNumbers.exact,
      emails: emails.exact,
      ssns: ssns.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(true);
  });
  it("pass w/ name (10), partial address (1), gender (1), exact phone (2), exact email (2), exact ssn (5)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      names: names.exact,
      addresses: addresses.partial,
      gender: gender.exact,
      telephoneNumbers: telephoneNumbers.exact,
      emails: emails.exact,
      ssns: ssns.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(true);
  });
  it("fail w/ dob (8), exact address (2), gender (1), exact phone (2), exact email (2), exact ssn (5)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      dob: dob.exact,
      addresses: addresses.exact,
      gender: gender.exact,
      telephoneNumbers: telephoneNumbers.exact,
      emails: emails.exact,
      ssns: ssns.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(false);
  });
  it("fail w/ dob (8), name (10)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      dob: dob.exact,
      names: names.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(false);
  });
  it("fail w/ dob (8), name (10), gender (1)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      dob: dob.exact,
      names: names.exact,
      gender: gender.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(false);
  });
  it("fail w/ dob (8), name (10), partial address (1)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      dob: dob.exact,
      names: names.exact,
      addresses: addresses.partial,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(false);
  });
  it("fail w/ name (10), exact address (2), exact phone (2), exact email (2)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      names: names.exact,
      addresses: addresses.exact,
      telephoneNumbers: telephoneNumbers.exact,
      emails: emails.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(false);
  });
  it("fail w/ name (10), exact address (2), exact phone (2), exact ssn (5)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      names: names.exact,
      addresses: addresses.exact,
      telephoneNumbers: telephoneNumbers.exact,
      ssns: ssns.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(false);
  });
  it("fail w/ name (10), exact address (2), exact email (2), exact ssn (5)", () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      names: names.exact,
      addresses: addresses.exact,
      emails: emails.exact,
      ssns: ssns.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(false);
  });
});
