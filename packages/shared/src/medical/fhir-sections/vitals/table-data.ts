import { Observation } from "@medplum/fhirtypes";
import { ISO_DATE } from "@metriport/shared/common/date";
import { compareObservationsForDisplay } from "@metriport/shared/medical";
import dayjs from "dayjs";
import { MappedConsolidatedResources, SectionKey, getResourcesFromBundle, getValidCode } from "..";

export type VitalRowData = {
  id: string;
  observation: string;
  mostRecentValue: string;
  mostRecentDate: string;
  originalData: GroupedVitals;
  ehrAction?: string;
};

type DataPoint = {
  value: number;
  date: string;
  unit?: string;
  bp?: BloodPressure | undefined;
  id?: string;
  filename?: string;
};

export type GroupedVitals = {
  title: string;
  mostRecentObservation: Observation;
  sortedPoints?: DataPoint[];
};

export function vitalTableData({ bundle }: { bundle: MappedConsolidatedResources }) {
  const observations = getResourcesFromBundle<Observation>(bundle, "Observation");
  const vitals = getVital(observations);
  const groupedVitals = groupVitals(vitals);

  return {
    key: "vitals" as SectionKey,
    rowData: getVitalRowData({ vitals: groupedVitals }),
  };
}

export function getVital(observations: Observation[]): Observation[] {
  const vital: Observation[] = [];

  for (const observation of observations) {
    const isVital = observation.category?.find(
      ext => ext.coding?.[0]?.code?.toLowerCase() === "vital-signs"
    );

    if (isVital) {
      vital.push(observation);
    }
  }

  return vital;
}

type BloodPressure = {
  systolic: number;
  diastolic: number;
};

type GroupedObservation = {
  rawVital: Observation;
  rawVitalSecondary?: Observation;
  grouping?: string;
  observation: number;
  unit?: string;
  date: string;
  bp?: BloodPressure;
};

export function groupVitals(vitals: Observation[]): GroupedVitals[] {
  const results: GroupedVitals[] = [];
  const observationMap = new Map<string, GroupedObservation[]>();
  vitals.map(v => {
    let title: string;
    const codings = getValidCode(v.code?.coding);
    const displays = codings.map(coding => coding.display);
    if (displays.length) {
      title = Array.from(new Set(displays)).join(", ");
    } else if (v.code?.text) {
      title = v.code.text;
    } else {
      results.push({ title: "-", mostRecentObservation: v });
      return;
    }

    const observationValue = v.valueQuantity?.value ?? v.valueString;
    const date = v.effectiveDateTime ?? v.effectivePeriod?.start;
    if (!date || !observationValue) {
      results.push({ title, mostRecentObservation: v });
      return;
    }

    const observationPoint: GroupedObservation = {
      rawVital: v,
      date,
      observation:
        typeof observationValue === "number" ? observationValue : parseInt(observationValue),
      // TODO: Make sure all data points have the same unit
      unit: v.valueQuantity?.unit?.replace(/[{()}]/g, "") ?? "-",
    };

    title = handleTitleSpecialCases(title, observationPoint);

    const groupedObservation = observationMap.get(title);
    if (groupedObservation) {
      groupedObservation.push(observationPoint);
      observationMap.set(title, groupedObservation);
    } else {
      observationMap.set(title, [observationPoint]);
    }
  });

  handleBloodPressureMapping(observationMap);

  const mainResults: GroupedVitals[] = [];
  Array.from(observationMap.entries()).map(([title, values]) => {
    const sortedPoints = values.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const mostRecent = sortedPoints[sortedPoints.length - 1];
    if (!mostRecent) return;

    mainResults.push({
      title,
      mostRecentObservation: mostRecent.rawVital,
      sortedPoints: sortedPoints.map(p => ({
        value: p.observation,
        date: p.date,
        unit: p.unit ?? "-",
        bp: p.bp ?? undefined,
        id: p.rawVital.id ?? "-",
        filename: p.rawVital.extension?.find(ext => ext.valueString)?.valueString ?? "-",
      })),
    });
  });

  return [...mainResults, ...results];
}

function handleBloodPressureMapping(obsMap: Map<string, GroupedObservation[]>) {
  const bloodPressure = obsMap.get("Blood Pressure");
  if (!bloodPressure) return;

  const groupedBloodPressure: GroupedObservation[] = [];

  const systolicMap = new Map<string, number>();
  const diastolicMap = new Map<string, number>();

  bloodPressure.forEach(bp => {
    if (bp.grouping?.toLowerCase().includes("systolic")) {
      systolicMap.set(bp.date, bp.observation);
    } else if (bp.grouping?.toLowerCase().includes("diastolic")) {
      diastolicMap.set(bp.date, bp.observation);
    }
  });

  bloodPressure.forEach(bp => {
    if (bp.grouping?.toLowerCase().includes("systolic")) {
      const diastolicValue = diastolicMap.get(bp.date);
      if (diastolicValue !== undefined) {
        groupedBloodPressure.push({
          ...bp,
          bp: {
            systolic: bp.observation,
            diastolic: diastolicValue,
          },
        });
      }
    } else if (bp.grouping?.toLowerCase().includes("diastolic")) {
      const systolicValue = systolicMap.get(bp.date);
      if (systolicValue !== undefined) {
        if (
          !groupedBloodPressure.some(
            gbp => gbp.date === bp.date && gbp.bp?.diastolic === bp.observation
          )
        ) {
          groupedBloodPressure.push({
            ...bp,
            bp: {
              systolic: systolicValue,
              diastolic: bp.observation,
            },
          });
        }
      }
    }
  });

  obsMap.set("Blood Pressure", groupedBloodPressure);
}

function getVitalRowData({ vitals }: { vitals: GroupedVitals[] }): VitalRowData[] {
  return vitals
    .map(vitals => ({
      id: vitals.mostRecentObservation.id ?? "-",
      observation: vitals.title ?? getVitalsDisplay(vitals.mostRecentObservation),
      mostRecentValue:
        renderBpValue(vitals.sortedPoints?.[vitals.sortedPoints.length - 1]) ??
        renderVitalsValue(vitals.mostRecentObservation),
      mostRecentDate: getVitalsDate(vitals.mostRecentObservation),
      originalData: vitals,
    }))
    .sort((a, b) =>
      compareObservationsForDisplay(
        a.originalData.mostRecentObservation,
        b.originalData.mostRecentObservation
      )
    );
}

function getVitalsDisplay(vitals: Observation): string {
  const codings = getValidCode(vitals.code?.coding);
  const displays = codings.map(coding => coding.display);

  if (displays.length) {
    return displays.join(", ");
  } else if (vitals.code?.text) {
    return vitals.code.text;
  }

  return "-";
}

function renderVitalsValue(vitals: Observation) {
  if (vitals.valueQuantity) {
    const value = vitals.valueQuantity?.value;
    const unit = vitals.valueQuantity?.unit?.replace(/[{()}]/g, "");

    return unit ? `${value} ${unit}` : `${value}`;
  } else if (vitals.valueCodeableConcept) {
    return (
      vitals.valueCodeableConcept?.text ??
      getValidCode(vitals.valueCodeableConcept.coding)[0]?.display ??
      "-"
    );
  } else {
    return "-";
  }
}

function getVitalsDate(vitals: Observation): string {
  return dayjs(vitals.effectiveDateTime).format(ISO_DATE);
}

export function renderBpValue(dataPoint: DataPoint | undefined): string | undefined {
  const bp = dataPoint?.bp;
  if (!bp) return undefined;

  return `${bp.systolic}/${bp.diastolic} ${dataPoint.unit}`;
}

function handleTitleSpecialCases(title: string, observationPoint: GroupedObservation): string {
  let updatedTitle = title;
  if (
    title.toLowerCase().includes("blood pressure") ||
    title.toLowerCase().includes("bp sys") ||
    title.toLowerCase().includes("bp dias")
  ) {
    observationPoint.grouping = title;
    updatedTitle = "Blood Pressure";
  }

  if (title.toLowerCase().includes("bmi")) {
    updatedTitle = "Body Mass Index (BMI)";
  }

  return updatedTitle;
}
