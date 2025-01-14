import { Observation } from "@medplum/fhirtypes";

// Not sure the names of the codes are correct,
// but they're related and should be grouped together regardless
const oxygenSaturationLoinc = {
  SpO2: "2708-6",
  Sp02ByPulseOximetry: "59408-5",
  Sp02ByDirectSampling: "20509-6",
  Sp02InCapillaryBloodByPulseOximetry: "59466-1",
  Sp02OnRoomAir: "59410-1",
} as const;

const vitalsLoinc = {
  HeartRate: "8867-4",
  BloodPressureSystolic: "8480-6",
  BloodPressureDiastolic: "8462-4",
  RespiratoryRate: "9279-1",
  InhaledOxygenFlowRate: "3151-8",
  Temperature: "8310-5",
  ...oxygenSaturationLoinc,
  Weight: "29463-7",
  Height: "8302-2",
  BMI: "39156-5",
} as const;

// Create a type from the values
type VitalsLOINC = (typeof vitalsLoinc)[keyof typeof vitalsLoinc];

// Create display order based on the order of values in VITALS_LOINC
const VITALS_DISPLAY_ORDER: Record<VitalsLOINC, number> = Object.values(vitalsLoinc).reduce(
  (acc, code, index) => ({
    ...acc,
    [code]: index,
  }),
  {} as Record<VitalsLOINC, number>
);

// Stable sort that puts VITALS_LOINC codes first, then defaults to the upstream order.
export const observationDisplayComparator = (a: Observation, b: Observation): number => {
  const aCode = getObservationCode(a) as VitalsLOINC | undefined;
  const bCode = getObservationCode(b) as VitalsLOINC | undefined;
  const orderA = aCode ? VITALS_DISPLAY_ORDER[aCode] : Number.MAX_SAFE_INTEGER;
  const orderB = bCode ? VITALS_DISPLAY_ORDER[bCode] : Number.MAX_SAFE_INTEGER;

  return orderA - orderB;
};

export const sortObservationsForDisplay = (observations: Observation[]): Observation[] => {
  return [...observations].sort(observationDisplayComparator);
};

export function getObservationCode(observation: Observation): string | undefined {
  return observation.code?.coding?.find(coding => coding?.code)?.code;
}

export function getObservationUnits(observation: Observation): string | undefined {
  return observation.valueQuantity?.unit?.replace(/[{()}]/g, "").toLowerCase();
}
