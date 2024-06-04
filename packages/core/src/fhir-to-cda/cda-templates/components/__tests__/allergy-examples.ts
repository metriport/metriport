import { AllergyIntolerance } from "@medplum/fhirtypes";

export const allergyMedication: Partial<AllergyIntolerance> = {
  category: ["medication"],
  code: {
    coding: [
      {
        system: "http://www.nlm.nih.gov/research/umls/rxnorm",
        code: "7980",
        display: "Penicillin G",
      },
    ],
  },
  clinicalStatus: {
    coding: [
      {
        system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
        code: "active",
      },
    ],
  },
  reaction: [
    {
      substance: {
        coding: [
          {
            code: "70618",
            display: "Penicillin",
            system: "http://www.nlm.nih.gov/research/umls/rxnorm",
          },
        ],
      },
      severity: "severe",
      manifestation: [
        {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "247472004",
              display: "Hives",
            },
          ],
        },
      ],
      onset: "2008-02-26T08:05:00.800Z",
    },
  ],
  onsetDateTime: "1998-05-01T00:00:00.000Z",
  note: [
    {
      text: "rash, itching/swelling and trouble breathing",
    },
  ],
};

export const allergyFood: Partial<AllergyIntolerance> = {
  category: ["food"],
  code: {
    coding: [
      {
        system: "http://snomed.info/sct",
        code: "227493005",
        display: "Cashew nuts",
      },
    ],
  },
  clinicalStatus: {
    coding: [
      {
        system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
        code: "active",
      },
    ],
  },
  reaction: [
    {
      substance: {
        coding: [
          {
            system: "http://www.nlm.nih.gov/research/umls/rxnorm",
            code: "1160593",
            display: "cashew nut allergenic extract Injectable Product",
          },
        ],
      },
      manifestation: [
        {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "39579001",
              display: "Anaphylactic reaction",
            },
          ],
        },
      ],
      onset: "2012-06-12",
    },
  ],
  onsetDateTime: "2012-06-12T00:00:00.000Z",
  note: [
    {
      text: "Challenge Protocol. Severe reaction to subcutaneous cashew extract. Epinephrine administered",
    },
  ],
};
