import { Observation } from "@medplum/fhirtypes";

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

type VitalsLoinc = (typeof vitalsLoinc)[keyof typeof vitalsLoinc];

const vitalsDisplayOrder: Record<VitalsLoinc, number> = Object.values(vitalsLoinc).reduce(
  (acc, code, index) => ({
    ...acc,
    [code]: index,
  }),
  {} as Record<VitalsLoinc, number>
);

/**
 * Gets the display priority for an observation code. Useful for sorting.
 */
function _getDisplayOrder(code: string | undefined): number {
  if (!code) return Number.MAX_SAFE_INTEGER;
  return vitalsDisplayOrder[code as VitalsLoinc] ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Stable sort that puts VITALS_LOINC codes first, then defaults to the input order.
 */
export function compareObservationsForDisplay(a: Observation, b: Observation): number {
  const orderA = _getDisplayOrder(getObservationCode(a));
  const orderB = _getDisplayOrder(getObservationCode(b));
  return orderA - orderB;
}

export function sortObservationsForDisplay(observations: Observation[]): Observation[] {
  return [...observations].sort(compareObservationsForDisplay);
}

export function getObservationCode(observation: Observation): string | undefined {
  return observation.code?.coding?.find(coding => coding?.code)?.code;
}

export function getObservationUnits(observation: Observation): string | undefined {
  return observation.valueQuantity?.unit?.replace(/[{()}]/g, "").toLowerCase();
}
