import { nanoid } from "./shared";

const defaultId = "2.16.840.1.113883.3.9621.5." + nanoid();

export const makePatient = (id = defaultId) => ({
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
      value: "e48c330b-d0d9-4bbd-9811-9c63cde19c7e",
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
      value: "498651177",
    },
  ],
  name: [
    {
      use: "official",
      family: "Pontes",
      given: [`Paulo ${id}`],
      prefix: ["Mr."],
    },
  ],
  telecom: [
    {
      system: "phone",
      value: "555-677-3119",
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
