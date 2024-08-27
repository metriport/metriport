export const unknownManifestation = [
  {
    coding: [
      {
        system: "http://terminology.hl7.org/ValueSet/v3-Unknown",
        code: "UNK",
        display: "unknown",
      },
    ],
    text: "unknown",
  },
];

export const manifestationAnaphylactic = [
  {
    coding: [
      {
        system: "http://snomed.info/sct",
        code: "39579001",
        display: "Anaphylactic reaction",
      },
    ],
  },
];

export const manifestationSkinEruption = [
  {
    coding: [
      {
        system: "http://snomed.info/sct",
        code: "271807003",
        display: "Eruption of skin (disorder)",
      },
    ],
    text: "Eruption of skin (disorder)",
  },
];

export const substanceNsaid = {
  coding: [
    {
      system: "http://snomed.info/sct",
      code: "16403005",
      display: "Non-steroidal anti-inflammatory agent (product)",
    },
  ],
  text: "Non-steroidal anti-inflammatory agent (product)",
};

export const substanceCashew = {
  coding: [
    {
      system: "http://www.nlm.nih.gov/research/umls/rxnorm",
      code: "1160593",
      display: "cashew nut allergenic extract Injectable Product",
    },
  ],
};

export const noKnownAllergiesSubstance = {
  coding: [
    {
      system: "urn:oid:2.16.840.1.113883.4.296",
      code: "900388",
      display: "No Known Allergies",
    },
  ],
};
