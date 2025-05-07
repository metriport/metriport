import { Patient, PatientDemoData, splitDob } from "@metriport/core/domain/patient";
import { LinkDemographics, LinkGender } from "@metriport/core/domain/patient-demographics";
import { USState } from "@metriport/shared";
import {
  checkDemoMatch,
  createAugmentedPatient,
  linkHasNewDemographics,
  normalizeAddress,
  normalizeAndStringifyDriversLicense,
  normalizeAndStringifyNames,
  normalizeDob,
  patientToNormalizedCoreDemographics,
  stringifyAddress,
} from "../patient-demographics";
import { consolidatedLinkDemographics, coreDemographics, patient } from "./demographics.const";

describe("normalization", () => {
  const dobValid = "2023-08-01";
  describe("normalizeDob", () => {
    const dobsToCheck = [dobValid, " 2023-08-01 ", "20230801", undefined];
    for (const dob of dobsToCheck) {
      it(`dob: ${dob}`, async () => {
        const result = normalizeDob(dob);
        expect(result).toBe(dob ? dobValid : undefined);
      });
    }
  });

  it("dob split", async () => {
    const result = splitDob(dobValid);
    expect(result).toMatchObject(["2023", "08", "01"]);
  });

  describe("normalizeAndStringifyNames", () => {
    const nameValid = { firstName: "john", lastName: "smith" };
    const nameValidString = JSON.stringify(nameValid, Object.keys(nameValid).sort());
    const namesToCheck = [
      nameValid,
      { firstName: " john ", lastName: " smith " },
      { firstName: "John", lastName: "Smith" },
    ];
    for (const name of namesToCheck) {
      it(`name: ${JSON.stringify(name)}`, async () => {
        const result = normalizeAndStringifyNames(name);
        expect(result).toBe(nameValidString);
      });
    }
  });

  describe("normalizeAddress", () => {
    const expectedAddress = {
      line: ["1 mordhaus st rd ave dr", "apt 1a", "2"],
      city: "mordhaus",
      state: "ny",
      zip: "66666",
      country: "usa",
    };
    const addressesToCheck = [
      expectedAddress,
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
        line: ["1 Mordhaus St Rd Ave Dr", "Apt 1A", "2"],
        city: "Mordhaus",
        state: "NY",
        zip: "66666-1234",
        country: "USAA",
      },
      {
        line: ["1 Mordhaus Street Road Avenue Drive", "Apt 1A", "2"],
        city: "Mordhaus",
        state: "NY",
        zip: "66666",
        country: "USA",
      },
      {
        line: undefined,
        city: undefined,
        state: undefined,
        zip: undefined,
        country: undefined,
      },
    ];
    for (const address of addressesToCheck) {
      it(`address: ${JSON.stringify(address)}`, async () => {
        const result = normalizeAddress(address);
        expect(result).toMatchObject(
          address.line
            ? expectedAddress
            : {
                line: [],
                city: "",
                state: "",
                zip: "",
                country: "usa",
              }
        );
      });
    }
    it("address stringify", () => {
      const result = stringifyAddress(expectedAddress);
      expect(result).toBe(JSON.stringify(expectedAddress, Object.keys(expectedAddress).sort()));
    });
  });

  describe("normalizeAndStringifyDriversLicense", () => {
    const dlValid = { value: "i1234568", state: "ca" };
    const dlValidString = JSON.stringify(dlValid, Object.keys(dlValid).sort());
    const dlsToCheck = [
      dlValid,
      { value: " i1234568 ", state: " ca " },
      { value: "I1234568", state: "CA" },
    ];
    for (const dl of dlsToCheck) {
      it(`dl: ${JSON.stringify(dl)}`, async () => {
        const result = normalizeAndStringifyDriversLicense(dl);
        expect(result).toBe(dlValidString);
      });
    }
  });
});

describe("total patient normalization", () => {
  it("check patient normalization", async () => {
    const coreDemographicsTest = patientToNormalizedCoreDemographics(patient);
    expect(coreDemographicsTest).toMatchObject(coreDemographics);
  });
});

describe("create augmented patient", () => {
  it("check augmented patient", async () => {
    const augmentedPatient = createAugmentedPatient(patient);
    const patientDemoAugmented: PatientDemoData = {
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
      personalIdentifiers: patient.data.personalIdentifiers,
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
    const patientAugmented: Patient = {
      ...patient,
      data: {
        ...patientDemoAugmented,
        consolidatedLinkDemographics,
      },
    };
    expect(augmentedPatient).toMatchObject(patientAugmented);
  });
});

describe("link has new demographics", () => {
  it("new dob", async () => {
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
  it("new gender", async () => {
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
  it("new name", async () => {
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
  it("new address", async () => {
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
  it("new telephone", async () => {
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
  it("new email", async () => {
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
  it("new dl", async () => {
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
  it("new ssn", async () => {
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
  it("link has no new demographics", async () => {
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
  it("fail w/ default different", async () => {
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics: defaultDifferent,
    });
    expect(result.isMatched).toBe(false);
  });
  it("pass w/ dob (8), name (10), exact address (2)", async () => {
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
  it("pass w/ dob (8), name (10), partial address (1) and gender (1)", async () => {
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
  it("pass w/ dob (8), name (10), exact phone (2)", async () => {
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
  it("pass w/ dob (8), name (10), exact email (2)", async () => {
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
  it("pass w/ dob (8), name (10), exact ssn (5)", async () => {
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
  it("pass w/ name (10), partial dob (2), exact address (2), exact phone (2), exact ssn (5)", async () => {
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
  it("pass w/ name (10), partial dob (2), exact address (2), exact email (2), exact ssn (5)", async () => {
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
  it("pass w/ name (10), partial dob (2), exact phone (2), exact email (2), exact ssn (5)", async () => {
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
  it("pass w/ name (10), exact address (2), exact phone (2), exact email (2), exact ssn (5)", async () => {
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
  it("pass w/ name (10), partial address (1), gender (1), exact phone (2), exact email (2), exact ssn (5)", async () => {
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
  it("pass w/ dob (8), exact address (2), gender (1), exact phone (2), exact email (2), exact ssn (5)", async () => {
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
    expect(result.isMatched).toBe(true);
  });
  it("pass w/ dob (8), name (10)", async () => {
    const linkDemographics: LinkDemographics = {
      ...defaultDifferent,
      dob: dob.exact,
      names: names.exact,
    };
    const result = checkDemoMatch({
      coreDemographics,
      linkDemographics,
    });
    expect(result.isMatched).toBe(true);
  });
  it("pass w/ dob (8), name (10), gender (1)", async () => {
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
    expect(result.isMatched).toBe(true);
  });
  it("pass w/ dob (8), name (10), partial address (1)", async () => {
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
    expect(result.isMatched).toBe(true);
  });
  it("fail w/ name (10), exact address (2), exact phone (2), exact email (2)", async () => {
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
  it("pass w/ name (10), exact address (2), exact phone (2), exact ssn (5)", async () => {
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
    expect(result.isMatched).toBe(true);
  });
  it("pass w/ name (10), exact address (2), exact email (2), exact ssn (5)", async () => {
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
    expect(result.isMatched).toBe(true);
  });
});
