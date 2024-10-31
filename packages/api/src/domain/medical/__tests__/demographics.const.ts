import { USState } from "@metriport/shared";
import { Patient, PatientDemoData } from "@metriport/core/domain/patient";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";

const names = [
  { firstName: "john", lastName: "smith" },
  { firstName: "johnathan", lastName: "smith" },
  { firstName: "john", lastName: "douglas" },
  { firstName: "johnathan", lastName: "douglas" },
];
const addresses = [
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
];
const dls = [{ value: "i1234568", state: "ca" }];
export const coreDemographics: LinkDemographics = {
  dob: "1900-02-28",
  gender: "male",
  names: names.map(name => JSON.stringify(name, Object.keys(name).sort())),
  addresses: addresses.map(address => JSON.stringify(address, Object.keys(address).sort())),
  telephoneNumbers: ["4150000000", "4157770000"],
  emails: ["john.smith@gmail.com", "john.douglas@yahoo.com"],
  driversLicenses: dls.map(dl => JSON.stringify(dl, Object.keys(dl).sort())),
  ssns: ["123014442"],
};

const newNames = [
  { firstName: "john", lastName: "george" },
  { firstName: "johnathan", lastName: "george" },
];
const newAddresses = [
  {
    line: ["88 75th st.", "apt 8"],
    city: "ny",
    state: "ny",
    zip: "66622",
    country: "usa",
  },
];
const newDls = [{ value: "ny1234", state: "ny" }];
export const consolidatedLinkDemographics: Omit<LinkDemographics, "dob" | "gender"> = {
  names: newNames.map(name => JSON.stringify(name, Object.keys(name).sort())),
  addresses: newAddresses.map(address => JSON.stringify(address, Object.keys(address).sort())),
  telephoneNumbers: ["6194009999"],
  emails: ["johnathan.george@gmail.com"],
  driversLicenses: newDls.map(dl => JSON.stringify(dl, Object.keys(dl).sort())),
  ssns: ["123456789"],
};

export const patientDemo: PatientDemoData = {
  dob: "1900-02-28",
  genderAtBirth: "M",
  lastName: "Smith, Douglas",
  firstName: "John, Johnathan",
  address: [
    {
      zip: "66666",
      city: "Mordhaus",
      state: "NY" as USState,
      country: "USA",
      addressLine1: "1 Mordhaus ST",
      addressLine2: "Apt 1A",
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
      value: "123-01-4442",
    },
  ],
  contact: [
    {
      phone: "1-415-000-0000",
      email: "john.smith@gmail.com",
    },
    {
      phone: "415-777-0000",
    },
    {
      email: "JOHN.DOUGLAS@YAHOO.COM",
      phone: undefined,
    },
  ],
};
export const patient: Patient = {
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
