import { Patient, PatientDemoData, splitDob } from "@metriport/core/domain/patient";
import { USState } from "@metriport/shared";
import {
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
