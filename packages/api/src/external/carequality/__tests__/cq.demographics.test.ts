import { PatientResource } from "@metriport/ihe-gateway-sdk";
import { patientResourceToNormalizedLinkDemographics } from "../patient-demographics";

describe("CQ demographics", () => {
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
        line: ["400 Awesome Road"],
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
        value: "(888)8886666",
      },
      {
        system: "email",
        value: " katy2020@GMAIL.COM",
      },
      {
        value: " queenkaty2020@GMAIL.COM",
      },
    ],
    identifier: [],
  };
  it("normalization", async () => {
    const linkDemographics = patientResourceToNormalizedLinkDemographics(patientResource);
    expect(linkDemographics).toMatchObject({
      dob: "1900-01-01",
      gender: "female",
      names: [
        { firstName: "katherine", lastName: "smith" },
        { firstName: "katy", lastName: "smith" },
      ].map(name => JSON.stringify(name, Object.keys(name).sort())),
      addresses: [
        {
          line: ["400 awesome rd"],
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
      ].map(address => JSON.stringify(address, Object.keys(address).sort())),
      telephoneNumbers: ["8888887777", "8888886666"],
      emails: ["katy2020@gmail.com", "queenkaty2020@gmail.com"],
      driversLicenses: [],
      ssns: [],
    });
  });
});
