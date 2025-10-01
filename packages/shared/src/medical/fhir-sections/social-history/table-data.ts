import { Observation } from "@medplum/fhirtypes";
import { ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import {
  getValidCode,
  MappedConsolidatedResources,
  getResourcesFromBundle,
  getKnownTitle,
  SectionKey,
} from "..";

export type SocialHistoryRowData = {
  id: string;
  observation: string;
  value: string;
  date: string;
};

export type GroupedSocial = {
  title: string;
  mostRecentObservation: Observation;
  sortedPoints: DataPoint[];
};

type DataPoint = {
  value: string;
  date: string | undefined;
};

type GroupedObservation = {
  rawSocial: Observation;
  value: string;
  date: string | undefined;
};

export function socialHistoryTableData({ bundle }: { bundle: MappedConsolidatedResources }) {
  const observations = getResourcesFromBundle<Observation>(bundle, "Observation");
  const socialHistories = getSocialHistory(observations);

  const groupedSocialHistories = groupSocialHistories(socialHistories);

  return {
    key: "social-history" as SectionKey,
    rowData: getSocialHistoryRowData({ socialHistories: groupedSocialHistories }),
  };
}

export function getSocialHistory(observations: Observation[]): Observation[] {
  const socialHistory: Observation[] = [];

  for (const observation of observations) {
    const isSocialHistory = observation.category?.find(
      ext => ext.coding?.[0]?.code?.toLowerCase() === "social-history"
    );

    if (isSocialHistory) {
      socialHistory.push(observation);
    }
  }

  return socialHistory;
}

export function groupSocialHistories(socialHistories: Observation[]): GroupedSocial[] {
  const results: GroupedSocial[] = [];
  const observationMap = new Map<string, GroupedObservation[]>();

  socialHistories.map(social => {
    const title = getSocialHistoryTitles(social);
    const observationValue = getSocialHistoryValue(social);
    if (!observationValue) return;

    const date = getSocialHistoryDate(social);
    const observationPoint: GroupedObservation = {
      rawSocial: social,
      date,
      value: observationValue,
    };

    const groupedObservation = observationMap.get(title);
    if (groupedObservation) {
      groupedObservation.push(observationPoint);
      observationMap.set(title, groupedObservation);
    } else {
      observationMap.set(title, [observationPoint]);
    }
  });

  Array.from(observationMap.entries()).map(([title, values]) => {
    const sortedPoints = values.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const mostRecent = sortedPoints[sortedPoints.length - 1];
    if (!mostRecent) return;
    results.push({
      title,
      mostRecentObservation: mostRecent.rawSocial,
      sortedPoints: sortedPoints.map(p => ({
        value: p.value,
        date: p.date,
      })),
    });
  });
  return results;
}

function getSocialHistoryTitles(socialHistory: Observation): string {
  const codings = getValidCode(socialHistory.code?.coding);
  const displays = codings.flatMap(coding => coding.display);
  const text = getKnownTitle(socialHistory.code?.text);
  const combined = [text, ...displays].flatMap(a => a || []).sort((a, b) => a.localeCompare(b));

  return Array.from(new Set(combined)).join(", ");
}

function getSocialHistoryValue(socialHistory: Observation): string | undefined {
  const valueConcept = socialHistory.valueCodeableConcept;
  if (socialHistory.valueQuantity) {
    const value = socialHistory.valueQuantity?.value;
    const unit = socialHistory.valueQuantity?.unit?.replace(/[{()}]/g, "");
    return `${value} ${unit ? unit : ""}`;
  } else if (valueConcept) {
    if (valueConcept.coding?.[0]?.display) return valueConcept.coding[0].display;
    return valueConcept?.text;
  }
  return undefined;
}

function getSocialHistoryDate(socialHistory: Observation): string | undefined {
  const providedDate =
    socialHistory.effectiveDateTime ??
    socialHistory.effectivePeriod?.start ??
    socialHistory.effectivePeriod?.end;
  if (!providedDate) return undefined;

  return dayjs(providedDate).format(ISO_DATE);
}

function getSocialHistoryRowData({
  socialHistories,
}: {
  socialHistories: GroupedSocial[];
}): SocialHistoryRowData[] {
  return socialHistories?.map(social => ({
    id: social.mostRecentObservation.id ?? "-",
    observation: social.title ?? "-",
    value: social.sortedPoints?.[0]?.value ?? "-",
    date: social.sortedPoints?.[0]?.date ?? "-",
  }));
}
