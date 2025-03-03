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

export const valueHeight = {
  value: 150,
  unit: "cm",
  system: "http://unitsofmeasure.org",
};

export const valueQuantityTempCel = {
  value: 37.0,
  unit: "Cel",
  system: "http://unitsofmeasure.org",
};

export const valueQuantityTempF = {
  value: 100.0,
  unit: "degF",
  system: "http://unitsofmeasure.org",
};

export const valueQuantityHeightCm = {
  value: 160,
  unit: "cm",
  system: "http://unitsofmeasure.org",
};

export const valueQuantityHeightIn = {
  value: 60,
  unit: "[in_us]",
  system: "http://unitsofmeasure.org",
};

export const valueQuantityWeightKg = {
  value: 68,
  unit: "kg",
  system: "http://unitsofmeasure.org",
};

export const valueQuantityWeightG = {
  value: 12_500,
  unit: "g",
  system: "http://unitsofmeasure.org",
};

export const valueQuantityWeightLb = {
  value: 160,
  unit: "[lb_av]",
  system: "http://unitsofmeasure.org",
};

export const valueQuantityHemoglobin = {
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
