import { Observation } from "@medplum/fhirtypes";

export const vitalSignObservationTemplate: Partial<Observation> = {
  resourceType: "Observation",
  status: "final",
  category: [
    {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "vital-signs",
          display: "Vital signs",
        },
      ],
    },
  ],
  code: {
    coding: [
      {
        system: "http://loinc.org",
        code: "72514-3",
        display: "Pain severity - 0-10 verbal numeric rating [Score] - Reported",
      },
    ],
    text: "Pain severity - 0-10 verbal numeric rating [Score] - Reported",
  },
  effectiveDateTime: "2013-09-19T18:14:30-07:00",
  issued: "2013-09-19T18:14:30.324-07:00",
  valueQuantity: {
    value: 0,
    unit: "{score}",
    system: "http://unitsofmeasure.org",
    code: "{score}",
  },
};

export const obsHeartRate: Partial<Observation> = {
  code: {
    text: "Heart rate",
    coding: [{ code: "8867-4", system: "http://loinc.org" }],
  },
  effectiveDateTime: "2013-09-19T18:14:30-07:00",
  valueQuantity: { value: 92, unit: "/min", system: "http://unitsofmeasure.org" },
};

export const obsTemperature: Partial<Observation> = {
  code: {
    text: "Body temperature",
    coding: [{ code: "8310-5", system: "http://loinc.org" }],
  },
  effectiveDateTime: "2013-09-19T18:14:30-07:00",
  valueQuantity: { value: 36.72, unit: "Cel", system: "http://unitsofmeasure.org" },
};

export const obsRespiratoryRate: Partial<Observation> = {
  code: {
    text: "Respiratory rate",
    coding: [{ code: "9279-1", system: "http://loinc.org" }],
  },
  effectiveDateTime: "2013-09-19T18:14:30-07:00",
  valueQuantity: { value: 16, unit: "/min", system: "http://unitsofmeasure.org" },
};

export const obsWeight: Partial<Observation> = {
  code: {
    text: "Body weight",
    coding: [{ code: "29463-7", system: "http://loinc.org" }],
  },
  effectiveDateTime: "2013-09-02T18:14:30-07:00",
  valueQuantity: { value: 63.504, unit: "kg", system: "http://unitsofmeasure.org" },
};

export const obsSystolic: Partial<Observation> = {
  code: {
    text: "Systolic blood pressure",
    coding: [{ code: "8480-6", system: "http://loinc.org" }],
  },
  effectiveDateTime: "2013-09-02T18:14:30-07:00",
  valueQuantity: { value: 104, unit: "mm[Hg]", system: "http://unitsofmeasure.org" },
};

export const obsDiastolic: Partial<Observation> = {
  code: {
    text: "Diastolic blood pressure",
    coding: [{ code: "8462-4", system: "http://loinc.org" }],
  },
  effectiveDateTime: "2013-09-02T18:14:30-07:00",
  valueQuantity: { value: 78, unit: "mm[Hg]", system: "http://unitsofmeasure.org" },
};

export const obsHeight: Partial<Observation> = {
  code: {
    coding: [
      {
        system: "http://loinc.org",
        code: "8302-2",
        display: "Body Height",
      },
    ],
    text: "Body Height",
  },
  effectiveDateTime: "2013-09-02T18:14:30-07:00",
  valueQuantity: {
    value: 172.3,
    unit: "cm",
    system: "http://unitsofmeasure.org",
    code: "cm",
  },
};
