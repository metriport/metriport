import { faker } from "@faker-js/faker";
import { Patient } from "@medplum/fhirtypes";

const defaultId = () => faker.string.uuid();

export type PatientWithId = Omit<Patient, "id"> & Required<Pick<Patient, "id">>;

export const makePatient = ({
  id = defaultId(),
  firstName = faker.person.firstName(),
  lastName = faker.person.lastName(),
  phoneNumber = faker.phone.number("555-###-###"),
}: {
  id?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
} = {}): PatientWithId => ({
  resourceType: "Patient",
  id,
  extension: [
    {
      url: "http://hl7.patient/fhir/us/core/StructureDefinition/us-core-race",
      extension: [
        {
          url: "ombCategory",
          valueCoding: {
            system: "urn:oid:2.16.840.1.113883.6.238",
            code: "2106-3",
            display: "White",
          },
        },
        {
          url: "text",
          valueString: "White",
        },
      ],
    },
    {
      url: "http://hl7.patient/fhir/us/core/StructureDefinition/us-core-ethnicity",
      extension: [
        {
          url: "ombCategory",
          valueCoding: {
            system: "urn:oid:2.16.840.1.113883.6.238",
            code: "2186-5",
            display: "Not Hispanic or Latino",
          },
        },
        {
          url: "text",
          valueString: "Not Hispanic or Latino",
        },
      ],
    },
    {
      url: "http://hl7.patient/fhir/StructureDefinition/patient-mothersMaidenName",
      valueString: "Deadra347 Borer986",
    },
    {
      url: "http://hl7.patient/fhir/us/core/StructureDefinition/us-core-birthsex",
      valueCode: "M",
    },
    {
      url: "http://hl7.patient/fhir/StructureDefinition/patient-birthPlace",
      valueAddress: {
        city: "Billerica",
        state: "Massachusetts",
        country: "US",
      },
    },
    {
      url: "http://synthetichealth.github.io/synthea/disability-adjusted-life-years",
      valueDecimal: 14.062655945052095,
    },
    {
      url: "http://synthetichealth.github.io/synthea/quality-adjusted-life-years",
      valueDecimal: 58.93734405494791,
    },
  ],
  identifier: [
    {
      system: "https://github.com/synthetichealth/synthea",
      value: faker.string.uuid(),
    },
    {
      type: {
        coding: [
          {
            system: "http://terminology.hl7.patient/CodeSystem/v2-0203",
            code: "DL",
            display: "Driver's License",
          },
        ],
        text: "Driver's License",
      },
      system: "urn:oid:2.16.840.1.113883.4.3.49",
      value: faker.number.int({ min: 10_000, max: 99_999 }).toString(),
    },
  ],
  name: [
    {
      use: "official",
      family: lastName,
      given: [firstName],
      prefix: [],
    },
  ],
  telecom: [
    {
      system: "phone",
      value: phoneNumber,
      use: "home",
    },
  ],
  gender: "male",
  birthDate: "1975-05-05",
  address: [
    {
      line: ["Brasil St"],
      city: "Brasil",
      state: "California",
      postalCode: "12345",
      country: "US",
    },
  ],
  multipleBirthBoolean: false,
  communication: [
    {
      language: {
        coding: [
          {
            system: "urn:ietf:bcp:47",
            code: "en-US",
            display: "English",
          },
        ],
        text: "English",
      },
    },
  ],
});
