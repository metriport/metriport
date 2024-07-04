import { Condition } from "@medplum/fhirtypes";

export const conditionNicotine: Partial<Condition> = {
  code: {
    coding: [
      {
        system: "2.16.840.1.113883.6.90",
        code: "F17.200",
        display: "NICOTINE DEPENDENCE, UNSP, UNCOMPLI",
      },
    ],
    text: "NICOTINE DEPENDENCE, UNSP, UNCOMPLI",
  },
  note: [
    {
      text: "Smoking cessation advised, counseled on smoking effects, f/u with pcp for monitoring",
    },
  ],
};

export const conditionHyperlipidemia: Partial<Condition> = {
  code: {
    text: "Hyperlipidemia, unspecified hyperlipidemia type",
    coding: [
      {
        system: "http://hl7.org/fhir/sid/icd-10-cm",
        code: "E78.5",
        display: "Hyperlipidemia, unspecified hyperlipidemia type",
      },
    ],
  },
};

export const conditionHeartAttack: Partial<Condition> = {
  code: {
    coding: [
      {
        system: "http://snomed.info/sct",
        code: "315619001",
        display: "Myocardial Infarction",
      },
    ],
    text: "Heart Attack",
  },
  onsetAge: {
    value: 88,
    unit: "yr",
    system: "http://unitsofmeasure.org",
    code: "a",
  },
  note: [
    {
      text: "Went to see the Stanley Cup finals. At least his team won.",
    },
  ],
};

export const conditionStroke: Partial<Condition> = {
  code: {
    coding: [
      {
        system: "http://snomed.info/sct",
        code: "371041009",
        display: "Embolic Stroke",
      },
    ],
    text: "Stroke",
  },
  onsetAge: {
    value: 56,
    unit: "yr",
    system: "http://unitsofmeasure.org",
    code: "a",
  },
};
