import { Patient, PatientDemoData, GenderAtBirth, splitDob } from "@metriport/core/domain/patient";
//import { stripNonNumericChars } from "@metriport/core/domain/contact";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { USState } from "@metriport/core/domain/geographic-locations";
import {
  normalizeDob,
  normalizeGender,
  normalizeAndStringifyNames,
  normalizeAddress,
  stringifyAddress,
  normalizeTelephone,
  normalizeSsn,
  normalizeEmail,
  normalizeAndStringifyDriversLicense,
  patientToNormalizedCoreDemographics,
  createAugmentedPatient,
  linkHasNewDemographics,
} from "../patient-demographics";

describe("normalization", () => {
  it("check dob split", async () => {
    const dobValidValue = "2023-08-01";
    const dobSplit = splitDob(dobValidValue);
    expect(dobSplit).toMatchObject(["2023", "08", "01"]);
  });
  /* TODO
  it("check strip non numeric chars", async () => {
    const dobValidValue = "2023-08-01";
    const dobSplit = splitDob(dobValidValue);
    expect(dobSplit).toMatchObject(["2023", "08", "01"]);
  });
  */
  it("check dob normalization", async () => {
    const dobValidValue = "2023-08-01";
    const dobValid = normalizeDob(dobValidValue);
    expect(dobValid).toBe(dobValidValue);
    const dobTrim = normalizeDob(" 2023-08-01 ");
    expect(dobTrim).toBe(dobValidValue);
    const dobTrimDiffFormatn = normalizeDob(" 20230801 ");
    expect(dobTrimDiffFormatn).toBe(dobValidValue);
    const dobUndefined = normalizeDob();
    expect(dobUndefined).toBe(undefined);
  });
  it("check gender normalization", async () => {
    const genderValidValue = "male";
    const genderValid = normalizeGender(genderValidValue);
    expect(genderValid).toBe(genderValidValue);
    const genderTrim = normalizeGender(" male ");
    expect(genderTrim).toBe(genderValidValue);
    const genderTrimLowercase = normalizeGender(" Male ");
    expect(genderTrimLowercase).toBe(genderValidValue);
    const genderFhirType = normalizeGender("M");
    expect(genderFhirType).toBe(genderValidValue);
    const genderMaleMisspelled = normalizeGender("malee");
    expect(genderMaleMisspelled).toBe(undefined);
    const genderFemaleMisspelled = normalizeGender("femalee");
    expect(genderFemaleMisspelled).toBe(undefined);
    const genderUndefined = normalizeGender();
    expect(genderUndefined).toBe(undefined);
  });
  it("check names normalization", async () => {
    const nameValidValue = { firstName: "john", lastName: "smith" };
    const nameValidValueString = JSON.stringify(nameValidValue, Object.keys(nameValidValue).sort());
    const namesValid = normalizeAndStringifyNames(nameValidValue);
    expect(namesValid).toBe(nameValidValueString);
    const namesTrim = normalizeAndStringifyNames({ firstName: " john ", lastName: " smith " });
    expect(namesTrim).toBe(nameValidValueString);
    const namesTrimLowercase = normalizeAndStringifyNames({
      firstName: " John ",
      lastName: " Smith ",
    });
    expect(namesTrimLowercase).toBe(nameValidValueString);
  });
  it("check address normalization", async () => {
    const addressValidValue = {
      line: ["1 mordhaus st", "apt 1a", "2"],
      city: "mordhaus",
      state: "ny",
      zip: "66666",
      country: "usa",
    };
    const addressValid = normalizeAddress(addressValidValue);
    expect(addressValid).toMatchObject(addressValidValue);
    const addressTrim = normalizeAddress({
      line: [" 1 mordhaus st ", " apt 1a ", " 2 "],
      city: " mordhaus ",
      state: " ny ",
      zip: " 66666 ",
      country: " usa ",
    });
    expect(addressTrim).toMatchObject(addressValidValue);
    const addressTrimLowercase = normalizeAddress({
      line: [" 1 Mordhaus St ", " Apt 1A ", " 2 "],
      city: " Mordhaus ",
      state: " NY ",
      zip: " 66666 ",
      country: " USA ",
    });
    expect(addressTrimLowercase).toMatchObject(addressValidValue);
    const addressTrimLowercaseZipAlphanumeric = normalizeAddress({
      line: [" 1 Mordhaus St ", " Apt 1A ", " 2 "],
      city: " Mordhaus ",
      state: " NY ",
      zip: " 66666abc ",
      country: " USA ",
    });
    expect(addressTrimLowercaseZipAlphanumeric).toMatchObject(addressValidValue);
    const addressTrimLowercaseZipNumericSlice = normalizeAddress({
      line: [" 1 Mordhaus St ", " Apt 1A ", " 2 "],
      city: " Mordhaus ",
      state: " NYac ",
      zip: " 66666-1234abc ",
      country: " USAa ",
    });
    expect(addressTrimLowercaseZipNumericSlice).toMatchObject(addressValidValue);
    const addressUndefined = normalizeAddress({
      line: undefined,
      city: undefined,
      state: undefined,
      zip: undefined,
      country: undefined,
    });
    expect(addressUndefined).toMatchObject({
      line: [],
      city: "",
      state: "",
      zip: "",
      country: "usa",
    });
    const addressValidValueString = JSON.stringify(
      addressValidValue,
      Object.keys(addressValidValue).sort()
    );
    const addressString = stringifyAddress(addressValidValue);
    expect(addressString).toBe(addressValidValueString);
  });
  it("check telephone normalization", async () => {
    const phoneValidValue = "4150000000";
    const phoneValid = normalizeTelephone(phoneValidValue);
    expect(phoneValid).toBe(phoneValidValue);
    const phoneTrim = normalizeTelephone(" 4150000000 ");
    expect(phoneTrim).toBe(phoneValidValue);
    const phoneTrimNumeric = normalizeTelephone(" (415)-000-0000 ");
    expect(phoneTrimNumeric).toBe(phoneValidValue);
    const phoneTrimNumericSlice = normalizeTelephone(" +1(415)-000-0000 ");
    expect(phoneTrimNumericSlice).toBe(phoneValidValue);
  });
  it("check email normalization", async () => {
    const emailValidValue = "john.smith@gmail.com";
    const emailValid = normalizeEmail(emailValidValue);
    expect(emailValid).toBe(emailValidValue);
    const emailTrim = normalizeEmail(" john.smith@gmail.com ");
    expect(emailTrim).toBe(emailValidValue);
    const emailTrimLowercase = normalizeEmail(" JOHN.SMITH@GMAIL.COM ");
    expect(emailTrimLowercase).toBe(emailValidValue);
  });
  it("check drivers license normalization", async () => {
    const dlValidValue = { value: "i1234568", state: "ca" };
    const dlValidValueString = JSON.stringify(dlValidValue, Object.keys(dlValidValue).sort());
    const dlValid = normalizeAndStringifyDriversLicense(dlValidValue);
    expect(dlValid).toBe(dlValidValueString);
    const dlTrim = normalizeAndStringifyDriversLicense({ value: " i1234568 ", state: " ca " });
    expect(dlTrim).toBe(dlValidValueString);
    const dlTrimLowercase = normalizeAndStringifyDriversLicense({
      value: " I1234568 ",
      state: " CA ",
    });
    expect(dlTrimLowercase).toBe(dlValidValueString);
    const dlTrimLowercaseSlice = normalizeAndStringifyDriversLicense({
      value: " I1234568 ",
      state: " CAa ",
    });
    expect(dlTrimLowercaseSlice).toBe(dlValidValueString);
  });
  it("check ssn normalization", async () => {
    const ssnValidValue = "000000000";
    const ssnValid = normalizeSsn(ssnValidValue);
    expect(ssnValid).toBe(ssnValidValue);
    const ssnTrim = normalizeSsn(" 000000000 ");
    expect(ssnTrim).toBe(ssnValidValue);
    const ssnTrimNumeric = normalizeSsn(" 000-00-0000 ");
    expect(ssnTrimNumeric).toBe(ssnValidValue);
    const ssnTrimNumericSlice = normalizeSsn(" 123000-00-0000 ");
    expect(ssnTrimNumericSlice).toBe(ssnValidValue);
  });
});

describe("total patient normalization", () => {
  it("check patient normalization", async () => {
    const patientDemo: PatientDemoData = {
      dob: "1900-02-28",
      genderAtBirth: "M" as GenderAtBirth,
      lastName: " Smith, Douglas",
      firstName: "John Johnathan",
      address: [
        {
          zip: "66666",
          city: " Mordhaus",
          state: "NY" as USState,
          country: "USA",
          addressLine1: "1 Mordhaus ST",
          addressLine2: " Apt 1A",
        },
        {
          zip: "12345-8080",
          city: "Los Angeles",
          state: "CA" as USState,
          addressLine1: "777 Elm Avenue ",
        },
      ],
      personalIdentifiers: [
        {
          type: "driversLicense",
          value: "I1234568",
          state: "CA" as USState,
        },
        {
          type: "ssn",
          value: " 123-01-4442",
        },
      ],
      contact: [
        {
          phone: "1-415-000-0000",
          email: "john.smith@gmail.com",
        },
        {
          phone: "415-777-0000 ",
        },
        {
          email: " JOHN.DOUGLAS@YAHOO.COM",
          phone: undefined,
        },
      ],
    };
    const patient: Patient = {
      id: "",
      cxId: "",
      data: {
        ...patientDemo,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      facilityIds: [""],
      eTag: "",
    };
    const coreDemographics = patientToNormalizedCoreDemographics(patient);
    const patientDemographicsNormalized: LinkDemographics = {
      dob: "1900-02-28",
      gender: "male",
      names: [
        { firstName: "john", lastName: "smith" },
        { firstName: "johnathan", lastName: "smith" },
        { firstName: "john", lastName: "douglas" },
        { firstName: "johnathan", lastName: "douglas" },
      ].map(name => JSON.stringify(name, Object.keys(name).sort())),
      addresses: [
        {
          line: ["1 mordhaus st", "apt 1a"],
          city: "mordhaus",
          state: "ny",
          zip: "66666",
          country: "usa",
        },
        {
          line: ["777 elm ave"],
          city: "los angeles",
          state: "ca",
          zip: "12345",
          country: "usa",
        },
      ].map(address => JSON.stringify(address, Object.keys(address).sort())),
      telephoneNumbers: ["4150000000", "4157770000"],
      emails: ["john.smith@gmail.com", "john.douglas@yahoo.com"],
      driversLicenses: [{ value: "i1234568", state: "ca" }].map(dl =>
        JSON.stringify(dl, Object.keys(dl).sort())
      ),
      ssns: ["123014442"],
    };
    expect(coreDemographics).toMatchObject(patientDemographicsNormalized);
  });
});

describe("create augmented patient", () => {
  it("check augmented patient", async () => {
    const consolidatedLinkDemographics = {
      names: [
        { firstName: "John", lastName: "George" },
        { firstName: "Johnathan", lastName: "George" },
      ].map(name => JSON.stringify(name, Object.keys(name).sort())),
      addresses: [
        {
          line: ["88 75th st.", "apt 8", "1b"],
          city: "ny",
          state: "ny",
          zip: "66622",
          country: "usa",
        },
      ].map(address => JSON.stringify(address, Object.keys(address).sort())),
      telephoneNumbers: ["6194009999"],
      emails: [],
      driversLicenses: [{ value: "NY1234", state: "NY" }].map(dl =>
        JSON.stringify(dl, Object.keys(dl).sort())
      ),
      ssns: [],
    };
    const patientDemo: PatientDemoData = {
      dob: "1900-02-28",
      genderAtBirth: "M" as GenderAtBirth,
      lastName: " Smith, Douglas",
      firstName: "John Johnathan",
      address: [
        {
          zip: "66666",
          city: " Mordhaus",
          state: "NY" as USState,
          country: "USA",
          addressLine1: "1 Mordhaus ST",
          addressLine2: " Apt 1A",
        },
        {
          zip: "12345-8080",
          city: "Los Angeles",
          state: "CA" as USState,
          addressLine1: "777 Elm Avenue ",
        },
      ],
      personalIdentifiers: [
        {
          type: "driversLicense",
          value: "I1234568",
          state: "CA" as USState,
        },
        {
          type: "ssn",
          value: " 123-01-4442",
        },
      ],
      contact: [
        {
          phone: "1-415-000-0000",
          email: "john.smith@gmail.com",
        },
        {
          phone: "415-777-0000 ",
        },
        {
          email: " JOHN.DOUGLAS@YAHOO.COM",
          phone: undefined,
        },
      ],
    };
    const patient: Patient = {
      id: "",
      cxId: "",
      data: {
        ...patientDemo,
        consolidatedLinkDemographics,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      facilityIds: [""],
      eTag: "",
    };
    const augmentedPatient = createAugmentedPatient(patient);
    const patientDemographicsAugmented: PatientDemoData = {
      dob: "1900-02-28",
      genderAtBirth: "M" as GenderAtBirth,
      lastName: " Smith, Douglas",
      firstName: "John Johnathan",
      address: [
        {
          zip: "66666",
          city: " Mordhaus",
          state: "NY" as USState,
          country: "USA",
          addressLine1: "1 Mordhaus ST",
          addressLine2: " Apt 1A",
        },
        {
          zip: "12345-8080",
          city: "Los Angeles",
          state: "CA" as USState,
          addressLine1: "777 Elm Avenue ",
        },
        {
          zip: "66622",
          city: "ny",
          state: "ny" as USState,
          country: "usa",
          addressLine1: "88 75th st.",
          addressLine2: "apt 8 1b",
        },
      ],
      personalIdentifiers: [
        {
          type: "driversLicense",
          value: "I1234568",
          state: "CA" as USState,
        },
        {
          type: "ssn",
          value: " 123-01-4442",
        },
      ],
      contact: [
        {
          phone: "1-415-000-0000",
          email: "john.smith@gmail.com",
        },
        {
          phone: "415-777-0000 ",
        },
        {
          email: " JOHN.DOUGLAS@YAHOO.COM",
          phone: undefined,
        },
        {
          phone: "6194009999",
        },
      ],
    };
    const patientTotalAugmented: Patient = {
      ...patient,
      data: {
        ...patientDemographicsAugmented,
        consolidatedLinkDemographics,
      },
    };
    expect(augmentedPatient).toMatchObject(patientTotalAugmented);
  });
});

describe("link has new demographics", () => {
  const consolidatedLinkDemographics = {
    names: [
      { firstName: "John", lastName: "George" },
      { firstName: "Johnathan", lastName: "George" },
    ].map(name => JSON.stringify(name, Object.keys(name).sort())),
    addresses: [
      {
        line: ["88 75th st.", "apt 8"],
        city: "ny",
        state: "ny",
        zip: "66622",
        country: "usa",
      },
    ].map(address => JSON.stringify(address, Object.keys(address).sort())),
    telephoneNumbers: ["6194009999"],
    emails: [],
    driversLicenses: [{ value: "NY1234", state: "NY" }].map(dl =>
      JSON.stringify(dl, Object.keys(dl).sort())
    ),
    ssns: [],
  };
  const patientDemo: PatientDemoData = {
    dob: "1900-02-28",
    genderAtBirth: "M" as GenderAtBirth,
    lastName: " Smith, Douglas",
    firstName: "John Johnathan",
    address: [
      {
        zip: "66666",
        city: " Mordhaus",
        state: "NY" as USState,
        country: "USA",
        addressLine1: "1 Mordhaus ST",
        addressLine2: " Apt 1A",
      },
      {
        zip: "12345-8080",
        city: "Los Angeles",
        state: "CA" as USState,
        addressLine1: "777 Elm Avenue ",
      },
    ],
    personalIdentifiers: [
      {
        type: "driversLicense",
        value: "I1234568",
        state: "CA" as USState,
      },
      {
        type: "ssn",
        value: " 123-01-4442",
      },
    ],
    contact: [
      {
        phone: "1-415-000-0000",
        email: "john.smith@gmail.com",
      },
      {
        phone: "415-777-0000 ",
      },
      {
        email: " JOHN.DOUGLAS@YAHOO.COM",
        phone: undefined,
      },
    ],
  };
  const patient: Patient = {
    id: "",
    cxId: "",
    data: {
      ...patientDemo,
      consolidatedLinkDemographics,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    facilityIds: [""],
    eTag: "",
  };
  const coreDemographics = patientToNormalizedCoreDemographics(patient);
  it("link has new dob demographics", async () => {
    const newDob = "1901-04-28";
    const newLinkDemographics: LinkDemographics = {
      ...coreDemographics,
      dob: newDob,
    };
    const newData = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: newLinkDemographics,
    });
    expect(newData[0]).toBe(true);
  });
  it("link has new gender demographics", async () => {
    const newGender = "female";
    const newLinkDemographics: LinkDemographics = {
      ...coreDemographics,
      gender: newGender,
    };
    const newData = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: newLinkDemographics,
    });
    expect(newData[0]).toBe(true);
  });
  it("link has new name demographics", async () => {
    const newNames = [
      ...coreDemographics.names,
      ...[{ fistName: "jon", lastName: "smith" }].map(name =>
        JSON.stringify(name, Object.keys(name).sort())
      ),
    ];
    const newLinkDemographics: LinkDemographics = {
      ...coreDemographics,
      names: newNames,
    };
    const newData = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: newLinkDemographics,
    });
    expect(newData[0]).toBe(true);
  });
  it("link has new address demographics", async () => {
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
    const newLinkDemographics: LinkDemographics = {
      ...coreDemographics,
      addresses: newAddresses,
    };
    const newData = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: newLinkDemographics,
    });
    expect(newData[0]).toBe(true);
  });
  it("link has new telephone demographics", async () => {
    const newTelephone = [...consolidatedLinkDemographics.telephoneNumbers, "00000000"];
    const newLinkDemographics: LinkDemographics = {
      ...coreDemographics,
      telephoneNumbers: newTelephone,
    };
    const newData = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: newLinkDemographics,
    });
    expect(newData[0]).toBe(true);
  });
  it("link has new email demographics", async () => {
    const newEmail = [...consolidatedLinkDemographics.emails, "test@gmail.com"];
    const newLinkDemographics: LinkDemographics = {
      ...coreDemographics,
      emails: newEmail,
    };
    const newData = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: newLinkDemographics,
    });
    expect(newData[0]).toBe(true);
  });
  it("link has new dl demographics", async () => {
    const newDl = [
      ...consolidatedLinkDemographics.driversLicenses,
      ...[{ value: "p234212", state: "ri" }].map(dl => JSON.stringify(dl, Object.keys(dl).sort())),
    ];
    const newLinkDemographics: LinkDemographics = {
      ...coreDemographics,
      driversLicenses: newDl,
    };
    const newData = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: newLinkDemographics,
    });
    expect(newData[0]).toBe(true);
  });
  it("link has new ssn demographics", async () => {
    const newSsn = [...consolidatedLinkDemographics.ssns, "999999999"];
    const newLinkDemographics: LinkDemographics = {
      ...coreDemographics,
      ssns: newSsn,
    };
    const newData = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: newLinkDemographics,
    });
    expect(newData[0]).toBe(true);
  });
  it("link has no new demographics", async () => {
    const noNewPatient = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: coreDemographics,
    });
    expect(noNewPatient[0]).toBe(false);
    const noNewConsolidated = linkHasNewDemographics({
      coreDemographics,
      consolidatedLinkDemographics,
      linkDemographics: {
        ...coreDemographics,
        ...consolidatedLinkDemographics,
      },
    });
    expect(noNewConsolidated[0]).toBe(false);
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
    expect(noNewEmpty[0]).toBe(false);
  });
});
