import { Observation } from "@medplum/fhirtypes";
import { BadRequestError, JwtTokenInfo } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { writeBackGroupedVitals as writeBackGroupedVitalsAthena } from "../../athenahealth/command/write-back/grouped-vitals";
import { writeBackGroupedVitals as writeBackGroupedVitalsElation } from "../../elation/command/write-back/grouped-vitals";
import {
  formatDate,
  getObservationObservedDate,
  getValidCode,
  GroupedObservation,
  GroupedVitals,
  GroupedVitalsByDate,
  handleBloodPressureMapping,
  handleTitleSpecialCases,
} from "../../shared";

export type EhrGroupedVitals = GroupedVitals | GroupedVitalsByDate;

export type WriteBackGroupedVitalsRequest = {
  ehr: EhrSource;
  tokenInfo?: JwtTokenInfo;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  groupedVitals: EhrGroupedVitals;
};

export type WriteBackGroupedVitalsClientRequest = Omit<WriteBackGroupedVitalsRequest, "ehr">;

export async function writeBackGroupedVitals({
  ehr,
  ...params
}: WriteBackGroupedVitalsRequest): Promise<void> {
  const handler = getEhrWriteBackGroupedVitalsHandler(ehr);
  return await handler({ ...params });
}

type WriteBackGroupedVitalsFn = (params: WriteBackGroupedVitalsClientRequest) => Promise<void>;

type WriteBackGroupedVitalsFnMap = Record<EhrSource, WriteBackGroupedVitalsFn | undefined>;

const ehrWriteBackGroupedVitalsMap: WriteBackGroupedVitalsFnMap = {
  [EhrSources.canvas]: undefined,
  [EhrSources.athena]: writeBackGroupedVitalsAthena,
  [EhrSources.elation]: writeBackGroupedVitalsElation,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
};

function getEhrWriteBackGroupedVitalsHandler(ehr: EhrSource): WriteBackGroupedVitalsFn {
  const handler = ehrWriteBackGroupedVitalsMap[ehr];
  if (!handler) {
    throw new BadRequestError("Could not find handler to write back grouped vitals", undefined, {
      ehr,
    });
  }
  return handler;
}

export const writeBackGroupedVitalsEhrs = [EhrSources.athena, EhrSources.elation];
export function isWriteBackGroupedVitalsEhr(ehr: EhrSource): boolean {
  return writeBackGroupedVitalsEhrs.includes(ehr);
}

export function isGroupedVitalsByDate(val: unknown): val is GroupedVitalsByDate {
  return Array.isArray(val) && val.length === 2 && val[0] instanceof Date && Array.isArray(val[1]);
}

export function isGroupedVitalsByCode(val: unknown): val is GroupedVitals {
  return !!val && typeof val === "object" && "mostRecentObservation" in val;
}

export function groupVitalsByDate({
  observations,
}: {
  observations: Observation[];
}): GroupedVitalsByDate[] {
  const groupedVitals: Record<string, Observation[]> = observations.reduce((acc, observation) => {
    const chartDate = getObservationObservedDate(observation);
    if (!chartDate) return acc;
    const chartDateString = formatDate(chartDate, "YYYY-MM-DD");
    if (!chartDateString) return acc;
    const existingVital = acc[chartDateString];
    if (!existingVital) {
      acc[chartDateString] = [observation];
    } else {
      existingVital.push(observation);
    }
    return acc;
  }, {} as Record<string, Observation[]>);
  return Object.entries(groupedVitals).map(([chartDate, observations]) => [
    buildDayjs(chartDate).toDate(),
    observations,
  ]);
}

export function groupVitalsByCode({
  observations,
}: {
  observations: Observation[];
}): GroupedVitals[] {
  const results: GroupedVitals[] = [];
  const observationMap = new Map<string, GroupedObservation[]>();
  observations.map(v => {
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

    const observationUnit = v.valueQuantity?.unit?.replace(/[{()}]/g, "");
    const observationPoint: GroupedObservation = {
      rawVital: v,
      date,
      observation:
        typeof observationValue === "number" ? observationValue : parseInt(observationValue),
      ...(observationUnit && { unit: observationUnit }),
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
        ...(p.unit && { unit: p.unit }),
        ...(p.bp && { bp: p.bp }),
      })),
    });
  });

  return [...mainResults, ...results];
}

export function getEhrGroupedVitals({
  ehr,
  vitals,
}: {
  ehr: EhrSource;
  vitals: Observation[];
}): EhrGroupedVitals[] {
  if (ehr === EhrSources.athena) {
    return groupVitalsByCode({ observations: vitals });
  }
  if (ehr === EhrSources.elation) {
    return groupVitalsByDate({ observations: vitals });
  }
  throw new BadRequestError("Could not find handler to get grouped vitals", undefined, {
    ehr,
  });
}
