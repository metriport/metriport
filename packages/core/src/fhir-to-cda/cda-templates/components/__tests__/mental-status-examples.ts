import { Observation } from "@medplum/fhirtypes";

export const observationMentalStatus: Partial<Observation> = {
  status: "final",
  category: [
    {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "survey",
          display: "Survey",
        },
      ],
    },
  ],
  code: {
    coding: [
      {
        system: "http://loinc.org",
        code: "44249-1",
        display: "PHQ-9 quick depression assessment panel [Reported.PHQ]",
      },
    ],
    text: "PHQ-9 quick depression assessment panel [Reported.PHQ]",
  },
  valueCodeableConcept: {
    coding: [
      {
        code: "L",
        display: "Low risk",
        system: "2.16.840.1.113883.5.83",
      },
    ],
    text: "Low risk",
  },
  effectiveDateTime: "2012-07-23T17:16:00.324-07:00",
  issued: "2012-07-23T17:16:00.324-07:00",
  component: [
    {
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "44250-9",
            display:
              "How often in the past two weeks have you had little interest or pleasure in doing things?",
          },
        ],
        text: "How often in the past two weeks have you had little interest or pleasure in doing things?",
      },
      valueCodeableConcept: {
        coding: [{ system: "http://loinc.org", code: "LA6568-5", display: "Not at all" }],
        text: "Not at all",
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
            code: "44255-8",
            display:
              "How often in the past two weeks have you been feeling down, depressed, or hopeless?",
          },
        ],
        text: "How often in the past two weeks have you been feeling down, depressed, or hopeless?",
      },
      valueCodeableConcept: {
        coding: [{ system: "http://loinc.org", code: "LA6568-5", display: "Not at all" }],
        text: "Not at all",
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
            code: "44259-0",
            display:
              "How often in the past two weeks have you had trouble falling or staying asleep, or sleeping too much?",
          },
        ],
        text: "How often in the past two weeks have you had trouble falling or staying asleep, or sleeping too much?",
      },
      valueCodeableConcept: {
        coding: [{ system: "http://loinc.org", code: "LA6568-5", display: "Not at all" }],
        text: "Not at all",
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
