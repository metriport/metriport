import { Patient, PatientDemoData, GenderAtBirth } from "@metriport/core/domain/patient";
import { USState } from "@metriport/core/domain/geographic-locations";
import { PatientResource } from "@metriport/ihe-gateway-sdk";
import {
  scoreLinkEpic,
  patientCoreDemographicsToNormalizedAndStringifiedLinkDemographics,
} from "../../../domain/medical/patient-demographics";
import { patientResourceToNormalizedAndStringifiedLinkDemographics } from "../patient-demographics";

describe("CQ demographics", () => {
  it("normalization", async () => {
    const patientResource: PatientResource = {
      birthDate: " 1900-01-01 ",
      gender: "female",
      name: [
        {
          family: "Smith",
          given: ["Katherine", "Katy "],
        },
      ],
      address: [
        {
          line: ["400 Awesome Rd."],
          city: "San Francisco",
          state: "CA",
          postalCode: "99999-4040",
        },
        {
          line: ["401 Awesome Rd.", "Apt 1b"],
          city: "San Francisco ",
          state: "CA",
          postalCode: "99999",
          country: "USA",
        },
      ],
      telecom: [
        {
          system: "phone",
          value: "(888)8887777",
        },
        {
          system: "email",
          value: " katy2020@GMAIL.COM",
        },
        {
          system: "fax",
          value: "8887779",
        },
      ],
      identifier: [],
    };
    const normalizedPatientResource =
      patientResourceToNormalizedAndStringifiedLinkDemographics(patientResource);
    const addressesObj = [
      {
        line: ["400 awesome rd."],
        city: "san francisco",
        state: "ca",
        zip: "99999",
        country: "usa",
      },
      {
        line: ["401 awesome rd.", "apt 1b"],
        city: "san francisco",
        state: "ca",
        zip: "99999",
        country: "usa",
      },
    ];
    expect(normalizedPatientResource).toMatchObject({
      dob: "1900-01-01",
      gender: "female",
      names: [
        { firstName: "katherine", lastName: "smith" },
        { firstName: "katy", lastName: "smith" },
      ].map(name => JSON.stringify(name, Object.keys(name).sort())),
      addressesObj,
      addressesString: addressesObj.map(address =>
        JSON.stringify(address, Object.keys(address).sort())
      ),
      telephoneNumbers: ["8888887777"],
      emails: ["katy2020@gmail.com"],
      driversLicenses: [],
      ssns: [],
    });
  });
  it("check failure scoreLink", async () => {
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
    const normalizedPatient =
      patientCoreDemographicsToNormalizedAndStringifiedLinkDemographics(patient);
    const patientResource: PatientResource = {
      birthDate: " 1900-01-01 ",
      gender: "female",
      name: [
        {
          family: "Smith",
          given: ["Katherine", "Katy "],
        },
      ],
      address: [
        {
          line: ["400 Awesome Rd."],
          city: "San Francisco",
          state: "CA",
          postalCode: "99999-4040",
        },
        {
          line: ["401 Awesome Rd.", "Apt 1b"],
          city: "San Francisco ",
          state: "CA",
          postalCode: "99999",
          country: "USA",
        },
      ],
      telecom: [
        {
          system: "phone",
          value: "(888)8887777",
        },
        {
          system: "email",
          value: " katy2020@GMAIL.COM",
        },
        {
          system: "fax",
          value: "8887779",
        },
      ],
      identifier: [],
    };
    const normalizedPatientResource =
      patientResourceToNormalizedAndStringifiedLinkDemographics(patientResource);
    const pass = scoreLinkEpic(normalizedPatient, normalizedPatientResource);
    expect(pass).toBe(false);
  });
  it("check pass scoreLink", async () => {
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
    const normalizedPatient =
      patientCoreDemographicsToNormalizedAndStringifiedLinkDemographics(patient);
    const patientResource: PatientResource = {
      birthDate: " 1900-02-28 ",
      gender: "male",
      name: [
        {
          family: "Smith",
          given: ["John", "Jon "],
        },
      ],
      address: [
        {
          line: ["400 Awesome Rd."],
          city: "San Francisco",
          state: "CA",
          postalCode: "99999-4040",
        },
        {
          line: ["401 Awesome Rd.", "Apt 1b"],
          city: "San Francisco ",
          state: "CA",
          postalCode: "99999",
          country: "USA",
        },
      ],
      telecom: [
        {
          system: "phone",
          value: "1-415-000-0000",
        },
        {
          system: "email",
          value: " JOHN.DOUGLAS@YAHOO.COM",
        },
        {
          system: "fax",
          value: "8887779",
        },
      ],
      identifier: [],
    };
    const normalizedPatientResource =
      patientResourceToNormalizedAndStringifiedLinkDemographics(patientResource);
    const pass = scoreLinkEpic(normalizedPatient, normalizedPatientResource);
    expect(pass).toBe(true);
  });
});
