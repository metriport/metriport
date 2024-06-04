import { Observation } from "@medplum/fhirtypes";

export const observationMentalStatus: Partial<Observation> = {
  status: "final",
  category: [
    {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "social-history",
          display: "Social History",
        },
      ],
    },
  ],
  code: {
    coding: [
      {
        system: "http://loinc.org",
        code: "LG51306-5",
        display: "SDOH",
      },
    ],
    text: "Social determinants of health",
  },
  valueCodeableConcept: {
    coding: [
      {
        code: "score",
        display: "Low risk",
        system: "2.16.840.1.113883.5.83",
      },
    ],
    text: "Low risk",
  },
  effectiveDateTime: "2012-07-23T17:16:00.324-07:00",
  issued: "2012-07-23T17:16:00.324-07:00",
  interpretation: [
    {
      coding: [
        {
          code: "L",
          display: "Low risk",
          system: "2.16.840.1.113883.5.83",
        },
      ],
      text: "Low risk",
    },
  ],
  component: [
    {
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "71802-3",
            display: "What is your living situation today?",
          },
        ],
        text: "What is your living situation today?",
      },
      valueCodeableConcept: {
        coding: [
          {
            system: "http://loinc.org",
            code: "LA31993-1",
            display: "I have a steady place to live",
          },
        ],
        text: "I have a steady place to live",
      },
      interpretation: [
        {
          coding: [
            {
              code: "score",
              display: "0",
            },
          ],
        },
      ],
    },
    {
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "96778-6",
            display:
              "Think about the place you live. Do you have problems with any of the following?",
          },
        ],
        text: "Think about the place you live. Do you have problems with any of the following?",
      },
      valueCodeableConcept: {
        coding: [{ system: "http://loinc.org", code: "LA9-3", display: "None of the above" }],
        text: "None of the above",
      },
      interpretation: [
        {
          coding: [
            {
              code: "score",
              display: "0",
            },
          ],
        },
      ],
    },
  ],
};
