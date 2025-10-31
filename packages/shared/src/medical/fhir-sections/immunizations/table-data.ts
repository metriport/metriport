import { Immunization } from "@medplum/fhirtypes";
import { ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import {
  getFirstCodeSpecified,
  getValidCode,
  getResourcesFromBundle,
  MappedConsolidatedResources,
  SectionKey,
} from "..";
import { CVX_CODE, RXNORM_CODE } from "../../fhir/constants";

export type ImmunizationRowData = {
  id: string;
  immunization: string;
  code: string;
  manufacturer: string;
  date: string;
  status: string;
  originalData: Immunization;
  ehrAction?: string;
};

type ImmunizationOccurrence = {
  rawImmunization: Immunization;
  date: string;
  status: string;
};

export type GroupedImmunizations = {
  title: string;
  mostRecentImmunization: ImmunizationOccurrence;
  code: string;
  sortedOccurrences: ImmunizationOccurrence[];
  status: string;
};

export function immunizationTableData({ bundle }: { bundle: MappedConsolidatedResources }) {
  const immunizations = getResourcesFromBundle<Immunization>(bundle, "Immunization");
  const groupedImmunizations = groupImmunizations(immunizations);
  return {
    key: "immunizations" as SectionKey,
    rowData: getImmunizationRowData({ immunizations: groupedImmunizations }),
  };
}

export function groupImmunizations(imms: Immunization[]): GroupedImmunizations[] {
  const results: GroupedImmunizations[] = [];
  const immsMap = new Map<string, ImmunizationOccurrence[]>();

  imms.map(imm => {
    const code = getImmunizationsCode(imm);
    const title = getImmunizationsDisplay(imm);
    const date = getImmunizationDate(imm);
    const status = imm.status ?? "-";
    const newEntry: ImmunizationOccurrence = {
      rawImmunization: imm,
      date,
      status,
    };
    if (!code) {
      results.push({
        title,
        code: "-",
        mostRecentImmunization: newEntry,
        sortedOccurrences: [newEntry],
        status,
      });
      return;
    }

    const existing = immsMap.get(code);
    if (existing) {
      immsMap.set(code, [...existing, newEntry]);
    } else {
      immsMap.set(code, [newEntry]);
    }
  });

  [...immsMap.entries()].map(([code, values]) => {
    const sortedOccurrences = values.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;

      return dateB - dateA;
    });

    const mostRecent =
      sortedOccurrences.find(o => o.status?.toLowerCase() !== "not-done") ?? sortedOccurrences[0];

    if (!mostRecent) return;
    results.push({
      code,
      title: getImmunizationsDisplay(mostRecent.rawImmunization),
      mostRecentImmunization: mostRecent,
      sortedOccurrences,
      status: mostRecent.status ?? "-",
    });
  });

  return results;
}

function getImmunizationRowData({
  immunizations,
}: {
  immunizations: GroupedImmunizations[];
}): ImmunizationRowData[] {
  return immunizations?.map(immunization => ({
    id: immunization.mostRecentImmunization.rawImmunization.id ?? "-",
    immunization: immunization.title,
    code: immunization.code,
    manufacturer: immunization.mostRecentImmunization.rawImmunization.manufacturer?.display ?? "-",
    date: immunization.mostRecentImmunization.date ?? "-",
    status: immunization.status,
    originalData: immunization.mostRecentImmunization.rawImmunization,
  }));
}

function getImmunizationsDisplay(immunization: Immunization): string {
  const codings = getValidCode(immunization.vaccineCode?.coding);
  const displays = codings.map(coding => coding.display);

  if (displays.length) {
    return displays.join(", ");
  } else if (immunization.vaccineCode?.text) {
    return immunization.vaccineCode.text;
  }

  return "-";
}

function getImmunizationsCode(immunization: Immunization): string | undefined {
  const coding = getFirstCodeSpecified(immunization.vaccineCode?.coding, [CVX_CODE, RXNORM_CODE]);

  return coding ? `${coding.system}: ${coding.code}` : undefined;
}

function getImmunizationDate(immunizations: Immunization): string {
  return dayjs(immunizations.occurrenceDateTime).format(ISO_DATE);
}
