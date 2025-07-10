/**
 * Sample resources for testing.
 */
export const chronicCondition = {
  resourceType: "Condition",
  id: "condition1",
  extension: [
    {
      url: "http://hl7.org/fhir/StructureDefinition/condition-related",
      valueCoding: { code: "C" },
    },
  ],
  code: {
    coding: [{ code: "1054510" }],
  },
};

export const nonChronicCondition = {
  resourceType: "Condition",
  id: "condition2",
  extension: [
    {
      url: "http://hl7.org/fhir/StructureDefinition/condition-related",
      valueCoding: { code: "NC" },
    },
  ],
  code: {
    coding: [{ code: "1054510" }],
  },
};

export const unknownChronicityCondition = {
  resourceType: "Condition",
  id: "condition3",
  extension: [
    {
      url: "http://hl7.org/fhir/StructureDefinition/condition-related",
      valueCoding: { code: "U" },
    },
  ],
  code: {
    coding: [{ code: "1054510" }],
  },
};

export const labDateObservationPre20240101 = {
  resourceType: "Observation",
  id: "lab1",
  category: [
    {
      coding: [{ code: "laboratory" }],
    },
  ],
  code: {
    coding: [{ system: "http://loinc.org", code: "718-7" }],
  },
  effectiveDateTime: "2023-12-31T00:00:00Z",
};

export const labDateObservationOn20240101 = {
  resourceType: "Observation",
  id: "lab2",
  category: [
    {
      coding: [{ code: "laboratory" }],
    },
  ],
  code: {
    coding: [{ system: "http://loinc.org", code: "718-7" }],
  },
  effectiveDateTime: "2024-01-01T00:00:00Z",
};

export const labLoincCode1 = "1234-5";
export const labLoincCodeObservationCode1 = {
  resourceType: "Observation",
  id: "lab3",
  category: [
    {
      coding: [{ code: "laboratory" }],
    },
  ],
  code: {
    coding: [{ system: "http://loinc.org", code: labLoincCode1 }],
  },
  effectiveDateTime: "2024-05-01T00:00:00Z",
};

export const labLoincCode2 = "1234-6";
export const labLoincCodeObservationCode2 = {
  resourceType: "Observation",
  id: "lab4",
  category: [
    {
      coding: [{ code: "laboratory" }],
    },
  ],
  code: {
    coding: [{ system: "http://loinc.org", code: labLoincCode2 }],
  },
  effectiveDateTime: "2024-05-01T00:00:00Z",
};
export const labLoincCodeObservationCode2Duplicate = {
  resourceType: "Observation",
  id: "lab5",
  category: [
    {
      coding: [{ code: "laboratory" }],
    },
  ],
  code: {
    coding: [{ system: "http://loinc.org", code: labLoincCode2 }],
  },
  effectiveDateTime: "2024-05-01T00:00:00Z",
};

export const vitalDateObservationPre20240101 = {
  resourceType: "Observation",
  id: "vital1",
  category: [
    {
      coding: [{ code: "vital-signs" }],
    },
  ],
  code: {
    coding: [{ code: "8302-2" }],
  },
  effectiveDateTime: "2023-12-31T00:00:00Z",
};

export const vitalDateObservationOn20240101 = {
  resourceType: "Observation",
  id: "vital2",
  category: [
    {
      coding: [{ code: "vital-signs" }],
    },
  ],
  code: {
    coding: [{ system: "http://loinc.org", code: "8302-2" }],
  },
  effectiveDateTime: "2024-01-01T00:00:00Z",
};

export const vitalLoincCode1 = "29463-7";
export const vitalLoincCodeObservationCode1 = {
  resourceType: "Observation",
  id: "vital3",
  category: [
    {
      coding: [{ code: "vital-signs" }],
    },
  ],
  code: {
    coding: [{ system: "http://loinc.org", code: vitalLoincCode1 }],
  },
  effectiveDateTime: "2024-05-01T00:00:00Z",
};

export const vitalLoincCode2 = "29464-5";
export const vitalLoincCodeObservationCode2 = {
  resourceType: "Observation",
  id: "vital4",
  category: [
    {
      coding: [{ code: "vital-signs" }],
    },
  ],
  code: {
    coding: [{ system: "http://loinc.org", code: vitalLoincCode2 }],
  },
  effectiveDateTime: "2024-05-01T00:00:00Z",
};

/**
 * Sample write-back filters for each filter type.
 */
export const chronicityFilterChronic = {
  problems: {
    chronicityFilter: "chronic",
  },
};

export const chronicityFilterNonChronic = {
  problems: {
    chronicityFilter: "non-chronic",
  },
};

export const chronicityFilterAll = {
  problems: {
    chronicityFilter: "all",
  },
};

export const chronicityFilterUndefined = {
  problems: {
    chronicityFilter: undefined,
  },
};

export const labDateFilterOn20240101 = {
  lab: {
    relativeDateRange: {
      years: 1,
      months: 0,
      days: 0,
    },
  },
};

export const labDateFilterOn20250101 = {
  lab: {
    relativeDateRange: {
      years: 0,
      months: 0,
      days: 0,
    },
  },
};

export const labDateFilterUndefined = {
  lab: {
    relativeDateRange: undefined,
  },
};

export const labLoincCodesFilterCode1 = {
  lab: {
    loincCodes: [labLoincCode1],
  },
};

export const labLoincCodesFilterCode2 = {
  lab: {
    loincCodes: [labLoincCode2],
  },
};

export const labLoincCodesFilterUndefined = {
  lab: {
    loincCodes: undefined,
  },
};

export const labMinCountPerCodeFilterMin1 = {
  lab: {
    minCountPerCode: 1,
  },
};

export const labMinCountPerCodeFilterMin2 = {
  lab: {
    minCountPerCode: 2,
  },
};

export const labMinCountPerCodeFilterUndefined = {
  lab: {
    minCountPerCode: undefined,
  },
};

export const vitalDateFilterPost20240101 = {
  vital: {
    relativeDateRange: {
      years: 1,
      months: 0,
      days: 0,
    },
  },
};

export const vitalDateFilterPost20250101 = {
  vital: {
    relativeDateRange: {
      years: 0,
      months: 0,
      days: 0,
    },
  },
};

export const vitalDateFilterUndefined = {
  vital: {
    relativeDateRange: undefined,
  },
};

export const vitalLoincCodesFilterCode1 = {
  vital: {
    loincCodes: [vitalLoincCode1],
  },
};

export const vitalLoincCodesFilterCode2 = {
  vital: {
    loincCodes: [vitalLoincCode2],
  },
};

export const vitalLoincCodesFilterUndefined = {
  vital: {
    loincCodes: undefined,
  },
};
