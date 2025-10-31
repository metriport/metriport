import { Observation } from "@medplum/fhirtypes";
import dayjs from "dayjs";
import { getResourcesFromBundle, getValidCode, MappedConsolidatedResources, SectionKey } from "..";
import { ISO_DATE } from "../../../common/date";

export type ObservationRowData = {
  id: string;
  observation: string;
  value: string;
  date: string;
};

export function observationTableData({ bundle }: { bundle: MappedConsolidatedResources }) {
  const observations = getResourcesFromBundle<Observation>(bundle, "Observation");
  const otherObservations = getOtherObservations(observations);

  return {
    key: "observations" as SectionKey,
    rowData: getOtherObservationsRowData({ observations: otherObservations }),
  };
}

function getOtherObservations(observations: Observation[]): Observation[] {
  const otherObservations: Observation[] = [];

  for (const observation of observations) {
    const isObservations = observation?.category?.find(ext => {
      const code = ext.coding?.[0]?.code?.toLowerCase();

      return code !== "vital-signs" && code !== "laboratory" && code !== "social-history";
    });
    if (isObservations) {
      otherObservations.push(observation);
    }
  }

  return otherObservations;
}

function getOtherObservationsRowData({
  observations,
}: {
  observations: Observation[];
}): ObservationRowData[] {
  return observations?.map(observation => ({
    id: observation.id ?? "-",
    observation: getObservationsDisplay(observation),
    value: renderObservationsValue(observation),
    date: getSocialHistoryDate(observation),
  }));
}

function getObservationsDisplay(observations: Observation): string {
  const codings = getValidCode(observations.code?.coding);
  const displays = codings.map(coding => coding.display);

  if (displays.length) {
    return displays.join(", ");
  } else if (observations.code?.text) {
    return observations.code.text;
  }

  return "-";
}

function renderObservationsValue(observations: Observation): string {
  if (observations.valueQuantity) {
    const value = observations.valueQuantity?.value;
    const unit = observations.valueQuantity?.unit?.replace(/[{()}]/g, "");

    return `${value} ${unit}`;
  } else if (observations.valueCodeableConcept) {
    return (
      observations.valueCodeableConcept?.text ??
      getValidCode(observations.valueCodeableConcept.coding)[0]?.display ??
      "-"
    );
  } else {
    return "-";
  }
}

function getSocialHistoryDate(observations: Observation): string {
  return dayjs(observations.effectiveDateTime).format(ISO_DATE);
}
