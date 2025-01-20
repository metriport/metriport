import { Quantity } from "@medplum/fhirtypes";

export const snomedCodeTobacco = {
  coding: [
    {
      system: "http://snomed.info/sct",
      code: "229819007",
      display: "Tobacco use and exposure",
    },
  ],
};

export const loincCodeTobacco = {
  coding: [
    {
      system: "http://loinc.org",
      code: "88031-0",
      display: "Smokeless tobacco status",
    },
  ],
};

export const valueConceptTobacco = {
  coding: [
    {
      system: "http://snomed.info/sct",
      code: "451381000124107",
      display: "Smokeless tobacco non-user",
    },
  ],
};

export const valueQuantityTempCel: Quantity = {
  value: 37.0,
  unit: "Cel",
  system: "http://unitsofmeasure.org",
};

export const valueQuantityTempF: Quantity = {
  value: 100.0,
  unit: "degF",
  system: "http://unitsofmeasure.org",
};

export const valueQuantityHeightCm: Quantity = {
  value: 160,
  unit: "cm",
  system: "http://unitsofmeasure.org",
};

export const valueQuantityHeightIn: Quantity = {
  value: 60,
  unit: "in",
  system: "http://unitsofmeasure.org",
};

export const valueQuantityWeightKg: Quantity = {
  value: 68,
  unit: "kg",
  system: "http://unitsofmeasure.org",
};

export const valueQuantityWeightLb: Quantity = {
  value: 160,
  unit: "lb",
  system: "http://unitsofmeasure.org",
};

export const valueQuantityHemoglobin: Quantity = {
  value: 14,
  unit: "g/dL",
  system: "http://unitsofmeasure.org",
};

export const referenceRangeHemoglobin = [
  {
    low: {
      value: 12,
      unit: "g/dL",
      system: "http://unitsofmeasure.org",
    },
    high: {
      value: 16,
      unit: "g/dL",
      system: "http://unitsofmeasure.org",
    },
  },
];

export const referenceRangeHemoglobinNoUnit = [
  {
    low: {
      value: 12,
      system: "http://unitsofmeasure.org",
    },
    high: {
      value: 16,
      system: "http://unitsofmeasure.org",
    },
  },
];
