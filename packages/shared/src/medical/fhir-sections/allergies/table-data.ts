import { AllergyIntolerance } from "@medplum/fhirtypes";
import dayjs from "dayjs";
import { ISO_DATE } from "../../../common/date";
import { getResourcesFromBundle, MappedConsolidatedResources, SectionKey } from "../index";

export type AllergyRowData = {
  id: string;
  allergy: string;
  manifestation: string;
  firstSeen: string;
  status: string;
  originalData: AllergyIntolerance;
  ehrAction?: string;
};

export function allergyTableData({ bundle }: { bundle: MappedConsolidatedResources }) {
  const allergies = getResourcesFromBundle<AllergyIntolerance>(bundle, "AllergyIntolerance");
  return { key: "allergies" as SectionKey, rowData: getAllergyRowData({ allergies }) };
}

function getAllergyRowData({ allergies }: { allergies: AllergyIntolerance[] }): AllergyRowData[] {
  return allergies.map(allergy => ({
    id: allergy.id ?? "-",
    allergy: getAllergyName(allergy),
    manifestation: getAllergyManifestation(allergy),
    firstSeen: getAllergyOnset(allergy),
    status: getAllergyClinicalStatus(allergy),
    originalData: allergy,
  }));
}

function getAllergyName(allergy: AllergyIntolerance): string {
  const names: string[] = [];

  for (const reaction of allergy.reaction ?? []) {
    if (reaction.substance?.text) {
      names.push(reaction.substance.text);
    }
  }

  if (names && names.length > 0) {
    return names.join(", ");
  }

  return "-";
}

function getAllergyManifestation(allergy: AllergyIntolerance): string {
  const manifestations: string[] = [];

  for (const reaction of allergy.reaction ?? []) {
    for (const manifestation of reaction.manifestation ?? []) {
      if (manifestation.text) {
        manifestations.push(manifestation.text);
      }
    }
  }

  if (manifestations && manifestations.length > 0) {
    return manifestations.join(", ");
  }

  return "-";
}

function getAllergyOnset(allergy: AllergyIntolerance): string {
  if (allergy.onsetDateTime) {
    return dayjs(allergy.onsetDateTime).format(ISO_DATE);
  } else if (allergy.recordedDate) {
    return dayjs(allergy.recordedDate).format(ISO_DATE);
  }

  return "-";
}

function getAllergyClinicalStatus(allergy: AllergyIntolerance): string {
  return allergy.clinicalStatus?.coding?.[0]?.code ?? "-";
}
