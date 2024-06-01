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
